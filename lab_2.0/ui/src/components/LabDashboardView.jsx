import React from 'react';
import { Users, Clock, AlertTriangle, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

export default function LabDashboardView({
  metrics,
  worklist,
  onOpenPatientVisit,
  onOpenReport,
  onRefresh,
  isRefreshing,
}) {
  return (
    <div>
      {/* Page Title with VaaniDoc Section Tag (Matching Image 2) */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--hospital-blue)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            LABORATORY WORKSPACE
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--main-text)', letterSpacing: '-0.025em' }}>
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
        <div className="metric-counter-card">
          <div className="metric-info">
            <div className="label">Pending Visits</div>
            <div className="value">
              <AnimatedCounter value={metrics?.activeGrantsCount} />
            </div>
          </div>
          <div className="metric-icon-box teal">
            <Users size={22} />
          </div>
        </div>

        <div className="metric-counter-card">
          <div className="metric-info">
            <div className="label">Processing Reports</div>
            <div className="value">
              <AnimatedCounter value={metrics?.processingCount} />
            </div>
          </div>
          <div className="metric-icon-box blue">
            <Clock size={22} />
          </div>
        </div>

        <div className={`metric-counter-card ${metrics?.needsReviewCount > 0 ? 'alert' : ''}`}>
          <div className="metric-info">
            <div className="label">Needs Review</div>
            <div className="value" style={{ color: metrics?.needsReviewCount > 0 ? 'var(--status-danger-text)' : 'var(--main-text)' }}>
              <AnimatedCounter
                value={metrics?.needsReviewCount}
                glowType={metrics?.needsReviewCount > 0 ? 'alert' : 'teal'}
              />
            </div>
          </div>
          <div className="metric-icon-box red">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="metric-counter-card">
          <div className="metric-info">
            <div className="label">Published Reports</div>
            <div className="value">
              <AnimatedCounter value={metrics?.publishedCount} />
            </div>
          </div>
          <div className="metric-icon-box green">
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

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
