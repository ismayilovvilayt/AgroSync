import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import DashboardClient from './DashboardClient';

async function getDashboardData(companyId: string) {
  const [
    farmsCount,
    fieldsCount,
    totalHectares,
    processesCount,
    irrigationsCount,
    warehouseItemsCount,
    recentProcesses,
    recentIrrigations,
    recentNotes,
    allProcesses,
    allIrrigations,
    warehouseItems,
    activeCrops,
    pendingWriteoffs,
    lowStockCount,
    fieldsWithInterval,
  ] = await Promise.all([
    prisma.farm.count({ where: { companyId } }),
    prisma.field.count({ where: { farm: { companyId } } }),
    prisma.field.aggregate({
      where: { farm: { companyId } },
      _sum: { hectares: true },
    }),
    prisma.agroProcess.count({
      where: { field: { farm: { companyId } } },
    }),
    prisma.irrigation.count({
      where: { field: { farm: { companyId } } },
    }),
    prisma.warehouseItem.count({
      where: { warehouse: { companyId } },
    }),
    prisma.agroProcess.findMany({
      where: { field: { farm: { companyId } } },
      include: { field: { include: { farm: true } }, user: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.irrigation.findMany({
      where: { field: { farm: { companyId } } },
      include: { field: { include: { farm: true } }, user: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.fieldNote.findMany({
      where: { field: { farm: { companyId } } },
      include: { field: { include: { farm: true } }, user: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    // Qrafik üçün — bütün proseslər
    prisma.agroProcess.findMany({
      where: { field: { farm: { companyId } } },
      select: { processType: true, processDate: true },
    }),
    // Qrafik üçün — bütün suvarmalar
    prisma.irrigation.findMany({
      where: { field: { farm: { companyId } } },
      select: { irrigationType: true, irrigationDate: true },
    }),
    // Qrafik üçün — anbar stokları
    prisma.warehouseItem.findMany({
      where: { warehouse: { companyId } },
      select: { name: true, currentStock: true, minStock: true, category: true },
    }),
    // Aktiv bitkilər — sahə üzrə
    prisma.seasonField.findMany({
      where: {
        status: { not: 'HARVESTED' },
        field: { farm: { companyId } },
      },
      include: {
        field: { include: { farm: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Gözləmədə silinmə sayı
    prisma.writeOff.count({
      where: { status: 'PENDING', field: { farm: { companyId } } },
    }),
    // Az stok
    prisma.warehouseItem.count({
      where: { warehouse: { companyId }, currentStock: { lte: 50 } },
    }),
    // Suvarma intervalı olan sahələr (overdue hesabı üçün)
    prisma.field.findMany({
      where: {
        farm: { companyId },
        irrigationIntervalDays: { not: null },
      },
      select: {
        id: true,
        irrigationIntervalDays: true,
        irrigations: {
          orderBy: { irrigationDate: 'desc' },
          take: 1,
          select: { irrigationDate: true },
        },
      },
    }),
  ]);

  // Aylıq proses statistikası
  const processMonthlyMap: Record<string, number> = {};
  const irrigationMonthlyMap: Record<string, number> = {};
  const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];

  allProcesses.forEach((p) => {
    const d = new Date(p.processDate);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    processMonthlyMap[key] = (processMonthlyMap[key] || 0) + 1;
  });

  allIrrigations.forEach((i) => {
    const d = new Date(i.irrigationDate);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    irrigationMonthlyMap[key] = (irrigationMonthlyMap[key] || 0) + 1;
  });

  // Son 6 ay üçün data
  const now = new Date();
  const monthlyActivity = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    monthlyActivity.push({
      month: monthNames[d.getMonth()],
      proseslər: processMonthlyMap[key] || 0,
      suvarmalar: irrigationMonthlyMap[key] || 0,
    });
  }

  // Proses tipləri üzrə
  const processTypeCounts: Record<string, number> = {};
  allProcesses.forEach((p) => {
    processTypeCounts[p.processType] = (processTypeCounts[p.processType] || 0) + 1;
  });
  const processTypeChart = Object.entries(processTypeCounts).map(([type, count]) => ({
    name: type,
    value: count,
  }));

  // Anbar stok
  const warehouseChart = warehouseItems.map((item) => ({
    name: item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name,
    stok: item.currentStock,
    minimum: item.minStock,
  }));

  // Suvarma vaxtı keçmiş sahə sayı
  const overdueIrrigations = fieldsWithInterval.filter((f: any) => {
    if (!f.irrigationIntervalDays || !f.irrigations.length) return false;
    const lastDate = new Date(f.irrigations[0].irrigationDate);
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > f.irrigationIntervalDays;
  }).length;

  return {
    stats: {
      farms: farmsCount,
      fields: fieldsCount,
      totalHectares: totalHectares._sum.hectares || 0,
      processes: processesCount,
      irrigations: irrigationsCount,
      warehouseItems: warehouseItemsCount,
      pendingWriteoffs,
      lowStockCount,
      overdueIrrigations,
    },
    charts: {
      monthlyActivity,
      processTypeChart,
      warehouseChart,
    },
    activeCrops: activeCrops.map(sf => ({
      id: sf.id,
      cropType: sf.cropType,
      status: sf.status,
      sowingDate: sf.sowingDate?.toISOString() || null,
      fieldNumber: sf.field.fieldNumber,
      farmName: sf.field.farm.name,
      hectares: sf.field.hectares,
      plantedArea: sf.plantedArea,
    })),
    recentProcesses: recentProcesses.map((p) => ({
      id: p.id,
      type: p.processType,
      fieldNumber: p.field.fieldNumber,
      farmName: p.field.farm.name,
      date: p.processDate.toISOString(),
      status: p.status,
      user: p.user.fullName,
    })),
    recentIrrigations: recentIrrigations.map((i) => ({
      id: i.id,
      type: i.irrigationType,
      fieldNumber: i.field.fieldNumber,
      farmName: i.field.farm.name,
      date: i.irrigationDate.toISOString(),
      user: i.user.fullName,
    })),
    recentNotes: recentNotes.map((n) => ({
      id: n.id,
      title: n.title,
      fieldNumber: n.field.fieldNumber,
      farmName: n.field.farm.name,
      date: n.noteDate.toISOString(),
      user: n.user.fullName,
    })),
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const companyId = (session?.user as any)?.companyId;

  if (!companyId) {
    return <div className="page-content">Şirkət tapılmadı</div>;
  }

  const data = await getDashboardData(companyId);

  return <DashboardClient data={data} />;
}
