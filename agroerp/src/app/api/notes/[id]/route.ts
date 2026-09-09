import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — qeyd redaktə
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const note = await prisma.fieldNote.update({
    where: { id },
    data: {
      title: body.title,
      content: body.content,
      photos: body.photos || null,
      weatherCondition: body.weatherCondition || null,
      temperature: body.temperature || null,
      noteDate: new Date(body.noteDate),
    },
  });

  return NextResponse.json(note);
}

// DELETE — qeyd sil
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  await prisma.fieldNote.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
