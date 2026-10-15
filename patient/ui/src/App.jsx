import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { PatientProvider } from './context/PatientContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import { AppRoutes } from './routes/AppRoutes';
import { usePatient } from './context/PatientContext';
import FloatingMediBot from './components/FloatingMediBot';
import { BackgroundEffect } from './components/BackgroundEffect';
import { MediBotIntroProvider } from './context/MediBotIntroContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';

function AppShell() {
  const { isAuthenticated } = usePatient();
  const location = useLocation();
  const isPublicLanding = location.pathname === '/welcome';

  return (
    <div className="app-container">
      <BackgroundEffect />
      <a className="skip-link" href="#patient-main">Skip to content</a>
      {isAuthenticated && !isPublicLanding && <Navbar />}
      <NetworkStatusBanner />
      <main id="patient-main" className="main-content" tabIndex={-1}>
        <AppRoutes />
      </main>
      {isAuthenticated && !isPublicLanding && <BottomNav />}
      {isAuthenticated && !isPublicLanding && <FloatingMediBot />}
    </div>
  );
}

export function App() {
  return (
    <AppErrorBoundary>
      <PatientProvider>
        <BrowserRouter>
          <MediBotIntroProvider>
            <AppShell />
          </MediBotIntroProvider>
        </BrowserRouter>
      </PatientProvider>
    </AppErrorBoundary>
  );
}

export default App;
