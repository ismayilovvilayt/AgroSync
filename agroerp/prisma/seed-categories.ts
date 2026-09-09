/**
 * Yalnız kateqoriya + prosesləri yenidən əlavə edir.
 * Mövcud farm/field/season/user məlumatlarına toxunmur.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Şirkəti tap
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Şirkət tapılmadı! Əvvəlcə seed.ts işlət.');

  console.log('🏢 Şirkət tapıldı:', company.name);

  // Köhnə kateqoriya/prosesləri sil (cascade olduğu üçün process records qalır)
  await prisma.operationProcess.deleteMany({ where: { category: { companyId: company.id } } });
  await prisma.operationCategory.deleteMany({ where: { companyId: company.id } });

  // Kateqoriyaları yarat
  const catTorpaq = await prisma.operationCategory.create({
    data: { companyId: company.id, name: 'Torpaq hazırlığı', sortOrder: 1 },
  });
  const catToxum = await prisma.operationCategory.create({
    data: { companyId: company.id, name: 'Toxum səpini', sortOrder: 2 },
  });
  const catKimya = await prisma.operationCategory.create({
    data: { companyId: company.id, name: 'Kimyəvi mübarizə', sortOrder: 3 },
  });
  const catGubre = await prisma.operationCategory.create({
    data: { companyId: company.id, name: 'Gübrələmə', sortOrder: 4 },
  });
  const catBicin = await prisma.operationCategory.create({
    data: { companyId: company.id, name: 'Biçin', sortOrder: 5 },
  });
  const catDiger = await prisma.operationCategory.create({
    data: { companyId: company.id, name: 'Digər', sortOrder: 6 },
  });

  // Torpaq hazırlığı
  await prisma.operationProcess.createMany({ data: [
    { categoryId: catTorpaq.id, name: 'Şumlama',   sortOrder: 1 },
    { categoryId: catTorpaq.id, name: 'Diskləmə',  sortOrder: 2 },
    { categoryId: catTorpaq.id, name: 'Malalanma', sortOrder: 3 },
    { categoryId: catTorpaq.id, name: 'Çizel',     sortOrder: 4 },
    { categoryId: catTorpaq.id, name: 'Kultivasiya', sortOrder: 5 },
  ]});

  // Toxum səpini
  await prisma.operationProcess.createMany({ data: [
    { categoryId: catToxum.id, name: 'Dənli bitki səpini',   sortOrder: 1 },
    { categoryId: catToxum.id, name: 'Texniki bitki səpini', sortOrder: 2 },
    { categoryId: catToxum.id, name: 'Yem bitkisi səpini',   sortOrder: 3 },
  ]});

  // Kimyəvi mübarizə
  await prisma.operationProcess.createMany({ data: [
    { categoryId: catKimya.id, name: 'Herbisid',   sortOrder: 1 },
    { categoryId: catKimya.id, name: 'Fungisid',   sortOrder: 2 },
    { categoryId: catKimya.id, name: 'İnsektisid', sortOrder: 3 },
    { categoryId: catKimya.id, name: 'Akarisid',   sortOrder: 4 },
    { categoryId: catKimya.id, name: 'Desikasiya', sortOrder: 5 },
  ]});

  // Gübrələmə
  await prisma.operationProcess.createMany({ data: [
    { categoryId: catGubre.id, name: 'Azot gübrəsi',    sortOrder: 1 },
    { categoryId: catGubre.id, name: 'Fosfor gübrəsi',  sortOrder: 2 },
    { categoryId: catGubre.id, name: 'Kalium gübrəsi',  sortOrder: 3 },
    { categoryId: catGubre.id, name: 'Kompleks gübrə',  sortOrder: 4 },
    { categoryId: catGubre.id, name: 'Yarpaq gübrəsi',  sortOrder: 5 },
    { categoryId: catGubre.id, name: 'Üzvi gübrə',      sortOrder: 6 },
  ]});

  // Biçin
  await prisma.operationProcess.createMany({ data: [
    { categoryId: catBicin.id, name: 'Kombayn biçini',  sortOrder: 1 },
    { categoryId: catBicin.id, name: 'Əl biçini',       sortOrder: 2 },
    { categoryId: catBicin.id, name: 'Məhsul daşınma',  sortOrder: 3 },
  ]});

  // Digər
  await prisma.operationProcess.createMany({ data: [
    { categoryId: catDiger.id, name: 'Suvarma',       sortOrder: 1 },
    { categoryId: catDiger.id, name: 'Yığım',         sortOrder: 2 },
    { categoryId: catDiger.id, name: 'Sahə yoxlanışı', sortOrder: 3 },
  ]});

  const total = await prisma.operationProcess.count();
  console.log(`✅ 6 kateqoriya + ${total} proses yaradıldı`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
