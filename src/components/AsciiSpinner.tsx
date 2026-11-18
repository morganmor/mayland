import React, { useEffect, useState } from 'react';

interface AsciiSpinnerProps {
  mode?: 'glow' | 'frames';
  label?: string;
  className?: string;
}

// Smooth 14-frame pure-ASCII density wave (fixed 5ch width, zero jitter)
const GLOW_FRAMES = [
  '.....',
  ':....',
  '|:...',
  '.|:..',
  '..|:.',
  '...:|',
  '....:',
  '.....',
  '....:',
  '...:|',
  '..|:.',
  '.|:..',
  '|:...',
  ':....',
];

const SMOOTH_FRAMES = ['|', '/', '-', '\\'];

const FRAME_SETS: Record<NonNullable<AsciiSpinnerProps['mode']>, string[]> = {
  glow: GLOW_FRAMES,
  frames: SMOOTH_FRAMES,
};

export const AsciiSpinner: React.FC<AsciiSpinnerProps> = ({
  mode = 'glow',
  label,
  className,
}) => {
  const frames = FRAME_SETS[mode];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const timer = window.setInterval(
      () => {
        setFrameIndex((prev) => (prev + 1) % frames.length);
      },
      mode === 'glow' ? 75 : 95
    );

    return () => window.clearInterval(timer);
  }, [frames.length, mode]);

  return (
    <span
      className={className ? `ascii-loader ${className}` : 'ascii-loader'}
      aria-hidden={label ? undefined : true}
    >
      <span className="ascii-glyph">{frames[frameIndex % frames.length]}</span>
      {label ? <span className="ascii-label"> {label}</span> : null}
    </span>
  );
};
