const mongoose = require('mongoose');

/**
 * Preserves a provider QR destination while a logged-out patient completes OTP
 * authentication. This record is deliberately short-lived and single-use.
 */
const pendingProviderVisitSchema = new mongoose.Schema({
  login_attempt_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  provider_type: {
    type: String,
    enum: ['DOCTOR', 'LABORATORY'],
    required: true,
  },
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  provider_code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONSUMED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  expires_at: {
    type: Date,
    required: true,
  },
  consumed_at: {
    type: Date,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

pendingProviderVisitSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingProviderVisit', pendingProviderVisitSchema);
