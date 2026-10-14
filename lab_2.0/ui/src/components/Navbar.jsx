import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  FileText,
  Activity,
  UserCheck,
  QrCode,
  Building2,
} from 'lucide-react';

export default function Navbar({
  lab,
  grantStatus,
  onResetDemo,
  onOpenAudit,
  currentStep,
  activeStaff,
  onOpenStaffModal,
  onOpenQRModal,
}) {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-logo">
          <Activity size={22} color="#ffffff" />
        </div>
        <div className="brand-text">
          <h1>VaaniDoc 2.0</h1>
          <div className="brand-tag">Laboratory Module & CBC Verification Engine</div>
        </div>
      </div>

      <div className="nav-badges">
        {/* Active Staff Switcher Chip (Screen #1: Lab Login / Staff Switcher) */}
        <div
          className="staff-chip"
          onClick={onOpenStaffModal}
          title="Click to switch practitioner / authentication (Screen #1)"
        >
          <div className="staff-avatar">{activeStaff?.avatar || 'SG'}</div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.1 }}>
              {activeStaff?.name || 'Dr. Shalini Gupta'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--hospital-blue)' }}>
              {activeStaff?.role ? activeStaff.role.split(' ')[0] : 'Pathologist'} · Switch
            </div>
          </div>
        </div>

        {/* Active Lab Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <Building2 size={15} color="var(--text-muted)" />
          <strong style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lab?.name || 'Laboratory'}
          </strong>
          <button
            onClick={onOpenQRModal}
            className="badge badge-low"
            style={{ cursor: 'pointer', border: '1px solid var(--border-medium)', padding: '0.15rem 0.45rem' }}
            title="View Lab QR Code"
          >
            {lab?.qr_code_id || 'ID unavailable'}
          </button>
        </div>

        {/* Bounded Access Live Indicator */}
        {grantStatus === 'ACTIVE' ? (
          <div className="bounded-pill" title="Lab Access Grant is active for pending CBC report">
            <ShieldCheck size={16} />
            <span>ACCESS: ACTIVE (48h Window)</span>
          </div>
        ) : (
          <div className="bounded-pill expired" title="Access expired automatically upon report publication">
            <ShieldAlert size={16} />
            <span>ACCESS: EXPIRED (Published)</span>
          </div>
        )}

        {/* View Audit Trail */}
        <button
          className="btn btn-outline"
          onClick={onOpenAudit}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
          title="Inspect immutable audit events for this encounter"
        >
          <FileText size={15} />
          <span>Audit Log</span>
        </button>

        {/* Reset Demo State Button */}
        <button
          className="btn btn-outline"
          onClick={onResetDemo}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
          title="Reset Rahul Sharma & CBC Order demo dataset"
        >
          <RotateCcw size={15} />
          <span>Reset Demo</span>
        </button>
      </div>
    </header>
  );
}
