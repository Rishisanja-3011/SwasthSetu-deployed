import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { patientApi } from '../services/patientApi';
import { LabPermissionModal } from '../components/LabPermissionModal';

export function ProviderScanScreen() {
  const { providerCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { authLoading, isAuthenticated, patient } = usePatient();
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login', {
        replace: true,
        state: {
          pendingProviderCode: providerCode,
          returnTo: `${location.pathname}${location.search}`,
        },
      });
      return;
    }

    let cancelled = false;
    patientApi.resolveCode(providerCode)
      .then((resolved) => {
        if (!cancelled) {
          setProvider(resolved);
          sessionStorage.setItem('vaanidoc_pending_scan_provider', JSON.stringify(resolved));
        }
      })
      .catch((lookupError) => {
        if (!cancelled) setError(lookupError.message);
      });
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, navigate, location.pathname, providerCode]);

  useEffect(() => {
    if (provider?.type === 'DOCTOR') {
      navigate(`/doctor-confirm?provider=${encodeURIComponent(provider.code)}`, { replace: true, state: { doctor: provider.entity } });
    }
  }, [navigate, provider]);

  if (error) {
    return (
      <div className="v-card" style={{ maxWidth: 500, margin: '50px auto', padding: 24, textAlign: 'center' }}>
        <AlertCircle size={38} color="#dc2626" style={{ marginBottom: 10 }} />
        <h3>Provider QR not recognized</h3>
        <p style={{ color: 'var(--slate-600)', fontSize: '0.86rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Return home</button>
      </div>
    );
  }

  if (!provider || !patient) {
    return <div style={{ textAlign: 'center', padding: 70, color: 'var(--slate-500)' }}><LoaderCircle size={26} className="spin" /> <p>Validating provider QR...</p></div>;
  }

  if (provider.type === 'DOCTOR') return null;

  return (
    <LabPermissionModal
      isOpen
      labEntity={provider.entity}
      onClose={() => navigate('/')}
      onSuccess={() => navigate('/reports', { replace: true })}
    />
  );
}
