import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const userRole = (session.user as any).role;
    const userFarmId = (session.user as any).farmId;
    const { searchParams } = new URL(req.url);

    const farmId = searchParams.get('farmId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const seasonId = searchParams.get('seasonId');

    const farmFilter = userRole === 'AGRONOMIST' && userFarmId ? userFarmId : farmId || undefined;

    const processWhere: any = { field: { farm: { companyId } } };
    if (farmFilter) processWhere.field = { ...processWhere.field, farmId: farmFilter };
    if (from || to) {
      processWhere.processDate = {};
      if (from) processWhere.processDate.gte = new Date(from);
      if (to) processWhere.processDate.lte = new Date(to);
    }
    if (seasonId) processWhere.seasonField = { seasonId };

    const irrWhere: any = { field: { farm: { companyId } } };
    if (farmFilter) irrWhere.field = { ...irrWhere.field, farmId: farmFilter };
    if (from || to) {
      irrWhere.irrigationDate = {};
      if (from) irrWhere.irrigationDate.gte = new Date(from);
      if (to) irrWhere.irrigationDate.lte = new Date(to);
    }

    // ── 1. PROSES STATİSTİKASI ────────────────────────────────────────────────
    const processes = await prisma.agroProcess.findMany({
      where: processWhere,
      include: {
        category: true,
        process: true,
        field: { include: { farm: true } },
        seasonField: true,
        materials: { include: { warehouseItem: true } },
      },
      orderBy: { processDate: 'asc' },
    });

    // Əməliyyat kateqoriyasına görə qrup
    const byCategory: Record<string, { count: number; totalHa: number; label: string }> = {};
    for (const p of processes) {
      const key = p.category?.name || 'Digər';
      if (!byCategory[key]) byCategory[key] = { count: 0, totalHa: 0, label: key };
      byCategory[key].count += 1;
      byCategory[key].totalHa += p.areaProcessed || 0;
    }

    // Aylıq proses qrupu
    const byMonth: Record<string, number> = {};
    for (const p of processes) {
      const month = new Date(p.processDate).toISOString().slice(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + 1;
    }

    // ── 2. PREPARAT İSTİFADƏSİ ────────────────────────────────────────────────
    const allMaterials = processes.flatMap(p => p.materials);
    const materialUsage: Record<string, { name: string; totalQty: number; unit: string; usageCount: number }> = {};
    for (const m of allMaterials) {
      const name = m.warehouseItem?.name || 'Naməlum';
      const key = m.warehouseItemId || name;
      if (!materialUsage[key]) {
        materialUsage[key] = { name, totalQty: 0, unit: m.warehouseItem?.unit || '', usageCount: 0 };
      }
      materialUsage[key].totalQty += m.quantity || 0;
      materialUsage[key].usageCount += 1;
    }

    // ── 3. SUVARMA STATİSTİKASI ───────────────────────────────────────────────
    const irrigations = await prisma.irrigation.findMany({
      where: irrWhere,
      select: {
        irrigationDate: true,
        irrigationType: true,
        waterMm: true,
        waterVolume: true,
        field: { select: { fieldNumber: true, hectares: true } },
      },
      orderBy: { irrigationDate: 'asc' },
    });

    // Aylıq suvarma mm
    const irrByMonth: Record<string, { count: number; totalMm: number; totalM3: number }> = {};
    let totalMm = 0;
    let totalM3 = 0;
    for (const i of irrigations) {
      const month = new Date(i.irrigationDate).toISOString().slice(0, 7);
      if (!irrByMonth[month]) irrByMonth[month] = { count: 0, totalMm: 0, totalM3: 0 };
      irrByMonth[month].count += 1;
      irrByMonth[month].totalMm += i.waterMm || 0;
      irrByMonth[month].totalM3 += i.waterVolume || 0;
      totalMm += i.waterMm || 0;
      totalM3 += i.waterVolume || 0;
    }

    // Suvarma növü üzrə
    const irrByType: Record<string, number> = {};
    for (const i of irrigations) {
      const t = i.irrigationType || 'Digər';
      irrByType[t] = (irrByType[t] || 0) + 1;
    }

    // ── 4. SAHƏLƏRİN FƏALİYYƏTİ ──────────────────────────────────────────────
    const byField: Record<string, { fieldNumber: string; farmName: string; processCount: number; irrCount: number; totalHa: number }> = {};
    for (const p of processes) {
      const key = p.fieldId;
      if (!byField[key]) {
        byField[key] = {
          fieldNumber: p.field?.fieldNumber || '',
          farmName: p.field?.farm?.name || '',
          processCount: 0,
          irrCount: 0,
          totalHa: p.field?.hectares || 0,
        };
      }
      byField[key].processCount += 1;
    }
    for (const i of irrigations) {
      const key = (i as any).fieldId;
      if (key && byField[key]) byField[key].irrCount += 1;
    }

    // ── 5. ANBAR ÇIXIŞI ───────────────────────────────────────────────────────
    const writeOffWhere: any = {
      status: 'COMPLETED',
      field: { farm: { companyId } },
    };
    if (farmFilter) writeOffWhere.field = { ...writeOffWhere.field, farmId: farmFilter };
    if (from || to) {
      writeOffWhere.createdAt = {};
      if (from) writeOffWhere.createdAt.gte = new Date(from);
      if (to) writeOffWhere.createdAt.lte = new Date(to);
    }

    const writeOffs = await prisma.writeOff.findMany({
      where: writeOffWhere,
      include: { warehouseItem: { select: { name: true, unit: true } } },
    });

    const writeOffSummary: Record<string, { name: string; total: number; unit: string }> = {};
    for (const w of writeOffs) {
      const key = w.warehouseItemId;
      if (!writeOffSummary[key]) {
        writeOffSummary[key] = { name: w.warehouseItem?.name || '', total: 0, unit: w.warehouseItem?.unit || '' };
      }
      writeOffSummary[key].total += w.quantity || 0;
    }

    return NextResponse.json({
      summary: {
        totalProcesses: processes.length,
        totalIrrigations: irrigations.length,
        totalMm: Math.round(totalMm * 10) / 10,
        totalM3: Math.round(totalM3 * 10) / 10,
        totalMaterials: allMaterials.length,
        uniqueMaterials: Object.keys(materialUsage).length,
      },
      byCategory: Object.values(byCategory).sort((a, b) => b.count - a.count),
      byMonth: Object.entries(byMonth).map(([month, count]) => ({ month, count })),
      materialUsage: Object.values(materialUsage).sort((a, b) => b.totalQty - a.totalQty).slice(0, 20),
      irrByMonth: Object.entries(irrByMonth).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)),
      irrByType: Object.entries(irrByType).map(([type, count]) => ({ type, count })),
      byField: Object.values(byField).sort((a, b) => b.processCount - a.processCount).slice(0, 15),
      writeOffSummary: Object.values(writeOffSummary).sort((a, b) => b.total - a.total),
    });
  } catch (err: any) {
    console.error('GET /api/reports error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
