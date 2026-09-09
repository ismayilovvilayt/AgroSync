import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  getSessionUser, unauthorized, requireRoles,
} from '@/lib/rbac';

// PUT — istifadəçi redaktə (yalnız ADMIN)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requireRoles(user.role, ['ADMIN']);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();

  const data: any = {
    fullName: body.fullName,
    phone: body.phone || null,
    role: body.role,
    farmId: body.farmId || null,
    isActive: body.isActive ?? true,
  };

  // Şifrə dəyişdirilərsə
  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, email: true, fullName: true, phone: true,
      role: true, isActive: true, farmId: true,
    },
  });

  return NextResponse.json(updatedUser);
}

// DELETE — istifadəçi sil (yalnız ADMIN)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requireRoles(user.role, ['ADMIN']);
  if (denied) return denied;

  const { id } = await params;

  // Özünü silməsin
  if (id === user.id) {
    return NextResponse.json({ error: 'Özünüzü silə bilməzsiniz' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
