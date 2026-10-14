const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildClinicalIntake,
  processClinicalIntake,
  sanitizeClinicalIntake,
} = require('../src/services/clinicalIntakeService');
const {
  normalizeLanguage,
  detectLanguage,
} = require('../src/services/languageService');
const {
  MAX_AUDIO_BYTES,
  TranscriptionError,
  transcribeAudio,
} = require('../src/services/transcriptionService');

test('normalizes supported language aliases and detects observed script', () => {
  assert.equal(normalizeLanguage('Gujarati', null), 'gu');
  assert.equal(normalizeLanguage('hi-IN', null), 'hi');
  assert.equal(detectLanguage('मुझे बुखार है', 'gu').language, 'hi');
});

test('preserves the original statement and extracts conservative multilingual fields', () => {
  const text = 'મને ત્રણ દિવસથી કમજોરી અને ચક્કર આવે છે. મને કોઈ એલર્જી નથી.';
  const result = buildClinicalIntake({
    text,
    selectedLanguage: 'gu',
    inputMode: 'TEXT',
    transcriptSource: 'PATIENT_TYPED',
  });

  assert.equal(result.transcript.text, text);
  assert.equal(result.transcript.source, 'PATIENT_TYPED');
  assert.equal(result.selected_language, 'gu');
  assert.deepEqual(result.clinical_intake.symptoms, ['dizziness', 'weakness']);
  assert.equal(result.clinical_intake.duration, '3 days');
  assert.equal(result.clinical_intake.allergy_status, 'NONE_REPORTED');
  assert.equal(result.clinical_intake.urgency, '');
  assert.equal(result.provenance.original_text, 'PATIENT_TYPED');
});

test('keeps denied symptoms separate from positive symptoms', () => {
  const result = buildClinicalIntake({
    text: 'मुझे बुखार नहीं है लेकिन खांसी है',
    selectedLanguage: 'hi',
    inputMode: 'TEXT',
  });

  assert.deepEqual(result.clinical_intake.symptoms, ['cough']);
  assert.deepEqual(result.clinical_intake.negative_symptoms, ['fever']);
});

test('does not create fake facts when extraction has no explicit clinical information', () => {
  const result = buildClinicalIntake({ text: 'नमस्ते', selectedLanguage: 'hi', inputMode: 'TEXT' });
  assert.equal(result.extraction_status, 'REVIEW_REQUIRED');
  assert.equal(result.clinical_intake.chief_complaint, '');
  assert.deepEqual(result.clinical_intake.symptoms, []);
});

test('sanitizes patient-edited structure to the contract', () => {
  const result = sanitizeClinicalIntake({
    chief_complaint: '  weakness  ',
    symptoms: ['dizziness', 'dizziness', 4],
    possible_symptom_categories: ['NEUROLOGICAL', 'DIAGNOSIS'],
    allergy_status: 'INVALID',
    urgency: 'EMERGENCY',
  });
  assert.equal(result.chief_complaint, 'weakness');
  assert.deepEqual(result.symptoms, ['dizziness']);
  assert.deepEqual(result.possible_symptom_categories, ['NEUROLOGICAL']);
  assert.equal(result.allergy_status, 'UNKNOWN');
  assert.equal(result.urgency, 'EMERGENCY');
});

test('rejects empty, oversized, and unsupported audio before provider access', async () => {
  await assert.rejects(
    () => transcribeAudio({ audioBuffer: Buffer.alloc(0), mimeType: 'audio/webm', preferredLanguage: 'gu' }),
    (error) => error instanceof TranscriptionError && error.code === 'EMPTY_AUDIO',
  );
  await assert.rejects(
    () => transcribeAudio({ audioBuffer: Buffer.from('audio'), mimeType: 'application/pdf', preferredLanguage: 'gu' }),
    (error) => error instanceof TranscriptionError && error.code === 'UNSUPPORTED_AUDIO_TYPE',
  );
  await assert.rejects(
    () => transcribeAudio({ audioBuffer: Buffer.alloc(MAX_AUDIO_BYTES + 1), mimeType: 'audio/webm', preferredLanguage: 'gu' }),
    (error) => error instanceof TranscriptionError && error.code === 'AUDIO_TOO_LARGE',
  );
});

function mockProvider(t, implementation, enabled = true) {
  const originalKey = process.env.GEMINI_API_KEY;
  if (enabled) process.env.GEMINI_API_KEY = 'unit-test-key';
  else delete process.env.GEMINI_API_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });
  return t.mock.method(globalThis, 'fetch', implementation);
}

function providerResponse(value) {
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }) };
}

test('language aliases cannot resolve inherited object properties', () => {
  for (const value of ['constructor', '__proto__', 'toString']) {
    assert.equal(normalizeLanguage(value, null), null);
  }
  assert.equal(detectLanguage('मुझे बुखार होता है', 'mr').language, 'hi');
});

test('fallback respects negation scope and whole English symptom words', () => {
  const intake = (text) => buildClinicalIntake({ text, selectedLanguage: 'en' }).clinical_intake;
  assert.deepEqual(intake('No fever or cough. I have dizziness.').symptoms, ['dizziness']);
  assert.deepEqual(intake('No fever or cough. I have dizziness.').negative_symptoms, ['fever', 'cough']);
  assert.deepEqual(intake('I was in a crash.').symptoms, []);
  assert.deepEqual(intake('I do not have asthma. I am not taking aspirin.').relevant_history, []);
  assert.deepEqual(intake('I do not have asthma. I am not taking aspirin.').medications, []);
  assert.equal(intake('I am not allergic to penicillin.').allergy_status, 'UNKNOWN');
  assert.equal(intake('I have chest pain.').urgency, '');
  assert.equal(intake('This is not an emergency.').urgency, '');
  assert.equal(intake('I have severe chest pain.').urgency, 'HIGH');
});

test('duration supports native Gujarati and Devanagari numerals', () => {
  assert.equal(buildClinicalIntake({ text: 'મને ૩ દિવસથી તાવ છે', selectedLanguage: 'gu' }).clinical_intake.duration, '3 days');
  assert.equal(buildClinicalIntake({ text: 'मला २ दिवस ताप आहे', selectedLanguage: 'mr' }).clinical_intake.duration, '2 days');
});

test('missing optional provider never fetches and preserves a reviewable fallback', async (t) => {
  const fetch = mockProvider(t, () => { throw new Error('unexpected network'); }, false);
  const result = await processClinicalIntake({ text: 'I have fever', selectedLanguage: 'en' });
  assert.deepEqual(result.clinical_intake.symptoms, ['fever']);
  assert.equal(result.provenance.structured_fields, 'DETERMINISTIC_FALLBACK');
  await assert.rejects(() => transcribeAudio({ audioBuffer: Buffer.from('synthetic'), mimeType: 'audio/webm' }), { code: 'VOICE_TRANSCRIPTION_UNAVAILABLE' });
  assert.equal(fetch.mock.callCount(), 0);
});

test('empty provider extraction still requires review and cannot rewrite transcription confidence', async (t) => {
  mockProvider(t, async () => providerResponse({ clinical_intake: {}, confidence: { transcription: 0, language: 0, overall: 2, unexpected: 1 } }));
  const result = await processClinicalIntake({ text: 'Hello', selectedLanguage: 'en', transcriptionConfidence: 1 });
  assert.equal(result.extraction_status, 'REVIEW_REQUIRED');
  assert.equal(result.confidence.transcription, 1);
  assert.equal(result.confidence.overall, 1);
  assert.equal(result.confidence.unexpected, undefined);
});

test('provider normalized fields determine confidence rather than fallback vocabulary', async (t) => {
  mockProvider(t, async () => providerResponse({ clinical_intake: { chief_complaint: 'ear pain', symptoms: ['ear pain'] } }));
  const result = await processClinicalIntake({ text: 'My ear hurts', selectedLanguage: 'en' });
  assert.deepEqual(result.clinical_intake.symptoms, ['ear pain']);
  assert.equal(result.provenance.structured_fields, 'AI_EXTRACTED');
  assert.ok(result.confidence.symptoms > 0);
});

test('clinical extraction failures and malformed shapes use deterministic fallback', async (t) => {
  const cases = [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false }),
    async () => providerResponse({ clinical_intake: 'invalid' }),
    async () => providerResponse({ clinical_intake: [] }),
    async () => providerResponse({ clinical_intake: { symptoms: 'invalid' } }),
    async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: {} } }] }) }),
  ];
  const fetch = mockProvider(t, cases[0]);
  for (const implementation of cases) {
    fetch.mock.mockImplementation(implementation);
    const result = await processClinicalIntake({ text: 'I have fever', selectedLanguage: 'en' });
    assert.equal(result.provenance.structured_fields, 'DETERMINISTIC_FALLBACK');
    assert.deepEqual(result.clinical_intake.symptoms, ['fever']);
  }
});

test('server voice sends audio bytes and preserves verbatim provider transcript', async (t) => {
  const fetch = mockProvider(t, async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.deepEqual(request.contents[0].parts[0].inline_data, { mime_type: 'audio/webm', data: Buffer.from('synthetic-audio').toString('base64') });
    assert.ok(options.signal instanceof AbortSignal);
    return providerResponse({ transcript: 'मुझे बुखार है', language: 'hi', language_confidence: 0.9, transcription_confidence: 0.8 });
  });
  const result = await transcribeAudio({ audioBuffer: Buffer.from('synthetic-audio'), mimeType: 'audio/webm;codecs=opus', preferredLanguage: 'gu' });
  assert.equal(result.transcript, 'मुझे बुखार है');
  assert.equal(result.detected_language, 'hi');
  assert.equal(result.transcription_confidence, 0.8);
  assert.equal(fetch.mock.callCount(), 1);
});

test('malformed provider prose or JSON cannot become a patient transcript', async (t) => {
  const fetch = mockProvider(t, async () => providerResponse(null));
  for (const text of ['null', '{"transcript":', 'Sorry, I cannot process this audio.', '```json\ninvalid\n```']) {
    fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }));
    await assert.rejects(() => transcribeAudio({ audioBuffer: Buffer.from('synthetic'), mimeType: 'audio/ogg' }), { code: 'INVALID_TRANSCRIPTION_RESPONSE' });
  }
});

test('voice provider HTTP and network failures return bounded public errors', async (t) => {
  const fetch = mockProvider(t, async () => ({ ok: false }));
  for (const implementation of [async () => ({ ok: false }), async () => { throw new Error('private provider detail'); }]) {
    fetch.mock.mockImplementation(implementation);
    await assert.rejects(() => transcribeAudio({ audioBuffer: Buffer.from('synthetic'), mimeType: 'audio/wav' }), (error) => {
      assert.equal(error.code, 'TRANSCRIPTION_PROVIDER_FAILED');
      assert.ok(!error.message.includes('private'));
      return true;
    });
  }
});

test('both provider requests abort when their deadline expires, including response bodies', async (t) => {
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => { timers.push({ callback, delay }); return 1; });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  const fetch = mockProvider(t, async (_url, options) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  }));
  const extraction = processClinicalIntake({ text: 'I have fever', selectedLanguage: 'en' });
  await Promise.resolve();
  assert.ok(timers[0].delay > 0 && timers[0].delay <= 30000);
  timers[0].callback();
  assert.equal((await extraction).provenance.structured_fields, 'DETERMINISTIC_FALLBACK');

  const voice = transcribeAudio({ audioBuffer: Buffer.from('synthetic'), mimeType: 'audio/webm' });
  await Promise.resolve();
  assert.equal(timers.length, 2);
  assert.ok(timers[1].delay > 0 && timers[1].delay <= 30000);
  timers[1].callback();
  await assert.rejects(() => voice, { code: 'TRANSCRIPTION_TIMEOUT' });
  assert.equal(fetch.mock.callCount(), 2);
});
