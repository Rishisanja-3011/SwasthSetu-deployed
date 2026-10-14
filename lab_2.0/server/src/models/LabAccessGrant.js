const mongoose = require('mongoose');

const labAccessGrantSchema = new mongoose.Schema({
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  laboratory_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laboratory',
    required: true,
  },
  diagnostic_order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticOrder',
    default: null,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED'],
    default: 'ACTIVE',
    index: true,
  },
  shared_fields: {
    type: [String],
    default: ['name', 'date_of_birth', 'gender', 'phone'],
    validate: {
      validator: (fields) =>
        fields.length === 4 &&
        ['name', 'date_of_birth', 'gender', 'phone'].every((field) => fields.includes(field)),
      message: 'A lab grant must expose exactly the four approved identity fields.',
    },
  },
  published_report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticReport',
    default: null,
  },
  report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticReport',
    default: null,
  },
  granted_at: {
    type: Date,
    default: Date.now,
  },
});

// Laboratory access ends only when the associated report is published.
labAccessGrantSchema.methods.isValid = function () {
  return this.status === 'ACTIVE';
};

labAccessGrantSchema.index({ patient_id: 1, laboratory_id: 1, status: 1 });

module.exports = mongoose.model('LabAccessGrant', labAccessGrantSchema);
