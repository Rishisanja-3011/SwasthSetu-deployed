import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Building2,
  LogOut,
} from 'lucide-react';

export default function LabSidebar({
  currentView,
  onNavigate,
  onOpenProfile,
  onLogout,
  counts,
}) {
  return (
    <aside className="lab-sidebar">
      <div className="sidebar-nav-section">
        <div className="sidebar-heading">WORKSPACE</div>

        <button
          className={`sidebar-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        <button
          className={`sidebar-nav-item ${currentView === 'patient_visit' ? 'active' : ''}`}
          onClick={() => onNavigate('patient_visit')}
        >
          <Users size={18} />
          <span>Patient Visits</span>
          {counts?.pendingVisits > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.72rem',
                background: currentView === 'patient_visit' ? 'linear-gradient(135deg, #32B3C2 0%, #2292A0 100%)' : 'var(--surface-inset)',
                color: currentView === 'patient_visit' ? '#fff' : 'var(--hospital-blue)',
                padding: '0.14rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                boxShadow: currentView === 'patient_visit' ? '0 2px 6px rgba(34, 146, 160, 0.3)' : 'var(--neo-inset-sm)',
              }}
            >
              {counts.pendingVisits}
            </span>
          )}
        </button>

        <button
          className={`sidebar-nav-item ${currentView === 'reports' ? 'active' : ''}`}
          onClick={() => onNavigate('reports')}
        >
          <FileText size={18} />
          <span>Reports</span>
          {counts?.needsReview > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.7rem',
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                color: '#fff',
                padding: '0.12rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
              }}
            >
              {counts.needsReview}
            </span>
          )}
        </button>
      </div>

      <div className="sidebar-footer-section">
        <button
          className="sidebar-nav-item"
          onClick={onOpenProfile}
          title="View laboratory facility details"
        >
          <Building2 size={16} />
          <span>Lab Profile</span>
        </button>

        <button
          className="sidebar-nav-item"
          onClick={onLogout}
          title="Log out of laboratory portal"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
