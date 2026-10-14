require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const DEFAULT_MODELS = require('../src/models');
const { normalizePhone } = require('../src/utils/phone');
const { removeOriginalPdf } = require('../src/services/reportFiles');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vaani_doc_local';
const CATALOG_PATH = path.resolve(__dirname, '../../../demo/catalog.json');
const CATALOG = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const SHARED_FIELDS = ['name', 'date_of_birth', 'gender', 'phone'];

function fixtureObjectId(label) {
  return new mongoose.Types.ObjectId(
    crypto.createHash('sha256').update(`${CATALOG.fixtureSet}:${label}`).digest('hex').slice(0, 24),
  );
}

function sameId(left, right) {
  return left && right && String(left) === String(right);
}

function assertField(label, actual, expected, field) {
  if (String(actual ?? '') !== String(expected ?? '')) {
    throw new Error(`Demo fixture collision for ${label}: ${field} does not match the synthetic catalog.`);
  }
}

function assertUser(label, user, expected) {
  assertField(label, user.phone, normalizePhone(expected.phone), 'phone');
  assertField(label, user.name, expected.name, 'name');
  assertField(label, user.role, expected.role, 'role');
}

function assertProvider(label, provider, expected, user) {
  assertField(label, provider.name, expected.name, 'name');
  assertField(label, provider.qr_code_id, expected.code, 'provider code');
  if (!sameId(provider.user_id, user._id)) {
    throw new Error(`Demo fixture collision for ${label}: provider owner is not the synthetic catalog user.`);
  }
}

function assertPatient(label, patient, expected, user) {
  assertField(label, patient.patient_identifier, expected.identifier, 'patient identifier');
  assertField(label, patient.name, expected.name, 'name');
  assertField(label, patient.phone, normalizePhone(expected.phone), 'phone');
  assertField(label, patient.age, expected.age, 'age');
  assertField(label, patient.gender, expected.gender, 'gender');
  if (!sameId(patient.user_id, user._id)) {
    throw new Error(`Demo fixture collision for ${label}: patient owner is not the synthetic catalog user.`);
  }
}

async function findById(model, id) {
  return model.findById(id);
}

async function preflightUser(model, expected, role) {
  const phone = normalizePhone(expected.phone);
  const user = await model.findOne({ phone });
  if (user) assertUser(`${role} phone ${phone}`, user, { ...expected, role });
  return user;
}

async function preflightProvider(models, expected, role, user) {
  const { Doctor, Laboratory } = models;
  const Provider = role === 'DOCTOR' ? Doctor : Laboratory;
  const OtherProvider = role === 'DOCTOR' ? Laboratory : Doctor;
  const label = `${role} ${expected.code}`;
  const wrongType = await OtherProvider.findOne({ qr_code_id: expected.code });
  if (wrongType) throw new Error(`Demo fixture collision for ${label}: provider code belongs to another provider type.`);
  const provider = await Provider.findOne({ qr_code_id: expected.code });
  if (provider) {
    if (!user) throw new Error(`Demo fixture collision for ${label}: provider exists but its synthetic phone user does not.`);
    assertProvider(label, provider, expected, user);
  }
  const providerForUser = user ? await Provider.findOne({ user_id: user._id }) : null;
  if (providerForUser && !sameId(providerForUser, provider)) {
    throw new Error(`Demo fixture collision for ${label}: synthetic phone already owns another provider record.`);
  }
  const deterministic = await findById(Provider, fixtureObjectId(`${role.toLowerCase()}-provider`));
  if (deterministic && !provider) {
    throw new Error(`Demo fixture collision for ${label}: deterministic fixture provider ID is already owned.`);
  }
  return provider;
}

async function preflightPatient(models, expected, user) {
  const { Patient } = models;
  const label = `patient ${expected.identifier}`;
  const byIdentifier = await Patient.findOne({ patient_identifier: expected.identifier });
  const byPhone = await Patient.findOne({ phone: normalizePhone(expected.phone) });
  const byUser = await Patient.findOne({ user_id: user._id });
  for (const [field, found] of [['identifier', byIdentifier], ['phone', byPhone], ['user', byUser]]) {
    if (found && byIdentifier && !sameId(found._id, byIdentifier._id)) {
      throw new Error(`Demo fixture collision for ${label}: ${field} points to a different patient.`);
    }
  }
  const patient = byIdentifier || byPhone || byUser;
  if (patient) assertPatient(label, patient, expected, user);
  const deterministic = await findById(Patient, fixtureObjectId(`patient-${expected.identifier}`));
  if (deterministic && !patient) {
    throw new Error(`Demo fixture collision for ${label}: deterministic fixture patient ID is already owned.`);
  }
  return patient;
}

/**
 * Read-only ownership checks for every account/provider/patient happen before
 * any demo document is inserted. Existing matching records are left alone.
 */
async function preflight(models) {
  const { User } = models;
  const doctorUser = await preflightUser(User, CATALOG.doctor, 'DOCTOR');
  const laboratoryUser = await preflightUser(User, CATALOG.laboratory, 'LABORATORY');
  await preflightProvider(models, CATALOG.doctor, 'DOCTOR', doctorUser);
  await preflightProvider(models, CATALOG.laboratory, 'LABORATORY', laboratoryUser);
  for (const patient of CATALOG.patients) {
    const user = await preflightUser(User, patient, 'PATIENT');
    if (!user) {
      const deterministicUser = await findById(User, fixtureObjectId(`patient-user-${patient.identifier}`));
      if (deterministicUser) {
        throw new Error(`Demo fixture collision for patient ${patient.identifier}: deterministic fixture user ID is already owned.`);
      }
    }
    await preflightPatient(models, patient, user || { _id: fixtureObjectId(`patient-user-${patient.identifier}`) });
  }
}

async function ensureUser(model, expected, role, label) {
  const phone = normalizePhone(expected.phone);
  const user = await model.findOneAndUpdate(
    { phone },
    { $setOnInsert: { _id: fixtureObjectId(label), role, phone, name: expected.name } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  assertUser(label, user, { ...expected, phone, role });
  return user;
}

async function ensureProvider(model, expected, role, user, label) {
  const fields = role === 'DOCTOR'
    ? { _id: fixtureObjectId('doctor-provider'), user_id: user._id, name: expected.name, specialty: 'General Physician', clinic_name: 'VaaniDoc Demo Clinic', qr_code_id: expected.code }
    : { _id: fixtureObjectId('laboratory-provider'), user_id: user._id, name: expected.name, qr_code_id: expected.code, location: 'Synthetic Demo Facility', contact_phone: normalizePhone(expected.phone), platform_approval_status: 'APPROVED' };
  const provider = await model.findOneAndUpdate(
    { qr_code_id: expected.code },
    { $setOnInsert: fields },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  assertProvider(label, provider, expected, user);
  return provider;
}

async function ensurePatient(model, expected, user) {
  const patient = await model.findOneAndUpdate(
    { patient_identifier: expected.identifier },
    { $setOnInsert: {
      _id: fixtureObjectId(`patient-${expected.identifier}`), user_id: user._id, name: expected.name,
      age: expected.age, date_of_birth: null, gender: expected.gender,
      phone: normalizePhone(expected.phone), patient_identifier: expected.identifier,
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  assertPatient(`patient ${expected.identifier}`, patient, expected, user);
  return patient;
}

async function ensureExact(model, filter, fields, label) {
  return model.findOneAndUpdate(
    filter,
    { $setOnInsert: fields },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).catch((error) => {
    if (error?.code === 11000) throw new Error(`Demo fixture collision for ${label}: an exact resource already has a different owner.`);
    throw error;
  });
}

async function resetOwnedFixture({ models, patient, laboratory, order, grant }) {
  const { LabObservation, ReportFile, DiagnosticReport, LabAccessGrant, DiagnosticOrder, Encounter } = models;
  const reports = await DiagnosticReport.find({
    _id: { $in: grant.report_id || grant.published_report_id ? [grant.report_id || grant.published_report_id] : [] },
    patient_id: patient._id,
    laboratory_id: laboratory._id,
    diagnostic_order_id: order._id,
    lab_access_grant_id: grant._id,
  });
  const reportIds = reports.map((report) => report._id);
  if (reportIds.length) {
    const files = await ReportFile.find({ report_id: { $in: reportIds } });
    for (const file of files) await removeOriginalPdf(file).catch(() => {});
    await LabObservation.deleteMany({ report_id: { $in: reportIds } });
    await ReportFile.deleteMany({ report_id: { $in: reportIds } });
    await DiagnosticReport.deleteMany({ _id: { $in: reportIds } });
  }
  await LabAccessGrant.updateOne(
    { _id: grant._id, patient_id: patient._id, laboratory_id: laboratory._id, diagnostic_order_id: order._id },
    { $set: { status: 'ACTIVE', report_id: null, published_report_id: null } },
  );
  await DiagnosticOrder.updateOne(
    { _id: order._id, patient_id: patient._id, doctor_id: order.doctor_id, encounter_id: order.encounter_id },
    { $set: { status: 'ORDERED' } },
  );
  await Encounter.updateOne(
    { _id: order.encounter_id, patient_id: patient._id, doctor_id: order.doctor_id },
    { $set: { status: 'OPEN', queue_status: 'IN_CONSULTATION' } },
  );
}

async function seedDemoData({
  confirmDemo = false,
  reset = false,
  connect = false,
  mongoUri = MONGO_URI,
  models = DEFAULT_MODELS,
  db = mongoose,
} = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed refused when NODE_ENV=production.');
  if (!confirmDemo) throw new Error('Demo seed is opt-in. Re-run with --confirm-demo.');
  if (reset && !confirmDemo) throw new Error('Demo reset requires --confirm-demo.');
  if (CATALOG.synthetic !== true || CATALOG.schemaVersion !== 1) throw new Error('Unsupported synthetic demo catalog.');

  if (connect) {
    await db.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  }
  await preflight(models);
  const doctorUser = await ensureUser(models.User, CATALOG.doctor, 'DOCTOR', 'doctor-user');
  const doctor = await ensureProvider(models.Doctor, CATALOG.doctor, 'DOCTOR', doctorUser, 'doctor');
  const laboratoryUser = await ensureUser(models.User, CATALOG.laboratory, 'LABORATORY', 'laboratory-user');
  const laboratory = await ensureProvider(models.Laboratory, CATALOG.laboratory, 'LABORATORY', laboratoryUser, 'laboratory');

  const seeded = [];
  for (const definition of CATALOG.patients) {
    const patientUser = await ensureUser(models.User, definition, 'PATIENT', `patient-user-${definition.identifier}`);
    const patient = await ensurePatient(models.Patient, definition, patientUser);
    const encounter = await ensureExact(models.Encounter,
      { patient_id: patient._id, doctor_id: doctor._id },
      { _id: fixtureObjectId(`encounter-${definition.identifier}`), patient_id: patient._id, doctor_id: doctor._id, visit_type: 'NEW', status: 'OPEN', queue_status: 'IN_CONSULTATION', queue_number: 1 },
      `encounter ${definition.identifier}`);
    await ensureExact(models.SymptomIntake, { encounter_id: encounter._id }, {
      _id: fixtureObjectId(`intake-${definition.identifier}`), encounter_id: encounter._id, patient_id: patient._id,
      input_mode: 'TEXT', transcript: 'Synthetic demonstration intake for a routine blood report.',
      chief_complaint: 'Routine health check', duration: '1 day', symptoms: [],
      structured_data: { chief_complaint: 'Routine health check', duration: '1 day', symptoms: [] }, confirmed_at: new Date('2026-01-01T00:00:00.000Z'),
    }, `symptom intake ${definition.identifier}`);
    const order = await ensureExact(models.DiagnosticOrder,
      { encounter_id: encounter._id, patient_id: patient._id, doctor_id: doctor._id },
      { _id: fixtureObjectId(`order-${definition.identifier}`), encounter_id: encounter._id, patient_id: patient._id, doctor_id: doctor._id, test_type: 'CBC', clinical_notes: `Synthetic demo fixture: upload ${definition.report.file}`, status: 'ORDERED' },
      `diagnostic order ${definition.identifier}`);
    const grant = await ensureExact(models.LabAccessGrant,
      { patient_id: patient._id, laboratory_id: laboratory._id, diagnostic_order_id: order._id },
      { _id: fixtureObjectId(`grant-${definition.identifier}`), patient_id: patient._id, laboratory_id: laboratory._id, diagnostic_order_id: order._id, status: 'ACTIVE', shared_fields: SHARED_FIELDS },
      `lab grant ${definition.identifier}`);
    if (reset) await resetOwnedFixture({ models, patient, laboratory, order, grant });
    seeded.push({ identifier: definition.identifier, report: definition.report.file, grantStatus: grant.status, orderStatus: order.status });
  }
  return { fixtureSet: CATALOG.fixtureSet, patientCount: seeded.length, reset, patients: seeded };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const reset = args.has('--reset');
  try {
    const result = await seedDemoData({ confirmDemo: args.has('--confirm-demo'), reset, connect: true });
    console.log(`Synthetic demo fixture ready: ${result.patientCount} catalog patients; existing published/expired lifecycle state was preserved${reset ? ' except for explicitly reset owned fixture resources' : ''}.`);
  } catch (error) {
    console.error(`Demo seed refused or failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
  }
}

module.exports = {
  CATALOG,
  fixtureObjectId,
  preflight,
  seedDemoData,
};

if (require.main === module) main();
