import React, { useState } from 'react';
import { UserCheck, Shield, Check, X, Award, Stethoscope, Building2 } from 'lucide-react';

export default function LabStaffModal({
  isOpen,
  onClose,
  staffList,
  activeStaff,
  onSelectStaff,
  activeLab,
}) {
  const [selectedId, setSelectedId] = useState(activeStaff?.id || 'staff-01');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const chosen = staffList.find((s) => s.id === selectedId);
    if (chosen) {
      onSelectStaff(chosen);
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{
          maxWidth: '580px',
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
            justifyContent: 'space-between',
            alignItems: 'center',
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--main-text)' }}>Laboratory Authentication & Staff Switcher</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Lab Duty Roster — Role-Based Sign-Off Authority</p>
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
          {/* Current Laboratory Info */}
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--neo-raised-sm)',
              padding: '0.95rem 1.15rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Building2 size={18} color="var(--hospital-blue)" />
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--main-text)' }}>
                  {activeLab?.name || 'Laboratory'}
                </strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>
                  QR ID: {activeLab?.qr_code_id || 'ID unavailable'} · Status: {activeLab?.platform_approval_status || 'ACTIVE'}
                </div>
              </div>
            </div>
            <span className="badge-pill normal">Accredited LIS</span>
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--muted-text)', marginBottom: '1rem', lineHeight: 1.4 }}>
            Select the active on-duty laboratory practitioner. All deterministic CBC reviews, edits, and final sign-offs will be attributed to this credential in the audit trail:
          </p>

          {/* Staff List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
            {staffList.map((staff) => {
              const isSelected = selectedId === staff.id;

              return (
                <div
                  key={staff.id}
                  onClick={() => setSelectedId(staff.id)}
                  style={{
                    background: isSelected ? 'var(--lavender-soft)' : 'var(--surface-raised)',
                    border: isSelected ? '1.5px solid var(--hospital-blue)' : '1px solid var(--border-subtle)',
                    boxShadow: isSelected ? '0 0 0 2px rgba(34, 146, 160, 0.2), var(--neo-raised-sm)' : 'var(--neo-raised-sm)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: isSelected
                          ? 'linear-gradient(135deg, #32B3C2 0%, #2292A0 100%)'
                          : 'var(--surface-inset)',
                        boxShadow: isSelected ? '0 3px 8px rgba(34, 146, 160, 0.35)' : 'var(--neo-inset-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        color: isSelected ? '#ffffff' : 'var(--hospital-blue)',
                      }}
                    >
                      {staff.avatar}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--main-text)' }}>{staff.name}</strong>
                        {staff.canSignOff ? (
                          <span className="badge-pill normal" style={{ fontSize: '0.62rem' }}>
                            Sign-Off Authority
                          </span>
                        ) : (
                          <span className="badge-pill low" style={{ fontSize: '0.62rem' }}>
                            QA Reviewer
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--hospital-blue)', fontWeight: 600, marginTop: '0.15rem' }}>
                        {staff.role} · {staff.qualification}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted-text)', fontFamily: 'var(--font-mono)' }}>
                        License: {staff.license}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isSelected ? (
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #32B3C2 0%, #2292A0 100%)',
                          boxShadow: '0 2px 6px rgba(34, 146, 160, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={14} color="#fff" />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: '2px solid var(--border-medium)',
                          background: 'var(--surface-inset)',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
            Cancel
          </button>
          <button className="btn-clinical primary" onClick={handleConfirm}>
            <Shield size={16} />
            <span>Confirm & Switch Active Practitioner</span>
          </button>
        </div>
      </div>
    </div>
  );
}
