const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const { User, Patient, Doctor, Laboratory, AuthChallenge, PendingProviderVisit } = require('../models');
const { normalizePhone } = require('../utils/phone');
const {
  generateOtp,
  hashOtp,
  issueToken,
  verifyToken,
} = require('../security/tokens');
const { requireAuth } = require('../middleware/requireAuth');
const { publicProvider, resolveProvider } = require('../services/providerService');

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const REGISTRATION_TOKEN_TTL_SECONDS = 10 * 60;

function responsePatient(patient) {
  if (!patient) return null;
  return {
    id: patient._id,
    patient_identifier: patient.patient_identifier,
    name: patient.name,
    date_of_birth: patient.date_of_birth,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
  };
}

async function pendingProviderForChallenge(challengeId) {
  const pending = await PendingProviderVisit.findOne({
    login_attempt_id: String(challengeId),
    status: 'PENDING',
    expires_at: { $gt: new Date() },
  });
  if (!pending) return null;

  const provider = await resolveProvider(pending.provider_code);
  return provider ? publicProvider(provider) : null;
}

async function consumePendingProviderVisit(challengeId) {
  const pending = await PendingProviderVisit.findOneAndUpdate(
    {
      login_attempt_id: String(challengeId),
      status: 'PENDING',
      expires_at: { $gt: new Date() },
    },
    { status: 'CONSUMED', consumed_at: new Date() },
    { new: true },
  );
  if (!pending) return null;

  const provider = await resolveProvider(pending.provider_code);
  return provider ? publicProvider(provider) : null;
}

function validatePatientProfile(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const dateOfBirth = typeof body.date_of_birth === 'string' ? body.date_of_birth.trim() : null;
  const age = body.age === undefined || body.age === null || body.age === ''
    ? null
    : Number(body.age);
  const gender = typeof body.gender === 'string' ? body.gender.trim() : '';

  if (!name) throw new Error('Full name is required.');
  if (!dateOfBirth && (!Number.isInteger(age) || age < 0 || age > 130)) {
    throw new Error('Provide either a valid age or date_of_birth.');
  }
  if (!['Male', 'Female', 'Other', 'Prefer not to say'].includes(gender)) {
    throw new Error('A valid gender selection is required.');
  }

  return { name, date_of_birth: dateOfBirth, age, gender };
}

async function createPatientAccount(phone, profile) {
  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new Error('A user already exists for this phone number.');
  }

  const user = await User.create({
    role: 'PATIENT',
    phone,
    name: profile.name,
  });

  try {
    let patientIdentifier;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      patientIdentifier = `PX${crypto.randomInt(100000, 1000000)}`;
      if (!(await Patient.exists({ patient_identifier: patientIdentifier }))) break;
    }

    const patient = await Patient.create({
      user_id: user._id,
      patient_identifier: patientIdentifier,
      name: profile.name,
      date_of_birth: profile.date_of_birth,
      age: profile.age,
      gender: profile.gender,
      phone,
    });

    return { user, patient };
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }
}

function publicLaboratory(laboratory) {
  return {
    id: laboratory._id,
    _id: laboratory._id,
    name: laboratory.name,
    location: laboratory.location,
    contact_phone: laboratory.contact_phone,
    qr_code_id: laboratory.qr_code_id,
    provider_code: laboratory.qr_code_id,
  };
}

async function allocateLaboratoryCode() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = `LAB-${crypto.randomInt(100000, 1000000)}`;
    const [laboratoryExists, doctorExists] = await Promise.all([
      Laboratory.exists({ qr_code_id: candidate }),
      Doctor.exists({ qr_code_id: candidate }),
    ]);
    if (!laboratoryExists && !doctorExists) return candidate;
  }
  throw new Error('Could not allocate a unique laboratory ID.');
}

/**
 * Start patient OTP authentication. The OTP is deliberately printed only in
 * the local server terminal until an SMS adapter is selected.
 */
router.post('/patient/request-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({ success: false, error: 'A valid mobile number is required.' });
    }

    let pendingProvider = null;
    if (req.body.provider_code) {
      const provider = await resolveProvider(req.body.provider_code);
      if (!provider) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PROVIDER_QR',
          message: 'The doctor or laboratory code is not registered or approved.',
        });
      }
      pendingProvider = provider;
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser && existingUser.role !== 'PATIENT') {
      return res.status(409).json({
        success: false,
        error: 'PHONE_ALREADY_REGISTERED_FOR_PROVIDER',
        message: 'This mobile number is already registered to a provider account.',
      });
    }

    const existingPatient = await Patient.findOne({ phone });
    const challengeId = new mongoose.Types.ObjectId();
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await AuthChallenge.create({
      _id: challengeId,
      phone,
      purpose: existingPatient ? 'LOGIN' : 'REGISTRATION',
      code_hash: hashOtp(challengeId.toString(), otp),
      expires_at: expiresAt,
    });

    if (pendingProvider) {
      await PendingProviderVisit.create({
        login_attempt_id: challengeId.toString(),
        provider_type: pendingProvider.provider_type,
        provider_id: pendingProvider.provider_id,
        provider_code: pendingProvider.provider_code,
        expires_at: expiresAt,
      });
    }

    console.log(
      `[VaaniDoc OTP DEV] challenge=${challengeId} phone=${phone} otp=${otp} expires=${expiresAt.toISOString()}`,
    );

    return res.status(202).json({
      success: true,
      challenge_id: challengeId,
      expires_in_seconds: OTP_TTL_MS / 1000,
      registration_required: !existingPatient,
      pending_provider: pendingProvider ? publicProvider(pendingProvider) : null,
    });
  } catch (error) {
    console.error('Patient OTP request error:', error);
    return res.status(500).json({ success: false, error: 'OTP_REQUEST_FAILED' });
  }
});

router.post('/patient/verify-otp', async (req, res) => {
  try {
    const { challenge_id: challengeId, otp } = req.body;
    if (!challengeId || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'A challenge_id and six-digit OTP are required.' });
    }

    const challenge = await AuthChallenge.findById(challengeId);
    if (!challenge || challenge.consumed_at || challenge.expires_at <= new Date()) {
      return res.status(401).json({ success: false, error: 'OTP_EXPIRED_OR_INVALID' });
    }
    if (challenge.attempts >= challenge.max_attempts) {
      return res.status(429).json({ success: false, error: 'OTP_ATTEMPT_LIMIT_REACHED' });
    }

    challenge.attempts += 1;
    if (hashOtp(challenge._id.toString(), otp) !== challenge.code_hash) {
      await challenge.save();
      return res.status(401).json({ success: false, error: 'OTP_INVALID' });
    }

    challenge.consumed_at = new Date();
    await challenge.save();

    const patient = await Patient.findOne({ phone: challenge.phone });
    const pendingProvider = await pendingProviderForChallenge(challenge._id);

    if (!patient) {
      const registrationToken = issueToken({
        subject: challenge.phone,
        role: 'PATIENT',
        purpose: 'PATIENT_REGISTRATION',
        expiresInSeconds: REGISTRATION_TOKEN_TTL_SECONDS,
        extra: { challenge_id: challenge._id.toString() },
      });

      return res.json({
        success: true,
        registration_required: true,
        registration_token: registrationToken,
        pending_provider: pendingProvider,
      });
    }

    const pending = await consumePendingProviderVisit(challenge._id);
    const token = issueToken({ subject: patient.user_id, role: 'PATIENT' });
    return res.json({
      success: true,
      registration_required: false,
      access_token: token,
      patient: responsePatient(patient),
      pending_provider: pending || pendingProvider,
    });
  } catch (error) {
    console.error('Patient OTP verification error:', error);
    return res.status(500).json({ success: false, error: 'OTP_VERIFICATION_FAILED' });
  }
});

router.post('/patient/register', async (req, res) => {
  try {
    const registrationToken = req.body.registration_token;
    const registration = verifyToken(registrationToken, 'PATIENT_REGISTRATION');
    const profile = validatePatientProfile(req.body);
    const phone = normalizePhone(registration.sub);

    const { user, patient } = await createPatientAccount(phone, profile);
    const pending = await consumePendingProviderVisit(registration.challenge_id);
    const token = issueToken({ subject: user._id, role: 'PATIENT' });

    return res.status(201).json({
      success: true,
      access_token: token,
      patient: responsePatient(patient),
      pending_provider: pending,
    });
  } catch (error) {
    const statusCode = error.message.includes('token') || error.message.includes('Token') ? 401 : 400;
    return res.status(statusCode).json({ success: false, error: error.message || 'PATIENT_REGISTRATION_FAILED' });
  }
});

/**
 * Doctor onboarding is intentionally code-based for the local demonstration.
 * A production deployment can replace this with an approved identity provider.
 */
router.post('/doctor/register', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const phone = normalizePhone(req.body.phone);
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Doctor name and phone are required.' });
    }
    if (await User.exists({ phone })) {
      return res.status(409).json({ success: false, error: 'A user already exists for this phone number.' });
    }

    let doctorCode;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `DOC-${crypto.randomInt(100, 1000)}`;
      if (!(await Doctor.exists({ qr_code_id: candidate }))) {
        doctorCode = candidate;
        break;
      }
    }
    if (!doctorCode) throw new Error('Could not allocate a unique doctor code.');

    const user = await User.create({ role: 'DOCTOR', phone, name });
    const doctor = await Doctor.create({
      user_id: user._id,
      name,
      specialty: req.body.specialty || 'General Physician',
      clinic_name: req.body.clinic_name || 'Community Health Clinic',
      qr_code_id: doctorCode,
    });
    const token = issueToken({ subject: user._id, role: 'DOCTOR' });

    return res.status(201).json({
      success: true,
      access_token: token,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        specialty: doctor.specialty,
        clinic_name: doctor.clinic_name,
        qr_code_id: doctor.qr_code_id,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message || 'DOCTOR_REGISTRATION_FAILED' });
  }
});

router.post('/laboratory/register', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const phone = normalizePhone(req.body.phone);
    const location = typeof req.body.location === 'string' && req.body.location.trim()
      ? req.body.location.trim().slice(0, 180)
      : 'Location not provided';
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Laboratory name and registered phone are required.' });
    }
    if (await User.exists({ phone })) {
      return res.status(409).json({ success: false, error: 'A user already exists for this phone number.' });
    }

    let user;
    let laboratory;
    for (let attempt = 0; attempt < 5 && !laboratory; attempt += 1) {
      const laboratoryCode = await allocateLaboratoryCode();
      user = await User.create({ role: 'LABORATORY', phone, name });
      try {
        laboratory = await Laboratory.create({
          user_id: user._id,
          name,
          qr_code_id: laboratoryCode,
          location,
          contact_phone: phone,
          // Self-registered facilities are active immediately; no admin approval
          // step is part of the laboratory workflow.
          platform_approval_status: 'APPROVED',
        });
      } catch (error) {
        await User.findByIdAndDelete(user._id);
        if (error.code !== 11000 || attempt === 4) throw error;
      }
    }
    if (!laboratory || !user) throw new Error('Could not create the laboratory account.');
    const token = issueToken({ subject: user._id, role: 'LABORATORY' });
    return res.status(201).json({
      success: true,
      access_token: token,
      laboratory: publicLaboratory(laboratory),
    });
  } catch (error) {
    console.error('Laboratory registration error:', error);
    return res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      error: error.code === 11000 ? 'LABORATORY_ID_COLLISION' : (error.message || 'LABORATORY_REGISTRATION_FAILED'),
    });
  }
});

router.post('/provider/login', async (req, res) => {
  try {
    const provider = await resolveProvider(req.body.provider_code);
    const phone = normalizePhone(req.body.phone);
    if (!provider || !phone) {
      return res.status(401).json({ success: false, error: 'PROVIDER_CREDENTIALS_INVALID' });
    }
    if (req.body.provider_type && req.body.provider_type !== provider.provider_type) {
      return res.status(401).json({ success: false, error: 'PROVIDER_TYPE_INVALID' });
    }

    const ownerId = provider.provider.user_id;
    const user = ownerId ? await User.findOne({ _id: ownerId, phone, role: provider.provider_type }) : null;
    if (!user) {
      return res.status(401).json({ success: false, error: 'PROVIDER_CREDENTIALS_INVALID' });
    }

    const token = issueToken({ subject: user._id, role: provider.provider_type });
    return res.json({ success: true, access_token: token, provider: publicProvider(provider) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PROVIDER_LOGIN_FAILED' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.sub).select('-__v');
    if (!user) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });

    let profile = null;
    if (user.role === 'PATIENT') profile = responsePatient(await Patient.findOne({ user_id: user._id }));
    if (user.role === 'DOCTOR') profile = publicProvider(await resolveProvider((await Doctor.findOne({ user_id: user._id }))?.qr_code_id));
    if (user.role === 'LABORATORY') profile = publicProvider(await resolveProvider((await Laboratory.findOne({ user_id: user._id }))?.qr_code_id));

    return res.json({ success: true, user: { id: user._id, role: user.role, name: user.name, phone: user.phone }, profile });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PROFILE_LOOKUP_FAILED' });
  }
});

module.exports = router;
