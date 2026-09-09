import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT — SeasonField redaktə (status, əkin/biçin tarixi)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sfId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sfId } = await params;
  const body = await req.json();

  const data: any = {};
  if (body.cropType !== undefined) data.cropType = body.cropType;
  if (body.plantedArea !== undefined) data.plantedArea = body.plantedArea;
  if (body.status !== undefined) data.status = body.status;
  if (body.sowingDate !== undefined) data.sowingDate = body.sowingDate ? new Date(body.sowingDate) : null;
  if (body.harvestDate !== undefined) data.harvestDate = body.harvestDate ? new Date(body.harvestDate) : null;
  if (body.notes !== undefined) data.notes = body.notes;

  const sf = await prisma.seasonField.update({
    where: { id: sfId },
    data,
    include: { season: true },
  });

  // Əgər bu sahə HARVESTED oldu və bütün sahələr biçilibsə mövsüm tamamlansın
  if (body.status === 'HARVESTED') {
    const allFields = await prisma.seasonField.findMany({
      where: { seasonId: sf.seasonId },
    });
    const allHarvested = allFields.every((f) => f.status === 'HARVESTED');
    if (allHarvested) {
      await prisma.season.update({
        where: { id: sf.seasonId },
        data: { status: 'COMPLETED', endDate: new Date() },
      });
    }
  }

  return NextResponse.json(sf);
}

// DELETE — SeasonField sil
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sfId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sfId } = await params;

  await prisma.seasonField.delete({ where: { id: sfId } });

  return NextResponse.json({ success: true });
}
