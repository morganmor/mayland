import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  KeyRound,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation, VaultStatus } from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';
import { MaylandLogo } from './MaylandLogo';

interface HistoryVaultDrawerProps {
  open: boolean;
  conversations: Conversation[];
  activeConversationId: string;
  vaultStatus: VaultStatus;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onOpenVault: () => void;
  onOpenAppSettings: () => void;
}

const RigelStarGlyph: React.FC<{ active?: boolean }> = ({ active = false }) => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M8 1.4C8.45 5.45 10.55 7.55 14.6 8C10.55 8.45 8.45 10.55 8 14.6C7.55 10.55 5.45 8.45 1.4 8C5.45 7.55 7.55 5.45 8 1.4Z"
      fill={active ? 'var(--color-rigel-core)' : 'currentColor'}
      opacity={active ? 1 : 0.45}
    />
  </svg>
);

function getBucketLabel(ts: number, startOfToday: number, sevenDaysAgo: number): string {
  if (ts >= startOfToday) return 'Today';
  if (ts >= sevenDaysAgo) return 'Previous 7 days';
  return 'Archive';
}

export const HistoryVaultDrawer: React.FC<HistoryVaultDrawerProps> = ({
  open,
  conversations,
  activeConversationId,
  vaultStatus: _vaultStatus,
  onClose,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onOpenVault,
  onOpenAppSettings,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, query]);

  const grouped = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

    const buckets = new Map<string, Conversation[]>();
    for (const conv of filtered) {
      const label = getBucketLabel(
        conv.updatedAt || conv.createdAt,
        startOfToday,
        sevenDaysAgo
      );
      const list = buckets.get(label) ?? [];
      list.push(conv);
      buckets.set(label, list);
    }
    return Array.from(buckets.entries());
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className="drawer-scrim"
        data-open={open ? 'true' : 'false'}
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        className="drawer-panel rigel-drawer-panel"
        data-side="left"
        data-open={open ? 'true' : 'false'}
        aria-label="Conversations and Observatory Navigation"
        aria-hidden={!open}
        inert={!open}
      >
        {/* Celestial Observatory Header */}
        <div className="rigel-drawer-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MaylandLogo size={24} />
            <span className="rigel-observatory-tag">Rigel Workbench</span>
          </div>
          <button
            type="button"
            className="ghost-icon-btn"
            aria-label="Close history"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        {/* New Session + Filter */}
        <div className="rigel-controls-band">
          <motion.button
            type="button"
            className="rigel-new-session-btn"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              triggerHaptic('light');
              onNewChat();
              onClose();
            }}
          >
            <span className="rigel-new-star">
              <RigelStarGlyph active />
            </span>
            <span style={{ fontWeight: 560, fontSize: '0.88rem' }}>New session</span>
            <Plus size={16} style={{ marginLeft: 'auto', opacity: 0.85 }} />
          </motion.button>

          <div className="rigel-search-wrap">
            <Search size={14} className="rigel-search-icon" />
            <input
              id="history-search"
              name="history-search"
              type="search"
              className="rigel-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter sessions…"
            />
            <span className="rigel-search-count tabular-nums">
              {filtered.length}
            </span>
          </div>
        </div>

        {/* Temporal Session Feed */}
        <div className="drawer-scroll" style={{ paddingTop: 4 }}>
          {grouped.length === 0 ? (
            <div className="rigel-empty-feed">
              <RigelStarGlyph />
              <span>No matching sessions</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {grouped.map(([groupLabel, items]) => (
                <div key={groupLabel} className="rigel-group-block">
                  <div className="rigel-group-label">
                    <span>{groupLabel}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {items.map((conv) => {
                      const isActive = conv.id === activeConversationId;
                      return (
                        <div
                          key={conv.id}
                          className="rigel-session-row"
                          data-active={isActive ? 'true' : 'false'}
                        >
                          <button
                            type="button"
                            className="rigel-session-btn"
                            onClick={() => {
                              triggerHaptic('light');
                              onSelectConversation(conv.id);
                              onClose();
                            }}
                          >
                            <div className="rigel-session-copy">
                              <span className="rigel-session-title">
                                {conv.title}
                              </span>
                              <span className="rigel-session-meta tabular-nums">
                                {conv.messages.length} msgs ·{' '}
                                {conv.settings.model.split('/').pop()}
                              </span>
                            </div>
                          </button>

                          {conversations.length > 1 && (
                            <button
                              type="button"
                              className="rigel-session-del"
                              aria-label={`Delete ${conv.title}`}
                              onClick={() => {
                                triggerHaptic('light');
                                onDeleteConversation(conv.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Observatory Footer Dock (API & Providers + Settings) */}
        <div className="rigel-sidebar-dock">
          <button
            type="button"
            className="rigel-dock-item"
            onClick={() => {
              triggerHaptic('light');
              onClose();
              onOpenVault();
            }}
          >
            <span className="rigel-dock-left">
              <KeyRound size={15} style={{ color: 'var(--color-accent)' }} />
              <span>API &amp; Providers</span>
            </span>
          </button>

          <button
            type="button"
            className="rigel-dock-item"
            onClick={() => {
              triggerHaptic('light');
              onClose();
              onOpenAppSettings();
            }}
          >
            <span className="rigel-dock-left">
              <Settings size={15} style={{ color: 'var(--color-ink-2)' }} />
              <span>Settings</span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
