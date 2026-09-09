import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — sahə monitorinqini redaktə et
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const monitoring = await prisma.fieldMonitoring.update({
      where: { id },
      data: {
        monitoringDate: body.monitoringDate ? new Date(body.monitoringDate) : undefined,
        plantPhase: body.plantPhase ?? undefined,
        pest: body.pest ?? undefined,
        pestPhotos: body.pestPhotos ?? undefined,
        disease: body.disease ?? undefined,
        diseasePhotos: body.diseasePhotos ?? undefined,
        weedStatus: body.weedStatus ?? undefined,
        weedPhotos: body.weedPhotos ?? undefined,
        nutrientDeficiency: body.nutrientDeficiency ?? undefined,
        nutrientPhotos: body.nutrientPhotos ?? undefined,
        rodentActivity: body.rodentActivity ?? undefined,
        rodentLocation: body.rodentLocation ?? undefined,
        irrigationDepthCm: body.irrigationDepthCm !== undefined ? parseFloat(body.irrigationDepthCm) : undefined,
        fieldPhoto: body.fieldPhoto ?? undefined,
        notes: body.notes ?? undefined,
      },
    });

    return NextResponse.json(monitoring);
  } catch (err: any) {
    console.error('PUT /api/monitoring/field/[id] error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// DELETE — sahə monitorinqini sil
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await prisma.fieldMonitoring.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/monitoring/field/[id] error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
