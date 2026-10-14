const mongoose = require('mongoose');

const laboratorySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  qr_code_id: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  platform_approval_status: {
    type: String,
    enum: ['APPROVED', 'PENDING', 'REVOKED'],
    default: 'APPROVED',
    index: true,
  },
  location: {
    type: String,
    default: 'Location not provided',
  },
  contact_phone: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Laboratory', laboratorySchema);
