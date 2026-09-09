import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — anbar məhsulunu redaktə et
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const item = await prisma.warehouseItem.update({
    where: { id },
    data: {
      name: body.name,
      category: body.category,
      currentStock: body.currentStock ?? 0,
      unit: body.unit,
      minStock: body.minStock ?? 0,
    },
  });

  return NextResponse.json(item);
}

// DELETE — anbar məhsulunu sil
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'MANAGER'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  await prisma.warehouseItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
