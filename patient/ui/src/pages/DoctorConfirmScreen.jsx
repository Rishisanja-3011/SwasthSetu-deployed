import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Stethoscope, CheckCircle2, RefreshCw, Building2, MapPin, Award } from 'lucide-react';
import { patientApi } from '../services/patientApi';

export function DoctorConfirmScreen() {
  const location = useLocation();
  const navigate = useNavigate();

  const [storedDoctor] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('vaanidoc_pending_scan_provider') || 'null')?.entity || null; } catch { return null; }
  });
  const [doctor, setDoctor] = useState(location.state?.doctor || storedDoctor);

  useEffect(() => {
    if (doctor) return undefined;
    const code = new URLSearchParams(location.search).get('provider');
    if (!code) return undefined;
    let cancelled = false;
    patientApi.resolveCode(code).then((resolved) => {
      if (!cancelled && resolved.type === 'DOCTOR') setDoctor(resolved.entity);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [doctor, location.search]);

  if (!doctor) {
    return (
      <div className="v-card" style={{ maxWidth: 520, margin: '70px auto', padding: 28, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--navy-900)', marginBottom: 8 }}>Doctor QR session expired</h2>
        <p style={{ color: 'var(--slate-600)', marginBottom: 18 }}>The doctor details are still loading. If this page remains here, scan the doctor QR again or return to the patient homepage.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>Return to patient home</button>
      </div>
    );
  }

  const handleConfirm = () => {
    navigate('/visit-type', { state: { doctor } });
  };

  const handleScanAgain = () => {
    sessionStorage.removeItem('vaanidoc_pending_scan_provider');
    navigate('/');
  };

  return (
    <div className="fade-in page-centered-container" style={{ maxWidth: 620, padding: '12px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: 'var(--teal-700)',
          backgroundColor: 'var(--teal-50)',
          padding: '4px 12px',
          borderRadius: 20,
          border: '1px solid var(--teal-200)',
          display: 'inline-block',
          marginBottom: 12,
        }}>
          QR Code Verified • {doctor.qr_code_id}
        </span>
        <h2 style={{ fontSize: '1.45rem', color: 'var(--navy-900)', marginBottom: 6 }}>
          Confirm Your Doctor
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--slate-600)' }}>
          Please confirm that you are visiting the correct physician before proceeding.
        </p>
      </div>

      {/* Doctor Card */}
      <div className="v-card" style={{
        padding: '24px 20px',
        border: '2px solid var(--teal-200)',
        boxShadow: '0 8px 24px rgba(0, 168, 132, 0.08)',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: 'var(--teal-500)',
        }} />

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: 'var(--blue-50)',
            color: 'var(--blue-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid var(--blue-200)',
          }}>
            <Stethoscope size={30} />
          </div>

          <div>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--navy-900)', marginBottom: 2 }}>
              {doctor.name}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--blue-700)', fontWeight: 600 }}>
              {doctor.specialty}
            </p>
            <div style={{
              display: 'inline-block',
              marginTop: 6,
              fontSize: '0.74rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--slate-600)',
              backgroundColor: 'var(--slate-100)',
              padding: '2px 8px',
              borderRadius: 4,
            }}>
              CODE: {doctor.qr_code_id} • {doctor.room_number || 'Consultation Room'}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', color: 'var(--slate-700)', marginBottom: 8 }}>
            <Building2 size={16} color="var(--slate-500)" />
            <span>Clinic: <strong>{doctor.clinic_name}</strong></span>
          </div>

          {doctor.languages && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: 'var(--slate-600)' }}>
              <Award size={16} color="var(--slate-500)" />
              <span>Languages: {doctor.languages.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={handleConfirm}
        >
          <CheckCircle2 size={20} />
          Confirm Doctor & Continue
        </button>

        <button
          className="btn btn-secondary btn-block"
          onClick={handleScanAgain}
        >
          <RefreshCw size={16} />
          Scan Again / Wrong Doctor
        </button>
      </div>
    </div>
  );
}
