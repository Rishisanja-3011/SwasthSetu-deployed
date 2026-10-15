import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, QrCode, AlertCircle, ArrowRight, Stethoscope, Building2 } from 'lucide-react';
import { patientApi } from '../services/patientApi';
import { Html5Qrcode } from 'html5-qrcode';

export function QRScannerModal({ isOpen, onClose, onCodeResolved }) {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraState, setCameraState] = useState('starting');
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const scanner = new Html5Qrcode('patient-qr-reader');
    scannerRef.current = scanner;
    const safeStop = async () => {
      try { await scanner.stop(); } catch { /* already stopped or never started */ }
      try { scanner.clear(); } catch { /* container already unmounted */ }
    };
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.4 },
      async (decodedText) => {
        setCameraState('found');
        await safeStop();
        await handleResolve(decodedText);
      },
      () => {},
    ).then(() => setCameraState('scanning')).catch((cameraError) => {
      setCameraState('denied');
      setError(cameraError?.message || 'Camera could not be started. Allow camera access or use image upload/manual code.');
    });
    return () => { safeStop(); scannerRef.current = null; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResolve = async (codeToTest) => {
    setError(null);
    setLoading(true);
    try {
      const resolved = await patientApi.resolveCode(codeToTest);
      onCodeResolved(resolved);
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to recognize this QR code. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageScan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const imageScanner = new Html5Qrcode('patient-qr-image-reader');
      const decoded = await imageScanner.scanFile(file, true);
      await imageScanner.clear();
      await handleResolve(decoded);
    } catch {
      setError('Could not read that QR image. Try a sharper photo or enter the code manually.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSubmitManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleResolve(manualCode.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-900)' }}>Scan QR Code</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--slate-500)' }}>
              Point camera at Doctor Clinic or Laboratory QR
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Viewfinder simulation */}
           <div style={{
          position: 'relative',
          height: 220,
          backgroundColor: '#051329',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          border: '2px solid #1e293b',
           }}>
           <div id="patient-qr-reader" aria-label="Camera QR preview" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          {/* Animated Laser Sweep Line */}
          <div style={{
            position: 'absolute',
            width: '80%',
            height: '2px',
            backgroundColor: '#00a884',
            boxShadow: '0 0 12px #00a884',
            animation: 'radarPing 2s infinite ease-in-out',
            top: '50%',
          }} />

          {/* Viewfinder Target Corner Brackets */}
          <div style={{
            width: 140,
            height: 140,
            border: '2px dashed rgba(255, 255, 255, 0.4)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
             <Camera size={36} color="rgba(255,255,255,0.6)" />
          </div>

          <span style={{
            position: 'absolute',
            bottom: 12,
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 500,
          }}>
             {cameraState === 'scanning' ? 'Align QR code within the frame' : cameraState === 'starting' ? 'Starting camera…' : 'Use image upload or enter the code below'}
          </span>
         </div>

         <div id="patient-qr-image-reader" style={{ display: 'none' }} />
         <label className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 18, cursor: 'pointer' }}>
           <QrCode size={16} /> Upload QR image
           <input type="file" accept="image/*" onChange={handleImageScan} style={{ display: 'none' }} />
         </label>

        {/* One-tap Test Presets */}
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
            Quick Demo Presets:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleResolve('DOC-DEMO01')}
              disabled={loading}
              style={{ padding: '9px 10px', fontSize: '0.8rem', justifyContent: 'flex-start', textAlign: 'left' }}
            >
              <Stethoscope size={16} color="var(--blue-600)" />
              <div>
                <strong style={{ display: 'block', color: 'var(--navy-900)' }}>Dr. Mehta</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>DOC-DEMO01</span>
              </div>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleResolve('LAB-DEMO01')}
              disabled={loading}
              style={{ padding: '9px 10px', fontSize: '0.8rem', justifyContent: 'flex-start', textAlign: 'left' }}
            >
              <Building2 size={16} color="var(--teal-600)" />
              <div>
                <strong style={{ display: 'block', color: 'var(--navy-900)' }}>Lifeline Lab</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>LAB-DEMO01</span>
              </div>
            </button>
          </div>
        </div>

        {/* Manual Fallback Input */}
        <form onSubmit={handleSubmitManual} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>
            Or enter Clinic / Lab code manually:
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="e.g. DOC-DEMO01 or LAB-DEMO01"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-medium)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                textTransform: 'uppercase',
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !manualCode.trim()}>
              {loading ? 'Resolving...' : <ArrowRight size={16} />}
            </button>
          </div>
        </form>

        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.82rem',
            color: '#dc2626',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
