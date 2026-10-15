import React from 'react';
import './BackgroundEffect.css';

export default function BackgroundEffect() {
  return (
    <div className="neo-background-viewport" aria-hidden="true">
      <div className="neo-bg-base-canvas" />
      <div className="neo-bg-center-glow" />
      <div className="neo-bg-arc-tl-outer"><div className="neo-bg-arc-tl-inner" /></div>
      <div className="neo-bg-disc-right" />
      <div className="neo-bg-arc-bl-outer"><div className="neo-bg-arc-bl-inner" /></div>
      <div className="neo-bg-wave-br-outer"><div className="neo-bg-wave-br-inner" /></div>
      <div className="neo-bg-orb-tr" />
    </div>
  );
}
