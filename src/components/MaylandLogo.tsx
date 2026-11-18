import React from 'react';

interface MaylandLogoProps {
  size?: number;
  withWordmark?: boolean;
}

export const MaylandLogo: React.FC<MaylandLogoProps> = ({
  size = 28,
  withWordmark = true,
}) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <rect width="64" height="64" rx="18" fill="var(--color-paper-3)" />
        {/* Written Rigel-blue ink line */}
        <path
          d="M9 50C11.2 47.8 12.8 51.2 15 49.4C16.4 48.2 17.2 48.4 18.5 48"
          stroke="var(--color-accent)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Back palm & tucked fingers */}
        <path
          d="M34 27C38.5 21.5 46.5 21.2 51.2 26C55.2 30 56.5 36.2 54 41.8C52.5 45 49.6 47 47 47.8C45.4 50.2 41.8 50.6 39.8 48.8C37.2 50.4 33.4 49.6 31.8 46.8C29.4 47 26.8 45.6 26.5 43.2C26.2 41.2 27.8 39.6 30 39.4Z"
          fill="var(--color-paper-2)"
          stroke="var(--color-ink)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Pen cap & Rigel-blue barrel */}
        <path
          d="M42.8 16.5L45 14Q48.6 13.8 48.8 17.5L46.6 20Z"
          fill="var(--color-paper-4)"
          stroke="var(--color-ink)"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M23 40.2L42.8 16.5L46.6 20L26.8 43.6Z"
          fill="var(--color-accent)"
          stroke="var(--color-ink)"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M18.5 48L21.2 43.6L23.5 45.6Z"
          fill="var(--color-ink)"
          stroke="var(--color-ink)"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* Arched index finger */}
        <path
          d="M40.8 24.4C37.6 21 32.8 21.8 29.2 25.8L24.2 31.6C23 33.1 22.8 34.8 24 35.8C25.2 36.8 27 36.2 28.2 34.8L32.8 29.4C34.6 27.4 36.8 27 38.8 28.2"
          fill="var(--color-paper-2)"
          stroke="var(--color-ink)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Thumb */}
        <path
          d="M46.6 39C41.6 37 33.4 35.4 27.4 36C25 36.2 24.4 39.4 26.8 40.2C32.4 41.8 39.2 43.4 45.6 44.4"
          fill="var(--color-paper-2)"
          stroke="var(--color-ink)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Rigel 4-point star glint */}
        <path
          transform="translate(13.5 43.5)"
          d="M0 -3C0.35 -0.7 0.7 -0.35 3 0C0.7 0.35 0.35 0.7 0 3C-0.35 0.7 -0.7 0.35 -3 0C-0.7 -0.35 -0.35 -0.7 0 -3Z"
          fill="var(--color-rigel-core)"
        />
      </svg>
      {withWordmark && (
        <span
          style={{
            fontFamily: 'var(--font-reading)',
            fontSize: '1.18rem',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            lineHeight: 1,
          }}
        >
          Mayland
        </span>
      )}
    </span>
  );
};
