const Encounter = require('../models/Encounter');
const AuditEvent = require('../models/AuditEvent');
const { enforceActiveLabGrant } = require('./labAccess');

/**
 * Middleware: Enforces Doctor Access Bounded Model.
 * Doctor access exists ONLY while the consultation encounter is OPEN (WAITING or IN_CONSULTATION).
 * When status is CLOSED, access expires automatically and cannot be queried.
 */
async function enforceDoctorEncounterAccess(req, res, next) {
  try {
    const encounterId = req.params.encounterId || req.body.encounter_id || req.query.encounter_id;

    if (!encounterId) {
      return res.status(400).json({
        success: false,
        error: 'Missing encounter_id for bounded access validation.',
      });
    }

    const encounter = await Encounter.findById(encounterId)
      .populate('patient_id')
      .populate('doctor_id');

    if (!encounter) {
      return res.status(404).json({
        success: false,
        error: 'Encounter not found.',
      });
    }

    if (encounter.status === 'CLOSED') {
      await AuditEvent.create({
        actor_type: 'DOCTOR',
        actor_id: encounter.doctor_id ? encounter.doctor_id._id.toString() : 'UNKNOWN_DOCTOR',
        action: 'HISTORICAL_ACCESS_DENIED_CLOSED_ENCOUNTER',
        resource_type: 'Encounter',
        resource_id: encounter._id.toString(),
        patient_id: encounter.patient_id ? encounter.patient_id._id : null,
        outcome: 'DENIED',
        details: {
          reason: 'Doctor access expires automatically when consultation ends (Bounded Access Model). Closed encounters cannot be queried.',
          ended_at: encounter.ended_at,
        },
      });

      return res.status(403).json({
        success: false,
        error: 'BOUNDED_ACCESS_EXPIRED: Doctor access has expired. Consultation is closed. Historical records and notes are sealed by construction.',
        encounter_status: 'CLOSED',
        ended_at: encounter.ended_at,
      });
    }

    req.encounter = encounter;
    next();
  } catch (error) {
    console.error('Error in enforceDoctorEncounterAccess middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error in doctor bounded access verification.',
    });
  }
}

module.exports = {
  enforceActiveLabGrant,
  enforceDoctorEncounterAccess,
};
