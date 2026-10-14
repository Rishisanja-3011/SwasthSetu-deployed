const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
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
  date_of_birth: {
    type: String, // e.g. "1994-08-14"
    default: null,
  },
  age: {
    type: Number,
    default: null,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    required: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  patient_identifier: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

patientSchema.pre('validate', function requireAgeOrDateOfBirth() {
  if (this.age === null && !this.date_of_birth) {
    this.invalidate('age', 'Either age or date_of_birth is required.');
  }
});

module.exports = mongoose.model('Patient', patientSchema);
