import React from 'react';
import { Activity, ShieldCheck, ShieldAlert, Building2 } from 'lucide-react';

export default function LabNavbar({
  lab,
  accessStatus,
}) {
  const isAccessActive = accessStatus === 'ACTIVE';

  return (
    <header className="lab-navbar">
      <div className="navbar-brand-group">
        <div className="brand-icon-box">
          <Activity size={20} />
        </div>
        <div className="brand-text-block">
          <span className="brand-title">VaaniDoc</span>
          <span className="brand-subtitle">Laboratory Portal</span>
        </div>
        <span className="navbar-role-pill">Lab Workspace</span>
      </div>

      <div className="navbar-right-group">
        {/* Lab Identity */}
        <div className="lab-identity-badge">
          <Building2 size={16} color="var(--hospital-blue)" />
          <strong style={{ color: 'var(--text-main)' }}>{lab?.name || 'Laboratory'}</strong>
          <span className="lab-code-pill">{lab?.qr_code_id || 'ID unavailable'}</span>
        </div>

        {/* Informative Bounded Access Pill (Informational only, NO revoke button) */}
        {isAccessActive ? (
          <div
            className="access-pill active"
            title="Patient information is temporarily available for this laboratory visit."
          >
            <ShieldCheck size={14} />
            <span>● ACCESS ACTIVE</span>
          </div>
        ) : (
          <div
            className="access-pill expired"
            title="Laboratory access ended automatically after report publication."
          >
            <ShieldAlert size={14} />
            <span>● ACCESS EXPIRED</span>
          </div>
        )}

      </div>
    </header>
  );
}
