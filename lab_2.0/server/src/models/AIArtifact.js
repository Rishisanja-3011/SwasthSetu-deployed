const mongoose = require('mongoose');

const aiArtifactSchema = new mongoose.Schema({
  encounter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Encounter',
    default: null,
    index: true,
  },
  report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticReport',
    default: null,
    index: true,
  },
  artifact_type: {
    type: String,
    required: true,
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  source_reference: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

aiArtifactSchema.pre('validate', function requireParentReference() {
  if (!this.encounter_id && !this.report_id) {
    this.invalidate('source_reference', 'An AI artifact must belong to an encounter or report.');
  }
});

module.exports = mongoose.model('AIArtifact', aiArtifactSchema);
