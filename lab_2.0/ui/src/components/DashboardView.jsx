import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  FlaskConical,
  Stethoscope,
  Search,
  QrCode,
  UserPlus,
  Filter,
} from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

export default function DashboardView({
  metrics,
  worklist,
  onSelectGrant,
  onQuickGenerate,
  onOpenQR,
  activeStaff,
  lab,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Filtered worklist based on search query and status filter
  const filteredWorklist = worklist.filter((item) => {
    const isActive = item.grant_status === 'ACTIVE';

    // Status filter
    if (statusFilter === 'ACTIVE' && !isActive) return false;
    if (statusFilter === 'EXPIRED' && isActive) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = item.patient?.name?.toLowerCase() || '';
      const pid = item.patient?.patient_identifier?.toLowerCase() || '';
      const phone = item.patient?.phone?.toLowerCase() || '';
      const orderType = item.diagnostic_order?.test_type?.toLowerCase() || '';

      return name.includes(q) || pid.includes(q) || phone.includes(q) || orderType.includes(q);
    }

    return true;
  });

  return (
    <div>
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div>
            <div className="metric-label">Active Lab Grants</div>
            <div className="metric-value" style={{ color: 'var(--teal-700)' }}><AnimatedCounter value={metrics?.activeGrantsCount} padLength={0} /></div>
          </div>
          <ShieldCheck size={32} color="var(--teal-700)" />
        </div>

        <div className="metric-card">
          <div>
            <div className="metric-label">In Extraction</div>
            <div className="metric-value" style={{ color: 'var(--text-main)' }}><AnimatedCounter value={metrics?.processingCount} padLength={0} /></div>
          </div>
          <Clock size={32} color="var(--teal-600)" />
        </div>

        <div className={`metric-card ${metrics.needsReviewCount > 0 ? 'alert-card' : ''}`}>
          <div>
            <div className="metric-label">Needs Clinical Review</div>
            <div className="metric-value" style={{ color: metrics.needsReviewCount > 0 ? 'var(--status-high-text)' : 'var(--status-normal-text)' }}>
              <AnimatedCounter
                value={metrics?.needsReviewCount}
                padLength={0}
                glowType={metrics?.needsReviewCount > 0 ? 'alert' : 'teal'}
              />
            </div>
          </div>
          <AlertCircle size={32} color={metrics.needsReviewCount > 0 ? 'var(--status-high-text)' : 'var(--status-normal-text)'} />
        </div>

        <div className="metric-card">
          <div>
            <div className="metric-label">Published to VaaniDoc</div>
            <div className="metric-value" style={{ color: 'var(--status-normal-text)' }}><AnimatedCounter value={metrics?.publishedCount} padLength={0} /></div>
          </div>
          <CheckCircle size={32} color="var(--status-normal-text)" />
        </div>
      </div>

      {/* Bounded Access Informational Banner */}
      <div className="banner info">
        <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Bounded Access Architecture:</strong> Laboratory access to patient identity is active only while the 
          test is pending. Once the CBC report is reviewed and published, lab access expires automatically by construction.
          No doctor consultation notes or past encounters are shared with the lab.
        </div>
      </div>

      {/* Main Worklist Glass Card */}
      <div className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <FlaskConical size={22} color="var(--teal-700)" />
            <span>Pending Diagnostic Worklist (CBC Orders)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              className="btn btn-outline"
              onClick={onOpenQR}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
               title="Display this laboratory QR code for patient walk-in intake"
            >
              <QrCode size={15} />
               <span>Lab QR Code ({lab?.qr_code_id || 'ID unavailable'})</span>
            </button>
            <span className="badge badge-normal">{filteredWorklist.length} Records</span>
          </div>
        </div>

        {/* Worklist Search & Filter Toolbar */}
        <div className="worklist-toolbar">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Orders ({worklist.length})
            </button>
            <button
              className={`filter-tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Active Grants ({worklist.filter((w) => w.grant_status === 'ACTIVE').length})
            </button>
            <button
              className={`filter-tab ${statusFilter === 'EXPIRED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('EXPIRED')}
            >
              Completed / Expired ({worklist.filter((w) => w.grant_status !== 'ACTIVE').length})
            </button>
          </div>

          <div className="search-input-box">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by name, ID, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredWorklist.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Clock size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No orders match the selected filter or search.</p>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); }}>
                Reset Filters
              </button>
              <button className="btn btn-primary" onClick={onOpenQR}>
                <UserPlus size={15} />
                <span>Simulate Walk-in Patient Scan</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="obs-table">
              <thead>
                <tr>
                  <th>Patient Identifier</th>
                  <th>Patient Name</th>
                  <th>Order Details</th>
                  <th>Grant Status</th>
                  <th>Access Expiry</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorklist.map((item) => {
                  const isActive = item.grant_status === 'ACTIVE';

                  return (
                    <tr key={item.grant_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {item.patient?.patient_identifier || 'PT-REDACTED'}
                      </td>
                      <td>
                        {isActive && item.patient ? (
                          <div>
                            <strong>{item.patient.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.patient.gender}, {item.patient.age} yrs · {item.patient.phone}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            [Identity Redacted - Access Expired]
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-low">{item.diagnostic_order?.test_type || 'CBC'}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Ordering: Dr. Ramesh Mehta
                        </div>
                      </td>
                      <td>
                        {isActive ? (
                          <span className="badge badge-normal">Active</span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--status-expired-bg)', color: 'var(--status-expired-text)', border: '1px solid var(--status-expired-border)' }}>
                            Expired
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {isActive ? '48h Active Window' : 'Self-Terminated'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isActive ? (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                            onClick={() => onSelectGrant(item)}
                          >
                            <span>Open & Process</span>
                            <ArrowRight size={14} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed</span>
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

      {/* Demo Scenario Fast Actions */}
      <div className="glass-card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Stethoscope size={20} color="var(--teal-700)" />
            <span>Interactive Demo Scenarios (Specification Compliance)</span>
          </div>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Select how you want the laboratory automated hematology analyzer to process Rahul Sharma's blood sample:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--teal-800)' }}>
              Scenario A: Standard Visit (Rahul's Actual Case)
            </strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Produces CBC with mild microcytic anemia: Hb 10.2 g/dL (LOW), WBC 8000 (NORMAL), Platelets 250,000 (NORMAL).
              Deterministic validation marks all OK with high confidence.
            </p>
            <button
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '0.82rem' }}
              onClick={() => onQuickGenerate('standard')}
            >
              Run Scenario A (Standard CBC)
            </button>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--status-high-text)' }}>
              Scenario B: Demo Script Step 34 (Deliberate NEEDS_REVIEW)
            </strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Produces a CBC where Platelet Count is 15 /µL (physiologically implausible) and low confidence (62%).
              Triggers mandatory <code>NEEDS_REVIEW</code> and strictly blocks publication until lab manual correction!
            </p>
            <button
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '0.82rem', borderColor: 'var(--status-high-border)', color: 'var(--status-high-text)' }}
              onClick={() => onQuickGenerate('needs_review_demo')}
            >
              Run Scenario B (Deliberate Review Flag)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
