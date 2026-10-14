const mongoose = require('mongoose');

const labObservationSchema = new mongoose.Schema({
  report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticReport',
    required: true,
  },
  test_name_original: {
    type: String,
    required: true,
  },
  test_name_normalized: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    default: null,
  },
  reference_low: {
    type: Number,
    default: null, // If missing, null; never invent!
  },
  reference_high: {
    type: Number,
    default: null, // If missing, null; never invent!
  },
  flag: {
    type: String,
    enum: ['HIGH', 'LOW', 'NORMAL'],
    default: null,
  },
  extraction_confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  validation_status: {
    type: String,
    enum: ['OK', 'NEEDS_REVIEW'],
    required: true,
  },
  review_reason: {
    type: String,
    default: null,
  },
  manually_edited: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('LabObservation', labObservationSchema);
