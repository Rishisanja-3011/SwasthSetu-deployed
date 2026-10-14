import React, { useState } from 'react';
import { FileText, Copy, Check, Download, ShieldCheck, X, Hash } from 'lucide-react';

export default function PreservedReportModal({ isOpen, onClose, report, patient }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !report) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(report.raw_text_content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([report.raw_text_content || ''], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${patient?.name || 'Patient'}_CBC_Instrument_Raw_${report._id.slice(-6)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{
          maxWidth: '680px',
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
              <FileText size={22} color="var(--hospital-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--main-text)' }}>Preserved Original Digital Report</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Unaltered Instrument Output & Cryptographic Integrity</p>
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
          {/* Architecture Notice */}
          <div className="info-banner teal" style={{ marginBottom: '1.25rem' }}>
            <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Preservation Rule:</strong> Original instrument report remains strictly unmodified. 
              The raw text stream below is the cryptographic source of truth ingested by the extraction engine.
            </div>
          </div>

          {/* Hash & Metadata Card */}
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--neo-raised-sm)',
              padding: '0.95rem 1.15rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted-text)', fontWeight: 700 }}>
                SHA-256 Digital Fingerprint
              </span>
              <span className="badge-pill normal" style={{ fontSize: '0.68rem' }}>
                Cryptographically Verified
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--hospital-blue)',
                wordBreak: 'break-all',
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-inset)',
                boxShadow: 'var(--neo-inset-sm)',
                padding: '0.55rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {report.report_hash || 'SHA-256 Unspecified'}
            </div>
          </div>

          {/* Raw Text Box */}
          <div
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              background: 'var(--surface-inset)',
              border: '1px solid var(--border-inset)',
              boxShadow: 'var(--neo-inset-sm)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--main-text)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {report.raw_text_content || 'No raw content recorded.'}
          </div>
        </div>

        {/* Fixed Footer */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1.25rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button className="btn-clinical outline" style={{ fontSize: '0.8rem' }} onClick={handleCopy}>
              {copied ? <Check size={14} color="var(--status-normal-text)" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Raw Text'}</span>
            </button>
            <button className="btn-clinical outline" style={{ fontSize: '0.8rem' }} onClick={handleDownload}>
              <Download size={14} />
              <span>Download File</span>
            </button>
          </div>

          <button className="btn-clinical primary" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
