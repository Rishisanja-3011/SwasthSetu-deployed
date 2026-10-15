import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Activity, ChevronDown, User, ShieldCheck, QrCode, FileText, Clock, MessageSquareHeart } from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { PatientSwitcherModal } from './PatientSwitcherModal';
import { PatientNotificationBell } from './PatientNotificationBell';
import './Navbar.css';
import { useMediBotIntro } from '../context/MediBotIntroContext';

export function Navbar() {
  const { patient, activeEncounter } = usePatient();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const location = useLocation();
  const { triggerMediBotIntro } = useMediBotIntro();
  const handleAssistantClick = (event) => {
    if (location.pathname !== '/assistant') {
      event.preventDefault();
      triggerMediBotIntro();
    }
  };

  return (
    <>
      <header className="patient-navbar">
        <div className="navbar-inner">
          <Link to="/" className="brand-section">
            <div className="brand-icon-box">
              <Activity size={22} />
            </div>
            <div className="brand-title-wrap">
              <div className="brand-name">
                VaaniDoc
                <span className="brand-version">2.0</span>
              </div>
              <div className="brand-subtitle">Patient Portal</div>
            </div>
          </Link>

          {/* Desktop & Tablet Navigation Bar */}
          <nav className="navbar-desktop-nav" aria-label="Main Navigation">
            <NavLink
              to="/"
              className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`}
              end
            >
              <QrCode size={16} />
              <span>Scan / Home</span>
            </NavLink>

            <NavLink
              to="/reports"
              className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`}
            >
              <FileText size={16} />
              <span>My Reports</span>
            </NavLink>

            <NavLink
              to="/timeline"
              className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`}
            >
              <Clock size={16} />
              <span>Timeline</span>
            </NavLink>

            <NavLink
              to="/assistant"
              onClick={handleAssistantClick}
              className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`}
            >
              <MessageSquareHeart size={16} />
              <span>Assistant</span>
            </NavLink>
            {activeEncounter?.status === 'OPEN' && (
              <NavLink
                to="/waiting"
                className={({ isActive }) => `desktop-nav-link ongoing-consultation-link ${isActive ? 'active' : ''}`}
              >
                <Activity size={16} />
                <span>Ongoing consultation</span>
              </NavLink>
            )}
          </nav>

          <div className="navbar-right">
            <PatientNotificationBell />
            <button
              className="patient-badge-btn"
              onClick={() => setShowSwitcher(true)}
              title="View your patient profile"
              aria-label="View your patient profile"
              aria-haspopup="dialog"
            >
              <div className="patient-avatar">
                {patient?.name ? patient.name.charAt(0) : 'P'}
              </div>
              <div className="patient-info-min">
                <span className="patient-name-min">{patient?.name || 'Patient'}</span>
                <span className="patient-id-min">{patient?.patient_identifier || 'PT-ID'}</span>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {showSwitcher && (
        <PatientSwitcherModal onClose={() => setShowSwitcher(false)} />
      )}
    </>
  );
}
