import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requirePermission,
  canSeeAllFarms,
} from '@/lib/rbac';

// GET — hərəkətləri gətir (RLS)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const warehouseItemId = searchParams.get('itemId');

  const where: any = { warehouseItem: { warehouse: { companyId: user.companyId } } };

  // RLS: OWN_FARM rollar yalnız öz farmının anbar hərəkətlərini görür
  if (!canSeeAllFarms(user.role) && user.farmId) {
    where.warehouseItem = {
      warehouse: { companyId: user.companyId, farmId: user.farmId },
    };
  }

  if (warehouseItemId) where.warehouseItemId = warehouseItemId;

  const movements = await prisma.warehouseMovement.findMany({
    where,
    include: {
      warehouseItem: { include: { warehouse: { select: { name: true } } } },
      user: { select: { fullName: true } },
      field: { select: { fieldNumber: true, farm: { select: { name: true } } } },
    },
    orderBy: { movementDate: 'desc' },
  });

  return NextResponse.json(movements);
}

// POST — yeni hərəkət qeyd et (ADMIN, HEAD_AGRONOMIST, AGRONOMIST)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requirePermission(user.role, 'create');
  if (denied) return denied;

  const body = await req.json();

  // Hərəkəti yarat
  const movement = await prisma.warehouseMovement.create({
    data: {
      warehouseItemId: body.warehouseItemId,
      userId: user.id,
      fieldId: body.fieldId || null,
      movementType: body.movementType,
      quantity: body.quantity,
      reason: body.reason || null,
      supplier: body.supplier || null,
      unitPrice: body.unitPrice || null,
      movementDate: new Date(body.movementDate),
      notes: body.notes || null,
    },
  });

  // Stoku yenilə
  const item = await prisma.warehouseItem.findUnique({
    where: { id: body.warehouseItemId },
  });

  if (item) {
    const newStock =
      body.movementType === 'IN'
        ? item.currentStock + body.quantity
        : item.currentStock - body.quantity;

    await prisma.warehouseItem.update({
      where: { id: body.warehouseItemId },
      data: { currentStock: Math.max(0, newStock) },
    });
  }

  return NextResponse.json(movement, { status: 201 });
}
