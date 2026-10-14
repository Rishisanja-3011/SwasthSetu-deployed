const mongoose = require('mongoose');

const diagnosticOrderSchema = new mongoose.Schema({
  encounter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Encounter',
    default: null,
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  test_type: {
    type: String,
    default: 'CBC',
    required: true,
    uppercase: true,
  },
  clinical_notes: {
    type: String,
    default: 'Routine evaluation of fatigue/fever symptoms.',
  },
  status: {
    type: String,
    enum: ['ORDERED', 'COMPLETED'],
    default: 'ORDERED',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

diagnosticOrderSchema.index({ patient_id: 1, created_at: -1 });
diagnosticOrderSchema.index({ doctor_id: 1, encounter_id: 1 });

module.exports = mongoose.model('DiagnosticOrder', diagnosticOrderSchema);
