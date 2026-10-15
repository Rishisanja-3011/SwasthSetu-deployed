const API_BASE = '/api';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'vaani_doc_patient_access_token',
  PATIENT: 'vaani_doc_patient_profile',
  ACTIVE_ENCOUNTER: 'vaani_doc_patient_active_encounter',
};

function parseResponse(response, json) {
  if (response.ok) return json;
  const error = new Error(json?.message || json?.error || 'Request failed');
  error.status = response.status;
  error.code = json?.error;
  error.encounter = json?.encounter;
  throw error;
}

async function request(path, options = {}, authenticated = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (authenticated) {
    const token = patientApi.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await response.json().catch(() => ({}));
  return parseResponse(response, json);
}

function savePatientSession(accessToken, patient) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.PATIENT, JSON.stringify(patient));
}

function providerCodeFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    const parts = url.pathname.split('/').filter(Boolean);
    const scanIndex = parts.findIndex((part) => part.toLowerCase() === 'scan');
    if (scanIndex >= 0 && parts[scanIndex + 1] && parts[scanIndex + 2]) return parts[scanIndex + 2];
    if (scanIndex >= 0 && parts[scanIndex + 1]) return parts[scanIndex + 1];
  } catch {
    // Plain provider codes are accepted below.
  }
  return raw;
}

export const patientApi = {
  getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  getStoredPatient() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PATIENT);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  saveSession(accessToken, patient) {
    savePatientSession(accessToken, patient);
  },

  clearSession() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.PATIENT);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ENCOUNTER);
  },

  async getCurrentProfile() {
    const result = await request('/auth/me');
    if (result.user?.role !== 'PATIENT' || !result.profile) {
      throw new Error('This session is not a patient session.');
    }
    savePatientSession(this.getAccessToken(), result.profile);
    return result.profile;
  },

  async downloadOriginalReport(reportId) {
    const headers = new Headers();
    const token = this.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/patient/reports/${reportId}/original`, { headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      parseResponse(response, payload);
    }
    return response.blob();
  },

  async requestOtp({ phone, providerCode = null }) {
    return request('/auth/patient/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, provider_code: providerCode || undefined }),
    }, false);
  },

  async verifyOtp({ challengeId, otp }) {
    return request('/auth/patient/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ challenge_id: challengeId, otp }),
    }, false);
  },

  async exchangeFirebaseToken({ idToken, providerCode = null }) {
    if (!idToken) throw new Error('Firebase did not return an ID token.');

    const exchangePath = import.meta.env.VITE_PATIENT_FIREBASE_EXCHANGE_PATH || '/auth/patient/firebase/exchange';
    return request(exchangePath, {
      method: 'POST',
      body: JSON.stringify({
        id_token: idToken,
        provider_code: providerCode || undefined,
      }),
    }, false);
  },

  async registerPatient({ registrationToken, name, age, dateOfBirth, gender, providerCode = null }) {
    const result = await request('/auth/patient/register', {
      method: 'POST',
      body: JSON.stringify({
        registration_token: registrationToken,
        name,
        age: age ? Number(age) : null,
        date_of_birth: dateOfBirth || null,
        gender,
        provider_code: providerCode || undefined,
      }),
    }, false);
    savePatientSession(result.access_token, result.patient);
    return result;
  },

  async resolveCode(code) {
    const clean = providerCodeFromInput(code).toUpperCase();
    if (!clean) throw new Error('Code is required.');

    const result = await request(`/providers/resolve/${encodeURIComponent(clean)}`, {}, false);
    const provider = result.provider;
    if (provider.provider_type === 'DOCTOR') {
      return {
        type: 'DOCTOR',
        code: provider.provider_code,
        entity: {
          id: provider.provider_id,
          _id: provider.provider_id,
          qr_code_id: provider.provider_code,
          name: provider.name,
          specialty: provider.specialty,
          clinic_name: provider.clinic_name,
        },
      };
    }

    return {
      type: 'LABORATORY',
      code: provider.provider_code,
      entity: {
        id: provider.provider_id,
        _id: provider.provider_id,
        qr_code_id: provider.provider_code,
        name: provider.name,
        location: provider.location,
      },
    };
  },

  async getPublishedReports() {
    const result = await request('/patient/reports');
    return result.reports || [];
  },

  async getReportById(reportId) {
    const result = await request(`/patient/reports/${encodeURIComponent(reportId)}`);
    return result.report || null;
  },

  async getLabGrants() {
    const result = await request('/patient/lab-grants');
    return result.grants || [];
  },

  async approveLabGrant({ laboratory }) {
    const result = await request('/patient/lab-grants', {
      method: 'POST',
      body: JSON.stringify({ laboratory_code: laboratory.qr_code_id }),
    });
    return result.grant;
  },

  async createEncounter({ doctor, visitType }) {
    const existing = this.getActiveEncounter();
    if (existing?.id && existing.status === 'OPEN' && existing.visit_type === visitType && String(existing.doctor_id) === String(doctor.id || doctor._id || doctor.qr_code_id)) {
      try {
        const current = await this.refreshEncounter(existing.id);
        if (current?.status === 'OPEN') return current;
      } catch {
        this.clearActiveEncounter();
      }
    }
    try {
      const result = await request('/patient/encounters', {
        method: 'POST',
        body: JSON.stringify({ doctor_code: doctor.qr_code_id, visit_type: visitType }),
      });
      const encounter = result.encounter;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ENCOUNTER, JSON.stringify(encounter));
      return encounter;
    } catch (error) {
      if (error.code === 'ONGOING_CONSULTATION' && error.encounter) {
        this.saveActiveEncounter(error.encounter);
        return error.encounter;
      }
      throw error;
    }
  },

  async getActiveEncounterFromServer() {
    const result = await request('/patient/active-encounter');
    if (result.encounter) this.saveActiveEncounter(result.encounter);
    else this.clearActiveEncounter();
    return result.encounter || null;
  },

  async endEncounter(encounterId) {
    const result = await request(`/patient/encounters/${encodeURIComponent(encounterId)}/end`, { method: 'POST' });
    this.clearActiveEncounter();
    return result.encounter;
  },

  saveActiveEncounter(encounter) {
    if (encounter?.id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ENCOUNTER, JSON.stringify(encounter));
    } else {
      this.clearActiveEncounter();
    }
  },

  async processTextIntake({ encounterId, language, text }) {
    const result = await request(`/patient/encounters/${encodeURIComponent(encounterId)}/intake/process-text`, {
      method: 'POST',
      body: JSON.stringify({ input_mode: 'TEXT', language, text }),
    });
    return result.intake;
  },

  async processVoiceIntake({ encounterId, language, browserTranscript = '', transcriptReliable = true, audioBlob = null }) {
    const formData = new FormData();
    formData.append('language', language);
    formData.append('input_mode', 'VOICE');
    formData.append('browser_transcript', browserTranscript);
    formData.append('transcript_reliable', String(transcriptReliable));
    if (audioBlob) formData.append('audio', audioBlob, 'patient-intake.webm');
    const result = await request(`/patient/encounters/${encodeURIComponent(encounterId)}/intake/process-voice`, {
      method: 'POST',
      body: formData,
    });
    return result.intake;
  },

  async prepareSkippedIntake({ encounterId }) {
    const result = await request(`/patient/encounters/${encodeURIComponent(encounterId)}/intake/skip`, { method: 'POST' });
    return result.intake;
  },

  async confirmIntake({ encounterId, inputMode, structuredData }) {
    const result = await request(`/patient/encounters/${encodeURIComponent(encounterId)}/intake/confirm`, {
      method: 'POST',
      body: JSON.stringify({ patient_confirmed: true, input_mode: String(inputMode || '').toUpperCase(), structured_data: structuredData || {} }),
    });
    return result.intake;
  },

  getActiveEncounter() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_ENCOUNTER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  async refreshEncounter(encounterId) {
    const result = await request(`/patient/encounters/${encounterId}`);
    const encounter = result.encounter;
    this.saveActiveEncounter(encounter);
    return encounter;
  },

  clearActiveEncounter() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ENCOUNTER);
  },

  async getHealthTimeline() {
    const result = await request('/patient/timeline');
    return result.consultations || [];
  },

  async getNotifications() {
    return request('/patient/notifications');
  },

  async markNotificationRead(id) {
    return request(`/patient/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead() {
    return request('/patient/notifications/read-all', { method: 'POST' });
  },

  /**
   * Fixed, report-grounded educational explanations for the canonical
   * Assistant page. It never generates a diagnosis or treatment advice.
   */
  async queryAssistant(questionText, contextReport = null) {
    const query = String(questionText || '').toLowerCase().trim();
    if (query.includes('diagnos') || query.includes('cancer') || query.includes('dengue') || query.includes('disease') || query.includes('cure')) {
      return {
        answer: 'VaaniDoc does not provide medical diagnoses. Please discuss symptoms and report findings directly with your doctor.',
        isSafetyNotice: true,
      };
    }
    if (query.includes('medicine') || query.includes('tablet') || query.includes('prescription') || query.includes('dose') || query.includes('what should i take')) {
      return {
        answer: 'VaaniDoc does not prescribe medicines or recommend dosages. Treatment decisions must come from your licensed physician.',
        isSafetyNotice: true,
      };
    }

    const observations = contextReport?.observations || [];
    if (query.includes('hemoglobin') || query.includes('haemoglobin') || query.includes('hb')) {
      const observation = observations.find((item) => item.test_name_normalized?.toLowerCase().includes('hemoglobin'));
      return {
        answer: observation
          ? `Your published report shows Hemoglobin at ${observation.value} ${observation.unit || ''} (${observation.flag || 'not flagged'}). ${observation.explanation || ''}`
          : 'Hemoglobin is the oxygen-carrying protein in red blood cells. Ask your doctor to interpret your result in context.',
        isSafetyNotice: false,
      };
    }
    if (query.includes('wbc') || query.includes('white blood') || query.includes('leucocyte')) {
      const observation = observations.find((item) => item.test_name_normalized?.toLowerCase().includes('wbc'));
      return {
        answer: observation
          ? `Your published report shows WBC at ${observation.value} ${observation.unit || ''} (${observation.flag || 'not flagged'}). ${observation.explanation || ''}`
          : 'White blood cells are part of the immune system. Ask your doctor to interpret the report-specific result.',
        isSafetyNotice: false,
      };
    }
    if (query.includes('platelet') || query.includes('clot') || query.includes('bleeding')) {
      const observation = observations.find((item) => item.test_name_normalized?.toLowerCase().includes('platelet'));
      return {
        answer: observation
          ? `Your published report shows Platelets at ${observation.value} ${observation.unit || ''} (${observation.flag || 'not flagged'}). ${observation.explanation || ''}`
          : 'Platelets help the blood form clots. Ask your doctor to interpret the report-specific result.',
        isSafetyNotice: false,
      };
    }
    return {
      answer: 'A Complete Blood Count measures red blood cells, white blood cells, and platelets. HIGH or LOW flags compare a value with the laboratory-provided reference range.',
      isSafetyNotice: false,
    };
  },
};
