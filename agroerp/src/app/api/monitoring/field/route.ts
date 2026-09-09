import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requirePermission,
  canSeeAllFarms,
} from '@/lib/rbac';

// GET — sahə monitorinqlərini gətir (RLS)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get('fieldId');
    const farmId = searchParams.get('farmId');

    const where: any = { field: { farm: { companyId: user.companyId } } };
    if (fieldId) where.fieldId = fieldId;

    // RLS
    if (!canSeeAllFarms(user.role) && user.farmId) {
      where.field = { ...where.field, farmId: user.farmId };
    } else if (farmId) {
      where.field = { ...where.field, farmId };
    }

    const monitorings = await prisma.fieldMonitoring.findMany({
      where,
      include: {
        field: { select: { id: true, fieldNumber: true, hectares: true, farm: { select: { name: true } } } },
        user: { select: { fullName: true } },
      },
      orderBy: { monitoringDate: 'desc' },
    });

    return NextResponse.json(monitorings);
  } catch (err: any) {
    console.error('GET /api/monitoring/field error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// POST — yeni sahə monitorinqi yarat (ADMIN, HEAD_AGRONOMIST, AGRONOMIST)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const denied = requirePermission(user.role, 'create');
    if (denied) return denied;

    const body = await req.json();

    // Avtomatik: son suvarma
    let lastIrrigationDate = null;
    let lastIrrigationMm = null;
    const lastIrrigation = await prisma.irrigation.findFirst({
      where: { fieldId: body.fieldId },
      orderBy: { irrigationDate: 'desc' },
      select: { irrigationDate: true, waterMm: true },
    });
    if (lastIrrigation) {
      lastIrrigationDate = lastIrrigation.irrigationDate;
      lastIrrigationMm = lastIrrigation.waterMm;
    }

    // Avtomatik: bitki növü (aktiv seasonField-dən)
    let cropType = body.cropType || null;
    if (!cropType) {
      const activeSF = await prisma.seasonField.findFirst({
        where: { fieldId: body.fieldId, status: { not: 'HARVESTED' } },
        orderBy: { createdAt: 'desc' },
        select: { cropType: true },
      });
      if (activeSF) cropType = activeSF.cropType;
    }

    const monitoring = await prisma.fieldMonitoring.create({
      data: {
        fieldId: body.fieldId,
        userId: user.id,
        monitoringDate: new Date(body.monitoringDate),
        cropType,
        lastIrrigationDate,
        lastIrrigationMm,
        plantPhase: body.plantPhase || null,
        pest: body.pest || null,
        pestPhotos: body.pestPhotos || null,
        disease: body.disease || null,
        diseasePhotos: body.diseasePhotos || null,
        weedStatus: body.weedStatus || null,
        weedPhotos: body.weedPhotos || null,
        nutrientDeficiency: body.nutrientDeficiency || null,
        nutrientPhotos: body.nutrientPhotos || null,
        rodentActivity: body.rodentActivity || null,
        rodentLocation: body.rodentLocation || null,
        irrigationDepthCm: body.irrigationDepthCm ? parseFloat(body.irrigationDepthCm) : null,
        fieldPhoto: body.fieldPhoto || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(monitoring, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/monitoring/field error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
