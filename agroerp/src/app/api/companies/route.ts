import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — şirkət məlumatları
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      _count: { select: { farms: true, users: true, warehouses: true } },
    },
  });

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(company);
}

// PUT — şirkət məlumatlarını yenilə
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const companyId = (session.user as any).companyId;
  const body = await req.json();

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      name: body.name,
      address: body.address || null,
      phone: body.phone || null,
    },
  });

  return NextResponse.json(company);
}
