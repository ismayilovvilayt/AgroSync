import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/monitoring/field/last?fieldId=xxx
// Həmin sahənin son monitorinqini gətirir
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get('fieldId');
    if (!fieldId) return NextResponse.json({ error: 'fieldId tələb olunur' }, { status: 400 });

    const companyId = (session.user as any).companyId;

    // Sahənin bu şirkətə aid olduğunu yoxla
    const field = await prisma.field.findFirst({
      where: { id: fieldId, farm: { companyId } },
      select: { id: true },
    });
    if (!field) return NextResponse.json({ error: 'Sahə tapılmadı' }, { status: 404 });

    // Son sahə monitorinqi
    const lastFieldMonitoring = await prisma.fieldMonitoring.findFirst({
      where: { fieldId },
      orderBy: { monitoringDate: 'desc' },
      include: { user: { select: { fullName: true } } },
    });

    // Son çıxış monitorinqi
    const lastEmergenceMonitoring = await prisma.emergenceMonitoring.findFirst({
      where: { fieldId },
      orderBy: { monitoringDate: 'desc' },
      include: { user: { select: { fullName: true } } },
    });

    // Son suvarma
    const lastIrrigation = await prisma.irrigation.findFirst({
      where: { fieldId },
      orderBy: { irrigationDate: 'desc' },
      select: { irrigationDate: true, waterMm: true, waterVolume: true, irrigationType: true },
    });

    // Aktiv bitki
    const activeCrop = await prisma.seasonField.findFirst({
      where: { fieldId, status: { not: 'HARVESTED' } },
      orderBy: { createdAt: 'desc' },
      select: { cropType: true, status: true },
    });

    return NextResponse.json({
      lastFieldMonitoring,
      lastEmergenceMonitoring,
      lastIrrigation,
      activeCrop,
    });
  } catch (err: any) {
    console.error('GET /api/monitoring/field/last error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
