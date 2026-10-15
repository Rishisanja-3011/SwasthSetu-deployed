import React, { useState } from 'react';
import { Activity, User, ArrowRight, ShieldCheck, Building2, MapPin } from 'lucide-react';

export default function LabLoginView({ onLogin, onRegister, lab }) {
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState(lab?.contact_phone || '+919900000020');
  const [labCode, setLabCode] = useState(lab?.qr_code_id || 'LAB-DEMO01');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegistering = mode === 'register';
  const publicSite = `${(import.meta.env.VITE_LANDING_APP_URL || 'http://localhost:5174').replace(/\/$/, '')}/`;
  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await onRegister({ name, phone, location });
      } else {
        await onLogin({ labCode, phone });
      }
    } catch (error) {
      setErrorMessage(error.message || `Laboratory ${isRegistering ? 'registration' : 'sign-in'} failed.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage('');
    setSuccessMessage('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: '1.5rem', position: 'relative', zIndex: 1 }}>
      <div className="clinical-card" style={{ maxWidth: '470px', width: '100%', padding: '2.5rem 2rem', boxShadow: 'var(--neo-raised-lg)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-icon-box" style={{ width: '48px', height: '48px', margin: '0 auto 1rem auto' }}><Activity size={26} /></div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--main-text)', letterSpacing: '-0.025em' }}>VaaniDoc</h1>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--hospital-blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.2rem' }}>Laboratory Portal</p>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted-text)', marginTop: '0.5rem' }}>{isRegistering ? 'Register your facility and receive its VaaniDoc ID' : 'Sign in with your laboratory ID and registered phone'}</p>
        </div>
        <a href={publicSite} style={{ display: 'block', textAlign: 'center', color: 'var(--hospital-blue)', fontSize: '0.78rem', fontWeight: 700, marginBottom: 14 }}>← About VaaniDoc</a>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', marginBottom: '1.4rem', boxShadow: 'var(--neo-inset-sm)' }}>
          <button type="button" onClick={() => switchMode('login')} style={{ border: 0, borderRadius: 8, padding: '0.65rem', background: !isRegistering ? 'var(--surface-raised)' : 'transparent', color: !isRegistering ? 'var(--hospital-blue)' : 'var(--muted-text)', fontWeight: 700, cursor: 'pointer', boxShadow: !isRegistering ? 'var(--neo-raised-sm)' : 'none', transition: 'all 0.16s ease' }}>Returning lab</button>
          <button type="button" onClick={() => switchMode('register')} style={{ border: 0, borderRadius: 8, padding: '0.65rem', background: isRegistering ? 'var(--surface-raised)' : 'transparent', color: isRegistering ? 'var(--hospital-blue)' : 'var(--muted-text)', fontWeight: 700, cursor: 'pointer', boxShadow: isRegistering ? 'var(--neo-raised-sm)' : 'none', transition: 'all 0.16s ease' }}>Self-register</button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && <>
            <label className="lab-auth-label" htmlFor="lab-name">Laboratory name</label>
            <div className="lab-auth-input-wrap"><Building2 size={16} /><input id="lab-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sunrise Diagnostics" required /></div>
            <label className="lab-auth-label" htmlFor="lab-location">City or facility location <span>(optional)</span></label>
            <div className="lab-auth-input-wrap"><MapPin size={16} /><input id="lab-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Ahmedabad" /></div>
          </>}

          {!isRegistering && <>
            <label className="lab-auth-label" htmlFor="lab-code">Laboratory ID / QR code</label>
            <div className="lab-auth-input-wrap"><Building2 size={16} /><input id="lab-code" value={labCode} onChange={(event) => setLabCode(event.target.value.toUpperCase())} placeholder="LAB-123456" required /></div>
          </>}

          <label className="lab-auth-label" htmlFor="lab-phone">Registered laboratory phone</label>
          <div className="lab-auth-input-wrap"><User size={16} /><input id="lab-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 90000 00000" required /></div>

          <p style={{ margin: '0.6rem 0 1.25rem', fontSize: '0.78rem', color: 'var(--muted-text)', lineHeight: 1.45 }}>{isRegistering ? 'Your facility is active immediately. We generate a unique laboratory ID for patient QR scanning and future sign-in.' : 'The phone must match the number used when this laboratory was registered.'}</p>
          {errorMessage && <div style={{ marginBottom: '1rem', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', border: '1px solid var(--status-danger-border)', fontSize: '0.82rem', boxShadow: 'var(--neo-raised-sm)' }}>{errorMessage}</div>}
          {successMessage && <div style={{ marginBottom: '1rem', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-normal-bg)', color: 'var(--status-normal-text)', border: '1px solid var(--status-normal-border)', fontSize: '0.82rem', boxShadow: 'var(--neo-raised-sm)' }}>{successMessage}</div>}
          <button type="submit" className="btn-clinical primary" style={{ width: '100%', padding: '0.8rem', fontSize: '0.92rem' }} disabled={isSubmitting}>
            <span>{isSubmitting ? (isRegistering ? 'Registering...' : 'Signing in...') : (isRegistering ? 'Register laboratory' : 'Sign in to laboratory')}</span><ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.76rem', color: 'var(--muted-text)' }}><ShieldCheck size={14} color="var(--hospital-blue)" /><span>Bounded patient access is enforced per laboratory grant</span></div>
      </div>
    </div>
  );
}
