import React, { useState } from 'react';
import { Cpu, ArrowRight, CheckCircle, RefreshCw, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ReportProcessingView({
  patient,
  onGenerateReport,
  isProcessing,
  lastReport,
  onProceedToReview,
}) {
  const [selectedCase, setSelectedCase] = useState('standard');

  return (
    <div className="clinical-card">
      <div className="clinical-card-header">
        <div className="card-title-group">
          <Cpu size={22} color="var(--hospital-blue)" />
          <h3 className="card-title">Report Generation & CBC Digital Extraction Engine</h3>
        </div>
        <span className="badge-pill low">Digital Pipeline</span>
      </div>

      {/* Critical Architecture Callout */}
      <div className="info-banner teal" style={{ marginBottom: '1.5rem' }}>
        <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Architecture Principle:</strong> VaaniDoc is NOT a generic PDF-upload application. 
          The laboratory environment generates the digital blood report and runs the digital text extraction & 
          deterministic validation pipeline right here at the lab side.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
        {/* Left Column: Instrument Run Setup */}
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--main-text)' }}>
            1. Lab Hematology Analyzer Simulation
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', marginBottom: '1.25rem' }}>
            Select test parameters to execute on the digital analyzer for <strong style={{ color: 'var(--main-text)' }}>{patient?.name || 'Rahul Sharma'}</strong>:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '1.1rem',
                borderRadius: 'var(--radius-md)',
                background: selectedCase === 'standard' ? 'var(--lavender-soft)' : 'var(--surface-raised)',
                border: selectedCase === 'standard' ? '1.5px solid var(--hospital-blue)' : '1px solid var(--border-subtle)',
                boxShadow: selectedCase === 'standard' ? '0 0 0 2px rgba(34, 146, 160, 0.2), var(--neo-raised-sm)' : 'var(--neo-raised-sm)',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <input
                type="radio"
                name="scenario"
                checked={selectedCase === 'standard'}
                onChange={() => setSelectedCase('standard')}
                style={{ marginTop: '3px', accentColor: 'var(--hospital-blue)' }}
              />
              <div>
                <strong style={{ fontSize: '0.92rem', color: 'var(--main-text)' }}>Standard Case (Rahul's Visit)</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                  Complete automated CBC run: Hb 10.2 g/dL (LOW), WBC 8000 /µL (NORMAL), Platelets 250,000 /µL (NORMAL).
                  All values pass deterministic validation with High Confidence.
                </p>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '1.1rem',
                borderRadius: 'var(--radius-md)',
                background: selectedCase === 'needs_review_demo' ? 'var(--status-danger-bg)' : 'var(--surface-raised)',
                border: selectedCase === 'needs_review_demo' ? '1.5px solid var(--status-danger-text)' : '1px solid var(--border-subtle)',
                boxShadow: selectedCase === 'needs_review_demo' ? '0 0 0 2px rgba(220, 38, 38, 0.2), var(--neo-raised-sm)' : 'var(--neo-raised-sm)',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <input
                type="radio"
                name="scenario"
                checked={selectedCase === 'needs_review_demo'}
                onChange={() => setSelectedCase('needs_review_demo')}
                style={{ marginTop: '3px', accentColor: 'var(--status-danger-text)' }}
              />
              <div>
                <strong style={{ fontSize: '0.92rem', color: 'var(--status-danger-text)' }}>
                  Demo Script Step 34: Deliberate Low-Confidence / Implausible Value
                </strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                  Platelets extracted as 15 /µL with low confidence (62%). Triggers <code>NEEDS_REVIEW</code> and 
                  proves that publication is deterministically blocked until pathologist review.
                </p>
              </div>
            </label>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button
              className="btn-clinical primary"
              disabled={isProcessing}
              onClick={() => onGenerateReport(selectedCase)}
              style={{ width: '100%', padding: '0.85rem' }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Processing CBC Extraction Pipeline...</span>
                </>
              ) : (
                <>
                  <Cpu size={18} />
                  <span>Execute CBC Extraction & Validation Pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Digital Pipeline Visualization */}
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--main-text)' }}>
            2. Digital Extraction Pipeline Output
          </h4>

          {lastReport ? (
            <div>
              <div
                style={{
                  background: 'var(--surface-raised)',
                  padding: '1.15rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--neo-raised-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted-text)', fontWeight: 600 }}>Status:</span>
                  {lastReport.status === 'NEEDS_REVIEW' ? (
                    <span className="badge-pill review">NEEDS_REVIEW</span>
                  ) : (
                    <span className="badge-pill normal">READY FOR REVIEW</span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted-text)', fontWeight: 600 }}>Digital Source:</span>
                  <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--hospital-blue)', fontWeight: 700 }}>
                    {lastReport.report_source_type}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted-text)', fontWeight: 600 }}>Integrity Hash:</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--muted-text)' }}>
                    {lastReport.report_hash ? lastReport.report_hash.slice(0, 24) + '...' : 'Generated'}
                  </span>
                </div>
              </div>

              {/* Raw Digital Instrument Log */}
              <div
                style={{
                  marginTop: '1rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border-inset)',
                  boxShadow: 'var(--neo-inset-sm)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--main-text)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {lastReport.raw_text_content || 'No text extracted.'}
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-clinical primary" onClick={onProceedToReview}>
                  <span>Proceed to Extraction Review</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface-raised)',
                border: '1.5px dashed var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--neo-raised-sm)',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: 'var(--muted-text)',
              }}
            >
              <FileText size={36} color="var(--hospital-blue)" style={{ marginBottom: '1rem', opacity: 0.6 }} />
              <p style={{ fontWeight: 600, color: 'var(--main-text)' }}>No report generated yet.</p>
              <p style={{ fontSize: '0.82rem', marginTop: '0.5rem', maxWidth: '300px', margin: '0.5rem auto 0 auto' }}>
                Click "Execute CBC Extraction & Validation Pipeline" on the left to initiate the automated instrument run.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
