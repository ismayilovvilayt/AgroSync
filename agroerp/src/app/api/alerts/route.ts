import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { differenceInDays } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const userRole = (session.user as any).role;
    const userFarmId = (session.user as any).farmId;

    const farmFilter = userRole === 'AGRONOMIST' && userFarmId ? userFarmId : undefined;
    const fieldWhere: any = { farm: { companyId } };
    if (farmFilter) fieldWhere.farmId = farmFilter;

    const alerts: Array<{
      id: string;
      type: 'IRRIGATION_OVERDUE' | 'LOW_STOCK' | 'PENDING_WRITEOFF' | 'NO_MONITORING';
      severity: 'warning' | 'error' | 'info';
      title: string;
      message: string;
      fieldId?: string;
      fieldNumber?: string;
      farmName?: string;
    }> = [];

    const today = new Date();

    // ── 1. SUVARMA GECİKMƏSİ ──────────────────────────────────────────────────
    const fields = await prisma.field.findMany({
      where: { ...fieldWhere, irrigationIntervalDays: { not: null } },
      select: {
        id: true,
        fieldNumber: true,
        irrigationIntervalDays: true,
        farm: { select: { name: true } },
      },
    });

    for (const field of fields) {
      const lastIrr = await prisma.irrigation.findFirst({
        where: { fieldId: field.id },
        orderBy: { irrigationDate: 'desc' },
        select: { irrigationDate: true },
      });

      const interval = field.irrigationIntervalDays!;
      const lastDate = lastIrr?.irrigationDate;
      const daysSince = lastDate ? differenceInDays(today, new Date(lastDate)) : null;

      if (daysSince === null || daysSince > interval) {
        const overdue = daysSince === null ? 'Heç vaxt suvarılmayıb' : `${daysSince} gündür suvarılmayıb (interval: ${interval} gün)`;
        alerts.push({
          id: `irr-${field.id}`,
          type: 'IRRIGATION_OVERDUE',
          severity: daysSince !== null && daysSince > interval * 1.5 ? 'error' : 'warning',
          title: `Suvarma gecikir — Sahə ${field.fieldNumber}`,
          message: `${field.farm.name} | ${overdue}`,
          fieldId: field.id,
          fieldNumber: field.fieldNumber,
          farmName: field.farm.name,
        });
      }
    }

    // ── 2. ANBAR AZ STOK ──────────────────────────────────────────────────────
    const warehouseWhere: any = { warehouse: { companyId } };
    if (farmFilter) warehouseWhere.warehouse = { ...warehouseWhere.warehouse, farmId: farmFilter };

    const lowStockItems = await prisma.warehouseItem.findMany({
      where: {
        ...warehouseWhere,
        currentStock: { lte: 50 }, // 50 ədəd/litr/kq-dan az
      },
      select: {
        id: true,
        name: true,
        currentStock: true,
        unit: true,
        warehouse: { select: { name: true } },
      },
      take: 10,
    });

    for (const item of lowStockItems) {
      alerts.push({
        id: `stock-${item.id}`,
        type: 'LOW_STOCK',
        severity: item.currentStock <= 10 ? 'error' : 'warning',
        title: `Az stok — ${item.name}`,
        message: `${item.warehouse.name} | Qalıq: ${item.currentStock} ${item.unit}`,
      });
    }

    // ── 3. GÖZLƏMƏDƏKİ SİLİNMƏLƏR ───────────────────────────────────────────
    const pendingWriteoffs = await prisma.writeOff.count({
      where: {
        status: 'PENDING',
        field: { farm: { companyId } },
        ...(farmFilter ? { field: { farmId: farmFilter } } : {}),
      },
    });

    if (pendingWriteoffs > 0) {
      alerts.push({
        id: 'writeoff-pending',
        type: 'PENDING_WRITEOFF',
        severity: 'info',
        title: `${pendingWriteoffs} silinmə gözləyir`,
        message: 'Anbarda təsdiqlənməmiş silinmə qeydləri var',
      });
    }

    // ── 4. SON 14 GÜNDƏ MONİTORİNQ OLMAMIŞ SAHƏLƏRİ ─────────────────────────
    const activeFields = await prisma.field.findMany({
      where: {
        ...fieldWhere,
        seasonFields: { some: { status: { not: 'HARVESTED' } } },
      },
      select: {
        id: true, fieldNumber: true,
        farm: { select: { name: true } },
      },
    });

    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    for (const field of activeFields) {
      const recentMonitoring = await prisma.fieldMonitoring.findFirst({
        where: { fieldId: field.id, monitoringDate: { gte: fourteenDaysAgo } },
        select: { id: true },
      });
      if (!recentMonitoring) {
        alerts.push({
          id: `mon-${field.id}`,
          type: 'NO_MONITORING',
          severity: 'info',
          title: `14 gündür monitorinq yoxdur — Sahə ${field.fieldNumber}`,
          message: `${field.farm.name} | Aktiv bitkisi var, lakin son 14 gündə monitorinq qeyd edilməyib`,
          fieldId: field.id,
          fieldNumber: field.fieldNumber,
          farmName: field.farm.name,
        });
      }
    }

    return NextResponse.json({
      total: alerts.length,
      errorCount: alerts.filter(a => a.severity === 'error').length,
      warningCount: alerts.filter(a => a.severity === 'warning').length,
      infoCount: alerts.filter(a => a.severity === 'info').length,
      alerts,
    });
  } catch (err: any) {
    console.error('GET /api/alerts error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
