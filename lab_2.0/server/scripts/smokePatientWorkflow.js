'use strict';

const { isDeepStrictEqual } = require('node:util');

// Called only by smokeDemoWorkflow after its random database ownership check.
// All mutations below use real HTTP routes; model reads verify persistence.
async function runPatientWorkflow(context, helpers, actors) {
  const {
    assert, expectStatus, expectSuccess, safeResponseCode, objectIdValue,
    referencedId, request, providerLogin, assertDoctorOrderAndPatientNotification,
  } = helpers;
  const { fixture, patientToken, otherPatientToken, otherDoctorToken, laboratory, otherLabToken } = actors;
  const { Encounter, SymptomIntake, ConsultationNote, DiagnosticOrder, LabAccessGrant, AuditEvent } = context.models;
  const patientId = String(fixture.patient._id);
  const call = (pathname, options) => request(context, pathname, options);
  const post = (pathname, token, body = {}) => call(pathname, { method: 'POST', token, body });
  const reject = (response, status, code, label) => {
    expectStatus(response, status, label);
    assert(response.payload?.success === false && safeResponseCode(response) === code, `${label}: wrong rejection contract.`);
  };
  const same = (actual, expected, label) => {
    assert(isDeepStrictEqual(actual, expected), `${label}: returned or persisted data differed.`);
  };

  // Exercise the real deterministic fallback, never external extraction or
  // transcription. Restore even if an HTTP assertion or database read fails.
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const phone = `+9198${String(Date.now()).slice(-8)}`;
    const registered = await post('/api/auth/doctor/register', null, {
      name: 'Dr. Synthetic Workflow', phone,
      specialty: 'General Physician', clinic_name: 'Synthetic workflow clinic',
    });
    expectSuccess(registered, 201, 'workflow doctor registration');
    const doctorId = objectIdValue(registered.payload.doctor?.id, 'workflow doctor');
    const doctorCode = registered.payload.doctor?.qr_code_id;
    assert(doctorCode, 'Workflow doctor registration omitted its provider code.');
    const doctorToken = await providerLogin(context, doctorCode, phone, 'DOCTOR');

    async function resolve(code, type) {
      const response = await call(`/api/providers/resolve/${encodeURIComponent(code)}`);
      expectSuccess(response, 200, `${type} public provider resolution`);
      assert(response.payload.provider?.provider_type === type, `${type} resolution returned the wrong provider type.`);
      assert(response.payload.provider.provider_code === code, `${type} resolution returned the wrong code.`);
      return objectIdValue(response.payload.provider.provider_id, `${type} resolved provider`);
    }
    assert(await resolve(doctorCode, 'DOCTOR') === doctorId, 'Doctor resolution changed the provider identity.');
    const laboratoryId = await resolve(laboratory.providerCode, 'LABORATORY');
    reject(await call('/api/providers/resolve/SMOKE-UNKNOWN-PROVIDER'), 404, 'PROVIDER_NOT_FOUND', 'unknown provider resolution');

    const queuePath = `/api/doctor/queue/${doctorId}`;
    const patientPath = (id) => `/api/patient/encounters/${id}`;
    const doctorPath = (id) => `/api/doctor/encounter/${id}`;
    async function queueItem(id, expectedState) {
      const response = await call(queuePath, { token: doctorToken });
      expectSuccess(response, 200, 'workflow doctor queue');
      assert(Array.isArray(response.payload.queue), 'Doctor queue was not an array.');
      const matches = response.payload.queue.filter((item) => referencedId(item.encounter_id) === id);
      assert(matches.length === (expectedState ? 1 : 0), 'Encounter was missing, duplicated, or visible prematurely in the doctor queue.');
      if (expectedState) assert(matches[0].queue_status === expectedState, 'Doctor queue returned the wrong lifecycle state.');
      return matches[0];
    }
    async function patientView(id, queueStatus, lifecycleState, status = 'OPEN') {
      const response = await call(patientPath(id), { token: patientToken });
      expectSuccess(response, 200, 'patient encounter read-back');
      const encounter = response.payload.encounter;
      assert(referencedId(encounter?._id) === id && referencedId(encounter.patient_id) === patientId, 'Patient encounter read-back changed ownership.');
      assert(encounter.status === status && encounter.queue_status === queueStatus && encounter.lifecycle_state === lifecycleState, 'Patient encounter read-back returned the wrong lifecycle state.');
      return encounter;
    }
    async function createEncounter(visitType) {
      const before = await Encounter.countDocuments({ patient_id: patientId, doctor_id: doctorId });
      const response = await post('/api/patient/encounters', patientToken, { doctor_code: doctorCode, visit_type: visitType });
      expectSuccess(response, 201, `${visitType} patient encounter creation`);
      const id = objectIdValue(response.payload.encounter?.id, `${visitType} encounter`);
      assert(response.payload.encounter.lifecycle_state === 'INTAKE_PENDING', 'New API encounter was not intake-pending.');
      assert(await Encounter.countDocuments({ patient_id: patientId, doctor_id: doctorId }) === before + 1, 'API encounter creation reused a seeded encounter instead of creating one.');
      const persisted = await Encounter.findById(id).lean();
      assert(persisted?.visit_type === visitType && String(persisted.patient_id) === patientId && String(persisted.doctor_id) === doctorId, 'API encounter ownership or visit type was not persisted.');
      await patientView(id, 'INTAKE_PENDING', 'INTAKE_PENDING');
      await queueItem(id, null);
      return id;
    }
    async function snapshot(id) {
      return {
        encounter: await Encounter.findById(id).lean(),
        intake: await SymptomIntake.findOne({ encounter_id: id }).lean(),
        notes: await ConsultationNote.find({ encounter_id: id }).lean(),
        orders: await DiagnosticOrder.find({ encounter_id: id }).lean(),
      };
    }
    async function confirm(id, inputMode, clinical) {
      const body = { patient_confirmed: true, input_mode: inputMode, structured_data: { clinical_intake: clinical } };
      const response = await post(`${patientPath(id)}/intake/confirm`, patientToken, body);
      expectSuccess(response, 200, `${inputMode} patient intake confirmation`);
      const intake = response.payload.intake;
      assert(intake?.patient_confirmed === true && intake.patient_confirmed_at && intake.confirmed_at, 'Confirmed intake omitted confirmation timestamps.');
      assert(intake.structured_data?.patient_confirmed === true, 'Structured intake was not marked patient-confirmed.');
      const view = await patientView(id, 'WAITING', 'WAITING');
      same(view.intake, intake, 'confirmed patient review read-back');
      assert(await SymptomIntake.countDocuments({ encounter_id: id }) === 1, 'Confirmation duplicated the prepared intake.');
      const item = await queueItem(id, 'WAITING');
      assert(item.has_intake === true && item.intake?.patient_confirmed === true, 'Doctor queue omitted confirmed intake.');
      same(item.intake.structured_data.clinical_intake, intake.structured_data.clinical_intake, 'confirmed doctor queue intake');

      const before = await snapshot(id);
      const auditFilter = { resource_id: String(intake._id), action: { $in: ['PATIENT_CORRECTED_INTAKE', 'PATIENT_CONFIRMED_SYMPTOM_INTAKE'] } };
      const auditCount = await AuditEvent.countDocuments(auditFilter);
      assert(auditCount === 1, 'Intake confirmation did not commit exactly one confirmation audit.');
      reject(await post(`${patientPath(id)}/intake/confirm`, patientToken, {
        ...body, structured_data: { clinical_intake: { chief_complaint: 'Synthetic retry must not overwrite review' } },
      }), 409, 'INTAKE_ALREADY_CONFIRMED', `${inputMode} repeated confirmation`);
      same(await snapshot(id), before, 'repeated confirmation immutability');
      assert(await AuditEvent.countDocuments(auditFilter) === auditCount, 'Repeated confirmation committed a second confirmation audit.');
      return intake;
    }
    async function reviewAndStart(id, expectedIntake) {
      const reviewed = await post(`${doctorPath(id)}/review`, doctorToken);
      expectSuccess(reviewed, 200, 'doctor symptom review');
      assert(reviewed.payload.encounter?.queue_status === 'DOCTOR_REVIEWING', 'Doctor review did not change queue state.');
      await patientView(id, 'DOCTOR_REVIEWING', 'DOCTOR_REVIEWING');
      const cockpit = await call(`${doctorPath(id)}/cockpit`, { token: doctorToken });
      expectSuccess(cockpit, 200, 'doctor confirmed intake cockpit');
      assert(referencedId(cockpit.payload.patient?.id) === patientId, 'Doctor cockpit returned another patient.');
      same(cockpit.payload.intake?.structured_data, expectedIntake.structured_data, 'doctor cockpit reviewed intake');
      const started = await post(`${doctorPath(id)}/start`, doctorToken);
      expectSuccess(started, 200, 'doctor consultation start');
      // /start calls the patient; this contract does not enter IN_CONSULTATION.
      assert(started.payload.encounter?.queue_status === 'CALLED' && started.payload.encounter.lifecycle_state === 'PLEASE_COME_IN' && started.payload.encounter.started_at, 'Consultation start did not call the patient.');
      await patientView(id, 'CALLED', 'PLEASE_COME_IN');
      await queueItem(id, 'CALLED');
      const beforeRetry = await snapshot(id);
      reject(await post(`${patientPath(id)}/intake/confirm`, patientToken, {
        patient_confirmed: true, input_mode: expectedIntake.input_mode,
        structured_data: expectedIntake.structured_data,
      }), 409, 'INTAKE_ALREADY_CONFIRMED', 'confirmation after doctor called patient');
      same(await snapshot(id), beforeRetry, 'called encounter confirmation retry immutability');
      return cockpit.payload;
    }
    async function saveNoteAndComplete(id, noteText) {
      const saved = await post(`${doctorPath(id)}/notes`, doctorToken, { notes_text: noteText });
      expectSuccess(saved, 200, 'doctor consultation note save');
      assert(saved.payload.note?.notes_text === noteText && saved.payload.note.provenance === 'DOCTOR_ENTERED', 'Doctor note response lost its content or provenance.');
      assert(referencedId(saved.payload.note.encounter_id) === id, 'Doctor note response referenced another encounter.');
      const persisted = await ConsultationNote.findOne({ encounter_id: id }).lean();
      assert(persisted?.notes_text === noteText && String(persisted.patient_id) === patientId && String(persisted.doctor_id) === doctorId, 'Doctor note ownership or content was not persisted.');
      const cockpit = await call(`${doctorPath(id)}/cockpit`, { token: doctorToken });
      expectSuccess(cockpit, 200, 'doctor saved note read-back');
      assert(cockpit.payload.current_note === noteText, 'Doctor cockpit did not return the saved note.');

      const completed = await post(`${doctorPath(id)}/end`, doctorToken);
      expectSuccess(completed, 200, 'doctor consultation completion');
      assert(completed.payload.encounter?.status === 'CLOSED' && completed.payload.encounter.lifecycle_state === 'CONSULTATION_COMPLETED' && completed.payload.encounter.ended_at, 'Consultation completion did not close bounded access.');
      const view = await patientView(id, 'CALLED', 'CONSULTATION_COMPLETED', 'CLOSED');
      assert(view.intake?.audio_deleted === true && view.intake.patient_confirmed === true, 'Completed intake did not retain confirmation and audio deletion state.');
      await queueItem(id, null);
      const before = await snapshot(id);
      reject(await call(`${doctorPath(id)}/cockpit`, { token: doctorToken }), 403, 'BOUNDED_ACCESS_EXPIRED', 'closed doctor cockpit');
      reject(await post(`${doctorPath(id)}/notes`, doctorToken, { notes_text: 'Synthetic forbidden late edit' }), 403, 'BOUNDED_ACCESS_EXPIRED', 'closed doctor note edit');
      reject(await post(`${doctorPath(id)}/end`, doctorToken), 400, 'ENCOUNTER_ALREADY_CLOSED', 'repeated consultation completion');
      same(await snapshot(id), before, 'closed encounter immutability');
      const timeline = await call('/api/patient/timeline', { token: patientToken });
      expectSuccess(timeline, 200, 'completed patient consultation timeline');
      const entry = timeline.payload.consultations.find((item) => referencedId(item.details?.encounter_id) === id);
      assert(entry?.details.status === 'CLOSED' && entry.details.consultation_note === noteText, 'Patient timeline lost the completed consultation note.');
      same(entry.details.intake?.structured_data, view.intake.structured_data, 'completed timeline intake');
    }

    const encounterId = await createEncounter('NEW');
    const textBody = { input_mode: 'TEXT', language: 'en', text: 'I have fever for 3 days. No cough. No known allergies.' };
    const beforeDenials = await snapshot(encounterId);
    reject(await call(patientPath(encounterId)), 401, 'AUTHENTICATION_REQUIRED', 'unauthenticated encounter read');
    reject(await call(patientPath(encounterId), { token: doctorToken }), 403, 'ROLE_NOT_ALLOWED', 'doctor on patient encounter route');
    reject(await call(patientPath(encounterId), { token: otherPatientToken }), 404, 'ENCOUNTER_NOT_FOUND', 'other patient encounter read');
    for (const [suffix, body] of [
      ['/intake/process-text', textBody], ['/intake/skip', {}],
      ['/intake/confirm', { patient_confirmed: true, input_mode: 'TEXT', structured_data: { chief_complaint: 'Synthetic unauthorized review' } }],
    ]) {
      reject(await post(`${patientPath(encounterId)}${suffix}`, otherPatientToken, body), 404, 'ENCOUNTER_NOT_FOUND', `other patient ${suffix}`);
    }
    reject(await call(queuePath, { token: otherDoctorToken }), 403, 'DOCTOR_OWNERSHIP_REQUIRED', 'other doctor queue read');
    reject(await call(queuePath, { token: patientToken }), 403, 'ROLE_NOT_ALLOWED', 'patient on doctor queue route');
    reject(await call(`${doctorPath(encounterId)}/cockpit`, { token: otherDoctorToken }), 404, 'ENCOUNTER_NOT_FOUND', 'other doctor cockpit');
    for (const [suffix, body] of [
      ['/review', {}], ['/start', {}], ['/notes', { notes_text: 'Synthetic unauthorized note' }],
      ['/order-diagnostic', { test_type: 'CBC' }], ['/end', {}],
    ]) {
      reject(await post(`${doctorPath(encounterId)}${suffix}`, otherDoctorToken, body), 404, 'ENCOUNTER_NOT_FOUND', `other doctor ${suffix}`);
    }
    same(await snapshot(encounterId), beforeDenials, 'ownership denial immutability');
    reject(await post(`${patientPath(encounterId)}/intake/skip`, patientToken), 400, 'NEW_CONSULTATION_INTAKE_REQUIRED', 'new consultation skip');
    reject(await post(`${patientPath(encounterId)}/intake/confirm`, patientToken, { patient_confirmed: true }), 404, 'INTAKE_NOT_PREPARED', 'confirmation before preparation');
    reject(await post(`${doctorPath(encounterId)}/start`, doctorToken), 409, 'INVALID_QUEUE_TRANSITION', 'consultation start before confirmation');

    for (const [body, status, code] of [
      [{ ...textBody, text: ' ' }, 400, 'EMPTY_PATIENT_TEXT'],
      [{ ...textBody, language: 'unsupported' }, 400, 'UNSUPPORTED_LANGUAGE'],
      [{ ...textBody, text: 'x'.repeat(8001) }, 413, 'PATIENT_TEXT_TOO_LARGE'],
    ]) {
      reject(await post(`${patientPath(encounterId)}/intake/process-text`, patientToken, body), status, code, 'invalid text intake');
    }
    reject(await post(`${patientPath(encounterId)}/intake/process-voice`, patientToken, { language: 'en' }), 400, 'VOICE_INPUT_REQUIRED', 'missing voice input');
    for (const [mimeType, status, code] of [
      ['text/plain', 400, 'UNSUPPORTED_AUDIO_TYPE'],
       ['audio/wav', 503, 'VOICE_TRANSCRIPTION_UNAVAILABLE'],
    ]) {
      const formData = new FormData();
      formData.set('language', 'en');
      formData.set('input_mode', 'VOICE');
      formData.set('audio', new Blob(['synthetic smoke bytes'], { type: mimeType }), 'synthetic-audio.wav');
      reject(await call(`${patientPath(encounterId)}/intake/process-voice`, {
        method: 'POST', token: patientToken, formData,
      }), status, code, 'rejected or unavailable voice intake');
    }
    same(await snapshot(encounterId), beforeDenials, 'rejected intake immutability');

    const prepared = await post(`${patientPath(encounterId)}/intake/process-text`, patientToken, textBody);
    expectSuccess(prepared, 201, 'patient text intake processing');
    const draft = prepared.payload.intake;
    assert(draft?.input_mode === 'TEXT' && draft.extraction_status === 'READY' && draft.patient_confirmed === false && !draft.confirmed_at, 'Processed text was not an unconfirmed review draft.');
    assert(draft.transcript === textBody.text && draft.structured_data?.transcript?.text === textBody.text, 'Text preparation did not preserve the synthetic original.');
    assert(draft.transcription_source === 'PATIENT_TYPED' && draft.structured_data.provenance?.structured_fields === 'DETERMINISTIC_FALLBACK', 'Text preparation did not use the offline typed-text contract.');
    assert(draft.language === 'en' && draft.detected_language === 'en', 'Text preparation lost language metadata.');
    const clinical = draft.structured_data.clinical_intake;
    same(clinical?.symptoms, ['fever'], 'positive symptom extraction');
    same(clinical.negative_symptoms, ['cough'], 'denied symptom extraction');
    assert(clinical.duration === '3 days' && clinical.allergy_status === 'NONE_REPORTED', 'Text preparation lost duration or allergy status.');
    assert(draft.structured_data.confidence?.transcription === 1, 'Typed-text transcription confidence was not preserved.');
    same((await patientView(encounterId, 'INTAKE_PENDING', 'INTAKE_PENDING')).intake, draft, 'prepared patient review read-back');
    await queueItem(encounterId, null);
    reject(await call(`${doctorPath(encounterId)}/cockpit`, { token: doctorToken }), 409, 'INTAKE_NOT_CONFIRMED', 'unconfirmed doctor cockpit');
    reject(await post(`${patientPath(encounterId)}/intake/confirm`, patientToken, { patient_confirmed: false }), 400, 'PATIENT_CONFIRMATION_REQUIRED', 'missing explicit review confirmation');
    reject(await post(`${patientPath(encounterId)}/intake/confirm`, patientToken, { patient_confirmed: true, structured_data: {} }), 422, 'EXTRACTION_REVIEW_REQUIRED', 'empty new consultation review');
    assert((await SymptomIntake.findById(draft._id).lean())?.patient_confirmed === false, 'Invalid review confirmed the intake.');

    const reviewedClinical = { ...clinical, duration: '4 days' };
    const confirmed = await confirm(encounterId, 'TEXT', reviewedClinical);
    assert(referencedId(confirmed._id) === referencedId(draft._id), 'Confirmation replaced rather than updated the prepared intake.');
    same(confirmed.structured_data.clinical_intake, reviewedClinical, 'patient-reviewed clinical fields');
    assert(confirmed.transcript === textBody.text && confirmed.duration === '4 days', 'Review correction overwrote the original or lost the edit.');
    assert(confirmed.structured_data.provenance?.field_provenance?.duration?.source === 'PATIENT_EDITED', 'Review correction lost patient-edited provenance.');
    const confirmedSnapshot = await snapshot(encounterId);
    reject(await post(`${patientPath(encounterId)}/intake/process-text`, patientToken, textBody), 409, 'INTAKE_ALREADY_CONFIRMED', 'reprocessing confirmed text');
    same(await snapshot(encounterId), confirmedSnapshot, 'confirmed intake reprocessing immutability');
    await reviewAndStart(encounterId, confirmed);

    const apiFixture = {
      ...fixture, patientToken,
      encounter: await Encounter.findById(encounterId).lean(),
      order: { doctor_id: doctorId },
    };
    const notification = await assertDoctorOrderAndPatientNotification(context, doctorToken, apiFixture, patientToken);
    const order = await DiagnosticOrder.findById(notification.orderId).lean();
    assert(String(order.encounter_id) === encounterId, 'API diagnostic order was not linked to the API-created encounter.');
    reject(await post(`/api/patient/notifications/${notification.notificationId}/read`, otherPatientToken), 404, 'NOTIFICATION_NOT_FOUND', 'other patient order notification');
    const noteText = 'Synthetic completed consultation; reviewed intake and ordered CBC.';
    await saveNoteAndComplete(encounterId, noteText);

    // A revisiting consultation can explicitly skip intake, but still must be
    // reviewed and confirmed before it becomes visible in the doctor's queue.
    const revisitId = await createEncounter('REVISITING');
    const skipped = await post(`${patientPath(revisitId)}/intake/skip`, patientToken);
    expectSuccess(skipped, 201, 'revisiting skipped intake preparation');
    assert(skipped.payload.intake?.input_mode === 'SKIPPED' && skipped.payload.intake.extraction_status === 'SKIPPED' && skipped.payload.intake.patient_confirmed === false, 'Skipped intake bypassed patient review.');
    await queueItem(revisitId, null);
    reject(await call(`${doctorPath(revisitId)}/cockpit`, { token: doctorToken }), 409, 'INTAKE_NOT_CONFIRMED', 'unconfirmed skipped cockpit');
    const skippedConfirmed = await confirm(revisitId, 'SKIPPED', {});
    assert(skippedConfirmed.input_mode === 'SKIPPED' && skippedConfirmed.extraction_status === 'SKIPPED' && skippedConfirmed.transcript === '' && skippedConfirmed.symptoms.length === 0, 'Confirmed skipped intake invented patient content.');
    const beforeSkipRetry = await snapshot(revisitId);
    reject(await post(`${patientPath(revisitId)}/intake/skip`, patientToken), 409, 'INTAKE_ALREADY_CONFIRMED', 'repeated confirmed skip');
    same(await snapshot(revisitId), beforeSkipRetry, 'confirmed skip immutability');
    const revisitCockpit = await reviewAndStart(revisitId, skippedConfirmed);
    assert(revisitCockpit.prior_notes.some((item) => referencedId(item.encounter_id) === encounterId && item.notes_text === noteText), 'Revisiting cockpit lost the prior completed note.');
    const priorIntake = revisitCockpit.prior_intakes.find((item) => referencedId(item.encounter_id) === encounterId);
    same(priorIntake?.intake?.structured_data, confirmed.structured_data, 'revisiting prior confirmed intake');
    await saveNoteAndComplete(revisitId, 'Synthetic revisiting consultation completed after explicit intake skip.');

    // Use a fresh lab so an existing seeded ACTIVE grant cannot hide a missing
    // diagnostic-order link in the patient's actual consent creation response.
    const grantFilter = { patient_id: patientId, laboratory_id: laboratoryId };
    assert(await LabAccessGrant.countDocuments(grantFilter) === 0, 'Consent workflow laboratory already has a grant for the patient.');
    const consentBody = { laboratory_code: laboratory.providerCode, diagnostic_order_id: notification.orderId };
    reject(await post('/api/patient/lab-grants', otherPatientToken, consentBody), 400, 'INVALID_DIAGNOSTIC_ORDER', 'other patient consent to diagnostic order');
    assert(await LabAccessGrant.countDocuments({ laboratory_id: laboratoryId }) === 0, 'Rejected consent created a laboratory grant.');
    const consent = await post('/api/patient/lab-grants', patientToken, consentBody);
    expectSuccess(consent, 201, 'patient diagnostic-order laboratory consent');
    const grantId = objectIdValue(consent.payload.grant?.id, 'patient-created laboratory grant');
    assert(consent.payload.grant.status === 'ACTIVE' && referencedId(consent.payload.grant.diagnostic_order_id) === notification.orderId, 'Patient consent returned the wrong diagnostic order or status.');
    assert(referencedId(consent.payload.grant.patient_id) === patientId && referencedId(consent.payload.grant.laboratory_id) === laboratoryId, 'Patient consent returned the wrong owners.');
    const grant = await LabAccessGrant.findById(grantId).lean();
    assert(grant?.status === 'ACTIVE' && String(grant.patient_id) === patientId && String(grant.laboratory_id) === laboratoryId && String(grant.diagnostic_order_id) === notification.orderId, 'Patient consent links were not persisted.');
    const auditFilter = { resource_id: grantId, action: 'APPROVE_LAB_IDENTITY_SHARING', outcome: 'SUCCESS' };
    assert(await AuditEvent.countDocuments(auditFilter) === 1, 'Patient consent did not commit its approval audit.');
    const repeatedConsent = await post('/api/patient/lab-grants', patientToken, consentBody);
    expectSuccess(repeatedConsent, 200, 'repeated identical patient lab consent');
    assert(repeatedConsent.payload.already_active === true && referencedId(repeatedConsent.payload.grant?._id) === grantId, 'Repeated identical consent did not reuse its grant.');
    assert(referencedId(repeatedConsent.payload.grant.diagnostic_order_id) === notification.orderId, 'Repeated consent changed its diagnostic order link.');
    assert(await LabAccessGrant.countDocuments(grantFilter) === 1 && await AuditEvent.countDocuments(auditFilter) === 1, 'Repeated identical consent duplicated its grant or approval audit.');
    const grants = await call('/api/patient/lab-grants', { token: patientToken });
    expectSuccess(grants, 200, 'patient consent read-back');
    assert(grants.payload.grants.some((item) => referencedId(item.id) === grantId && referencedId(item.diagnostic_order_id) === notification.orderId), 'Patient grant list omitted the consented order.');
    const otherGrants = await call('/api/patient/lab-grants', { token: otherPatientToken });
    expectSuccess(otherGrants, 200, 'other patient grant list');
    assert(!otherGrants.payload.grants.some((item) => referencedId(item.id) === grantId), 'Patient consent leaked through another patient grant list.');

    const identityPath = `/api/lab/grant/${grantId}/patient-identity`;
    const identity = await call(identityPath, { token: laboratory.token });
    expectSuccess(identity, 200, 'consented lab identity and diagnostic order');
    assert(identity.payload.identity?.name === fixture.patient.name && referencedId(identity.payload.order?._id) === notification.orderId, 'Consented lab identity did not match the patient and order.');
    same(Object.keys(identity.payload.identity).sort(), ['age', 'gender', 'name', 'phone'], 'bounded consent identity fields');
    expectStatus(await call(identityPath, { token: otherLabToken }), 404, 'other laboratory patient-consented identity');
    const dashboard = await call(`/api/lab/dashboard/${laboratoryId}`, { token: laboratory.token });
    expectSuccess(dashboard, 200, 'consented laboratory worklist');
    const workItem = dashboard.payload.worklist.find((item) => referencedId(item.grant_id) === grantId);
    assert(workItem?.grant_status === 'ACTIVE' && referencedId(workItem.diagnostic_order?._id) === notification.orderId, 'Laboratory worklist omitted the patient-consented order.');

    return {
      fixture: { ...apiFixture, order, grant },
      encounterIds: [encounterId, revisitId],
      completedConsultations: 2,
    };
  } finally {
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
  }
}

module.exports = { runPatientWorkflow };
