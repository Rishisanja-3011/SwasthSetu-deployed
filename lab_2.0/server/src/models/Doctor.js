const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  specialty: {
    type: String,
    default: 'General Physician',
    trim: true,
  },
  clinic_name: {
    type: String,
    default: 'Community Health Clinic',
    trim: true,
  },
  qr_code_id: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Doctor', doctorSchema);
