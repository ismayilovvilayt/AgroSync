import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PATCH — tapşırığı yenilə (arxivlə, başlığı dəyiştir, vs.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.fieldTask.findFirst({ where: { id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Tapşırıq tapılmadı' }, { status: 404 });

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.category !== undefined) data.category = body.category;
    if (body.description !== undefined) data.description = body.description;
    if (body.dueDate !== undefined) data.dueDate = new Date(body.dueDate);
    if (body.status !== undefined) data.status = body.status;

    const task = await prisma.fieldTask.update({ where: { id }, data });
    return NextResponse.json(task);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — tapşırığı sil (bütün item-lərlə birlikdə cascades)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const { id } = await params;

    const existing = await prisma.fieldTask.findFirst({ where: { id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Tapılmadı' }, { status: 404 });

    await prisma.fieldTask.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
