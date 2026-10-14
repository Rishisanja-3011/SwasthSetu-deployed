import React from 'react';
import { UserCheck, ShieldCheck, AlertCircle, ArrowRight, X } from 'lucide-react';

export default function PatientVerificationModal({
  isOpen,
  onClose,
  identityData,
  onProceedToExtraction,
}) {
  if (!isOpen || !identityData) return null;

  const { identity, order } = identityData;

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
        }}
      >
        {/* Fixed Header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--lavender-soft)', padding: '0.6rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--neo-raised-sm)', border: '1px solid var(--border-subtle)' }}>
              <UserCheck size={22} color="var(--hospital-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--main-text)' }}>Patient Visit Verification</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Identity-Field Check & Diagnostic Order Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.35rem' }}>
          {/* Bounded Access Guard Notice */}
          <div className="info-banner teal" style={{ marginBottom: '1.25rem' }}>
            <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Rule B Enforced:</strong> Exactly four identity fields (Name, Age/DOB, Gender, Phone) 
              are exposed by patient approval. Consultation notes and doctor's private records are strictly inaccessible.
            </div>
          </div>

          {/* 4 Identity Fields Exposed */}
          <div className="identity-cards-grid">
            <div className="identity-field-card">
              <div className="label">Full Name</div>
              <div className="val">{identity?.name}</div>
            </div>
            <div className="identity-field-card">
              <div className="label">Age / Date of Birth</div>
              <div className="val">{identity?.date_of_birth || (identity?.age ? `${identity.age} yrs` : 'Unavailable')}</div>
            </div>
            <div className="identity-field-card">
              <div className="label">Gender</div>
              <div className="val">{identity?.gender}</div>
            </div>
            <div className="identity-field-card">
              <div className="label">Phone Number</div>
              <div className="val" style={{ fontFamily: 'var(--font-mono)' }}>{identity?.phone}</div>
            </div>
          </div>

          {/* Diagnostic Order Details */}
          {order && (
            <div style={{ marginTop: '1.25rem', background: 'var(--surface-raised)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--neo-raised-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted-text)', fontWeight: 700 }}>
                  Doctor's Diagnostic Order
                </span>
                <span className="badge-pill low">{order.test_type}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--main-text)' }}>{order.clinical_notes || 'Complete Blood Count (CBC) evaluation'}</p>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
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
          <button className="btn-clinical outline" onClick={onClose}>
            Back
          </button>
          <button
            className="btn-clinical primary"
            onClick={onProceedToExtraction}
          >
            <span>Confirm Identity & Run CBC</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
