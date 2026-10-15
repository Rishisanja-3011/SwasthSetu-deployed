import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { usePatient } from '../context/PatientContext';
import { PatientLoginScreen } from '../pages/PatientLoginScreen';
import { ProviderScanScreen } from '../pages/ProviderScanScreen';
import { HomeScreen } from '../pages/HomeScreen';
import { DoctorConfirmScreen } from '../pages/DoctorConfirmScreen';
import { VisitTypeScreen } from '../pages/VisitTypeScreen';
import { DoctorAccessPermissionScreen } from '../pages/DoctorAccessPermissionScreen';
import { SymptomIntakeScreen } from '../pages/SymptomIntakeScreen';
import { IntakeReviewScreen } from '../pages/IntakeReviewScreen';
import { WaitingRoomScreen } from '../pages/WaitingRoomScreen';
import { ReportsScreen } from '../pages/ReportsScreen';
import { ReportDetailScreen } from '../pages/ReportDetailScreen';
import { TimelineScreen } from '../pages/TimelineScreen';
import { AssistantScreen } from '../pages/AssistantScreen';
import { LandingPage } from '../pages/LandingPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = usePatient();
  const location = useLocation();

  if (authLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '70px 20px', color: 'var(--slate-500)' }}>
        Restoring your secure patient session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ returnTo: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PatientLoginScreen />} />
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/scan/:providerType/:providerCode" element={<ProviderScanScreen />} />
      <Route path="/scan/:providerCode" element={<ProviderScanScreen />} />
      <Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
      <Route path="/doctor-confirm" element={<ProtectedRoute><DoctorConfirmScreen /></ProtectedRoute>} />
      <Route path="/visit-type" element={<ProtectedRoute><VisitTypeScreen /></ProtectedRoute>} />
      <Route path="/doctor-access-permission" element={<ProtectedRoute><DoctorAccessPermissionScreen /></ProtectedRoute>} />
      <Route path="/intake" element={<ProtectedRoute><SymptomIntakeScreen /></ProtectedRoute>} />
      <Route path="/intake-review" element={<ProtectedRoute><IntakeReviewScreen /></ProtectedRoute>} />
      <Route path="/waiting" element={<ProtectedRoute><WaitingRoomScreen /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsScreen /></ProtectedRoute>} />
      <Route path="/report/:reportId" element={<ProtectedRoute><ReportDetailScreen /></ProtectedRoute>} />
      <Route path="/timeline" element={<ProtectedRoute><TimelineScreen /></ProtectedRoute>} />
      <Route path="/assistant" element={<ProtectedRoute><AssistantScreen /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
