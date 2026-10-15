import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Stethoscope, Building2, FlaskConical, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { patientApi } from '../services/patientApi';
import { PatientDialog } from '../components/PatientDialog';
import './TimelineScreen.css';

const date = (value, time = false) => value ? new Date(value).toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
}) : 'Not recorded';
const text = (value) => Array.isArray(value) ? value.join(', ') || 'Not recorded' : typeof value === 'string' && value.trim() ? value : 'Not recorded';

function ConsultationDetails({ consultation }) {
  const details = consultation.details;
  const intake = details.intake;
  const clinical = intake?.structured_data?.clinical_intake || intake?.structured_data || {};
  return <>
    <div className="consultation-doctor">
      <span className="consultation-icon"><Stethoscope size={25} /></span>
      <div><h3>{details.doctor?.name || 'Doctor unavailable'}</h3><p>{details.doctor?.specialty}</p><p>{details.doctor?.clinic_name}</p></div>
    </div>
    <dl className="consultation-facts">
      <div><dt>Consultation date</dt><dd>{date(details.created_at, true)}</dd></div>
      <div><dt>Visit</dt><dd>{details.visit_type === 'REVISITING' ? 'Follow-up consultation' : 'New consultation'}</dd></div>
      <div><dt>Intake submitted</dt><dd>{date(intake?.confirmed_at || intake?.created_at, true)}</dd></div>
      <div><dt>Status</dt><dd>{details.status === 'CLOSED' ? `Completed · ${date(details.ended_at)}` : 'Open consultation'}</dd></div>
    </dl>
    <section className="consultation-section">
      <h3><FileText size={18} /> Your intake</h3>
      {!intake ? <p>No intake was submitted for this consultation.</p> : intake.input_mode === 'SKIPPED' ? <p>You chose to skip intake for this visit.</p> : <>
        <blockquote>{intake.transcript || 'No original statement recorded.'}</blockquote>
        <dl className="consultation-facts">
          <div><dt>Chief complaint</dt><dd>{text(intake.chief_complaint || clinical.chief_complaint)}</dd></div>
          <div><dt>Duration</dt><dd>{text(intake.duration || clinical.duration)}</dd></div>
          <div><dt>Symptoms</dt><dd>{text(intake.symptoms?.length ? intake.symptoms : clinical.symptoms)}</dd></div>
          <div><dt>Input</dt><dd>{intake.input_mode === 'VOICE' ? 'Voice' : 'Text'}</dd></div>
        </dl>
      </>}
    </section>
    <section className="consultation-section">
      <h3><FlaskConical size={18} /> Tests ordered by your doctor</h3>
      {details.diagnostic_orders.length === 0 ? <p>No diagnostic tests were ordered during this consultation.</p> : details.diagnostic_orders.map((order) => <article key={order.id} className="consultation-order">
        <div className="consultation-order-heading"><strong>{order.test_type.replaceAll('_', ' ')}</strong><span className="consultation-status">{order.status === 'COMPLETED' ? 'Completed' : 'Ordered'}</span></div>
        <p className="consultation-muted">Ordered {date(order.created_at, true)}</p>
        {order.clinical_notes && <p>{order.clinical_notes}</p>}
        {order.report ? <Link to={`/report/${order.report.id}`} className="consultation-report-link">View published report · {order.report.laboratory_name}<ChevronRight size={16} /></Link> : <p className="consultation-muted">Published report not yet available.</p>}
      </article>)}
    </section>
    {details.consultation_note && <section className="consultation-section"><h3>Doctor’s consultation notes</h3><p style={{ whiteSpace: 'pre-wrap' }}>{details.consultation_note}</p></section>}
  </>;
}

export function TimelineScreen() {
  const { patient } = usePatient();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('consultation');
  const selected = consultations.find((item) => String(item.details.encounter_id) === selectedId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setConsultations([]);
    patientApi.getHealthTimeline().then((items) => { if (!cancelled) setConsultations(items); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load consultations.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patient?.id, reload]);

  return <div className="consultation-timeline page-reading-container">
    <header className="consultation-page-header page-heading">
      <div><span className="page-eyebrow">YOUR HEALTH JOURNEY</span><h1>My consultations</h1><p>Each visit, in one place. Open a consultation to see your intake and ordered tests.</p></div>
      <button className="btn btn-secondary" onClick={() => setReload((v) => v + 1)} disabled={loading} aria-label="Refresh consultations"><RefreshCw size={17} /></button>
    </header>
    {loading ? <div className="consultation-empty" role="status">Loading your consultations…</div> : error ? <div className="consultation-empty" role="alert"><p>{error}</p><button className="btn btn-primary" onClick={() => setReload((v) => v + 1)}>Try again</button></div> : consultations.length === 0 ? <div className="consultation-empty"><CalendarDays size={34} /><h2>Your first visit starts here</h2><p>Your consultations will appear here after you start a doctor visit.</p><Link to="/" className="btn btn-primary">Start a doctor visit</Link></div> : <>
      <div className="consultation-count">{consultations.length} consultation{consultations.length === 1 ? '' : 's'} · Most recent first</div>
       <div className="consultation-list">{consultations.map((item, index) => {
        const details = item.details;
        const ordered = details.diagnostic_orders.length;
         return <button key={item.id} type="button" className="consultation-card" style={{ '--timeline-delay': `${Math.min(index * 90, 540)}ms` }} onClick={() => setParams({ consultation: details.encounter_id })} aria-label={`View consultation with ${details.doctor?.name || 'Doctor'} on ${date(item.timestamp)}`}>
          <span className="consultation-date"><strong>{new Date(item.timestamp).getDate()}</strong><span>{new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span></span>
          <span className="consultation-card-main"><span className="consultation-card-top"><strong>{details.doctor?.name || 'Doctor unavailable'}</strong><span className={`consultation-status ${details.status === 'OPEN' ? 'is-open' : ''}`}>{details.status === 'CLOSED' ? 'Completed' : 'Open'}</span></span>
            <span className="consultation-muted"><Building2 size={14} />{details.doctor?.clinic_name || 'Clinic not recorded'}</span>
            <span className="consultation-card-bottom"><span>{details.visit_type === 'REVISITING' ? 'Follow-up visit' : 'New consultation'}</span><span><FlaskConical size={14} />{ordered ? `${ordered} test${ordered === 1 ? '' : 's'} ordered` : 'No tests ordered'}</span></span>
          </span><ChevronRight size={20} className="consultation-chevron" />
        </button>;
      })}</div>
    </>}
    {selected && <PatientDialog title="Consultation details" onClose={() => setParams({})}><ConsultationDetails consultation={selected} /></PatientDialog>}
    {!loading && !error && selectedId && !selected && <p role="status">This consultation is not available in your record.</p>}
  </div>;
}
