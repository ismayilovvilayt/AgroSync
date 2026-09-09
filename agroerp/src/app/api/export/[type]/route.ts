import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle,
} from 'docx';
import {
  getSessionUser, unauthorized, canSeeAllFarms,
} from '@/lib/rbac';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { type } = await params;
    const { searchParams } = new URL(req.url);
    const farmId = searchParams.get('farmId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const format = searchParams.get('format') || 'xlsx'; // xlsx | docx
    const template = searchParams.get('template'); // weekly | monthly | seasonal

    const farmFilter = !canSeeAllFarms(user.role) && user.farmId ? user.farmId : farmId || undefined;

    // Şablon tarix aralığı
    let dateFrom = from ? new Date(from) : undefined;
    let dateTo = to ? new Date(to) : undefined;

    if (template === 'weekly' && !from && !to) {
      dateFrom = startOfWeek(new Date(), { weekStartsOn: 1 });
      dateTo = endOfWeek(new Date(), { weekStartsOn: 1 });
    } else if (template === 'monthly' && !from && !to) {
      dateFrom = startOfMonth(new Date());
      dateTo = endOfMonth(new Date());
    }
    // seasonal: from/to manual daxil edilir

    let rows: any[] = [];
    let sheetName = 'Data';
    let fileName = 'export';

    // ── AQROTEXNIKI İŞLƏR ──────────────────────────────────────────
    if (type === 'processes') {
      const where: any = { field: { farm: { companyId: user.companyId } } };
      if (farmFilter) where.field = { ...where.field, farmId: farmFilter };
      if (dateFrom || dateTo) {
        where.processDate = {};
        if (dateFrom) where.processDate.gte = dateFrom;
        if (dateTo) where.processDate.lte = dateTo;
      }

      const data = await prisma.agroProcess.findMany({
        where,
        include: {
          field: { include: { farm: true } },
          category: true,
          process: true,
          aggregate: true,
          seasonField: true,
          user: { select: { fullName: true } },
          materials: { include: { warehouseItem: true } },
        },
        orderBy: { processDate: 'desc' },
      });

      rows = data.map(p => ({
        'Tarix': p.processDate ? new Date(p.processDate).toLocaleDateString('az-AZ') : '',
        'Sahə №': p.field?.fieldNumber || '',
        'Təsərrüfat': p.field?.farm?.name || '',
        'Sahə (ha)': p.field?.hectares || '',
        'Bitki': p.seasonField?.cropType || '',
        'Əməliyyat': p.category?.name || '',
        'Əməliyyat №': p.operationSeqNumber || '',
        'Proses': p.process?.name || '',
        'Aqreqat': p.aggregate?.name || '',
        'İşlənən sahə (ha)': p.areaProcessed || '',
        'Notlar': p.notes || '',
        'İcraçı': p.user?.fullName || '',
        'Preparatlar': p.materials?.map((m: any) =>
          `${m.warehouseItem?.name || ''} ${m.quantity}${m.warehouseItem?.unit || ''}`
        ).join('; ') || '',
      }));

      sheetName = 'Aqrotexniki İşlər';
      fileName = 'aqrotexniki-isler';
    }

    // ── SUVARMA ────────────────────────────────────────────────────
    else if (type === 'irrigation') {
      const where: any = { field: { farm: { companyId: user.companyId } } };
      if (farmFilter) where.field = { ...where.field, farmId: farmFilter };
      if (dateFrom || dateTo) {
        where.irrigationDate = {};
        if (dateFrom) where.irrigationDate.gte = dateFrom;
        if (dateTo) where.irrigationDate.lte = dateTo;
      }

      const data = await prisma.irrigation.findMany({
        where,
        include: {
          field: { include: { farm: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { irrigationDate: 'desc' },
      });

      rows = data.map(r => ({
        'Tarix': r.irrigationDate ? new Date(r.irrigationDate).toLocaleDateString('az-AZ') : '',
        'Sahə №': r.field?.fieldNumber || '',
        'Təsərrüfat': r.field?.farm?.name || '',
        'Suvarma növü': r.irrigationType || '',
        'Pivot sürəti (%)': r.pivotSpeed || '',
        'Su (mm)': r.waterMm || '',
        'Müddət (saat)': r.duration || '',
        'Həcm (m³)': r.waterVolume || '',
        'Qeyd': r.notes || '',
        'Qeydiyyatçı': r.user?.fullName || '',
      }));

      sheetName = 'Suvarma';
      fileName = 'suvarma';
    }

    // ── SAHƏ MONİTORİNQİ ───────────────────────────────────────────
    else if (type === 'monitoring-field') {
      const where: any = { field: { farm: { companyId: user.companyId } } };
      if (farmFilter) where.field = { ...where.field, farmId: farmFilter };
      if (dateFrom || dateTo) {
        where.monitoringDate = {};
        if (dateFrom) where.monitoringDate.gte = dateFrom;
        if (dateTo) where.monitoringDate.lte = dateTo;
      }

      const data = await prisma.fieldMonitoring.findMany({
        where,
        include: {
          field: { include: { farm: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { monitoringDate: 'desc' },
      });

      rows = data.map(r => ({
        'Tarix': r.monitoringDate ? new Date(r.monitoringDate).toLocaleDateString('az-AZ') : '',
        'Sahə №': r.field?.fieldNumber || '',
        'Təsərrüfat': r.field?.farm?.name || '',
        'Bitki': r.cropType || '',
        'Son suvarma tarixi': r.lastIrrigationDate ? new Date(r.lastIrrigationDate).toLocaleDateString('az-AZ') : '',
        'Son suvarma (mm)': r.lastIrrigationMm || '',
        'Bitkinin fazası': r.plantPhase || '',
        'Zərərverici': r.pest || '',
        'Xəstəlik': r.disease || '',
        'Alaq otları': r.weedStatus || '',
        'Qida çatışmazlığı': r.nutrientDeficiency || '',
        'Gəmirici aktivliyi': r.rodentActivity || '',
        'Gəmirici konumu': r.rodentLocation || '',
        'Suvarma dərinliyi (sm)': r.irrigationDepthCm || '',
        'Qeyd': r.notes || '',
        'Monitorçu': r.user?.fullName || '',
      }));

      sheetName = 'Sahə Monitorinqi';
      fileName = template ? `sahe-monitorinqi-${template}` : 'sahe-monitorinqi';
    }

    // ── ÇIXIŞ MONİTORİNQİ ─────────────────────────────────────────
    else if (type === 'monitoring-emergence') {
      const where: any = { field: { farm: { companyId: user.companyId } } };
      if (farmFilter) where.field = { ...where.field, farmId: farmFilter };
      if (dateFrom || dateTo) {
        where.monitoringDate = {};
        if (dateFrom) where.monitoringDate.gte = dateFrom;
        if (dateTo) where.monitoringDate.lte = dateTo;
      }

      const data = await prisma.emergenceMonitoring.findMany({
        where,
        include: {
          field: { include: { farm: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { monitoringDate: 'desc' },
      });

      rows = data.map(r => ({
        'Tarix': r.monitoringDate ? new Date(r.monitoringDate).toLocaleDateString('az-AZ') : '',
        'Sahə №': r.field?.fieldNumber || '',
        'Sahə (ha)': r.field?.hectares || '',
        'Təsərrüfat': r.field?.farm?.name || '',
        'Səpin tarixi': r.sowingDate ? new Date(r.sowingDate).toLocaleDateString('az-AZ') : '',
        'Bitki': r.cropType || '',
        'Toxum növü': r.variety || '',
        'Vahid': r.countUnit === 'million' ? 'Milyon' : 'Min',
        'Əkilən say': r.plantedCount || '',
        'Çıxan say': r.emergedCount || '',
        'Çıxış faizi (%)': r.emergencePercent || '',
        'Qeyd': r.notes || '',
        'Monitorçu': r.user?.fullName || '',
      }));

      sheetName = 'Çıxış Monitorinqi';
      fileName = 'cixis-monitorinqi';
    }

    else {
      return NextResponse.json({ error: 'Bilinməyən export növü' }, { status: 400 });
    }

    const dateStr = new Date().toISOString().split('T')[0];

    // ── WORD (.docx) FORMAT ──────────────────────────────────────────
    if (format === 'docx') {
      const templateLabel = template === 'weekly' ? 'Həftəlik Hesabat'
        : template === 'monthly' ? 'Aylıq Hesabat'
        : template === 'seasonal' ? 'Mövsümlük Hesabat'
        : 'Hesabat';

      // Header sətirləri
      const headerCells = rows.length > 0 ? Object.keys(rows[0]) : [];

      const tableRows = [
        // Header row
        new TableRow({
          children: headerCells.map(h => new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 18, font: 'Arial' })],
              alignment: AlignmentType.CENTER,
            })],
            width: { size: Math.floor(10000 / Math.max(headerCells.length, 1)), type: WidthType.DXA },
          })),
          tableHeader: true,
        }),
        // Data rows
        ...rows.map(row => new TableRow({
          children: headerCells.map(h => new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: String(row[h] ?? ''), size: 16, font: 'Arial' })],
            })],
          })),
        })),
      ];

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'AgroSync', bold: true, size: 32, font: 'Arial' })],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: `${sheetName} — ${templateLabel}`, size: 24, font: 'Arial' })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Tarix: ${dateStr}`, size: 18, font: 'Arial', italics: true })],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 400 },
            }),
            ...(rows.length > 0 ? [new Table({ rows: tableRows })] : [
              new Paragraph({
                children: [new TextRun({ text: 'Məlumat tapılmadı', size: 20, font: 'Arial' })],
                alignment: AlignmentType.CENTER,
              }),
            ]),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${fileName}-${dateStr}.docx"`,
        },
      });
    }

    // ── EXCEL (.xlsx) FORMAT (default) ──────────────────────────────
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Sütun genişliyi avtomatik
    const colWidths = rows.length > 0
      ? Object.keys(rows[0]).map(key => ({
          wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2,
        }))
      : [];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}-${dateStr}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Export error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
