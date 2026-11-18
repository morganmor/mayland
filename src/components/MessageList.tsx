import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  Check,
  Copy,
  FileCode2,
  FileText,
  GitBranch,
  KeyRound,
  Pencil,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import type {
  ChatMessage,
  MaybotMood,
  ProviderProfile,
  RequestPhase,
} from '../types/mayland';
import { splitMarkdownBlocks } from '../utils/markdownChunks';
import { formatTimeShort, formatTokenCount } from '../utils/tokenEstimator';
import { triggerHaptic } from '../utils/nativeBridge';
import { useI18n } from '../i18n';
import { AsciiSpinner } from './AsciiSpinner';
import { Maybot } from './Maybot';
import { ThoughtsAccordion } from './ThoughtsAccordion';
import { TurnTimelineRail } from './TurnTimelineRail';

const VISIBLE_TURN_WINDOW = 20;
const REMARK_PLUGINS = [remarkGfm];

interface MessageListProps {
  messages: ChatMessage[];
  phase: RequestPhase;
  activeMood: MaybotMood;
  activeProfile: ProviderProfile;
  hasActiveKey: boolean;
  proseFont: 'editorial' | 'clean';
  autoScroll: boolean;
  onStarterSelect: (prompt: string) => void;
  onOpenVault: () => void;
  onOpenSettings: () => void;
  onRetryMessage: (assistantMsgId: string) => void;
  onEditMessage: (msgId: string, nextContent: string) => void;
  onDeleteMessage: (msgId: string) => void;
  onDeleteThinking: (assistantMsgId: string) => void;
  onBranchMessage: (msgId: string) => void;
  onFeedback: (msgId: string, vote: 'up' | 'down') => void;
}

const CodeFence: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({ className, children }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const raw = String(children ?? '').replace(/\n$/, '');
  const langMatch = /language-([\w-]+)/.exec(className ?? '');
  const isMultiline = raw.includes('\n') || Boolean(langMatch);

  if (!isMultiline) {
    return <code>{children}</code>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      triggerHaptic('light');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="code-block-shell">
      <div className="code-block-head">
        <span>{langMatch ? langMatch[1] : 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.75rem',
            color: copied ? 'var(--color-success)' : 'var(--color-ink-2)',
            minHeight: 28,
            padding: '0 6px',
            borderRadius: 8,
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? t.common.copied : t.common.copy}</span>
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{raw}</code>
      </pre>
    </div>
  );
};

const MARKDOWN_COMPONENTS: Components = {
  code: CodeFence as Components['code'],
};

const MarkdownChunk = React.memo<{ text: string }>(({ text }) => (
  <div className="prose-chunk">
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      components={MARKDOWN_COMPONENTS}
    >
      {text}
    </ReactMarkdown>
  </div>
));
MarkdownChunk.displayName = 'MarkdownChunk';

const ChunkedMarkdown = React.memo<{ content: string }>(({ content }) => {
  const chunks = useMemo(() => splitMarkdownBlocks(content, 2), [content]);
  return (
    <>
      {chunks.map((chunk, idx) => (
        <MarkdownChunk key={idx} text={chunk} />
      ))}
    </>
  );
});
ChunkedMarkdown.displayName = 'ChunkedMarkdown';

interface EditingState {
  id: string;
  kind: 'user' | 'output';
  draft: string;
}

interface MessageRowProps {
  msg: ChatMessage;
  isStreamingThis: boolean;
  streamingPhase: RequestPhase | null;
  proseFont: 'editorial' | 'clean';
  copied: boolean;
  editingDraft: EditingState | null;
  onRegisterNode: (id: string, el: HTMLDivElement | null) => void;
  onCopy: (msg: ChatMessage) => void;
  onStartEdit: (id: string, kind: 'user' | 'output', initial: string) => void;
  onUpdateDraft: (draft: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, nextContent: string) => void;
  onRetryMessage: (assistantMsgId: string) => void;
  onDeleteMessage: (msgId: string) => void;
  onDeleteThinking: (assistantMsgId: string) => void;
  onBranchMessage: (msgId: string) => void;
  onOpenVault: () => void;
  onFeedback: (msgId: string, vote: 'up' | 'down') => void;
}

const MessageRow = React.memo<MessageRowProps>(
  ({
    msg,
    isStreamingThis,
    streamingPhase,
    proseFont,
    copied,
    editingDraft,
    onRegisterNode,
    onCopy,
    onStartEdit,
    onUpdateDraft,
    onCancelEdit,
    onSaveEdit,
    onRetryMessage,
    onDeleteMessage,
    onDeleteThinking,
    onBranchMessage,
    onOpenVault,
    onFeedback,
  }) => {
    const { t } = useI18n();
    const setNodeRef = useCallback(
      (el: HTMLElement | null) => {
        onRegisterNode(msg.id, el as HTMLDivElement | null);
      },
      [msg.id, onRegisterNode]
    );

    const activePhase = streamingPhase ?? 'idle';

    return (
      <article ref={setNodeRef} className="turn-block">
        {msg.role === 'user' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 4,
            }}
          >
            <div className="turn-meta">
              <span className="turn-role-label">{t.messages.you}</span>
              <span className="tabular-nums">{formatTimeShort(msg.createdAt)}</span>
            </div>

            {msg.attachments && msg.attachments.length > 0 && (
              <div className="user-attachments">
                {msg.attachments.map((att) =>
                  att.kind === 'image' && att.dataUrl ? (
                    <img
                      key={att.id}
                      src={att.dataUrl}
                      alt={att.name}
                      className="user-attachment-thumb"
                    />
                  ) : (
                    <span key={att.id} className="user-attachment-file">
                      {att.kind === 'file' ? <FileText size={14} /> : <FileCode2 size={14} />}
                      <span>{att.name}</span>
                    </span>
                  )
                )}
              </div>
            )}

            {editingDraft?.kind === 'user' ? (
              <div className="turn-edit-box turn-edit-box--user">
                <textarea
                  className="turn-edit-textarea"
                  aria-label={t.messages.editUserPromptAria}
                  rows={3}
                  value={editingDraft.draft}
                  onChange={(e) => onUpdateDraft(e.target.value)}
                />
                <div className="turn-edit-footer">
                  <button
                    type="button"
                    className="turn-action-btn"
                    onClick={onCancelEdit}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    className="turn-edit-save-btn"
                    onClick={() => {
                      if (editingDraft.draft.trim()) {
                        onSaveEdit(msg.id, editingDraft.draft.trim());
                      }
                      onCancelEdit();
                    }}
                  >
                    {t.common.save}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {msg.content && <div className="user-bubble">{msg.content}</div>}

                <div
                  className="turn-actions turn-actions--user"
                  aria-label={t.messages.userPromptActionsAria}
                >
                  {msg.content && (
                    <motion.button
                      type="button"
                      className="turn-action-btn turn-action-btn--sm"
                      whileTap={{ scale: 0.92 }}
                      aria-label={t.messages.copyPrompt}
                      title={t.messages.copyPrompt}
                      onClick={() => onCopy(msg)}
                    >
                      {copied ? (
                        <Check size={13} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <Copy size={13} />
                      )}
                      <span>{copied ? t.common.copied : t.common.copy}</span>
                    </motion.button>
                  )}

                  <motion.button
                    type="button"
                    className="turn-action-btn turn-action-btn--sm"
                    whileTap={{ scale: 0.92 }}
                    aria-label={t.messages.editPrompt}
                    title={t.messages.editPrompt}
                    onClick={() => {
                      triggerHaptic('light');
                      onStartEdit(msg.id, 'user', msg.content);
                    }}
                  >
                    <Pencil size={13} />
                    <span>{t.common.edit}</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    className="turn-action-btn turn-action-btn--sm"
                    data-tone="danger"
                    whileTap={{ scale: 0.92 }}
                    aria-label={t.messages.deletePrompt}
                    title={t.messages.deletePrompt}
                    onClick={() => {
                      triggerHaptic('medium');
                      onDeleteMessage(msg.id);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{t.common.delete}</span>
                  </motion.button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="turn-meta">
              <span className="turn-role-label">{t.messages.model}</span>
              <span>•</span>
              <span className="tabular-nums">{formatTimeShort(msg.createdAt)}</span>
              {msg.metrics && (
                <>
                  <span>•</span>
                  <span className="tabular-nums">
                    {formatTokenCount(msg.metrics.totalTokens)} {t.composer.tokSuffix}
                    {msg.metrics.tokPerSec ? ` · ${msg.metrics.tokPerSec}/s` : ''}
                  </span>
                </>
              )}
            </div>

            <ThoughtsAccordion
              thinking={msg.thinking ?? ''}
              isStreamingThinking={isStreamingThis && activePhase === 'thinking'}
              durationMs={msg.thinkingDurationMs}
            />

            {!isStreamingThis && Boolean(msg.thinking?.trim()) && (
              <div className="turn-actions" aria-label={t.messages.reasoningActionsAria}>
                <motion.button
                  type="button"
                  className="turn-action-btn turn-action-btn--sm"
                  whileTap={{ scale: 0.92 }}
                  aria-label={t.messages.regenerateReasoningAria}
                  title={t.messages.regenerate}
                  onClick={() => {
                    triggerHaptic('light');
                    onRetryMessage(msg.id);
                  }}
                >
                  <RefreshCw size={13} />
                  <span>{t.messages.regenerate}</span>
                </motion.button>

                <motion.button
                  type="button"
                  className="turn-action-btn turn-action-btn--sm"
                  data-tone="danger"
                  whileTap={{ scale: 0.92 }}
                  aria-label={t.messages.deleteReasoningAria}
                  title={t.common.delete}
                  onClick={() => {
                    triggerHaptic('medium');
                    onDeleteThinking(msg.id);
                  }}
                >
                  <Trash2 size={13} />
                  <span>{t.common.delete}</span>
                </motion.button>
              </div>
            )}

            {msg.error ? (
              <div
                style={{
                  padding: '12px 15px',
                  borderRadius: 18,
                  backgroundColor: 'var(--color-danger-soft)',
                  color: 'var(--color-ink)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    fontSize: '0.92rem',
                    lineHeight: 1.5,
                  }}
                >
                  <AlertCircle
                    size={18}
                    style={{
                      color: 'var(--color-danger)',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <span>{msg.error}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    onClick={() => onRetryMessage(msg.id)}
                  >
                    <RefreshCw size={15} />
                    <span>{t.common.retry}</span>
                  </button>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    onClick={onOpenVault}
                  >
                    <KeyRound size={15} />
                    <span>{t.messages.checkApiKeyEndpoint}</span>
                  </button>
                </div>
              </div>
            ) : editingDraft?.kind === 'output' ? (
              <div className="turn-edit-box">
                <textarea
                  className="turn-edit-textarea"
                  aria-label={t.messages.editModelOutputAria}
                  rows={5}
                  value={editingDraft.draft}
                  onChange={(e) => onUpdateDraft(e.target.value)}
                />
                <div className="turn-edit-footer">
                  <button
                    type="button"
                    className="turn-action-btn"
                    onClick={onCancelEdit}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    className="turn-edit-save-btn"
                    onClick={() => {
                      onSaveEdit(msg.id, editingDraft.draft);
                      onCancelEdit();
                    }}
                  >
                    {t.common.save}
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose-body" data-prose-font={proseFont}>
                {msg.content ? (
                  <ChunkedMarkdown content={msg.content} />
                ) : isStreamingThis && activePhase !== 'thinking' ? (
                  <span className="ascii-wait-line">
                    <AsciiSpinner
                      mode="glow"
                      label={
                        activePhase === 'decrypting'
                          ? t.messages.decryptingKey
                          : activePhase === 'connecting'
                            ? t.messages.connecting
                            : t.messages.preparingResponse
                      }
                    />
                  </span>
                ) : null}
              </div>
            )}

            {!isStreamingThis && (msg.content || msg.error) && (
              <div className="turn-actions" aria-label={t.messages.modelOutputActionsAria}>
                {msg.content && (
                  <motion.button
                    type="button"
                    className="turn-action-btn turn-action-btn--sm"
                    whileTap={{ scale: 0.9 }}
                    aria-label={t.messages.copyResponse}
                    title={t.messages.copyResponse}
                    onClick={() => onCopy(msg)}
                  >
                    {copied ? (
                      <Check size={13} style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>{copied ? t.common.copied : t.common.copy}</span>
                  </motion.button>
                )}

                {msg.content && !msg.error && (
                  <motion.button
                    type="button"
                    className="turn-action-btn turn-action-btn--sm"
                    whileTap={{ scale: 0.9 }}
                    aria-label={t.messages.editResponse}
                    title={t.messages.editResponse}
                    onClick={() => {
                      triggerHaptic('light');
                      onStartEdit(msg.id, 'output', msg.content);
                    }}
                  >
                    <Pencil size={13} />
                    <span>{t.common.edit}</span>
                  </motion.button>
                )}

                <motion.button
                  type="button"
                  className="turn-action-btn turn-action-btn--sm"
                  whileTap={{ scale: 0.9 }}
                  aria-label={t.messages.regenerateResponse}
                  title={t.messages.regenerateResponse}
                  onClick={() => {
                    triggerHaptic('light');
                    onRetryMessage(msg.id);
                  }}
                >
                  <RefreshCw size={13} />
                  <span>{t.messages.regenerate}</span>
                </motion.button>

                {msg.content && (
                  <motion.button
                    type="button"
                    className="turn-action-btn turn-action-btn--sm"
                    whileTap={{ scale: 0.9 }}
                    aria-label={t.messages.branchConversation}
                    title={t.messages.branchConversation}
                    onClick={() => {
                      triggerHaptic('light');
                      onBranchMessage(msg.id);
                    }}
                  >
                    <GitBranch size={13} />
                    <span>{t.messages.branch}</span>
                  </motion.button>
                )}

                <motion.button
                  type="button"
                  className="turn-action-btn turn-action-btn--sm"
                  data-tone="danger"
                  whileTap={{ scale: 0.9 }}
                  aria-label={t.messages.deleteResponse}
                  title={t.messages.deleteResponse}
                  onClick={() => {
                    triggerHaptic('medium');
                    onDeleteMessage(msg.id);
                  }}
                >
                  <Trash2 size={13} />
                  <span>{t.common.delete}</span>
                </motion.button>

                {msg.content && !msg.error && (
                  <>
                    <motion.button
                      type="button"
                      className="turn-action-btn turn-action-btn--icon"
                      data-active={msg.feedback === 'up' ? 'true' : 'false'}
                      whileTap={{ scale: 0.9 }}
                      aria-label={t.messages.goodResponse}
                      title={t.messages.goodResponse}
                      onClick={() => {
                        triggerHaptic('light');
                        onFeedback(msg.id, 'up');
                      }}
                    >
                      <ThumbsUp size={14} />
                    </motion.button>

                    <motion.button
                      type="button"
                      className="turn-action-btn turn-action-btn--icon"
                      data-active={msg.feedback === 'down' ? 'true' : 'false'}
                      whileTap={{ scale: 0.9 }}
                      aria-label={t.messages.badResponse}
                      title={t.messages.badResponse}
                      onClick={() => {
                        triggerHaptic('light');
                        onFeedback(msg.id, 'down');
                      }}
                    >
                      <ThumbsDown size={14} />
                    </motion.button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </article>
    );
  }
);
MessageRow.displayName = 'MessageRow';

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  phase,
  activeMood,
  activeProfile,
  hasActiveKey,
  proseFont,
  autoScroll,
  onStarterSelect,
  onOpenVault,
  onOpenSettings,
  onRetryMessage,
  onEditMessage,
  onDeleteMessage,
  onDeleteThinking,
  onBranchMessage,
  onFeedback,
}) => {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRafRef = useRef<number>(0);
  const followRafRef = useRef<number>(0);
  const pendingJumpRef = useRef<string | null>(null);
  const prependAnchorRef = useRef<{ node: HTMLElement; dist: number } | null>(null);
  const prependObserverRef = useRef<ResizeObserver | null>(null);
  const prependTimerRef = useRef<number>(0);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_TURN_WINDOW);
  const userScrolledUpRef = useRef(false);

  const firstMsgId = messages[0]?.id ?? '';
  useEffect(() => {
    setVisibleCount(VISIBLE_TURN_WINDOW);
  }, [firstMsgId]);

  const visibleStart = Math.max(0, messages.length - visibleCount);
  const visibleMessages = useMemo(
    () => (visibleStart > 0 ? messages.slice(visibleStart) : messages),
    [messages, visibleStart]
  );

  const releasePrependAnchor = useCallback(() => {
    prependObserverRef.current?.disconnect();
    prependObserverRef.current = null;
    prependAnchorRef.current = null;
    if (prependTimerRef.current) {
      window.clearTimeout(prependTimerRef.current);
      prependTimerRef.current = 0;
    }
  }, []);

  const applyPrependAnchor = useCallback(() => {
    const el = scrollRef.current;
    const pin = prependAnchorRef.current;
    if (!el || !pin) return;
    // Positive delta means the pinned message slid down the viewport, so the
    // scroll offset has to advance by the same amount to hold it in place.
    const delta = pin.node.getBoundingClientRect().top - el.getBoundingClientRect().top - pin.dist;
    if (Math.abs(delta) < 0.5) return;
    // .chat-scroll declares scroll-behavior: smooth, which would animate the
    // correction and race the insert; this adjustment must be instant.
    const previousBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = 'auto';
    void el.offsetHeight;
    el.scrollTop += delta;
    el.style.scrollBehavior = previousBehavior;
  }, []);

  // Earlier turns are inserted above the viewport, so the visible message would
  // otherwise be pushed down (measured CLS 0.33 before). Pin the first rendered
  // message to its viewport position and hold it until the new rows settle.
  const handleShowEarlier = useCallback(() => {
    const el = scrollRef.current;
    const anchorMessage = visibleMessages[0];
    const node = anchorMessage ? msgRefs.current[anchorMessage.id] : null;
    if (el && node) {
      releasePrependAnchor();
      prependAnchorRef.current = {
        node,
        dist: node.getBoundingClientRect().top - el.getBoundingClientRect().top,
      };
      const content = el.firstElementChild ?? el;
      prependObserverRef.current = new ResizeObserver(() => applyPrependAnchor());
      prependObserverRef.current.observe(content);
      const stop = () => releasePrependAnchor();
      el.addEventListener('wheel', stop, { passive: true, once: true });
      el.addEventListener('touchstart', stop, { passive: true, once: true });
      prependTimerRef.current = window.setTimeout(stop, 1600);
    }
    userScrolledUpRef.current = true;
    setVisibleCount((c) => c + VISIBLE_TURN_WINDOW);
  }, [applyPrependAnchor, releasePrependAnchor, visibleMessages]);

  useLayoutEffect(() => {
    applyPrependAnchor();
  }, [visibleCount, applyPrependAnchor]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    userScrolledUpRef.current = false;
    if (behavior === 'auto') {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, []);

  const isBusy =
    phase === 'decrypting' ||
    phase === 'connecting' ||
    phase === 'thinking' ||
    phase === 'streaming';

  useEffect(() => {
    if (isBusy) {
      setEditing(null);
    }
  }, [isBusy]);

  const lastMessage = messages[messages.length - 1];
  const lastContentLen = lastMessage?.content.length ?? 0;
  const lastThinkingLen = lastMessage?.thinking?.length ?? 0;

  useEffect(() => {
    if (!autoScroll || userScrolledUpRef.current) return;
    if (followRafRef.current) return;
    followRafRef.current = requestAnimationFrame(() => {
      followRafRef.current = 0;
      if (!userScrolledUpRef.current) {
        scrollToBottom('auto');
      }
    });
  }, [autoScroll, messages.length, lastContentLen, lastThinkingLen, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
      prependObserverRef.current?.disconnect();
      if (prependTimerRef.current) window.clearTimeout(prependTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const targetId = pendingJumpRef.current;
    if (!targetId) return;
    const node = msgRefs.current[targetId];
    if (node) {
      pendingJumpRef.current = null;
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [visibleStart]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const away = distanceFromBottom > 120;
    userScrolledUpRef.current = away;
    setShowScrollBottom(away);

    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const container = scrollRef.current;
      if (!container) return;
      const viewportMid =
        container.getBoundingClientRect().top + container.clientHeight * 0.32;
      let closestId: string | null = null;
      let bestDist = Infinity;
      for (const m of visibleMessages) {
        const node = msgRefs.current[m.id];
        if (!node) continue;
        const dist = Math.abs(node.getBoundingClientRect().top - viewportMid);
        if (dist < bestDist) {
          bestDist = dist;
          closestId = m.id;
        }
      }
      if (closestId) setActiveTurnId(closestId);
    });
  }, [visibleMessages]);

  const handleJump = useCallback(
    (id: string) => {
      setActiveTurnId(id);
      const targetIdx = messages.findIndex((m) => m.id === id);
      if (targetIdx >= 0 && targetIdx < visibleStart) {
        pendingJumpRef.current = id;
        setVisibleCount(messages.length - targetIdx);
        return;
      }
      const node = msgRefs.current[id];
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [messages, visibleStart]
  );

  const handleRegisterNode = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      msgRefs.current[id] = el;
    } else {
      delete msgRefs.current[id];
    }
  }, []);

  const handleCopyMessage = useCallback(async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      triggerHaptic('light');
      setCopiedId(msg.id);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === msg.id ? null : cur));
      }, 2200);
    } catch {
      // ignore clipboard errors
    }
  }, []);

  const handleStartEdit = useCallback(
    (id: string, kind: 'user' | 'output', draft: string) => {
      setEditing({ id, kind, draft });
    },
    []
  );

  const handleUpdateDraft = useCallback((draft: string) => {
    setEditing((cur) => (cur ? { ...cur, draft } : null));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  const needsKeySetup = activeProfile.requiresApiKey && !hasActiveKey;

  return (
    <div className="chat-viewport">
      <div ref={scrollRef} className="chat-scroll" onScroll={handleScroll}>
        {messages.length === 0 ? (
          <motion.div
            className="empty-stage"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          >
            <Maybot mood={activeMood} size="lg" interactive />

            <h1 className="empty-heading">{t.emptyState.heading}</h1>

            {needsKeySetup ? (
              <div className="starter-pills">
                <motion.button
                  type="button"
                  className="starter-pill"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    triggerHaptic('light');
                    onOpenVault();
                  }}
                >
                  <KeyRound size={15} style={{ color: 'var(--color-accent)' }} />
                  <span>{t.emptyState.addApiKey}</span>
                </motion.button>
                <motion.button
                  type="button"
                  className="starter-pill"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    triggerHaptic('light');
                    onOpenSettings();
                  }}
                >
                  <span>{t.emptyState.runSettings}</span>
                </motion.button>
              </div>
            ) : (
              <div className="starter-pills">
                {t.emptyState.starters.map((prompt, index) => (
                  <motion.button
                    key={prompt}
                    type="button"
                    className="starter-pill"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.28,
                      delay: 0.05 + index * 0.045,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      triggerHaptic('light');
                      onStarterSelect(prompt);
                    }}
                  >
                    <span>{prompt}</span>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="chat-column">
            {visibleStart > 0 && (
              <button
                type="button"
                className="window-load-more-btn"
                onClick={() => {
                  triggerHaptic('light');
                  handleShowEarlier();
                }}
              >
                {t.messages.showEarlier(
                  Math.min(visibleStart, VISIBLE_TURN_WINDOW),
                  visibleStart
                )}
              </button>
            )}

            {visibleMessages.map((msg, idx) => {
              const globalIdx = visibleStart + idx;
              const isLast = globalIdx === messages.length - 1;
              const isStreamingThis =
                isLast && msg.role === 'assistant' && isBusy;

              return (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  isStreamingThis={isStreamingThis}
                  streamingPhase={isStreamingThis ? phase : null}
                  proseFont={proseFont}
                  copied={copiedId === msg.id}
                  editingDraft={editing?.id === msg.id ? editing : null}
                  onRegisterNode={handleRegisterNode}
                  onCopy={handleCopyMessage}
                  onStartEdit={handleStartEdit}
                  onUpdateDraft={handleUpdateDraft}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={onEditMessage}
                  onRetryMessage={onRetryMessage}
                  onDeleteMessage={onDeleteMessage}
                  onDeleteThinking={onDeleteThinking}
                  onBranchMessage={onBranchMessage}
                  onOpenVault={onOpenVault}
                  onFeedback={onFeedback}
                />
              );
            })}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                paddingTop: 4,
                fontSize: '0.76rem',
                color: 'var(--color-muted)',
              }}
            >
              <ShieldCheck size={14} style={{ flexShrink: 0 }} />
              <span>{t.messages.aiDisclaimer}</span>
            </div>
          </div>
        )}
      </div>

      <TurnTimelineRail
        messages={messages}
        activeId={activeTurnId}
        onJumpToMessage={handleJump}
      />

      <AnimatePresence>
        {showScrollBottom && messages.length > 0 && (
          <motion.button
            type="button"
            className="scroll-bottom-btn"
            aria-label={t.messages.scrollLatestAria}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              triggerHaptic('light');
              scrollToBottom('smooth');
            }}
          >
            <ArrowDown size={18} strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
