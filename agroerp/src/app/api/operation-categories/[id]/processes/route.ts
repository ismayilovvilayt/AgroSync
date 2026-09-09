import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST — Kateqoriyaya yeni proses əlavə et
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: categoryId } = await params;
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Ad tələb olunur' }, { status: 400 });
  }

  const maxOrder = await prisma.operationProcess.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const process = await prisma.operationProcess.create({
    data: {
      categoryId,
      name: body.name.trim(),
      sortOrder: (maxOrder?.sortOrder || 0) + 1,
    },
  });

  return NextResponse.json(process, { status: 201 });
}

// DELETE — Proses sil (query ?processId=xxx)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const processId = searchParams.get('processId');

  if (!processId) {
    return NextResponse.json({ error: 'processId tələb olunur' }, { status: 400 });
  }

  await prisma.operationProcess.delete({ where: { id: processId } });
  return NextResponse.json({ success: true });
}
