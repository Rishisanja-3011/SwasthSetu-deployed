const mongoose = require('mongoose');

const encounterSchema = new mongoose.Schema({
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
  visit_type: {
    type: String,
    enum: ['NEW', 'REVISITING'],
    required: true,
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN',
    index: true,
  },
  queue_status: {
    type: String,
    enum: ['INTAKE_PENDING', 'WAITING', 'DOCTOR_REVIEWING', 'IN_CONSULTATION', 'CALLED'],
    default: 'WAITING',
    index: true,
  },
  queue_number: {
    type: Number,
    default: 1,
  },
  started_at: {
    type: Date,
    default: null,
  },
  ended_at: {
    type: Date,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

encounterSchema.index({ doctor_id: 1, status: 1, created_at: 1 });
encounterSchema.index({ patient_id: 1, doctor_id: 1, created_at: -1 });

module.exports = mongoose.model('Encounter', encounterSchema);
