import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Building2,
  FileText,
  Clock,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Activity,
  UserCheck,
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { patientApi } from '../services/patientApi';
import { QRScannerModal } from '../components/QRScannerModal';
import { LabPermissionModal } from '../components/LabPermissionModal';
import { StatusBadge } from '../components/StatusBadge';
import './HomeScreen.css';

export function HomeScreen() {
  const navigate = useNavigate();
  const { patient, activeEncounter } = usePatient();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedLabEntity, setSelectedLabEntity] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [reports, setReports] = useState([]);
  const [labGrants, setLabGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualError, setManualError] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadHomeData();
  }, [patient]);

  const loadHomeData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [reps, grants] = await Promise.all([
        patientApi.getPublishedReports(),
        patientApi.getLabGrants(),
      ]);
      setReports(reps.slice(0, 3));
      setLabGrants(grants);
    } catch (err) {
      setLoadError(err.message || 'Your records could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeResolved = (resolved) => {
    if (resolved.type === 'DOCTOR') {
      navigate('/doctor-confirm', { state: { doctor: resolved.entity } });
    } else if (resolved.type === 'LABORATORY') {
      setSelectedLabEntity(resolved.entity);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim() || isSubmitting) return;
    setManualError(null);
    setIsSubmitting(true);
    try {
      const resolved = await patientApi.resolveCode(manualCode.trim());
      handleCodeResolved(resolved);
    } catch (err) {
      setManualError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLabGrantSuccess = (grant) => {
    setLabGrants((currentGrants) => {
      const grantId = String(grant?.id || grant?._id || '');
      const withoutDuplicate = currentGrants.filter((currentGrant) => (
        String(currentGrant.id || currentGrant._id || '') !== grantId
      ));
      return grant ? [grant, ...withoutDuplicate] : currentGrants;
    });
    navigate('/reports');
  };

  const activeGrant = labGrants.find((g) => g.status === 'ACTIVE');

  return (
    <div className="fade-in">
      {/* Patient Welcome Card */}
      <div className="home-welcome page-heading">
        <div className="home-welcome-meta">
          <span className="home-patient-id">ID: {patient.patient_identifier}</span>
          <span className="home-ownership"><ShieldCheck size={14} /> Self-Owned Health Record</span>
        </div>
        <span className="page-eyebrow">Your personal health space</span>
        <h1>
          Namaste, {patient.name.split(' ')[0]}
        </h1>
        <p>
          Connect with your doctor, describe symptoms in your language, and keep your health records close.
        </p>
        {activeEncounter?.status === 'OPEN' && (
          <button className="btn btn-outline-teal home-resume" onClick={() => navigate('/waiting')}>
            <Activity size={16} /> Return to your active visit <ArrowRight size={16} />
          </button>
        )}
      </div>



      {/* Main Home Responsive Grid */}
      <div className="home-content-grid">
        {/* Column 1: Clinic / Lab Access & QR Scanner */}
        <div>
          {/* Active Lab Grant Card (If patient granted access to lab) */}
          {activeGrant && (
            <div style={{
              backgroundColor: '#e6f7f4',
              border: '1px solid var(--teal-300)',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <Building2 size={24} color="var(--teal-700)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="status-pill active" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                    Lab Visit Active
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--teal-800)', fontFamily: 'var(--font-mono)' }}>
                    {activeGrant.laboratory_code}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--teal-900)', marginTop: 2 }}>
                  {activeGrant.laboratory_name}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--teal-800)', margin: 0 }}>
                  Specimen analysis in progress. Lab access expires immediately upon report publication.
                </p>
              </div>
            </div>
          )}

          {/* Primary Action Card: SCAN QR */}
          <div className="v-card home-scan-card" style={{
            padding: '24px 20px',
            textAlign: 'center',
            marginBottom: 24,
            border: '1.5px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{
              width: 72,
              height: 72,
              margin: '0 auto 16px auto',
              borderRadius: 20,
              background: 'linear-gradient(135deg, var(--teal-50) 0%, var(--teal-100) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--teal-600)',
              boxShadow: 'var(--shadow-glow)',
            }}>
              <QrCode size={38} />
            </div>

            <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', marginBottom: 6 }}>
              Visiting a Clinic or Laboratory?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--slate-600)', marginBottom: 18 }}>
              Scan the QR code at the doctor’s reception desk or diagnostic center.
            </p>

            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={() => setIsScannerOpen(true)}
              style={{ marginBottom: 16 }}
            >
              <QrCode size={20} />
              Scan Reception QR
            </button>

            {/* Fallback Manual Code Entry */}
            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 16,
              marginTop: 6,
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--slate-500)', display: 'block', marginBottom: 10 }}>
                or enter Clinic / Lab code manually:
              </span>

              <form className="home-code-form" onSubmit={handleManualSubmit}>
                <input
                  type="text"
                  aria-label="Clinic or laboratory code"
                  placeholder="e.g. DOC-409 or LAB-808"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-medium)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.92rem',
                    textTransform: 'uppercase',
                  }}
                />
                <button type="submit" disabled={isSubmitting || !manualCode.trim()} className="btn btn-secondary" style={{ padding: '10px 18px' }}>
                  {isSubmitting ? 'Checking…' : 'Continue'}
                </button>
              </form>

              {manualError && (
                <div role="alert" style={{
                  marginTop: 10,
                  fontSize: '0.78rem',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'center',
                }}>
                  <AlertCircle size={14} />
                  <span>{manualError}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Published Diagnostic Reports Preview */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-900)' }}>My Published Reports</h3>
            <button
              onClick={() => navigate('/reports')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--teal-600)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              View All
              <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="v-card page-state" role="status"><Activity size={26} /><p>Loading your published records…</p></div>
          ) : loadError ? (
            <div className="v-card page-state page-state-error" role="alert"><AlertCircle size={26} /><p>{loadError}</p><button className="btn btn-secondary" onClick={loadHomeData}>Try again</button></div>
          ) : reports.length === 0 ? (
            <div className="v-card" style={{ padding: 28, textAlign: 'center', color: 'var(--slate-500)' }}>
              <FileText size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
              <h4 style={{ fontSize: '0.95rem', color: 'var(--navy-900)', marginBottom: 4 }}>No Published Reports Yet</h4>
              <p style={{ fontSize: '0.84rem' }}>When an accredited lab publishes your CBC report, it appears here automatically.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map((rep) => (
                <button
                  type="button"
                  key={rep._id}
                  className="v-card record-card"
                  onClick={() => navigate(`/report/${rep._id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: 'var(--teal-50)',
                      color: 'var(--teal-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="record-card-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: '0.94rem', color: 'var(--navy-900)' }}>{rep.test_type}</strong>
                        <StatusBadge status={rep.status} />
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--slate-500)', marginTop: 2 }}>
                        {rep.laboratory_name} • {new Date(rep.published_at || rep.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--slate-400)" />
                </button>
              ))}
            </div>
          )}

          {/* Quick Info Tip Card for Desktop Balance */}
          <div style={{
            marginTop: 16,
            padding: '14px 16px',
            backgroundColor: '#ffffff',
            borderRadius: 14,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <ShieldCheck size={20} color="var(--teal-600)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: 2 }}>
                Patient-Owned Health Data
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', margin: 0, lineHeight: 1.45 }}>
                Your clinical records and reports are stored under your personal control. Visiting doctors only receive temporary access with your explicit permission.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCodeResolved={handleCodeResolved}
      />

      <LabPermissionModal
        isOpen={!!selectedLabEntity}
        labEntity={selectedLabEntity}
        onClose={() => setSelectedLabEntity(null)}
        onSuccess={handleLabGrantSuccess}
      />
    </div>
  );
}
