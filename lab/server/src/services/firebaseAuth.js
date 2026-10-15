class FirebaseAuthError extends Error {
  constructor(code, message, statusCode = 503, cause = null) {
    super(message);
    this.name = 'FirebaseAuthError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

let firebaseAuthClient = null;

function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readServiceAccountJson(environment) {
  const rawJson = cleanValue(environment.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!rawJson) return {};

  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('The service account JSON must be an object.');
    }
    return parsed;
  } catch (error) {
    throw new FirebaseAuthError(
      'FIREBASE_AUTH_CONFIG_INVALID',
      'FIREBASE_SERVICE_ACCOUNT_JSON must contain valid Firebase service-account JSON.',
      503,
      error,
    );
  }
}

function getFirebaseConfig(environment = process.env) {
  const serviceAccount = readServiceAccountJson(environment);
  const projectId = cleanValue(environment.FIREBASE_PROJECT_ID || serviceAccount.project_id);
  const clientEmail = cleanValue(environment.FIREBASE_CLIENT_EMAIL || serviceAccount.client_email);
  const privateKey = cleanValue(environment.FIREBASE_PRIVATE_KEY || serviceAccount.private_key)
    .replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseAuthError(
      'FIREBASE_AUTH_CONFIG_MISSING',
      'Firebase Admin configuration is incomplete. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      503,
    );
  }

  if (
    !/^[a-z0-9][a-z0-9-]*$/i.test(projectId)
    || !/^[^\s@]+@[^\s@]+$/.test(clientEmail)
    || !privateKey.includes('-----BEGIN PRIVATE KEY-----')
    || !privateKey.includes('-----END PRIVATE KEY-----')
  ) {
    throw new FirebaseAuthError(
      'FIREBASE_AUTH_CONFIG_INVALID',
      'Firebase Admin credentials are malformed. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      503,
    );
  }

  return { projectId, clientEmail, privateKey };
}

function getFirebaseAdminAuth() {
  const config = getFirebaseConfig();
  if (firebaseAuthClient) return firebaseAuthClient;

  let firebaseAdmin;
  try {
    // Keep the dependency lazy so a missing deployment configuration is reported
    // by the endpoint instead of preventing the rest of the API from starting.
    firebaseAdmin = require('firebase-admin');
  } catch (error) {
    throw new FirebaseAuthError(
      'FIREBASE_AUTH_UNAVAILABLE',
      'The Firebase Admin SDK is not available on the server.',
      503,
      error,
    );
  }

  try {
    const existingApp = Array.isArray(firebaseAdmin.apps)
      ? firebaseAdmin.apps.find((app) => app.name === '[DEFAULT]')
      : null;
    const app = existingApp || firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(config),
    });
    firebaseAuthClient = firebaseAdmin.auth(app);
    return firebaseAuthClient;
  } catch (error) {
    throw new FirebaseAuthError(
      'FIREBASE_AUTH_CONFIG_INVALID',
      'Firebase Admin could not be initialized with the configured credentials.',
      503,
      error,
    );
  }
}

async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== 'string' || !idToken.trim()) {
    throw new FirebaseAuthError(
      'FIREBASE_ID_TOKEN_REQUIRED',
      'A Firebase ID token is required.',
      400,
    );
  }

  let decodedToken;
  try {
    decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken.trim());
  } catch (error) {
    if (error instanceof FirebaseAuthError) throw error;
    throw new FirebaseAuthError(
      'FIREBASE_ID_TOKEN_INVALID',
      'The Firebase ID token is invalid or expired.',
      401,
      error,
    );
  }

  if (!decodedToken || typeof decodedToken.uid !== 'string' || !decodedToken.uid.trim()) {
    throw new FirebaseAuthError(
      'FIREBASE_ID_TOKEN_INVALID',
      'The Firebase ID token did not contain a valid Firebase user ID.',
      401,
    );
  }

  if (typeof decodedToken.phone_number !== 'string' || !decodedToken.phone_number.trim()) {
    throw new FirebaseAuthError(
      'FIREBASE_PHONE_NOT_VERIFIED',
      'The Firebase account does not contain a verified phone number.',
      401,
    );
  }

  return decodedToken;
}

module.exports = {
  FirebaseAuthError,
  getFirebaseConfig,
  getFirebaseAdminAuth,
  verifyFirebaseIdToken,
};
