import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requirePermission, requireRoles,
  buildFarmFilter, canSeeAllFarms,
} from '@/lib/rbac';

// GET — bütün təsərrüfatları gətir (RLS)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const where: any = { companyId: user.companyId };

  // OWN_FARM rollar yalnız öz təsərrüfatını görür
  if (!canSeeAllFarms(user.role) && user.farmId) {
    where.id = user.farmId;
  }

  const farms = await prisma.farm.findMany({
    where,
    include: { _count: { select: { fields: true, users: true } } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(farms);
}

// POST — yeni təsərrüfat yarat (yalnız ADMIN)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requireRoles(user.role, ['ADMIN']);
  if (denied) return denied;

  const body = await req.json();

  const farm = await prisma.farm.create({
    data: {
      companyId: user.companyId,
      name: body.name,
      location: body.location || null,
      latitude: body.latitude ? parseFloat(body.latitude) : null,
      longitude: body.longitude ? parseFloat(body.longitude) : null,
      totalHectares: body.totalHectares || 0,
    },
  });

  return NextResponse.json(farm, { status: 201 });
}
