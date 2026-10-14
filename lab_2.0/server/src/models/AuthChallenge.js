const mongoose = require('mongoose');

/**
 * Short-lived OTP challenge for patient authentication.
 * Only a hash of the OTP is stored; the raw code is never persisted.
 */
const authChallengeSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  purpose: {
    type: String,
    enum: ['LOGIN', 'REGISTRATION'],
    required: true,
  },
  code_hash: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  max_attempts: {
    type: Number,
    default: 5,
    min: 1,
  },
  expires_at: {
    type: Date,
    required: true,
  },
  consumed_at: {
    type: Date,
    default: null,
  },
  provider_message_id: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

// Expired OTP challenges should be removed automatically by MongoDB.
authChallengeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
authChallengeSchema.index({ phone: 1, purpose: 1, created_at: -1 });

module.exports = mongoose.model('AuthChallenge', authChallengeSchema);
