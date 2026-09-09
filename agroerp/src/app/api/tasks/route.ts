import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getSessionUser, unauthorized, requirePermission, requireRoles,
  canSeeAllFarms,
} from '@/lib/rbac';
import { addDays } from 'date-fns';

// GET — şirkətin tapşırıqlarını gətirir (RLS + bitki filtri)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const farmId = searchParams.get('farmId');
    const status = searchParams.get('status') || 'ACTIVE';
    const cropType = searchParams.get('cropType');

    const where: any = { companyId: user.companyId };
    if (status !== 'all') where.status = status;

    // RLS: OWN_FARM rollar yalnız öz farmının tapşırıqlarını görür
    if (!canSeeAllFarms(user.role) && user.farmId) {
      where.OR = [
        { farmId: user.farmId },
        { farmId: null }, // Bütün təsərrüfatlara aid tapşırıqlar
      ];
    } else if (farmId) {
      where.farmId = farmId;
    }

    // Bitki filtri
    if (cropType) where.cropType = cropType;

    const tasks = await prisma.fieldTask.findMany({
      where,
      include: {
        farm: { select: { id: true, name: true } },
        createdBy: { select: { fullName: true } },
        items: {
          include: {
            field: { select: { id: true, fieldNumber: true, hectares: true, farmId: true, farm: { select: { name: true } } } },
            seasonField: { select: { id: true, cropType: true, plantedArea: true } },
          },
          orderBy: { field: { fieldNumber: 'asc' } },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json(tasks);
  } catch (err: any) {
    console.error('GET /api/tasks error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — yeni tapşırıq yarat + dinamik deadline + avtomatik item yaratma
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const denied = requirePermission(user.role, 'create');
    if (denied) return denied;

    const body = await req.json();

    if (!body.cropType || !body.title || !body.dueDate) {
      return NextResponse.json({ error: 'cropType, title, dueDate mütləqdir' }, { status: 400 });
    }

    // Dinamik deadline hesablama
    let secondDueDate: Date | null = null;
    if (body.firstApplicationDate && body.waitDays) {
      secondDueDate = addDays(new Date(body.firstApplicationDate), parseInt(body.waitDays));
    }

    // O bitkiyə sahib olan bütün aktiv sahələri tap
    const seasonFieldWhere: any = {
      cropType: body.cropType,
      status: { not: 'HARVESTED' },
      field: { farm: { companyId: user.companyId } },
    };

    // Farm filtr: body-dən və ya RLS-dən
    const effectiveFarmId = !canSeeAllFarms(user.role) && user.farmId
      ? user.farmId
      : body.farmId || null;

    if (effectiveFarmId) {
      seasonFieldWhere.field = { farmId: effectiveFarmId, farm: { companyId: user.companyId } };
    }

    const seasonFields = await prisma.seasonField.findMany({
      where: seasonFieldWhere,
      include: { field: { select: { id: true, fieldNumber: true } } },
    });

    if (seasonFields.length === 0) {
      return NextResponse.json(
        { error: `"${body.cropType}" bitkisi üçün aktiv sahə tapılmadı` },
        { status: 400 }
      );
    }

    // Tapşırığı yarat
    const task = await prisma.fieldTask.create({
      data: {
        companyId: user.companyId,
        createdById: user.id,
        farmId: effectiveFarmId,
        cropType: body.cropType,
        title: body.title,
        category: body.category || null,
        description: body.description || null,
        dueDate: new Date(body.dueDate),
        firstApplicationDate: body.firstApplicationDate ? new Date(body.firstApplicationDate) : null,
        waitDays: body.waitDays ? parseInt(body.waitDays) : null,
        secondDueDate,
        status: 'ACTIVE',
        items: {
          create: seasonFields.map(sf => ({
            fieldId: sf.fieldId,
            seasonFieldId: sf.id,
            completed: false,
          })),
        },
      },
      include: {
        farm: { select: { id: true, name: true } },
        createdBy: { select: { fullName: true } },
        items: {
          include: {
            field: { select: { id: true, fieldNumber: true, hectares: true, farmId: true, farm: { select: { name: true } } } },
            seasonField: { select: { id: true, cropType: true, plantedArea: true } },
          },
          orderBy: { field: { fieldNumber: 'asc' } },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/tasks error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
