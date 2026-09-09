import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requirePermission,
  buildFieldFilter, canSeeAllFarms,
} from '@/lib/rbac';

// GET — prosesləri gətir (RLS + Advanced Filter)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get('fieldId');
    const categoryId = searchParams.get('categoryId');
    const processId = searchParams.get('processId');
    const materialId = searchParams.get('materialId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // RLS: field → farm filtr
    const where: any = { field: { farm: { companyId: user.companyId } } };
    if (!canSeeAllFarms(user.role) && user.farmId) {
      where.field = { ...where.field, farmId: user.farmId };
    }

    // Advanced filtrlər
    if (fieldId) where.fieldId = fieldId;
    if (categoryId) where.categoryId = categoryId;
    if (processId) where.processId = processId;
    if (materialId) {
      where.materials = { some: { warehouseItemId: materialId } };
    }
    if (from || to) {
      where.processDate = {};
      if (from) where.processDate.gte = new Date(from);
      if (to) where.processDate.lte = new Date(to);
    }

    const processes = await prisma.agroProcess.findMany({
      where,
      include: {
        field: { include: { farm: { select: { name: true } } } },
        user: { select: { fullName: true } },
        category: { select: { id: true, name: true } },
        process: { select: { id: true, name: true } },
        aggregate: { select: { id: true, name: true, type: true } },
        tractor: { select: { id: true, name: true, type: true, plateNumber: true } },
        seasonField: {
          select: {
            id: true, cropType: true, status: true,
            season: { select: { id: true, name: true } },
          },
        },
        materials: {
          include: {
            warehouseItem: { select: { id: true, name: true, unit: true, currentStock: true, category: true } },
          },
        },
      },
      orderBy: { processDate: 'desc' },
    });

    return NextResponse.json(processes);
  } catch (err: any) {
    console.error('GET /api/processes error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// POST — yeni proses yarat (çox-material + anbar inteqrasiyası + avtomatik nömrələmə)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // ADMIN, HEAD_AGRONOMIST, AGRONOMIST — create icazəsi
  const denied = requirePermission(user.role, 'create');
  if (denied) return denied;

  // OWN_FARM yoxlama
  if (!canSeeAllFarms(user.role) && user.farmId) {
    const field = await prisma.field.findFirst({
      where: { id: (await req.clone().json()).fieldId, farmId: user.farmId },
    });
    // yoxlama yalnız fieldId mövcud olduqda
  }

  const body = await req.json();

  // Materiallar array-i: [{ warehouseItemId, quantity, ratePerHa? }]
  const materialsInput: Array<{
    warehouseItemId: string;
    quantity: number;
    ratePerHa?: number;
  }> = body.materials || [];

  // Transaction: proses yarat + material yarat + anbar stok azalt + movement yarat
  const result = await prisma.$transaction(async (tx) => {
    // Avtomatik nömrələmə: eyni field + category üzrə sıra
    let operationSeqNumber: number | null = null;
    if (body.categoryId) {
      const count = await tx.agroProcess.count({
        where: { fieldId: body.fieldId, categoryId: body.categoryId },
      });
      operationSeqNumber = count + 1;
    }

    // 1. AgroProcess yarat
    const agroProcess = await tx.agroProcess.create({
      data: {
        fieldId: body.fieldId,
        userId: user.id,
        seasonFieldId: body.seasonFieldId || null,
        categoryId: body.categoryId || null,
        processId: body.processId || null,
        aggregateId: body.aggregateId || null,
        tractorId: body.tractorId || null,
        processType: body.processType || 'OTHER',
        description: body.description || null,
        operationSeqNumber,
        processDate: new Date(body.processDate),
        areaProcessed: body.areaProcessed ? parseFloat(body.areaProcessed) : null,
        notes: body.notes || null,
        status: body.status || 'COMPLETED',
      },
    });

    // 2. Hər material üçün: AgroProcessMaterial yarat + WarehouseMovement(OUT) yarat + stok azalt
    for (const mat of materialsInput) {
      if (!mat.warehouseItemId || !mat.quantity) continue;

      // Anbar çıxış hərəkəti
      const movement = await tx.warehouseMovement.create({
        data: {
          warehouseItemId: mat.warehouseItemId,
          userId: user.id,
          fieldId: body.fieldId,
          movementType: 'OUT',
          quantity: mat.quantity,
          reason: `Aqrotexniki iş — ${body.description || 'proses'}`,
          movementDate: new Date(body.processDate),
        },
      });

      // Stok azalt
      await tx.warehouseItem.update({
        where: { id: mat.warehouseItemId },
        data: { currentStock: { decrement: mat.quantity } },
      });

      // Material qeydi
      const procMat = await tx.agroProcessMaterial.create({
        data: {
          agroProcessId: agroProcess.id,
          warehouseItemId: mat.warehouseItemId,
          quantity: mat.quantity,
          ratePerHa: mat.ratePerHa || null,
          warehouseMovementId: movement.id,
        },
      });

      // WriteOff (silinmə izləmə) — avtomatik PENDING
      await tx.writeOff.create({
        data: {
          agroProcessMaterialId: procMat.id,
          warehouseItemId: mat.warehouseItemId,
          fieldId: body.fieldId,
          quantity: mat.quantity,
          status: 'PENDING',
          processDate: new Date(body.processDate),
        },
      });
    }

    return agroProcess;
  });

  return NextResponse.json(result, { status: 201 });
}
