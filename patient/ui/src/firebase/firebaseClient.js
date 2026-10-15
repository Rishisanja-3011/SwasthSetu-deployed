import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const REQUIRED_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];
let firebaseAuth = null;
let recaptchaVerifier = null;

function getFirebaseConfigError() {
  const missingKeys = REQUIRED_CONFIG_KEYS.filter((key) => !firebaseConfig[key]);
  if (!missingKeys.length) return null;

  const envNames = missingKeys.map((key) => `VITE_FIREBASE_${key === 'apiKey' ? 'API_KEY' : key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);
  return new Error(`Firebase phone authentication is not configured. Set ${envNames.join(', ')} in the patient UI environment.`);
}

function getFirebaseAuth() {
  const configError = getFirebaseConfigError();
  if (configError) throw configError;
  if (firebaseAuth) return firebaseAuth;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

export function resetFirebaseRecaptcha() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

function getFirebaseRecaptchaVerifier() {
  const auth = getFirebaseAuth();
  if (recaptchaVerifier) return recaptchaVerifier;

  recaptchaVerifier = new RecaptchaVerifier(auth, 'firebase-recaptcha-container', {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => resetFirebaseRecaptcha(),
  });
  return recaptchaVerifier;
}

export async function sendFirebaseVerificationCode(phoneNumber) {
  const auth = getFirebaseAuth();
  const verifier = getFirebaseRecaptchaVerifier();
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyFirebaseCode(confirmationResult, verificationCode) {
  if (!confirmationResult) {
    throw new Error('Request a verification code before entering the code.');
  }

  const credential = await confirmationResult.confirm(verificationCode);
  return {
    user: credential.user,
    idToken: await credential.user.getIdToken(),
  };
}

export function firebaseErrorMessage(error) {
  const messages = {
    'auth/invalid-phone-number': 'Enter the Firebase phone number in international format, for example +919876543210.',
    'auth/invalid-verification-code': 'The verification code is invalid. Check the fixed test code and try again.',
    'auth/code-expired': 'The verification code expired. Request a new code.',
    'auth/too-many-requests': 'Too many verification attempts. Wait a moment and try again.',
    'auth/quota-exceeded': 'Firebase phone verification quota was exceeded. Try again later.',
    'auth/captcha-check-failed': 'The reCAPTCHA check failed. Request a new verification code.',
  };

  return messages[error?.code] || error?.message || 'Firebase phone authentication failed.';
}
