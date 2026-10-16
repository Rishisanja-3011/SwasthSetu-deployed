const LOCAL_PATIENT_ORIGIN = 'http://localhost:5176';
const DEMO_PATIENT_ORIGIN = 'https://swasth-setu-xi.vercel.app';

export function getPatientAppOrigin() {
  const configuredOrigin = String(import.meta.env.VITE_PATIENT_APP_URL || '').trim();

  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.origin;
      }
    } catch {
      // Fall through to the development-only fallback below.
    }
  }

  // Local development remains convenient. The deployed demo origin prevents
  // an unset Vercel variable from producing a broken/localhost QR code.
  return import.meta.env.DEV ? LOCAL_PATIENT_ORIGIN : DEMO_PATIENT_ORIGIN;
}

export function patientScanUrl(providerType, providerCode) {
  const origin = getPatientAppOrigin();
  const code = String(providerCode || '').trim();
  if (!origin || !code) return '';

  const type = providerType === 'laboratory' ? 'lab' : providerType;
  return `${origin}/scan/${type}/${encodeURIComponent(code)}`;
}

export function patientScanConfigMessage() {
  return 'Set VITE_PATIENT_APP_URL to the deployed patient app before generating a production QR code.';
}
