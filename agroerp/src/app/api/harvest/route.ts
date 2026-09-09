import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const fieldId = searchParams.get('fieldId') || undefined;

    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const where: any = {
      harvestDate: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    };

    if (user.role !== 'ADMIN' && user.role !== 'OFFICE_MANAGER') {
      if (user.farmId) {
        const farmFields = await prisma.field.findMany({ where: { farmId: user.farmId }, select: { id: true } });
        where.fieldId = { in: farmFields.map(f => f.id) };
      }
    }
    if (fieldId) where.fieldId = fieldId;

    const records = await prisma.harvestRecord.findMany({
      where,
      include: {
        field: { include: { farm: { select: { name: true } } } },
        seasonField: { select: { cropType: true, season: { select: { name: true } } } },
        user: { select: { fullName: true } },
      },
      orderBy: { harvestDate: 'desc' },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error('Harvest GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { fieldId, harvestDate, cropType, yieldTons, moisturePercent, qualityGrade, truckCount, notes, seasonFieldId } = body;

    if (!fieldId || !harvestDate || !cropType || !yieldTons) {
      return NextResponse.json({ error: 'fieldId, harvestDate, cropType, yieldTons tələb olunur' }, { status: 400 });
    }

    const record = await prisma.harvestRecord.create({
      data: {
        fieldId,
        seasonFieldId: seasonFieldId || null,
        userId: user.id,
        harvestDate: new Date(harvestDate),
        cropType,
        yieldTons: parseFloat(yieldTons),
        moisturePercent: moisturePercent ? parseFloat(moisturePercent) : null,
        qualityGrade: qualityGrade || null,
        truckCount: truckCount ? parseInt(truckCount) : null,
        notes: notes || null,
      },
      include: {
        field: { include: { farm: { select: { name: true } } } },
        user: { select: { fullName: true } },
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    console.error('Harvest POST error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
