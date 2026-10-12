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
const { Locker } = await mod('modules/lockers/locker.model.js');
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
await Locker.insertMany(Array.from({ length: 12 }, (_, i) => ({ branchId: branch._id, number: `L${i + 1}`, monthlyFee: 30000 })));

// Extra records for 08-secondary-actions (own members/staff/classes so other specs are not affected).
const { Plan } = await mod('modules/plans/plan.model.js');
const { ClassSession, Booking } = await mod('modules/classes/class.model.js');
const { DietPlan, Measurement } = await mod('modules/fitness/fitness.model.js');
const { createSubscription } = await mod('modules/subscriptions/subscription.service.js');
const { nextSeq } = await mod('utils/counter.js');
const { ymd } = await mod('utils/dates.js');
const owner = await User.findOne({ role: 'owner' });
const plans = Object.fromEntries((await Plan.find().lean()).map((p) => [p.name, p]));
const addMember = async (name, phone, extra = {}) => Member.create({ branchId: branch._id, memberCode: await nextSeq('memberCode', 1001), name, phone, ...extra });
const ojas = await addMember('Ojas Edit', '9876511001');
await createSubscription({ memberId: ojas._id, planId: plans.Quarterly._id, startDate: ymd(addDays(new Date(), -10)), payment: { amount: Math.round(450000 * 1.18), mode: 'upi' }, user: owner, allowBackdate: true });
const deepa = await addMember('Deepa Due', '9876511002');
await createSubscription({ memberId: deepa._id, planId: plans.Monthly._id, startDate: ymd(addDays(new Date(), -3)), payment: { amount: 100000, mode: 'cash' }, user: owner, allowBackdate: true });
await addMember('Zara Remove', '9876511003');
const tara = await addMember('Tara Fit', '9876511004', { portalEnabled: true, passwordHash: await hashPassword('Member@123') });
await createSubscription({ memberId: tara._id, planId: plans.Monthly._id, startDate: ymd(addDays(new Date(), -2)), payment: { amount: Math.round(200000 * 1.18), mode: 'upi' }, user: owner, allowBackdate: true });
await Measurement.create({ memberId: tara._id, date: addDays(new Date(), -7), weightKg: 64.5, heightCm: 165, recordedBy: owner._id });
await DietPlan.create({ name: 'Veg 1800 template', preference: 'veg', dailyCalories: 1800, meals: [{ name: 'Breakfast', time: '08:00', items: [{ food: 'Poha', quantity: '1 bowl', calories: 300 }] }] });
await User.create({ name: 'Pat Password', email: 'pwd.test@gym.local', role: 'receptionist', passwordHash: await hashPassword('Staff@12345'), branchIds: [branch._id] });
const priya = await Member.findOne({ phone: '9876500002' });
const oneOff = async (name, capacity, startsAt) => {
  const type = await ClassType.create({ name, color: '#ea580c', durationMin: 45, defaultCapacity: capacity });
  return ClassSession.create({ branchId: branch._id, classTypeId: type._id, name, color: type.color, startsAt, endsAt: new Date(startsAt.getTime() + 45 * 60000), capacity });
};
const hiit = await oneOff('HIIT Drill', 10, new Date(Date.now() - 10 * 60000)); // started: attendance can be marked
await Booking.create({ sessionId: hiit._id, memberId: priya._id, branchId: branch._id, status: 'booked', source: 'staff' });
await ClassSession.updateOne({ _id: hiit._id }, { bookedCount: 1 });
await oneOff('Pilates Open', 10, new Date(Date.now() + 2 * 3600000)); // upcoming: book / cancel booking / cancel class
const spin = await oneOff('Spin Duo', 1, new Date(Date.now() + 3 * 3600000)); // full: member joins the waitlist
await Booking.create({ sessionId: spin._id, memberId: priya._id, branchId: branch._id, status: 'booked', source: 'staff' });
await ClassSession.updateOne({ _id: spin._id }, { bookedCount: 1 });
// 10-owner-control: a member for the discount approval flow, one who stopped coming (retention "at risk"),
// and memberships that ended 1-2 months ago (one renewed, one lost) so the retention report has numbers.
await addMember('Dev Discount', '9876512001');
const ravi = await addMember('Ravi Away', '9876512002');
await createSubscription({ memberId: ravi._id, planId: plans.Quarterly._id, startDate: ymd(addDays(new Date(), -25)), payment: { amount: Math.round(450000 * 1.18), mode: 'upi' }, user: owner, allowBackdate: true });
await Member.updateOne({ _id: ravi._id }, { lastVisitAt: addDays(new Date(), -20) });
const renewer = await addMember('Old Renewer', '9876512003');
await createSubscription({ memberId: renewer._id, planId: plans.Monthly._id, startDate: ymd(addDays(new Date(), -70)), payment: { amount: Math.round(200000 * 1.18), mode: 'upi' }, user: owner, allowBackdate: true });
await createSubscription({ memberId: renewer._id, planId: plans.Quarterly._id, startDate: ymd(addDays(new Date(), -35)), payment: { amount: Math.round(400000 * 1.18), mode: 'upi' }, user: owner, allowBackdate: true });
const leaver = await addMember('Old Leaver', '9876512004');
await createSubscription({ memberId: leaver._id, planId: plans.Monthly._id, startDate: ymd(addDays(new Date(), -75)), payment: { amount: Math.round(200000 * 1.18), mode: 'upi' }, user: owner, allowBackdate: true });
// 11-reception: a lead to give a trial pass, a member whose membership ran out last week, and a second
// receptionist (no salary, so payroll rows do not change) to hand a task over to.
const { Lead } = await mod('modules/leads/lead.model.js');
await Lead.create({ branchId: branch._id, name: 'Tina Trial', phone: '9876513001', source: 'instagram', status: 'new', assignedTo: owner._id });
const esha = await addMember('Esha Expired', '9876513002');
await createSubscription({ memberId: esha._id, planId: plans.Monthly._id, startDate: ymd(addDays(new Date(), -38)), payment: { amount: Math.round(200000 * 1.18), mode: 'upi' }, user: owner, allowBackdate: true });
await User.create({ name: 'Rina Desk', email: 'rina@gym.local', role: 'receptionist', passwordHash: await hashPassword('Staff@12345'), branchIds: [branch._id] });
console.log('E2E seed complete');
await disconnectDb();
