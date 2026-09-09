import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Sahənin pivot sürət cədvəli
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fieldId } = await params;

  const chart = await prisma.pivotSpeedChart.findUnique({ where: { fieldId } });
  if (!chart) return NextResponse.json(null);

  return NextResponse.json({
    ...chart,
    entries: JSON.parse(chart.entries),
  });
}

// POST/PUT — Pivot sürət cədvəlini yarat və ya yenilə
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fieldId } = await params;
  const body = await req.json();

  // entries: [{speed: 10, mm: 45}, ...]
  const chart = await prisma.pivotSpeedChart.upsert({
    where: { fieldId },
    update: { entries: JSON.stringify(body.entries) },
    create: { fieldId, entries: JSON.stringify(body.entries) },
  });

  return NextResponse.json({ ...chart, entries: JSON.parse(chart.entries) });
}
