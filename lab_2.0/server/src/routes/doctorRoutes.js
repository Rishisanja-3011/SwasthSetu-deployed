const express = require('express');
const mongoose = require('mongoose');

const {
  Doctor,
  Patient,
  Encounter,
  SymptomIntake,
  ConsultationNote,
  DiagnosticOrder,
  DiagnosticReport,
  LabObservation,
  AuditEvent,
  Notification,
} = require('../models');
const { requireAuth, requireRole } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth, requireRole('DOCTOR'));

async function loadOwnedDoctor(req, res, next) {
  try {
    const doctor = await Doctor.findOne({ user_id: req.auth.sub });
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'DOCTOR_PROFILE_NOT_FOUND' });
    }
    req.doctor = doctor;
    return next();
  } catch (error) {
    return next(error);
  }
}

router.use(loadOwnedDoctor);

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function publicDoctor(doctor, stats = {}) {
  return {
    id: doctor._id,
    _id: doctor._id,
    name: doctor.name,
    specialty: doctor.specialty,
    clinic_name: doctor.clinic_name,
    doctor_code: doctor.qr_code_id,
    qr_code_id: doctor.qr_code_id,
    ...stats,
  };
}

function lifecycleState(encounter) {
  if (encounter.status === 'CLOSED') return 'CONSULTATION_COMPLETED';
  if (encounter.queue_status === 'INTAKE_PENDING') return 'INTAKE_PENDING';
  if (encounter.queue_status === 'DOCTOR_REVIEWING') return 'DOCTOR_REVIEWING';
  if (encounter.queue_status === 'IN_CONSULTATION') return 'CONSULTATION_STARTED';
  if (encounter.queue_status === 'CALLED') return 'PLEASE_COME_IN';
  return 'WAITING';
}

function publicEncounter(encounter, queueNumber = encounter.queue_number) {
  const patient = encounter.patient_id;
  return {
    id: encounter._id,
    _id: encounter._id,
    patient_id: patient?._id || encounter.patient_id,
    doctor_id: encounter.doctor_id?._id || encounter.doctor_id,
    visit_type: encounter.visit_type,
    status: encounter.status,
    queue_status: encounter.queue_status,
    lifecycle_state: lifecycleState(encounter),
    queue_number: queueNumber,
    created_at: encounter.created_at,
    started_at: encounter.started_at,
    ended_at: encounter.ended_at,
  };
}

function publicIntake(intake) {
  if (!intake) return null;
  // A prepared but unconfirmed intake is visible only to its patient review
  // screen. It must never enter a doctor's queue or cockpit.
  if (intake.patient_confirmed !== true && !intake.confirmed_at) return null;
  const structuredData = intake.structured_data && typeof intake.structured_data === 'object'
    ? intake.structured_data
    : {};
  const clinicalIntake = structuredData.clinical_intake && typeof structuredData.clinical_intake === 'object'
    ? structuredData.clinical_intake
    : structuredData;
  const transcript = typeof intake.transcript === 'string' && intake.transcript.trim()
    ? intake.transcript
    : typeof structuredData.transcript === 'string'
      ? structuredData.transcript
      : structuredData.transcript?.text || '';
  const confidence = structuredData.confidence && typeof structuredData.confidence === 'object'
    ? structuredData.confidence.overall ?? intake.confidence
    : structuredData.confidence ?? intake.confidence;
  return {
    id: intake._id,
    _id: intake._id,
    encounter_id: intake.encounter_id,
    patient_id: intake.patient_id,
    input_mode: intake.input_mode,
    language: structuredData.language || structuredData.selected_language || intake.language || '',
    selected_language: structuredData.selected_language || intake.language || '',
    detected_language: structuredData.detected_language || intake.detected_language || '',
    language_match: structuredData.language_match ?? null,
    language_confidence: structuredData.language_confidence ?? intake.language_confidence ?? 0,
    transcription_source: structuredData.transcript?.source || intake.transcription_source || '',
    transcription_confidence: structuredData.confidence?.transcription ?? intake.transcription_confidence ?? 0,
    transcript,
    raw_transcript: transcript,
    chief_complaint: intake.chief_complaint || clinicalIntake.chief_complaint || '',
    duration: intake.duration || clinicalIntake.duration || '',
    symptoms: Array.isArray(intake.symptoms) && intake.symptoms.length > 0
      ? intake.symptoms
      : Array.isArray(clinicalIntake.symptoms) ? clinicalIntake.symptoms : [],
    negative_symptoms: Array.isArray(clinicalIntake.negative_symptoms) ? clinicalIntake.negative_symptoms : [],
    possible_symptom_categories: Array.isArray(clinicalIntake.possible_symptom_categories)
      ? clinicalIntake.possible_symptom_categories
      : [],
    allergies: Array.isArray(clinicalIntake.allergies) ? clinicalIntake.allergies : [],
    allergy_status: clinicalIntake.allergy_status || '',
    relevant_history: Array.isArray(clinicalIntake.relevant_history) ? clinicalIntake.relevant_history : [],
    medications: Array.isArray(clinicalIntake.medications) ? clinicalIntake.medications : [],
    urgency: clinicalIntake.urgency || '',
    extraction_status: structuredData.extraction_status || intake.extraction_status || '',
    session_created_at: intake.created_at,
    structured_data: intake.structured_data,
    confidence,
    provenance: structuredData.provenance || intake.provenance,
    patient_confirmed: intake.patient_confirmed === true || Boolean(intake.confirmed_at),
    patient_confirmed_at: intake.patient_confirmed_at || intake.confirmed_at,
    pipeline_version: structuredData.pipeline_version || intake.pipeline_version || '',
    confirmed_at: intake.confirmed_at,
    audio_deleted: intake.audio_deleted,
    created_at: intake.created_at,
  };
}

async function ownedEncounter(req, res) {
  if (!isValidObjectId(req.params.encounterId)) {
    res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });
    return null;
  }

  const encounter = await Encounter.findOne({
    _id: req.params.encounterId,
    doctor_id: req.doctor._id,
  })
    .populate('patient_id')
    .populate('doctor_id');

  if (!encounter) {
    res.status(404).json({ success: false, error: 'ENCOUNTER_NOT_FOUND' });
    return null;
  }
  return encounter;
}

async function audit(req, encounter, action, outcome = 'SUCCESS', details = {}) {
  await AuditEvent.create({
    actor_type: 'DOCTOR',
    actor_id: req.doctor._id.toString(),
    action,
    resource_type: 'Encounter',
    resource_id: encounter._id.toString(),
    patient_id: encounter.patient_id?._id || encounter.patient_id,
    outcome,
    details,
  });
}

router.get('/list', async (req, res) => {
  return res.json({ success: true, doctors: [publicDoctor(req.doctor)] });
});

router.get('/profile/:doctorId', async (req, res) => {
  try {
    if (String(req.params.doctorId) !== String(req.doctor._id)) {
      return res.status(403).json({ success: false, error: 'DOCTOR_OWNERSHIP_REQUIRED' });
    }

    const [waitingCount, completedToday] = await Promise.all([
      Encounter.countDocuments({
        doctor_id: req.doctor._id,
        status: 'OPEN',
        queue_status: { $in: ['WAITING', 'DOCTOR_REVIEWING', 'CALLED', 'IN_CONSULTATION'] },
      }),
      Encounter.countDocuments({
        doctor_id: req.doctor._id,
        status: 'CLOSED',
        ended_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    return res.json({
      success: true,
      doctor: publicDoctor(req.doctor, { waiting_count: waitingCount, completed_today: completedToday }),
    });
  } catch (error) {
    console.error('Doctor profile error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_PROFILE_FAILED' });
  }
});

router.get('/queue/:doctorId', async (req, res) => {
  try {
    if (String(req.params.doctorId) !== String(req.doctor._id)) {
      return res.status(403).json({ success: false, error: 'DOCTOR_OWNERSHIP_REQUIRED' });
    }

    const encounters = await Encounter.find({
      doctor_id: req.doctor._id,
      status: 'OPEN',
      queue_status: { $in: ['WAITING', 'DOCTOR_REVIEWING', 'CALLED', 'IN_CONSULTATION'] },
    })
      .populate('patient_id')
      .sort({ created_at: 1 });

    const queue = await Promise.all(encounters.map(async (encounter, index) => {
      const intake = await SymptomIntake.findOne({ encounter_id: encounter._id });
      const publicIntakeData = publicIntake(intake);
      const patient = encounter.patient_id;
      return {
        ...publicEncounter(encounter, index + 1),
        encounter_id: encounter._id,
        token_number: `#${index + 1}`,
        patient_id: patient?._id,
        patient_name: patient?.name || 'Unknown Patient',
        patient_identifier: patient?.patient_identifier || 'PT-UNKNOWN',
        age: patient?.age,
        gender: patient?.gender,
        has_intake: Boolean(publicIntakeData),
        chief_complaint: publicIntakeData?.chief_complaint || 'Intake pending',
        duration: publicIntakeData?.duration || '',
        symptoms: publicIntakeData?.symptoms || [],
        intake: publicIntakeData,
      };
    }));

    return res.json({
      success: true,
      doctor_code: req.doctor.qr_code_id,
      doctor_name: req.doctor.name,
      queue,
      total_waiting: queue.length,
    });
  } catch (error) {
    console.error('Doctor queue error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_QUEUE_FAILED' });
  }
});

router.post('/encounter/:encounterId/review', async (req, res) => {
  try {
    const encounter = await ownedEncounter(req, res);
    if (!encounter) return undefined;
    if (encounter.status === 'CLOSED') {
      return res.status(403).json({ success: false, error: 'BOUNDED_ACCESS_EXPIRED' });
    }
    if (encounter.queue_status === 'WAITING') {
      encounter.queue_status = 'DOCTOR_REVIEWING';
      await encounter.save();
      await audit(req, encounter, 'DOCTOR_REVIEW_SYMPTOMS');
    }

    return res.json({ success: true, encounter: publicEncounter(encounter) });
  } catch (error) {
    console.error('Doctor review error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_REVIEW_FAILED' });
  }
});

router.get('/encounter/:encounterId/cockpit', async (req, res) => {
  try {
    const encounter = await ownedEncounter(req, res);
    if (!encounter) return undefined;
    if (encounter.queue_status === 'INTAKE_PENDING') {
      return res.status(409).json({ success: false, error: 'INTAKE_NOT_CONFIRMED' });
    }
    if (encounter.status === 'CLOSED') {
      await audit(req, encounter, 'HISTORICAL_ACCESS_DENIED_CLOSED_ENCOUNTER', 'DENIED', {
        reason: 'Closed encounters cannot be queried by doctors.',
      });
      return res.status(403).json({
        success: false,
        error: 'BOUNDED_ACCESS_EXPIRED',
        status: 'CLOSED',
        ended_at: encounter.ended_at,
      });
    }

    const [intake, currentNote, currentOrders, priorNotes, priorEncounters, reports] = await Promise.all([
      SymptomIntake.findOne({ encounter_id: encounter._id }),
      ConsultationNote.findOne({ encounter_id: encounter._id }),
      DiagnosticOrder.find({ encounter_id: encounter._id }).sort({ created_at: -1 }),
      encounter.visit_type === 'REVISITING'
        ? ConsultationNote.find({
          doctor_id: req.doctor._id,
          patient_id: encounter.patient_id._id,
          encounter_id: { $ne: encounter._id },
        }).sort({ created_at: -1 })
        : [],
      encounter.visit_type === 'REVISITING'
        ? Encounter.find({
          doctor_id: req.doctor._id,
          patient_id: encounter.patient_id._id,
          _id: { $ne: encounter._id },
        }).select('_id visit_type status queue_status created_at started_at ended_at').sort({ created_at: -1 })
        : [],
      DiagnosticReport.find({ patient_id: encounter.patient_id._id, status: 'PUBLISHED' })
        .populate('laboratory_id')
        .sort({ published_at: -1 }),
    ]);

    const publishedReports = await Promise.all(reports.map(async (report) => ({
      id: report._id,
      _id: report._id,
      test_type: report.test_type,
      laboratory_name: report.laboratory_id?.name || 'Registered Laboratory',
      laboratory_code: report.laboratory_id?.qr_code_id || null,
      published_at: report.published_at,
      original_file_name: report.original_file_name,
      observations: await LabObservation.find({ report_id: report._id }),
    })));

    const priorIntakeDocuments = priorEncounters.length > 0
      ? await SymptomIntake.find({ encounter_id: { $in: priorEncounters.map((item) => item._id) } })
      : [];
    const priorIntakesByEncounter = new Map(
      priorIntakeDocuments.map((item) => [String(item.encounter_id), item]),
    );
    const priorIntakes = priorEncounters.map((priorEncounter) => ({
      encounter_id: priorEncounter._id,
      visit_type: priorEncounter.visit_type,
      status: priorEncounter.status,
      queue_status: priorEncounter.queue_status,
      created_at: priorEncounter.created_at,
      intake: publicIntake(priorIntakesByEncounter.get(String(priorEncounter._id))),
    }));

    await audit(req, encounter, 'DOCTOR_OPENED_CLINICAL_COCKPIT', 'SUCCESS', {
      visit_type: encounter.visit_type,
      prior_notes_count: priorNotes.length,
      reports_count: publishedReports.length,
    });

    return res.json({
      success: true,
      encounter: publicEncounter(encounter),
      patient: {
        id: encounter.patient_id._id,
        _id: encounter.patient_id._id,
        name: encounter.patient_id.name,
        patient_identifier: encounter.patient_id.patient_identifier,
        age: encounter.patient_id.age,
        date_of_birth: encounter.patient_id.date_of_birth,
        gender: encounter.patient_id.gender,
        phone: encounter.patient_id.phone,
      },
      intake: publicIntake(intake),
      current_note: currentNote?.notes_text || '',
      current_orders: currentOrders,
      prior_notes: priorNotes,
      prior_intakes: priorIntakes,
      published_reports: publishedReports,
    });
  } catch (error) {
    console.error('Doctor cockpit error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_COCKPIT_FAILED' });
  }
});

router.post('/encounter/:encounterId/start', async (req, res) => {
  try {
    const encounter = await ownedEncounter(req, res);
    if (!encounter) return undefined;
    if (encounter.status === 'CLOSED') {
      return res.status(403).json({ success: false, error: 'BOUNDED_ACCESS_EXPIRED' });
    }
    if (!['WAITING', 'DOCTOR_REVIEWING', 'CALLED'].includes(encounter.queue_status)) {
      return res.status(409).json({ success: false, error: 'INVALID_QUEUE_TRANSITION' });
    }

    encounter.queue_status = 'CALLED';
    encounter.started_at = encounter.started_at || new Date();
    await encounter.save();
    await audit(req, encounter, 'CONSULTATION_STARTED_PATIENT_CALLED', 'SUCCESS', {
      queue_status: encounter.queue_status,
      started_at: encounter.started_at,
    });

    return res.json({ success: true, encounter: publicEncounter(encounter) });
  } catch (error) {
    console.error('Doctor start consultation error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_START_FAILED' });
  }
});

router.post('/encounter/:encounterId/notes', async (req, res) => {
  try {
    const encounter = await ownedEncounter(req, res);
    if (!encounter) return undefined;
    if (encounter.status === 'CLOSED') {
      return res.status(403).json({ success: false, error: 'BOUNDED_ACCESS_EXPIRED' });
    }
    const notesText = typeof req.body.notes_text === 'string' ? req.body.notes_text.trim() : '';
    if (!notesText) return res.status(400).json({ success: false, error: 'NOTES_TEXT_REQUIRED' });

    const note = await ConsultationNote.findOneAndUpdate(
      { encounter_id: encounter._id },
      {
        encounter_id: encounter._id,
        doctor_id: req.doctor._id,
        patient_id: encounter.patient_id._id,
        notes_text: notesText,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await audit(req, encounter, 'CONSULTATION_NOTE_SAVED', 'SUCCESS', {
      resource_type: 'ConsultationNote',
      resource_id: note._id.toString(),
      provenance: 'DOCTOR_ENTERED',
    });

    return res.json({
      success: true,
      note: {
        id: note._id,
        encounter_id: note.encounter_id,
        notes_text: note.notes_text,
        provenance: 'DOCTOR_ENTERED',
        created_at: note.created_at,
      },
    });
  } catch (error) {
    console.error('Doctor notes error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_NOTES_FAILED' });
  }
});

router.post('/encounter/:encounterId/order-diagnostic', async (req, res) => {
  try {
    const encounter = await ownedEncounter(req, res);
    if (!encounter) return undefined;
    if (encounter.status === 'CLOSED') {
      return res.status(403).json({ success: false, error: 'BOUNDED_ACCESS_EXPIRED' });
    }

    const testType = typeof req.body.test_type === 'string' && req.body.test_type.trim()
      ? req.body.test_type.trim().toUpperCase()
      : 'CBC';
    const clinicalNotes = typeof req.body.clinical_notes === 'string'
      ? req.body.clinical_notes.trim()
      : '';
    let order;
    await mongoose.connection.transaction(async (session) => {
      [order] = await DiagnosticOrder.create([{
      encounter_id: encounter._id,
      patient_id: encounter.patient_id._id,
      doctor_id: req.doctor._id,
      test_type: testType,
      clinical_notes: clinicalNotes || 'Routine diagnostic evaluation',
      status: 'ORDERED',
      }], { session, ordered: true });
      await Notification.create([{
      doctor_id: req.doctor._id,
      encounter_id: encounter._id,
      patient_id: encounter.patient_id._id,
      type: 'DIAGNOSTIC_ORDER_CREATED',
      title: 'Diagnostic test ordered',
      message: `${req.doctor.name} ordered ${order.test_type} for this consultation. You can take this order to a registered laboratory.`,
      visit_type: encounter.visit_type,
      diagnostic_order_id: order._id,
      }], { session, ordered: true });
      await AuditEvent.create([{
        actor_type: 'DOCTOR', actor_id: String(req.doctor._id),
        action: 'DIAGNOSTIC_ORDER_CREATED', resource_type: 'DiagnosticOrder',
        resource_id: String(order._id), patient_id: encounter.patient_id._id,
        outcome: 'SUCCESS', details: { encounter_id: String(encounter._id), test_type: order.test_type },
      }], { session, ordered: true });
    });

    return res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Doctor diagnostic order error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_ORDER_FAILED' });
  }
});

router.post('/encounter/:encounterId/end', async (req, res) => {
  try {
    const encounter = await ownedEncounter(req, res);
    if (!encounter) return undefined;
    if (encounter.status === 'CLOSED') {
      return res.status(400).json({ success: false, error: 'ENCOUNTER_ALREADY_CLOSED' });
    }

    encounter.status = 'CLOSED';
    encounter.ended_at = new Date();
    await encounter.save();
    await SymptomIntake.updateMany(
      { encounter_id: encounter._id },
      { $set: { audio_deleted: true } },
    );
    await audit(req, encounter, 'CONSULTATION_ENDED_BOUNDED_ACCESS_TERMINATED', 'SUCCESS', {
      ended_at: encounter.ended_at,
      raw_audio_deleted: true,
      retained: ['transcript', 'structured_intake', 'consultation_notes', 'audit_ledger'],
    });

    return res.json({ success: true, encounter: publicEncounter(encounter) });
  } catch (error) {
    console.error('Doctor end consultation error:', error);
    return res.status(500).json({ success: false, error: 'DOCTOR_END_FAILED' });
  }
});

router.get('/notifications/:doctorId', async (req, res) => {
  try {
    if (String(req.params.doctorId) !== String(req.doctor._id)) {
      return res.status(403).json({ success: false, error: 'DOCTOR_OWNERSHIP_REQUIRED' });
    }
    const notifications = await Notification.find({ doctor_id: req.doctor._id, type: { $ne: 'DIAGNOSTIC_ORDER_CREATED' } })
      .sort({ created_at: -1 })
      .limit(25);
    const unreadCount = await Notification.countDocuments({ doctor_id: req.doctor._id, type: { $ne: 'DIAGNOSTIC_ORDER_CREATED' }, read: false });
    return res.json({ success: true, notifications, unread_count: unreadCount });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'DOCTOR_NOTIFICATIONS_FAILED' });
  }
});

router.post('/notifications/:notificationId/read', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.notificationId)) {
      return res.status(404).json({ success: false, error: 'NOTIFICATION_NOT_FOUND' });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, doctor_id: req.doctor._id, type: { $ne: 'DIAGNOSTIC_ORDER_CREATED' } },
      { read: true },
      { new: true },
    );
    if (!notification) return res.status(404).json({ success: false, error: 'NOTIFICATION_NOT_FOUND' });
    return res.json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'NOTIFICATION_UPDATE_FAILED' });
  }
});

router.post('/notifications/read-all/:doctorId', async (req, res) => {
  try {
    if (String(req.params.doctorId) !== String(req.doctor._id)) {
      return res.status(403).json({ success: false, error: 'DOCTOR_OWNERSHIP_REQUIRED' });
    }
    await Notification.updateMany({ doctor_id: req.doctor._id, type: { $ne: 'DIAGNOSTIC_ORDER_CREATED' }, read: false }, { read: true });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'NOTIFICATIONS_UPDATE_FAILED' });
  }
});

module.exports = router;
