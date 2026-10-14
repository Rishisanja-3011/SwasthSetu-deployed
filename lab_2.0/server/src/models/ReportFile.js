const mongoose = require('mongoose');

/**
 * Metadata for the unchanged original laboratory PDF.
 * The binary itself can later live in GridFS or object storage; MongoDB keeps
 * the immutable reference and integrity metadata here.
 */
const reportFileSchema = new mongoose.Schema({
  report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticReport',
    required: true,
    unique: true,
    index: true,
  },
  original_file_path: {
    type: String,
    required: true,
  },
  storage_key: {
    type: String,
    default: null,
  },
  original_file_name: {
    type: String,
    required: true,
  },
  mime_type: {
    type: String,
    default: 'application/pdf',
  },
  byte_size: {
    type: Number,
    default: null,
    min: 0,
  },
  sha256: {
    type: String,
    required: true,
    lowercase: true,
  },
  uploaded_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ReportFile', reportFileSchema);
