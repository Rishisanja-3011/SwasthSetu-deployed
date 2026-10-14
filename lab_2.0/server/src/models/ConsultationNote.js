const mongoose = require('mongoose');

const consultationNoteSchema = new mongoose.Schema({
  encounter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Encounter',
    required: true,
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  notes_text: {
    type: String,
    required: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ConsultationNote', consultationNoteSchema);
