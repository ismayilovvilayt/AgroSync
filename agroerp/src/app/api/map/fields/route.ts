import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — xəritə üçün bütün sahə məlumatları
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const userRole  = (session.user as any).role;
    const userFarmId = (session.user as any).farmId;

    const where: any = { farm: { companyId } };
    if (userRole === 'AGRONOMIST' && userFarmId) where.farmId = userFarmId;

    const fields = await prisma.field.findMany({
      where,
      include: {
        farm: { select: { id: true, name: true } },
        seasonFields: {
          where: { status: { not: 'HARVESTED' } },
          select: { id: true, cropType: true, status: true, plantedArea: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        irrigations: {
          orderBy: { irrigationDate: 'desc' },
          take: 1,
          select: { irrigationDate: true, irrigationType: true },
        },
        processes: {
          orderBy: { processDate: 'desc' },
          take: 1,
          select: { processDate: true, processType: true, status: true },
        },
      },
    });

    return NextResponse.json(fields);
  } catch (err: any) {
    console.error('GET /api/map/fields error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
