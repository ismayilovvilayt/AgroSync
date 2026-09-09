import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — Anbar analitikası (bitkiyə, pivota, preparata görə)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const userRole = (session.user as any).role;
    const userFarmId = (session.user as any).farmId;
    const { searchParams } = new URL(req.url);
    const cropType = searchParams.get('cropType');
    const fieldId = searchParams.get('fieldId');
    const warehouseItemId = searchParams.get('warehouseItemId');
    const farmId = searchParams.get('farmId');

    // Base where: company-level filter
    const processWhere: any = {
      field: { farm: { companyId } },
      materials: { some: {} },
    };

    if (farmId) processWhere.field.farmId = farmId;
    if (userRole === 'AGRONOMIST' && userFarmId) processWhere.field.farmId = userFarmId;
    if (fieldId) processWhere.fieldId = fieldId;
    if (cropType) processWhere.seasonField = { cropType };
    if (warehouseItemId) processWhere.materials = { some: { warehouseItemId } };

    // Get all matching process materials with full context
    const materials = await prisma.agroProcessMaterial.findMany({
      where: {
        agroProcess: processWhere,
        ...(warehouseItemId ? { warehouseItemId } : {}),
      },
      include: {
        warehouseItem: { select: { id: true, name: true, code1C: true, unit: true, category: true } },
        agroProcess: {
          select: {
            fieldId: true,
            processDate: true,
            field: { select: { fieldNumber: true, farm: { select: { id: true, name: true } } } },
            seasonField: { select: { cropType: true, season: { select: { name: true } } } },
            category: { select: { name: true } },
            process: { select: { name: true } },
          },
        },
      },
    });

    // Aggregate by crop type
    const byCrop: Record<string, { cropType: string; totalQty: number; items: Record<string, { name: string; unit: string; qty: number }> }> = {};
    // Aggregate by field
    const byField: Record<string, { fieldNumber: string; farmName: string; totalQty: number; items: Record<string, { name: string; unit: string; qty: number }> }> = {};
    // Aggregate by item
    const byItem: Record<string, { name: string; code1C: string | null; unit: string; totalQty: number; fields: Record<string, { fieldNumber: string; qty: number }> }> = {};

    for (const m of materials) {
      const crop = m.agroProcess.seasonField?.cropType || 'Naməlum';
      const fld = m.agroProcess.field;
      const item = m.warehouseItem;

      // By crop
      if (!byCrop[crop]) byCrop[crop] = { cropType: crop, totalQty: 0, items: {} };
      byCrop[crop].totalQty += m.quantity;
      if (!byCrop[crop].items[item.id]) byCrop[crop].items[item.id] = { name: item.name, unit: item.unit, qty: 0 };
      byCrop[crop].items[item.id].qty += m.quantity;

      // By field
      if (!byField[m.agroProcess.fieldId]) byField[m.agroProcess.fieldId] = { fieldNumber: fld.fieldNumber, farmName: fld.farm.name, totalQty: 0, items: {} };
      byField[m.agroProcess.fieldId].totalQty += m.quantity;
      if (!byField[m.agroProcess.fieldId].items[item.id]) byField[m.agroProcess.fieldId].items[item.id] = { name: item.name, unit: item.unit, qty: 0 };
      byField[m.agroProcess.fieldId].items[item.id].qty += m.quantity;

      // By item
      if (!byItem[item.id]) byItem[item.id] = { name: item.name, code1C: item.code1C, unit: item.unit, totalQty: 0, fields: {} };
      byItem[item.id].totalQty += m.quantity;
      if (!byItem[item.id].fields[m.agroProcess.fieldId]) byItem[item.id].fields[m.agroProcess.fieldId] = { fieldNumber: fld.fieldNumber, qty: 0 };
      byItem[item.id].fields[m.agroProcess.fieldId].qty += m.quantity;
    }

    // Summary stats
    const pendingWriteOffs = await prisma.writeOff.count({
      where: { status: 'PENDING', warehouseItem: { warehouse: { companyId } } },
    });

    const uniqueItems = new Set(materials.map(m => m.warehouseItemId)).size;

    return NextResponse.json({
      summary: {
        totalMaterials: materials.length,
        uniqueItems,
        totalQuantity: materials.reduce((s, m) => s + m.quantity, 0),
        pendingWriteOffs,
      },
      byCrop: Object.values(byCrop).map(c => ({
        ...c,
        items: Object.values(c.items),
      })),
      byField: Object.values(byField).map(f => ({
        ...f,
        items: Object.values(f.items),
      })),
      byItem: Object.values(byItem).map(i => ({
        ...i,
        fields: Object.values(i.fields),
      })),
      raw: materials,
    });
  } catch (err: any) {
    console.error('GET /api/warehouse/analytics error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
