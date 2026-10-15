import React from 'react';
import { Printer, Download, Sparkles, MapPin, CheckCircle, Shield } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const PrintableQRStandee = ({ doctor }) => {
  const doctorName = doctor?.name || 'Dr. Ramesh Mehta';
  const doctorCode = doctor?.doctor_code || doctor?.qr_code_id || 'DOC-409';
  const clinicName = doctor?.clinic_name || 'Mehta Community Health Clinic';
  const specialty = doctor?.specialty || 'General Physician & Family Medicine';
  const patientOrigin = import.meta.env.VITE_PATIENT_APP_URL || 'http://localhost:5176';
  const scanUrl = `${patientOrigin.replace(/\/$/, '')}/scan/doctor/${encodeURIComponent(doctorCode)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Action Header (Hidden during print) */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-900)' }}>
            Clinic Reception / Desk Standee
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--slate-500)' }}>
            Place this standee at your consultation desk or clinic reception. Patients scan this to join your queue.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="btn-primary"
          style={{ whiteSpace: 'nowrap' }}
        >
          <Printer size={16} />
          <span>Print Standee</span>
        </button>
      </div>

      {/* The Printable Standee Card */}
      <div id="printable-standee" className="v-card" style={{
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 36,
        textAlign: 'center',
        border: '3px solid var(--navy-900)',
        boxShadow: '0 12px 30px rgba(10, 37, 64, 0.12)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top Decorative Border */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          background: 'linear-gradient(90deg, #00a884 0%, #1d4ed8 100%)',
        }} />

        {/* Clinic & Product Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'var(--teal-50)',
            color: 'var(--teal-800)',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: '0.78rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            <Sparkles size={13} />
             VaaniDoc Connected Clinic
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--navy-900)', margin: '4px 0' }}>
            {doctorName}
          </h1>
          <p style={{ fontSize: '0.94rem', color: 'var(--teal-700)', fontWeight: 600 }}>
            {specialty}
          </p>
          <p style={{ fontSize: '0.84rem', color: 'var(--slate-500)', marginTop: 2 }}>
            {clinicName} • Cabin 2
          </p>
        </div>

        {/* QR Code Frame */}
        <div style={{
          maxWidth: 240,
          margin: '0 auto 20px auto',
          padding: 16,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          border: '2px solid var(--slate-200)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}>
          <QRCodeSVG value={scanUrl} size={208} bgColor="#ffffff" fgColor="#0a2540" level="H" includeMargin />
        </div>
        <div style={{ marginBottom: 16, fontSize: '0.72rem', color: 'var(--slate-500)', wordBreak: 'break-all' }}>{scanUrl}</div>

        {/* Scan Callout */}
        <div style={{
          backgroundColor: '#eff6ff',
          borderRadius: 14,
          padding: '12px 16px',
          border: '1px solid #bfdbfe',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: '0.84rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Scan to consult {doctorName}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: 2 }}>
            Opens your queue check-in and voice/text symptom intake
          </div>
        </div>

        {/* Doctor Fallback Code */}
        <div style={{
          display: 'inline-block',
          backgroundColor: 'var(--slate-100)',
          border: '1px solid var(--slate-300)',
          borderRadius: 12,
          padding: '8px 24px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
            Doctor Fallback Code
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--navy-950)', letterSpacing: '0.08em' }}>
            {doctorCode}
          </div>
        </div>

        {/* Instructions Footer */}
        <div style={{
          borderTop: '1px solid var(--slate-200)',
          paddingTop: 14,
          fontSize: '0.78rem',
          color: 'var(--slate-500)',
          lineHeight: 1.4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 2 }}>
            <Shield size={14} color="var(--teal-600)" />
            <span>Doctor-Specific Queue • Bounded Access Protected</span>
          </div>
          Patients enter Dr. Mehta's queue exclusively. Consultation access expires automatically upon completion.
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-standee, #printable-standee * {
            visibility: visible;
          }
          #printable-standee {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 500px;
            box-shadow: none;
            border: 2px solid #000;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
