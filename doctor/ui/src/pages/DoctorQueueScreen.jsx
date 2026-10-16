import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Eye, Sparkles, RefreshCw, PlusCircle, AlertCircle, Clock, ChevronRight, Stethoscope } from 'lucide-react';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { doctorApi } from '../services/doctorApi';

export const DoctorQueueScreen = () => {
  const { doctor, queue, refreshQueue } = useDoctorAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const navigate = useNavigate();

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshQueue();
    setTimeout(() => setRefreshing(false), 300);
  };

  const handleSelectPatient = (encounterId) => {
    navigate(`/cockpit/${encounterId}`);
  };

  return (
    <div className="fade-in">
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--navy-900)' }}>
              Today's Consultation Queue
            </h1>
            <span style={{
              backgroundColor: 'var(--blue-50)',
              color: 'var(--blue-700)',
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid var(--blue-200)',
            }}>
              {doctor?.name} ({doctor?.doctor_code || doctor?.qr_code_id})
            </span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--slate-500)', marginTop: 2 }}>
            Patients currently waiting to consult you. Real-time authoritative order.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleManualRefresh}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.84rem' }}
            disabled={refreshing}
            title="Refresh active queue"
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Queue Table Card */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: '#fbfcfd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--navy-900)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              Waiting Patients ({queue.length})
            </h3>
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--slate-500)' }}>
            Order reflects arrival time at clinic
          </span>
        </div>

        {queue.length > 0 ? (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--slate-500)',
                  fontSize: '0.76rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  <th style={{ padding: '12px 20px' }}>Token #</th>
                  <th style={{ padding: '12px 20px' }}>Patient</th>
                  <th style={{ padding: '12px 20px' }}>Visit Type</th>
                  <th style={{ padding: '12px 20px' }}>Intake Summary</th>
                  <th style={{ padding: '12px 20px' }}>Status</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item, idx) => {
                  const isFirst = idx === 0;
                  const isCalling = item.lifecycle_state === 'PLEASE_COME_IN' || item.status === 'IN_CONSULTATION';
                  const isReviewing = item.lifecycle_state === 'DOCTOR_REVIEWING';

                  return (
                    <tr
                      key={item.encounter_id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isCalling ? '#f0fdf4' : (isReviewing ? '#eff6ff' : '#ffffff'),
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Token # */}
                      <td style={{ padding: '16px 20px', fontWeight: 800, fontSize: '1.1rem', color: 'var(--navy-900)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{item.token_number || `#${idx + 1}`}</span>
                          {isFirst && (
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              backgroundColor: 'var(--navy-900)',
                              color: '#ffffff',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}>
                              NEXT
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Patient Details */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--navy-900)' }}>
                          {item.patient_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                          {item.patient_identifier} • {item.age ? `${item.age}y` : ''} {item.gender || ''}
                        </div>
                      </td>

                      {/* Visit Type */}
                      <td style={{ padding: '16px 20px' }}>
                        <StatusBadge type={item.visit_type} />
                      </td>

                      {/* Intake Summary */}
                      <td style={{ padding: '16px 20px', maxWidth: 440 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                          {item.chief_complaint}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          {item.duration && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--slate-500)' }}>
                              Duration: <strong>{item.duration}</strong>
                            </span>
                          )}
                          {item.symptoms && item.symptoms.length > 0 && (
                            <span style={{
                              fontSize: '0.72rem',
                              color: 'var(--teal-800)',
                              backgroundColor: 'var(--teal-50)',
                              padding: '2px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--teal-200)',
                              fontWeight: 600,
                            }}>
                              {item.symptoms.slice(0, 3).join(', ')}{item.symptoms.length > 3 ? ` +${item.symptoms.length - 3}` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        <StatusBadge type={item.lifecycle_state || item.status} />
                      </td>

                      {/* Action Button: Review Symptoms */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleSelectPatient(item.encounter_id)}
                          className={isCalling ? 'btn-teal' : 'btn-primary'}
                          style={{
                            padding: '8px 18px',
                            fontSize: '0.86rem',
                          }}
                        >
                          <Eye size={15} />
                          <span>{isCalling ? 'Active Consultation' : 'Review Symptoms'}</span>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'var(--slate-100)',
              color: 'var(--slate-400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
            }}>
              <Users size={28} />
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: 6 }}>
              No Patients Currently in Queue
            </h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--slate-500)', maxWidth: 420, margin: '0 auto 18px auto' }}>
              Your queue is clear. When patients scan your doctor QR standee ({doctor?.doctor_code || 'DOC-DEMO01'}) and complete the consent and check-in flow, they will appear here automatically.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
