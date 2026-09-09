import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Aqreqat siyahısı
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;

  const aggregates = await prisma.aggregate.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(aggregates);
}

// POST — Yeni aqreqat yarat
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Ad tələb olunur' }, { status: 400 });
  }

  const aggregate = await prisma.aggregate.create({
    data: {
      companyId,
      name: body.name.trim(),
      type: body.type || null,
      plateNumber: body.plateNumber?.trim() || null,
    },
  });

  return NextResponse.json(aggregate, { status: 201 });
}
