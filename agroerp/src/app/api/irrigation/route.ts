import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Bütün suvarmalar (ay filtrli)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month'); // 1-12
  const farmId = searchParams.get('farmId');
  const fieldId = searchParams.get('fieldId');
  const irrigationType = searchParams.get('type');

  const where: any = {
    field: { farm: { companyId } },
  };

  if (farmId) where.field = { ...where.field, farmId };
  if (fieldId) where.fieldId = fieldId;
  if (irrigationType) where.irrigationType = irrigationType;

  if (year && month) {
    const y = parseInt(year);
    const m = parseInt(month) - 1;
    where.irrigationDate = {
      gte: new Date(y, m, 1),
      lt: new Date(y, m + 1, 1),
    };
  } else if (year) {
    where.irrigationDate = {
      gte: new Date(parseInt(year), 0, 1),
      lt: new Date(parseInt(year) + 1, 0, 1),
    };
  }

  const irrigations = await prisma.irrigation.findMany({
    where,
    include: {
      field: { select: { fieldNumber: true, hectares: true, farm: { select: { name: true } } } },
      user: { select: { fullName: true } },
    },
    orderBy: { irrigationDate: 'desc' },
  });

  return NextResponse.json(irrigations);
}

// POST — Yeni suvarma qeydi
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();

  const irrigation = await prisma.irrigation.create({
    data: {
      fieldId: body.fieldId,
      userId,
      irrigationType: body.irrigationType,
      irrigationDate: new Date(body.irrigationDate),
      pivotSpeed: body.pivotSpeed ? parseFloat(body.pivotSpeed) : null,
      waterMm: body.waterMm ? parseFloat(body.waterMm) : null,
      duration: body.duration ? parseFloat(body.duration) : null,
      waterVolume: body.waterVolume ? parseFloat(body.waterVolume) : null,
      notes: body.notes || null,
    },
    include: {
      field: { select: { fieldNumber: true, farm: { select: { name: true } } } },
      user: { select: { fullName: true } },
    },
  });

  return NextResponse.json(irrigation, { status: 201 });
}
