import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bookmark, Check, Save, Trash2, X } from 'lucide-react';
import { useI18n } from '../i18n';
import type { SavedSystemPrompt } from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';

interface SavedPromptsModalProps {
  open: boolean;
  savedPrompts: SavedSystemPrompt[];
  currentInstructions: string;
  onClose: () => void;
  onSavePrompt: (name: string, content: string) => void;
  onApplyPrompt: (content: string) => void;
  onDeletePrompt: (id: string) => void;
}

function formatSavedTimestamp(ts: number, lang: 'en' | 'id'): string {
  try {
    return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function derivePromptTitle(content: string, fallbackTitle: string): string {
  const firstLine =
    content
      .split(/\r?\n/)
      .map((line) => line.replace(/^#+\s*/, '').trim())
      .find(Boolean) ?? '';
  if (!firstLine) return fallbackTitle;
  return firstLine.length > 36 ? `${firstLine.slice(0, 35).trim()}…` : firstLine;
}

export const SavedPromptsModal: React.FC<SavedPromptsModalProps> = ({
  open,
  savedPrompts,
  currentInstructions,
  onClose,
  onSavePrompt,
  onApplyPrompt,
  onDeletePrompt,
}) => {
  const { language, t } = useI18n();
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setNameDraft('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const canSave = currentInstructions.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    triggerHaptic('light');
    const title =
      nameDraft.trim() || derivePromptTitle(currentInstructions, t.savedPrompts.fallbackTitle);
    onSavePrompt(title, currentInstructions);
    setNameDraft('');
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
              className="center-modal saved-prompts-modal"
              aria-label={t.savedPrompts.ariaLabel}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="provider-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <h2 className="drawer-title">{t.savedPrompts.title}</h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-muted)' }}>
                    {t.savedPrompts.subtitle}
                  </span>
                </div>
                <button
                  type="button"
                  className="ghost-icon-btn"
                  aria-label={t.savedPrompts.closeAria}
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="saved-prompts-body">
                <div className="saved-prompts-save-row">
                  <input
                    id="saved-prompt-name-input"
                    name="savedPromptName"
                    type="text"
                    className="drawer-field"
                    placeholder={
                      canSave
                        ? t.savedPrompts.namePlaceholder
                        : t.savedPrompts.writeFirstPlaceholder
                    }
                    value={nameDraft}
                    disabled={!canSave}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSave) {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    className="accent-pill-btn saved-prompt-save-btn"
                    disabled={!canSave}
                    onClick={handleSave}
                  >
                    <Save size={15} />
                    <span>{t.savedPrompts.save}</span>
                  </button>
                </div>

                <div className="saved-prompts-list">
                  {savedPrompts.length === 0 ? (
                    <div className="saved-prompts-empty">
                      <Bookmark size={22} style={{ color: 'var(--color-accent)', opacity: 0.85 }} />
                      <span style={{ fontWeight: 560, color: 'var(--color-ink-2)' }}>
                        {t.savedPrompts.emptyTitle}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                        {t.savedPrompts.emptyDesc}
                      </span>
                    </div>
                  ) : (
                    savedPrompts.map((item) => {
                      const isActive = currentInstructions === item.content;
                      return (
                        <div
                          key={item.id}
                          className="saved-prompt-card"
                          data-active={isActive ? 'true' : 'false'}
                        >
                          <div className="saved-prompt-main">
                            <div className="saved-prompt-title">{item.name}</div>
                            <p className="saved-prompt-preview">{item.content}</p>
                            <span className="saved-prompt-meta tabular-nums">
                              {formatSavedTimestamp(item.updatedAt, language)}
                            </span>
                          </div>

                          <div className="saved-prompt-actions">
                            <button
                              type="button"
                              className="tonal-pill-btn saved-prompt-apply-btn"
                              data-active={isActive ? 'true' : 'false'}
                              onClick={() => {
                                triggerHaptic('light');
                                onApplyPrompt(item.content);
                                onClose();
                              }}
                            >
                              {isActive && <Check size={14} />}
                              <span>{isActive ? t.savedPrompts.applied : t.savedPrompts.apply}</span>
                            </button>
                            <button
                              type="button"
                              className="saved-prompt-del-btn"
                              aria-label={t.savedPrompts.deleteAria(item.name)}
                              title={t.common.delete}
                              onClick={() => {
                                triggerHaptic('medium');
                                onDeletePrompt(item.id);
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.section>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
