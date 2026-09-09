import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requirePermission,
} from '@/lib/rbac';

// POST — anbar məhsulu əlavə et (ADMIN, HEAD_AGRONOMIST)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const denied = requirePermission(user.role, 'create');
    if (denied) return denied;

    const body = await req.json();

    const item = await prisma.warehouseItem.create({
      data: {
        warehouseId: body.warehouseId,
        name: body.name,
        code1C: body.code1C || null,
        orderNumber: body.orderNumber || null,
        category: body.category,
        currentStock: body.currentStock || 0,
        unit: body.unit,
        minStock: body.minStock || 0,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/warehouse/items error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
