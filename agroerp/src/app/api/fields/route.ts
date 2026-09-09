import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requirePermission,
  buildFieldFilter, canSeeAllFarms,
} from '@/lib/rbac';
import { compareFieldNumbers } from '@/lib/naturalSort';

// GET — bütün sahələri gətir (RLS)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get('farmId');

  const where: any = buildFieldFilter(user);
  if (farmId && (canSeeAllFarms(user.role) || farmId === user.farmId)) {
    where.farmId = farmId;
  }

  const fields = await prisma.field.findMany({
    where,
    include: {
      farm: { select: { name: true } },
      parent: { select: { id: true, fieldNumber: true } },
      children: { select: { id: true, fieldNumber: true, hectares: true } },
      seasonFields: {
        orderBy: { createdAt: 'desc' },
        include: { season: { select: { id: true, name: true, status: true } } },
      },
      _count: { select: { processes: true, irrigations: true, notes: true, children: true } },
    },
    orderBy: [{ farm: { name: 'asc' } }, { fieldNumber: 'asc' }],
  });

  // Natural sort — "1", "1.1", "1.2", "2", "10" ardıcıllığı
  fields.sort((a, b) => {
    const farmCmp = (a.farm?.name || '').localeCompare(b.farm?.name || '');
    if (farmCmp !== 0) return farmCmp;
    return compareFieldNumbers(a.fieldNumber, b.fieldNumber);
  });

  return NextResponse.json(fields);
}

// POST — yeni sahə yarat (ADMIN, HEAD_AGRONOMIST, AGRONOMIST)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requirePermission(user.role, 'create');
  if (denied) return denied;

  const body = await req.json();

  // OWN_FARM rollar yalnız öz təsərrüfatına sahə yarada bilər
  let farmId = body.farmId;
  if (!canSeeAllFarms(user.role)) {
    if (!user.farmId) {
      return NextResponse.json({ error: 'Təsərrüfat təyin edilməyib' }, { status: 400 });
    }
    farmId = user.farmId;
  }

  // Sahə nömrəsi formatı: 0.00 (yuvarlaqlaşdırılmır, yalnız 2 onluq göstərilir)
  let fieldNumber = String(body.fieldNumber).trim();
  const numVal = parseFloat(fieldNumber);
  if (!isNaN(numVal)) {
    // 0.00 formatına sal (məs: "1" -> "1.00", "1.1" -> "1.10")
    fieldNumber = numVal.toFixed(2);
  }

  const existing = await prisma.field.findFirst({
    where: { farmId, fieldNumber },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Bu nömrə (${fieldNumber}) artıq mövcuddur` },
      { status: 400 }
    );
  }

  const field = await prisma.field.create({
    data: {
      farmId,
      parentId: body.parentId || null,
      fieldNumber,
      hectares: body.hectares,
      soilType: body.soilType || null,
      status: body.status || 'ACTIVE',
      irrigationIntervalDays: body.irrigationIntervalDays ? parseInt(body.irrigationIntervalDays) : null,
      latitude: body.latitude ? parseFloat(body.latitude) : null,
      longitude: body.longitude ? parseFloat(body.longitude) : null,
      polygon: body.polygon || null,
    },
  });

  return NextResponse.json(field, { status: 201 });
}
