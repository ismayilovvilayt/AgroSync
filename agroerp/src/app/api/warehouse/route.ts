import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requireRoles,
  canSeeAllFarms,
} from '@/lib/rbac';

// GET — anbarları gətir (RLS: farmId filtr)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const farmId = searchParams.get('farmId');

    const where: any = { companyId: user.companyId };

    // RLS: OWN_FARM rollar yalnız öz farmının anbarını görür
    if (!canSeeAllFarms(user.role) && user.farmId) {
      where.farmId = user.farmId;
    } else if (farmId) {
      where.farmId = farmId;
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            fields: {
              select: {
                seasonFields: {
                  select: { cropType: true },
                  distinct: ['cropType'],
                },
              },
            },
          },
        },
        items: {
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { movements: true, writeOffs: true } },
            writeOffs: {
              where: { status: 'PENDING' },
              select: { quantity: true },
            },
            movements: {
              select: { movementType: true, quantity: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Enrich: add farmCrops (unique crop names from SeasonField)
    const enriched = warehouses.map((wh: any) => {
      const cropSet = new Set<string>();
      if (wh.farm?.fields) {
        for (const field of wh.farm.fields) {
          for (const sf of field.seasonFields) {
            cropSet.add(sf.cropType);
          }
        }
      }
      // Remove the nested fields from the response to keep it clean
      const { fields, ...farmRest } = wh.farm || {};
      return {
        ...wh,
        farm: wh.farm ? farmRest : null,
        farmCrops: Array.from(cropSet).sort(),
      };
    });

    return NextResponse.json(enriched);
  } catch (err: any) {
    console.error('GET /api/warehouse error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// POST — yeni anbar yarat (yalnız ADMIN)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const denied = requireRoles(user.role, ['ADMIN']);
    if (denied) return denied;

    const body = await req.json();

    // Anbar mutləq bir təsərrüfata bağlı olmalıdır
    if (!body.farmId) {
      return NextResponse.json(
        { error: 'Anbar yaratmaq üçün təsərrüfat seçilməlidir' },
        { status: 400 }
      );
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        companyId: user.companyId,
        farmId: body.farmId,
        name: body.name,
        location: body.location || null,
      },
    });

    return NextResponse.json(warehouse, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/warehouse error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
