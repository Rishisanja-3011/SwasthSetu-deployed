const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const models = require('../src/models');
const firebaseAuth = require('../src/services/firebaseAuth');
const authRouter = require('../src/routes/authRoutes');
const { verifyToken } = require('../src/security/tokens');

const USER_ID = '000000000000000000000101';
const PATIENT_ID = '000000000000000000000201';
const PROVIDER_ID = '000000000000000000000301';

function request(server, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      method,
      path: pathname,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let result = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { result += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(result) }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function startAuthServer(t) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

function mockAuthState(t) {
  const state = { users: [], patients: [], pending: [] };
  const provider = {
    _id: PROVIDER_ID,
    name: 'Dr. Test',
    specialty: 'General Physician',
    clinic_name: 'Test Clinic',
    qr_code_id: 'DOC-TEST',
  };

  t.mock.method(firebaseAuth, 'verifyFirebaseIdToken', async () => ({
    uid: 'firebase-user-123',
    phone_number: '+1 (555) 123-4567',
  }));
  t.mock.method(models.User, 'findOne', async (filter) => {
    if (filter.phone) return state.users.find((user) => user.phone === filter.phone) || null;
    if (filter.auth_provider_id) return state.users.find((user) => user.auth_provider_id === filter.auth_provider_id) || null;
    return null;
  });
  t.mock.method(models.User, 'create', async (fields) => {
    const user = { _id: USER_ID, ...fields };
    state.users.push(user);
    return user;
  });
  t.mock.method(models.Patient, 'findOne', async (filter) => (
    filter.phone
      ? state.patients.find((patient) => patient.phone === filter.phone) || null
      : null
  ));
  t.mock.method(models.Patient, 'exists', async () => null);
  t.mock.method(models.Patient, 'create', async (fields) => {
    const patient = { _id: PATIENT_ID, ...fields };
    state.patients.push(patient);
    return patient;
  });
  t.mock.method(models.Doctor, 'findOne', async (filter) => (
    filter.qr_code_id === provider.qr_code_id ? provider : null
  ));
  t.mock.method(models.Laboratory, 'findOne', async () => null);
  t.mock.method(models.PendingProviderVisit, 'create', async (fields) => {
    const pending = { ...fields, status: 'PENDING' };
    state.pending.push(pending);
    return pending;
  });
  t.mock.method(models.PendingProviderVisit, 'findOneAndUpdate', async (filter) => {
    const pending = state.pending.find((item) => (
      item.login_attempt_id === filter.login_attempt_id && item.status === filter.status
    ));
    if (!pending) return null;
    pending.status = 'CONSUMED';
    pending.consumed_at = new Date();
    return pending;
  });

  return { state, provider };
}

test('Firebase registration preserves provider context and stores the verified UID', async (t) => {
  const { state } = mockAuthState(t);
  const server = await startAuthServer(t);

  const exchange = await request(server, 'POST', '/api/auth/patient/firebase/exchange', {
    id_token: 'verified-firebase-id-token',
    provider_code: 'DOC-TEST',
  });

  assert.equal(exchange.status, 200);
  assert.equal(exchange.body.registration_required, true);
  assert.equal(exchange.body.pending_provider.provider_code, 'DOC-TEST');
  assert.equal(state.pending.length, 1);

  const registration = verifyToken(exchange.body.registration_token, 'PATIENT_REGISTRATION');
  assert.equal(registration.sub, '+15551234567');
  assert.equal(registration.auth_provider_id, 'firebase-user-123');
  assert.equal(registration.firebase_uid, 'firebase-user-123');
  assert.equal(registration.exp - registration.iat, 10 * 60);

  const registered = await request(server, 'POST', '/api/auth/patient/register', {
    registration_token: exchange.body.registration_token,
    name: 'Firebase Patient',
    age: 30,
    gender: 'Female',
  });

  assert.equal(registered.status, 201);
  assert.equal(state.users[0].auth_provider_id, 'firebase-user-123');
  assert.equal(state.users[0].phone, '+15551234567');
  assert.equal(state.pending[0].status, 'CONSUMED');
  assert.equal(verifyToken(registered.body.access_token).role, 'PATIENT');
});

test('Firebase exchange returns a normal patient session for an existing patient', async (t) => {
  const { state } = mockAuthState(t);
  state.users.push({ _id: USER_ID, role: 'PATIENT', phone: '+15551234567' });
  state.patients.push({
    _id: PATIENT_ID,
    user_id: USER_ID,
    patient_identifier: 'PX123456',
    name: 'Existing Patient',
    phone: '+15551234567',
    gender: 'Other',
  });
  const server = await startAuthServer(t);

  const result = await request(server, 'POST', '/api/auth/patient/firebase/exchange', {
    id_token: 'verified-firebase-id-token',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.registration_required, false);
  assert.equal(result.body.patient.id, PATIENT_ID);
  assert.equal(verifyToken(result.body.access_token).sub, USER_ID);
  assert.equal(state.pending.length, 0);
});

test('Firebase exchange rejects missing tokens and provider-account phone conflicts', async (t) => {
  const server = await startAuthServer(t);
  const missingToken = await request(server, 'POST', '/api/auth/patient/firebase/exchange', {});
  assert.equal(missingToken.status, 400);
  assert.equal(missingToken.body.error, 'FIREBASE_ID_TOKEN_REQUIRED');

  const { state } = mockAuthState(t);
  state.users.push({ _id: USER_ID, role: 'DOCTOR', phone: '+15551234567' });
  const conflict = await request(server, 'POST', '/api/auth/patient/firebase/exchange', {
    id_token: 'verified-firebase-id-token',
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, 'PHONE_ALREADY_REGISTERED_FOR_PROVIDER');
});

test('Firebase Admin configuration rejects missing and malformed credentials', () => {
  assert.throws(
    () => firebaseAuth.getFirebaseConfig({}),
    (error) => error.code === 'FIREBASE_AUTH_CONFIG_MISSING',
  );
  assert.throws(
    () => firebaseAuth.getFirebaseConfig({
      FIREBASE_PROJECT_ID: 'swasthsetu',
      FIREBASE_CLIENT_EMAIL: 'firebase-admin@example.com',
      FIREBASE_PRIVATE_KEY: 'not-a-private-key',
    }),
    (error) => error.code === 'FIREBASE_AUTH_CONFIG_INVALID',
  );
});
