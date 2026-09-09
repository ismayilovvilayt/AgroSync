import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Pivot dayanmaları
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const fieldId = searchParams.get('fieldId');

  const where: any = {
    field: { farm: { companyId } },
  };

  if (fieldId) where.fieldId = fieldId;

  if (year && month) {
    const y = parseInt(year);
    const m = parseInt(month) - 1;
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 1);
    where.OR = [
      { startDate: { gte: monthStart, lt: monthEnd } },
      { endDate: { gte: monthStart, lt: monthEnd } },
      { AND: [{ startDate: { lt: monthStart } }, { OR: [{ endDate: { gte: monthEnd } }, { endDate: null }] }] },
    ];
  }

  const stoppages = await prisma.pivotStoppage.findMany({
    where,
    include: {
      field: { select: { fieldNumber: true, farm: { select: { name: true } } } },
      user: { select: { fullName: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  return NextResponse.json(stoppages);
}

// POST — Yeni dayanma qeydi
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();

  const stoppage = await prisma.pivotStoppage.create({
    data: {
      fieldId: body.fieldId,
      userId,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      reason: body.reason,
      title: body.title,
      notes: body.notes || null,
    },
    include: {
      field: { select: { fieldNumber: true, farm: { select: { name: true } } } },
      user: { select: { fullName: true } },
    },
  });

  return NextResponse.json(stoppage, { status: 201 });
}
