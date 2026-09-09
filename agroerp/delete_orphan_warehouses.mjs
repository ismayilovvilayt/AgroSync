import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const orphans = await prisma.warehouse.findMany({
  where: { farmId: null },
  select: { id: true, name: true },
});
console.log('Orphan warehouses:', JSON.stringify(orphans));

if (orphans.length > 0) {
  const ids = orphans.map(o => o.id);
  // Delete related items first
  await prisma.warehouseItem.deleteMany({ where: { warehouseId: { in: ids } } });
  // Delete warehouses
  const del = await prisma.warehouse.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${del.count} orphan warehouse(s).`);
} else {
  console.log('No orphan warehouses found.');
}

await prisma.$disconnect();
