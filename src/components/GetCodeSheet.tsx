import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, X } from 'lucide-react';
import { generateCodeSnippet } from '../adapters/openaiCompatible';
import { useI18n } from '../i18n';
import type { ChatMessage, ProviderProfile, RunSettings } from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';

interface GetCodeSheetProps {
  open: boolean;
  profile: ProviderProfile;
  settings: RunSettings;
  history: ChatMessage[];
  onClose: () => void;
}

export const GetCodeSheet: React.FC<GetCodeSheetProps> = ({
  open,
  profile,
  settings,
  history,
  onClose,
}) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'curl' | 'fetch'>('curl');
  const [copied, setCopied] = useState(false);

  const code = generateCodeSnippet(profile, settings, history, tab);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      triggerHaptic('light');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="center-modal-wrap">
            <motion.section
              className="center-modal"
              aria-label={t.getCode.ariaLabel}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="drawer-header" style={{ paddingTop: 14 }}>
                <h2 className="drawer-title">{t.getCode.title}</h2>
                <button
                  type="button"
                  className="ghost-icon-btn"
                  aria-label={t.getCode.closeAria}
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>

            <div className="sheet-scroll">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['curl', 'fetch'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="tonal-pill-btn"
                      style={{
                        backgroundColor:
                          tab === k ? 'var(--color-accent-soft)' : 'var(--color-paper-3)',
                        color: tab === k ? 'var(--color-accent)' : 'var(--color-ink)',
                      }}
                      onClick={() => setTab(k)}
                    >
                      {k === 'curl' ? 'cURL' : 'JavaScript fetch'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="tonal-pill-btn"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={15} style={{ color: 'var(--color-success)' }} /> : <Copy size={15} />}
                  <span>{copied ? t.getCode.copied : t.getCode.copyCode}</span>
                </button>
              </div>

              <div className="code-block-shell">
                <div className="code-block-head">
                  <span>{t.getCode.redactedNote}</span>
                </div>
                <pre className="code-block-pre">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
            </motion.section>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
