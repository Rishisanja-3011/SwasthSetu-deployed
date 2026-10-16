import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Download, Shield, Sparkles, Building, UserCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { patientScanConfigMessage, patientScanUrl } from '../utils/patientScanUrl';

export const DoctorProfileDropdown = ({ isOpen, onClose }) => {
  const { doctor } = useDoctorAuth();
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);

  const doctorName = doctor?.name || 'Dr. Ramesh Mehta';
  const doctorCode = doctor?.doctor_code || doctor?.qr_code_id || 'DOC-DEMO01';
  const specialty = doctor?.specialty || 'General Physician & Family Medicine';
  const clinicName = doctor?.clinic_name || 'Mehta Community Health Clinic';
  const initial = doctorName.replace('Dr. ', '').charAt(0) || 'D';
  const scanUrl = patientScanUrl('doctor', doctorCode);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(doctorCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!scanUrl) return;
    const svgEl = document.getElementById('doctor-profile-qr-svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // High resolution (800 x 800) for sharp print/scan clarity
    canvas.width = 800;
    canvas.height = 800;

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Solid white background for clear scanner contrast
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `doctor-qr-${doctorCode}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = url;
  };

  return (
    <>
      {/* Optional Mobile Backdrop */}
      <div
        className="profile-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 19, 41, 0.45)',
          zIndex: 998,
          display: 'none',
        }}
      />

      <div
        ref={dropdownRef}
        className="fade-in profile-dropdown-container"
        style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 380,
          maxWidth: '92vw',
          backgroundColor: '#ffffff',
          borderRadius: 18,
          border: '1px solid var(--border-medium)',
          boxShadow: '0 16px 36px rgba(10, 37, 64, 0.16)',
          zIndex: 999,
          padding: 22,
          color: 'var(--navy-900)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--navy-900)' }}>
              Doctor Profile
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: 'var(--teal-50)',
              color: 'var(--teal-800)',
              padding: '2px 8px',
              borderRadius: 12,
            }}>
              Active Identity
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--slate-400)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Doctor Information Card */}
        <div style={{
          textAlign: 'center',
          marginBottom: 18,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            backgroundColor: 'var(--navy-900)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.3rem',
            margin: '0 auto 10px auto',
            boxShadow: '0 4px 10px rgba(10, 37, 64, 0.2)',
          }}>
            {initial}
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: 2 }}>
            {doctorName}
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--teal-700)', fontWeight: 600 }}>
            {specialty}
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: 2 }}>
            {clinicName} • Cabin 2
          </p>
        </div>

        {/* Doctor Code Box with Copy */}
        <div style={{
          backgroundColor: 'var(--slate-50)',
          borderRadius: 12,
          padding: '10px 14px',
          border: '1px solid var(--slate-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              Doctor Code
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--navy-950)', letterSpacing: '0.06em' }}>
              {doctorCode}
            </div>
          </div>
          <button
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              backgroundColor: copied ? '#ecfdf5' : '#ffffff',
              color: copied ? '#059669' : 'var(--blue-700)',
              border: copied ? '1px solid #6ee7b7' : '1px solid var(--blue-200)',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? (
              <>
                <Check size={14} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

         {/* Doctor's unique, scannable patient-routing QR code */}
        <div style={{
          padding: 14,
          backgroundColor: '#ffffff',
          borderRadius: 14,
          border: '1px solid var(--slate-200)',
          textAlign: 'center',
          marginBottom: 16,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}>
          <div style={{
            maxWidth: 160,
            margin: '0 auto 10px auto',
          }}>
             {scanUrl ? (
               <QRCodeSVG id="doctor-profile-qr-svg" value={scanUrl} size={160} bgColor="#ffffff" fgColor="#0a2540" level="H" includeMargin />
             ) : (
               <div style={{ minHeight: 160, display: 'grid', placeItems: 'center', padding: 18, color: '#b45309', background: '#fffbeb', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700 }}>
                 {patientScanConfigMessage()}
               </div>
             )}
          </div>

          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Scan to consult {doctorName}
          </div>
           <div style={{ fontSize: '0.74rem', color: 'var(--slate-500)', marginTop: 2 }}>
             Patients scan this QR to join your consultation queue
           </div>
           <div style={{ fontSize: '0.67rem', color: scanUrl ? 'var(--slate-400)' : '#b45309', marginTop: 5, wordBreak: 'break-word' }}>
             {scanUrl || patientScanConfigMessage()}
           </div>
        </div>

        {/* Download Clinic QR Action Button */}
        <button
          onClick={handleDownloadQR}
          className="btn-secondary"
          style={{
            width: '100%',
            padding: '9px 0',
            fontSize: '0.84rem',
            marginBottom: 10,
            cursor: 'pointer',
          }}
           title={scanUrl ? `Download doctor QR code as doctor-qr-${doctorCode}.png` : patientScanConfigMessage()}
           disabled={!scanUrl}
        >
          <Download size={15} color="var(--navy-900)" />
          <span>Download Clinic QR</span>
        </button>

        {/* Privacy Note */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: '0.72rem',
          color: 'var(--slate-500)',
          textAlign: 'center',
          paddingTop: 8,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <Shield size={12} color="var(--teal-600)" />
          <span>Doctor identity linked exclusively to your queue</span>
        </div>
      </div>
    </>
  );
};
