import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Eye,
  CheckCircle2,
  DoorOpen,
  ShieldCheck,
  Trash2,
  FileCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { patientApi } from '../services/patientApi';

export function WaitingRoomScreen() {
  const navigate = useNavigate();
  const { activeEncounter, updateActiveEncounter, clearEncounter } = usePatient();

  const [currentStep, setCurrentStep] = useState(activeEncounter?.lifecycle_state || 'WAITING');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!activeEncounter) {
      navigate('/');
    } else {
      setCurrentStep(activeEncounter.lifecycle_state);
    }
  }, [activeEncounter]);

  // Poll the server-side encounter boundary; local storage only carries the
  // encounter identifier across a page refresh.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!activeEncounter?.id) return;
      try {
        const updated = await patientApi.refreshEncounter(activeEncounter.id);
        if (!cancelled) {
          updateActiveEncounter(updated);
          setCurrentStep(updated.lifecycle_state);
        }
      } catch (error) {
        if (error.status === 401 && !cancelled) navigate('/login', { replace: true });
      }
    };

    refresh();
    const interval = setInterval(refresh, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeEncounter?.id, navigate, updateActiveEncounter]);

  if (!activeEncounter) return null;

  const handleFinishAndReturnHome = () => {
    clearEncounter();
    navigate('/');
  };

  const handleEndConsultation = async () => {
    if (!window.confirm('End this consultation? The doctor access boundary will close.')) return;
    setEnding(true);
    try {
      await patientApi.endEncounter(activeEncounter.id);
      clearEncounter();
      navigate('/');
    } catch (error) {
      window.alert(error.message || 'Could not end the consultation.');
    } finally {
      setEnding(false);
    }
  };

  const isCompleted = currentStep === 'CONSULTATION_COMPLETED';
  const patientsAhead = activeEncounter.patients_ahead !== undefined ? activeEncounter.patients_ahead : (activeEncounter.queue_number > 1 ? activeEncounter.queue_number - 1 : 0);
  const queueNumber = activeEncounter.queue_number || (patientsAhead + 1);
  const isNext = patientsAhead === 0;

  return (
    <div className="fade-in" style={{ padding: '8px 0' }}>
      {/* Top Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <span style={{
          fontSize: '0.74rem',
          fontWeight: 700,
          color: 'var(--blue-700)',
          backgroundColor: 'var(--blue-50)',
          padding: '4px 12px',
          borderRadius: 20,
          border: '1px solid var(--blue-200)',
          display: 'inline-block',
          marginBottom: 8,
        }}>
          Encounter ID: {activeEncounter.id.slice(-6).toUpperCase()} • {activeEncounter.visit_type}
        </span>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--navy-900)', marginBottom: 4 }}>
          {activeEncounter.doctor_name}
        </h2>
        <p style={{ fontSize: '0.84rem', color: 'var(--slate-600)' }}>
          {activeEncounter.clinic_name} • Cabin 2
        </p>
      </div>

      {/* Responsive Waiting Room Layout Grid */}
      <div className="waiting-room-grid">
        {/* Left Column: Live Queue Status & Consultation Step */}
        <div>
          {/* DYNAMIC QUEUE POSITION CARD (When waiting or reviewing) */}
          {!isCompleted && currentStep !== 'PLEASE_COME_IN' && (
            <div style={{
              background: 'linear-gradient(135deg, #0a2540 0%, #1e3a8a 100%)',
              borderRadius: 16,
              padding: '18px 20px',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: 20,
              boxShadow: '0 6px 18px rgba(10, 37, 64, 0.12)',
            }}>
              <span style={{ fontSize: '0.78rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Current Queue Position
              </span>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1.1, margin: '4px 0' }}>
                #{queueNumber}
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.14)',
                padding: '3px 12px',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 700,
                marginBottom: 8,
                color: isNext ? '#6ee7b7' : '#e0e7ff',
              }}>
                <Users size={14} />
                <span>{isNext ? "You're next" : `${patientsAhead} patient${patientsAhead > 1 ? 's' : ''} ahead of you`}</span>
              </div>

              <div style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>
                Estimated wait: <strong>{activeEncounter.estimated_wait || (isNext ? '< 5 minutes' : `${patientsAhead * 5}–${(patientsAhead + 1) * 5} minutes`)}</strong>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>
                {activeEncounter.wait_message || (isNext ? 'Please stay nearby.' : "Please stay nearby. We'll notify you when it's your turn.")}
              </p>
            </div>
          )}

          {/* STATE 1: WAITING */}
          {currentStep === 'WAITING' && (
            <div className="v-card" style={{
              textAlign: 'center',
              padding: 24,
              border: '2px solid var(--border-medium)',
              marginBottom: 20,
            }}>
              <div style={{
                width: 64,
                height: 64,
                margin: '0 auto 14px auto',
                borderRadius: '50%',
                backgroundColor: 'var(--slate-100)',
                color: 'var(--slate-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'radarPing 2.5s infinite ease-in-out',
              }}>
                <Clock size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', marginBottom: 6 }}>
                You're in the Queue
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--slate-600)', maxWidth: 360, margin: '0 auto' }}>
                Your structured intake has been submitted. Dr. Mehta will open your chart shortly.
              </p>
            </div>
          )}

          {/* STATE 2: DOCTOR REVIEWING (Doctor action: Review Symptoms) */}
          {currentStep === 'DOCTOR_REVIEWING' && (
            <div className="v-card" style={{
              textAlign: 'center',
              padding: 24,
              border: '2px solid var(--blue-400)',
              backgroundColor: '#eff6ff',
              marginBottom: 20,
            }}>
              <div style={{
                width: 64,
                height: 64,
                margin: '0 auto 14px auto',
                borderRadius: '50%',
                backgroundColor: 'var(--blue-600)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Eye size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', marginBottom: 6 }}>
                Dr. Mehta is reviewing your symptoms
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--blue-900)', maxWidth: 360, margin: '0 auto' }}>
                Doctor has opened your intake chart and is reviewing your chief complaint and symptoms. Please wait...
              </p>
            </div>
          )}

          {/* STATE 3: CONSULTATION STARTED (Doctor action: Start Consultation) */}
          {currentStep === 'CONSULTATION_STARTED' && (
            <div className="v-card" style={{
              textAlign: 'center',
              padding: 24,
              border: '2px solid var(--teal-500)',
              backgroundColor: 'var(--teal-50)',
              marginBottom: 20,
            }}>
              <div style={{
                width: 64,
                height: 64,
                margin: '0 auto 14px auto',
                borderRadius: '50%',
                backgroundColor: 'var(--teal-600)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Stethoscope size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', marginBottom: 6 }}>
                Your consultation has started
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--teal-900)', maxWidth: 360, margin: '0 auto' }}>
                Dr. Mehta is ready for you. Please proceed towards the consultation room.
              </p>
            </div>
          )}

          {/* STATE 4: PLEASE COME IN / IT'S YOUR TURN (Doctor action: Call Patient In) */}
          {currentStep === 'PLEASE_COME_IN' && (
            <div className="v-card" style={{
              textAlign: 'center',
              padding: '28px 20px',
              border: '3px solid #059669',
              backgroundColor: '#ecfdf5',
              marginBottom: 20,
              boxShadow: '0 0 28px rgba(5, 150, 105, 0.28)',
              animation: 'pulseGlow 2s infinite',
            }}>
              <div style={{
                width: 76,
                height: 76,
                margin: '0 auto 14px auto',
                borderRadius: '50%',
                backgroundColor: '#059669',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <DoorOpen size={42} />
              </div>
              <span style={{
                backgroundColor: '#047857',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: 20,
                display: 'inline-block',
                marginBottom: 8,
              }}>
                🔔 IT'S YOUR TURN
              </span>
              <h2 style={{ fontSize: '1.6rem', color: '#064e3b', marginBottom: 6 }}>
                It's your turn — please come in
              </h2>
              <p style={{ fontSize: '0.94rem', color: '#065f46', fontWeight: 600, maxWidth: 360, margin: '0 auto' }}>
                Dr. Mehta is ready to see you in Cabin 2. Please enter now.
              </p>
            </div>
          )}

          {/* STATE 5: CONSULTATION COMPLETED (Doctor action: End Consultation) */}
          {isCompleted && (
            <div className="v-card" style={{
              textAlign: 'center',
              padding: 26,
              border: '2px solid var(--slate-300)',
              backgroundColor: '#ffffff',
              marginBottom: 20,
            }}>
              <div style={{
                width: 64,
                height: 64,
                margin: '0 auto 14px auto',
                borderRadius: '50%',
                backgroundColor: '#059669',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <CheckCircle2 size={34} />
              </div>

              <h3 style={{ fontSize: '1.35rem', color: 'var(--navy-900)', marginBottom: 6 }}>
                Consultation completed
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--slate-600)', marginBottom: 18 }}>
                Your consultation with Dr. Mehta has ended. All notes and findings have been securely saved.
              </p>

              {/* Retention & Deletion Transparency (Section 8) */}
              <div style={{
                textAlign: 'left',
                backgroundColor: 'var(--slate-50)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>
                  <FileCheck size={18} />
                  <span>Retained: Confirmed intake, transcript, and doctor consultation notes</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>
                  <Trash2 size={18} />
                  <span>Deleted: Raw voice audio permanently deleted (Zero storage retained)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: 'var(--slate-600)' }}>
                  <ShieldCheck size={18} />
                  <span>Bounded Access Terminated: Dr. Mehta's query access to this encounter is now sealed</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                onClick={handleFinishAndReturnHome}
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Confirmed Intake & Bounded Access Policy */}
        <div>
          {/* Confirmed Intake Summary Preview */}
          {activeEncounter.intake && (
            <div className="v-card" style={{ padding: 18, marginBottom: 20 }}>
              <h4 style={{ fontSize: '0.92rem', color: 'var(--navy-900)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCheck size={18} color="var(--teal-600)" />
                Your Confirmed Intake for Today
              </h4>
              <div style={{ fontSize: '0.86rem', color: 'var(--slate-700)', lineHeight: 1.6 }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--slate-500)', fontSize: '0.78rem', display: 'block' }}>CHIEF COMPLAINT</span>
                  <strong>{activeEncounter.intake.chief_complaint}</strong>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--slate-500)', fontSize: '0.78rem', display: 'block' }}>DURATION</span>
                  <span>{activeEncounter.intake.duration}</span>
                </div>
                {activeEncounter.intake.symptoms?.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--slate-500)', fontSize: '0.78rem', display: 'block' }}>REPORTED SYMPTOMS</span>
                    <span>{activeEncounter.intake.symptoms.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bounded Access Reminder Notice */}
          {!isCompleted && (
            <div style={{
              padding: '14px 16px',
              backgroundColor: '#ffffff',
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 16,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <ShieldCheck size={22} color="var(--teal-600)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.84rem', color: 'var(--navy-900)', display: 'block', marginBottom: 2 }}>
                  {activeEncounter.visit_type === 'REVISITING' ? 'Revisiting Consultation' : 'New Consultation'}
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', margin: 0, lineHeight: 1.45 }}>
                  {activeEncounter.visit_type === 'REVISITING' && activeEncounter.doctor_access_granted
                    ? "Dr. Mehta has bounded access to your prior notes & published reports while this encounter is OPEN."
                    : "Prior notes and past reports remain locked. Dr. Mehta only sees today's intake."}
                </p>
              </div>
            </div>
          )}
          {!isCompleted && (
            <button type="button" className="btn btn-secondary btn-block" onClick={handleEndConsultation} disabled={ending}>
              {ending ? 'Ending consultation…' : 'End consultation and return to dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
