import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — proses redaktə
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'AGRONOMIST'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const process = await prisma.agroProcess.update({
    where: { id },
    data: {
      categoryId: body.categoryId,
      processId: body.processId,
      aggregateId: body.aggregateId,
      seasonFieldId: body.seasonFieldId,
      processType: body.processType || 'OTHER',
      description: body.description || null,
      processDate: new Date(body.processDate),
      areaProcessed: body.areaProcessed ? parseFloat(body.areaProcessed) : null,
      notes: body.notes || null,
      status: body.status || 'COMPLETED',
    },
  });

  return NextResponse.json(process);
}

// DELETE — proses sil (anbar stoku geri qaytarılır)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'AGRONOMIST'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Transaction: materialları tap → stoku geri qaytar → movement sil → proses sil
  await prisma.$transaction(async (tx) => {
    // Prosesin materiallarını tap
    const materials = await tx.agroProcessMaterial.findMany({
      where: { agroProcessId: id },
    });

    // Hər material üçün stoku geri qaytar
    for (const mat of materials) {
      await tx.warehouseItem.update({
        where: { id: mat.warehouseItemId },
        data: { currentStock: { increment: mat.quantity } },
      });

      // Əlaqəli warehouse movement-i sil
      if (mat.warehouseMovementId) {
        await tx.warehouseMovement.delete({
          where: { id: mat.warehouseMovementId },
        }).catch(() => {}); // movement artıq silinibsə ignore et
      }
    }

    // Prosesi sil (cascade ilə materials da silinər)
    await tx.agroProcess.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
