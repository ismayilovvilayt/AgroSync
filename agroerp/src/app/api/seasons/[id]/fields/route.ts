import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST — mövsümə sahə təyin et (bitki növü ilə)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['ADMIN', 'MANAGER', 'AGRONOMIST'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: seasonId } = await params;
  const body = await req.json();

  // Sahəni mövsümə əlavə et
  const seasonField = await prisma.seasonField.create({
    data: {
      seasonId,
      fieldId: body.fieldId,
      cropType: body.cropType,
      plantedArea: body.plantedArea || null,
      status: 'PLANNED',
      notes: body.notes || null,
    },
  });

  // İlk sahə əlavə edildikdə mövsüm statusunu ACTIVE yap
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { status: true, startDate: true },
  });

  if (season && season.status === 'PLANNED') {
    await prisma.season.update({
      where: { id: seasonId },
      data: {
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });
  }

  return NextResponse.json(seasonField, { status: 201 });
}
