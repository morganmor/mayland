import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { triggerHaptic } from '../utils/nativeBridge';
import { AsciiSpinner } from './AsciiSpinner';
import { Maybot } from './Maybot';

interface ThoughtsAccordionProps {
  thinking: string;
  isStreamingThinking?: boolean;
  durationMs?: number;
}

export const ThoughtsAccordion: React.FC<ThoughtsAccordionProps> = ({
  thinking,
  isStreamingThinking = false,
  durationMs,
}) => {
  const [open, setOpen] = useState(false);

  if (!thinking.trim() && !isStreamingThinking) return null;

  const durationSec = durationMs
    ? (durationMs / 1000).toFixed(1)
    : null;

  return (
    <div className="thoughts-shell">
      <button
        type="button"
        className="thoughts-trigger"
        aria-expanded={open}
        onClick={() => {
          triggerHaptic('light');
          setOpen((v) => !v);
        }}
      >
        <div className="thoughts-trigger-left">
          <span className="thoughts-hand-badge" aria-hidden="true">
            <Maybot mood={isStreamingThinking ? 'thinking' : 'idle'} size="2xs" />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="thoughts-title">
              {isStreamingThinking
                ? 'Thoughts · Thinking'
                : durationSec
                  ? `Thoughts · ${durationSec}s`
                  : 'Thoughts'}
            </span>
            {!open && (
              <span className="thoughts-sub">
                {isStreamingThinking ? (
                  <AsciiSpinner mode="glow" label="Streaming reasoning trace" />
                ) : (
                  'Expand to view model thoughts'
                )}
              </span>
            )}
          </div>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'inline-flex', color: 'var(--color-muted)' }}
        >
          <ChevronDown size={18} strokeWidth={1.85} />
        </motion.span>
      </button>

      <div className="thoughts-grid" data-open={open ? 'true' : 'false'}>
        <div className="thoughts-inner">
          <div className="thoughts-body">
            {thinking.trim() ? (
              <>
                {thinking.trim()}
                {isStreamingThinking ? (
                  <span className="ascii-cursor" aria-hidden="true">_</span>
                ) : null}
              </>
            ) : (
              <AsciiSpinner mode="glow" label="Streaming reasoning trace" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
