const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const models = require('../src/models');
const { issueToken } = require('../src/security/tokens');
const { buildClinicalIntake } = require('../src/services/clinicalIntakeService');
const router = require('../src/routes/patientRoutes');

const patientId = '000000000000000000000001';
const encounterId = '000000000000000000000002';
const intakeId = '000000000000000000000003';
const userId = '000000000000000000000004';

function matches(document, filter) {
  return document && Object.entries(filter).every(([key, value]) => {
    const actual = document[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$ne' in value) return actual !== value.$ne;
      if ('$in' in value) return value.$in.includes(actual);
      if ('$exists' in value) return (actual !== undefined) === value.$exists;
    }
    if (value === null) return actual == null;
    return String(actual) === String(value);
  });
}

function applyUpdate(document, update) {
  const { save: _save, ...fields } = update.$set || update;
  Object.assign(document, structuredClone(fields));
  for (const [key, value] of Object.entries(update.$inc || {})) document[key] = (document[key] || 0) + value;
}

function draft() {
  return {
    _id: intakeId, encounter_id: encounterId, patient_id: patientId, __v: 0,
    input_mode: 'TEXT', transcript: 'I have fever', patient_confirmed: false,
    confirmed_at: null, updated_at: new Date('2026-01-01'),
    structured_data: buildClinicalIntake({ text: 'I have fever', selectedLanguage: 'en' }),
  };
}

async function setup(t, { intake = draft(), visitType = 'NEW', provider } = {}) {
  const state = {
    intake,
    encounter: { _id: encounterId, patient_id: patientId, visit_type: visitType, status: 'OPEN', queue_status: 'INTAKE_PENDING' },
    artifacts: [], audits: [], beforeIntakeWrite: null, queueFailures: 0,
  };
  const originalKey = process.env.GEMINI_API_KEY;
  if (provider) process.env.GEMINI_API_KEY = 'unit-test-key';
  else delete process.env.GEMINI_API_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });
  state.fetch = t.mock.method(globalThis, 'fetch', provider || (() => { throw new Error('unexpected network'); }));
  t.mock.method(models.Patient, 'findOne', async (filter) => filter.user_id === userId ? { _id: patientId } : null);
  const snapshot = (document, save) => document ? { ...structuredClone(document), save } : null;
  t.mock.method(models.Encounter, 'findOne', async (filter) => matches(state.encounter, filter)
    ? snapshot(state.encounter, async function save() { applyUpdate(state.encounter, this); }) : null);
  t.mock.method(models.Encounter, 'exists', async (filter) => matches(state.encounter, filter) ? { _id: encounterId } : null);
  t.mock.method(models.Encounter, 'updateOne', async (filter, update) => {
    if (state.queueFailures > 0) { state.queueFailures -= 1; throw new Error('synthetic queue write failure'); }
    if (!matches(state.encounter, filter)) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(state.encounter, update);
    return { matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(models.SymptomIntake, 'findOne', async (filter) => matches(state.intake, filter)
    ? snapshot(state.intake, async function save() {
      if (state.beforeIntakeWrite) await state.beforeIntakeWrite();
      const { save: _save, ...fields } = this;
      Object.assign(state.intake, structuredClone(fields));
    }) : null);
  t.mock.method(models.SymptomIntake, 'findOneAndUpdate', async (filter, update, options = {}) => {
    if (state.beforeIntakeWrite) await state.beforeIntakeWrite();
    if (!matches(state.intake, filter)) {
      if (!options.upsert) return null;
      if (state.intake) throw Object.assign(new Error('duplicate encounter'), { code: 11000 });
      state.intake = { _id: intakeId, __v: 0 };
    }
    applyUpdate(state.intake, update);
    return snapshot(state.intake);
  });
  t.mock.method(models.AIArtifact, 'create', async (value) => { state.artifacts.push(value); return value; });
  t.mock.method(models.AuditEvent, 'create', async (value) => { state.audits.push(value); return value; });
  t.mock.method(console, 'error', () => {});

  const app = express();
  app.use(express.json());
  app.use('/api/patient', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  state.request = (action, body, { role = 'PATIENT', auth = true, raw, contentType } = {}) => new Promise((resolve, reject) => {
    const payload = raw || (body === undefined ? '' : JSON.stringify(body));
    const headers = { 'content-type': contentType || 'application/json', 'content-length': Buffer.byteLength(payload) };
    if (auth) headers.authorization = `Bearer ${issueToken({ subject: userId, role })}`;
    const req = http.request({ host: '127.0.0.1', port: server.address().port, method: 'POST', path: `/api/patient/encounters/${encounterId}/intake/${action}`, headers }, (res) => {
      let result = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { result += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(result) }));
    });
    req.on('error', reject);
    req.end(payload);
  });
  return state;
}

test('intake requires patient authentication and owned open encounter before provider access', async (t) => {
  const state = await setup(t);
  const body = { text: 'I have fever', language: 'en' };
  assert.equal((await state.request('process-text', body, { auth: false })).status, 401);
  assert.equal((await state.request('process-text', body, { role: 'DOCTOR' })).status, 403);
  state.encounter.patient_id = '000000000000000000000099';
  assert.equal((await state.request('process-text', body)).status, 404);
  assert.equal(state.fetch.mock.callCount(), 0);
  assert.equal(state.artifacts.length, 0);
});

test('text preparation stays a draft, and confirmation without edits preserves it', async (t) => {
  const state = await setup(t, { intake: null });
  const prepared = await state.request('process-text', { text: 'I have fever', language: 'en' });
  assert.equal(prepared.status, 201);
  assert.equal(prepared.body.intake.patient_confirmed, false);
  assert.equal(state.encounter.queue_status, 'INTAKE_PENDING');
  const confirmed = await state.request('confirm', { patient_confirmed: true });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(confirmed.body.intake.symptoms, ['fever']);
  assert.equal(confirmed.body.intake.transcript, 'I have fever');
  assert.equal(state.encounter.queue_status, 'WAITING');
});

test('confirmation rejects malformed structure and input-mode relabeling', async (t) => {
  const state = await setup(t, { visitType: 'REVISITING' });
  for (const structured_data of [null, 'invalid', [], { clinical_intake: [] }, { symptoms: 'fever' }]) {
    const result = await state.request('confirm', { patient_confirmed: true, structured_data });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'INVALID_CLINICAL_INTAKE');
  }
  const relabeled = await state.request('confirm', { patient_confirmed: true, input_mode: 'VOICE', structured_data: { symptoms: ['fever'] } });
  assert.equal(relabeled.status, 400);
  assert.equal(relabeled.body.error, 'INPUT_MODE_MISMATCH');
  assert.equal(state.intake.patient_confirmed, false);
});

test('new visits cannot skip or confirm empty extraction; returning visits can skip then confirm', async (t) => {
  const state = await setup(t);
  assert.equal((await state.request('skip')).status, 400);
  assert.equal((await state.request('confirm', { patient_confirmed: true, structured_data: {} })).status, 422);
  state.encounter.visit_type = 'REVISITING';
  const skipped = await state.request('skip');
  assert.equal(skipped.status, 201);
  assert.equal(skipped.body.intake.patient_confirmed, false);
  assert.equal((await state.request('confirm', { patient_confirmed: true, input_mode: 'SKIPPED' })).status, 200);
  assert.equal(state.encounter.queue_status, 'WAITING');
});

test('draft writes cannot overwrite a concurrent confirmation or a legacy confirmed intake', async (t) => {
  const state = await setup(t);
  state.beforeIntakeWrite = () => { state.intake.patient_confirmed = true; state.intake.__v += 1; };
  const result = await state.request('process-text', { text: 'I have cough', language: 'en' });
  assert.equal(result.status, 409);
  assert.equal(state.intake.patient_confirmed, true);
  assert.equal(state.intake.transcript, 'I have fever');
  assert.equal(state.artifacts.length, 0);

  state.beforeIntakeWrite = null;
  state.intake.patient_confirmed = false;
  state.intake.confirmed_at = new Date();
  assert.equal((await state.request('process-text', { text: 'I have cough', language: 'en' })).status, 409);
});

test('a conflicting intake owner is never overwritten', async (t) => {
  const state = await setup(t);
  state.intake.patient_id = '000000000000000000000099';
  const result = await state.request('process-text', { text: 'I have cough', language: 'en' });
  assert.equal(result.status, 409);
  assert.equal(state.intake.patient_id, '000000000000000000000099');
});

test('confirmation loses safely to concurrent draft edits or another confirmation', async (t) => {
  const state = await setup(t);
  state.beforeIntakeWrite = () => {
    state.intake.structured_data.clinical_intake.symptoms = ['cough'];
    state.intake.__v += 1;
  };
  const body = { patient_confirmed: true, structured_data: { symptoms: ['fever'] } };
  assert.equal((await state.request('confirm', body)).status, 409);
  assert.equal(state.intake.patient_confirmed, false);
  assert.deepEqual(state.intake.structured_data.clinical_intake.symptoms, ['cough']);
  assert.equal(state.encounter.queue_status, 'INTAKE_PENDING');

  state.beforeIntakeWrite = () => { state.intake.patient_confirmed = true; state.intake.__v += 1; };
  assert.equal((await state.request('confirm', body)).status, 409);
  assert.equal(state.audits.length, 0);
});

test('queue write failure is recoverable by retrying confirmation without overwriting confirmed content', async (t) => {
  const state = await setup(t);
  state.queueFailures = 1;
  const body = { patient_confirmed: true, structured_data: { symptoms: ['fever'] } };
  assert.equal((await state.request('confirm', body)).status, 500);
  assert.equal(state.intake.patient_confirmed, true);
  assert.equal(state.encounter.queue_status, 'INTAKE_PENDING');
  const retry = await state.request('confirm', { ...body, structured_data: { symptoms: ['cough'] } });
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.intake.symptoms, ['fever']);
  assert.equal(state.encounter.queue_status, 'WAITING');
  assert.equal((await state.request('confirm', body)).status, 409);
});

test('confirmation never rewinds a concurrently advanced doctor queue', async (t) => {
  const state = await setup(t);
  state.beforeIntakeWrite = () => { state.encounter.queue_status = 'IN_CONSULTATION'; };
  const result = await state.request('confirm', { patient_confirmed: true, structured_data: { symptoms: ['fever'] } });
  assert.equal(result.status, 200);
  assert.equal(state.encounter.queue_status, 'IN_CONSULTATION');
});

test('browser voice works without a provider and unreliable text cannot masquerade as a transcript', async (t) => {
  const state = await setup(t, { intake: null });
  const result = await state.request('process-voice', { language: 'hi', browser_transcript: 'मुझे बुखार है', transcript_reliable: true });
  assert.equal(result.status, 201);
  assert.equal(result.body.intake.transcription_source, 'BROWSER_TRANSCRIPT');
  assert.equal(result.body.intake.audio_deleted, true);
  assert.equal(result.body.intake.patient_confirmed, false);
  assert.equal(state.fetch.mock.callCount(), 0);
  assert.equal((await state.request('process-voice', { language: 'en', browser_transcript: 'I have fever', transcript_reliable: false })).body.error, 'VOICE_INPUT_REQUIRED');
  assert.equal((await state.request('process-voice', { language: 'en', browser_transcript: 'I have fever', transcript_reliable: 'garbage' })).status, 400);
});

test('multipart voice reaches the server transcription adapter then saves a reviewable draft', async (t) => {
  let calls = 0;
  const state = await setup(t, { intake: null, provider: async (_url, options) => {
    calls += 1;
    const request = JSON.parse(options.body);
    if (calls === 1) {
      assert.equal(request.contents[0].parts[0].inline_data.data, Buffer.from('synthetic-audio').toString('base64'));
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ transcript: 'I have fever', language: 'en' }) }] } }] }) };
    }
    return { ok: false }; // extraction outage must retain the real transcript
  } });
  const boundary = 'unit-test-audio';
  const raw = `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nen\r\n--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="voice.webm"\r\nContent-Type: audio/webm\r\n\r\nsynthetic-audio\r\n--${boundary}--\r\n`;
  const result = await state.request('process-voice', undefined, { raw, contentType: `multipart/form-data; boundary=${boundary}` });
  assert.equal(result.status, 201);
  assert.equal(result.body.intake.transcript, 'I have fever');
  assert.equal(result.body.intake.transcription_source, 'SERVER_TRANSCRIPTION');
  assert.equal(result.body.intake.audio_deleted, true);
  assert.equal(result.body.intake.patient_confirmed, false);
  assert.equal(state.encounter.queue_status, 'INTAKE_PENDING');
  assert.equal(calls, 2);
});
