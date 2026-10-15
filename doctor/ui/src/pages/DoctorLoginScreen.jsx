import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, QrCode, Shield, Sparkles, ArrowRight, CheckCircle2, User, Phone, Building } from 'lucide-react';
import { useDoctorAuth } from '../context/DoctorAuthContext';

export const DoctorLoginScreen = () => {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [doctorCode, setDoctorCode] = useState('');
  const [phone, setPhone] = useState('');

  // Registration state
  const [name, setName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [specialty, setSpecialty] = useState('General Physician');
  const [clinicName, setClinicName] = useState('');

  const { login, register, loading, error } = useDoctorAuth();
  const navigate = useNavigate();
  const publicSite = `${(import.meta.env.VITE_LANDING_APP_URL || 'http://localhost:5174').replace(/\/$/, '')}/`;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login({ doctor_code: doctorCode, phone });
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await register({
        name,
        phone: regPhone,
        specialty,
        clinic_name: clinicName,
      });
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div className="v-card fade-in" style={{
        maxWidth: 480,
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 32,
        boxShadow: '0 12px 32px rgba(10, 37, 64, 0.08)',
        border: '1px solid var(--border-subtle)',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: 'var(--teal-500)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            boxShadow: '0 4px 14px rgba(0, 168, 132, 0.3)',
          }}>
            <Stethoscope size={30} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--navy-900)', letterSpacing: '-0.02em' }}>
            VaaniDoc <span style={{ color: 'var(--teal-600)' }}>Doctor Portal</span>
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'var(--slate-500)', marginTop: 4 }}>
            Doctor-Specific Queue • Dual Clinical Intake • Bounded Access
          </p>
        </div>
        <a href={publicSite} style={{ display: 'block', textAlign: 'center', color: 'var(--teal-700)', fontSize: '0.78rem', fontWeight: 700, marginBottom: 14 }}>← About VaaniDoc</a>

        {/* Tab Toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--slate-100)',
          borderRadius: 10,
          padding: 3,
          marginBottom: 20,
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'login' ? '#ffffff' : 'transparent',
              color: activeTab === 'login' ? 'var(--navy-900)' : 'var(--slate-600)',
              boxShadow: activeTab === 'login' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Doctor Login
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'register' ? '#ffffff' : 'transparent',
              color: activeTab === 'register' ? 'var(--navy-900)' : 'var(--slate-600)',
              boxShadow: activeTab === 'register' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Register New Doctor
          </button>
        </div>

        {error && (
          <div style={{
            padding: 10,
            borderRadius: 8,
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.84rem',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Tab 1: Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 6 }}>
                Doctor Code (e.g. DOC-409)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={doctorCode}
                  onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
                  placeholder="DOC-409"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--navy-900)',
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 6 }}>
                Registered Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98111 22334"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem',
                  color: 'var(--navy-900)',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '12px 0' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>
        )}

        {/* Tab 2: Register Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 5 }}>
                Doctor Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Ramesh Mehta"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 5 }}>
                Specialty
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="General Physician"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 5 }}>
                Clinic / Health Center Name
              </label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Community Health Clinic"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 5 }}>
                Mobile Number
              </label>
              <input
                type="text"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+91 98111 22334"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem',
                }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-teal"
              style={{ width: '100%', padding: '12px 0' }}
              disabled={loading}
            >
              {loading ? 'Creating Doctor Identity...' : 'Generate Doctor Code & QR'}
            </button>
          </form>
        )}

        {/* Security Reassurance Footer */}
        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: '0.74rem',
          color: 'var(--slate-500)',
        }}>
          <Shield size={13} color="var(--teal-600)" />
          <span>Doctor identity mapped strictly to own consultation queue.</span>
        </div>
      </div>
    </div>
  );
};
