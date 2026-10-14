const mongoose = require('mongoose');

const symptomIntakeSchema = new mongoose.Schema({
  encounter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Encounter',
    required: true,
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true,
  },
  input_mode: {
    type: String,
    enum: ['VOICE', 'TEXT', 'SKIPPED'],
    required: true,
  },
  transcript: {
    type: String,
    default: '',
  },
  transcription_source: {
    type: String,
    enum: ['BROWSER_TRANSCRIPT', 'SERVER_TRANSCRIPTION', 'PATIENT_TYPED', ''],
    default: '',
  },
  transcription_confidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  language: {
    type: String,
    default: '',
  },
  detected_language: {
    type: String,
    default: '',
  },
  language_confidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  chief_complaint: {
    type: String,
    default: '',
  },
  duration: {
    type: String,
    default: '',
  },
  symptoms: [{ type: String }],
  negative_symptoms: [{ type: String }],
  possible_symptom_categories: [{ type: String }],
  relevant_history: [{ type: String }],
  medications: [{ type: String }],
  allergies: [{ type: String }],
  allergy_status: {
    type: String,
    enum: ['REPORTED', 'NONE_REPORTED', 'UNKNOWN', ''],
    default: 'UNKNOWN',
  },
  urgency: {
    type: String,
    enum: ['LOW', 'MODERATE', 'HIGH', 'EMERGENCY', ''],
    default: '',
  },
  structured_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Number is retained for older records; the complete confidence contract is
  // stored in structured_data.confidence.
  confidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  provenance: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      original_text: 'PATIENT_TYPED',
      detected_language: 'UNKNOWN',
      structured_fields: 'DETERMINISTIC_FALLBACK',
    },
  },
  extraction_status: {
    type: String,
    enum: ['READY', 'REVIEW_REQUIRED', 'FAILED', 'SKIPPED'],
    default: 'READY',
  },
  pipeline_version: {
    type: String,
    default: 'clinical-intake-v1',
  },
  patient_confirmed: {
    type: Boolean,
    default: false,
  },
  patient_confirmed_at: {
    type: Date,
    default: null,
  },
  // Kept as a compatibility alias for existing patient timeline consumers.
  confirmed_at: {
    type: Date,
    default: null,
  },
  audio_deleted: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

symptomIntakeSchema.index({ encounter_id: 1 }, { unique: true });
symptomIntakeSchema.pre('save', function updateTimestamp(next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('SymptomIntake', symptomIntakeSchema);
