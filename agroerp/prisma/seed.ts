import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seed məlumatları yaradılır...');

  // Əvvəlcə mövcud məlumatları sil
  await prisma.fieldMonitoring.deleteMany();
  await prisma.emergenceMonitoring.deleteMany();
  await prisma.writeOff.deleteMany();
  await prisma.agroProcessMaterial.deleteMany();
  await prisma.agroProcess.deleteMany();
  await prisma.operationProcess.deleteMany();
  await prisma.operationCategory.deleteMany();
  await prisma.aggregate.deleteMany();
  await prisma.rainfallField.deleteMany();
  await prisma.rainfall.deleteMany();
  await prisma.pivotStoppage.deleteMany();
  await prisma.pivotSpeedChart.deleteMany();
  await prisma.seasonField.deleteMany();
  await prisma.season.deleteMany();
  await prisma.fieldNote.deleteMany();
  await prisma.warehouseMovement.deleteMany();
  await prisma.warehouseItem.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.irrigation.deleteMany();
  await prisma.field.deleteMany();
  await prisma.user.deleteMany();
  await prisma.farm.deleteMany();
  await prisma.company.deleteMany();

  // 1. Şirkət yarat
  const company = await prisma.company.create({
    data: {
      name: 'Azər Agro MMC',
      address: 'Bakı, Azərbaycan',
      phone: '+994 50 123 45 67',
    },
  });
  console.log('✅ Şirkət yaradıldı:', company.name);

  // 2. Təsərrüfatlar yarat
  const farm1 = await prisma.farm.create({
    data: {
      companyId: company.id,
      name: 'Sabirabad Təsərrüfatı',
      location: 'Sabirabad rayonu',
      totalHectares: 450,
    },
  });

  const farm2 = await prisma.farm.create({
    data: {
      companyId: company.id,
      name: 'Kürdəmir Təsərrüfatı',
      location: 'Kürdəmir rayonu',
      totalHectares: 320,
    },
  });
  console.log('✅ Təsərrüfatlar yaradıldı');

  // 3. Sahələr yarat (Pivotlar — bitki növü yoxdur, daimi fiziki sahələr)
  const fields = await Promise.all([
    prisma.field.create({ data: { farmId: farm1.id, fieldNumber: 'Pivot 1', hectares: 120, soilType: 'Gillicəli', status: 'ACTIVE', irrigationIntervalDays: 7 } }),
    prisma.field.create({ data: { farmId: farm1.id, fieldNumber: 'Pivot 2', hectares: 80, soilType: 'Qumsal', status: 'ACTIVE', irrigationIntervalDays: 6 } }),
    prisma.field.create({ data: { farmId: farm1.id, fieldNumber: 'Pivot 3', hectares: 150, soilType: 'Gillicəli', status: 'ACTIVE', irrigationIntervalDays: 7 } }),
    prisma.field.create({ data: { farmId: farm1.id, fieldNumber: 'Pivot 4', hectares: 100, soilType: 'Qaratorpaq', status: 'FALLOW' } }),
    prisma.field.create({ data: { farmId: farm2.id, fieldNumber: 'Pivot 1', hectares: 90, soilType: 'Qaratorpaq', status: 'ACTIVE', irrigationIntervalDays: 8 } }),
    prisma.field.create({ data: { farmId: farm2.id, fieldNumber: 'Pivot 2', hectares: 110, soilType: 'Gillicəli', status: 'ACTIVE', irrigationIntervalDays: 7 } }),
    prisma.field.create({ data: { farmId: farm2.id, fieldNumber: 'Pivot 3', hectares: 120, soilType: 'Qumsal', status: 'ACTIVE', irrigationIntervalDays: 6 } }),
  ]);

  // Alt-sahələr (Pivot 2 → 2.1, 2.2)
  const subField1 = await prisma.field.create({
    data: { farmId: farm1.id, parentId: fields[1].id, fieldNumber: 'Pivot 2.1', hectares: 50, soilType: 'Qumsal', status: 'ACTIVE' },
  });
  const subField2 = await prisma.field.create({
    data: { farmId: farm1.id, parentId: fields[1].id, fieldNumber: 'Pivot 2.2', hectares: 30, soilType: 'Qumsal', status: 'ACTIVE' },
  });
  console.log('✅ Sahələr yaradıldı:', fields.length + 2, 'ədəd (2 alt-sahə daxil)');

  // 3.1 Mövsümlər yarat
  const season1 = await prisma.season.create({
    data: { companyId: company.id, name: '2024-2025 Payız mövsümü', status: 'ACTIVE', startDate: new Date('2024-10-01') },
  });
  const season2 = await prisma.season.create({
    data: { companyId: company.id, name: '2025 Yaz mövsümü', status: 'ACTIVE', startDate: new Date('2025-04-01') },
  });
  const season3 = await prisma.season.create({
    data: { companyId: company.id, name: '2025-2026 Payız mövsümü', status: 'PLANNED' },
  });

  // 3.2 Mövsümə sahələr təyin et (növbəli əkin)
  await Promise.all([
    // Payız 2024-2025
    prisma.seasonField.create({ data: { seasonId: season1.id, fieldId: fields[0].id, cropType: 'Buğda', status: 'GROWING', sowingDate: new Date('2024-10-15') } }),
    prisma.seasonField.create({ data: { seasonId: season1.id, fieldId: fields[2].id, cropType: 'Arpa', status: 'GROWING', sowingDate: new Date('2024-10-20') } }),
    prisma.seasonField.create({ data: { seasonId: season1.id, fieldId: fields[4].id, cropType: 'Buğda', status: 'GROWING', sowingDate: new Date('2024-10-25') } }),
    // Yaz 2025
    prisma.seasonField.create({ data: { seasonId: season2.id, fieldId: subField1.id, cropType: 'Qarğıdalı', plantedArea: 50, status: 'SOWN', sowingDate: new Date('2025-04-15') } }),
    prisma.seasonField.create({ data: { seasonId: season2.id, fieldId: subField2.id, cropType: 'Çuğundur', plantedArea: 30, status: 'SOWN', sowingDate: new Date('2025-04-20') } }),
    prisma.seasonField.create({ data: { seasonId: season2.id, fieldId: fields[5].id, cropType: 'Qarğıdalı', status: 'SOWN', sowingDate: new Date('2025-05-01') } }),
    prisma.seasonField.create({ data: { seasonId: season2.id, fieldId: fields[6].id, cropType: 'Pambıq', status: 'SOWN', sowingDate: new Date('2025-04-20') } }),
  ]);
  console.log('✅ Mövsümlər və əkin planı yaradıldı');

  // 4. İstifadəçilər yarat
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const hashedPasswordUser = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@agroerp.az',
      password: hashedPassword,
      fullName: 'Əli Həsənov',
      phone: '+994 50 111 22 33',
      role: 'ADMIN',
    },
  });

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'rehber@agroerp.az',
      password: hashedPasswordUser,
      fullName: 'Rəşad Məmmədov',
      phone: '+994 50 222 33 44',
      role: 'FARM_MANAGER',
    },
  });

  const agronomist1 = await prisma.user.create({
    data: {
      companyId: company.id,
      farmId: farm1.id,
      email: 'aqronom1@agroerp.az',
      password: hashedPasswordUser,
      fullName: 'Tural Əliyev',
      phone: '+994 50 333 44 55',
      role: 'AGRONOMIST',
    },
  });

  const agronomist2 = await prisma.user.create({
    data: {
      companyId: company.id,
      farmId: farm2.id,
      email: 'aqronom2@agroerp.az',
      password: hashedPasswordUser,
      fullName: 'Nihad Quliyev',
      phone: '+994 50 444 55 66',
      role: 'AGRONOMIST',
    },
  });
  console.log('✅ İstifadəçilər yaradıldı');

  // 5. Əməliyyat kateqoriyaları və prosesleri
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

  // Torpaq hazırlığı prosesleri
  const procSumlama = await prisma.operationProcess.create({ data: { categoryId: catTorpaq.id, name: 'Şumlama', sortOrder: 1 } });
  const procDiskleme = await prisma.operationProcess.create({ data: { categoryId: catTorpaq.id, name: 'Diskləmə', sortOrder: 2 } });
  await prisma.operationProcess.create({ data: { categoryId: catTorpaq.id, name: 'Malalanma', sortOrder: 3 } });
  await prisma.operationProcess.create({ data: { categoryId: catTorpaq.id, name: 'Çizel', sortOrder: 4 } });

  // Toxum səpini prosesleri
  const procDenliSepin = await prisma.operationProcess.create({ data: { categoryId: catToxum.id, name: 'Dənli bitki səpini', sortOrder: 1 } });
  const procTexnikiSepin = await prisma.operationProcess.create({ data: { categoryId: catToxum.id, name: 'Texniki bitki səpini', sortOrder: 2 } });

  // Kimyəvi mübarizə prosesleri
  const procHerbisid = await prisma.operationProcess.create({ data: { categoryId: catKimya.id, name: 'Herbisid', sortOrder: 1 } });
  await prisma.operationProcess.create({ data: { categoryId: catKimya.id, name: 'Fungisid', sortOrder: 2 } });
  await prisma.operationProcess.create({ data: { categoryId: catKimya.id, name: 'İnsektisid', sortOrder: 3 } });
  await prisma.operationProcess.create({ data: { categoryId: catKimya.id, name: 'Akarisid', sortOrder: 4 } });
  await prisma.operationProcess.create({ data: { categoryId: catKimya.id, name: 'Desikasiya', sortOrder: 5 } });

  // Gübrələmə prosesleri
  const procAzot = await prisma.operationProcess.create({ data: { categoryId: catGubre.id, name: 'Azot gübrəsi', sortOrder: 1 } });
  const procFosfor = await prisma.operationProcess.create({ data: { categoryId: catGubre.id, name: 'Fosfor gübrəsi', sortOrder: 2 } });
  await prisma.operationProcess.create({ data: { categoryId: catGubre.id, name: 'Kalium gübrəsi', sortOrder: 3 } });
  await prisma.operationProcess.create({ data: { categoryId: catGubre.id, name: 'Kompleks gübrə', sortOrder: 4 } });
  await prisma.operationProcess.create({ data: { categoryId: catGubre.id, name: 'Yarpaq gübrəsi', sortOrder: 5 } });

  // Biçin prosesleri
  const procKombayn = await prisma.operationProcess.create({ data: { categoryId: catBicin.id, name: 'Kombayn biçini', sortOrder: 1 } });
  await prisma.operationProcess.create({ data: { categoryId: catBicin.id, name: 'Əl biçini', sortOrder: 2 } });
  await prisma.operationProcess.create({ data: { categoryId: catBicin.id, name: 'Məhsul daşınma', sortOrder: 3 } });

  console.log('✅ Əməliyyat kateqoriyaları və prosesleri yaradıldı');

  // 5.1 Aqreqatlar
  const aggMTZ = await prisma.aggregate.create({ data: { companyId: company.id, name: 'MTZ-1221', type: 'Traktor' } });
  const aggJD = await prisma.aggregate.create({ data: { companyId: company.id, name: 'John Deere 8320R', type: 'Traktor' } });
  const aggDisk = await prisma.aggregate.create({ data: { companyId: company.id, name: 'Disk mala 6m', type: 'Aqreqat' } });
  await prisma.aggregate.create({ data: { companyId: company.id, name: 'Kultivator 8m', type: 'Aqreqat' } });
  const aggSpray = await prisma.aggregate.create({ data: { companyId: company.id, name: 'Dərmanvuran 24m', type: 'Aqreqat' } });
  const aggKombayn = await prisma.aggregate.create({ data: { companyId: company.id, name: 'Kombayn CF-80', type: 'Kombayn' } });
  const aggSeeder = await prisma.aggregate.create({ data: { companyId: company.id, name: 'Səpin makinesi 6m', type: 'Aqreqat' } });
  console.log('✅ Aqreqatlar yaradıldı');

  // 5.2 Aqrotexniki proses nümunələri (yeni format: +material)
  // SeasonField-lər hələ yaradılmayıb, aşağıda yaradılacaq — hələlik seasonFieldId null
  const proc1 = await prisma.agroProcess.create({
    data: {
      fieldId: fields[0].id, userId: agronomist1.id, categoryId: catToxum.id,
      processId: procDenliSepin.id, aggregateId: aggSeeder.id,
      processType: 'SOWING', description: 'Payız buğdası əkildi',
      processDate: new Date('2024-10-15'), areaProcessed: 120, status: 'COMPLETED',
    },
  });
  const proc2 = await prisma.agroProcess.create({
    data: {
      fieldId: fields[0].id, userId: agronomist1.id, categoryId: catGubre.id,
      processId: procAzot.id, aggregateId: aggSpray.id,
      processType: 'FERTILIZING', description: 'Azot gübrəsi verildi',
      processDate: new Date('2025-03-10'), areaProcessed: 120, status: 'COMPLETED',
    },
  });
  await prisma.agroProcess.create({
    data: {
      fieldId: fields[1].id, userId: agronomist1.id, categoryId: catTorpaq.id,
      processId: procSumlama.id, aggregateId: aggJD.id,
      processType: 'PLOWING', description: 'Torpaq şumlandı',
      processDate: new Date('2025-03-20'), areaProcessed: 80, status: 'COMPLETED',
    },
  });
  await prisma.agroProcess.create({
    data: {
      fieldId: fields[1].id, userId: agronomist1.id, categoryId: catToxum.id,
      processId: procTexnikiSepin.id, aggregateId: aggSeeder.id,
      processType: 'SOWING', description: 'Pambıq əkildi',
      processDate: new Date('2025-04-15'), areaProcessed: 80, status: 'COMPLETED',
    },
  });
  await prisma.agroProcess.create({
    data: {
      fieldId: fields[2].id, userId: agronomist1.id, categoryId: catBicin.id,
      processId: procKombayn.id, aggregateId: aggKombayn.id,
      processType: 'HARVESTING', description: 'Arpa biçini',
      processDate: new Date('2025-06-20'), areaProcessed: 150, status: 'IN_PROGRESS',
    },
  });
  const proc6 = await prisma.agroProcess.create({
    data: {
      fieldId: fields[4].id, userId: agronomist2.id, categoryId: catGubre.id,
      processId: procFosfor.id, aggregateId: aggSpray.id,
      processType: 'FERTILIZING', description: 'Fosfor gübrəsi verildi',
      processDate: new Date('2025-03-05'), areaProcessed: 90, status: 'COMPLETED',
    },
  });
  const proc7 = await prisma.agroProcess.create({
    data: {
      fieldId: fields[5].id, userId: agronomist2.id, categoryId: catKimya.id,
      processId: procHerbisid.id, aggregateId: aggSpray.id,
      processType: 'SPRAYING', description: 'Alaq otlarına qarşı herbisid vuruldu',
      processDate: new Date('2025-05-10'), areaProcessed: 110, status: 'COMPLETED',
    },
  });
  await prisma.agroProcess.create({
    data: {
      fieldId: fields[6].id, userId: agronomist2.id, categoryId: catToxum.id,
      processId: procTexnikiSepin.id, aggregateId: aggSeeder.id,
      processType: 'SOWING', description: 'Pambıq əkildi',
      processDate: new Date('2025-04-20'), areaProcessed: 120, status: 'COMPLETED',
    },
  });
  console.log('✅ Proseslər yaradıldı: 8 ədəd');

  // 6. Pivot Sürət Cədvəlləri yarat
  const pivotCharts = await Promise.all([
    // Pivot 1 üçün (Sabirabad)
    prisma.pivotSpeedChart.create({
      data: {
        fieldId: fields[0].id,
        entries: JSON.stringify([
          { speed: 10, mm: 52 },
          { speed: 15, mm: 42 },
          { speed: 20, mm: 35 },
          { speed: 25, mm: 28 },
          { speed: 30, mm: 24 },
          { speed: 40, mm: 18 },
          { speed: 50, mm: 14 },
          { speed: 60, mm: 12 },
          { speed: 70, mm: 10 },
          { speed: 80, mm: 8 },
          { speed: 100, mm: 6 },
        ]),
      },
    }),
    // Pivot 2 üçün (Sabirabad)
    prisma.pivotSpeedChart.create({
      data: {
        fieldId: fields[1].id,
        entries: JSON.stringify([
          { speed: 10, mm: 48 },
          { speed: 20, mm: 32 },
          { speed: 30, mm: 22 },
          { speed: 40, mm: 16 },
          { speed: 50, mm: 13 },
          { speed: 60, mm: 11 },
          { speed: 80, mm: 8 },
          { speed: 100, mm: 6 },
        ]),
      },
    }),
    // Pivot 3 üçün (Sabirabad)
    prisma.pivotSpeedChart.create({
      data: {
        fieldId: fields[2].id,
        entries: JSON.stringify([
          { speed: 10, mm: 55 },
          { speed: 20, mm: 37 },
          { speed: 30, mm: 25 },
          { speed: 40, mm: 19 },
          { speed: 50, mm: 15 },
          { speed: 70, mm: 11 },
          { speed: 100, mm: 8 },
        ]),
      },
    }),
    // Kürdəmir Pivot 1
    prisma.pivotSpeedChart.create({
      data: {
        fieldId: fields[4].id,
        entries: JSON.stringify([
          { speed: 10, mm: 50 },
          { speed: 20, mm: 33 },
          { speed: 30, mm: 23 },
          { speed: 50, mm: 15 },
          { speed: 70, mm: 11 },
          { speed: 100, mm: 7 },
        ]),
      },
    }),
  ]);
  console.log('✅ Pivot sürət cədvəlləri yaradıldı:', pivotCharts.length, 'ədəd');

  // 7. Suvarmalar yarat (pivot + sprinkler + damlama)
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed cari ay

  const irrigationData = [
    // Pivot suvarmaları — cari ay
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 2), pivotSpeed: 20, waterMm: 35, notes: 'Birinci suvarma, sürət 20%' },
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 9), pivotSpeed: 25, waterMm: 28 },
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 16), pivotSpeed: 20, waterMm: 35 },
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 23), pivotSpeed: 30, waterMm: 24 },
    { fieldId: fields[1].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 3), pivotSpeed: 20, waterMm: 32 },
    { fieldId: fields[1].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 10), pivotSpeed: 30, waterMm: 22 },
    { fieldId: fields[1].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 17), pivotSpeed: 20, waterMm: 32 },
    { fieldId: fields[2].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 4), pivotSpeed: 30, waterMm: 25 },
    { fieldId: fields[2].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 11), pivotSpeed: 25, waterMm: 37 },
    { fieldId: fields[2].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m, 18), pivotSpeed: 20, waterMm: 37 },
    // Sprinkler — Kürdəmir
    { fieldId: fields[4].id, userId: agronomist2.id, irrigationType: 'SPRINKLER', irrigationDate: new Date(y, m, 5), duration: 6, waterVolume: 540 },
    { fieldId: fields[4].id, userId: agronomist2.id, irrigationType: 'SPRINKLER', irrigationDate: new Date(y, m, 12), duration: 8, waterVolume: 720 },
    // Damlama
    { fieldId: fields[5].id, userId: agronomist2.id, irrigationType: 'DRIP', irrigationDate: new Date(y, m, 6), duration: 12, waterVolume: 480 },
    { fieldId: fields[5].id, userId: agronomist2.id, irrigationType: 'DRIP', irrigationDate: new Date(y, m, 13), duration: 10, waterVolume: 400 },
    { fieldId: fields[6].id, userId: agronomist2.id, irrigationType: 'DRIP', irrigationDate: new Date(y, m, 7), duration: 10, waterVolume: 600 },
    // Keçən ay
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 5), pivotSpeed: 20, waterMm: 35 },
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 12), pivotSpeed: 20, waterMm: 35 },
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 19), pivotSpeed: 25, waterMm: 28 },
    { fieldId: fields[0].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 26), pivotSpeed: 30, waterMm: 24 },
    { fieldId: fields[1].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 6), pivotSpeed: 20, waterMm: 32 },
    { fieldId: fields[1].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 13), pivotSpeed: 30, waterMm: 22 },
    { fieldId: fields[2].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 7), pivotSpeed: 20, waterMm: 37 },
    { fieldId: fields[2].id, userId: agronomist1.id, irrigationType: 'PIVOT', irrigationDate: new Date(y, m - 1, 14), pivotSpeed: 25, waterMm: 37 },
  ];

  for (const i of irrigationData) {
    await prisma.irrigation.create({ data: i as any });
  }
  console.log('✅ Suvarmalar yaradıldı:', irrigationData.length, 'ədəd');

  // 7.1 Yağıntı qeydiyyatı
  const allFields = [...fields, subField1, subField2];
  const rainfallData = [
    { date: new Date(y, m, 8), mm: 12, note: 'Axşam yağışı', fieldIds: [fields[0].id, fields[1].id, fields[2].id] },
    { date: new Date(y, m, 15), mm: 8, note: 'Gecə yağışı', fieldIds: allFields.map((f) => f.id) },
    { date: new Date(y, m - 1, 10), mm: 22, note: 'Güclü yağış', fieldIds: allFields.map((f) => f.id) },
    { date: new Date(y, m - 1, 20), mm: 5, note: 'Yüngül çiskin', fieldIds: [fields[4].id, fields[5].id, fields[6].id] },
  ];

  for (const r of rainfallData) {
    const rainfall = await prisma.rainfall.create({
      data: {
        companyId: company.id,
        userId: admin.id,
        rainfallDate: r.date,
        amountMm: r.mm,
        notes: r.note,
      },
    });
    for (const fId of r.fieldIds) {
      await prisma.rainfallField.create({ data: { rainfallId: rainfall.id, fieldId: fId } });
    }
  }
  console.log('✅ Yağıntı qeydləri yaradıldı:', rainfallData.length, 'ədəd');

  // 7. Anbar yarat (təsərrüfata bağlı)
  const warehouse1 = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      farmId: farm1.id,
      name: 'Sabirabad anbarı',
      location: 'Sabirabad',
    },
  });

  const warehouse2 = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      farmId: farm2.id,
      name: 'Kürdəmir anbarı',
      location: 'Kürdəmir',
    },
  });

  // 8. Anbar məhsulları (code1C + orderNumber)
  const items = await Promise.all([
    prisma.warehouseItem.create({ data: { warehouseId: warehouse1.id, name: 'Buğda toxumu (Bezostaya)', code1C: 'TOX-001', orderNumber: 'SIF-2024-101', category: 'SEED', currentStock: 5000, unit: 'kq', minStock: 1000 } }),
    prisma.warehouseItem.create({ data: { warehouseId: warehouse1.id, name: 'Pambıq toxumu', code1C: 'TOX-002', orderNumber: 'SIF-2024-102', category: 'SEED', currentStock: 3000, unit: 'kq', minStock: 500 } }),
    prisma.warehouseItem.create({ data: { warehouseId: warehouse1.id, name: 'Ammonium nitrat', code1C: 'GUB-001', orderNumber: 'SIF-2025-201', category: 'FERTILIZER', currentStock: 8000, unit: 'kq', minStock: 2000 } }),
    prisma.warehouseItem.create({ data: { warehouseId: warehouse1.id, name: 'Superfosfat', code1C: 'GUB-002', orderNumber: 'SIF-2025-202', category: 'FERTILIZER', currentStock: 4500, unit: 'kq', minStock: 1000 } }),
    prisma.warehouseItem.create({ data: { warehouseId: warehouse1.id, name: 'Herbisid (2,4-D)', code1C: 'HER-001', orderNumber: 'SIF-2025-301', category: 'HERBICIDE', currentStock: 200, unit: 'litr', minStock: 50 } }),
    prisma.warehouseItem.create({ data: { warehouseId: warehouse2.id, name: 'Dizel yanacağı', code1C: 'YAN-001', orderNumber: 'SIF-2025-401', category: 'FUEL', currentStock: 3000, unit: 'litr', minStock: 500 } }),
    prisma.warehouseItem.create({ data: { warehouseId: warehouse2.id, name: 'Pestisid (Karate)', code1C: 'PES-001', orderNumber: 'SIF-2025-501', category: 'PESTICIDE', currentStock: 80, unit: 'litr', minStock: 20 } }),
  ]);
  console.log('✅ Anbar məhsulları yaradıldı:', items.length, 'ədəd');

  // 9. Anbar hərəkətləri
  const movementData = [
    { warehouseItemId: items[0].id, userId: agronomist1.id, fieldId: fields[0].id, movementType: 'OUT', quantity: 28000, reason: 'Buğda əkini üçün', movementDate: new Date('2024-10-14') },
    { warehouseItemId: items[2].id, userId: agronomist1.id, fieldId: fields[0].id, movementType: 'OUT', quantity: 3600, reason: 'Gübrələmə', movementDate: new Date('2025-03-10') },
    { warehouseItemId: items[2].id, userId: admin.id, movementType: 'IN', quantity: 10000, reason: 'Satınalma', supplier: 'AzərKimya MMC', unitPrice: 0.8, movementDate: new Date('2025-02-01') },
    { warehouseItemId: items[4].id, userId: agronomist2.id, fieldId: fields[5].id, movementType: 'OUT', quantity: 55, reason: 'Herbisid vurmaq', movementDate: new Date('2025-05-10') },
    { warehouseItemId: items[5].id, userId: admin.id, movementType: 'IN', quantity: 5000, reason: 'Yanacaq alışı', supplier: 'SOCAR', unitPrice: 1.2, movementDate: new Date('2025-03-01') },
  ];

  for (const m of movementData) {
    await prisma.warehouseMovement.create({ data: m as any });
  }
  console.log('✅ Anbar hərəkətləri yaradıldı');

  // 9.1 Proses materialları + WriteOff qeydləri
  const mat1 = await prisma.agroProcessMaterial.create({
    data: { agroProcessId: proc1.id, warehouseItemId: items[0].id, quantity: 28000, ratePerHa: 233 },
  });
  const mat2 = await prisma.agroProcessMaterial.create({
    data: { agroProcessId: proc2.id, warehouseItemId: items[2].id, quantity: 3600, ratePerHa: 30 },
  });
  const mat3 = await prisma.agroProcessMaterial.create({
    data: { agroProcessId: proc6.id, warehouseItemId: items[3].id, quantity: 2700, ratePerHa: 30 },
  });
  const mat4 = await prisma.agroProcessMaterial.create({
    data: { agroProcessId: proc7.id, warehouseItemId: items[4].id, quantity: 55, ratePerHa: 0.5 },
  });
  console.log('✅ Proses materialları yaradıldı');

  // 9.2 Silinmə qeydləri (WriteOff)
  await prisma.writeOff.create({
    data: { agroProcessMaterialId: mat1.id, warehouseItemId: items[0].id, fieldId: fields[0].id, quantity: 28000, status: 'COMPLETED', processDate: new Date('2024-10-15'), completedAt: new Date('2024-10-20'), notes: 'Silinmə təsdiqləndi' },
  });
  await prisma.writeOff.create({
    data: { agroProcessMaterialId: mat2.id, warehouseItemId: items[2].id, fieldId: fields[0].id, quantity: 3600, status: 'COMPLETED', processDate: new Date('2025-03-10'), completedAt: new Date('2025-03-15') },
  });
  await prisma.writeOff.create({
    data: { agroProcessMaterialId: mat3.id, warehouseItemId: items[3].id, fieldId: fields[4].id, quantity: 2700, status: 'PENDING', processDate: new Date('2025-03-05') },
  });
  await prisma.writeOff.create({
    data: { agroProcessMaterialId: mat4.id, warehouseItemId: items[4].id, fieldId: fields[5].id, quantity: 55, status: 'PENDING', processDate: new Date('2025-05-10') },
  });
  console.log('✅ Silinmə qeydləri yaradıldı');

  // 10. Sahə qeydləri
  const noteData = [
    { fieldId: fields[0].id, userId: agronomist1.id, title: 'Buğdanın vəziyyəti yaxşıdır', content: 'Buğda sahəsində bitkilər normal inkişaf edir. Sünbüllər formalaşıb. Sarı pas xəstəliyi əlamətləri yoxdur.', weatherCondition: 'Günəşli', temperature: 28, noteDate: new Date('2025-05-20') },
    { fieldId: fields[1].id, userId: agronomist1.id, title: 'Pambıq cücərtiləri', content: 'Pambıq sahəsində cücərtilər görünür. Cərgə arası becərmə lazımdır. Bəzi yerlərdə seyrəltmə tələb olunur.', weatherCondition: 'Buludlu', temperature: 24, noteDate: new Date('2025-05-01') },
    { fieldId: fields[4].id, userId: agronomist2.id, title: 'Buğda biçinə hazırdır', content: 'Buğdanın su faizi 14%-ə düşüb. Biçinə başlamaq olar. Kombaynları hazır etmək lazımdır.', weatherCondition: 'Günəşli', temperature: 35, noteDate: new Date('2025-06-15') },
    { fieldId: fields[5].id, userId: agronomist2.id, title: 'Alaq otu problemi', content: 'Qarğıdalı sahəsində alaq otları artıb. Herbisid tətbiqi lazımdır. Gün ərzində dərman vurulacaq.', weatherCondition: 'Yağışlı', temperature: 22, noteDate: new Date('2025-05-08') },
  ];

  for (const n of noteData) {
    await prisma.fieldNote.create({ data: n });
  }
  console.log('✅ Sahə qeydləri yaradıldı');

  // 11. Pivot dayanma qeydləri (nümunə)
  const stoppageData = [
    {
      fieldId: fields[1].id, userId: agronomist1.id,
      startDate: new Date(now.getFullYear(), now.getMonth(), 5),
      endDate: new Date(now.getFullYear(), now.getMonth(), 8),
      reason: 'BREAKDOWN', title: 'Motor nasazlığı',
      notes: 'Pivot motorunda nasazlıq, tex. servis çağırıldı',
    },
    {
      fieldId: fields[2].id, userId: agronomist1.id,
      startDate: new Date(now.getFullYear(), now.getMonth(), 13),
      endDate: new Date(now.getFullYear(), now.getMonth(), 14),
      reason: 'MAINTENANCE', title: 'Planlı texniki baxım',
      notes: 'İllik texniki baxım: yağlama, bolt-qaykaların yoxlanması',
    },
    {
      fieldId: fields[4].id, userId: agronomist2.id,
      startDate: new Date(now.getFullYear(), now.getMonth(), 9),
      endDate: null,
      reason: 'WATER_SHORTAGE', title: 'Su təchizatı problemi',
      notes: 'Pompa stansiyasında su təzyiqi aşağı düşüb',
    },
  ];
  for (const s of stoppageData) {
    await prisma.pivotStoppage.create({ data: s as any });
  }
  console.log('✅ Pivot dayanma qeydləri yaradıldı:', stoppageData.length, 'ədəd');


  // 12. Sahə Monitorinqləri
  await prisma.fieldMonitoring.create({
    data: {
      fieldId: fields[0].id, userId: agronomist1.id,
      monitoringDate: new Date('2025-05-20'),
      cropType: 'Buğda', lastIrrigationDate: new Date('2025-05-18'), lastIrrigationMm: 45,
      plantPhase: 'Sünbülləmə', pest: 'Sün böcəyi', pestPhotos: null,
      disease: null, diseasePhotos: null,
      weedStatus: 'Az', weedPhotos: null,
      nutrientDeficiency: null, nutrientPhotos: null,
      rodentActivity: null, rodentLocation: null,
      irrigationDepthCm: 30, fieldPhoto: null,
      notes: 'Sahədə vəziyyət normaldır, sün böcəyi az miqdarda müşahidə edilir.',
    },
  });
  await prisma.fieldMonitoring.create({
    data: {
      fieldId: fields[1].id, userId: agronomist1.id,
      monitoringDate: new Date('2025-05-25'),
      cropType: 'Pambıq', lastIrrigationDate: new Date('2025-05-22'), lastIrrigationMm: 60,
      plantPhase: 'Çiçəkləmə', pest: null, pestPhotos: null,
      disease: 'Vilt xəstəliyi', diseasePhotos: null,
      weedStatus: 'Orta', weedPhotos: null,
      nutrientDeficiency: 'Azot çatışmazlığı', nutrientPhotos: null,
      rodentActivity: null, rodentLocation: null,
      irrigationDepthCm: 40, fieldPhoto: null,
      notes: 'Bəzi cərgələrdə vilt əlamətləri var. Azot gübrəsi tətbiqi lazımdır.',
    },
  });
  await prisma.fieldMonitoring.create({
    data: {
      fieldId: fields[5].id, userId: agronomist2.id,
      monitoringDate: new Date('2025-05-15'),
      cropType: 'Qarğıdalı', lastIrrigationDate: new Date('2025-05-12'), lastIrrigationMm: 50,
      plantPhase: 'Vegetativ inkişaf', pest: null, pestPhotos: null,
      disease: null, diseasePhotos: null,
      weedStatus: 'Çox', weedPhotos: null,
      nutrientDeficiency: null, nutrientPhotos: null,
      rodentActivity: 'Var', rodentLocation: 'Sahənin şimal-qərb küncü',
      irrigationDepthCm: 35, fieldPhoto: null,
      notes: 'Alaq otları çoxdur, herbisid tətbiqi lazımdır. Gəmirici sahənin şimal küncündə.',
    },
  });
  console.log('✅ Sahə monitorinqləri yaradıldı: 3 ədəd');

  // 13. Çıxış Monitorinqləri
  await prisma.emergenceMonitoring.create({
    data: {
      fieldId: fields[0].id, userId: agronomist1.id,
      monitoringDate: new Date('2024-11-05'),
      sowingDate: new Date('2024-10-15'), cropType: 'Buğda', variety: 'Bezostaya-1',
      plantedCount: 5.5, countUnit: 'million',
      emergedCount: 4.8, emergencePercent: 87.3,
      notes: 'Çıxış normaldır. Bəzi yerlərdə dərinlik səbəbiylə gec çıxış var.',
    },
  });
  await prisma.emergenceMonitoring.create({
    data: {
      fieldId: fields[1].id, userId: agronomist1.id,
      monitoringDate: new Date('2025-05-05'),
      sowingDate: new Date('2025-04-20'), cropType: 'Pambıq', variety: 'Gəncə-2',
      plantedCount: 85, countUnit: 'thousand',
      emergedCount: 72, emergencePercent: 84.7,
      notes: 'Çıxış yaxşıdır. Seyrəltmə lazımdır.',
    },
  });
  await prisma.emergenceMonitoring.create({
    data: {
      fieldId: fields[5].id, userId: agronomist2.id,
      monitoringDate: new Date('2025-04-25'),
      sowingDate: new Date('2025-04-10'), cropType: 'Qarğıdalı', variety: 'P9903',
      plantedCount: 70, countUnit: 'thousand',
      emergedCount: 65, emergencePercent: 92.9,
      notes: 'Əla çıxış.',
    },
  });
  console.log('✅ Çıxış monitorinqləri yaradıldı: 3 ədəd');

  console.log('\n🎉 Seed tamamlandı!');
  console.log('\n📧 Demo hesablar:');
  console.log('   Admin:    admin@agroerp.az / admin123');
  console.log('   Rəhbər:   rehber@agroerp.az / user123');
  console.log('   Aqronom1:  aqronom1@agroerp.az / user123');
  console.log('   Aqronom2:  aqronom2@agroerp.az / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed xətası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
