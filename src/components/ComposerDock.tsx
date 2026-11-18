import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Braces,
  Check,
  ChevronDown,
  FileCode2,
  FileText,
  Globe,
  ImagePlus,
  Lock,
  Mic,
  MicOff,
  Paperclip,
  Play,
  Plus,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react';
import { getSearchProviderSpec } from '../adapters/searchProviders';
import { useI18n } from '../i18n';
import type {
  Attachment,
  RequestPhase,
  RunSettings,
  SearchProviderId,
  ThinkingEffort,
  VaultStatus,
} from '../types/mayland';
import { formatFileSize, processUploadedFiles } from '../utils/fileAttachments';
import { triggerHaptic } from '../utils/nativeBridge';
import { estimateTextTokens, formatTokenCount } from '../utils/tokenEstimator';
import { EffortSlider } from './EffortSlider';
import { EFFORT_INDICATOR_COLOR, ReasoningIcon } from './ReasoningIcon';

interface ComposerDockProps {
  prompt: string;
  attachments: Attachment[];
  phase: RequestPhase;
  settings: RunSettings;
  vaultStatus: VaultStatus;
  hasActiveKey: boolean;
  activeSearchProviderId: SearchProviderId;
  hasActiveSearchKey: boolean;
  liveTokPerSec?: number;
  onPromptChange: (val: string) => void;
  onAddAttachments: (items: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  onStop: () => void;
  onChangeThinking: (effort: ThinkingEffort) => void;
  onToggleWebSearch: () => void;
  onOpenModelPicker: () => void;
  onOpenVault: () => void;
  onUserTypingChange: (typing: boolean) => void;
}

export const ComposerDock: React.FC<ComposerDockProps> = ({
  prompt,
  attachments,
  phase,
  settings,
  vaultStatus,
  hasActiveKey,
  activeSearchProviderId,
  hasActiveSearchKey,
  liveTokPerSec,
  onPromptChange,
  onAddAttachments,
  onRemoveAttachment,
  onSend,
  onStop,
  onChangeThinking,
  onToggleWebSearch,
  onOpenModelPicker,
  onOpenVault,
  onUserTypingChange,
}) => {
  const { language, t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const anyFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [dictating, setDictating] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const isBusy =
    phase === 'decrypting' ||
    phase === 'connecting' ||
    phase === 'thinking' ||
    phase === 'streaming';

  useEffect(() => {
    if (isBusy) {
      setReasoningOpen(false);
      setPlusMenuOpen(false);
    }
  }, [isBusy]);

  useEffect(() => {
    if (!reasoningOpen && !plusMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReasoningOpen(false);
        setPlusMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [reasoningOpen, plusMenuOpen]);

  const handlePickedFiles = async (
    files: FileList | null,
    mode: 'any' | 'image'
  ) => {
    const items = await processUploadedFiles(files, mode);
    if (items.length > 0) {
      onAddAttachments(items);
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [prompt]);

  const toggleVoice = () => {
    if (dictating && recognitionRef.current) {
      recognitionRef.current.stop();
      setDictating(false);
      return;
    }

    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      triggerHaptic('light');
      textareaRef.current?.focus();
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = new (SpeechRecognition as any)();
      rec.lang = language === 'id' ? 'id-ID' : 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) {
          onPromptChange(prompt ? `${prompt} ${transcript}` : transcript);
        }
      };
      rec.onerror = () => setDictating(false);
      rec.onend = () => setDictating(false);
      recognitionRef.current = rec;
      rec.start();
      triggerHaptic('medium');
      setDictating(true);
    } catch {
      setDictating(false);
    }
  };

  const canSend =
    (prompt.trim().length > 0 || attachments.length > 0) && !isBusy;

  const modelShort = settings.model.includes('/')
    ? settings.model.split('/').pop() ?? settings.model
    : settings.model;

  const searchProviderName = getSearchProviderSpec(activeSearchProviderId).name;
  const webSearchActive = Boolean((settings.webSearchEnabled ?? true) && hasActiveSearchKey);

  return (
    <div className="composer-dock">
      <div className="composer-inner">
        <div className="composer-card">
          <input
            ref={anyFileInputRef}
            type="file"
            accept="*/*"
            multiple
            hidden
            onChange={async (e) => {
              const files = e.target.files;
              await handlePickedFiles(files, 'any');
              e.target.value = '';
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={async (e) => {
              const files = e.target.files;
              await handlePickedFiles(files, 'image');
              e.target.value = '';
            }}
          />

          {plusMenuOpen && (
            <>
              <div
                className="reasoning-popover-backdrop"
                aria-hidden="true"
                onClick={() => setPlusMenuOpen(false)}
              />
              <div
                role="menu"
                aria-label={t.composer.plusMenuAria}
                className="plus-popover"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="plus-popover-item"
                  onClick={() => {
                    triggerHaptic('light');
                    setPlusMenuOpen(false);
                    anyFileInputRef.current?.click();
                  }}
                >
                  <span className="plus-popover-item-main">
                    <Paperclip size={16} strokeWidth={1.9} />
                    <span>{t.composer.uploadFiles}</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="plus-popover-item"
                  onClick={() => {
                    triggerHaptic('light');
                    setPlusMenuOpen(false);
                    imageInputRef.current?.click();
                  }}
                >
                  <span className="plus-popover-item-main">
                    <ImagePlus size={16} strokeWidth={1.9} />
                    <span>{t.composer.uploadImage}</span>
                  </span>
                </button>

                <div className="plus-popover-divider" role="separator" />

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={webSearchActive}
                  className="plus-popover-item"
                  onClick={() => {
                    triggerHaptic('light');
                    setPlusMenuOpen(false);
                    onToggleWebSearch();
                  }}
                >
                  <span className="plus-popover-item-main">
                    <Globe
                      size={16}
                      strokeWidth={1.9}
                      style={{
                        color: webSearchActive ? 'var(--color-accent)' : 'inherit',
                      }}
                    />
                    <span>{t.composer.webSearch}</span>
                  </span>
                  {webSearchActive && (
                    <Check
                      size={15}
                      strokeWidth={2.3}
                      style={{ color: 'var(--color-accent)', flexShrink: 0 }}
                    />
                  )}
                </button>
              </div>
            </>
          )}

          {reasoningOpen && (
            <>
              <div
                className="reasoning-popover-backdrop"
                aria-hidden="true"
                onClick={() => setReasoningOpen(false)}
              />
              <div
                role="dialog"
                aria-label={t.composer.reasoningDialogAria}
                className="reasoning-popover"
              >
                <EffortSlider
                  value={settings.thinkingEffort}
                  onChange={onChangeThinking}
                  label={t.effort.defaultLabel}
                />
              </div>
            </>
          )}

          {attachments.length > 0 && (
            <div className="composer-attachments">
              {attachments.map((att) => {
                const tokCount =
                  att.kind === 'image'
                    ? 256
                    : att.kind === 'text' && att.textContent
                      ? estimateTextTokens(att.textContent)
                      : 0;
                return (
                  <motion.div
                    key={att.id}
                    className="composer-att-chip"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    {att.kind === 'image' && att.dataUrl ? (
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="composer-att-thumb"
                      />
                    ) : att.kind === 'file' ? (
                      <FileText size={15} style={{ flexShrink: 0 }} />
                    ) : (
                      <FileCode2 size={15} style={{ flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {att.name}
                      {tokCount > 0
                        ? ` · ${formatTokenCount(tokCount)} ${t.composer.tokSuffix}`
                        : att.kind === 'file' && att.size > 0
                          ? ` · ${formatFileSize(att.size)}`
                          : ''}
                    </span>
                    <button
                      type="button"
                      aria-label={t.composer.removeAttAria(att.name)}
                      onClick={() => onRemoveAttachment(att.id)}
                      style={{
                        display: 'inline-flex',
                        padding: 2,
                        color: 'var(--color-muted)',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          <textarea
            id="composer-prompt"
            name="prompt"
            ref={textareaRef}
            rows={1}
            className="composer-textarea"
            value={prompt}
            placeholder={t.composer.promptPlaceholder}
            onChange={(e) => {
              onPromptChange(e.target.value);
              onUserTypingChange(e.target.value.trim().length > 0);
            }}
            onFocus={() => onUserTypingChange(true)}
            onBlur={() => onUserTypingChange(false)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                const el = e.currentTarget;
                const start = el.selectionStart ?? prompt.length;
                const end = el.selectionEnd ?? start;
                const next = `${prompt.slice(0, start)}\n${prompt.slice(end)}`;
                onPromptChange(next);
                onUserTypingChange(next.trim().length > 0);
                requestAnimationFrame(() => {
                  if (textareaRef.current) {
                    const pos = start + 1;
                    textareaRef.current.selectionStart = pos;
                    textareaRef.current.selectionEnd = pos;
                  }
                });
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
          />

          <div className="composer-controls-row">
            <div className="composer-left-actions">
              <motion.button
                type="button"
                className="ghost-icon-btn"
                aria-label={t.composer.plusBtnAria}
                aria-expanded={plusMenuOpen}
                aria-haspopup="menu"
                whileTap={{ scale: 0.88 }}
                animate={{ rotate: plusMenuOpen ? 45 : 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => {
                  triggerHaptic('light');
                  setReasoningOpen(false);
                  setPlusMenuOpen((v) => !v);
                }}
              >
                <Plus size={20} strokeWidth={1.9} />
              </motion.button>

              <motion.button
                type="button"
                className="ghost-icon-btn"
                whileTap={{ scale: 0.9 }}
                aria-label={t.composer.reasoningAria(
                  t.effort.steps[settings.thinkingEffort].short
                )}
                title={t.composer.reasoningTitle(
                  t.effort.steps[settings.thinkingEffort].short
                )}
                aria-expanded={reasoningOpen}
                aria-haspopup="dialog"
                style={{ color: EFFORT_INDICATOR_COLOR[settings.thinkingEffort] }}
                onClick={() => {
                  triggerHaptic('light');
                  setPlusMenuOpen(false);
                  setReasoningOpen((v) => !v);
                }}
              >
                <ReasoningIcon
                  size={20}
                  active={settings.thinkingEffort !== 'off'}
                  color={EFFORT_INDICATOR_COLOR[settings.thinkingEffort]}
                />
              </motion.button>

              {settings.jsonMode && (
                <span
                  className="composer-status-indicator"
                  role="img"
                  aria-label={t.composer.jsonActiveLabel}
                  title={t.composer.jsonActiveLabel}
                >
                  <Braces size={16} strokeWidth={2} />
                </span>
              )}

              {webSearchActive && (
                <span
                  className="composer-status-indicator"
                  role="img"
                  aria-label={t.composer.webSearchActiveLabel(searchProviderName)}
                  title={t.composer.webSearchActiveLabel(searchProviderName)}
                >
                  <Globe size={16} strokeWidth={2} />
                </span>
              )}
            </div>

            <div className="composer-right-actions">
              <motion.button
                type="button"
                className="ghost-icon-btn"
                aria-label={
                  dictating ? t.composer.voiceStopAria : t.composer.voiceStartAria
                }
                whileTap={{ scale: 0.9 }}
                animate={
                  dictating
                    ? { scale: [1, 1.12, 1], color: 'var(--color-accent)' }
                    : { scale: 1 }
                }
                transition={{ duration: 0.9, repeat: dictating ? Infinity : 0 }}
                onClick={toggleVoice}
              >
                {dictating ? <MicOff size={19} /> : <Mic size={19} strokeWidth={1.85} />}
              </motion.button>

              {isBusy ? (
                <motion.button
                  type="button"
                  className="tonal-pill-btn"
                  whileTap={{ scale: 0.93 }}
                  style={{
                    backgroundColor: 'var(--color-paper-3)',
                    color: 'var(--color-ink)',
                    minHeight: 42,
                    padding: '0 16px',
                  }}
                  onClick={() => {
                    triggerHaptic('medium');
                    onStop();
                  }}
                >
                  <Square size={14} fill="currentColor" />
                  <span>{t.composer.stop}</span>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  className="accent-pill-btn"
                  disabled={!canSend}
                  whileTap={canSend ? { scale: 0.93 } : undefined}
                  onClick={() => {
                    triggerHaptic('medium');
                    onSend();
                  }}
                >
                  <span>{t.composer.run}</span>
                  <Play size={14} fill="currentColor" />
                </motion.button>
              )}
            </div>
          </div>
        </div>

        <div className="composer-footer-meta">
          <button
            type="button"
            className="footer-meta-btn"
            onClick={() => {
              triggerHaptic('light');
              setReasoningOpen(false);
              setPlusMenuOpen(false);
              onOpenVault();
            }}
          >
            {vaultStatus.pinEnabled && !vaultStatus.unlocked ? (
              <Lock size={13} style={{ color: 'var(--color-warn)', flexShrink: 0 }} />
            ) : (
              <ShieldCheck
                size={13}
                style={{
                  color: hasActiveKey ? 'var(--color-success)' : 'var(--color-muted)',
                  flexShrink: 0,
                }}
              />
            )}
            <span>
              {vaultStatus.pinEnabled && !vaultStatus.unlocked
                ? t.composer.vaultLocked
                : hasActiveKey
                  ? t.composer.encrypted
                  : t.composer.setApiKey}
            </span>
          </button>

          <button
            type="button"
            className="footer-meta-btn"
            style={{ color: 'var(--color-ink-2)', fontWeight: 500 }}
            onClick={() => {
              triggerHaptic('light');
              setReasoningOpen(false);
              setPlusMenuOpen(false);
              onOpenModelPicker();
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {modelShort || t.composer.setModel} ·{' '}
              {t.effort.steps[settings.thinkingEffort].short}
              {(phase === 'streaming' || phase === 'thinking') && liveTokPerSec !== undefined
                ? ` · ${liveTokPerSec} tok/s`
                : ''}
            </span>
            <ChevronDown size={13} style={{ flexShrink: 0 }} />
          </button>
        </div>
      </div>
    </div>
  );
};
