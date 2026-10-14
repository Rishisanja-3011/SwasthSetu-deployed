const crypto = require('crypto');

const TOKEN_SECRET = process.env.VAANIDOC_TOKEN_SECRET || 'vaanidoc-local-development-secret';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signature(payload) {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
}

function issueToken({ subject, role, purpose = 'SESSION', expiresInSeconds = SESSION_TTL_SECONDS, extra = {} }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(subject),
    role,
    purpose,
    iat: now,
    exp: now + expiresInSeconds,
    ...extra,
  };
  const encodedPayload = encode(payload);
  return `${encodedPayload}.${signature(encodedPayload)}`;
}

function verifyToken(token, expectedPurpose = null) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing token');
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    throw new Error('Malformed token');
  }

  const expectedSignature = signature(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid token signature');
  }

  const payload = decode(encodedPayload);
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  if (expectedPurpose && payload.purpose !== expectedPurpose) {
    throw new Error('Invalid token purpose');
  }
  return payload;
}

function hashOtp(challengeId, otp) {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${challengeId}:${otp}`)
    .digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = {
  issueToken,
  verifyToken,
  hashOtp,
  generateOtp,
};
