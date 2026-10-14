const Doctor = require('../models/Doctor');
const Laboratory = require('../models/Laboratory');

function cleanProviderCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

async function resolveProvider(code) {
  const providerCode = cleanProviderCode(code);
  if (!providerCode) return null;

  const doctor = await Doctor.findOne({ qr_code_id: providerCode });
  if (doctor) {
    return {
      provider_type: 'DOCTOR',
      provider_id: doctor._id,
      provider_code: doctor.qr_code_id,
      provider: doctor,
    };
  }

  const laboratory = await Laboratory.findOne({
    qr_code_id: providerCode,
    platform_approval_status: { $ne: 'REVOKED' },
  });
  if (laboratory) {
    return {
      provider_type: 'LABORATORY',
      provider_id: laboratory._id,
      provider_code: laboratory.qr_code_id,
      provider: laboratory,
    };
  }

  return null;
}

function publicProvider(providerMatch) {
  if (!providerMatch) return null;

  const { provider_type, provider_id, provider_code, provider } = providerMatch;
  if (provider_type === 'DOCTOR') {
    return {
      provider_type,
      provider_id,
      provider_code,
      name: provider.name,
      specialty: provider.specialty,
      clinic_name: provider.clinic_name,
    };
  }

  return {
    provider_type,
    provider_id,
    provider_code,
    name: provider.name,
    location: provider.location,
    contact_phone: provider.contact_phone,
  };
}

module.exports = { resolveProvider, publicProvider, cleanProviderCode };
