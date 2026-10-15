import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { QrCode, FileText, Clock, MessageSquareHeart } from 'lucide-react';
import './BottomNav.css';
import { useMediBotIntro } from '../context/MediBotIntroContext';

export function BottomNav() {
  const location = useLocation();
  const { triggerMediBotIntro } = useMediBotIntro();
  const handleAssistantClick = (event) => {
    if (location.pathname !== '/assistant') {
      event.preventDefault();
      triggerMediBotIntro();
    }
  };

  return (
    <nav className="patient-bottom-nav" aria-label="Patient navigation">
      <NavLink
        to="/"
        className={({ isActive }) => `nav-tab-item ${isActive ? 'active' : ''}`}
        end
      >
        <QrCode className="nav-tab-icon" />
        <span>Scan / Home</span>
      </NavLink>

      <NavLink
        to="/reports"
        className={({ isActive }) => `nav-tab-item ${isActive ? 'active' : ''}`}
      >
        <FileText className="nav-tab-icon" />
        <span>My Reports</span>
      </NavLink>

      <NavLink
        to="/timeline"
        className={({ isActive }) => `nav-tab-item ${isActive ? 'active' : ''}`}
      >
        <Clock className="nav-tab-icon" />
        <span>Timeline</span>
      </NavLink>

      <NavLink
        to="/assistant"
        onClick={handleAssistantClick}
        className={({ isActive }) => `nav-tab-item ${isActive ? 'active' : ''}`}
      >
        <MessageSquareHeart className="nav-tab-icon" />
        <span>Assistant</span>
      </NavLink>
    </nav>
  );
}
