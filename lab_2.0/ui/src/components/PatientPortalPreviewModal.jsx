import React, { useState, useEffect } from 'react';
import {
  Heart,
  Bot,
  FileText,
  User,
  Stethoscope,
  X,
  MessageSquare,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

export default function PatientPortalPreviewModal({
  isOpen,
  onClose,
  reportId,
  onViewPreservedRaw,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeChatIndex, setActiveChatIndex] = useState(0);

  useEffect(() => {
    if (isOpen && reportId) {
      setLoading(true);
      fetch(`/api/lab/patient-view/${reportId}`)
        .then((res) => res.json())
        .then((resData) => {
          if (resData.success) {
            setData(resData);
          }
        })
        .catch((err) => console.error('Failed to load patient view:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.75rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--lavender-soft)', padding: '0.6rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--neo-raised-sm)', border: '1px solid var(--border-subtle)' }}>
              <Heart size={22} color="var(--hospital-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--main-text)' }}>VaaniDoc Patient Portal View</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
                End-to-End Verification: How patient views the published CBC findings
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-text)' }}>
              <div className="skeleton-text" style={{ width: '60%', margin: '0 auto 1rem', height: 16 }} />
              <div className="skeleton-text" style={{ width: '80%', margin: '0 auto 1rem', height: 14 }} />
              <p>Connecting to VaaniDoc Patient Record...</p>
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--status-danger-text)' }}>
              Failed to load patient report view.
            </div>
          ) : (
            <div>
              {/* Patient Banner */}
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--neo-raised-md)',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--hospital-blue)', fontWeight: 800 }}>
                    Patient Health Record
                  </div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--main-text)' }}>
                    {data.patient?.name || 'Rahul Sharma'}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted-text)' }}>
                    {data.patient?.patient_identifier} · {data.patient?.gender}, {data.patient?.age} yrs
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="badge-pill normal" style={{ fontSize: '0.75rem' }}>
                    Report Published & Locked
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted-text)', marginTop: '0.35rem' }}>
                    {data.laboratory?.name || 'Laboratory'}
                  </div>
                </div>
              </div>

              {/* Educational Clinical Summary */}
              <div className="info-banner teal" style={{ marginBottom: '1.25rem' }}>
                <Sparkles size={20} style={{ flexShrink: 0, color: 'var(--hospital-blue)' }} />
                <div>
                  <strong>Educational Health Summary (Non-Diagnostic):</strong>
                  <p style={{ marginTop: '0.2rem', fontSize: '0.84rem' }}>{data.healthSummary}</p>
                </div>
              </div>

              {/* Key CBC Observations Grid */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--main-text)', marginBottom: '0.75rem' }}>
                  Complete Blood Count (CBC) Parameters
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                  {data.observations.map((obs) => {
                    const isLow = obs.flag === 'LOW';
                    const isHigh = obs.flag === 'HIGH';
                    const isNormal = obs.flag === 'NORMAL';

                    return (
                      <div
                        key={obs._id}
                        style={{
                          background: 'var(--surface-raised)',
                          border: isNormal ? '1px solid var(--border-subtle)' : isLow ? '1.5px solid var(--border-medium)' : '1.5px solid rgba(249, 115, 22, 0.4)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--neo-raised-sm)',
                          padding: '0.95rem 1.15rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted-text)', fontWeight: 600 }}>
                            {obs.test_name_normalized}
                          </span>
                          {isLow && <span className="badge-pill low" style={{ fontSize: '0.62rem' }}>LOW</span>}
                          {isHigh && <span className="badge-pill high" style={{ fontSize: '0.62rem' }}>HIGH</span>}
                          {isNormal && <span className="badge-pill normal" style={{ fontSize: '0.62rem' }}>NORMAL</span>}
                        </div>

                        <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--main-text)', margin: '0.35rem 0' }}>
                          {obs.value} <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>{obs.unit}</span>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--muted-text)', fontFamily: 'var(--font-mono)' }}>
                          Ref: {obs.reference_low} - {obs.reference_high} {obs.unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VaaniDoc Basic Health & Blood Report Chatbot Preview */}
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--neo-raised-md)',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{ background: 'var(--lavender-soft)', padding: '0.5rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--neo-raised-sm)' }}>
                    <Bot size={20} color="var(--hospital-blue)" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--main-text)' }}>
                      VaaniDoc Blood-Report Health Chatbot (Educational AI)
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>
                      Grounded in published lab report · Never prescribes or provides medical diagnosis
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {data.chatbotQuestions?.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveChatIndex(idx)}
                      className={`btn-clinical ${activeChatIndex === idx ? 'primary' : 'outline'}`}
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                    >
                      <HelpCircle size={13} />
                      <span>{item.question}</span>
                    </button>
                  ))}
                </div>

                {data.chatbotQuestions && data.chatbotQuestions[activeChatIndex] && (
                  <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-inset)', boxShadow: 'var(--neo-inset-sm)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--hospital-blue)', fontSize: '0.85rem', marginBottom: '0.45rem' }}>
                      <MessageSquare size={16} />
                      <span>{data.chatbotQuestions[activeChatIndex].question}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--main-text)', lineHeight: 1.5 }}>
                      {data.chatbotQuestions[activeChatIndex].answer}
                    </div>
                  </div>
                )}
              </div>

              {/* Doctor Revisit Readiness Callout */}
              <div
                style={{
                  background: 'var(--lavender-soft)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--neo-raised-sm)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                }}
              >
                <Stethoscope size={22} color="var(--deep-indigo)" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', color: 'var(--deep-indigo)' }}>
                  <strong>Doctor Revisiting Workflow:</strong> When patient visits the clinic next and selects{' '}
                  <code>REVISITING</code>, this published report will automatically be available in clinical cockpit
                  while the encounter remains OPEN. Once consultation ends, historical access closes automatically.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn-clinical outline" onClick={onViewPreservedRaw}>
            <FileText size={15} />
            <span>Inspect Preserved Instrument Output</span>
          </button>

          <button className="btn-clinical primary" onClick={onClose}>
            Back to Laboratory Module
          </button>
        </div>
      </div>
    </div>
  );
}
