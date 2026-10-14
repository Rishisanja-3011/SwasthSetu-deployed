// Requiring every model once gives the Atlas initialization script a single
// canonical registry and prevents collection definitions from drifting apart.
const User = require('./User');
const Patient = require('./Patient');
const Doctor = require('./Doctor');
const Laboratory = require('./Laboratory');
const Encounter = require('./Encounter');
const SymptomIntake = require('./SymptomIntake');
const ConsultationNote = require('./ConsultationNote');
const DiagnosticOrder = require('./DiagnosticOrder');
const LabAccessGrant = require('./LabAccessGrant');
const DiagnosticReport = require('./DiagnosticReport');
const ReportFile = require('./ReportFile');
const LabObservation = require('./LabObservation');
const AIArtifact = require('./AIArtifact');
const AuditEvent = require('./AuditEvent');
const AuthChallenge = require('./AuthChallenge');
const PendingProviderVisit = require('./PendingProviderVisit');
const Notification = require('./Notification');

module.exports = {
  User,
  Patient,
  Doctor,
  Laboratory,
  Encounter,
  SymptomIntake,
  ConsultationNote,
  DiagnosticOrder,
  LabAccessGrant,
  DiagnosticReport,
  ReportFile,
  LabObservation,
  AIArtifact,
  AuditEvent,
  AuthChallenge,
  PendingProviderVisit,
  Notification,
};
