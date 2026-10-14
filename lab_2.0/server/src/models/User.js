const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['PATIENT', 'DOCTOR', 'LABORATORY'],
    required: true,
    index: true,
  },
  phone: {
    type: String,
    default: null,
    trim: true,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  auth_provider_id: {
    type: String,
    default: null,
    index: true,
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

userSchema.pre('save', function updateTimestamp() {
  this.updated_at = new Date();
});

module.exports = mongoose.model('User', userSchema);
