import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — Kateqoriya redaktə
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const category = await prisma.operationCategory.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      sortOrder: body.sortOrder,
    },
    include: { processes: true },
  });

  return NextResponse.json(category);
}

// DELETE — Kateqoriya sil
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Bu kateqoriyaya bağlı istifadə edilmiş proses varmı?
  const usedCount = await prisma.agroProcess.count({
    where: { category: { id } },
  });
  if (usedCount > 0) {
    return NextResponse.json(
      { error: `Bu kateqoriyaya ${usedCount} aqrotexniki proses qeyd bağlıdır. Əvvəlcə onları silin.` },
      { status: 400 }
    );
  }

  await prisma.operationCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
