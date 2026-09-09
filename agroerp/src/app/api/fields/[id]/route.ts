import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — sahə detalları
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const field = await prisma.field.findUnique({
    where: { id },
    include: {
      farm: { select: { name: true } },
      parent: { select: { id: true, fieldNumber: true } },
      children: { select: { id: true, fieldNumber: true, hectares: true, status: true } },
      seasonFields: {
        include: { season: { select: { id: true, name: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { processes: true, irrigations: true, notes: true, children: true } },
    },
  });

  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(field);
}

// PUT — sahə redaktə
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'MANAGER', 'AGRONOMIST'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const field = await prisma.field.update({
    where: { id },
    data: {
      fieldNumber: body.fieldNumber,
      hectares: body.hectares,
      soilType: body.soilType || null,
      status: body.status || 'ACTIVE',
      parentId: body.parentId !== undefined ? (body.parentId || null) : undefined,
      latitude:  body.latitude  !== undefined ? body.latitude  : undefined,
      longitude: body.longitude !== undefined ? body.longitude : undefined,
      polygon:   body.polygon   !== undefined ? body.polygon   : undefined,
      irrigationIntervalDays: body.irrigationIntervalDays !== undefined
        ? body.irrigationIntervalDays
        : undefined,
    },
  });

  return NextResponse.json(field);
}

// DELETE — sahə sil
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

  await prisma.field.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH — qismən yeniləmə (məs: irrigationIntervalDays)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: any = {};
  if (body.irrigationIntervalDays !== undefined) {
    data.irrigationIntervalDays = body.irrigationIntervalDays;
  }
  if (body.status !== undefined) data.status = body.status;

  const field = await prisma.field.update({ where: { id }, data });
  return NextResponse.json(field);
}
