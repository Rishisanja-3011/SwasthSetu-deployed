import React, { useState } from 'react';
import { QrCode, UserPlus, RefreshCw, X, ShieldCheck, Printer, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function LabQRModal({
  isOpen,
  onClose,
  lab,
  onSimulatePatient,
  isSimulating,
}) {
  const [selectedPreset, setSelectedPreset] = useState('ananya');

  if (!isOpen) return null;

  const presets = [
    {
      id: 'ananya',
      name: 'Ananya Iyer',
      age: 28,
      gender: 'Female',
      phone: '+91 97654 32109',
      notes: 'Routine pre-operative CBC evaluation before minor ENT surgery. Baseline check for Hb & platelets.',
    },
    {
      id: 'vikram',
      name: 'Vikram Sen',
      age: 49,
      gender: 'Male',
      phone: '+91 98450 11992',
      notes: 'Follow-up for persistent lethargy and paleness. Check for nutritional deficiency anemia.',
    },
  ];

  const handleSimulate = () => {
    const chosen = presets.find((p) => p.id === selectedPreset);
    if (chosen) {
      onSimulatePatient(chosen);
    }
  };

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
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--lavender-soft)', padding: '0.6rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--neo-raised-sm)', border: '1px solid var(--border-subtle)' }}>
              <QrCode size={22} color="var(--hospital-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--main-text)' }}>Laboratory QR Code & Walk-in Station</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Patient Intake & Bounded Identity Sharing Discovery</p>
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
          {/* QR Poster Simulation Card */}
          <div
            style={{
              padding: '1.25rem',
              textAlign: 'center',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--neo-raised-md)',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--hospital-blue)', fontWeight: 800 }}>
              VaaniDoc 2.0 Registered Laboratory
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--main-text)', margin: '0.35rem 0' }}>
              {lab?.name || 'Laboratory'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)', maxWidth: '400px', margin: '0 auto 1rem auto' }}>
              Patients: Scan this QR code with your camera or VaaniDoc app to grant 4-field identity access.
            </p>

            <div
              style={{
                display: 'inline-block',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                background: '#FFFFFF',
                boxShadow: 'var(--neo-raised-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <QRCodeSVG value={lab?.qr_code_id || 'LABORATORY_ID_UNAVAILABLE'} size={140} bgColor="#FFFFFF" fgColor="#1A2D35" level="M" includeMargin />

              <div style={{ marginTop: '0.75rem' }}>
                <span className="lab-code-pill" style={{ fontSize: '0.82rem', padding: '0.25rem 0.65rem' }}>
                  {lab?.qr_code_id || 'ID unavailable'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted-text)', marginTop: '0.45rem' }}>
                Patient scan code: <strong style={{ color: 'var(--main-text)' }}>{lab?.qr_code_id || 'ID unavailable'}</strong>
              </div>
            </div>
          </div>

          {/* Live Simulator for Walk-In Patient */}
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--main-text)', marginBottom: '0.35rem' }}>
              Simulate Walk-in Patient Scan
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-text)', marginBottom: '0.85rem' }}>
              Select a test patient to simulate the patient scanning this QR code and consenting to identity sharing:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.5rem' }}>
              {presets.map((p) => {
                const isSelected = selectedPreset === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPreset(p.id)}
                    style={{
                      background: isSelected ? 'var(--lavender-soft)' : 'var(--surface-raised)',
                      border: isSelected ? '1.5px solid var(--hospital-blue)' : '1px solid var(--border-subtle)',
                      boxShadow: isSelected ? '0 0 0 2px rgba(34, 146, 160, 0.2), var(--neo-raised-sm)' : 'var(--neo-raised-sm)',
                      padding: '0.95rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.16s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--main-text)', display: 'block' }}>{p.name}</strong>
                      {isSelected && <Check size={14} color="var(--hospital-blue)" />}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--hospital-blue)', fontWeight: 600, marginTop: '2px' }}>
                      {p.gender}, {p.age} yrs
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted-text)', marginTop: '0.35rem', lineHeight: 1.3 }}>
                      {p.notes.slice(0, 50)}...
                    </div>
                  </div>
                );
              })}
            </div>
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
            Close
          </button>
          <button
            className="btn-clinical primary"
            disabled={isSimulating}
            onClick={handleSimulate}
          >
            {isSimulating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Granting Access...</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>Simulate Scan & Grant Access</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
