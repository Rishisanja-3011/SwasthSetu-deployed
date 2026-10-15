import React, { useState } from 'react';
import { Stethoscope, LogOut, ShieldCheck, ChevronDown, Bell, Menu, X, ClipboardList, FileText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDoctorAuth } from '../context/DoctorAuthContext';
import { DoctorProfileDropdown } from './DoctorProfileDropdown';
import { NotificationDropdown } from './NotificationDropdown';

export const DoctorNavbar = () => {
  const { doctor, logout, unreadCount } = useDoctorAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initial = doctor?.name?.replace('Dr. ', '').charAt(0) || 'D';

  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '12px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Brand & Clinic Info (Left) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: 'var(--teal-500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(0, 168, 132, 0.25)',
          }}>
            <Stethoscope size={22} />
          </div>
          <div>
            <div style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--navy-900)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
               VaaniDoc
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', fontWeight: 500 }}>
              {doctor?.clinic_name || 'Mehta Community Health Clinic'}
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Interactive Doctor Profile (Right) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {location.pathname.startsWith('/cockpit/') && <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setIsMenuOpen((open) => !open)} aria-label="Open doctor workspace menu" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: '1px solid var(--border-medium)', borderRadius: 9, background: '#fff', color: 'var(--navy-900)', cursor: 'pointer' }}>
            {isMenuOpen ? <X size={18} /> : <Menu size={18} />} <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Workspace</span>
          </button>
          {isMenuOpen && <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 190, padding: 6, background: '#fff', border: '1px solid var(--border-medium)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 200 }}>
            <button type="button" onClick={() => { setIsMenuOpen(false); navigate('/'); }} style={{ display: 'flex', gap: 8, width: '100%', padding: '10px 9px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--navy-900)' }}><ClipboardList size={16} /> Consultations</button>
            <button type="button" onClick={() => { setIsMenuOpen(false); document.getElementById('doctor-reports')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ display: 'flex', gap: 8, width: '100%', padding: '10px 9px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--navy-900)' }}><FileText size={16} /> Reports</button>
          </div>}
        </div>}
        {/* Bounded Access Assurance Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          fontSize: '0.76rem',
          fontWeight: 600,
          padding: '6px 14px',
          borderRadius: 20,
          border: '1px solid #bfdbfe',
        }}>
          <ShieldCheck size={14} />
          <span>Encounter-Bounded Access Active</span>
        </div>

        {/* NOTIFICATION BELL WITH COUNTER */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setIsNotificationOpen(!isNotificationOpen);
              setIsProfileOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: isNotificationOpen ? 'var(--blue-50)' : '#ffffff',
              border: isNotificationOpen ? '1px solid var(--blue-300)' : '1px solid var(--border-medium)',
              color: unreadCount > 0 ? 'var(--blue-600)' : 'var(--slate-600)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
            title={`${unreadCount} notifications`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 800,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Queue Notifications Dropdown Panel */}
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
          />
        </div>

        {/* CLICKABLE DOCTOR IDENTITY AREA (Opens Doctor Profile Dropdown) */}
        {doctor && (
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationOpen(false);
              }}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '5px 14px 5px 6px',
                backgroundColor: isProfileOpen ? 'var(--blue-50)' : 'var(--slate-50)',
                borderRadius: 24,
                border: isProfileOpen ? '1px solid var(--blue-400)' : '1px solid var(--slate-200)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}
              title="Click to view Doctor Profile, QR code & Doctor Code"
            >
              {/* Doctor Avatar Initial */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--navy-900)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}>
                {initial}
              </div>

              {/* Name & Code */}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--navy-900)', lineHeight: 1.1 }}>
                  {doctor.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--teal-700)', fontWeight: 700 }}>
                  Code: {doctor.doctor_code || doctor.qr_code_id}
                </div>
              </div>

              {/* Caret Down Indicator */}
              <ChevronDown
                size={15}
                color="var(--slate-500)"
                style={{
                  transform: isProfileOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  marginLeft: 2,
                }}
              />
            </div>

            {/* Doctor Profile Popup Panel */}
            <DoctorProfileDropdown
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
            />
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--slate-500)',
            fontSize: '0.82rem',
            fontWeight: 600,
            padding: '7px 10px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          title="Switch Doctor or Sign Out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
};
