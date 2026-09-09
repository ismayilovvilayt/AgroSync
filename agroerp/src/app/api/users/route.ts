import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  getSessionUser, unauthorized, requireRoles,
} from '@/lib/rbac';

// GET — istifadəçiləri gətir (ADMIN: full, OFFICE_MANAGER: read-only)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requireRoles(user.role, ['ADMIN', 'OFFICE_MANAGER']);
  if (denied) return denied;

  const users = await prisma.user.findMany({
    where: { companyId: user.companyId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      farm: { select: { id: true, name: true } },
    },
    orderBy: { fullName: 'asc' },
  });

  return NextResponse.json(users);
}

// POST — yeni istifadəçi yarat (yalnız ADMIN)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requireRoles(user.role, ['ADMIN']);
  if (denied) return denied;

  const body = await req.json();

  // Email yoxla
  const existing = await prisma.user.findUnique({
    where: { email: body.email },
  });
  if (existing) {
    return NextResponse.json({ error: 'Bu email artıq istifadə olunur' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(body.password, 10);

  const newUser = await prisma.user.create({
    data: {
      companyId: user.companyId,
      email: body.email,
      password: hashedPassword,
      fullName: body.fullName,
      phone: body.phone || null,
      role: body.role || 'AGRONOMIST',
      farmId: body.farmId || null,
    },
  });

  return NextResponse.json(
    { id: newUser.id, email: newUser.email, fullName: newUser.fullName, role: newUser.role },
    { status: 201 }
  );
}
