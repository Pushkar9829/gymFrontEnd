// Seeds gym_mgmt_e2e: the normal demo data plus one record in every module so each screen has content.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(here, '..', '..', 'server');
const mod = (p) => import(new URL(`file:///${path.join(server, 'src', p).replace(/\\/g, '/')}`).href);

if (!/gym_mgmt_e2e$/.test(process.env.MONGO_URI || '')) throw new Error('E2E seed must target gym_mgmt_e2e');

const { connectDb, disconnectDb } = await mod('config/db.js');
const { default: mongoose } = await import(new URL(`file:///${path.join(server, 'node_modules/mongoose/index.js').replace(/\\/g, '/')}`).href);
await connectDb(process.env.MONGO_URI);
await mongoose.connection.db.dropDatabase();
await disconnectDb();

// Base demo data (gym, branch, staff, plans, members with memberships, demo device, exercises)
execFileSync(process.execPath, [path.join(server, 'src/scripts/seed.js'), '--demo'], { env: process.env, stdio: 'inherit', cwd: server });

await connectDb(process.env.MONGO_URI);
const { Member } = await mod('modules/members/member.model.js');
const { User } = await mod('modules/users/user.model.js');
const { Branch } = await mod('modules/branches/branch.model.js');
const { hashPassword } = await mod('modules/auth/auth.service.js');
const { PtPackage, PtPurchase } = await mod('modules/pt/pt.model.js');
const { ClassType, ClassSchedule } = await mod('modules/classes/class.model.js');
const { Product, Stock } = await mod('modules/shop/shop.model.js');
const { Company } = await mod('modules/companies/company.model.js');
const { Equipment } = await mod('modules/equipment/equipment.model.js');
const { Gym } = await mod('modules/settings/gym.model.js');
const { startOfDay, addDays } = await mod('utils/dates.js');

const branch = await Branch.findOne({ code: 'MAIN' });
const trainer = await User.findOne({ role: 'trainer' });
await Gym.updateOne({}, { name: 'E2E Fitness', gstin: '29ABCDE1234F1Z5', address: 'MG Road, Bengaluru', phone: '9800000000' });
await Member.updateOne({ memberCode: 1001 }, { portalEnabled: true, passwordHash: await hashPassword('Member@123'), trainerId: trainer._id, email: 'rahul@example.com', cardNo: '0011223344' });
await User.updateMany({ role: { $ne: 'owner' } }, { salary: { type: 'monthly', amount: 2500000 } });
await User.updateOne({ _id: trainer._id }, { ptCommissionPercent: 30 });
const pkg = await PtPackage.create({ name: '12 sessions', sessions: 12, validityDays: 60, price: 900000 });
const rahul = await Member.findOne({ memberCode: 1001 });
await PtPurchase.create({
  memberId: rahul._id, branchId: branch._id, trainerId: trainer._id, packageId: pkg._id,
  package: { name: pkg.name, sessions: 12, validityDays: 60, price: 900000 }, sessionsTotal: 12,
  validFrom: startOfDay(), validTo: addDays(startOfDay(), 59), price: 900000, taxPercent: 18, taxAmount: 162000,
  totalAmount: 1062000, paidAmount: 1062000, dueAmount: 0,
});
const yoga = await ClassType.create({ name: 'Yoga', color: '#7c3aed', durationMin: 60, defaultCapacity: 10 });
await ClassSchedule.create({ branchId: branch._id, classTypeId: yoga._id, trainerId: trainer._id, weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '23:30', durationMin: 30, capacity: 10, validFrom: startOfDay() });
const bar = await Product.create({ name: 'Protein Bar', sku: 'BAR1', category: 'snack', price: 10000, costPrice: 6000, taxPercent: 12, lowStockAt: 3 });
await Stock.create({ productId: bar._id, branchId: branch._id, qty: 50 });
await Company.create({ name: 'Acme Tech', gstin: '29AAACA1234A1Z5', discountPercent: 10, billTo: 'member' });
await Equipment.create({ branchId: branch._id, name: 'Treadmill #1', category: 'cardio', brand: 'Life Fitness', serviceIntervalDays: 90, lastServiceAt: addDays(new Date(), -85), nextServiceDue: addDays(new Date(), 5) });
console.log('E2E seed complete');
await disconnectDb();
