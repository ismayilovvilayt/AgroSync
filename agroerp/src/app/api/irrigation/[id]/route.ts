import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — suvarma redaktə
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'AGRONOMIST'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const irrigation = await prisma.irrigation.update({
    where: { id },
    data: {
      irrigationType: body.irrigationType,
      irrigationDate: new Date(body.irrigationDate),
      pivotSpeed: body.pivotSpeed ? parseFloat(body.pivotSpeed) : null,
      waterMm: body.waterMm ? parseFloat(body.waterMm) : null,
      duration: body.duration ? parseFloat(body.duration) : null,
      waterVolume: body.waterVolume ? parseFloat(body.waterVolume) : null,
      notes: body.notes || null,
    },
  });

  return NextResponse.json(irrigation);
}

// DELETE — suvarma sil
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'AGRONOMIST'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  await prisma.irrigation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
