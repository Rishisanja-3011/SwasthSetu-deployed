const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  actor_type: {
    type: String,
    enum: ['PATIENT', 'DOCTOR', 'LABORATORY', 'SYSTEM'],
    required: true,
  },
  actor_id: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true, // e.g. "VIEW_IDENTITY", "CBC_EXTRACTION", "OBSERVATION_UPDATE", "REPORT_PUBLISH", "GRANT_EXPIRED"
    index: true,
  },
  resource_type: {
    type: String,
    required: true, // e.g. "LabAccessGrant", "DiagnosticReport", "LabObservation"
  },
  resource_id: {
    type: String,
    required: true,
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: false,
  },
  outcome: {
    type: String,
    enum: ['SUCCESS', 'DENIED', 'EXPIRED', 'FAILED'],
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

auditEventSchema.index({ patient_id: 1, timestamp: -1 });
auditEventSchema.index({ resource_type: 1, resource_id: 1, timestamp: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
