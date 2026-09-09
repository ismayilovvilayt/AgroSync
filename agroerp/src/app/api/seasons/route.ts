import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requireRoles,
} from '@/lib/rbac';

// GET — mövsümləri gətir (RLS + hektar cəm computed)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const seasons = await prisma.season.findMany({
    where: { companyId: user.companyId },
    include: {
      seasonFields: {
        include: {
          field: {
            select: { id: true, fieldNumber: true, hectares: true, farm: { select: { name: true } } },
          },
        },
      },
      _count: { select: { seasonFields: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Computed: hər mövsüm üçün bitki üzrə hektar cəmi
  const enriched = seasons.map(season => {
    const cropHectares: Record<string, number> = {};
    let totalPlantedHectares = 0;

    for (const sf of season.seasonFields) {
      const ha = sf.plantedArea ?? sf.field.hectares;
      cropHectares[sf.cropType] = (cropHectares[sf.cropType] || 0) + ha;
      totalPlantedHectares += ha;
    }

    return {
      ...season,
      totalPlantedHectares,
      cropHectares, // { "Buğda": 450, "Qarğıdalı": 320 }
    };
  });

  return NextResponse.json(enriched);
}

// POST — yeni mövsüm yarat (ADMIN)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const denied = requireRoles(user.role, ['ADMIN']);
  if (denied) return denied;

  const body = await req.json();

  const season = await prisma.season.create({
    data: {
      companyId: user.companyId,
      name: body.name,
      status: 'PLANNED',
    },
  });

  return NextResponse.json(season, { status: 201 });
}
