require('dotenv').config();
const { parseArgs } = require('node:util');
const mongoose = require('mongoose');
const { User, Laboratory } = require('../src/models');
const { normalizePhone } = require('../src/utils/phone');

async function onboard() {
  const { values } = parseArgs({ options: {
    name: { type: 'string' }, phone: { type: 'string' }, code: { type: 'string' }, location: { type: 'string' },
  } });
  const name = values.name?.trim();
  const phone = normalizePhone(values.phone);
  const code = values.code?.trim().toUpperCase();
  if (!name || !/^\+?\d{10,15}$/.test(phone) || !/^LAB-[A-Z0-9]+$/.test(code || '')) {
    throw new Error('Usage: node scripts/onboardLaboratory.js --name "Laboratory name" --phone "+919000000002" --code "LAB-102" --location "City"');
  }
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vaani_doc_local');
  await mongoose.connection.transaction(async (session) => {
    if (await User.exists({ phone }).session(session)) throw new Error('Phone already registered.');
    let laboratory = await Laboratory.findOne({ qr_code_id: code }).session(session);
    if (laboratory?.user_id) throw new Error('Laboratory already has an operator account.');
    const [user] = await User.create([{ role: 'LABORATORY', phone, name }], { session });
    if (!laboratory) laboratory = new Laboratory({ name, qr_code_id: code });
    laboratory.user_id = user._id;
    laboratory.name = name;
    laboratory.contact_phone = phone;
    laboratory.location = values.location?.trim() || laboratory.location;
    laboratory.platform_approval_status = 'APPROVED';
    await laboratory.save({ session });
  });
  console.log(`Laboratory ${code} onboarded. Sign in with the registered phone and provider code.`);
}

onboard().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
