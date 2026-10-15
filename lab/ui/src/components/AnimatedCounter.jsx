import React, { useEffect, useRef, useState } from 'react';

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

export default function AnimatedCounter({ value, duration = 900, glowType = 'teal' }) {
  const [displayValue, setDisplayValue] = useState(() => (Number.isFinite(value) ? value : 0));
  const previousValue = useRef(Number.isFinite(value) ? value : 0);

  useEffect(() => {
    if (!Number.isFinite(value)) return undefined;
    const start = previousValue.current;
    const target = Math.round(value);
    const startTime = performance.now();
    let frame;

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setDisplayValue(Math.round(start + ((target - start) * easeInOutCubic(progress))));
      if (progress < 1) frame = requestAnimationFrame(animate);
      else previousValue.current = target;
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return (
    <span className={`animated-counter-value animating-${glowType}`}>
      {Number.isFinite(value) ? String(displayValue).padStart(2, '0') : '--'}
    </span>
  );
}
