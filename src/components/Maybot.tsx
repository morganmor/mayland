import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { MaybotMood } from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';

interface MaybotProps {
  mood: MaybotMood;
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  caption?: string;
  onPoke?: () => void;
}

const SIZE_PX: Record<NonNullable<MaybotProps['size']>, number> = {
  '2xs': 24,
  xs: 34,
  sm: 44,
  md: 72,
  lg: 116,
};

const POKE_LINES = [
  'Keys stay AES-256-GCM encrypted.',
  'Ready whenever you are.',
  'Slide effort up for deeper thoughts.',
  'Tap Settings to tune model parameters.',
];

export const Maybot: React.FC<MaybotProps> = ({
  mood,
  size = 'md',
  interactive = false,
  caption,
  onPoke,
}) => {
  const px = SIZE_PX[size];
  const [hopCount, setHopCount] = useState(0);
  const [pokeLine, setPokeLine] = useState<string | null>(null);

  const handleTap = () => {
    if (!interactive) return;
    triggerHaptic('light');
    const next = hopCount + 1;
    setHopCount(next);
    setPokeLine(POKE_LINES[next % POKE_LINES.length]);
    onPoke?.();
    window.setTimeout(() => {
      setPokeLine((prev) =>
        prev === POKE_LINES[next % POKE_LINES.length] ? null : prev
      );
    }, 2200);
  };

  const effectiveMood: MaybotMood =
    pokeLine && mood === 'idle' ? 'happy' : mood;

  const isBusy =
    effectiveMood === 'decrypting' ||
    effectiveMood === 'connecting' ||
    effectiveMood === 'thinking' ||
    effectiveMood === 'streaming';

  const handAnim = (() => {
    switch (effectiveMood) {
      case 'decrypting':
        return {
          y: [0, -2.5, 0],
          rotate: [-2, 2, -2],
          transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'connecting':
        return {
          y: [0, -4, 0],
          rotate: [-1.5, 1.5, -1.5],
          transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'thinking':
        return {
          y: [-2, -6, -2],
          rotate: [1, -3, 1],
          transition: { duration: 1.7, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'streaming':
        return {
          x: [-2.5, 3, -1, 2.5, -2.5],
          y: [0, -2, 1, -1.5, 0],
          rotate: [-3, 2.5, -1.5, 2, -3],
          transition: { duration: 0.65, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'listening':
        return {
          x: -1.5,
          y: 1.5,
          rotate: -3.5,
          transition: { type: 'spring' as const, stiffness: 300, damping: 22 },
        };
      case 'happy':
        return {
          y: [0, -8, 0],
          rotate: [0, -5, 0],
          transition: { duration: 0.45 },
        };
      case 'error':
        return {
          x: [-3, 3, -2, 2, 0],
          transition: { duration: 0.4 },
        };
      default:
        return {
          y: [0, -2.2, 0],
          rotate: [-0.8, 1.1, -0.8],
          transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' as const },
        };
    }
  })();

  const accentStroke =
    effectiveMood === 'thinking'
      ? 'var(--color-thought)'
      : effectiveMood === 'error'
        ? 'var(--color-danger)'
        : effectiveMood === 'decrypting'
          ? 'var(--color-success)'
          : 'var(--color-accent)';

  const activeSpeech = caption || pokeLine;

  const svgContent = (
    <motion.svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
    >
      {/* Subtle horizon writing rule */}
      <path
        d="M12 101H70"
        stroke="var(--color-rule)"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity={0.65}
      />

      {/* Flowing Rigel-blue ink line ending at nib */}
      <motion.path
        d="M13 95C16.8 90.8 19.6 97.4 23.2 94C25.4 91.9 27.2 92.2 29.4 91.6"
        stroke={accentStroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        animate={
          effectiveMood === 'streaming'
            ? { pathLength: [0.45, 1, 0.72, 1], opacity: [0.7, 1, 0.85, 1] }
            : isBusy
              ? { opacity: [0.65, 1, 0.65] }
              : { pathLength: 1, opacity: 0.94 }
        }
        transition={{
          duration: effectiveMood === 'streaming' ? 0.9 : 1.4,
          repeat: isBusy ? Infinity : 0,
          ease: 'easeInOut',
        }}
      />

      {/* Orbiting celestial sparks during thinking / connecting */}
      {(effectiveMood === 'thinking' || effectiveMood === 'connecting') && (
        <motion.g
          style={{ originX: '60px', originY: '42px' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="42" cy="24" r="3" fill="var(--color-thought)" opacity={0.92} />
          <circle cx="80" cy="22" r="2.3" fill="var(--color-rigel-core)" opacity={0.9} />
        </motion.g>
      )}

      {/* Rigel 4-point star glint near nib */}
      <motion.g
        style={{ originX: '22px', originY: '83.5px' }}
        animate={
          effectiveMood === 'happy'
            ? { scale: [1, 1.45, 1], rotate: [0, 45, 0], opacity: [0.9, 1, 0.9] }
            : { scale: [0.92, 1.08, 0.92], opacity: [0.78, 1, 0.78] }
        }
        transition={{
          duration: effectiveMood === 'happy' ? 0.55 : 2.8,
          repeat: effectiveMood === 'happy' ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      >
        <path
          transform="translate(22 83.5)"
          d="M0 -4.8C0.55 -1.1 1.1 -0.55 4.8 0C1.1 0.55 0.55 1.1 0 4.8C-0.55 1.1 -1.1 0.55 -4.8 0C-1.1 -0.55 -0.55 -1.1 0 -4.8Z"
          fill="var(--color-rigel-core)"
        />
        <circle cx="16.2" cy="77.8" r="1.15" fill="var(--color-accent)" />
      </motion.g>

      {/* Smooth Tripod Hand & Sleek Precision Pen */}
      <motion.g
        style={{ originX: '48px', originY: '76px' }}
        animate={handAnim}
      >
        {/* Back palm & softly tucked fingers (behind pen) */}
        <path
          d="M62 49.5C70 39 87 38.5 96.2 47.5C104 55 106.5 67 101.5 77.4C99.2 82.4 95.6 85.8 91.2 87.8C88.8 92.2 82.8 93.8 78.6 90.6C75 94.2 68.4 93.8 65.2 89C60.4 89.8 54.8 87.4 53.6 83.2C52.6 79.4 55.2 76.2 59.5 75.8Z"
          fill="var(--color-paper-2)"
          stroke="var(--color-ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M78.6 90.6C79.2 87.4 82 85.4 85.5 85.2"
          stroke="var(--color-ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M65.2 89C65.8 85.8 68.4 84 72 83.8"
          stroke="var(--color-ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Wrist cuff */}
        <path
          d="M93.2 88.2L104.2 76.4L111 83C112 84 112 85.6 111 86.6L101.8 96.4C100.8 97.4 99.2 97.4 98.2 96.4Z"
          fill="var(--color-paper-3)"
          stroke="var(--color-ink)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Pen top cap / finial */}
        <path
          d="M80.5 29.3L84.4 24.9Q91.2 24.4 91.4 31.3L87.5 35.7Z"
          fill="var(--color-paper-4)"
          stroke="var(--color-ink)"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />

        {/* Metallic crown ring */}
        <path
          d="M76.9 33.4L80.5 29.3L87.5 35.7L83.9 39.8Z"
          fill="var(--color-paper-3)"
          stroke="var(--color-ink)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Pen barrel in luminous Rigel Star Blue */}
        <path
          d="M39.5 75.5L76.9 33.4L83.9 39.8L46.5 81.9Z"
          fill={effectiveMood === 'error' ? 'var(--color-danger)' : 'var(--color-accent)'}
          stroke="var(--color-ink)"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />

        {/* Crisp specular highlight along barrel */}
        <path
          d="M44.2 74.8L78.4 36.2"
          stroke="var(--color-rigel-core)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity={0.78}
        />

        {/* Subtle pen clip */}
        <path
          d="M80.2 31.4L67.6 45.6"
          stroke="var(--color-ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity={0.8}
        />

        {/* Tapered pen grip cone */}
        <path
          d="M34.2 84.4L39.5 75.5L46.5 81.9L38.2 88Z"
          fill="var(--color-paper-3)"
          stroke="var(--color-ink)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Fine fountain nib tip */}
        <path
          d="M29.4 91.6L34.2 84.4L38.2 88Z"
          fill="var(--color-ink)"
          stroke="var(--color-ink)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Arched Index Finger */}
        <path
          d="M76.2 44.8C70.4 38.2 61.5 39.5 54.4 47.4L44.2 59.2C41.8 62.1 41.5 65.5 43.7 67.3C45.9 69.1 49.4 68.1 51.8 65.2L60.8 54.8C64.2 51.1 68.2 50.4 72 52.6"
          fill="var(--color-paper-2)"
          stroke="var(--color-ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M53.2 53.4C54.6 54 55.6 55 56 56.4"
          stroke="var(--color-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity={0.45}
        />

        {/* Ergonomic Thumb wrapping across grip */}
        <path
          d="M87.5 73.2C77.8 69.2 62 66.2 50.4 67.4C45.8 67.8 44.6 73.8 49.2 75.2C59.8 78.2 73 81.2 85.4 83.2"
          fill="var(--color-paper-2)"
          stroke="var(--color-ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M66.2 70.6C66.8 72.6 66.8 74.8 66.2 76.8"
          stroke="var(--color-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity={0.45}
        />
      </motion.g>

      {/* Mini lock emblem during AES-256-GCM decryption */}
      {effectiveMood === 'decrypting' && (
        <motion.g
          animate={{ scale: [0.9, 1.12, 0.9] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          style={{ originX: '30px', originY: '30px' }}
        >
          <circle cx="30" cy="30" r="12" fill="var(--color-success-soft)" />
          <rect
            x="24.5"
            y="29"
            width="11"
            height="9"
            rx="2.5"
            fill="var(--color-success)"
          />
          <path
            d="M27 29V26.5C27 24.8 28.3 23.5 30 23.5C31.7 23.5 33 24.8 33 26.5V29"
            stroke="var(--color-success)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </motion.g>
      )}
    </motion.svg>
  );

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <AnimatePresence>
          {activeSpeech && size === 'lg' && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.94 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                padding: '6px 13px',
                borderRadius: 999,
                backgroundColor: 'var(--color-paper-2)',
                color: 'var(--color-ink-2)',
                fontSize: '0.78rem',
                fontWeight: 500,
                boxShadow: 'var(--shadow-pill)',
                whiteSpace: 'nowrap',
              }}
            >
              {activeSpeech}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {interactive ? (
        <motion.button
          type="button"
          onClick={handleTap}
          aria-label="Writing assistant — tap for a tip"
          whileTap={{ scale: 0.92, y: 1 }}
          style={{
            width: px,
            height: px,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: '50%',
          }}
        >
          {svgContent}
        </motion.button>
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: px,
            height: px,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {svgContent}
        </div>
      )}
    </div>
  );
};
