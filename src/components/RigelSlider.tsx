import React, { useRef, useState } from 'react';
import { triggerHaptic } from '../utils/nativeBridge';

interface RigelSliderProps {
  id?: string;
  ariaLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
}

function quantize(raw: number, min: number, max: number, step: number): number {
  const safeStep = step > 0 ? step : 1;
  const clamped = Math.min(max, Math.max(min, raw));
  const snapped = min + Math.round((clamped - min) / safeStep) * safeStep;
  const decimals = (safeStep.toString().split('.')[1] ?? '').length;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(decimals))));
}

export const RigelSlider: React.FC<RigelSliderProps> = ({
  id,
  ariaLabel,
  min,
  max,
  step,
  value,
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const span = Math.max(1e-9, max - min);
  const clampedValue = Math.min(max, Math.max(min, value));
  const ratio = (clampedValue - min) / span;
  const pct = `${(ratio * 100).toFixed(3)}%`;

  const updateFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const usable = Math.max(1, rect.width);
    const r = Math.min(1, Math.max(0, (clientX - rect.left) / usable));
    const next = quantize(min + r * span, min, max, step);
    if (next !== value) {
      onChange(next);
    }
  };

  return (
    <div
      id={id}
      className="rigel-slider"
      data-dragging={dragging ? 'true' : 'false'}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedValue}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).focus();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
        updateFromClientX(e.clientX);
        triggerHaptic('light');
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        updateFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore if capture already released
        }
      }}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(e) => {
        const bigStep = step * 5;
        let next: number | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          next = quantize(clampedValue + step, min, max, step);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          next = quantize(clampedValue - step, min, max, step);
        } else if (e.key === 'PageUp') {
          next = quantize(clampedValue + bigStep, min, max, step);
        } else if (e.key === 'PageDown') {
          next = quantize(clampedValue - bigStep, min, max, step);
        } else if (e.key === 'Home') {
          next = min;
        } else if (e.key === 'End') {
          next = max;
        }
        if (next !== null) {
          e.preventDefault();
          if (next !== value) {
            triggerHaptic('light');
            onChange(next);
          }
        }
      }}
    >
      <div ref={trackRef} className="rigel-slider-track">
        <div className="rigel-slider-rail" />
        <div className="rigel-slider-fill" style={{ width: pct }} />
        <div className="rigel-slider-thumb" style={{ left: pct }}>
          <span className="rigel-slider-thumb-core" />
        </div>
      </div>
    </div>
  );
};
