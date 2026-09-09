import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — sahə qeydlərini gətir
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;
  const userRole = (session.user as any).role;
  const userFarmId = (session.user as any).farmId;
  const { searchParams } = new URL(req.url);
  const fieldId = searchParams.get('fieldId');

  const where: any = { field: { farm: { companyId } } };
  if (fieldId) where.fieldId = fieldId;
  if (userRole === 'AGRONOMIST' && userFarmId) where.field = { ...where.field, farmId: userFarmId };

  const notes = await prisma.fieldNote.findMany({
    where,
    include: {
      field: { include: { farm: { select: { name: true } } } },
      user: { select: { fullName: true } },
    },
    orderBy: { noteDate: 'desc' },
  });

  return NextResponse.json(notes);
}

// POST — yeni qeyd yarat
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'AGRONOMIST'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = (session.user as any).id;
  const body = await req.json();

  const note = await prisma.fieldNote.create({
    data: {
      fieldId: body.fieldId,
      userId,
      title: body.title,
      content: body.content,
      photos: body.photos || null,
      weatherCondition: body.weatherCondition || null,
      temperature: body.temperature || null,
      noteDate: new Date(body.noteDate),
    },
  });

  return NextResponse.json(note, { status: 201 });
}
