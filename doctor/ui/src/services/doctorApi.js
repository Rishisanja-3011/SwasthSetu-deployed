const AUTH_BASE = '/api/auth';
const API_BASE = '/api/doctor';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'vaanidoc_doctor_access_token',
  ACTIVE_DOCTOR: 'vaanidoc_doctor_session',
  ACTIVE_ENCOUNTER: 'vaanidoc_encounter_active',
};

function normalizeDoctor(doctor) {
  if (!doctor) return null;
  return {
    ...doctor,
    id: doctor.id || doctor._id || doctor.provider_id,
    _id: doctor._id || doctor.id || doctor.provider_id,
    doctor_code: doctor.doctor_code || doctor.qr_code_id || doctor.provider_code,
    qr_code_id: doctor.qr_code_id || doctor.doctor_code || doctor.provider_code,
  };
}

function parseResponse(response, json) {
  if (response.ok && json?.success !== false) return json;
  const error = new Error(json?.message || json?.error || 'Request failed');
  error.status = response.status;
  error.code = json?.error;
  throw error;
}

async function request(path, options = {}, authenticated = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const token = doctorApi.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const json = await response.json().catch(() => ({}));
  return parseResponse(response, json);
}

export const doctorApi = {
  getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  getActiveDoctor() {
    if (!this.getAccessToken()) return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_DOCTOR);
      return stored ? normalizeDoctor(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  },

  setSession(accessToken, doctor) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DOCTOR, JSON.stringify(normalizeDoctor(doctor)));
  },

  setActiveDoctor(doctor) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DOCTOR, JSON.stringify(normalizeDoctor(doctor)));
  },

  clearActiveDoctor() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOCTOR);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ENCOUNTER);
  },

  async getCurrentProfile() {
    const result = await request(`${AUTH_BASE}/me`);
    if (result.user?.role !== 'DOCTOR' || !result.profile) {
      throw new Error('This session is not a doctor session.');
    }
    const doctor = normalizeDoctor(result.profile);
    this.setActiveDoctor(doctor);
    return doctor;
  },

  async registerDoctor(data) {
    const result = await request(`${AUTH_BASE}/doctor/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, false);
    const doctor = normalizeDoctor(result.doctor);
    this.setSession(result.access_token, doctor);
    return doctor;
  },

  async loginDoctor(credentials) {
    const result = await request(`${AUTH_BASE}/provider/login`, {
      method: 'POST',
      body: JSON.stringify({
        provider_code: credentials.provider_code || credentials.doctor_code,
        phone: credentials.phone,
        provider_type: 'DOCTOR',
      }),
    }, false);
    const doctor = normalizeDoctor(result.provider);
    this.setSession(result.access_token, doctor);
    return doctor;
  },

  async getDoctorProfile(doctorId) {
    const result = await request(`${API_BASE}/profile/${encodeURIComponent(doctorId)}`);
    return normalizeDoctor(result.doctor);
  },

  async getDoctorQueue(doctorId) {
    const result = await request(`${API_BASE}/queue/${encodeURIComponent(doctorId)}`);
    return result.queue || [];
  },

  async reviewSymptoms(encounterId) {
    const result = await request(`${API_BASE}/encounter/${encounterId}/review`, { method: 'POST' });
    this._syncLocalEncounterState(result.encounter);
    return result.encounter;
  },

  async getCockpitData(encounterId) {
    try {
      return await request(`${API_BASE}/encounter/${encounterId}/cockpit`);
    } catch (error) {
      if (error.status === 403) error.code = 'BOUNDED_ACCESS_EXPIRED';
      throw error;
    }
  },

  async startConsultation(encounterId) {
    const result = await request(`${API_BASE}/encounter/${encounterId}/start`, { method: 'POST' });
    this._syncLocalEncounterState(result.encounter);
    return result.encounter;
  },

  async saveConsultationNotes(encounterId, notesText) {
    const result = await request(`${API_BASE}/encounter/${encounterId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ notes_text: notesText }),
    });
    return result.note;
  },

  async orderDiagnostic(encounterId, { test_type = 'CBC', clinical_notes = '' }) {
    const result = await request(`${API_BASE}/encounter/${encounterId}/order-diagnostic`, {
      method: 'POST',
      body: JSON.stringify({ test_type, clinical_notes }),
    });
    return result.order;
  },

  async endConsultation(encounterId) {
    const result = await request(`${API_BASE}/encounter/${encounterId}/end`, { method: 'POST' });
    this._syncLocalEncounterState(result.encounter);
    return result.encounter;
  },

  async downloadOriginalReport(encounterId, reportId) {
    const token = this.getAccessToken();
    const response = await fetch(`${API_BASE}/encounter/${encodeURIComponent(encounterId)}/reports/${encodeURIComponent(reportId)}/original`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload.message || payload.error || 'Original report is unavailable.');
      error.status = response.status;
      throw error;
    }
    return response.blob();
  },

  async getNotifications(doctorId) {
    const result = await request(`${API_BASE}/notifications/${encodeURIComponent(doctorId)}`);
    return { notifications: result.notifications || [], unreadCount: result.unread_count || 0 };
  },

  async markNotificationRead(notificationId) {
    return request(`${API_BASE}/notifications/${notificationId}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead(doctorId) {
    return request(`${API_BASE}/notifications/read-all/${encodeURIComponent(doctorId)}`, { method: 'POST' });
  },

  _syncLocalEncounterState(encounter = {}) {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_ENCOUNTER);
      if (!stored) return;
      const active = JSON.parse(stored);
      Object.assign(active, encounter);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ENCOUNTER, JSON.stringify(active));
    } catch (error) {
      console.warn('Storage sync error:', error);
    }
  },
};
