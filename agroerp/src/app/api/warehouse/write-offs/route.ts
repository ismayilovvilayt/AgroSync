import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Silinmə qeydlərini gətir (status, fieldId, warehouseItemId filtri)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const userRole = (session.user as any).role;
    const userFarmId = (session.user as any).farmId;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const fieldId = searchParams.get('fieldId');
    const warehouseItemId = searchParams.get('warehouseItemId');
    const farmId = searchParams.get('farmId');

    const where: any = {
      warehouseItem: { warehouse: { companyId } },
    };

    if (status) where.status = status;
    if (fieldId) where.fieldId = fieldId;
    if (warehouseItemId) where.warehouseItemId = warehouseItemId;
    if (farmId) where.field = { farmId };
    if (userRole === 'AGRONOMIST' && userFarmId) where.field = { farmId: userFarmId };

    const writeOffs = await prisma.writeOff.findMany({
      where,
      include: {
        warehouseItem: { select: { id: true, name: true, code1C: true, unit: true, category: true } },
        field: {
          select: {
            id: true, fieldNumber: true,
            farm: { select: { id: true, name: true } },
          },
        },
        agroProcessMaterial: {
          select: {
            agroProcess: {
              select: {
                id: true, processDate: true,
                category: { select: { name: true } },
                process: { select: { name: true } },
                seasonField: { select: { cropType: true, season: { select: { name: true } } } },
              },
            },
          },
        },
        user: { select: { fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { processDate: 'desc' }],
    });

    return NextResponse.json(writeOffs);
  } catch (err: any) {
    console.error('GET /api/warehouse/write-offs error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// PUT — Toplu silinmə təsdiqi
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const body = await req.json();
    // body: { ids: string[] } — təsdiqlənəcək write-off ID-ləri
    const ids: string[] = body.ids || [];

    if (!ids.length) {
      return NextResponse.json({ error: 'ID-lər lazımdır' }, { status: 400 });
    }

    const result = await prisma.writeOff.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: new Date(), userId },
    });

    return NextResponse.json({ updated: result.count });
  } catch (err: any) {
    console.error('PUT /api/warehouse/write-offs error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
