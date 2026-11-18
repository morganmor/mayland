import React, { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useI18n } from '../i18n';
import type { ThinkingEffort } from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';
import { EFFORT_INDICATOR_COLOR, ReasoningIcon } from './ReasoningIcon';

interface EffortSliderProps {
  value: ThinkingEffort;
  onChange: (next: ThinkingEffort) => void;
  label?: string;
  active?: boolean;
}

const STEPS: Array<{
  id: ThinkingEffort;
  flareScale: number;
  glowOpacity: number;
}> = [
  { id: 'off', flareScale: 0, glowOpacity: 0 },
  { id: 'low', flareScale: 0.55, glowOpacity: 0.16 },
  { id: 'medium', flareScale: 0.78, glowOpacity: 0.28 },
  { id: 'high', flareScale: 1, glowOpacity: 0.42 },
  { id: 'xhigh', flareScale: 1.24, glowOpacity: 0.62 },
  { id: 'max', flareScale: 1.42, glowOpacity: 0.78 },
];

export const EffortSlider: React.FC<EffortSliderProps> = ({
  value,
  onChange,
  label,
  active = true,
}) => {
  const { t } = useI18n();
  const displayLabel = label ?? t.effort.defaultLabel;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(260);
  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackWidth(Math.max(120, el.clientWidth));
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  const currentIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.id === value)
  );
  const ratio = dragRatio !== null ? dragRatio : currentIdx / (STEPS.length - 1);
  const activeIdx = Math.round(ratio * (STEPS.length - 1));
  const activeStep = STEPS[activeIdx] ?? STEPS[currentIdx];

  const ratioFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return currentIdx / (STEPS.length - 1);
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const raw = (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, raw));
  };

  const commitRatio = (nextRatio: number) => {
    const idx = Math.min(
      STEPS.length - 1,
      Math.max(0, Math.round(nextRatio * (STEPS.length - 1)))
    );
    const nextEffort = STEPS[idx].id;
    if (nextEffort !== value) {
      triggerHaptic('light');
      onChange(nextEffort);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) return;
    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unsupported
    }
    setDragging(true);
    const nextRatio = ratioFromClientX(e.clientX);
    setDragRatio(nextRatio);
    commitRatio(nextRatio);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || activePointerIdRef.current !== e.pointerId) return;
    const nextRatio = ratioFromClientX(e.clientX);
    setDragRatio(nextRatio);
    commitRatio(nextRatio);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    setDragging(false);
    setDragRatio(null);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(STEPS.length - 1, currentIdx + 1);
      if (next !== currentIdx) {
        triggerHaptic('light');
        onChange(STEPS[next].id);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = Math.max(0, currentIdx - 1);
      if (prev !== currentIdx) {
        triggerHaptic('light');
        onChange(STEPS[prev].id);
      }
    }
  };

  const isOff = activeStep.id === 'off';
  const isPeak = activeStep.id === 'xhigh' || activeStep.id === 'max';
  const indicatorColor = EFFORT_INDICATOR_COLOR[activeStep.id];
  const fillColor = isOff ? 'var(--color-paper-4)' : indicatorColor;
  const badgeStyle: React.CSSProperties = isOff
    ? {}
    : {
        color: indicatorColor,
        backgroundColor: `color-mix(in oklch, ${indicatorColor} 16%, transparent)`,
      };

  const thumbSize = 26;
  const travelX = Math.max(0, (trackWidth - thumbSize) * ratio);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowX: 'hidden', paddingInline: 6, marginInline: -6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          className="drawer-label"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <motion.span
            animate={
              !active || isOff
                ? { rotate: 0, scale: 1 }
                : activeStep.id === 'xhigh'
                  ? { rotate: [0, 180, 360], scale: [1, 1.12, 1] }
                  : { rotate: [0, 12, -12, 0], scale: 1 }
            }
            transition={{
              duration: activeStep.id === 'xhigh' ? 8 : 4.2,
              repeat: active && !isOff ? Infinity : 0,
              ease: 'linear',
            }}
            style={{ display: 'inline-flex' }}
          >
            <ReasoningIcon size={16} active={!isOff} color={indicatorColor} />
          </motion.span>
          <span>{displayLabel}</span>
        </span>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={activeStep.id}
            initial={{ opacity: 0, y: -5, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.92 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="soft-badge"
            style={badgeStyle}
          >
            <span>{t.effort.steps[activeStep.id].label}</span>
            <span style={{ opacity: 0.72, fontWeight: 400 }}>
              · {t.effort.steps[activeStep.id].desc}
            </span>
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Rigel Star Interactive Slider Track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={displayLabel}
        aria-valuemin={0}
        aria-valuemax={STEPS.length - 1}
        aria-valuenow={currentIdx}
        aria-valuetext={`${t.effort.steps[activeStep.id].label} — ${t.effort.steps[activeStep.id].desc}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          height: 46,
          margin: '0 8px',
          display: 'flex',
          alignItems: 'center',
          cursor: dragging ? 'grabbing' : 'pointer',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Rail with dynamic Rigel halo */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 8,
            borderRadius: 999,
            backgroundColor: 'var(--color-paper-3)',
            overflow: 'hidden',
            boxShadow: isOff
              ? 'none'
              : `0 0 ${10 + activeIdx * 4}px color-mix(in oklch, ${indicatorColor} ${Math.round(
                  activeStep.glowOpacity * 100
                )}%, transparent)`,
            transition: 'box-shadow 260ms var(--ease-out)',
          }}
        >
          {/* GPU ScaleX Active Rigel Beam */}
          <motion.div
            className={isOff ? undefined : 'rigel-beam-fill'}
            animate={{
              scaleX: Math.max(0.03, ratio),
              backgroundColor: fillColor,
            }}
            transition={
              dragging
                ? { duration: 0 }
                : { type: 'spring', stiffness: 430, damping: 34 }
            }
            style={{
              width: '100%',
              height: '100%',
              transformOrigin: 'left center',
              borderRadius: 999,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {active && !isOff && (
              <span
                className="rigel-beam-shimmer"
                style={{
                  animationDuration:
                    activeStep.id === 'max'
                      ? '1.05s'
                      : activeStep.id === 'xhigh'
                        ? '1.4s'
                        : activeStep.id === 'high'
                          ? '2s'
                          : '2.8s',
                }}
              />
            )}
          </motion.div>
        </div>

        {/* Constellation Star Notch Nodes */}
        <div
          style={{
            position: 'absolute',
            left: 11,
            right: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {STEPS.map((step, i) => {
            const passed = i / (STEPS.length - 1) <= ratio + 0.01;
            const current = i === activeIdx;
            return (
              <motion.span
                key={step.id}
                animate={{
                  scale: current ? 1.45 : passed ? 1.1 : 0.9,
                  opacity: passed ? 0.95 : 0.45,
                }}
                transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 99,
                  backgroundColor: passed
                    ? 'var(--color-paper)'
                    : 'var(--color-muted)',
                  boxShadow:
                    passed && !isOff
                      ? `0 0 6px color-mix(in oklch, ${indicatorColor} 80%, transparent)`
                      : 'none',
                }}
              />
            );
          })}
        </div>

        {/* Rigel Supergiant Core Thumb + Diffraction Flare + Shockwave */}
        <motion.div
          animate={{
            x: travelX,
            scale: dragging ? 1.2 : 1,
          }}
          transition={
            dragging
              ? { scale: { type: 'spring', stiffness: 460, damping: 26 }, x: { duration: 0 } }
              : { type: 'spring', stiffness: 430, damping: 30 }
          }
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            y: '-50%',
            width: thumbSize,
            height: thumbSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Expanding shockwave ring on step snap */}
          {!isOff && (
              <motion.span
              key={value}
              initial={{ scale: 0.72, opacity: 0.65 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                border: `1.5px solid ${indicatorColor}`,
              }}
            />
          )}

          {/* Rotating 4-point Rigel diffraction flare (pure CSS compositor transform) */}
          <svg
            width={40}
            height={40}
            viewBox="0 0 40 40"
            fill="none"
            className="rigel-flare-svg"
            data-spinning={active && !isOff ? 'true' : 'false'}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              opacity: isOff ? 0 : activeStep.id === 'max' ? 1 : activeStep.id === 'xhigh' ? 0.9 : 0.72,
              transform: `scale(${(isOff ? 0 : activeStep.flareScale * (dragging ? 1.16 : 1)).toFixed(3)})`,
            }}
          >
            <path
              d="M20 2C20.9 15.8 24.2 19.1 38 20C24.2 20.9 20.9 24.2 20 38C19.1 24.2 15.8 20.9 2 20C15.8 19.1 19.1 15.8 20 2Z"
              fill={indicatorColor}
              fillOpacity={0.35}
            />
          </svg>

          {/* Star core orb */}
          <span
            style={{
              position: 'relative',
              width: thumbSize,
              height: thumbSize,
              borderRadius: 999,
              backgroundColor: isOff ? 'var(--color-ink-2)' : indicatorColor,
              boxShadow: dragging
                ? `0 0 0 6px color-mix(in oklch, ${indicatorColor} 28%, transparent), 0 0 18px color-mix(in oklch, ${indicatorColor} 60%, transparent), var(--shadow-pill)`
                : isOff
                  ? 'var(--shadow-pill)'
                  : `0 0 12px color-mix(in oklch, ${indicatorColor} 48%, transparent), var(--shadow-pill)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 180ms var(--ease-out), box-shadow 200ms var(--ease-out)',
            }}
          >
            <span
              style={{
                width: activeStep.id === 'max' ? 11 : activeStep.id === 'xhigh' ? 10 : 8,
                height: activeStep.id === 'max' ? 11 : activeStep.id === 'xhigh' ? 10 : 8,
                borderRadius: 999,
                backgroundColor: isPeak
                  ? 'var(--color-paper)'
                  : 'var(--color-rigel-core)',
                transition: 'width 160ms var(--ease-out), height 160ms var(--ease-out)',
              }}
            />
          </span>
        </motion.div>
      </div>

      {/* Tap-friendly step captions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 2px',
          marginTop: -4,
        }}
      >
        {STEPS.map((step) => {
          const active = step.id === activeStep.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onChange(step.id);
              }}
              style={{
                fontSize: '0.72rem',
                fontWeight: active ? 600 : 450,
                color: active ? indicatorColor : 'var(--color-muted)',
                padding: '4px 6px',
                borderRadius: 8,
                transition: 'color 150ms var(--ease-out)',
              }}
            >
              {t.effort.steps[step.id].short}
            </button>
          );
        })}
      </div>
    </div>
  );
};
