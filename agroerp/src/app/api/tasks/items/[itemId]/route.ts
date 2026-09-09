import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PATCH — pivot item-ini tamamlandı/geri aç
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const { itemId } = await params;
    const { completed } = await req.json();

    // Yoxla — bu item şirkətin tapşırığına aiddir?
    const item = await prisma.fieldTaskItem.findFirst({
      where: { id: itemId, task: { companyId } },
    });
    if (!item) return NextResponse.json({ error: 'Tapılmadı' }, { status: 404 });

    const updated = await prisma.fieldTaskItem.update({
      where: { id: itemId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
