// AgroSync — Mərkəzləşdirilmiş RBAC & RLS Modulu
// Bütün API route-larda istifadə olunur

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// ─── Rol tərifi ────────────────────────────────────────────
export type AppRole = 'ADMIN' | 'OFFICE_MANAGER' | 'FARM_MANAGER' | 'HEAD_AGRONOMIST' | 'AGRONOMIST';

export type Action = 'read' | 'create' | 'update' | 'delete';

export type Scope = 'ALL_FARMS' | 'OWN_FARM';

interface RolePermission {
  scope: Scope;
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

// ─── İcazə Matrisi ─────────────────────────────────────────
export const PERMISSIONS: Record<AppRole, RolePermission> = {
  ADMIN: {
    scope: 'ALL_FARMS',
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  OFFICE_MANAGER: {
    scope: 'ALL_FARMS',
    read: true,
    create: false,
    update: false,
    delete: false,
  },
  FARM_MANAGER: {
    scope: 'OWN_FARM',
    read: true,
    create: false,
    update: false,
    delete: false,
  },
  HEAD_AGRONOMIST: {
    scope: 'OWN_FARM',
    read: true,
    create: true,
    update: true,
    delete: false,
  },
  AGRONOMIST: {
    scope: 'OWN_FARM',
    read: true,
    create: true,
    update: false,
    delete: false,
  },
};

// ─── Yoxlama funksiyaları ───────────────────────────────────

/** Rolun müəyyən əməliyyata icazəsi varmı? */
export function hasPermission(role: AppRole, action: Action): boolean {
  const perm = PERMISSIONS[role];
  if (!perm) return false;
  return perm[action] ?? false;
}

/** İcazə yoxla, yoxdursa NextResponse(403) qaytar */
export function requirePermission(role: string, action: Action): NextResponse | null {
  if (!hasPermission(role as AppRole, action)) {
    return NextResponse.json(
      { error: `Bu əməliyyat üçün icazəniz yoxdur (${action})` },
      { status: 403 }
    );
  }
  return null;
}

/** Rolun bütün təsərrüfatları görmə hüququ varmı? */
export function canSeeAllFarms(role: AppRole): boolean {
  return PERMISSIONS[role]?.scope === 'ALL_FARMS';
}

// ─── RLS: Farm Filter Builder ──────────────────────────────
// Prisma `where` clause-a farmId filtr əlavə edir

export interface SessionUser {
  id: string;
  role: AppRole;
  companyId: string;
  farmId: string | null;
  name: string;
}

/**
 * Session-dan istifadəçi məlumatlarını çıxar.
 * Session yoxdursa null qaytarır.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as any;
  return {
    id: u.id,
    role: u.role as AppRole,
    companyId: u.companyId,
    farmId: u.farmId || null,
    name: u.name || '',
  };
}

/**
 * Company + Farm RLS filtri — Prisma where clause üçün.
 * `farmField` = Prisma modelindəki farm ID sahəsinin adı (default: 'farmId')
 * 
 * Nümunə istifadə:
 *   const where = buildFarmFilter(user, 'farmId');
 *   // → { companyId: '...', farmId: '...' }  (OWN_FARM rollar üçün)
 *   // → { companyId: '...' }                  (ALL_FARMS rollar üçün)
 */
export function buildFarmFilter(
  user: SessionUser,
  farmField: string = 'farmId'
): Record<string, any> {
  const where: Record<string, any> = { companyId: user.companyId };

  if (!canSeeAllFarms(user.role) && user.farmId) {
    where[farmField] = user.farmId;
  }

  return where;
}

/**
 * İç-içə əlaqələr üçün farm filtr (məs. field → farm → companyId)
 * `path` = ['field', 'farm'] → { field: { farm: { companyId, id } } }
 */
export function buildNestedFarmFilter(
  user: SessionUser,
  path: string[] = ['farm']
): Record<string, any> {
  // Ən dərin: companyId + optional farmId
  let innerWhere: Record<string, any> = { companyId: user.companyId };
  if (!canSeeAllFarms(user.role) && user.farmId) {
    innerWhere.id = user.farmId;
  }

  // Path-i tərsinə sarıyırıq
  let where: Record<string, any> = innerWhere;
  for (let i = path.length - 1; i >= 0; i--) {
    where = { [path[i]]: where };
  }

  return where;
}

/**
 * Sahə (Field) modeli üçün xüsusi filtr.
 * field → farm → companyId / farmId
 */
export function buildFieldFilter(user: SessionUser): Record<string, any> {
  const where: Record<string, any> = { farm: { companyId: user.companyId } };
  if (!canSeeAllFarms(user.role) && user.farmId) {
    where.farmId = user.farmId;
  }
  return where;
}

/**
 * Unauthorized cavab
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Forbidden cavab
 */
export function forbidden(msg?: string): NextResponse {
  return NextResponse.json({ error: msg || 'Forbidden' }, { status: 403 });
}

/**
 * Xüsusi rollar yoxlaması — verilmiş rollar siyahısında istifadəçi rolu varmı?
 */
export function requireRoles(userRole: string, allowedRoles: AppRole[]): NextResponse | null {
  if (!allowedRoles.includes(userRole as AppRole)) {
    return forbidden(`Bu əməliyyat yalnız ${allowedRoles.join(', ')} rolları üçündür`);
  }
  return null;
}
