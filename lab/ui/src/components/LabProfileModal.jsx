import React from 'react';
import { Building2, X, ShieldCheck, Award, MapPin, Phone, Hash, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function LabProfileModal({ isOpen, onClose, lab }) {
  if (!isOpen) return null;
  const patientOrigin = import.meta.env.VITE_PATIENT_APP_URL || 'http://localhost:5176';
  const scanUrl = `${patientOrigin.replace(/\/$/, '')}/scan/laboratory/${encodeURIComponent(lab?.qr_code_id || '')}`;
  const downloadQr = () => {
    const svg = document.getElementById('lab-profile-qr-svg');
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1000;
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 1000, 1000); context.drawImage(image, 0, 0, 1000, 1000);
      const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = `laboratory-qr-${lab?.qr_code_id || 'code'}.png`; link.click(); URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: '480px' }}>
        <div className="modal-dialog-header">
          <div className="card-title-group">
            <Building2 size={20} color="var(--hospital-blue)" />
            <h3 className="card-title">Laboratory Profile</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted-text)',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Facility Name & Status */}
          <div style={{ padding: '0.85rem 1.15rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--neo-raised-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--main-text)' }}>
                {lab?.name || 'Laboratory'}
              </span>
               <span className="badge-pill normal">Active account</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '0.2rem' }}>
              Clinical Pathology & Hematology Diagnostic Center
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.15rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', boxShadow: 'var(--neo-raised-sm)' }}>
            <QRCodeSVG id="lab-profile-qr-svg" value={scanUrl} size={112} bgColor="#ffffff" fgColor="#1A2D35" level="H" includeMargin />
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--hospital-blue)', fontWeight: 700 }}>Patient scan QR</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '0.3rem', lineHeight: 1.4 }}>Patients can scan this code to identify your facility and approve a bounded lab access grant.</p>
              <div style={{ marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--hospital-blue)' }}>{lab?.qr_code_id || 'ID unavailable'}</div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.68rem', color: 'var(--muted-text)', wordBreak: 'break-all' }}>{scanUrl}</div>
            </div>
          </div>
          <button type="button" className="btn-clinical outline" onClick={downloadQr} style={{ width: '100%', justifyContent: 'center' }}><Download size={15} /> Download laboratory QR (PNG)</button>

          {/* Details Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Hash size={16} color="var(--hospital-blue)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted-text)', fontWeight: 600 }}>
                  Registered Lab QR ID
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--main-text)' }}>
                  {lab?.qr_code_id || 'ID unavailable'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Award size={16} color="var(--hospital-blue)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted-text)', fontWeight: 600 }}>
                  Accreditation & License
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--main-text)' }}>
                   Facility credentials supplied by the laboratory
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
                   No accreditation details have been added
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <MapPin size={16} color="var(--hospital-blue)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted-text)', fontWeight: 600 }}>
                  Facility Address
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
                   {lab?.address || lab?.location || 'Location not provided'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Phone size={16} color="var(--hospital-blue)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted-text)', fontWeight: 600 }}>
                  Direct Laboratory Phone
                </div>
                <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--main-text)' }}>
                   {lab?.phone || lab?.contact_phone || 'Phone not provided'}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem 0.95rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--lavender-soft)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.76rem',
              color: 'var(--deep-indigo)',
              marginTop: '0.5rem',
              boxShadow: 'var(--neo-raised-sm)',
            }}
          >
            <ShieldCheck size={16} color="var(--hospital-blue)" />
             <span>Onboarded to VaaniDoc Secure Clinical Network</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button className="btn-clinical outline" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
