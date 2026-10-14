import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="offline-banner" role="alert">
        <WifiOff size={18} />
        <span>You are currently working offline. Changes will queue until connection is restored.</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        style={{
          background: 'var(--status-normal-badge-bg)',
          color: 'var(--status-normal-badge-text)',
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          borderBottom: '1px solid var(--status-normal-badge-border)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
        role="status"
      >
        <Wifi size={18} />
        <span>Network connection restored. Laboratory synchronization active.</span>
      </div>
    );
  }

  return null;
}
