import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — aylıq/sezon yekunları
// ?year=2025&farmId=xxx&type=summary
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session.user as any).companyId;
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const farmId = searchParams.get('farmId');

  const where: any = {
    field: { farm: { companyId } },
    irrigationDate: {
      gte: new Date(year, 0, 1),
      lt: new Date(year + 1, 0, 1),
    },
  };
  if (farmId) where.field = { ...where.field, farmId };

  const irrigations = await prisma.irrigation.findMany({
    where,
    select: {
      irrigationDate: true,
      irrigationType: true,
      waterMm: true,
      waterVolume: true,
      duration: true,
      field: { select: { fieldNumber: true, hectares: true, farm: { select: { name: true } } } },
    },
  });

  // Aylıq yekunlar (ay × sahə)
  const monthlyByField: Record<string, Record<number, { mm: number; vol: number; count: number }>> = {};
  const monthlyTotal: Record<number, { mm: number; vol: number; count: number }> = {};

  for (let m = 0; m < 12; m++) {
    monthlyTotal[m] = { mm: 0, vol: 0, count: 0 };
  }

  for (const irr of irrigations) {
    const month = new Date(irr.irrigationDate).getMonth();
    const fieldKey = irr.field.fieldNumber;

    if (!monthlyByField[fieldKey]) {
      monthlyByField[fieldKey] = {};
      for (let m = 0; m < 12; m++) monthlyByField[fieldKey][m] = { mm: 0, vol: 0, count: 0 };
    }

    if (irr.waterMm) {
      monthlyByField[fieldKey][month].mm += irr.waterMm;
      monthlyTotal[month].mm += irr.waterMm;
    }
    if (irr.waterVolume) {
      monthlyByField[fieldKey][month].vol += irr.waterVolume;
      monthlyTotal[month].vol += irr.waterVolume;
    }
    monthlyByField[fieldKey][month].count++;
    monthlyTotal[month].count++;
  }

  // Yağıntı yekunu (ay üzrə)
  const rainfallWhere: any = {
    company: { id: companyId },
    rainfallDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
  };
  if (farmId) rainfallWhere.fields = { some: { field: { farmId } } };

  const rainfalls = await prisma.rainfall.findMany({
    where: rainfallWhere,
    select: { rainfallDate: true, amountMm: true },
  });

  const rainfallMonthly: Record<number, number> = {};
  for (let m = 0; m < 12; m++) rainfallMonthly[m] = 0;
  for (const r of rainfalls) {
    const month = new Date(r.rainfallDate).getMonth();
    rainfallMonthly[month] += r.amountMm;
  }

  return NextResponse.json({
    year,
    monthlyTotal,
    monthlyByField,
    rainfallMonthly,
  });
}
