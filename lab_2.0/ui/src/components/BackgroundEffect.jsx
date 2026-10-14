import React from 'react';
import './BackgroundEffect.css';

/**
 * BackgroundEffect Component
 *
 * Dedicated, non-intrusive 3D neomorphic background layer inspired by
 * soft blue-white porcelain aesthetic with curved circular edge shapes,
 * crisp white rim highlights, and gentle ambient cerulean blue shadows.
 *
 * Positioned fixed behind all application content (pointer-events: none, z-index: 0)
 * to ensure zero layout shift, zero horizontal scrolling, and 100% preservation
 * of all existing clicks, forms, inputs, animations, and interactions.
 */
export function BackgroundEffect() {
  return (
    <div className="neo-background-viewport" aria-hidden="true">
      {/* Base Canvas Gradient */}
      <div className="neo-bg-base-canvas" />

      {/* Central Luminous Radial Glow (keeps content area clean, bright, readable) */}
      <div className="neo-bg-center-glow" />

      {/* Top-Left Curved Concentric Circular Arcs */}
      <div className="neo-bg-arc-tl-outer">
        <div className="neo-bg-arc-tl-inner" />
      </div>

      {/* Right Edge Floating Raised Neomorphic Disc */}
      <div className="neo-bg-disc-right" />

      {/* Bottom-Left Curved Concentric Circular Arcs */}
      <div className="neo-bg-arc-bl-outer">
        <div className="neo-bg-arc-bl-inner" />
      </div>

      {/* Bottom-Right Rounded Corner Wave / Surface */}
      <div className="neo-bg-wave-br-outer">
        <div className="neo-bg-wave-br-inner" />
      </div>

      {/* Top-Right Soft Neomorphic Accent Orb */}
      <div className="neo-bg-orb-tr" />
    </div>
  );
}

export default BackgroundEffect;
