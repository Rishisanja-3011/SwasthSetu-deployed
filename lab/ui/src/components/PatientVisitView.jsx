import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  ArrowLeft,
  FileText,
  UploadCloud,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { DemoReportSelector } from './DemoReportSelector';

export default function PatientVisitView({
  identityData,
  onUploadReport,
  isProcessing,
  onBackToDashboard,
  onOpenReport,
  existingReportId,
  grantKey,
}) {
  const [selectedFile, setSelectedFile] = useState(null);

  if (existingReportId) {
    return (
      <div className="clinical-card" style={{ textAlign: 'center', padding: '3rem 1.25rem' }}>
        <FileText size={30} color="var(--teal-700)" style={{ marginBottom: '0.75rem' }} />
        <h2 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.45rem' }}>
          Report already uploaded
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '34rem', margin: '0 auto' }}>
          This access grant has a preserved laboratory report. The original report is immutable and cannot be replaced with another upload under the same grant.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
          <button className="btn-clinical primary" onClick={onOpenReport}>
            <FileText size={15} />
            <span>Open Preserved Report</span>
          </button>
          <button className="btn-clinical outline" onClick={onBackToDashboard}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!identityData) {
    return (
      <div className="clinical-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>No active patient visit selected.</p>
        <button
          className="btn-clinical outline"
          style={{ marginTop: '1rem' }}
          onClick={onBackToDashboard}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { identity, order } = identityData;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile({
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
        rawFile: file,
      });
    }
  };

  const handleUploadSubmit = () => {
    onUploadReport({
      fileName: selectedFile?.name,
      rawFile: selectedFile?.rawFile,
    });
  };

  const selectDemoReport = (file) => setSelectedFile({ ...file });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <button
            className="btn-clinical outline"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', marginBottom: '0.5rem' }}
            onClick={onBackToDashboard}
          >
            <ArrowLeft size={13} />
            <span>Back to Dashboard</span>
          </button>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Patient Visit Verification
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Temporary identity access authorized by patient via Lab QR consent
          </p>
        </div>

        <div>
          <span className="access-pill active">
            <ShieldCheck size={14} />
            <span>● ACCESS ACTIVE</span>
          </span>
        </div>
      </div>

      {/* Informative Rule B Notice */}
      <div className="info-banner teal">
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Bounded Access Scope:</strong> The patient has explicitly authorized the sharing of exactly four identity fields (Name, Age/DOB, Gender, Phone) required to prepare this diagnostic report. Consultation notes and historical records remain sealed.
        </div>
      </div>

      {/* Patient Information Card */}
      <div className="clinical-card">
        <div className="clinical-card-header">
          <div className="card-title-group">
            <User size={18} color="var(--teal-700)" />
            <h3 className="card-title">Patient Information</h3>
          </div>
          <span className="badge-pill low">{order?.test_type || 'CBC'} Test Ordered</span>
        </div>

        {/* 4 Identity Fields */}
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
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Diagnostic Order
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Complete Blood Count (CBC)
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
             Ordering Physician: {order?.ordering_doctor || 'Registered Doctor'}
          </div>
        </div>
      </div>

      {/* Required Feature: Upload Blood Report Section */}
      <div className="clinical-card">
        <div className="clinical-card-header">
          <div className="card-title-group">
            <UploadCloud size={18} color="var(--teal-700)" />
            <h3 className="card-title">Upload CBC Report</h3>
          </div>
          <span className="badge-pill neutral">Lab-Side Operation</span>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Upload the blood report generated by the laboratory.
        </p>

        {isProcessing ? (
          <div
            style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div
              className="badge-pill normal"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem', marginBottom: '1rem' }}
            >
              <CheckCircle size={15} />
              <span>Report Uploaded Successfully</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Clock size={18} className="animate-spin" color="var(--teal-600)" />
              <span
                className="badge-pill low"
                style={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.05em' }}
              >
                PROCESSING
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              Executing text extraction, CBC parsing, normalization, deterministic validation, and confidence calculation...
            </p>
          </div>
        ) : (
           <div>
            <DemoReportSelector identity={identity} onSelect={selectDemoReport} />
             {/* File Chooser Box */}
            <div
              style={{
                border: '1.5px dashed var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-subtle)',
                marginBottom: '1.25rem',
              }}
            >
              <input
                key={grantKey || 'no-grant'}
                type="file"
                id="report-file-input"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="report-file-input"
                  className="btn-clinical outline"
                  style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <FileText size={16} />
                  <span>Choose Report File</span>
                </label>
              </div>

              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {selectedFile?.name || 'No PDF selected'}
              </div>

              <div style={{ display: 'inline-block', marginTop: '0.5rem' }}>
                <span className="badge-pill neutral" style={{ fontWeight: 800, fontSize: '0.72rem' }}>
                  PDF
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Original laboratory generated blood report ({selectedFile?.size || 'Select a PDF to continue'})
              </div>
            </div>

            {/* Upload Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-clinical primary"
                onClick={handleUploadSubmit}
                disabled={!selectedFile?.rawFile}
                style={{ padding: '0.65rem 1.5rem', fontSize: '0.88rem' }}
              >
                <UploadCloud size={16} />
                <span>Upload Report</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
