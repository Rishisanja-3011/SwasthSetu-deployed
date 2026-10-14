import React, { useState } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  Edit3,
  Send,
  Lock,
  ShieldCheck,
  Info,
  X,
  Check,
  FileText,
  AlertOctagon,
  Copy,
  Hash,
  ArrowDown,
} from 'lucide-react';

export default function ExtractionReviewView({
  report,
  observations,
  onUpdateObservation,
  onOpenPublishReview,
  onViewPreservedRaw,
  isPublishing,
  hasNeedsReview,
  unresolvedCount,
  duplicateWarning,
  activeStaff,
}) {
  const [editingObs, setEditingObs] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editRefLow, setEditRefLow] = useState('');
  const [editRefHigh, setEditRefHigh] = useState('');
  const [editReason, setEditReason] = useState('Manual verification against hematology analyzer display');
  const [saveLoading, setSaveLoading] = useState(false);

  const startEdit = (obs) => {
    setEditingObs(obs);
    setEditValue(obs.value);
    setEditUnit(obs.unit);
    setEditRefLow(obs.reference_low ?? '');
    setEditRefHigh(obs.reference_high ?? '');
    setEditReason(
      obs.review_reason
        ? `Corrected: ${obs.review_reason}`
        : 'Confirmed by clinical pathologist review'
    );
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingObs) return;

    setSaveLoading(true);
    await onUpdateObservation(editingObs._id, {
      value: parseFloat(editValue),
      unit: editUnit,
      reference_low: editRefLow !== '' ? parseFloat(editRefLow) : null,
      reference_high: editRefHigh !== '' ? parseFloat(editRefHigh) : null,
      edit_reason: editReason,
      technician: activeStaff,
    });
    setSaveLoading(false);
    setEditingObs(null);
  };

  const scrollToFirstReview = () => {
    const el = document.querySelector('.needs-review-row');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <ClipboardCheck size={22} color="var(--teal-700)" />
          <span>Extraction Review & Clinical Sign-Off</span>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <button
            className="btn btn-outline"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
            onClick={onViewPreservedRaw}
            title="Inspect preserved raw digital report and SHA-256 hash"
          >
            <FileText size={14} />
            <span>Preserved Raw Data</span>
          </button>

          {hasNeedsReview ? (
            <span className="badge badge-review">
              <AlertTriangle size={13} /> {unresolvedCount} NEEDS REVIEW
            </span>
          ) : (
            <span className="badge badge-normal">
              <CheckCircle size={13} /> ALL OBSERVATIONS VERIFIED
            </span>
          )}
        </div>
      </div>

      {/* Duplicate Ingestion Warning Banner if flagged */}
      {duplicateWarning && (
        <div className="banner info" style={{ marginBottom: '1.25rem' }}>
          <Hash size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Duplicate Ingestion Detected:</strong> {duplicateWarning}
          </div>
        </div>
      )}

      {/* Warning Alert if NEEDS_REVIEW is active */}
      {hasNeedsReview && (
        <div className="banner warning">
          <AlertTriangle size={22} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <strong>PUBLICATION BLOCKED:</strong>
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', color: 'var(--status-high-text)', borderColor: 'var(--status-high-border)' }}
                onClick={scrollToFirstReview}
              >
                <ArrowDown size={12} />
                <span>Jump to Flagged Parameter</span>
              </button>
            </div>
            <span>
              One or more CBC observations have been flagged as <code>NEEDS_REVIEW</code> due to physiological
              implausibility, low extractor confidence, or ambiguous units. Per VaaniDoc 2.0 safety invariants, 
              you must review and manually resolve all flagged items before this report can be published.
            </span>
          </div>
        </div>
      )}

      {/* Observations Table */}
      <div className="table-container">
        <table className="obs-table">
          <thead>
            <tr>
              <th>Canonical Test</th>
              <th>Original Extracted Label</th>
              <th>Value & Unit</th>
              <th>Reference Range</th>
              <th>Status Flag</th>
              <th>Confidence</th>
              <th>Validation</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((obs) => {
              const isNeedsReview = obs.validation_status === 'NEEDS_REVIEW';

              // Visual badge for High / Low / Normal
              let flagBadge = <span className="badge badge-normal">NORMAL</span>;
              if (obs.flag === 'LOW') {
                flagBadge = <span className="badge badge-low">LOW</span>;
              } else if (obs.flag === 'HIGH') {
                flagBadge = <span className="badge badge-high">HIGH</span>;
              }

              return (
                <tr key={obs._id} className={isNeedsReview ? 'needs-review-row' : ''}>
                  <td>
                    <strong>{obs.test_name_normalized}</strong>
                    {obs.manually_edited && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: 'var(--teal-50)',
                          color: 'var(--teal-800)',
                          border: '1px solid var(--teal-100)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          marginLeft: '0.4rem',
                        }}
                      >
                        Edited
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{obs.test_name_original}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem' }}>
                    {obs.value} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{obs.unit}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                    {obs.reference_low !== null && obs.reference_high !== null
                      ? `${obs.reference_low} - ${obs.reference_high} ${obs.unit}`
                      : 'None (null)'}
                  </td>
                  <td>{flagBadge}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '6px',
                          background: 'var(--surface-inset)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round(obs.extraction_confidence * 100)}%`,
                            height: '100%',
                            background: obs.extraction_confidence >= 0.85 ? 'var(--status-normal-badge-text)' : 'var(--status-high-text)',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: obs.extraction_confidence >= 0.85 ? 'var(--text-muted)' : 'var(--status-high-text)',
                        }}
                      >
                        {Math.round(obs.extraction_confidence * 100)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    {isNeedsReview ? (
                      <div>
                        <span className="badge badge-review">NEEDS_REVIEW</span>
                        {obs.review_reason && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--status-review-text)',
                              marginTop: '0.25rem',
                              maxWidth: '220px',
                              lineHeight: 1.2,
                            }}
                          >
                            {obs.review_reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="badge badge-ok">
                        <Check size={12} /> OK
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                      onClick={() => startEdit(obs)}
                      title="Review or correct observation value"
                    >
                      <Edit3 size={13} />
                      <span>{isNeedsReview ? 'Fix & Verify' : 'Edit'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Publish Sign-off Trigger Bar */}
      <div
        style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <ShieldCheck size={20} color="var(--teal-700)" />
          <span>
            Active Reviewer: <strong>{activeStaff?.name || 'Dr. Shalini Gupta'}</strong> ({activeStaff?.role || 'Hematopathologist'}).
            Publishing will lock findings and <strong>expire laboratory access automatically</strong>.
          </span>
        </div>

        <button
          className="btn btn-success"
          disabled={hasNeedsReview || isPublishing}
          onClick={onOpenPublishReview}
          style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
          title={
            hasNeedsReview
              ? 'Cannot proceed to publish review while unresolved NEEDS_REVIEW observations exist'
              : 'Proceed to pre-publish review (Screen #6)'
          }
        >
          {isPublishing ? (
            <span>Publishing to VaaniDoc...</span>
          ) : hasNeedsReview ? (
            <>
              <Lock size={16} />
              <span>Publish Blocked (Resolve {unresolvedCount} Issues)</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>Proceed to Publish Review (Screen #6)</span>
            </>
          )}
        </button>
      </div>

      {/* Inline Modal for Observation Correction */}
      {editingObs && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Review & Correct Observation</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{editingObs.test_name_normalized}</p>
              </div>
              <button
                onClick={() => setEditingObs(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {editingObs.review_reason && (
              <div className="banner warning" style={{ padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{editingObs.review_reason}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Observed Numeric Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: 'var(--surface-inset)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: 'var(--surface-inset)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Reference Low (optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editRefLow}
                    onChange={(e) => setEditRefLow(e.target.value)}
                    placeholder="null"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: 'var(--surface-inset)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Reference High (optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editRefHigh}
                    onChange={(e) => setEditRefHigh(e.target.value)}
                    placeholder="null"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: 'var(--surface-inset)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Correction Reason (Logged to Immutable Audit Trail)
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Re-centrifuged sample, verified on analyzer"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'var(--surface-inset)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingObs(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saveLoading}>
                  {saveLoading ? 'Re-validating...' : 'Verify & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
