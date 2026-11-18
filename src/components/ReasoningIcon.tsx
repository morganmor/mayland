import React from 'react';
import type { ThinkingEffort } from '../types/mayland';

export const EFFORT_INDICATOR_COLOR: Record<ThinkingEffort, string> = {
  off: 'var(--color-muted)',
  low: 'var(--color-ink-2)',
  medium: 'var(--color-thought)',
  high: 'var(--color-accent)',
  xhigh: 'var(--color-rigel-halo)',
  max: 'var(--color-rigel-core)',
};

interface ReasoningIconProps {
  size?: number;
  active?: boolean;
  color?: string;
}

export const ReasoningIcon: React.FC<ReasoningIconProps> = ({
  size = 20,
  active = false,
  color,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        color,
        transition: 'color 180ms var(--ease-out)',
        flexShrink: 0,
      }}
    >
      <path
        d="M4.3 8.4A8.5 8.5 0 0 1 15.6 4.3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity={active ? 0.9 : 0.65}
      />
      <path
        d="M19.7 15.6A8.5 8.5 0 0 1 8.4 19.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity={active ? 0.9 : 0.65}
      />
      <circle
        cx="18.5"
        cy="6.5"
        r="1.35"
        fill="currentColor"
        opacity={active ? 1 : 0.7}
      />
      <circle
        cx="5.5"
        cy="17.5"
        r="1.35"
        fill="currentColor"
        opacity={active ? 1 : 0.7}
      />
      <path
        d="M12 5.8C12.6 9.6 14.4 11.4 18.2 12C14.4 12.6 12.6 14.4 12 18.2C11.4 14.4 9.6 12.6 5.8 12C9.6 11.4 11.4 9.6 12 5.8Z"
        fill="currentColor"
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
};
