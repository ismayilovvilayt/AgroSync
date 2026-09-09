import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PATCH — Dayanmanı bitir (endDate yenilə)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const stoppage = await prisma.pivotStoppage.update({
    where: { id },
    data: {
      endDate: body.endDate ? new Date(body.endDate) : null,
      title: body.title,
      notes: body.notes,
    },
  });

  return NextResponse.json(stoppage);
}

// DELETE
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await prisma.pivotStoppage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
