import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — çıxış monitorinqini redaktə et
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // Çıxış faizi avtomatik
    let emergencePercent = body.emergencePercent ?? undefined;
    if (body.plantedCount && body.emergedCount && !body.emergencePercent) {
      emergencePercent = Math.round((parseFloat(body.emergedCount) / parseFloat(body.plantedCount)) * 1000) / 10;
    }

    const monitoring = await prisma.emergenceMonitoring.update({
      where: { id },
      data: {
        monitoringDate: body.monitoringDate ? new Date(body.monitoringDate) : undefined,
        sowingDate: body.sowingDate ? new Date(body.sowingDate) : undefined,
        variety: body.variety ?? undefined,
        plantedCount: body.plantedCount !== undefined ? parseFloat(body.plantedCount) : undefined,
        countUnit: body.countUnit ?? undefined,
        emergedCount: body.emergedCount !== undefined ? parseFloat(body.emergedCount) : undefined,
        emergencePercent,
        notes: body.notes ?? undefined,
      },
    });

    return NextResponse.json(monitoring);
  } catch (err: any) {
    console.error('PUT /api/monitoring/emergence/[id] error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await prisma.emergenceMonitoring.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/monitoring/emergence/[id] error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
