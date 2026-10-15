import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  Save,
  Shield,
  ShieldAlert,
  Clock,
  User,
  Stethoscope,
  Lock,
} from 'lucide-react';
import { doctorApi } from '../services/doctorApi';
import { StatusBadge } from '../components/StatusBadge';
import { DualSymptomIntakeCard } from '../components/DualSymptomIntakeCard';
import { RevisitingHistorySection } from '../components/RevisitingHistorySection';
import { DiagnosticOrderModal } from '../components/DiagnosticOrderModal';
import { useDoctorAuth } from '../context/DoctorAuthContext';

export const ClinicalCockpitScreen = () => {
  const { encounterId } = useParams();
  const { doctor, refreshQueue } = useDoctorAuth();
  const navigate = useNavigate();

  const [cockpitData, setCockpitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessExpired, setAccessExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Consultation state
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [startingConsultation, setStartingConsultation] = useState(false);
  const [endingConsultation, setEndingConsultation] = useState(false);
  const [consultationEnded, setConsultationEnded] = useState(false);

  // Fetch Cockpit Data on Mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setAccessExpired(false);
      setErrorMessage(null);

      try {
        // Automatically mark as DOCTOR_REVIEWING if still in WAITING state
        try {
          await doctorApi.reviewSymptoms(encounterId);
        } catch (e) {
          // If already in review or calling, continue
        }

        const data = await doctorApi.getCockpitData(encounterId);
        if (isMounted) {
          setCockpitData(data);
          setNotesText(data.current_note || '');
        }
      } catch (err) {
        if (!isMounted) return;
        if (err.code === 'BOUNDED_ACCESS_EXPIRED' || err.status === 403) {
          setAccessExpired(true);
        } else {
          setErrorMessage(err.message || 'Failed to load clinical cockpit');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [encounterId]);

  // Handle: Start Consultation (Doctor calls patient in)
  const handleStartConsultation = async () => {
    setStartingConsultation(true);
    try {
      const updated = await doctorApi.startConsultation(encounterId);
      setCockpitData(prev => ({
        ...prev,
        encounter: {
          ...prev.encounter,
          status: 'IN_CONSULTATION',
           queue_status: updated.queue_status,
           lifecycle_state: updated.lifecycle_state,
          started_at: updated.started_at,
        },
      }));
      await refreshQueue();
    } catch (err) {
      alert(err.message || 'Error starting consultation');
    } finally {
      setStartingConsultation(false);
    }
  };

  // Handle: Save Notes
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setNotesSavedSuccess(false);
    try {
      await doctorApi.saveConsultationNotes(encounterId, notesText);
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2500);
    } catch (err) {
      alert(err.message || 'Error saving notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // Handle: End Consultation (Closure & Access Lock)
  const handleEndConsultation = async () => {
    const confirmEnd = window.confirm(
      'Are you sure you want to end this consultation?\n\n• Encounter will be CLOSED\n• Patient will see "Consultation completed"\n• Doctor query access will terminate (403 locked)\n• Patient will be removed from active queue\n• Raw voice audio will be permanently destroyed'
    );
    if (!confirmEnd) return;

    setEndingConsultation(true);
    try {
      // Save any pending notes first
      if (notesText.trim()) {
        await doctorApi.saveConsultationNotes(encounterId, notesText);
      }
      await doctorApi.endConsultation(encounterId);
      setConsultationEnded(true);
      await refreshQueue();
    } catch (err) {
      alert(err.message || 'Error ending consultation');
      setEndingConsultation(false);
    }
  };

  // 1. BOUNDED ACCESS EXPIRED LOCK SCREEN (Server-enforced 403)
  if (accessExpired) {
    return (
      <div className="fade-in" style={{ maxWidth: 650, margin: '60px auto', textAlign: 'center' }}>
        <div className="v-card" style={{
          padding: 36,
          border: '2px solid var(--slate-300)',
          backgroundColor: '#ffffff',
          borderRadius: 20,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}>
            <Lock size={32} />
          </div>

          <span style={{
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            fontSize: '0.76rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '3px 12px',
            borderRadius: 20,
            display: 'inline-block',
            marginBottom: 10,
          }}>
            BOUNDED ACCESS EXPIRED (403 FORBIDDEN)
          </span>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: 8 }}>
            Consultation Encounter is Sealed
          </h2>

          <p style={{ fontSize: '0.9rem', color: 'var(--slate-600)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 20px auto' }}>
             Under the VaaniDoc Bounded Access model, active physician query access terminates automatically once the consultation ends.
          </p>

          <div style={{
            padding: 14,
            backgroundColor: 'var(--slate-50)',
            borderRadius: 10,
            border: '1px solid var(--slate-200)',
            fontSize: '0.8rem',
            color: 'var(--slate-600)',
            textAlign: 'left',
            marginBottom: 24,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)', marginBottom: 4 }}>
              Data Retention Status:
            </div>
            <div>• Doctor chart active query access: <strong>TERMINATED</strong></div>
            <div>• Raw voice audio: <strong>PERMANENTLY DESTROYED</strong></div>
            <div>• Retained records: <strong>Transcript, structured intake & consultation notes safely archived</strong></div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            style={{ width: '100%', padding: '12px 0' }}
          >
            <span>Return to Today's Patient Queue</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. LOADING STATE
  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--slate-500)' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>Loading Clinical Cockpit...</div>
        <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Applying server-side bounded access rules</div>
      </div>
    );
  }

  // 3. CONSULTATION ENDED BANNER
  if (consultationEnded) {
    return (
      <div className="fade-in" style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <div className="v-card" style={{ padding: 36 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: 6 }}>
            Consultation Completed Successfully
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--slate-600)', marginBottom: 20 }}>
            Encounter is now closed. Doctor query access has expired and the patient has been removed from your active queue.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            style={{ width: '100%', padding: '12px 0' }}
          >
            <span>Proceed to Next Patient in Queue</span>
          </button>
        </div>
      </div>
    );
  }

  const encounter = cockpitData?.encounter;
  const patient = cockpitData?.patient;
  const intake = cockpitData?.intake;
  const priorNotes = cockpitData?.prior_notes || [];
  const priorIntakes = cockpitData?.prior_intakes || [];
  const publishedReports = cockpitData?.published_reports || [];
  const currentOrders = cockpitData?.current_orders || [];

  const isConsultationActive = encounter?.queue_status === 'CALLED' || encounter?.queue_status === 'IN_CONSULTATION' || encounter?.lifecycle_state === 'PLEASE_COME_IN';
  const isNewVisit = encounter?.visit_type === 'NEW';
  const isRevisiting = encounter?.visit_type === 'REVISITING';

  return (
    <div className="fade-in">
      {/* Back to Queue Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--slate-600)',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Today's Queue</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--slate-500)', fontWeight: 600 }}>
            Encounter ID: {encounter?.id ? encounter.id.slice(-6).toUpperCase() : 'ENC-LIVE'}
          </span>
          <StatusBadge type={encounter?.lifecycle_state || encounter?.status} />
        </div>
      </div>

      {/* Patient Header Banner */}
      <div className="v-card" style={{
        backgroundColor: '#ffffff',
        borderLeft: '5px solid var(--navy-900)',
        marginBottom: 20,
        padding: '18px 24px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy-900)' }}>
                {patient?.name}
              </h1>
              <StatusBadge type={encounter?.visit_type} />
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--slate-600)', marginTop: 2 }}>
              ID: <strong>{patient?.patient_identifier || '— Not available yet —'}</strong> • Age: <strong>{patient?.age ? `${patient.age}y` : '— Not available yet —'}</strong> • Gender: <strong>{patient?.gender || '— Not available yet —'}</strong> • Phone: <strong>{patient?.phone || '— Not available yet —'}</strong>
            </div>
          </div>

          {/* Action CTAs: Start Consultation or Active indicator */}
          <div>
            {!isConsultationActive ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <button
                  onClick={handleStartConsultation}
                  className="btn-teal"
                  style={{
                    padding: '12px 26px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(0, 168, 132, 0.3)',
                  }}
                  disabled={startingConsultation}
                >
                  <DoorOpen size={18} />
                  <span>{startingConsultation ? 'Calling Patient...' : 'Start Consultation'}</span>
                </button>
                <span style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                  Calls patient: patient sees "It's your turn. Dr. Mehta is ready for you. Please come in."
                </span>
              </div>
            ) : (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #6ee7b7',
                padding: '8px 16px',
                borderRadius: 12,
                fontSize: '0.86rem',
                fontWeight: 700,
              }}>
                <DoorOpen size={18} color="#059669" />
                <span>Patient Called In • Consultation In Progress</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1. DUAL SYMPTOM VIEW (Verbatim statement vs Structured AI intake) */}
      <DualSymptomIntakeCard intake={intake} />

      {/* 2. BOUNDED ACCESS CONDITIONAL SECTIONS */}
      {/* CASE A: REVISITING -> Shows prior notes by this doctor + all published reports */}
      {isRevisiting && (
        <RevisitingHistorySection
          encounterId={encounterId}
          priorNotes={priorNotes}
          priorIntakes={priorIntakes}
          publishedReports={publishedReports}
          doctorName={doctor?.name || 'Dr. Ramesh Mehta'}
        />
      )}

      {/* CASE B: NEW -> Reassurance that historical records are sealed */}
      {isNewVisit && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border-medium)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <Shield size={20} color="var(--blue-600)" />
          <div style={{ fontSize: '0.82rem', color: 'var(--slate-600)' }}>
            <strong>NEW Consultation Access Scope:</strong> You are consulting this patient for a fresh episode. Previous historical consultation notes and historical laboratory reports remain locked under VaaniDoc bounded privacy rules.
          </div>
        </div>
      )}

      {/* 3. CLINICAL CONSULTATION WORKSPACE (Notes & Diagnostic Orders) */}
      <div className="v-card" style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={20} color="var(--teal-600)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              Consultation Notes & Clinical Assessment
            </h3>
          </div>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--blue-800)',
            backgroundColor: 'var(--blue-50)',
            padding: '2px 8px',
            borderRadius: 12,
          }}>
            DOCTOR_ENTERED
          </span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 6 }}>
            Physician Clinical Notes (Stored with Encounter)
          </label>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            rows={5}
            placeholder="Record clinical impressions, observations, advice, or next steps here..."
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-medium)',
              fontSize: '0.92rem',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              color: 'var(--navy-900)',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleSaveNotes}
              className="btn-secondary"
              style={{ fontSize: '0.86rem' }}
              disabled={savingNotes}
            >
              <Save size={15} />
              <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
            </button>
            {notesSavedSuccess && (
              <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                ✓ Notes saved to encounter
              </span>
            )}
          </div>

          {/* Diagnostic Order CTA */}
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="btn-primary"
            style={{ fontSize: '0.86rem' }}
          >
            <FlaskConical size={15} />
            <span>+ Order CBC Diagnostic Test</span>
          </button>
        </div>

        {/* Existing Diagnostic Orders list */}
        {currentOrders.length > 0 && (
          <div style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: 8 }}>
              Active Diagnostic Orders for this Encounter:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {currentOrders.map((ord, idx) => (
                <div
                  key={ord._id || idx}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--slate-50)',
                    border: '1px solid var(--slate-200)',
                    fontSize: '0.82rem',
                    color: 'var(--navy-900)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <FlaskConical size={14} color="var(--teal-600)" />
                  <span><strong>{ord.test_type}</strong> ({ord.status})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. END CONSULTATION FOOTER ACTION */}
      <div className="v-card" style={{
        backgroundColor: '#ffffff',
        border: '1px solid #fed7aa',
        borderLeft: '5px solid #f97316',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '20px 24px',
      }}>
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy-900)' }}>
            Complete Consultation & Lock Encounter
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--slate-600)', maxWidth: 540, marginTop: 2 }}>
            Finalize this visit. The patient will immediately see "Consultation completed", raw voice audio will be permanently destroyed, and active doctor query access will terminate.
          </p>
        </div>

        <button
          onClick={handleEndConsultation}
          className="btn-danger"
          style={{ padding: '12px 28px', fontSize: '0.94rem' }}
          disabled={endingConsultation}
        >
          <span>{endingConsultation ? 'Closing Encounter...' : 'End Consultation'}</span>
        </button>
      </div>

      {/* Diagnostic Order Modal */}
      <DiagnosticOrderModal
        encounterId={encounterId}
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onOrderCreated={(newOrder) => {
          setCockpitData(prev => ({
            ...prev,
            current_orders: [...(prev.current_orders || []), newOrder],
          }));
        }}
      />
    </div>
  );
};
