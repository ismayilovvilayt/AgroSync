import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Aktiv bitkiələrin növlərini qaytarır (tapşırıq yaratmaq üçün)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get('fieldId');
    const farmId = searchParams.get('farmId');

    const where: any = {
      status: { not: 'HARVESTED' },
      field: { farm: { companyId } },
    };
    if (fieldId) where.fieldId = fieldId;
    if (farmId) where.field = { farmId, farm: { companyId } };

    const crops = await prisma.seasonField.findMany({
      where,
      select: {
        id: true,
        cropType: true,
        status: true,
        sowingDate: true,
        plantedArea: true,
        fieldId: true,
        field: { select: { fieldNumber: true, hectares: true, farm: { select: { name: true } } } },
      },
      orderBy: { cropType: 'asc' },
    });

    // Unikal bitki növlərini də qaytaraq (dropdown üçün)
    const uniqueCropTypes = [...new Set(crops.map(c => c.cropType))];

    return NextResponse.json({ crops, uniqueCropTypes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
