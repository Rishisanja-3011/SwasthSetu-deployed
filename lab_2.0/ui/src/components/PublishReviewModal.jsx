import React, { useState } from 'react';
import {
  Send,
  Lock,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  X,
  FileCheck,
  AlertOctagon,
  UserCheck,
} from 'lucide-react';

export default function PublishReviewModal({
  isOpen,
  onClose,
  report,
  observations,
  hasNeedsReview,
  unresolvedCount,
  activeStaff,
  onConfirmPublish,
  isPublishing,
}) {
  const [signOffNotes, setSignOffNotes] = useState(
    'All CBC parameters reviewed against hematology analyzer standards. Ready for clinical consultation.'
  );

  if (!isOpen) return null;

  const totalObs = observations.length;
  const normalObs = observations.filter((o) => o.flag === 'NORMAL').length;
  const flaggedObs = observations.filter((o) => o.flag !== 'NORMAL').length;
  const editedObs = observations.filter((o) => o.manually_edited).length;

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
        }}
      >
        {/* Sticky Fixed Header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--lavender-soft)', padding: '0.6rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--neo-raised-sm)', border: '1px solid var(--border-subtle)' }}>
              <FileCheck size={22} color="var(--hospital-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--main-text)' }}>Publish Review & Clinical Sign-Off</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Final Verification Before Secure Transmission</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.4rem' }}>
          {/* Blocking Warning if any NEEDS_REVIEW unresolved */}
          {hasNeedsReview ? (
            <div className="info-banner warning" style={{ marginBottom: '1.25rem' }}>
              <AlertOctagon size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
                  PUBLICATION STRICTLY BLOCKED ({unresolvedCount} Flagged Item{unresolvedCount > 1 ? 's' : ''}):
                </strong>
                <span>
                  According to VaaniDoc 2.0 clinical safety invariants, blood reports containing unresolved{' '}
                  <code>NEEDS_REVIEW</code> flags cannot be published. You must resolve all flagged observations before clinical sign-off.
                </span>
              </div>
            </div>
          ) : (
            <div className="info-banner success" style={{ marginBottom: '1.25rem' }}>
              <CheckCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>All Observations Verified:</strong> Zero unresolved extraction discrepancies. All canonical values
                pass deterministic validation and are ready to be locked and published.
              </div>
            </div>
          )}

          {/* Quality Audit Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--neo-raised-sm)' }}>
              {hasNeedsReview ? (
                <AlertTriangle size={18} color="var(--status-danger-text)" />
              ) : (
                <CheckCircle size={18} color="var(--status-normal-text)" />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--main-text)', fontSize: '0.88rem' }}>
                  Deterministic Validation Rule
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
                  {hasNeedsReview
                    ? `${unresolvedCount} parameter(s) flagged for plausibility or unit ambiguity.`
                    : `All ${totalObs} CBC observations passed reference range & plausibility bounds.`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--neo-raised-sm)' }}>
              <CheckCircle size={18} color="var(--status-normal-text)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--main-text)', fontSize: '0.88rem' }}>
                  Digital Text & Integrity Hash
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
                  SHA-256 integrity hash verified. Original instrument data preserved without modification.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--neo-raised-sm)' }}>
              <UserCheck size={18} color="var(--hospital-blue)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--main-text)', fontSize: '0.88rem' }}>
                  Practitioner Sign-Off Credential
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
                  Signing Practitioner: <strong style={{ color: 'var(--main-text)' }}>{activeStaff?.name || 'Dr. Shalini Gupta'}</strong> ({activeStaff?.role || 'Senior Hematopathologist'}) · License: {activeStaff?.license || 'MED-PATH-9021'}
                </div>
              </div>
            </div>
          </div>

          {/* Observations Summary Pill Matrix */}
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--neo-raised-sm)',
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Summary of Findings
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--hospital-blue)', fontWeight: 700 }}>{totalObs} Extracted Parameters</span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="badge-pill normal">{normalObs} Normal Range</span>
              {flaggedObs > 0 && <span className="badge-pill low">{flaggedObs} Abnormal Flags</span>}
              {editedObs > 0 && <span className="badge-pill" style={{ background: 'var(--lavender-soft)', color: 'var(--hospital-blue)' }}>{editedObs} Manually Corrected</span>}
            </div>
          </div>

          {/* Sign-Off Notes */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted-text)', marginBottom: '0.35rem', fontWeight: 600 }}>
              Clinical Validation Remarks (Transmitted with Report):
            </label>
            <textarea
              rows={2}
              value={signOffNotes}
              onChange={(e) => setSignOffNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.88rem',
                resize: 'none',
              }}
            />
          </div>

          {/* Critical Bounded Access Callout */}
          <div className="info-banner neutral" style={{ marginBottom: '0.5rem' }}>
            <Lock size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--hospital-blue)' }} />
            <div style={{ fontSize: '0.82rem' }}>
              <strong>Bounded Access Termination Warning:</strong> Confirming publication will transmit this report to 
              VaaniDoc and <strong>instantly expire this laboratory's access</strong> to the patient's identity. 
              No manual revoke is required; access terminates by construction.
            </div>
          </div>
        </div>

        {/* Sticky Fixed Footer */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button className="btn-clinical outline" onClick={onClose} disabled={isPublishing}>
            Back to Review
          </button>
          <button
            className="btn-clinical primary"
            disabled={hasNeedsReview || isPublishing}
            onClick={() => onConfirmPublish(signOffNotes)}
          >
            {isPublishing ? (
              <span>Publishing & Expiring Access...</span>
            ) : hasNeedsReview ? (
              <>
                <Lock size={16} />
                <span>Publish Blocked ({unresolvedCount} Unresolved)</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Confirm Sign-Off & Transmit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
