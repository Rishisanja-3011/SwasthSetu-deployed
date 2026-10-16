import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, QrCode, Stethoscope, Clock, ShieldCheck, MapPin } from 'lucide-react';
import { useDoctorAuth } from '../context/DoctorAuthContext';

export const DoctorSidebar = () => {
  const { doctor, queue } = useDoctorAuth();
  const waitingCount = queue.filter(q => q.status === 'OPEN').length;

  return (
    <aside className="doctor-sidebar" style={{
      width: 250,
      backgroundColor: '#ffffff',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
    }}>
      <div>
        {/* Navigation Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.92rem',
              color: isActive ? 'var(--blue-700)' : 'var(--slate-600)',
              backgroundColor: isActive ? 'var(--blue-50)' : 'transparent',
              border: isActive ? '1px solid var(--blue-200)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={18} />
              <span>Today's Queue</span>
            </div>
            {waitingCount > 0 && (
              <span style={{
                backgroundColor: 'var(--blue-600)',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
              }}>
                {waitingCount}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/qr"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.92rem',
              color: isActive ? 'var(--blue-700)' : 'var(--slate-600)',
              backgroundColor: isActive ? 'var(--blue-50)' : 'transparent',
              border: isActive ? '1px solid var(--blue-200)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            <QrCode size={18} />
            <span>Doctor QR Standee</span>
          </NavLink>
        </div>

        {/* Doctor Summary Card */}
        {doctor && (
          <div style={{
            marginTop: 28,
            padding: 16,
            borderRadius: 12,
            backgroundColor: 'var(--slate-50)',
            border: '1px solid var(--slate-200)',
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Clinic Desk Profile
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              {doctor.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginTop: 2 }}>
              {doctor.specialty || 'General Physician'}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              color: 'var(--slate-500)',
              marginTop: 10,
            }}>
              <MapPin size={14} color="var(--teal-600)" />
              <span>Cabin 2 • Desk Standee Live</span>
            </div>
          </div>
        )}
      </div>

      {/* Security & Access Notice */}
      <div style={{
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        border: '1px solid var(--slate-200)',
        fontSize: '0.74rem',
        color: 'var(--slate-500)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 4 }}>
          <ShieldCheck size={14} color="var(--teal-600)" />
          <span>VaaniDoc 2.0 Security</span>
        </div>
        Doctor queries locked automatically upon consultation closure. Raw audio destroyed.
      </div>
    </aside>
  );
};
