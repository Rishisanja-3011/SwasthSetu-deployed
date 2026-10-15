import React, { useEffect, useState } from 'react';
import './MediBotIntroOverlay.css';

export default function MediBotIntroOverlay({ isRevealing = false, onSkip }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (event) => setReducedMotion(event.matches);
    setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', update);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onSkip?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      mediaQuery.removeEventListener?.('change', update);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onSkip]);

  return (
    <div className={`medibot-intro-overlay ${isRevealing ? 'is-revealing' : ''} ${reducedMotion ? 'reduced-motion' : ''}`} role="dialog" aria-modal="true" aria-label="Meet MediBot introduction">
      <div className="medibot-intro-backdrop" aria-hidden="true">
        <div className="medibot-intro-center-glow" />
        <div className="medibot-intro-ambient-arc arc-tl" />
        <div className="medibot-intro-ambient-arc arc-br" />
        <div className="medibot-intro-ambient-disc disc-tr" />
        <div className="medibot-intro-ambient-disc disc-bl" />
      </div>
      <div className="medibot-intro-container">
        <div className="medibot-intro-stage">
          <div className="medibot-intro-pulse-aura" />
          <div className="medibot-intro-glow-ring" />
          <div className="medibot-intro-podium">
            <div className="medibot-intro-robot-wrap">
              <img src="/images/medibot-robot.png" alt="MediBot" className="medibot-intro-robot-img" />
            </div>
          </div>
        </div>
        <div className="medibot-intro-text-group">
          <div className="medibot-intro-pill"><span className="medibot-intro-pill-dot" />Healthcare Assistant</div>
          <h1 className="medibot-intro-title">Meet <span className="medibot-intro-name">MediBot</span></h1>
          <p className="medibot-intro-subtitle">Your healthcare information assistant</p>
          <div className="medibot-intro-dots" aria-label="Opening assistant"><span /><span /><span /></div>
        </div>
      </div>
    </div>
  );
}
