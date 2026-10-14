import React, { useState, useEffect, useRef } from 'react';
import LabNavbar from './components/LabNavbar';
import LabSidebar from './components/LabSidebar';
import LabDashboardView from './components/LabDashboardView';
import PatientVisitView from './components/PatientVisitView';
import ReportDetailView from './components/ReportDetailView';
import LabProfileModal from './components/LabProfileModal';
import LabLoginView from './components/LabLoginView';
import BackgroundEffect from './components/BackgroundEffect';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function valueId(value) {
  if (value && typeof value === 'object') return value._id || value.id || '';
  return value || '';
}

function reportBelongsToGrant(report, grant) {
  const grantId = valueId(grant?.grant_id || grant?._id);
  const reportGrantId = valueId(report?.lab_access_grant_id);
  const grantReportId = valueId(
    grant?.report_id || grant?.published_report?._id || grant?.published_report,
  );

  return Boolean(
    grantId
      && reportGrantId
      && String(reportGrantId) === String(grantId)
      && (!grantReportId || String(report?._id) === String(grantReportId)),
  );
}

export default function App() {
  // Navigation & Authentication State
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('vaanidoc_lab_access_token') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('vaanidoc_lab_access_token')));
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'patient_visit' | 'reports'

  // Lab & Dashboard Data
  const [lab, setLab] = useState(null);
  const [activeStaff, setActiveStaff] = useState(null);
  const [metrics, setMetrics] = useState(null);





  const [worklist, setWorklist] = useState([]);
  const [allReportsList, setAllReportsList] = useState([]);

  // Active Visit & Report Data
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [identityData, setIdentityData] = useState(null);
  const [currentReport, setCurrentReport] = useState(null);
  const [observations, setObservations] = useState([]);

  // Processing & Publishing Flags
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  // Modals & Banners
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const grantLoadRef = useRef(0);
  const sessionRef = useRef(0);

  const apiFetch = (url, options = {}) => fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  const showNotification = (msg, type = 'teal') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const labWorkflowMessage = (code, fallback) => {
    const mappedMessage = {
      REPORT_ALREADY_UPLOADED: 'This access grant already has a preserved report. Use Fix & Verify for flagged observations, or start a new grant for a replacement document.',
      EXTRACTION_REVIEW_REQUIRED: 'Publication remains disabled until the extraction review blockers are resolved.',
      PUBLICATION_BLOCKED: 'Publication remains disabled until all observations are validated.',
      LAB_WORKFLOW_FAILED: fallback,
    }[code];

    return mappedMessage || code || fallback || 'Laboratory workflow failed.';
  };

  const loadAuthenticatedOperator = async () => {
    if (!accessToken) return;
    const sessionId = sessionRef.current;

    try {
      const response = await apiFetch('/api/auth/me');
      const data = await response.json();
      if (sessionId !== sessionRef.current) return;
      if (response.ok && data.success && data.user) {
        setActiveStaff({
          id: data.user.id,
          name: data.user.name,
          phone: data.user.phone,
          role: data.user.role === 'LABORATORY' ? 'Laboratory operator' : data.user.role,
        });
      } else {
        setActiveStaff(null);
      }
    } catch (err) {
      console.error('Failed to load authenticated operator:', err);
      setActiveStaff(null);
    }
  };

  // Load Initial Lab & Dashboard Data. Refreshes never replace the visit the
  // operator is currently reviewing.
  const loadDashboard = async ({ selectFirst = false } = {}) => {
    if (!accessToken) return;
    const sessionId = sessionRef.current;
    setIsDashboardLoading(true);
    try {
      const listRes = await apiFetch('/api/lab/list');
      const listData = await listRes.json();
      if (sessionId !== sessionRef.current) return;
      if (!listRes.ok || !listData.success) {
        throw new Error(listData.error || 'Laboratory list could not be loaded.');
      }

      if (listData.laboratories.length > 0) {
        const activeLab = listData.laboratories[0];
        setLab(activeLab);

        const dashRes = await apiFetch(`/api/lab/dashboard/${activeLab._id}`);
        const dashData = await dashRes.json();
        if (sessionId !== sessionRef.current) return;
        if (!dashRes.ok || !dashData.success) {
          throw new Error(dashData.error || 'Laboratory dashboard could not be loaded.');
        }

        setMetrics(dashData.metrics);
        setWorklist(dashData.worklist || []);
        setAllReportsList(dashData.reports || []);

        const refreshedSelectedGrant = selectedGrant
          && (dashData.worklist || []).find((grant) => String(valueId(grant.grant_id || grant._id))
            === String(valueId(selectedGrant.grant_id || selectedGrant._id)));
        const selectedReportId = valueId(
          selectedGrant?.report_id || selectedGrant?.published_report?._id || selectedGrant?.published_report,
        );
        const refreshedReportId = valueId(
          refreshedSelectedGrant?.report_id
            || refreshedSelectedGrant?.published_report?._id
            || refreshedSelectedGrant?.published_report,
        );
        if (refreshedSelectedGrant && (
          refreshedSelectedGrant.grant_status !== selectedGrant.grant_status
          || String(selectedReportId) !== String(refreshedReportId)
        )) {
          setSelectedGrant(refreshedSelectedGrant);
          loadGrantDetails(refreshedSelectedGrant, dashData.reports || []);
        }

        // Select one visit on the first authenticated load only. A manual
        // refresh is deliberately non-destructive so newly approved grants
        // appear without changing the current patient context.
        if (selectFirst && !selectedGrant && dashData.worklist?.length > 0) {
          const firstActive = dashData.worklist.find((g) => g.grant_status === 'ACTIVE') || dashData.worklist[0];
          setSelectedGrant(firstActive);
          loadGrantDetails(firstActive, dashData.reports || []);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      showNotification(err.message || 'Failed to load laboratory dashboard.', 'warning');
    } finally {
      if (sessionId === sessionRef.current) setIsDashboardLoading(false);
    }
  };

  // Load details for a selected grant (identity + existing report if present)
  const loadGrantDetails = async (grant, reportsList = allReportsList) => {
    if (!grant) return;
    const requestId = grantLoadRef.current + 1;
    grantLoadRef.current = requestId;
    const grantId = grant.grant_id || grant._id;

    // Do not allow identity, report, or observations from a previous grant to
    // survive while this grant is being loaded.
    setIdentityData(null);
    setCurrentReport(null);
    setObservations([]);

    const reportId = grant.report_id || grant.published_report?._id || grant.published_report;
    const matchedReport = (reportsList || []).find((report) => reportBelongsToGrant(report, grant)
      && (!reportId || String(report._id) === String(valueId(reportId))));

    // 1. Fetch patient identity if grant is active
    if (grant.grant_status === 'ACTIVE') {
      try {
        const res = await apiFetch(`/api/lab/grant/${grantId}/patient-identity`);
        const data = await res.json();
        if (requestId !== grantLoadRef.current) return;
        if (res.ok && data.success) {
          setIdentityData(data);
        } else {
          setIdentityData(null);
        }
      } catch (err) {
        console.error('Error fetching identity:', err);
        if (requestId === grantLoadRef.current) setIdentityData(null);
      }
    }

    // 2. Select reports by their explicit grant linkage. Patient names are
    // intentionally never used as a report matching key.
    if (requestId !== grantLoadRef.current) return;
    if (!matchedReport) return;

    // Published reports cannot be fetched through the active-report endpoint.
    // The dashboard summary is the safe receipt that remains visible.
    if (grant.grant_status !== 'ACTIVE' || matchedReport.status === 'PUBLISHED') {
      setCurrentReport(matchedReport);
      return;
    }

    try {
      const repRes = await apiFetch(`/api/lab/report/${matchedReport._id}`);
      const repData = await repRes.json();
      if (requestId !== grantLoadRef.current) return;
      if (repRes.ok && repData.success && reportBelongsToGrant(repData.report, grant)) {
        setCurrentReport(repData.report);
        setObservations(repData.observations || []);
      }
    } catch (err) {
      console.error('Error loading report for grant:', err);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    loadAuthenticatedOperator();
    loadDashboard({ selectFirst: true });
  }, [accessToken]);

  const handleLabLogin = async ({ labCode, phone }) => {
    const response = await fetch('/api/auth/provider/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_code: labCode, provider_type: 'LABORATORY', phone }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Laboratory sign-in failed.');
    }
    localStorage.setItem('vaanidoc_lab_access_token', data.access_token);
    setAccessToken(data.access_token);
    setLab({
      _id: data.provider.provider_id,
      name: data.provider.name,
      qr_code_id: data.provider.provider_code,
      location: data.provider.location,
      contact_phone: data.provider.contact_phone,
    });
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  const handleLabRegister = async ({ name, phone, location }) => {
    const response = await fetch('/api/auth/laboratory/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, location }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Laboratory registration failed.');
    }
    localStorage.setItem('vaanidoc_lab_access_token', data.access_token);
    setAccessToken(data.access_token);
    setLab({
      _id: data.laboratory.id,
      name: data.laboratory.name,
      qr_code_id: data.laboratory.qr_code_id,
      location: data.laboratory.location,
      contact_phone: data.laboratory.contact_phone,
    });
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  // Action: Open a visit from the Dashboard Worklist
  const handleOpenPatientVisit = async (grant) => {
    setSelectedGrant(grant);
    setCurrentView('patient_visit');
    await loadGrantDetails(grant);
  };

  // Action: Open a report from the Dashboard Worklist
  const handleOpenReport = async (grant) => {
    setSelectedGrant(grant);
    setCurrentView('reports');
    await loadGrantDetails(grant);
  };

  // Action: Upload Generated Blood Report & Run CBC Extraction Engine
  const handleUploadReport = async ({ fileName, rawText = null, rawFile = null }) => {
    if (!selectedGrant || selectedGrant.grant_status !== 'ACTIVE') {
      const error = 'This laboratory access grant has expired. Upload is no longer available.';
      showNotification(error, 'warning');
      return { success: false, error };
    }
    setIsProcessing(true);

    try {
      const grantId = selectedGrant.grant_id || selectedGrant._id;
      const fileBase64 = rawFile ? await fileToBase64(rawFile) : null;
      const res = await apiFetch('/api/lab/generate-report', {
        method: 'POST',
        body: JSON.stringify({
          grant_id: grantId,
          file_name: fileName || 'laboratory-report.pdf',
          raw_text: rawText || '',
          file_base64: fileBase64,
          file_mime_type: rawFile?.type || 'application/pdf',
          ...(activeStaff ? { technician: activeStaff } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && reportBelongsToGrant(data.report, selectedGrant)) {
        setCurrentReport(data.report);
        setObservations(data.observations || []);

        if (data.extraction_pending) {
          showNotification('Original PDF stored securely. CBC extraction is pending the configured extraction service.', 'warning');
        } else if (data.needs_review) {
          showNotification('CBC Extracted: One or more parameters require pathologist review before publication.', 'warning');
        } else {
          showNotification('Report Uploaded & Extracted: CBC observations validated and ready for review.', 'teal');
        }

        await loadDashboard();
        // Immediately navigate to extraction review in Reports view
        setCurrentView('reports');
        return { success: true };
      } else {
        const error = labWorkflowMessage(
          data.error,
          'The uploaded report response did not match the selected access grant.',
        );
        showNotification(error, 'warning');
        return { success: false, error };
      }
    } catch (err) {
      const error = labWorkflowMessage(err.message, 'Error connecting to extraction engine.');
      showNotification(error, 'warning');
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Update & deterministically revalidate an extracted observation (Screen #5)
  const handleUpdateObservation = async (obsId, updatedFields) => {
    try {
      const res = await apiFetch(`/api/lab/observation/${obsId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updatedFields,
          ...(activeStaff ? { technician: activeStaff } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setObservations((prev) =>
          prev.map((o) => (o._id === obsId ? data.observation : o))
        );

        if (data.report && reportBelongsToGrant(data.report, selectedGrant)) {
          setCurrentReport(data.report);
        } else if (currentReport) {
          setCurrentReport((prev) => ({
            ...prev,
            status: data.report_status,
            extraction_review_required: data.extraction_review_required,
            publish_blocking_reasons: data.publish_blocking_reasons || [],
          }));
        }

        showNotification('Observation corrected and deterministically verified!', 'teal');
        await loadDashboard();
        return { success: true };
      } else {
        const error = labWorkflowMessage(data.error, 'Failed to update observation.');
        showNotification(error, 'warning');
        return { success: false, error };
      }
    } catch (err) {
      const error = labWorkflowMessage(err.message, 'Error updating observation.');
      showNotification(error, 'warning');
      return { success: false, error };
    }
  };

  // Action: Publish CBC Report to VaaniDoc (Screen #6 -> Screen #7)
  const handlePublishReport = async (signOffNotes) => {
    if (!currentReport || !selectedGrant || selectedGrant.grant_status !== 'ACTIVE') {
      const error = 'Publication is blocked because laboratory access has expired or no report is selected.';
      showNotification(error, 'warning');
      return { success: false, error };
    }
    setIsPublishing(true);

    try {
      const grantId = selectedGrant?.grant_id || selectedGrant?._id;
      if (!reportBelongsToGrant(currentReport, selectedGrant)) {
        const error = 'Publication is blocked because the report is not linked to the selected access grant.';
        showNotification(error, 'warning');
        return { success: false, error };
      }
      const res = await apiFetch(`/api/lab/report/${currentReport._id}/publish`, {
        method: 'POST',
        body: JSON.stringify({
          grant_id: grantId,
          ...(activeStaff ? { technician: activeStaff } : {}),
          sign_off_notes: signOffNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.report) {
        // Keep only the server's published summary as a receipt. Patient
        // identity and observations are no longer in the laboratory context.
        grantLoadRef.current += 1;
        setCurrentReport(data.report);
        setObservations([]);
        setIdentityData(null);
        if (selectedGrant) {
          setSelectedGrant((prev) => ({
            ...prev,
            grant_status: 'EXPIRED',
            patient: null,
            diagnostic_order: null,
          }));
        }
        showNotification('Report published successfully! Bounded access expired automatically.', 'teal');
        await loadDashboard();
        return { success: true };
      } else {
        const error = labWorkflowMessage(data.error, 'Publication blocked.');
        showNotification(error, 'warning');
        return { success: false, error };
      }
    } catch (err) {
      const error = labWorkflowMessage(err.message, 'Error publishing report.');
      showNotification(error, 'warning');
      return { success: false, error };
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLogout = () => {
    sessionRef.current += 1;
    grantLoadRef.current += 1;
    localStorage.removeItem('vaanidoc_lab_access_token');
    setAccessToken('');
    setIsLoggedIn(false);
    setActiveStaff(null);
    setLab(null);
    setSelectedGrant(null);
    setIdentityData(null);
    setCurrentReport(null);
    setObservations([]);
    setWorklist([]);
    setAllReportsList([]);
    setIsDashboardLoading(false);
    setCurrentView('dashboard');
  };

  // Derive Current Access Status:
  // ACTIVE if the selected grant is ACTIVE and its report is not published
  const isAccessActive = selectedGrant?.grant_status === 'ACTIVE' && currentReport?.status !== 'PUBLISHED';
  const accessStatus = isAccessActive ? 'ACTIVE' : 'EXPIRED';
  const existingReportId = valueId(
    selectedGrant?.report_id
      || selectedGrant?.published_report?._id
      || selectedGrant?.published_report
      || (reportBelongsToGrant(currentReport, selectedGrant) ? currentReport?._id : ''),
  );

  // If user is logged out, render Screen #1: Lab Login
  if (!isLoggedIn) {
    return (
      <div className="landing-page-wrap" style={{ minHeight: '100vh', position: 'relative' }}>
        <BackgroundEffect />
        <LabLoginView
        lab={lab}
        onLogin={handleLabLogin}
        onRegister={handleLabRegister}
      />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <BackgroundEffect />
      {/* Top Navigation Bar */}
      <LabNavbar
          lab={lab}
          accessStatus={accessStatus}
      />

      <div className="shell-body">
        {/* Left Sidebar */}
        <LabSidebar
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
           onLogout={handleLogout}
          counts={{
            pendingVisits: metrics?.activeGrantsCount || 0,
            needsReview: metrics?.needsReviewCount || 0,
          }}
        />

        {/* Main Content Area */}
        <main className="main-canvas">
          {/* Notification Banner */}
          {notification && (
            <div className={`info-banner ${notification.type}`} style={{ marginBottom: '1.25rem' }}>
              <span>{notification.msg}</span>
            </div>
          )}

          {/* VIEW 1: DASHBOARD (Screen #2) */}
          {currentView === 'dashboard' && (
            <LabDashboardView
              metrics={metrics}
              worklist={worklist}
              onOpenPatientVisit={handleOpenPatientVisit}
              onOpenReport={handleOpenReport}
              onRefresh={() => loadDashboard()}
              isRefreshing={isDashboardLoading}
            />
          )}

          {/* VIEW 2: PATIENT VISIT / VERIFICATION (Screen #3) */}
          {currentView === 'patient_visit' && (
            <PatientVisitView
               key={selectedGrant?.grant_id || selectedGrant?._id || 'no-grant'}
               identityData={identityData}
               onUploadReport={handleUploadReport}
               isProcessing={isProcessing}
               onBackToDashboard={() => setCurrentView('dashboard')}
               onOpenReport={() => handleOpenReport(selectedGrant)}
               existingReportId={existingReportId}
               grantKey={selectedGrant?.grant_id || selectedGrant?._id || 'no-grant'}
             />
          )}

          {/* VIEW 3: REPORTS (Screen #4, #5, #6, #7) */}
          {currentView === 'reports' && (
            <ReportDetailView
               key={selectedGrant?.grant_id || selectedGrant?._id || 'no-grant'}
               report={currentReport}
              observations={observations}
               patient={selectedGrant?.grant_status === 'ACTIVE'
                 ? (identityData?.identity || selectedGrant?.patient || null)
                 : null}
              identity={selectedGrant?.grant_status === 'ACTIVE'
                ? (identityData?.identity || selectedGrant?.patient || null)
                : null}
               order={selectedGrant?.grant_status === 'ACTIVE'
                 ? (selectedGrant?.diagnostic_order || identityData?.order)
                 : null}
               grantStatus={accessStatus}
               grantKey={selectedGrant?.grant_id || selectedGrant?._id || 'no-grant'}
               existingReportId={existingReportId}
               isProcessing={isProcessing}
              isPublishing={isPublishing}
              onUploadReport={handleUploadReport}
              onUpdateObservation={handleUpdateObservation}
              onPublishReport={handlePublishReport}
              onBackToDashboard={() => setCurrentView('dashboard')}
              activeStaff={activeStaff}
            />
          )}
        </main>
      </div>

      {/* Lab Profile Modal Dialog */}
      <LabProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        lab={lab}
      />
    </div>
  );
}
