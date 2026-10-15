import React, { useEffect, useRef, useState } from 'react';
import { FlaskConical, LoaderCircle } from 'lucide-react';

const enabled = import.meta.env.VITE_ENABLE_DEMO_REPORT_SELECTOR === 'true';

function ageFromDateOfBirth(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function matchesGrantedIdentity(patient, identity) {
  if (!patient || !identity) return false;
  const identityAge = identity.age ?? ageFromDateOfBirth(identity.date_of_birth);

  return patient.phone === identity.phone
    && patient.name === identity.name
    && Number(patient.age) === Number(identityAge)
    && patient.gender === identity.gender;
}

async function readPdfFile(response, fileName) {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/pdf')) {
    throw new Error('Synthetic report was not returned as a PDF. Check the demo asset path.');
  }

  const blob = await response.blob();
  const headerBytes = await blob.slice(0, 5).arrayBuffer();
  const header = new TextDecoder().decode(headerBytes);
  if (header !== '%PDF-') {
    throw new Error('Synthetic report content is not a PDF. The server may have returned the Vite HTML fallback.');
  }

  return new File([blob], fileName, { type: 'application/pdf' });
}

export function DemoReportSelector({ identity, onSelect }) {
  const [catalog, setCatalog] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(enabled);
  const [loadingFile, setLoadingFile] = useState('');
  const [error, setError] = useState('');
  const fileRequestRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    let mounted = true;
    fetch('/demo-reports/catalog.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Synthetic report catalog could not be loaded.');
        if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
          throw new Error('Synthetic report catalog returned unexpected content instead of JSON.');
        }
        const data = await response.json();
        if (!data.synthetic || !Array.isArray(data.patients)) {
          throw new Error('Synthetic report catalog is invalid.');
        }
        return data;
      })
      .then((data) => {
        if (mounted) setCatalog(data);
      })
      .catch((fetchError) => {
        if (mounted && fetchError.name !== 'AbortError') {
          setError(fetchError.message || 'Synthetic report catalog could not be loaded.');
        }
      })
      .finally(() => {
        if (mounted) setLoadingCatalog(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => () => {
    fileRequestRef.current?.abort();
  }, []);

  if (!enabled) return null;

  const matchingPatients = catalog?.patients?.filter((patient) => matchesGrantedIdentity(patient, identity)) || [];
  const matchingReports = matchingPatients.flatMap((patient) => [
    { patient, report: patient.report },
    ...(patient.report.correctedReport
      ? [{ patient, report: { ...patient.report.correctedReport, scenario: 'corrected-companion' } }]
      : []),
  ]);

  const choose = async (patient, report) => {
    if (!report?.file) return;

    fileRequestRef.current?.abort();
    const controller = new AbortController();
    fileRequestRef.current = controller;
    setLoadingFile(report.file);
    setError('');

    try {
      const response = await fetch(`/demo-reports/${report.file}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Synthetic PDF is not available.');
      const file = await readPdfFile(response, report.file);
      onSelect({
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
        rawFile: file,
      });
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') {
        setError(fetchError.message || 'Could not load synthetic demo report.');
      }
    } finally {
      if (fileRequestRef.current === controller) {
        fileRequestRef.current = null;
        setLoadingFile('');
      }
    }
  };

  return (
    <div style={{ marginBottom: '1rem', padding: '0.8rem', border: '1px solid #facc15', borderRadius: 'var(--radius-md)', background: '#fffbeb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.78rem', fontWeight: 800, color: '#92400e', marginBottom: 5 }}>
        <FlaskConical size={15} /> Synthetic demonstration reports
      </div>
      <p style={{ fontSize: '0.73rem', color: '#92400e', marginBottom: 8 }}>
        Explicitly enabled synthetic fixtures. Only a fixture matching this granted patient identity is shown.
      </p>

      {loadingCatalog && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#92400e', fontSize: '0.75rem' }}>
          <LoaderCircle size={15} className="animate-spin" /> Loading matching fixture catalog…
        </div>
      )}

      {!loadingCatalog && catalog && matchingPatients.length === 0 && (
        <p style={{ color: '#92400e', fontSize: '0.72rem', margin: 0 }}>
          No synthetic fixture matches the current granted name, age, gender, and phone.
        </p>
      )}

       {!loadingCatalog && matchingReports.length > 0 && (
         <div style={{ display: 'grid', gap: 6 }}>
           {matchingReports.map(({ patient, report }) => {
            return (
              <button
                 key={`${patient.identifier || 'fixture'}-${report.file}`}
                type="button"
                 onClick={() => choose(patient, report)}
                disabled={Boolean(loadingFile)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, border: '1px solid #fcd34d', borderRadius: 7, padding: '0.45rem 0.6rem', background: '#fff', color: '#78350f', cursor: 'pointer', textAlign: 'left' }}
              >
                <span>
                  <strong style={{ display: 'block', fontSize: '0.76rem' }}>{report.label || report.file}</strong>
                  <small style={{ fontSize: '0.68rem' }}>{patient.name} · {report.description || 'Synthetic CBC fixture'}</small>
                </span>
                {loadingFile === report.file && <LoaderCircle size={15} className="animate-spin" />}
              </button>
            );
          })}
        </div>
      )}

      {error && <p role="alert" style={{ color: '#b91c1c', fontSize: '0.72rem', marginTop: 7 }}>{error}</p>}
    </div>
  );
}
