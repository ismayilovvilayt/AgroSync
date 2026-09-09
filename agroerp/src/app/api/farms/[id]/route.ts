import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — təsərrüfat detalları
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const farm = await prisma.farm.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { fieldNumber: 'asc' } },
      users: { select: { id: true, fullName: true, email: true, role: true } },
      _count: { select: { fields: true } },
    },
  });

  if (!farm) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(farm);
}

// PUT — təsərrüfat redaktə
export async function PUT(
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
  const body = await req.json();

  const farm = await prisma.farm.update({
    where: { id },
    data: {
      name: body.name,
      location: body.location,
      latitude: body.latitude !== undefined ? (body.latitude ? parseFloat(body.latitude) : null) : undefined,
      longitude: body.longitude !== undefined ? (body.longitude ? parseFloat(body.longitude) : null) : undefined,
      totalHectares: body.totalHectares,
    },
  });

  return NextResponse.json(farm);
}

// DELETE — təsərrüfat sil
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  await prisma.farm.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
