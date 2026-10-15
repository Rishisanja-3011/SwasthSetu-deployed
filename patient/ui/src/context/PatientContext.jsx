import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { patientApi } from '../services/patientApi';

const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const [patient, setPatient] = useState(() => patientApi.getStoredPatient());
  const [activeEncounter, setActiveEncounter] = useState(() => patientApi.getActiveEncounter());
  const [authLoading, setAuthLoading] = useState(Boolean(patientApi.getAccessToken()));
  const [authError, setAuthError] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [connectionStatus, setConnectionStatus] = useState(() => (navigator.onLine ? 'ONLINE' : 'OFFLINE'));
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = patientApi.getAccessToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const restoredPatient = await patientApi.getCurrentProfile();
        const restoredEncounter = await patientApi.getActiveEncounterFromServer().catch(() => patientApi.getActiveEncounter());
        if (!cancelled) {
          setPatient(restoredPatient);
          setActiveEncounter(restoredEncounter);
        }
      } catch (error) {
        patientApi.clearSession();
        if (!cancelled) {
          setPatient(null);
          setActiveEncounter(null);
          setAuthError(error.message);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('ONLINE');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshEncounter = useCallback(async () => {
    const current = patientApi.getActiveEncounter();
    if (!current?.id || !patientApi.getAccessToken()) return;
    try {
      const latest = await patientApi.refreshEncounter(current.id);
      setActiveEncounter(latest);
    } catch (error) {
      if (error.status === 401) logout();
    }
  }, []);

  useEffect(() => {
    if (!activeEncounter?.id || !patient) return undefined;
    refreshEncounter();
    const interval = setInterval(refreshEncounter, 2500);
    return () => clearInterval(interval);
  }, [activeEncounter?.id, patient, refreshTrigger, refreshEncounter]);

  const setAuthenticatedSession = (accessToken, authenticatedPatient) => {
    patientApi.saveSession(accessToken, authenticatedPatient);
    setPatient(authenticatedPatient);
    setAuthError(null);
    setAuthLoading(false);
    setRefreshTrigger((value) => value + 1);
    patientApi.getActiveEncounterFromServer().then(setActiveEncounter).catch(() => {});
  };

  const logout = () => {
    patientApi.clearSession();
    setPatient(null);
    setActiveEncounter(null);
    setAuthError(null);
    setRefreshTrigger((value) => value + 1);
  };

  const updateActiveEncounter = (encounter) => {
    patientApi.saveActiveEncounter(encounter);
    setActiveEncounter(encounter);
    setRefreshTrigger((value) => value + 1);
  };

  const clearEncounter = () => {
    patientApi.clearActiveEncounter();
    setActiveEncounter(null);
    setRefreshTrigger((value) => value + 1);
  };

  return (
    <PatientContext.Provider
      value={{
        patient,
        allPatients: patient ? [patient] : [],
        activeEncounter,
        updateActiveEncounter,
        clearEncounter,
        setAuthenticatedSession,
        logout,
        isAuthenticated: Boolean(patient && patientApi.getAccessToken()),
        authLoading,
        authError,
        isOnline,
        connectionStatus,
        refreshTrigger,
        triggerRefresh: () => setRefreshTrigger((value) => value + 1),
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const context = useContext(PatientContext);
  if (!context) throw new Error('usePatient must be used within PatientProvider');
  return context;
}
