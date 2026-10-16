import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DoctorAuthProvider, useDoctorAuth } from './context/DoctorAuthContext';
import { DoctorNavbar } from './components/DoctorNavbar';
import { DoctorSidebar } from './components/DoctorSidebar';
import { DoctorLoginScreen } from './pages/DoctorLoginScreen';
import { DoctorQueueScreen } from './pages/DoctorQueueScreen';
import { ClinicalCockpitScreen } from './pages/ClinicalCockpitScreen';
import { DoctorQRScreen } from './pages/DoctorQRScreen';

const DoctorLayout = ({ children }) => {
  const { doctor, authLoading } = useDoctorAuth();

  if (authLoading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--slate-500)' }}>Restoring secure doctor session...</div>;
  }

  if (!doctor) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <DoctorSidebar />
      <div className="main-wrapper">
        <DoctorNavbar />
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <DoctorAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<DoctorLoginScreen />} />

          <Route
            path="/"
            element={
              <DoctorLayout>
                <DoctorQueueScreen />
              </DoctorLayout>
            }
          />

          <Route
            path="/cockpit/:encounterId"
            element={
              <DoctorLayout>
                <ClinicalCockpitScreen />
              </DoctorLayout>
            }
          />

          <Route
            path="/qr"
            element={
              <DoctorLayout>
                <DoctorQRScreen />
              </DoctorLayout>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DoctorAuthProvider>
  );
}
