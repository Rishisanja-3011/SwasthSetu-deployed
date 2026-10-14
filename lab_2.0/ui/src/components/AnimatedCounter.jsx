import React, { useState, useEffect, useRef } from 'react';

/**
 * Smooth easeInOutCubic function for natural counting acceleration & deceleration.
 * Starts gently, accelerates in the middle, and settles smoothly into the final number.
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * AnimatedCounter component for VaaniDoc Laboratory Dashboard.
 *
 * Smoothly animates numbers from previous to new values using requestAnimationFrame.
 * - On initial dashboard load: counts upward from 0 to actual backend value.
 * - On dashboard refresh: animates smoothly from current displayed value to new actual value.
 * - Prevents restarting from 0 on regular re-renders.
 * - Preserves loading state without premature zeroes.
 * - Respects prefers-reduced-motion.
 * - Applies a subtle medical teal glow during animation that smoothly fades away upon completion.
 */
export default function AnimatedCounter({
  value,
  duration = 1800,
  padLength = 2,
  glowType = 'teal', // 'teal' | 'alert' | 'none'
  className = '',
  style = {},
}) {
  // Check if user system prefers reduced motion
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current;

  // Local state for the rendered number
  const [displayValue, setDisplayValue] = useState(() => (typeof value === 'number' ? value : 0));
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasAppeared, setHasAppeared] = useState(false);

  // References to keep animation state accurate across renders without re-triggering loops
  const prevTargetRef = useRef(null);
  const currentValueRef = useRef(typeof value === 'number' ? value : 0);
  const rafIdRef = useRef(null);

  useEffect(() => {
    // If value is not yet loaded (null/undefined/non-number), wait for real backend data
    if (value === null || value === undefined || typeof value !== 'number') {
      return;
    }

    const targetVal = Math.round(value);

    // If user prefers reduced motion, snap immediately to target without animation
    if (prefersReducedMotion) {
      setDisplayValue(targetVal);
      currentValueRef.current = targetVal;
      prevTargetRef.current = targetVal;
      setIsAnimating(false);
      setHasAppeared(true);
      return;
    }

    // Determine start value:
    // - On initial appearance (prevTargetRef is null): count up from 0
    // - On subsequent updates (e.g. refresh): count from currently displayed value to new target
    const isInitial = prevTargetRef.current === null;
    const startVal = isInitial ? 0 : currentValueRef.current;

    // Prevent restart if target value hasn't changed on component re-render
    if (!isInitial && prevTargetRef.current === targetVal && Math.round(currentValueRef.current) === targetVal) {
      return;
    }

    prevTargetRef.current = targetVal;

    // If initial value is literally 0, display 0 with fade-in and no unnecessary count loop
    if (isInitial && targetVal === 0) {
      setDisplayValue(0);
      currentValueRef.current = 0;
      setIsAnimating(false);
      setHasAppeared(true);
      return;
    }

    // Cancel any running animation before starting a new one
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    setIsAnimating(true);
    if (!hasAppeared) {
      setHasAppeared(true);
    }

    let startTime = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      const current = startVal + (targetVal - startVal) * easedProgress;
      const roundedCurrent = Math.round(current);

      currentValueRef.current = current;
      setDisplayValue(roundedCurrent);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(animate);
      } else {
        // Guarantee final value matches backend value with 100% precision
        setDisplayValue(targetVal);
        currentValueRef.current = targetVal;
        setIsAnimating(false);
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [value, duration, prefersReducedMotion]);

  // Loading state placeholder if value has not yet arrived from backend API
  if (value === null || value === undefined) {
    return (
      <span className={`animated-counter-value loading ${className}`} style={style}>
        --
      </span>
    );
  }

  // Format with optional zero padding (e.g. '08' for 8 if padLength is 2)
  const formatted = padLength > 0
    ? String(displayValue).padStart(padLength, '0')
    : String(displayValue);

  const glowClass = isAnimating
    ? glowType === 'alert'
      ? 'animating-alert'
      : 'animating-teal'
    : '';

  const fadeClass = hasAppeared ? 'fade-in' : '';

  return (
    <span
      className={`animated-counter-value ${glowClass} ${fadeClass} ${className}`.trim()}
      style={style}
    >
      {formatted}
    </span>
  );
}
