const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');

const {
  Patient,
  Doctor,
  Laboratory,
  Encounter,
  SymptomIntake,
  LabAccessGrant,
  DiagnosticReport,
  ReportFile,
  LabObservation,
  DiagnosticOrder,
  AuditEvent,
  AIArtifact,
  ConsultationNote,
  Notification,
} = require('../models');
const { requireAuth, requireRole } = require('../middleware/requireAuth');
const { publicProvider, resolveProvider } = require('../services/providerService');
const { downloadOriginalPdf } = require('../services/reportFiles');
const { normalizeLanguage } = require('../services/languageService');
const {
  MAX_AUDIO_BYTES,
  SUPPORTED_AUDIO_MIME_TYPES,
  TranscriptionError,
  normalizeMimeType,
  transcribeAudio,
} = require('../services/transcriptionService');
const {
  PIPELINE_VERSION,
  processClinicalIntake,
  sanitizeClinicalIntake,
  isClinicalIntakeObject,
} = require('../services/clinicalIntakeService');

const router = express.Router();
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5, fieldSize: 32 * 1024, parts: 6 },
  fileFilter: (req, file, callback) => {
    if (!SUPPORTED_AUDIO_MIME_TYPES.has(normalizeMimeType(file.mimetype))) {
      const error = new Error('UNSUPPORTED_AUDIO_TYPE');
      error.code = 'UNSUPPORTED_AUDIO_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

router.use(requireAuth, requireRole('PATIENT'));

router.use('/encounters/:encounterId/intake', (req, res, next) => {
  if (req.body == null) req.body = {};
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: 'INVALID_INTAKE_REQUEST' });
  }
  return next();
});

async function getAuthenticatedPatient(req) {
  return Patient.findOne({ user_id: req.auth.sub });
}

function reportIdentifier(report) {
  return `CBC-${String(report._id).slice(-6).toUpperCase()}`;
}

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function lifecycleState(encounter) {
  if (encounter.status === 'CLOSED') return 'CONSULTATION_COMPLETED';
  if (encounter.queue_status === 'INTAKE_PENDING') return 'INTAKE_PENDING';
  if (encounter.queue_status === 'DOCTOR_REVIEWING') return 'DOCTOR_REVIEWING';
  if (encounter.queue_status === 'IN_CONSULTATION') return 'CONSULTATION_STARTED';
  if (encounter.queue_status === 'CALLED') return 'PLEASE_COME_IN';
  return 'WAITING';
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function intakeDocumentFields(structuredData, inputMode, patientId, encounterId) {
  const clinical = structuredData.clinical_intake || {};
  const confidence = structuredData.confidence || {};
  const transcript = structuredData.transcript || {};
  return {
    encounter_id: encounterId,
    patient_id: patientId,
    input_mode: inputMode,
    transcript: transcript.text || '',
    transcription_source: transcript.source || '',
    transcription_confidence: Number(confidence.transcription || 0),
    language: structuredData.selected_language || '',
    detected_language: structuredData.detected_language || '',
    language_confidence: Number(structuredData.language_confidence || confidence.language || 0),
    chief_complaint: clinical.chief_complaint || '',
    duration: clinical.duration || '',
    symptoms: Array.isArray(clinical.symptoms) ? clinical.symptoms : [],
    negative_symptoms: Array.isArray(clinical.negative_symptoms) ? clinical.negative_symptoms : [],
    possible_symptom_categories: Array.isArray(clinical.possible_symptom_categories) ? clinical.possible_symptom_categories : [],
    relevant_history: Array.isArray(clinical.relevant_history) ? clinical.relevant_history : [],
    medications: Array.isArray(clinical.medications) ? clinical.medications : [],
    allergies: Array.isArray(clinical.allergies) ? clinical.allergies : [],
    allergy_status: clinical.allergy_status || 'UNKNOWN',
    urgency: clinical.urgency || '',
    structured_data: structuredData,
    confidence: Number(confidence.overall || 0),
    provenance: structuredData.provenance || {},
    extraction_status: structuredData.extraction_status || 'READY',
    pipeline_version: structuredData.pipeline_version || PIPELINE_VERSION,
    patient_confirmed: Boolean(structuredData.patient_confirmed),
    patient_confirmed_at: structuredData.patient_confirmed_at || null,
    confirmed_at: structuredData.patient_confirmed_at || null,
  };
}

async function getOwnedOpenEncounter(req, patient) {
  if (!patient || !isValidObjectId(req.params.encounterId)) return null;
  return Encounter.findOne({
    _id: req.params.encounterId,
    patient_id: patient._id,
    status: 'OPEN',
  });
}

async function getOpenPatientEncounter(patient) {
  if (!patient) return null;
  return Encounter.findOne({
    patient_id: patient._id,
    status: 'OPEN',
  })
    .populate('doctor_id')
    .sort({ created_at: -1 });
}

function patientEncounterPayload(encounter, patient, fallbackDoctor = null) {
  const populatedDoctor = encounter.doctor_id && encounter.doctor_id.name
    ? encounter.doctor_id
    : null;
  const doctor = populatedDoctor || fallbackDoctor;
  return {
    id: encounter._id,
    _id: encounter._id,
    patient_id: patient._id,
    doctor_id: doctor?._id || encounter.doctor_id,
    doctor_name: doctor?.name,
    clinic_name: doctor?.clinic_name,
    doctor_code: doctor?.qr_code_id,
    visit_type: encounter.visit_type,
    status: encounter.status,
    queue_status: encounter.queue_status,
    lifecycle_state: lifecycleState(encounter),
    queue_number: encounter.queue_number,
    created_at: encounter.created_at,
    started_at: encounter.started_at,
    ended_at: encounter.ended_at,
  };
}

async function savePreparedIntake({ req, patient, encounter, inputMode, structuredData, audioDeleted = false }) {
  const owner = { encounter_id: encounter._id, patient_id: patient._id };
  const existing = await SymptomIntake.findOne(owner);
  if (isConfirmedIntake(existing)) throw intakeConflict('INTAKE_ALREADY_CONFIRMED');

  const fields = intakeDocumentFields(structuredData, inputMode, patient._id, encounter._id);
  fields.audio_deleted = audioDeleted;
  fields.updated_at = new Date();
  let intake;
  try {
    // A conditional write protects both confirmation and concurrent draft edits.
    // The unique encounter index arbitrates simultaneous first preparations.
    intake = await SymptomIntake.findOneAndUpdate(
      { ...owner, ...unconfirmedIntakeFilter(existing) },
      { $set: fields, $inc: { __v: 1 } },
      { upsert: !existing, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  } catch (error) {
    if (error.code === 11000) throw intakeConflict();
    throw error;
  }
  if (!intake) throw intakeConflict();

  await AIArtifact.create({
    encounter_id: encounter._id,
    artifact_type: 'STRUCTURED_CLINICAL_INTAKE',
    content: structuredData,
    source_reference: intake._id.toString(),
  });
  await AuditEvent.create({
    actor_type: 'PATIENT',
    actor_id: patient._id.toString(),
    action: structuredData.extraction_status === 'READY'
      ? 'PATIENT_INTAKE_EXTRACTION'
      : 'PATIENT_INTAKE_EXTRACTION_FAILED',
    resource_type: 'SymptomIntake',
    resource_id: intake._id.toString(),
    patient_id: patient._id,
    outcome: structuredData.extraction_status === 'READY' ? 'SUCCESS' : 'FAILED',
    details: {
      input_mode: inputMode,
      pipeline_version: PIPELINE_VERSION,
      extraction_status: structuredData.extraction_status,
    },
  });
  return intake;
}

function isConfirmedIntake(intake) {
  return Boolean(intake?.patient_confirmed || intake?.confirmed_at || intake?.patient_confirmed_at);
}

function intakeConflict(code = 'INTAKE_CHANGED') {
  return Object.assign(new Error('The intake changed. Refresh it before continuing.'), { code });
}

function unconfirmedIntakeFilter(intake) {
  return {
    patient_confirmed: { $ne: true },
    confirmed_at: null,
    patient_confirmed_at: null,
    ...(intake ? { _id: intake._id, __v: intake.__v ?? { $exists: false } } : {}),
  };
}

async function releaseConfirmedIntake(encounter, patient) {
  const owner = { _id: encounter._id, patient_id: patient._id, status: 'OPEN' };
  const result = await Encounter.updateOne(
    { ...owner, queue_status: 'INTAKE_PENDING' },
    { $set: { queue_status: 'WAITING' } },
  );
  // Never move a doctor's active consultation back to WAITING.
  if (!result.matchedCount && !await Encounter.exists(owner)) throw intakeConflict('ENCOUNTER_NOT_OPEN');
}

function uploadAudio(req, res, next) {
  return audioUpload.single('audio')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'AUDIO_TOO_LARGE' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.message === 'Unexpected field') {
      return res.status(400).json({ success: false, error: 'INVALID_AUDIO_FIELD' });
    }
    if (error.code === 'LIMIT_FIELD_VALUE') return res.status(413).json({ success: false, error: 'PATIENT_TEXT_TOO_LARGE' });
    if (error.code !== 'UNSUPPORTED_AUDIO_TYPE') return res.status(400).json({ success: false, error: 'INVALID_AUDIO_UPLOAD' });
    return res.status(400).json({ success: false, error: 'UNSUPPORTED_AUDIO_TYPE' });
  });
}

function explanationForObservation(observation) {
  if (observation.reference_low === null || observation.reference_high === null) {
    return `Your ${observation.test_name_normalized} was ${observation.value} ${observation.unit || ''}. The laboratory did not provide a reference range.`.trim();
  }
  const position = observation.flag === 'HIGH'
    ? 'above'
    : observation.flag === 'LOW'
      ? 'below'
      : 'within';
  return `Your ${observation.test_name_normalized} was ${observation.value} ${observation.unit || ''}. The laboratory reference range is ${observation.reference_low}–${observation.reference_high} ${observation.unit || ''}. This is ${position} that range.`.trim();
}

async function toReportResponse(report) {
  const [observations, file, order] = await Promise.all([
    LabObservation.find({ report_id: report._id }).sort({ created_at: 1 }),
    ReportFile.findOne({ report_id: report._id }),
    DiagnosticOrder.findById(report.diagnostic_order_id).populate('doctor_id'),
  ]);

  return {
    _id: report._id,
    report_identifier: reportIdentifier(report),
    patient_name: report.patient_id?.name,
    patient_identifier: report.patient_id?.patient_identifier,
    laboratory_name: report.laboratory_id?.name,
    laboratory_code: report.laboratory_id?.qr_code_id,
    ordering_doctor: order?.doctor_id?.name
      ? `${order.doctor_id.name} (${order.doctor_id.qr_code_id})`
      : 'Registered Doctor',
    test_type: report.test_type,
    status: report.status,
    created_at: report.created_at,
    published_at: report.published_at,
    original_file_name: file?.original_file_name || report.original_file_name,
    original_file_available: Boolean(file),
    original_file_url: file ? `/api/patient/reports/${report._id}/original` : null,
    report_hash: file?.sha256 || report.report_hash,
    observations: observations.map((observation) => ({
      _id: observation._id,
      test_name_original: observation.test_name_original,
      test_name_normalized: observation.test_name_normalized,
      value: observation.value,
      unit: observation.unit,
      reference_low: observation.reference_low,
      reference_high: observation.reference_high,
      flag: observation.flag,
      validation_status: observation.validation_status,
      confidence: observation.extraction_confidence,
      explanation: explanationForObservation(observation),
    })),
  };
}

function timelineEvent({ id, type, title, subtitle, timestamp, badge, details }) {
  return { id: String(id), type, title, subtitle, timestamp, badge, details };
}

router.get('/reports', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });

    const reports = await DiagnosticReport.find({
      patient_id: patient._id,
      status: 'PUBLISHED',
    })
      .populate('patient_id laboratory_id')
      .sort({ published_at: -1 });

    return res.json({
      success: true,
      reports: await Promise.all(reports.map(toReportResponse)),
    });
  } catch (error) {
    console.error('Patient report list error:', error);
    return res.status(500).json({ success: false, error: 'PATIENT_REPORTS_FAILED' });
  }
});

router.get('/reports/:reportId', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient || !isValidObjectId(req.params.reportId)) {
      return res.status(404).json({ success: false, error: 'PUBLISHED_REPORT_NOT_FOUND' });
    }
    const report = await DiagnosticReport.findOne({
      _id: req.params.reportId,
      patient_id: patient?._id,
      status: 'PUBLISHED',
    }).populate('patient_id laboratory_id');

    if (!report) return res.status(404).json({ success: false, error: 'PUBLISHED_REPORT_NOT_FOUND' });

    await AuditEvent.create({
      actor_type: 'PATIENT',
      actor_id: patient._id.toString(),
      action: 'PATIENT_VIEWED_PUBLISHED_REPORT',
      resource_type: 'DiagnosticReport',
      resource_id: report._id.toString(),
      patient_id: patient._id,
      outcome: 'SUCCESS',
    });

    return res.json({ success: true, report: await toReportResponse(report) });
  } catch (error) {
    console.error('Patient report detail error:', error);
    return res.status(500).json({ success: false, error: 'PATIENT_REPORT_FAILED' });
  }
});

router.get('/reports/:reportId/original', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient || !isValidObjectId(req.params.reportId)) {
      return res.status(404).json({ success: false, error: 'PUBLISHED_REPORT_NOT_FOUND' });
    }
    const report = await DiagnosticReport.findOne({
      _id: req.params.reportId,
      patient_id: patient._id,
      status: 'PUBLISHED',
    });
    const originalFile = report ? await ReportFile.findOne({ report_id: report._id }) : null;
    if (!report || !originalFile) {
      return res.status(404).json({ success: false, error: 'ORIGINAL_REPORT_FILE_NOT_FOUND' });
    }

    return downloadOriginalPdf(res, originalFile);
  } catch (error) {
    console.error('Patient original report download error:', error);
    return res.status(500).json({ success: false, error: 'ORIGINAL_REPORT_DOWNLOAD_FAILED' });
  }
});

router.get('/lab-grants', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });

    const grants = await LabAccessGrant.find({ patient_id: patient._id })
      .populate('laboratory_id')
      .sort({ _id: -1 });

    return res.json({
      success: true,
      grants: grants.map((grant) => ({
        id: grant._id,
        patient_id: patient._id,
        laboratory_id: grant.laboratory_id?._id,
        laboratory_name: grant.laboratory_id?.name,
        laboratory_code: grant.laboratory_id?.qr_code_id,
        shared_fields: grant.shared_fields,
        status: grant.status,
        diagnostic_order_id: grant.diagnostic_order_id,
        published_report_id: grant.published_report_id,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PATIENT_GRANTS_FAILED' });
  }
});

router.post('/lab-grants', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    const provider = await resolveProvider(req.body.laboratory_code);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });
    if (!provider || provider.provider_type !== 'LABORATORY') {
      return res.status(400).json({ success: false, error: 'LABORATORY_NOT_FOUND_OR_UNAPPROVED' });
    }

    let orderId = req.body.diagnostic_order_id || null;
    if (orderId && (!isValidObjectId(orderId) || !await DiagnosticOrder.exists({
      _id: orderId, patient_id: patient._id, status: 'ORDERED',
    }))) {
      return res.status(400).json({ success: false, error: 'INVALID_DIAGNOSTIC_ORDER' });
    }
    if (!orderId) {
      const latestOrder = await DiagnosticOrder.findOne({ patient_id: patient._id, status: 'ORDERED' })
        .sort({ created_at: -1 })
        .select('_id');
      orderId = latestOrder?._id || null;
    }

    const existing = await LabAccessGrant.findOne({
      patient_id: patient._id,
      laboratory_id: provider.provider_id,
      status: 'ACTIVE',
      ...(orderId ? { diagnostic_order_id: orderId } : {}),
    });
    if (existing) {
      return res.json({ success: true, grant: existing, already_active: true });
    }

    const grant = await LabAccessGrant.create({
      patient_id: patient._id,
      laboratory_id: provider.provider_id,
      diagnostic_order_id: orderId,
      shared_fields: ['name', 'date_of_birth', 'gender', 'phone'],
      status: 'ACTIVE',
    });

    await AuditEvent.create({
      actor_type: 'PATIENT',
      actor_id: patient._id.toString(),
      action: 'APPROVE_LAB_IDENTITY_SHARING',
      resource_type: 'LabAccessGrant',
      resource_id: grant._id.toString(),
      patient_id: patient._id,
      outcome: 'SUCCESS',
      details: { laboratory_code: provider.provider_code, exposed_fields: grant.shared_fields },
    });

    return res.status(201).json({
      success: true,
      grant: {
        id: grant._id,
        patient_id: patient._id,
        laboratory_id: provider.provider_id,
        laboratory_name: provider.provider.name,
         laboratory_code: provider.provider_code,
         shared_fields: grant.shared_fields,
         status: grant.status,
         diagnostic_order_id: grant.diagnostic_order_id,
       },
    });
  } catch (error) {
    console.error('Patient lab grant error:', error);
    return res.status(500).json({ success: false, error: 'LAB_GRANT_FAILED' });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });

    const [encounters, intakes, notes, orders, reports] = await Promise.all([
      Encounter.find({ patient_id: patient._id }).populate('doctor_id').sort({ created_at: -1 }),
      SymptomIntake.find({ patient_id: patient._id }).sort({ created_at: -1 }),
      ConsultationNote.find({ patient_id: patient._id }).sort({ created_at: -1 }),
      DiagnosticOrder.find({ patient_id: patient._id }).populate('doctor_id').sort({ created_at: -1 }),
      DiagnosticReport.find({ patient_id: patient._id, status: 'PUBLISHED' }).populate('laboratory_id').sort({ published_at: -1 }),
    ]);

    const intakesByEncounter = new Map(intakes.map((item) => [String(item.encounter_id), item]));
    const notesByEncounter = new Map(notes.map((item) => [String(item.encounter_id), item]));
    const ordersByEncounter = new Map();
    orders.forEach((order) => {
      const key = String(order.encounter_id);
      if (!ordersByEncounter.has(key)) ordersByEncounter.set(key, []);
      ordersByEncounter.get(key).push(order);
    });
    const reportsByOrder = new Map(reports.map((report) => [String(report.diagnostic_order_id), report]));

    const consultations = encounters.map((encounter) => {
      const encounterId = String(encounter._id);
      const intake = intakesByEncounter.get(encounterId);
      const orderDetails = (ordersByEncounter.get(encounterId) || []).map((order) => {
        const report = reportsByOrder.get(String(order._id));
        return {
          id: order._id,
          test_type: order.test_type,
          clinical_notes: order.clinical_notes,
          status: order.status,
          created_at: order.created_at,
          report: report ? {
            id: report._id,
            status: report.status,
            laboratory_name: report.laboratory_id?.name || 'Registered Laboratory',
            published_at: report.published_at,
          } : null,
        };
      });
      return timelineEvent({
        id: `consultation-${encounter._id}`,
        type: 'CONSULTATION',
        title: `${encounter.visit_type === 'REVISITING' ? 'Revisiting' : 'New'} consultation`,
        subtitle: `${encounter.doctor_id?.name || 'Doctor'} • ${encounter.status === 'CLOSED' ? 'Completed' : 'Open'}`,
        timestamp: encounter.created_at,
        badge: encounter.status,
        details: {
          encounter_id: encounter._id,
          visit_type: encounter.visit_type,
          status: encounter.status,
          created_at: encounter.created_at,
          started_at: encounter.started_at,
          ended_at: encounter.ended_at,
          doctor: encounter.doctor_id ? {
            id: encounter.doctor_id._id,
            name: encounter.doctor_id.name,
            specialty: encounter.doctor_id.specialty,
            clinic_name: encounter.doctor_id.clinic_name,
          } : null,
          intake: intake ? {
            created_at: intake.created_at,
            input_mode: intake.input_mode,
            transcript: intake.transcript,
            chief_complaint: intake.chief_complaint,
            duration: intake.duration,
            symptoms: intake.symptoms,
            structured_data: intake.structured_data,
          } : null,
          consultation_note: notesByEncounter.get(encounterId)?.notes_text || '',
          diagnostic_orders: orderDetails,
        },
      });
    });

    return res.json({ success: true, consultations });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PATIENT_TIMELINE_FAILED' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });
    const filter = { patient_id: patient._id };
    const notifications = await Notification.find(filter)
      .populate('doctor_id', 'name specialty clinic_name')
      .populate('diagnostic_order_id', 'test_type clinical_notes status created_at')
      .sort({ created_at: -1 })
      .limit(30);
    return res.json({
      success: true,
      notifications,
      unread_count: await Notification.countDocuments({ ...filter, read: false }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PATIENT_NOTIFICATIONS_FAILED' });
  }
});

router.post('/notifications/:notificationId/read', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient || !isValidObjectId(req.params.notificationId)) {
      return res.status(404).json({ success: false, error: 'NOTIFICATION_NOT_FOUND' });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, patient_id: patient._id },
      { read: true },
      { new: true },
    );
    if (!notification) return res.status(404).json({ success: false, error: 'NOTIFICATION_NOT_FOUND' });
    return res.json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PATIENT_NOTIFICATION_UPDATE_FAILED' });
  }
});

router.post('/notifications/read-all', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });
    await Notification.updateMany({ patient_id: patient._id, read: false }, { read: true });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PATIENT_NOTIFICATION_UPDATE_FAILED' });
  }
});

router.post('/encounters', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });

    const ongoing = await getOpenPatientEncounter(patient);
    if (ongoing) {
      return res.status(409).json({
        success: false,
        error: 'ONGOING_CONSULTATION',
        encounter: patientEncounterPayload(ongoing, patient),
      });
    }

    const provider = await resolveProvider(req.body.doctor_code);
    if (!provider || provider.provider_type !== 'DOCTOR') {
      return res.status(400).json({ success: false, error: 'DOCTOR_NOT_FOUND' });
    }
    if (!['NEW', 'REVISITING'].includes(req.body.visit_type)) {
      return res.status(400).json({ success: false, error: 'INVALID_VISIT_TYPE' });
    }

    const encounter = await Encounter.create({
      patient_id: patient._id,
      doctor_id: provider.provider_id,
      visit_type: req.body.visit_type,
      status: 'OPEN',
      queue_status: 'INTAKE_PENDING',
    });

    await AuditEvent.create({
      actor_type: 'PATIENT',
      actor_id: patient._id.toString(),
      action: 'PATIENT_OPENED_DOCTOR_ENCOUNTER',
      resource_type: 'Encounter',
      resource_id: encounter._id.toString(),
      patient_id: patient._id,
      outcome: 'SUCCESS',
      details: { doctor_code: provider.provider_code, visit_type: encounter.visit_type },
    });

    return res.status(201).json({
      success: true,
      encounter: patientEncounterPayload(encounter, patient, provider.provider),
    });
  } catch (error) {
    if (error.code === 11000) {
      const patient = await getAuthenticatedPatient(req).catch(() => null);
      const ongoing = await getOpenPatientEncounter(patient).catch(() => null);
      if (patient && ongoing) {
        return res.status(409).json({
          success: false,
          error: 'ONGOING_CONSULTATION',
          encounter: patientEncounterPayload(ongoing, patient),
        });
      }
    }
    console.error('Patient encounter creation error:', error);
    return res.status(500).json({ success: false, error: 'ENCOUNTER_CREATE_FAILED' });
  }
});

router.get('/active-encounter', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient) return res.status(404).json({ success: false, error: 'PATIENT_PROFILE_NOT_FOUND' });
    const encounter = await getOpenPatientEncounter(patient);
    return res.json({
      success: true,
      encounter: encounter ? patientEncounterPayload(encounter, patient) : null,
    });
  } catch (error) {
    console.error('Patient active encounter lookup error:', error);
    return res.status(500).json({ success: false, error: 'ACTIVE_ENCOUNTER_LOOKUP_FAILED' });
  }
});

router.post('/encounters/:encounterId/end', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient || !isValidObjectId(req.params.encounterId)) {
      return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });
    }
    const encounter = await Encounter.findOne({
      _id: req.params.encounterId,
      patient_id: patient._id,
    }).populate('doctor_id');
    if (!encounter) return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });
    if (encounter.status === 'CLOSED') {
      return res.status(409).json({ success: false, error: 'ENCOUNTER_ALREADY_CLOSED' });
    }

    encounter.status = 'CLOSED';
    encounter.ended_at = new Date();
    await encounter.save();
    await SymptomIntake.updateMany(
      { encounter_id: encounter._id, patient_id: patient._id },
      { $set: { audio_deleted: true } },
    );
    await AuditEvent.create({
      actor_type: 'PATIENT',
      actor_id: patient._id.toString(),
      action: 'CONSULTATION_ENDED_BOUNDED_ACCESS_TERMINATED',
      resource_type: 'Encounter',
      resource_id: encounter._id.toString(),
      patient_id: patient._id,
      outcome: 'SUCCESS',
      details: {
        ended_at: encounter.ended_at,
        raw_audio_deleted: true,
        retained: ['transcript', 'structured_intake', 'consultation_notes', 'audit_ledger'],
      },
    });

    return res.json({
      success: true,
      encounter: patientEncounterPayload(encounter, patient),
    });
  } catch (error) {
    console.error('Patient end consultation error:', error);
    return res.status(500).json({ success: false, error: 'PATIENT_END_FAILED' });
  }
});

router.post('/encounters/:encounterId/intake/skip', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    const encounter = await getOwnedOpenEncounter(req, patient);
    if (!encounter) return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });
    if (encounter.visit_type !== 'REVISITING') return res.status(400).json({ success: false, error: 'NEW_CONSULTATION_INTAKE_REQUIRED' });

    const structuredData = {
      schema_version: PIPELINE_VERSION,
      selected_language: '',
      detected_language: '',
      language_match: null,
      language_confidence: 0,
      transcript: { text: '', source: 'PATIENT_TYPED', created_at: new Date().toISOString() },
      clinical_intake: {
        chief_complaint: '', duration: '', symptoms: [], negative_symptoms: [],
        possible_symptom_categories: [], relevant_history: [], medications: [], allergies: [],
        allergy_status: 'UNKNOWN', urgency: '',
      },
      confidence: { transcription: 0, language: 0, chief_complaint: 0, symptoms: 0, duration: 0, category: 0, allergies: 0, urgency: 0, overall: 0 },
      provenance: { original_text: 'PATIENT_TYPED', detected_language: 'UNKNOWN', structured_fields: 'PATIENT_EDITED', field_provenance: {} },
      patient_confirmed: false,
      patient_confirmed_at: null,
      extraction_status: 'SKIPPED',
      pipeline_version: PIPELINE_VERSION,
    };
    const intake = await savePreparedIntake({ req, patient, encounter, inputMode: 'SKIPPED', structuredData, audioDeleted: true });
    return res.status(201).json({ success: true, intake, encounter_id: encounter._id });
  } catch (error) {
    if (['INTAKE_ALREADY_CONFIRMED', 'INTAKE_CHANGED'].includes(error.code)) return res.status(409).json({ success: false, error: error.code });
    console.error('Patient skipped intake error:', error.name || 'Error');
    return res.status(500).json({ success: false, error: 'INTAKE_PROCESSING_FAILED' });
  }
});

router.post('/encounters/:encounterId/intake/process-text', async (req, res) => {
  try {
    if (req.body.input_mode && String(req.body.input_mode).toUpperCase() !== 'TEXT') {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT_MODE' });
    }
    const patient = await getAuthenticatedPatient(req);
    const encounter = await getOwnedOpenEncounter(req, patient);
    if (!encounter) return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });

    const text = typeof req.body.text === 'string' ? req.body.text : '';
    if (text.length > 8000) {
      await AuditEvent.create({ actor_type: 'PATIENT', actor_id: patient._id.toString(), action: 'PATIENT_INTAKE_EXTRACTION_FAILED', resource_type: 'Encounter', resource_id: encounter._id.toString(), patient_id: patient._id, outcome: 'FAILED', details: { reason: 'PATIENT_TEXT_TOO_LARGE' } });
      return res.status(413).json({ success: false, error: 'PATIENT_TEXT_TOO_LARGE' });
    }
    const selectedLanguage = normalizeLanguage(req.body.language, null);
    if (!selectedLanguage) return res.status(400).json({ success: false, error: 'UNSUPPORTED_LANGUAGE' });
    if (!text.trim()) {
      await AuditEvent.create({ actor_type: 'PATIENT', actor_id: patient._id.toString(), action: 'PATIENT_INTAKE_EXTRACTION_FAILED', resource_type: 'Encounter', resource_id: encounter._id.toString(), patient_id: patient._id, outcome: 'FAILED', details: { reason: 'EMPTY_PATIENT_TEXT' } });
      return res.status(400).json({ success: false, error: 'EMPTY_PATIENT_TEXT' });
    }
    const structuredData = await processClinicalIntake({
      text,
      selectedLanguage,
      inputMode: 'TEXT',
      transcriptSource: 'PATIENT_TYPED',
      transcriptionConfidence: 1,
    });
    const intake = await savePreparedIntake({
      req,
      patient,
      encounter,
      inputMode: 'TEXT',
      structuredData,
      audioDeleted: true,
    });
    return res.status(201).json({ success: true, intake, encounter_id: encounter._id });
  } catch (error) {
    if (error.code === 'EMPTY_PATIENT_TEXT') return res.status(400).json({ success: false, error: error.code });
    if (['INTAKE_ALREADY_CONFIRMED', 'INTAKE_CHANGED'].includes(error.code)) return res.status(409).json({ success: false, error: error.code });
    console.error('Patient text intake processing error:', error.name || 'Error');
    return res.status(500).json({ success: false, error: 'INTAKE_PROCESSING_FAILED' });
  }
});

router.post('/encounters/:encounterId/intake/process-voice', uploadAudio, async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    const encounter = await getOwnedOpenEncounter(req, patient);
    if (!encounter) return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });

    if (req.body.input_mode && String(req.body.input_mode).toUpperCase() !== 'VOICE') {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT_MODE' });
    }
    const selectedLanguage = normalizeLanguage(req.body.language, null);
    if (!selectedLanguage) return res.status(400).json({ success: false, error: 'UNSUPPORTED_LANGUAGE' });
    const browserTranscript = typeof req.body.browser_transcript === 'string' ? req.body.browser_transcript : '';
    if (browserTranscript.length > 8000) {
      await AuditEvent.create({
        actor_type: 'PATIENT',
        actor_id: patient._id.toString(),
        action: 'PATIENT_INTAKE_EXTRACTION_FAILED',
        resource_type: 'Encounter',
        resource_id: encounter._id.toString(),
        patient_id: patient._id,
        outcome: 'FAILED',
        details: { reason: 'PATIENT_TEXT_TOO_LARGE', input_mode: 'VOICE' },
      });
      return res.status(413).json({ success: false, error: 'PATIENT_TEXT_TOO_LARGE' });
    }
    const reliableValue = req.body.transcript_reliable ?? true;
    if (![true, false, 'true', 'false'].includes(reliableValue)) {
      return res.status(400).json({ success: false, error: 'INVALID_TRANSCRIPT_RELIABILITY' });
    }
    const browserReliable = reliableValue === true || reliableValue === 'true';
    let transcript;
    let transcriptSource;
    let detectedLanguage;
    let languageConfidence;
    let transcriptionConfidence;

    if (browserReliable && browserTranscript.trim()) {
      transcript = browserTranscript;
      transcriptSource = 'BROWSER_TRANSCRIPT';
      // buildClinicalIntake independently detects this text, so a browser
      // recognition language can never be mistaken for the selected hint.
      transcriptionConfidence = 0.75;
    } else {
      if (!req.file) return res.status(400).json({ success: false, error: 'VOICE_INPUT_REQUIRED' });
      const transcription = await transcribeAudio({
        audioBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        preferredLanguage: selectedLanguage,
      });
      transcript = transcription.transcript;
      transcriptSource = 'SERVER_TRANSCRIPTION';
      detectedLanguage = transcription.detected_language;
      languageConfidence = transcription.language_confidence;
      transcriptionConfidence = transcription.transcription_confidence;
    }

    const structuredData = await processClinicalIntake({
      text: transcript,
      selectedLanguage,
      inputMode: 'VOICE',
      transcriptSource,
      detectedLanguage,
      languageConfidence,
      transcriptionConfidence,
    });
    const intake = await savePreparedIntake({
      req,
      patient,
      encounter,
      inputMode: 'VOICE',
      structuredData,
      audioDeleted: true,
    });
    return res.status(201).json({ success: true, intake, encounter_id: encounter._id });
  } catch (error) {
    if (['INTAKE_ALREADY_CONFIRMED', 'INTAKE_CHANGED'].includes(error.code)) return res.status(409).json({ success: false, error: error.code });
    if (error instanceof TranscriptionError) {
      await AuditEvent.create({
        actor_type: 'PATIENT',
        actor_id: req.auth.sub,
        action: 'PATIENT_VOICE_TRANSCRIPTION_FAILED',
        resource_type: 'Encounter',
        resource_id: req.params.encounterId,
        outcome: 'FAILED',
        details: { reason: error.code },
      }).catch(() => undefined);
      const status = error.code === 'AUDIO_TOO_LARGE' ? 413
        : ['EMPTY_AUDIO', 'UNSUPPORTED_AUDIO_TYPE'].includes(error.code) ? 400
          : error.code === 'VOICE_TRANSCRIPTION_UNAVAILABLE' ? 503
            : error.code === 'TRANSCRIPTION_TIMEOUT' ? 504 : 502;
      return res.status(status).json({ success: false, error: error.code, message: error.message });
    }
    if (error.code === 'EMPTY_PATIENT_TEXT') return res.status(400).json({ success: false, error: error.code });
    console.error('Patient voice intake processing error:', error.name || 'Error');
    return res.status(500).json({ success: false, error: 'INTAKE_PROCESSING_FAILED' });
  } finally {
    if (req.file?.buffer) {
      req.file.buffer.fill(0);
      delete req.file.buffer;
    }
  }
});

router.post('/encounters/:encounterId/intake/confirm', async (req, res) => {
  try {
    if (req.body.patient_confirmed !== true) return res.status(400).json({ success: false, error: 'PATIENT_CONFIRMATION_REQUIRED' });
    const patient = await getAuthenticatedPatient(req);
    const encounter = await getOwnedOpenEncounter(req, patient);
    if (!encounter) return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });
    let intake = await SymptomIntake.findOne({ encounter_id: encounter._id, patient_id: patient._id });
    if (!intake) return res.status(404).json({ success: false, error: 'INTAKE_NOT_PREPARED' });
    if (isConfirmedIntake(intake)) {
      // Recover the second write if a previous confirmation saved successfully
      // but the queue update failed. Confirmed clinical content stays immutable.
      if (encounter.queue_status !== 'INTAKE_PENDING') return res.status(409).json({ success: false, error: 'INTAKE_ALREADY_CONFIRMED' });
      await releaseConfirmedIntake(encounter, patient);
      return res.json({ success: true, intake, encounter_id: encounter._id });
    }

    const inputMode = String(req.body.input_mode || intake.input_mode).toUpperCase();
    if (!['VOICE', 'TEXT', 'SKIPPED'].includes(inputMode)) return res.status(400).json({ success: false, error: 'INVALID_INPUT_MODE' });
    if (inputMode !== intake.input_mode) return res.status(400).json({ success: false, error: 'INPUT_MODE_MISMATCH' });
    if (encounter.visit_type === 'NEW' && inputMode === 'SKIPPED') {
      return res.status(400).json({ success: false, error: 'NEW_CONSULTATION_INTAKE_REQUIRED' });
    }

    let clinical;
    if (inputMode === 'SKIPPED') {
      clinical = sanitizeClinicalIntake({});
    } else {
      const supplied = req.body.structured_data;
      const incoming = supplied === undefined ? intake.structured_data?.clinical_intake
        : supplied && Object.hasOwn(supplied, 'clinical_intake') ? supplied.clinical_intake : supplied;
      if (!isClinicalIntakeObject(incoming)) return res.status(400).json({ success: false, error: 'INVALID_CLINICAL_INTAKE' });
      if (supplied?.transcript?.created_at && supplied.transcript.created_at !== intake.structured_data?.transcript?.created_at) {
        return res.status(409).json({ success: false, error: 'INTAKE_CHANGED' });
      }
      clinical = sanitizeClinicalIntake(incoming);
      const hasConfirmedInformation = Boolean(
        clinical.chief_complaint || clinical.duration || clinical.symptoms.length
          || clinical.negative_symptoms.length || clinical.relevant_history.length
          || clinical.medications.length || clinical.allergies.length
          || clinical.allergy_status === 'NONE_REPORTED' || clinical.urgency,
      );
      if (encounter.visit_type === 'NEW' && !hasConfirmedInformation) {
        return res.status(422).json({ success: false, error: 'EXTRACTION_REVIEW_REQUIRED' });
      }
    }

    const oldClinical = intake.structured_data?.clinical_intake || {};
    const fieldProvenance = { ...(intake.structured_data?.provenance?.field_provenance || {}) };
    Object.keys(clinical).forEach((field) => {
      if (jsonEqual(oldClinical[field] ?? '', clinical[field])) {
        fieldProvenance[field] = fieldProvenance[field] || {
          source: 'DETERMINISTIC_FALLBACK',
          evidence: [],
        };
      } else {
        fieldProvenance[field] = {
          source: 'PATIENT_EDITED',
          evidence: clinical[field] && (!Array.isArray(clinical[field]) || clinical[field].length > 0)
            ? ['Patient-confirmed correction']
            : [],
        };
      }
    });
    const patientConfirmedAt = new Date();
    const structuredData = {
      ...(intake.structured_data || {}),
      schema_version: PIPELINE_VERSION,
      clinical_intake: clinical,
      extraction_status: inputMode === 'SKIPPED' ? 'SKIPPED' : 'READY',
      patient_confirmed: true,
      patient_confirmed_at: patientConfirmedAt.toISOString(),
      provenance: {
        ...(intake.structured_data?.provenance || {}),
        structured_fields: Object.values(fieldProvenance).some((item) => (typeof item === 'string' ? item : item?.source) === 'PATIENT_EDITED')
          ? 'PATIENT_EDITED'
          : (intake.structured_data?.provenance?.structured_fields || 'DETERMINISTIC_FALLBACK'),
        field_provenance: fieldProvenance,
      },
    };

    const fields = { ...intakeDocumentFields(structuredData, inputMode, patient._id, encounter._id),
      patient_confirmed: true,
      patient_confirmed_at: patientConfirmedAt,
      confirmed_at: patientConfirmedAt,
      extraction_status: structuredData.extraction_status,
      updated_at: patientConfirmedAt,
    };
    intake = await SymptomIntake.findOneAndUpdate(
      { encounter_id: encounter._id, patient_id: patient._id, ...unconfirmedIntakeFilter(intake) },
      { $set: fields, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
    if (!intake) return res.status(409).json({ success: false, error: 'INTAKE_CHANGED' });
    await releaseConfirmedIntake(encounter, patient);

    const changed = !jsonEqual(oldClinical, clinical);
    await AuditEvent.create({
      actor_type: 'PATIENT',
      actor_id: patient._id.toString(),
      action: changed ? 'PATIENT_CORRECTED_INTAKE' : 'PATIENT_CONFIRMED_SYMPTOM_INTAKE',
      resource_type: 'SymptomIntake',
      resource_id: intake._id.toString(),
      patient_id: patient._id,
      outcome: 'SUCCESS',
      details: {
        input_mode: inputMode,
        changed_fields: Object.keys(clinical).filter((field) => (typeof fieldProvenance[field] === 'string' ? fieldProvenance[field] : fieldProvenance[field]?.source) === 'PATIENT_EDITED'),
      },
    });
    return res.status(200).json({ success: true, intake, encounter_id: encounter._id });
  } catch (error) {
    if (error.code === 'ENCOUNTER_NOT_OPEN') return res.status(409).json({ success: false, error: error.code });
    console.error('Patient intake confirmation error:', error.name || 'Error');
    return res.status(500).json({ success: false, error: 'INTAKE_CONFIRMATION_FAILED' });
  }
});

// Legacy clients must explicitly use the prepare -> review -> confirm flow.
router.post('/encounters/:encounterId/intake', async (req, res) => {
  return res.status(409).json({
    success: false,
    error: 'INTAKE_REVIEW_REQUIRED',
    message: 'Prepare the intake before confirming it.',
  });
});

router.get('/encounters/:encounterId', async (req, res) => {
  try {
    const patient = await getAuthenticatedPatient(req);
    if (!patient || !isValidObjectId(req.params.encounterId)) {
      return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });
    }
    const encounter = await Encounter.findOne({
      _id: req.params.encounterId,
      patient_id: patient?._id,
    }).populate('doctor_id');
    if (!encounter) return res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });

    const intake = await SymptomIntake.findOne({ encounter_id: encounter._id, patient_id: patient._id });
    const lifecycleState = encounter.status === 'CLOSED'
      ? 'CONSULTATION_COMPLETED'
      : encounter.queue_status === 'IN_CONSULTATION'
        ? 'CONSULTATION_STARTED'
        : encounter.queue_status === 'CALLED'
          ? 'PLEASE_COME_IN'
          : encounter.queue_status;

    return res.json({
      success: true,
      encounter: {
        id: encounter._id,
        _id: encounter._id,
        patient_id: patient._id,
        doctor_id: encounter.doctor_id?._id,
        doctor_name: encounter.doctor_id?.name,
        clinic_name: encounter.doctor_id?.clinic_name,
        visit_type: encounter.visit_type,
        status: encounter.status,
        queue_status: encounter.queue_status,
        lifecycle_state: lifecycleState,
        queue_number: encounter.queue_number,
        created_at: encounter.created_at,
        started_at: encounter.started_at,
        ended_at: encounter.ended_at,
        intake,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'ENCOUNTER_LOOKUP_FAILED' });
  }
});

module.exports = router;
