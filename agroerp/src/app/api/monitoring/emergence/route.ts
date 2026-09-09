import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — çıxış monitorinqlərini gətir
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const userRole = (session.user as any).role;
    const userFarmId = (session.user as any).farmId;
    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get('fieldId');
    const farmId = searchParams.get('farmId');

    const where: any = { field: { farm: { companyId } } };
    if (fieldId) where.fieldId = fieldId;
    if (farmId) where.field = { ...where.field, farmId };
    if (userRole === 'AGRONOMIST' && userFarmId) where.field = { ...where.field, farmId: userFarmId };

    const monitorings = await prisma.emergenceMonitoring.findMany({
      where,
      include: {
        field: { select: { id: true, fieldNumber: true, hectares: true, farm: { select: { name: true } } } },
        user: { select: { fullName: true } },
      },
      orderBy: { monitoringDate: 'desc' },
    });

    return NextResponse.json(monitorings);
  } catch (err: any) {
    console.error('GET /api/monitoring/emergence error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// POST — yeni çıxış monitorinqi (səpin tarixi + bitki avtomatik)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as any).id;
    const body = await req.json();

    // Avtomatik: səpin tarixi (Toxum səpini əməliyyatından)
    let sowingDate = body.sowingDate ? new Date(body.sowingDate) : null;
    if (!sowingDate) {
      const sowingProcess = await prisma.agroProcess.findFirst({
        where: {
          fieldId: body.fieldId,
          category: { name: { contains: 'Toxum' } },
        },
        orderBy: { processDate: 'desc' },
        select: { processDate: true },
      });
      if (sowingProcess) sowingDate = sowingProcess.processDate;
    }

    // Avtomatik: bitki + növ
    let cropType = body.cropType || null;
    let variety = body.variety || null;
    if (!cropType) {
      const activeSF = await prisma.seasonField.findFirst({
        where: { fieldId: body.fieldId, status: { not: 'HARVESTED' } },
        orderBy: { createdAt: 'desc' },
        select: { cropType: true },
      });
      if (activeSF) cropType = activeSF.cropType;
    }

    // Çıxış faizi avtomatik hesabla
    const plantedCount = body.plantedCount ? parseFloat(body.plantedCount) : null;
    const emergedCount = body.emergedCount ? parseFloat(body.emergedCount) : null;
    let emergencePercent = body.emergencePercent ? parseFloat(body.emergencePercent) : null;
    if (plantedCount && emergedCount && !emergencePercent) {
      emergencePercent = Math.round((emergedCount / plantedCount) * 1000) / 10;
    }

    // countUnit: buğda/arpa → million, digər → thousand
    let countUnit = body.countUnit || 'thousand';
    if (cropType && ['Buğda', 'Arpa'].includes(cropType)) {
      countUnit = 'million';
    }

    const monitoring = await prisma.emergenceMonitoring.create({
      data: {
        fieldId: body.fieldId,
        userId,
        monitoringDate: new Date(body.monitoringDate),
        sowingDate,
        cropType,
        variety,
        plantedCount,
        countUnit,
        emergedCount,
        emergencePercent,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(monitoring, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/monitoring/emergence error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
