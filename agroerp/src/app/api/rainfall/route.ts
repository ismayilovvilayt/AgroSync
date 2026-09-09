import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Yağıntı qeydləri
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const fieldId = searchParams.get('fieldId');

  const where: any = { companyId };

  if (year && month) {
    const y = parseInt(year);
    const m = parseInt(month) - 1;
    where.rainfallDate = { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
  } else if (year) {
    where.rainfallDate = { gte: new Date(parseInt(year), 0, 1), lt: new Date(parseInt(year) + 1, 0, 1) };
  }

  if (fieldId) {
    where.fields = { some: { fieldId } };
  }

  const rainfalls = await prisma.rainfall.findMany({
    where,
    include: {
      user: { select: { fullName: true } },
      fields: {
        include: {
          field: { select: { fieldNumber: true, farm: { select: { name: true } } } },
        },
      },
    },
    orderBy: { rainfallDate: 'desc' },
  });

  return NextResponse.json(rainfalls);
}

// POST — Yeni yağıntı qeydi (çox sahə)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const companyId = (session.user as any).companyId;
  const body = await req.json();

  // fieldIds: string[] (seçilmiş sahələr) | 'ALL' (hamısı)
  let fieldIds: string[] = body.fieldIds || [];

  if (body.allFields) {
    // Şirkətin bütün aktiv sahələri
    const allFields = await prisma.field.findMany({
      where: { farm: { companyId }, status: 'ACTIVE' },
      select: { id: true },
    });
    fieldIds = allFields.map((f) => f.id);
  }

  const rainfall = await prisma.rainfall.create({
    data: {
      companyId,
      userId,
      rainfallDate: new Date(body.rainfallDate),
      amountMm: parseFloat(body.amountMm),
      notes: body.notes || null,
      fields: {
        create: fieldIds.map((fId) => ({ fieldId: fId })),
      },
    },
    include: {
      user: { select: { fullName: true } },
      fields: {
        include: {
          field: { select: { fieldNumber: true, farm: { select: { name: true } } } },
        },
      },
    },
  });

  return NextResponse.json(rainfall, { status: 201 });
}
