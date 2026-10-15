import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MediBotIntroOverlay from '../components/MediBotIntroOverlay';

const MediBotIntroContext = createContext(null);

export function MediBotIntroProvider({ children }) {
  const [isIntroActive, setIsIntroActive] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationRef = useRef(false);
  const introTimerRef = useRef(null);
  const revealTimerRef = useRef(null);

  useEffect(() => {
    const image = new Image();
    image.src = '/images/medibot-robot.png';
    return () => {
      clearTimeout(introTimerRef.current);
      clearTimeout(revealTimerRef.current);
    };
  }, []);

  const triggerMediBotIntro = useCallback(() => {
    if (location.pathname === '/assistant' || isIntroActive || navigationRef.current) return;
    navigationRef.current = true;
    setIsRevealing(false);
    setIsIntroActive(true);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    introTimerRef.current = setTimeout(() => navigate('/assistant'), reducedMotion ? 900 : 2200);
  }, [isIntroActive, location.pathname, navigate]);

  useEffect(() => {
    if (!isIntroActive || location.pathname !== '/assistant') return undefined;
    setIsRevealing(true);
    revealTimerRef.current = setTimeout(() => {
      setIsIntroActive(false);
      setIsRevealing(false);
      navigationRef.current = false;
    }, 260);
    return () => clearTimeout(revealTimerRef.current);
  }, [isIntroActive, location.pathname]);

  const handleSkip = useCallback(() => {
    clearTimeout(introTimerRef.current);
    navigate('/assistant');
  }, [navigate]);

  return (
    <MediBotIntroContext.Provider value={{ triggerMediBotIntro, isIntroActive }}>
      {children}
      {isIntroActive && <MediBotIntroOverlay isRevealing={isRevealing} onSkip={handleSkip} />}
    </MediBotIntroContext.Provider>
  );
}

export function useMediBotIntro() {
  const context = useContext(MediBotIntroContext);
  if (!context) throw new Error('useMediBotIntro must be used within MediBotIntroProvider');
  return context;
}
