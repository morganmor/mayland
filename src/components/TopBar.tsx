import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  Code2,
  KeyRound,
  Menu,
  MoreVertical,
  Palette,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { THEME_OPTIONS } from '../store/maylandStore';
import type { ProviderProfile, ThemeMode, VaultStatus } from '../types/mayland';
import { formatTokenCount } from '../utils/tokenEstimator';
import { triggerHaptic } from '../utils/nativeBridge';
import { MaylandLogo } from './MaylandLogo';

interface TopBarProps {
  title: string;
  tokenCount: number;
  activeProfile: ProviderProfile;
  vaultStatus: VaultStatus;
  hasActiveKey: boolean;
  theme: ThemeMode;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenAppSettings: () => void;
  onOpenWebSearch: () => void;
  onOpenVault: () => void;
  onOpenGetCode: () => void;
  onNewChat: () => void;
  onClearChat: () => void;
  onCycleTheme: () => void;
  onRenameChat: (nextTitle: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  tokenCount,
  activeProfile,
  hasActiveKey: _hasActiveKey,
  theme,
  onOpenHistory,
  onOpenSettings,
  onOpenAppSettings,
  onOpenWebSearch,
  onOpenVault,
  onOpenGetCode,
  onNewChat,
  onClearChat,
  onCycleTheme,
  onRenameChat,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  const commitRename = () => {
    setEditingTitle(false);
    const cleaned = draftTitle.trim();
    if (cleaned && cleaned !== title) {
      onRenameChat(cleaned);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <motion.button
          type="button"
          className="tonal-circle-btn"
          aria-label="Open chat history and key vault"
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            triggerHaptic('light');
            onOpenHistory();
          }}
        >
          <Menu size={20} strokeWidth={1.85} />
        </motion.button>

        {editingTitle ? (
          <input
            id="chat-title-input"
            name="chatTitle"
            type="text"
            value={draftTitle}
            autoFocus
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            aria-label="Rename conversation"
            className="drawer-field"
            style={{ maxWidth: 220, padding: '6px 10px', fontSize: '0.95rem' }}
          />
        ) : (
          <button
            type="button"
            className="topbar-title-btn"
            onClick={() => {
              setDraftTitle(title);
              setEditingTitle(true);
            }}
            aria-label="Rename conversation"
          >
            <span className="topbar-title-row">
              <MaylandLogo size={20} withWordmark={false} />
              <span className="topbar-title-text">{title}</span>
              <ChevronDown
                size={15}
                strokeWidth={2}
                style={{ color: 'var(--color-muted)', flexShrink: 0 }}
              />
            </span>
            <span className="topbar-subtitle tabular-nums">
              <span>{formatTokenCount(tokenCount)} tokens</span>
              <span aria-hidden="true">·</span>
              <span
                style={{
                  color: 'var(--color-ink-2)',
                }}
              >
                {activeProfile.name}
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="topbar-actions">
        <motion.button
          type="button"
          className="ghost-icon-btn"
          aria-label="New chat"
          whileTap={{ scale: 0.88, rotate: 90 }}
          onClick={() => {
            triggerHaptic('light');
            onNewChat();
          }}
        >
          <Plus size={21} strokeWidth={1.85} />
        </motion.button>

        <div style={{ position: 'relative' }}>
          <motion.button
            type="button"
            className="ghost-icon-btn"
            aria-label="More options"
            aria-expanded={menuOpen}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              triggerHaptic('light');
              setMenuOpen((v) => !v);
            }}
          >
            <MoreVertical size={20} strokeWidth={1.85} />
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    zIndex: 50,
                    minWidth: 205,
                    padding: 6,
                    borderRadius: 12,
                    border: '1px solid var(--color-rule-soft)',
                    backgroundColor: 'var(--color-paper-2)',
                    boxShadow: 'var(--shadow-float)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{
                      background: 'transparent',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '0 12px',
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenWebSearch();
                    }}
                  >
                    <Search size={16} strokeWidth={1.8} />
                    <span>Web Search</span>
                  </button>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{
                      background: 'transparent',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '0 12px',
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenVault();
                    }}
                  >
                    <KeyRound size={16} strokeWidth={1.8} />
                    <span>API & Providers</span>
                  </button>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{
                      background: 'transparent',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '0 12px',
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAppSettings();
                    }}
                  >
                    <Settings size={16} strokeWidth={1.8} />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{
                      background: 'transparent',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '0 12px',
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenGetCode();
                    }}
                  >
                    <Code2 size={16} strokeWidth={1.8} />
                    <span>Get code</span>
                  </button>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{
                      background: 'transparent',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '0 12px',
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onCycleTheme();
                    }}
                  >
                    <Palette size={16} strokeWidth={1.8} />
                    <span>
                      Theme:{' '}
                      {THEME_OPTIONS.find((item) => item.id === theme)?.label ??
                        'Dark'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{
                      background: 'transparent',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '0 12px',
                      color: 'var(--color-danger)',
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onClearChat();
                    }}
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                    <span>Clear conversation</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          className="tonal-circle-btn"
          aria-label="Open Run settings"
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            triggerHaptic('light');
            onOpenSettings();
          }}
        >
          <SlidersHorizontal size={19} strokeWidth={1.85} />
        </motion.button>
      </div>
    </header>
  );
};
