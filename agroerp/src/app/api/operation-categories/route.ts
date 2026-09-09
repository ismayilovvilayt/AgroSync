import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Əməliyyat kateqoriyaları + prosesləri
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;

  const categories = await prisma.operationCategory.findMany({
    where: { companyId },
    include: {
      processes: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { agroProcesses: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json(categories);
}

// POST — Yeni əməliyyat kateqoriyası yarat
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Ad tələb olunur' }, { status: 400 });
  }

  // sortOrder: sonuncu + 1
  const maxOrder = await prisma.operationCategory.findFirst({
    where: { companyId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const category = await prisma.operationCategory.create({
    data: {
      companyId,
      name: body.name.trim(),
      sortOrder: (maxOrder?.sortOrder || 0) + 1,
    },
    include: { processes: true },
  });

  return NextResponse.json(category, { status: 201 });
}
