'use strict';

// This is intentionally a standalone, opt-in integration workflow.  It never
// boots the production entrypoint because that module connects to its
// configured database and listens on its configured port as a side effect.
const crypto = require('crypto');
const dotenv = require('dotenv');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// The Atlas deployment used by this workflow limits database names to 38
// bytes. Keep the readable fixture prefix plus the 32-character random suffix
// within that deployment limit.
const DB_PREFIX = 'demo_';
const OWNER_COLLECTION = '__demo_test_owner';
const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const PDF_ROOT = path.join(REPOSITORY_ROOT, 'demo', 'reports');

class SmokeFailure extends Error {}

function assert(condition, message) {
  if (!condition) throw new SmokeFailure(message);
}

function asString(value) {
  return value === undefined || value === null ? '' : String(value);
}

function objectIdValue(value, label) {
  const id = value && typeof value === 'object' && value._id ? value._id : value;
  assert(id, `${label} did not include an id.`);
  return asString(id);
}

function referencedId(value) {
  return asString(value && typeof value === 'object' && value._id ? value._id : value);
}

function safeResponseCode(response) {
  const value = response?.payload?.error;
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,99}$/.test(value) ? value : '';
}

function safeFailureMessage(error) {
  // Never print arbitrary driver, Python, or application exception messages:
  // those may embed credentials, a URI, or the raw report. Our assertions have
  // explicit messages; external errors are identified by type/code only.
  if (error instanceof SmokeFailure) return error.message;
  const name = /^[A-Za-z]+Error$/.test(error?.name || '') ? error.name : 'Error';
  const code = /^(?:[A-Z_]{2,50}|\d{1,8})$/.test(String(error?.code || '')) ? ` (${error.code})` : '';
  return `${name}${code}; underlying message suppressed`;
}

function expectStatus(response, status, label) {
  if (response.status !== status) {
    const code = safeResponseCode(response);
    throw new SmokeFailure(`${label}: expected HTTP ${status}, got HTTP ${response.status}${code ? ` (${code})` : ''}.`);
  }
}

function expectSuccess(response, status, label) {
  expectStatus(response, status, label);
  assert(response.payload?.success === true, `${label}: response was not successful.`);
}

function uniqueRun() {
  const suffix = crypto.randomBytes(16).toString('hex');
  const dbName = `${DB_PREFIX}${suffix}`;
  return {
    dbName,
    storageRoot: path.join(os.tmpdir(), `${dbName}_${crypto.randomBytes(8).toString('hex')}`),
    ownsDatabase: false,
    ownsStorage: true,
    ownerToken: crypto.randomBytes(32).toString('hex'),
  };
}

function isOwnedDbName(dbName) {
  return typeof dbName === 'string'
    && /^demo_[a-f0-9]{32}$/.test(dbName);
}

function isOwnedStorageRoot(storageRoot, dbName) {
  return typeof storageRoot === 'string'
    && isOwnedDbName(dbName)
    && path.basename(storageRoot).startsWith(`${dbName}_`)
    && path.dirname(path.resolve(storageRoot)) === path.resolve(os.tmpdir());
}

function silenceApplicationConsole(context) {
  const original = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
  };

  // The OTP is captured only in memory.  All application logging is muted so
  // that OTPs, connection details, report text, and extraction diagnostics do
  // not appear in the smoke command's output.
  console.log = (...args) => {
    const line = args.map((item) => (typeof item === 'string' ? item : '')).join(' ');
    const match = line.match(/\[VaaniDoc OTP DEV\]\s+challenge=([^\s]+)\s+phone=[^\s]+\s+otp=(\d{6})(?:\s|$)/);
    if (match) context.otpByChallenge.set(match[1], match[2]);
  };
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};

  return () => {
    console.log = original.log;
    console.info = original.info;
    console.debug = original.debug;
    console.warn = original.warn;
    console.error = original.error;
  };
}

async function startApplication(context) {
  const express = require('express');
  const cors = require('cors');
  const authRoutes = require('../src/routes/authRoutes');
  const providerRoutes = require('../src/routes/providerRoutes');
  const patientRoutes = require('../src/routes/patientRoutes');
  const doctorRoutes = require('../src/routes/doctorRoutes');
  const labRoutes = require('../src/routes/labRoutes');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/providers', providerRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/doctor', doctorRoutes);
  app.use('/api/lab', labRoutes);
  // Catch otherwise-unhandled Express errors without its default stack logger.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(500).json({ success: false, error: 'UNHANDLED_APPLICATION_ERROR' });
  });

  context.server = await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
  const address = context.server.address();
  assert(address && typeof address === 'object' && address.port, 'The ephemeral loopback server did not expose a port.');
  context.baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopApplication(context) {
  if (!context.server) return;
  const server = context.server;
  context.server = null;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections?.();
  });
}

async function request(context, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body = options.formData;
  if (options.body !== undefined) {
    assert(!options.formData, 'Smoke request cannot contain both JSON and multipart data.');
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), context.requestTimeoutMs);
  try {
    response = await fetch(`${context.baseUrl}${pathname}`, {
      method: options.method || 'GET',
      headers,
      body,
      signal: controller.signal,
    });

    const bytes = Buffer.from(await response.arrayBuffer());
    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') && bytes.length) {
      try {
        payload = JSON.parse(bytes.toString('utf8'));
      } catch (error) {
        throw new SmokeFailure(`HTTP ${options.method || 'GET'} ${pathname} returned invalid JSON.`);
      }
    }

    return { status: response.status, payload, bytes, headers: response.headers };
  } catch (error) {
    if (error instanceof SmokeFailure) throw error;
    throw new SmokeFailure(`HTTP ${options.method || 'GET'} ${pathname} failed or timed out.`);
  } finally {
    clearTimeout(timeout);
  }
}

async function connectIsolatedDatabase(context, mongoose) {
  const mongoUri = process.env.MONGO_URI;
  assert(typeof mongoUri === 'string' && mongoUri.trim(), 'MONGO_URI must be configured in lab/server/.env or the environment.');
  assert(isOwnedDbName(context.dbName), 'Refusing to connect because the generated database name is not owned by this smoke run.');
  assert(mongoose.connection.readyState === 0, 'Demo smoke requires a fresh standalone Node process.');

  await mongoose.connect(mongoUri, {
    dbName: context.dbName,
    serverSelectionTimeoutMS: 10000,
  });

  const connectedName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  assert(connectedName === context.dbName, 'MongoDB did not connect to the generated isolated database.');
  const db = mongoose.connection.db;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  assert(collections.length === 0, 'Generated test database already contains collections; refusing to seed or clean it.');
  await db.createCollection(OWNER_COLLECTION);
  await db.collection(OWNER_COLLECTION).insertOne({ _id: context.ownerToken });
  context.ownsDatabase = true;
}

async function loadFixtureDocuments(context) {
  const {
    Doctor,
    DiagnosticOrder,
    LabAccessGrant,
    Laboratory,
    Patient,
    User,
    Encounter,
  } = context.models;
  const catalog = context.catalog;

  const doctorUser = await User.findOne({ phone: catalog.doctor.phone, role: 'DOCTOR' });
  const doctor = await Doctor.findOne({ qr_code_id: catalog.doctor.code, user_id: doctorUser?._id });
  const labUser = await User.findOne({ phone: catalog.laboratory.phone, role: 'LABORATORY' });
  const laboratory = await Laboratory.findOne({ qr_code_id: catalog.laboratory.code, user_id: labUser?._id });
  assert(doctorUser && doctor, 'The seeded demo doctor was not found by its catalog identity.');
  assert(labUser && laboratory, 'The seeded demo laboratory was not found by its catalog identity.');

  const patients = new Map();
  for (const definition of catalog.patients) {
    const patient = await Patient.findOne({ patient_identifier: definition.identifier, user_id: { $exists: true } });
    assert(patient, `The seeded patient ${definition.identifier} was not found.`);
    const encounter = await Encounter.findOne({ patient_id: patient._id, doctor_id: doctor._id }).sort({ created_at: 1 });
    const order = await DiagnosticOrder.findOne({
      patient_id: patient._id,
      doctor_id: doctor._id,
      encounter_id: encounter?._id,
      test_type: 'CBC',
    }).sort({ created_at: 1 });
    const grant = await LabAccessGrant.findOne({
      patient_id: patient._id,
      laboratory_id: laboratory._id,
      diagnostic_order_id: order?._id,
    });
    assert(encounter && order && grant, `The seeded workflow links for ${definition.identifier} were not found.`);
    assert(grant.status === 'ACTIVE' && !grant.published_report_id, `The fresh fixture grant for ${definition.identifier} is not active.`);
    patients.set(definition.identifier, { definition, patient, encounter, order, grant });
  }

  return { doctorUser, doctor, labUser, laboratory, patients };
}

async function providerLogin(context, providerCode, phone, providerType) {
  const response = await request(context, '/api/auth/provider/login', {
    method: 'POST',
    body: { provider_code: providerCode, phone, provider_type: providerType },
  });
  expectSuccess(response, 200, `${providerType} provider login`);
  assert(typeof response.payload.access_token === 'string' && response.payload.access_token, `${providerType} login did not return a session.`);
  return response.payload.access_token;
}

async function patientOtpLogin(context, definition, providerCode) {
  const requested = await request(context, '/api/auth/patient/request-otp', {
    method: 'POST',
    body: { phone: definition.phone, provider_code: providerCode },
  });
  expectSuccess(requested, 202, `patient OTP request for ${definition.identifier}`);
  const challengeId = objectIdValue(requested.payload.challenge_id, `patient OTP request for ${definition.identifier}`);
  const otp = context.otpByChallenge.get(challengeId);
  assert(/^\d{6}$/.test(otp || ''), `The development OTP for ${definition.identifier} was not captured in memory.`);

  const verified = await request(context, '/api/auth/patient/verify-otp', {
    method: 'POST',
    body: { challenge_id: challengeId, otp },
  });
  expectSuccess(verified, 200, `patient OTP verification for ${definition.identifier}`);
  assert(verified.payload.registration_required === false, `${definition.identifier} unexpectedly required registration.`);
  assert(typeof verified.payload.access_token === 'string' && verified.payload.access_token, `${definition.identifier} OTP verification did not return a session.`);
  return verified.payload.access_token;
}

async function registerOtherLaboratory(context) {
  const phone = `+9199${String(Date.now()).slice(-8)}`;
  const registered = await request(context, '/api/auth/laboratory/register', {
    method: 'POST',
    body: {
      name: 'SwasthSetu Isolation Test Laboratory',
      phone,
      location: 'Synthetic isolation fixture',
    },
  });
  expectSuccess(registered, 201, 'second laboratory registration');
  const providerCode = registered.payload.laboratory?.provider_code
    || registered.payload.laboratory?.qr_code_id;
  assert(providerCode, 'Second laboratory registration did not return a provider code.');

  const token = await providerLogin(context, providerCode, phone, 'LABORATORY');
  return { phone, providerCode, token };
}

function canonicalObservationName(observation) {
  return asString(observation?.test_name_normalized)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function assertExpectedFlags(observations, expectedFlags, label) {
  for (const [name, expectedFlag] of Object.entries(expectedFlags || {})) {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const observation = observations.find((item) => canonicalObservationName(item) === normalizedName);
    assert(observation, `${label}: expected the ${name} observation.`);
    assert(observation.flag === expectedFlag, `${label}: expected ${name} to be ${expectedFlag}.`);
  }
}

async function uploadCase(context, labToken, fixture) {
  const { definition, grant } = fixture;
  const bytes = await fs.readFile(path.join(PDF_ROOT, definition.report.file));
  const uploaded = await request(context, '/api/lab/generate-report', {
    method: 'POST',
    token: labToken,
    body: {
      grant_id: objectIdValue(grant._id, `${definition.identifier} grant`),
      file_name: definition.report.file,
      file_base64: bytes.toString('base64'),
      file_mime_type: 'application/pdf',
      technician: { name: 'Synthetic isolation operator' },
    },
  });
  expectSuccess(uploaded, 201, `upload ${definition.identifier}`);

  const expected = definition.report.expectedOutcome;
  const extraction = uploaded.payload.extraction || {};
  const reportPayload = uploaded.payload.report || {};
  const observations = uploaded.payload.observations || [];
  const reportId = objectIdValue(reportPayload._id, `upload ${definition.identifier} report`);
  assert(reportPayload.status === expected.uploadStatus, `upload ${definition.identifier}: unexpected report status.`);
  assert(extraction.validation?.status === expected.validationStatus, `upload ${definition.identifier}: unexpected validation status.`);
  assert(extraction.coverage?.status === expected.coverageStatus, `upload ${definition.identifier}: unexpected coverage status.`);
  assert(Number(extraction.validation?.tests_detected) === expected.testsDetected, `upload ${definition.identifier}: unexpected test count.`);
  assert(observations.length === expected.observations, `upload ${definition.identifier}: unexpected observation count.`);
  assert(observations.every((item) => item && item._id), `upload ${definition.identifier}: response observations must include persisted _id values.`);
  assert(Boolean(uploaded.payload.needs_review) === (expected.uploadStatus === 'NEEDS_REVIEW'), `upload ${definition.identifier}: unexpected review marker.`);
  assertExpectedFlags(observations, expected.flags, `upload ${definition.identifier}`);

  const persisted = await context.models.LabObservation.find({ report_id: reportId }).lean();
  assert(persisted.length === expected.observations, `upload ${definition.identifier}: persisted observation count differs from the response.`);
  assert(persisted.every((item) => item._id), `upload ${definition.identifier}: persisted observations are missing _id values.`);

  const report = await context.models.DiagnosticReport.findById(reportId).lean();
  const persistedGrant = await context.models.LabAccessGrant.findById(grant._id).lean();
  assert(report && asString(report.lab_access_grant_id) === asString(grant._id), `upload ${definition.identifier}: report/grant link was not persisted.`);
  assert(asString(persistedGrant?.report_id) === reportId, `upload ${definition.identifier}: grant report_id was not persisted.`);

  return {
    ...fixture,
    bytes,
    reportId,
    report,
    observations,
    persistedObservations: persisted,
  };
}

async function tryInvalidPdf(context, labToken, fixture) {
  const response = await request(context, '/api/lab/generate-report', {
    method: 'POST',
    token: labToken,
    body: {
      grant_id: objectIdValue(fixture.grant._id, 'invalid PDF grant'),
      file_name: 'not-a-pdf.pdf',
      file_base64: Buffer.from('this is not a PDF').toString('base64'),
      file_mime_type: 'application/pdf',
    },
  });
  expectStatus(response, 400, 'invalid PDF upload');
  assert(safeResponseCode(response) === 'ORIGINAL_REPORT_PDF_INVALID', 'invalid PDF upload returned the wrong error.');
  assert(!(await context.models.DiagnosticReport.exists({ lab_access_grant_id: fixture.grant._id })), 'invalid PDF upload created a report.');
  const grant = await context.models.LabAccessGrant.findById(fixture.grant._id).lean();
  assert(grant?.status === 'ACTIVE' && !grant.report_id, 'invalid PDF upload changed the grant.');
}

async function assertDuplicateUploadDenied(context, labToken, uploadedCase) {
  const beforeReport = await context.models.DiagnosticReport.findById(uploadedCase.reportId).lean();
  const beforeReportCount = await context.models.DiagnosticReport.countDocuments({ lab_access_grant_id: uploadedCase.grant._id });
  const beforeObservationCount = await context.models.LabObservation.countDocuments({ report_id: uploadedCase.reportId });
  const beforeGrant = await context.models.LabAccessGrant.findById(uploadedCase.grant._id).lean();
  assert(beforeReport, 'Duplicate upload fixture report was not persisted before retry.');
  assert(beforeGrant, 'Duplicate upload fixture grant was not persisted before retry.');

  const response = await request(context, '/api/lab/generate-report', {
    method: 'POST',
    token: labToken,
    body: {
      grant_id: objectIdValue(uploadedCase.grant._id, 'duplicate upload grant'),
      file_name: uploadedCase.definition.report.file,
      file_base64: uploadedCase.bytes.toString('base64'),
      file_mime_type: 'application/pdf',
    },
  });
  expectStatus(response, 409, 'duplicate report upload');
  assert(safeResponseCode(response) === 'REPORT_ALREADY_UPLOADED', 'duplicate report upload returned the wrong error.');

  const afterReport = await context.models.DiagnosticReport.findById(uploadedCase.reportId).lean();
  const afterReportCount = await context.models.DiagnosticReport.countDocuments({ lab_access_grant_id: uploadedCase.grant._id });
  const afterObservationCount = await context.models.LabObservation.countDocuments({ report_id: uploadedCase.reportId });
  const afterGrant = await context.models.LabAccessGrant.findById(uploadedCase.grant._id).lean();
  assert(afterReport && asString(afterReport._id) === asString(beforeReport._id), 'Duplicate upload changed the original report.');
  assert(afterReportCount === beforeReportCount && afterReportCount === 1, 'Duplicate report upload created a second report.');
  assert(afterReport.report_hash === beforeReport.report_hash, 'Duplicate upload changed the original report hash.');
  assert(afterObservationCount === beforeObservationCount, 'Duplicate upload changed the original observation count.');
  assert(afterGrant && asString(afterGrant.report_id) === asString(beforeGrant.report_id), 'Duplicate upload changed the grant report pointer.');
  assert(asString(afterGrant.published_report_id) === asString(beforeGrant.published_report_id), 'Duplicate upload changed the grant publication pointer.');
}

async function assertActiveDenials(context, labToken, otherLabToken, patientToken, grantId) {
  const identityPath = `/api/lab/grant/${grantId}/patient-identity`;
  const unauthenticated = await request(context, identityPath);
  expectStatus(unauthenticated, 401, 'unauthenticated lab identity access');

  const otherLab = await request(context, identityPath, { token: otherLabToken });
  expectStatus(otherLab, 404, 'other laboratory identity access');

  const otherPatientRole = await request(context, identityPath, { token: patientToken });
  expectStatus(otherPatientRole, 403, 'patient access to laboratory identity route');

  const unauthenticatedPatient = await request(context, '/api/patient/reports');
  expectStatus(unauthenticatedPatient, 401, 'unauthenticated patient report list');

  const unauthenticatedLabReport = await request(context, `/api/lab/report/${grantId}`);
  expectStatus(unauthenticatedLabReport, 401, 'unauthenticated laboratory report access');
}

async function assertUnpublishedAccessBoundaries(context, normalCase, labToken, otherLabToken, otherPatientToken) {
  const reportPath = `/api/lab/report/${normalCase.reportId}`;
  const labReport = await request(context, reportPath, { token: labToken });
  expectSuccess(labReport, 200, 'laboratory active unpublished report access');

  const otherLab = await request(context, reportPath, { token: otherLabToken });
  expectStatus(otherLab, 404, 'other laboratory unpublished report access');

  const unauthenticated = await request(context, reportPath);
  expectStatus(unauthenticated, 401, 'unauthenticated unpublished report access');

  const otherPatient = await request(context, `/api/patient/reports/${normalCase.reportId}`, { token: otherPatientToken });
  expectStatus(otherPatient, 404, 'other patient unpublished report access');

  const patientList = await request(context, '/api/patient/reports', { token: normalCase.patientToken });
  expectSuccess(patientList, 200, 'patient unpublished report list');
  assert(patientList.payload.reports.length === 0, 'An unpublished report was visible to the patient.');
}

async function publishCase(context, labToken, uploadedCase, label) {
  const published = await request(context, `/api/lab/report/${uploadedCase.reportId}/publish`, {
    method: 'POST',
    token: labToken,
    body: {
      grant_id: objectIdValue(uploadedCase.grant._id, `${label} grant`),
      sign_off_notes: `Synthetic ${label} publication sign-off.`,
    },
  });
  expectSuccess(published, 200, `publish ${label}`);
  assert(published.payload.report?.status === 'PUBLISHED', `publish ${label}: report was not published.`);
  assert(published.payload.grant_status === 'EXPIRED' && published.payload.access_expired === true, `publish ${label}: bounded access did not expire.`);

  const report = await context.models.DiagnosticReport.findById(uploadedCase.reportId).lean();
  const grant = await context.models.LabAccessGrant.findById(uploadedCase.grant._id).lean();
  assert(report?.status === 'PUBLISHED', `publish ${label}: persisted report was not published.`);
  assert(grant?.status === 'EXPIRED' && asString(grant.published_report_id) === uploadedCase.reportId, `publish ${label}: persisted grant was not expired.`);
  return { ...uploadedCase, report, grant };
}

async function assertExpiredLabAccess(context, labToken, uploadedCase, label) {
  const grantPath = `/api/lab/grant/${uploadedCase.grant._id}/patient-identity`;
  const identity = await request(context, grantPath, { token: labToken });
  expectStatus(identity, 403, `${label} expired identity access`);
  assert(safeResponseCode(identity) === 'BOUNDED_ACCESS_EXPIRED', `${label} expired identity access returned the wrong error.`);

  for (const suffix of ['', '/raw', '/original']) {
    const report = await request(context, `/api/lab/report/${uploadedCase.reportId}${suffix}`, { token: labToken });
    expectStatus(report, 403, `${label} expired report access${suffix}`);
    assert(safeResponseCode(report) === 'BOUNDED_ACCESS_EXPIRED', `${label} expired report access${suffix} returned the wrong error.`);
  }
}

async function assertPatientPublishedReport(context, uploadedCase, label) {
  const list = await request(context, '/api/patient/reports', { token: uploadedCase.patientToken });
  expectSuccess(list, 200, `${label} patient report list`);
  const listed = list.payload.reports.find((item) => asString(item._id) === uploadedCase.reportId);
  assert(listed, `${label} published report was not listed for its patient.`);
  assert(listed.original_file_available === true, `${label} original file was not advertised to the patient.`);

  const detail = await request(context, `/api/patient/reports/${uploadedCase.reportId}`, { token: uploadedCase.patientToken });
  expectSuccess(detail, 200, `${label} patient report detail`);
  assert(asString(detail.payload.report?._id) === uploadedCase.reportId, `${label} patient detail returned another report.`);
  assert(detail.payload.report.report_hash, `${label} patient detail did not include the original file hash.`);

  const original = await request(context, `/api/patient/reports/${uploadedCase.reportId}/original`, { token: uploadedCase.patientToken });
  expectStatus(original, 200, `${label} patient original download`);
  assert(Buffer.compare(original.bytes, uploadedCase.bytes) === 0, `${label} patient download did not match the uploaded PDF bytes.`);
}

async function assertNormalTimeline(context, uploadedCase) {
  const timeline = await request(context, '/api/patient/timeline', { token: uploadedCase.patientToken });
  expectSuccess(timeline, 200, 'patient consultation timeline');
  const consultation = timeline.payload.consultations.find((item) => (
    asString(item.details?.encounter_id) === asString(uploadedCase.encounter._id)
  ));
  assert(consultation, 'The report consultation was not present in the patient timeline.');
  const linkedOrder = (consultation.details.diagnostic_orders || []).find((item) => (
    asString(item.id || item._id) === asString(uploadedCase.order._id)
  ));
  assert(linkedOrder, 'The report diagnostic order was not linked in the patient timeline.');
  assert(asString(linkedOrder.report?.id) === uploadedCase.reportId, 'The published report was not linked to its consultation timeline order.');
}

async function assertDoctorOrderAndPatientNotification(context, doctorToken, fixture, patientToken) {
  const response = await request(context, `/api/doctor/encounter/${fixture.encounter._id}/order-diagnostic`, {
    method: 'POST',
    token: doctorToken,
    body: { test_type: 'CBC', clinical_notes: 'Synthetic integration order notification check.' },
  });
  expectSuccess(response, 201, 'doctor diagnostic order creation');
  const orderId = objectIdValue(response.payload.order?._id, 'doctor diagnostic order creation');
  assert(response.payload.order.status === 'ORDERED', 'Doctor diagnostic order was not left ORDERED.');
  assert(await context.models.DiagnosticOrder.exists({ _id: orderId, patient_id: fixture.patient._id, doctor_id: fixture.order.doctor_id }), 'Doctor diagnostic order was not persisted.');

  const notifications = await request(context, '/api/patient/notifications', { token: patientToken });
  expectSuccess(notifications, 200, 'patient diagnostic order notifications');
  const notification = (notifications.payload.notifications || []).find((item) => (
    referencedId(item.diagnostic_order_id) === orderId
  ));
  assert(notification, 'The patient did not receive the diagnostic order notification.');
  return { orderId, notificationId: objectIdValue(notification._id, 'diagnostic order notification') };
}

async function assertBlockedPublication(context, labToken, uploadedCase, label, allowedCodes) {
  const response = await request(context, `/api/lab/report/${uploadedCase.reportId}/publish`, {
    method: 'POST',
    token: labToken,
    body: { grant_id: objectIdValue(uploadedCase.grant._id, `${label} grant`) },
  });
  expectStatus(response, 409, `${label} direct publication block`);
  assert(allowedCodes.includes(safeResponseCode(response)), `${label} direct publication returned an unexpected error.`);
}

async function editObservation(context, labToken, uploadedCase, observation, changes, label) {
  const response = await request(context, `/api/lab/observation/${observation._id}`, {
    method: 'PUT',
    token: labToken,
    body: {
      value: changes.value ?? observation.value,
      unit: changes.unit ?? observation.unit,
      reference_low: changes.reference_low === undefined ? observation.reference_low : changes.reference_low,
      reference_high: changes.reference_high === undefined ? observation.reference_high : changes.reference_high,
      edit_reason: changes.edit_reason,
    },
  });
  expectSuccess(response, 200, label);
  assert(asString(response.payload.observation?._id) === asString(observation._id), `${label}: response observation id changed.`);
  const linkedReport = response.payload.report;
  assert(linkedReport, `${label}: response did not include report metadata.`);
  assert(asString(linkedReport._id) === uploadedCase.reportId, `${label}: response report id was not linked to the uploaded report.`);
  assert(asString(linkedReport.lab_access_grant_id) === asString(uploadedCase.grant._id), `${label}: response report grant link was incorrect.`);
  assert(linkedReport.status === response.payload.report_status, `${label}: response report status metadata was inconsistent.`);
  assert(linkedReport.test_type === uploadedCase.report.test_type, `${label}: response report test type changed.`);
  assert(linkedReport.original_file_name === uploadedCase.report.original_file_name, `${label}: response report file metadata changed.`);
  assert(linkedReport.report_hash === uploadedCase.report.report_hash, `${label}: response report hash changed.`);
  return response;
}

async function assertInvalidCorrectionRejected(context, labToken, uploadedCase, observation) {
  const beforeObservation = await context.models.LabObservation.findById(observation._id).lean();
  const beforeReport = await context.models.DiagnosticReport.findById(uploadedCase.reportId).lean();
  const beforeAuditCount = await context.models.AuditEvent.countDocuments({
    resource_type: 'DiagnosticReport',
    resource_id: uploadedCase.reportId,
    action: 'LAB_OBSERVATION_MANUAL_CORRECTION',
  });
  assert(beforeObservation && beforeReport, 'Invalid correction fixture state was not persisted.');

  const response = await request(context, `/api/lab/observation/${observation._id}`, {
    method: 'PUT',
    token: labToken,
    body: {
      value: beforeObservation.value,
      unit: beforeObservation.unit,
      reference_low: 400000,
      reference_high: 150000,
      edit_reason: 'Synthetic invalid range must be rejected.',
    },
  });
  expectStatus(response, 400, 'invalid observation correction');
  assert(safeResponseCode(response) === 'INVALID_REFERENCE_RANGE', 'Invalid observation correction returned the wrong error.');

  const afterObservation = await context.models.LabObservation.findById(observation._id).lean();
  const afterReport = await context.models.DiagnosticReport.findById(uploadedCase.reportId).lean();
  const afterAuditCount = await context.models.AuditEvent.countDocuments({
    resource_type: 'DiagnosticReport',
    resource_id: uploadedCase.reportId,
    action: 'LAB_OBSERVATION_MANUAL_CORRECTION',
  });
  assert(afterObservation, 'Invalid observation correction removed the observation.');
  for (const field of ['value', 'unit', 'reference_low', 'reference_high', 'flag', 'validation_status', 'review_reason', 'manually_edited']) {
    assert(afterObservation[field] === beforeObservation[field], `Invalid observation correction mutated ${field}.`);
  }
  assert(afterReport?.status === beforeReport.status, 'Invalid observation correction changed report status.');
  assert(afterReport?.extraction_review_required === beforeReport.extraction_review_required, 'Invalid observation correction changed report review state.');
  assert(JSON.stringify(afterReport?.publish_blocking_reasons || []) === JSON.stringify(beforeReport.publish_blocking_reasons || []), 'Invalid observation correction changed report blockers.');
  assert(afterReport?.workflow_revision === beforeReport.workflow_revision, 'Invalid observation correction changed report workflow revision.');
  assert(afterAuditCount === beforeAuditCount, 'Invalid observation correction committed an audit event.');
}

async function clearObservationReview(context, labToken, uploadedCase) {
  const platelet = uploadedCase.observations.find((item) => canonicalObservationName(item) === 'platelets');
  assert(platelet, 'Review fixture did not return a platelet observation.');
  await assertInvalidCorrectionRejected(context, labToken, uploadedCase, platelet);
  const editReason = 'Synthetic analyzer rerun confirms the platelet value.';
  const edited = await editObservation(context, labToken, uploadedCase, platelet, {
    value: 250000,
    unit: '/cmm',
    reference_low: 150000,
    reference_high: 400000,
    edit_reason: editReason,
  }, 'review observation correction');
  assert(edited.payload.report_status === 'PROCESSING', 'Review observation correction did not clear its observation-level block.');
  assert(edited.payload.extraction_review_required === false, 'Review observation correction left report review required.');
  assert((edited.payload.publish_blocking_reasons || []).length === 0, 'Review observation correction left observation blockers.');

  const persistedObservation = await context.models.LabObservation.findById(platelet._id).lean();
  const persistedReport = await context.models.DiagnosticReport.findById(uploadedCase.reportId).lean();
  const responseObservation = edited.payload.observation;
  const responseReport = edited.payload.report;
  assert(persistedObservation && persistedReport, 'Review observation correction was not persisted.');
  for (const field of ['_id', 'value', 'unit', 'reference_low', 'reference_high', 'flag', 'validation_status', 'review_reason', 'manually_edited']) {
    assert(asString(persistedObservation[field]) === asString(responseObservation[field]), `Review observation correction persisted ${field} differently from the response.`);
  }
  assert(asString(persistedReport._id) === asString(responseReport._id), 'Review observation correction persisted another report.');
  assert(asString(persistedReport.lab_access_grant_id) === asString(responseReport.lab_access_grant_id), 'Review observation correction persisted the wrong report grant link.');
  assert(persistedReport.status === responseReport.status, 'Review observation correction persisted a different report status.');
  assert(persistedReport.extraction_review_required === responseReport.extraction_review_required, 'Review observation correction persisted a different report review state.');
  assert(JSON.stringify(persistedReport.publish_blocking_reasons || []) === JSON.stringify(responseReport.publish_blocking_reasons || []), 'Review observation correction persisted different report blockers.');
  assert(persistedReport.original_file_name === responseReport.original_file_name, 'Review observation correction changed the report file metadata.');
  assert(persistedReport.report_hash === responseReport.report_hash, 'Review observation correction changed the report hash.');

  const auditEvent = await context.models.AuditEvent.findOne({
    resource_type: 'DiagnosticReport',
    resource_id: uploadedCase.reportId,
    action: 'LAB_OBSERVATION_MANUAL_CORRECTION',
  }).sort({ timestamp: -1 }).lean();
  assert(auditEvent?.outcome === 'SUCCESS', 'Review observation correction audit was not committed successfully.');
  assert(asString(auditEvent.details?.observation_id) === asString(platelet._id), 'Review observation correction audit referenced another observation.');
  assert(auditEvent.details?.edit_reason === editReason, 'Review observation correction audit did not retain the edit reason.');
}

async function assertStructuralBlockSurvivesEdits(context, labToken, uploadedCase, label, blocker) {
  for (const observation of uploadedCase.observations) {
    await editObservation(context, labToken, uploadedCase, observation, {
      edit_reason: `Synthetic ${label} confirmation; no structural data was added.`,
    }, `${label} observation confirmation`);
  }

  const report = await context.models.DiagnosticReport.findById(uploadedCase.reportId).lean();
  assert(report?.status === 'NEEDS_REVIEW', `${label}: marking observations OK unexpectedly made the report publishable.`);
  assert((report.publish_blocking_reasons || []).includes(blocker), `${label}: structural blocker ${blocker} was cleared by observation edits.`);
  await assertBlockedPublication(context, labToken, uploadedCase, label, ['EXTRACTION_REVIEW_REQUIRED', 'PUBLICATION_BLOCKED']);
}

async function assertNormalRerunPreservesExpiry(context, seedDemoData, normalCase) {
  await seedDemoData({ confirmDemo: true, reset: false, connect: false });
  const report = await context.models.DiagnosticReport.findById(normalCase.reportId).lean();
  const grant = await context.models.LabAccessGrant.findById(normalCase.grant._id).lean();
  assert(report?.status === 'PUBLISHED', 'A normal seed rerun changed the published report state.');
  assert(grant?.status === 'EXPIRED' && asString(grant.published_report_id) === normalCase.reportId, 'A normal seed rerun reopened an expired grant.');
}

async function assertExplicitResetOnlyFixtures(context, seedDemoData, normalCase, createdOrderId) {
  await seedDemoData({ confirmDemo: true, reset: true, connect: false });
  const resetGrant = await context.models.LabAccessGrant.findById(normalCase.grant._id).lean();
  const resetReport = await context.models.DiagnosticReport.findById(normalCase.reportId).lean();
  assert(resetGrant?.status === 'ACTIVE' && !resetGrant.published_report_id && !resetGrant.report_id, 'Explicit fixture reset did not reset the owned demo grant.');
  assert(!resetReport, 'Explicit fixture reset did not remove the owned demo report.');
  assert(await context.models.DiagnosticOrder.exists({ _id: createdOrderId }), 'Explicit fixture reset removed a non-fixture diagnostic order.');
}

async function runDemo(consoleContext = null) {
  assert(String(process.env.NODE_ENV || '').toLowerCase() !== 'production', 'Demo integration refused when NODE_ENV=production.');
  assert(process.argv.slice(2).includes('--confirm-demo'), 'Demo integration is opt-in. Re-run with --confirm-demo.');

  const context = {
    ...uniqueRun(),
    server: null,
    baseUrl: null,
    requestTimeoutMs: (() => {
      const extractionTimeout = Number(process.env.EXTRACTION_TIMEOUT_MS || 180000);
      return Number.isFinite(extractionTimeout) ? Math.max(300000, extractionTimeout + 30000) : 300000;
    })(),
    otpByChallenge: consoleContext?.otpByChallenge || new Map(),
  };
  const previousStorageRoot = process.env.REPORT_STORAGE_ROOT;
  process.env.REPORT_STORAGE_ROOT = context.storageRoot;
  let mongoose;

  try {
    // Connect before loading the Mongoose model registry. This lets the empty
    // database ownership check run before Mongoose auto-creates model
    // collections on connection open.
    mongoose = require('mongoose');
    await connectIsolatedDatabase(context, mongoose);

    // These modules are required only after the isolated report root is set.
    const models = require('../src/models');
    const { CATALOG, seedDemoData } = require('./seedDemoData');
    context.models = models;
    context.catalog = CATALOG;

    const seeded = await seedDemoData({ confirmDemo: true, connect: false });
    assert(seeded.patientCount === 6 && CATALOG.patients.length === 6, 'The synthetic catalog did not seed exactly six patients.');
    await startApplication(context);

    const fixtures = await loadFixtureDocuments(context);
    const doctorToken = await providerLogin(context, CATALOG.doctor.code, CATALOG.doctor.phone, 'DOCTOR');
    const labToken = await providerLogin(context, CATALOG.laboratory.code, CATALOG.laboratory.phone, 'LABORATORY');
    const otherLab = await registerOtherLaboratory(context);

    const normalFixture = fixtures.patients.get('PXDEMO001');
    const reviewFixture = fixtures.patients.get('PXDEMO002');
    const incompleteFixture = fixtures.patients.get('PXDEMO003');
    const highLowFixture = fixtures.patients.get('PXDEMO005');
    const missingReferenceFixture = fixtures.patients.get('PXDEMO006');
    const otherPatientFixture = fixtures.patients.get('PXDEMO004');
    assert(normalFixture && reviewFixture && incompleteFixture && highLowFixture && missingReferenceFixture && otherPatientFixture, 'The six catalog fixtures were not all addressable by identifier.');

    const normalPatientToken = await patientOtpLogin(context, normalFixture.definition, CATALOG.doctor.code);
    const otherPatientToken = await patientOtpLogin(context, otherPatientFixture.definition, CATALOG.doctor.code);
    const notificationPatientToken = await patientOtpLogin(context, reviewFixture.definition, CATALOG.doctor.code);
    const reviewWithAuth = { ...reviewFixture, patientToken: notificationPatientToken };
    const doctorNotification = await assertDoctorOrderAndPatientNotification(
      context,
      doctorToken,
      reviewFixture,
      notificationPatientToken,
    );

    const normalWithAuth = { ...normalFixture, patientToken: normalPatientToken };
    await tryInvalidPdf(context, labToken, normalWithAuth);
    await assertActiveDenials(
      context,
      labToken,
      otherLab.token,
      otherPatientToken,
      objectIdValue(normalFixture.grant._id, 'normal grant'),
    );

    const cases = {};
    for (const fixture of [normalWithAuth, reviewWithAuth, incompleteFixture, otherPatientFixture, highLowFixture, missingReferenceFixture]) {
      if (!fixture.patientToken && fixture === otherPatientFixture) fixture.patientToken = otherPatientToken;
      cases[fixture.definition.identifier] = await uploadCase(context, labToken, fixture);
    }

    const normalCase = cases.PXDEMO001;
    const reviewCase = cases.PXDEMO002;
    const incompleteCase = cases.PXDEMO003;
    const otherPatientCase = cases.PXDEMO004;
    const highLowCase = cases.PXDEMO005;
    const missingReferenceCase = cases.PXDEMO006;
    assert(normalCase && reviewCase && incompleteCase && otherPatientCase && highLowCase && missingReferenceCase, 'The six uploaded cases were not all returned by identifier.');

    await assertUnpublishedAccessBoundaries(context, normalCase, labToken, otherLab.token, otherPatientToken);
    await assertDuplicateUploadDenied(context, labToken, normalCase);

    const otherPatientReport = await request(context, `/api/patient/reports/${normalCase.reportId}`, { token: otherPatientToken });
    expectStatus(otherPatientReport, 404, 'other patient access to normal report');
    const unauthenticatedPatientReport = await request(context, `/api/patient/reports/${normalCase.reportId}`);
    expectStatus(unauthenticatedPatientReport, 401, 'unauthenticated access to normal report');

    cases.PXDEMO001 = await publishCase(context, labToken, normalCase, 'normal CBC');
    await assertPatientPublishedReport(context, cases.PXDEMO001, 'normal CBC');
    await assertNormalTimeline(context, cases.PXDEMO001);
    await assertExpiredLabAccess(context, labToken, cases.PXDEMO001, 'normal CBC');
    await assertNormalRerunPreservesExpiry(context, seedDemoData, cases.PXDEMO001);

    await assertBlockedPublication(context, labToken, reviewCase, 'review CBC before correction', [
      'EXTRACTION_REVIEW_REQUIRED',
      'PUBLICATION_BLOCKED',
    ]);
    await clearObservationReview(context, labToken, reviewCase);
    cases.PXDEMO002 = await publishCase(context, labToken, reviewCase, 'review CBC after correction');
    await assertPatientPublishedReport(context, cases.PXDEMO002, 'review CBC after correction');
    await assertExpiredLabAccess(context, labToken, cases.PXDEMO002, 'review CBC after correction');

    await assertBlockedPublication(context, labToken, incompleteCase, 'incomplete CBC', [
      'EXTRACTION_REVIEW_REQUIRED',
      'PUBLICATION_BLOCKED',
    ]);
    await assertStructuralBlockSurvivesEdits(context, labToken, incompleteCase, 'incomplete CBC', 'EXTRACTION_COVERAGE_INCOMPLETE');

    await assertBlockedPublication(context, labToken, missingReferenceCase, 'missing-reference CBC', [
      'EXTRACTION_REVIEW_REQUIRED',
      'PUBLICATION_BLOCKED',
    ]);
    await assertStructuralBlockSurvivesEdits(context, labToken, missingReferenceCase, 'missing-reference CBC', 'EXTRACTION_VALIDATION_PARTIAL');

    cases.PXDEMO005 = await publishCase(context, labToken, highLowCase, 'HIGH/LOW CBC');
    assert(cases.PXDEMO005.observations.some((item) => item.flag === 'HIGH'), 'HIGH/LOW CBC did not retain a HIGH flag.');
    assert(cases.PXDEMO005.observations.some((item) => item.flag === 'LOW'), 'HIGH/LOW CBC did not retain a LOW flag.');

    const { runPatientWorkflow } = require('./smokePatientWorkflow');
    const patientWorkflow = await runPatientWorkflow(context, {
      assert, expectStatus, expectSuccess, safeResponseCode, objectIdValue,
      referencedId, request, providerLogin, assertDoctorOrderAndPatientNotification,
    }, {
      fixture: normalFixture,
      patientToken: normalPatientToken,
      otherPatientToken,
      otherDoctorToken: doctorToken,
      laboratory: otherLab,
      otherLabToken: labToken,
    });
    // Reuse the normal synthetic PDF for a seventh upload, this time through
    // an API-created encounter/order and the patient's real consent grant.
    let consentCase = await uploadCase(context, otherLab.token, patientWorkflow.fixture);
    assert(referencedId(consentCase.report.diagnostic_order_id) === asString(patientWorkflow.fixture.order._id), 'Patient-consented upload lost its diagnostic order link.');
    consentCase = await publishCase(context, otherLab.token, consentCase, 'patient-consented CBC');
    await assertPatientPublishedReport(context, consentCase, 'patient-consented CBC');
    await assertNormalTimeline(context, consentCase);
    await assertExpiredLabAccess(context, otherLab.token, consentCase, 'patient-consented CBC');
    const completedOrder = await models.DiagnosticOrder.findById(patientWorkflow.fixture.order._id).lean();
    assert(completedOrder?.status === 'COMPLETED', 'Patient-consented report publication did not complete its diagnostic order.');

    await assertExplicitResetOnlyFixtures(context, seedDemoData, cases.PXDEMO001, doctorNotification.orderId);
    const preservedConsentGrant = await models.LabAccessGrant.findById(consentCase.grant._id).lean();
    assert(preservedConsentGrant?.status === 'EXPIRED' && referencedId(preservedConsentGrant.published_report_id) === consentCase.reportId, 'Fixture reset reopened or removed the API-created consent grant.');
    assert(await models.DiagnosticReport.exists({ _id: consentCase.reportId, status: 'PUBLISHED' }), 'Fixture reset removed the API-created workflow report.');
    assert(await models.Encounter.countDocuments({ _id: { $in: patientWorkflow.encounterIds }, status: 'CLOSED' }) === 2, 'Fixture reset changed API-created completed consultations.');
    await assertPatientPublishedReport(context, consentCase, 'patient-consented CBC after fixture reset');

    return {
      patientCount: CATALOG.patients.length,
      uploadedCases: Object.keys(cases).length + 1,
      publishedCases: 4,
      blockedStructuralCases: 2,
      notificationChecked: true,
      completedConsultations: patientWorkflow.completedConsultations,
      patientConsentChecked: true,
      skippedIntakeChecked: true,
      repeatedConfirmationChecked: true,
      externalTranscriptionCalled: false,
    };
  } finally {
    await stopApplication(context).catch(() => {});
    const generatedDb = context.ownsDatabase && isOwnedDbName(context.dbName);
    if (mongoose && generatedDb && mongoose.connection.readyState === 1) {
      const connectedName = mongoose.connection.db?.databaseName || mongoose.connection.name;
      if (connectedName === context.dbName) await mongoose.connection.db.dropDatabase().catch(() => {});
    }
    if (mongoose && mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
    if (context.ownsStorage && isOwnedStorageRoot(context.storageRoot, context.dbName)) {
      await fs.rm(context.storageRoot, { recursive: true, force: true }).catch(() => {});
    }
    if (previousStorageRoot === undefined) delete process.env.REPORT_STORAGE_ROOT;
    else process.env.REPORT_STORAGE_ROOT = previousStorageRoot;
  }
}

async function main() {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.error('Demo integration refused when NODE_ENV=production.');
    process.exitCode = 1;
    return;
  }
  if (!process.argv.slice(2).includes('--confirm-demo')) {
    console.error('Demo integration is opt-in. Re-run with --confirm-demo.');
    process.exitCode = 1;
    return;
  }

  let restoreConsole;
  const context = { otpByChallenge: new Map() };
  restoreConsole = silenceApplicationConsole(context);
  try {
    const result = await runDemo(context);
    restoreConsole();
    restoreConsole = null;
    console.log(`Demo integration passed: ${result.patientCount} catalog patients, ${result.uploadedCases} PDF uploads, ${result.publishedCases} published cases, ${result.blockedStructuralCases} structural publication blocks.`);
    console.log(`Patient workflow passed: ${result.completedConsultations} API-created completed consultations (text review and revisiting skip), ownership/repeated-confirm denials, patient-consented diagnostic order through publication, offline voice rejection checks.`);
  } catch (error) {
    if (restoreConsole) restoreConsole();
    restoreConsole = null;
    console.error(`Demo integration failed: ${safeFailureMessage(error)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  assert,
  isOwnedDbName,
  isOwnedStorageRoot,
  runDemo,
};
