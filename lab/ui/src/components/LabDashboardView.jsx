import React, { useMemo, useState } from 'react';
import { Users, Clock, AlertTriangle, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

export default function LabDashboardView({
  metrics,
  worklist,
  reports,
  onOpenPatientVisit,
  onOpenReport,
  onRefresh,
  isRefreshing,
}) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const reportList = reports || [];
  const metricRows = useMemo(() => {
    if (selectedMetric === 'pending') return worklist || [];
    if (selectedMetric === 'processing') return reportList.filter((report) => ['UPLOADED', 'PROCESSING'].includes(report.status));
    if (selectedMetric === 'review') return reportList.filter((report) => report.status === 'NEEDS_REVIEW');
    if (selectedMetric === 'published') return reportList.filter((report) => report.status === 'PUBLISHED');
    return [];
  }, [reportList, selectedMetric, worklist]);

  const metricCard = (key, className, label, value, icon) => (
    <button type="button" className={`metric-counter-card ${className || ''} metric-counter-card-clickable`} onClick={() => setSelectedMetric(key)} aria-pressed={selectedMetric === key}>
      <div className="metric-info"><div className="label">{label}</div><div className="value">{value}</div></div>
      <div className={`metric-icon-box ${className || 'teal'}`}>{icon}</div>
    </button>
  );

  return (
    <div>
      {/* Page Title with VaaniDoc Section Tag (Matching Image 2) */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal-brand)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            LABORATORY WORKSPACE
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--navy-900)', letterSpacing: '-0.025em' }}>
            Diagnostic Operations Dashboard
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Active patient visits, report processing queue, and clinical sign-off status
          </p>
        </div>
        <button
          type="button"
          className="btn-clinical outline"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh approved patient grants and report status"
          aria-label="Refresh dashboard"
          style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Refreshing…' : 'Refresh dashboard'}</span>
        </button>
      </div>

      {/* 4 Simple Operational Summary Cards (Matching Image 2 Card Style) */}
      <div className="metrics-row">
        {metricCard('pending', 'teal', 'Pending Visits', <AnimatedCounter value={metrics?.activeGrantsCount} />, <Users size={22} />)}
        {metricCard('processing', 'blue', 'Processing Reports', <AnimatedCounter value={metrics?.processingCount} />, <Clock size={22} />)}
        {metricCard('review', 'red', 'Needs Review', <AnimatedCounter value={metrics?.needsReviewCount} glowType="alert" />, <AlertTriangle size={22} />)}
        {metricCard('published', 'green', 'Published Reports', <AnimatedCounter value={metrics?.publishedCount} />, <CheckCircle size={22} />)}
      </div>

      {selectedMetric && (
        <div className="clinical-card metric-results-card">
          <div className="clinical-card-header">
            <div className="card-title-group"><h3 className="card-title">{selectedMetric === 'pending' ? 'Pending patient queue' : selectedMetric === 'processing' ? 'Reports under process' : selectedMetric === 'review' ? 'Reports needing review' : 'Recently published reports'}</h3><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{metricRows.length} record{metricRows.length === 1 ? '' : 's'}</span></div>
            <button type="button" className="btn-clinical outline" onClick={() => setSelectedMetric(null)}>Close</button>
          </div>
          {metricRows.length === 0 ? <p style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>Nothing in this category right now.</p> : (
            <div className="metric-results-list">
              {metricRows.map((item) => {
                const published = selectedMetric === 'published';
                const reportTime = item.published_at || item.created_at;
                const reportGrant = !item.grant_status && item.lab_access_grant_id
                  ? (worklist || []).find((grant) => String(grant.grant_id || grant._id) === String(item.lab_access_grant_id))
                  : item;
                const displayPatient = reportGrant?.patient;
                return <div className="metric-result-row" key={String(item.grant_id || item._id)}>
                  <div><strong>{published ? (item.report_identifier || item.test_type || 'Diagnostic report') : displayPatient?.name || item.patient?.name || item.original_file_name || item.test_type || 'CBC report'}</strong>
                    <small>{published ? `Published ${reportTime ? new Date(reportTime).toLocaleString() : 'time unavailable'}` : displayPatient ? `${displayPatient.gender || ''} · ${displayPatient.age || ''} yrs · ${item.diagnostic_order?.test_type || item.test_type || 'CBC'}` : `Status: ${item.status}`}</small>
                  </div>
                  {!published && (reportGrant?.grant_status === 'ACTIVE' ? <button type="button" className="btn-clinical primary" onClick={() => onOpenPatientVisit(reportGrant)}>Open</button> : <button type="button" className="btn-clinical outline" onClick={() => onOpenReport(reportGrant || item)}>Review</button>)}
                </div>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Pending Worklist Table */}
      <div className="clinical-card">
        <div className="clinical-card-header">
          <div className="card-title-group">
            <h3 className="card-title">Active Worklist</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ({worklist?.length || 0} active records)
            </span>
          </div>
        </div>

        {!worklist || worklist.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.9rem' }}>No pending laboratory visits.</p>
            <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
              When a patient scans the lab QR code and approves sharing, their visit will appear here.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Test Ordered</th>
                  <th>Ordering Doctor</th>
                  <th>Access Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {worklist.map((item) => {
                  const isActive = item.grant_status === 'ACTIVE';

                  return (
                    <tr key={item.grant_id}>
                      <td>
                        {isActive && item.patient ? (
                          <div>
                            <strong style={{ color: 'var(--text-main)' }}>{item.patient.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.patient.gender}, {item.patient.age} yrs · {item.patient.phone}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>
                            [Identity Redacted — Access Expired]
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge-pill low">
                          {item.diagnostic_order?.test_type || 'CBC'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {item.diagnostic_order?.doctor_id?.name || 'Registered Doctor'}
                      </td>
                      <td>
                        {isActive ? (
                          <span className="badge-pill normal">Active</span>
                        ) : (
                          <span className="badge-pill neutral">Expired</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isActive ? (
                          <button
                            className="btn-clinical primary"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                            onClick={() => onOpenPatientVisit(item)}
                          >
                            <span>Open Visit</span>
                            <ArrowRight size={13} />
                          </button>
                        ) : (
                          <button
                            className="btn-clinical outline"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                            onClick={() => onOpenReport(item)}
                          >
                            <span>View Report</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
