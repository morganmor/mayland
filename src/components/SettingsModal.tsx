import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Download,
  Globe,
  HardDrive,
  Languages,
  Palette,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { LANGUAGE_OPTIONS, useI18n } from '../i18n';
import { THEME_OPTIONS } from '../store/maylandStore';
import type { SyncStatusInfo } from '../store/workspaceSync';
import type { SearchVaultInfo } from '../crypto/searchKeyStore';
import type {
  AppLanguage,
  SearchEngineConfig,
  SearchKeyMetadata,
  SearchProviderId,
  ThemeMode,
} from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';
import { SearchEngineSettingsPanel } from './SearchEngineSettingsPanel';

export type SettingsSection = 'appearance' | 'search' | 'storage';

interface SettingsModalProps {
  open: boolean;
  initialSection?: SettingsSection;
  language: AppLanguage;
  theme: ThemeMode;
  proseFont: 'editorial' | 'clean';
  syncInfo: SyncStatusInfo;
  providerCount: number;
  conversationCount: number;
  savedKeyCount: number;
  searchConfig: SearchEngineConfig;
  searchKeyMetadata: Partial<Record<SearchProviderId, SearchKeyMetadata>>;
  searchVaultInfo: SearchVaultInfo;
  onClose: () => void;
  onLanguageChange: (next: AppLanguage) => void;
  onThemeChange: (next: ThemeMode) => void;
  onProseFontChange: (next: 'editorial' | 'clean') => void;
  onSyncAction: (remoteUrl: string, action: 'pull' | 'push') => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
  onSearchConfigChange: (next: SearchEngineConfig) => void;
  onSaveSearchKey: (providerId: SearchProviderId, rawKey: string) => Promise<void>;
  onDeleteSearchKey: (providerId: SearchProviderId) => Promise<void>;
  onVerifySearchVault: () => Promise<{
    passed: boolean;
    algorithm: string;
    hardwareBacked: boolean;
    durationMs: number;
  }>;
  onOpenSearchSheet: () => void;
  onNotify: (message: string, tone?: 'info' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  initialSection = 'appearance',
  language,
  theme,
  proseFont,
  syncInfo,
  providerCount,
  conversationCount,
  savedKeyCount,
  searchConfig,
  searchKeyMetadata,
  searchVaultInfo,
  onClose,
  onLanguageChange,
  onThemeChange,
  onProseFontChange,
  onSyncAction,
  onExportBackup,
  onImportBackup,
  onSearchConfigChange,
  onSaveSearchKey,
  onDeleteSearchKey,
  onVerifySearchVault,
  onOpenSearchSheet,
  onNotify,
}) => {
  const { t } = useI18n();
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [remoteUrlInput, setRemoteUrlInput] = useState(syncInfo.remoteSyncUrl);
  const [syncBusy, setSyncBusy] = useState(false);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setSection(initialSection);
    }
  }, [open, initialSection]);

  useEffect(() => {
    setRemoteUrlInput(syncInfo.remoteSyncUrl);
  }, [syncInfo.remoteSyncUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const navItems: Array<{
    id: SettingsSection;
    label: string;
    hint: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'appearance',
      label: t.settings.tabs.appearance.label,
      hint: t.settings.tabs.appearance.hint,
      icon: <Palette size={16} />,
    },
    {
      id: 'search',
      label: t.settings.tabs.search.label,
      hint: t.settings.tabs.search.hint,
      icon: <Globe size={16} />,
    },
    {
      id: 'storage',
      label: t.settings.tabs.storage.label,
      hint: t.settings.tabs.storage.hint,
      icon: <HardDrive size={16} />,
    },
  ];

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
              className="center-modal settings-modal"
              aria-label={t.settings.title}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header */}
              <div className="provider-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <h2 className="drawer-title">{t.settings.title}</h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                    {t.settings.subtitle}
                  </span>
                </div>
                <button
                  type="button"
                  className="ghost-icon-btn"
                  aria-label={t.settings.closeAria}
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modular 2-Pane Body */}
              <div className="provider-workspace">
                {/* Desktop Left Nav Rail */}
                <aside className="provider-rail" aria-label={t.settings.navAria}>
                  <div className="provider-rail-scroll">
                    {navItems.map((item) => {
                      const active = section === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="provider-nav-item"
                          data-selected={active ? 'true' : 'false'}
                          onClick={() => {
                            triggerHaptic('light');
                            setSection(item.id);
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: '0.88rem',
                                fontWeight: active ? 600 : 500,
                                color: 'var(--color-ink)',
                              }}
                            >
                              <span
                                style={{
                                  color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                                  display: 'inline-flex',
                                }}
                              >
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                            </span>
                            <span style={{ fontSize: '0.73rem', color: 'var(--color-muted)' }}>
                              {item.hint}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                {/* Mobile Top Navigation Tabs */}
                <div className="provider-mobile-bar" style={{ padding: '8px 14px' }}>
                  <div className="provider-switch-row">
                    {navItems.map((item) => {
                      const active = section === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="provider-switch-chip"
                          data-active={active ? 'true' : 'false'}
                          onClick={() => {
                            triggerHaptic('light');
                            setSection(item.id);
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Main Content Area (Fixed modal height -> internal scroll) */}
                <div className="provider-detail-pane">
                  <div className="provider-detail-scroll">
                    {section === 'appearance' ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <h3 className="drawer-title">{t.settings.appearanceTitle}</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                            {t.settings.appearanceSubtitle}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span
                            className="drawer-label"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Languages size={13} style={{ color: 'var(--color-accent)' }} />
                            <span>{t.settings.languageLabel}</span>
                          </span>
                          <div className="settings-font-grid">
                            {LANGUAGE_OPTIONS.map((opt) => {
                              const active = language === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  className="settings-font-card"
                                  data-active={active ? 'true' : 'false'}
                                  onClick={() => {
                                    triggerHaptic('light');
                                    onLanguageChange(opt.id);
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 8,
                                      width: '100%',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '0.95rem',
                                        fontWeight: 600,
                                        color: 'var(--color-ink)',
                                      }}
                                    >
                                      {opt.label}
                                    </span>
                                    <span
                                      className="soft-badge"
                                      data-tone={active ? 'accent' : undefined}
                                    >
                                      {opt.code}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '0.77rem',
                                      color: 'var(--color-muted)',
                                    }}
                                  >
                                    {opt.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span className="drawer-label">{t.settings.themeLabel}</span>
                          <div className="theme-grid">
                            {THEME_OPTIONS.map((item) => {
                              const active = theme === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="theme-card"
                                  data-active={active ? 'true' : 'false'}
                                  onClick={() => {
                                    triggerHaptic('light');
                                    onThemeChange(item.id);
                                  }}
                                >
                                  <span
                                    className="theme-swatch"
                                    style={{ backgroundColor: item.swatchBg }}
                                    aria-hidden="true"
                                  >
                                    <span
                                      className="theme-swatch-star"
                                      style={{ backgroundColor: item.swatchAccent }}
                                    />
                                  </span>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                                    <span className="theme-card-label">
                                      {t.topBar.themeNames[item.id] ?? item.label}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)', textAlign: 'left' }}>
                                      {t.settings.themeDesc[item.id]}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span className="drawer-label">{t.settings.responseFontLabel}</span>
                          <div className="settings-font-grid">
                            <button
                              type="button"
                              className="settings-font-card"
                              data-active={proseFont === 'editorial' ? 'true' : 'false'}
                              onClick={() => {
                                triggerHaptic('light');
                                onProseFontChange('editorial');
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--font-reading)',
                                  fontSize: '1.05rem',
                                  fontWeight: 550,
                                  color: 'var(--color-ink)',
                                }}
                              >
                                {t.settings.fontEditorialTitle}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--font-reading)',
                                  fontSize: '0.82rem',
                                  color: 'var(--color-muted)',
                                }}
                              >
                                {t.settings.fontEditorialDesc}
                              </span>
                            </button>

                            <button
                              type="button"
                              className="settings-font-card"
                              data-active={proseFont === 'clean' ? 'true' : 'false'}
                              onClick={() => {
                                triggerHaptic('light');
                                onProseFontChange('clean');
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--font-ui)',
                                  fontSize: '1.0rem',
                                  fontWeight: 600,
                                  color: 'var(--color-ink)',
                                }}
                              >
                                {t.settings.fontCleanTitle}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--font-ui)',
                                  fontSize: '0.8rem',
                                  color: 'var(--color-muted)',
                                }}
                              >
                                {t.settings.fontCleanDesc}
                              </span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : section === 'search' ? (
                      <SearchEngineSettingsPanel
                        config={searchConfig}
                        keyMetadata={searchKeyMetadata}
                        vaultInfo={searchVaultInfo}
                        onConfigChange={onSearchConfigChange}
                        onSaveKey={onSaveSearchKey}
                        onDeleteKey={onDeleteSearchKey}
                        onVerifyVault={onVerifySearchVault}
                        onOpenSearchSheet={() => {
                          onClose();
                          onOpenSearchSheet();
                        }}
                        onNotify={onNotify}
                      />
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <h3 className="drawer-title">{t.settings.storageTitle}</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                            {t.settings.storageSubtitle}
                          </span>
                        </div>

                        {/* Metrics strip */}
                        <div className="settings-stat-grid">
                          <div className="settings-stat-card">
                            <span className="settings-stat-val tabular-nums">{providerCount}</span>
                            <span className="settings-stat-lbl">{t.settings.statProviders}</span>
                          </div>
                          <div className="settings-stat-card">
                            <span className="settings-stat-val tabular-nums">{conversationCount}</span>
                            <span className="settings-stat-lbl">{t.settings.statConversations}</span>
                          </div>
                          <div className="settings-stat-card">
                            <span className="settings-stat-val tabular-nums">{savedKeyCount}</span>
                            <span className="settings-stat-lbl">{t.settings.statVaultKeys}</span>
                          </div>
                        </div>

                        {/* Workspace & APK Sync Card */}
                        <div className="drawer-outline-card" style={{ gap: 10 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: '0.9rem',
                                fontWeight: 560,
                                color: 'var(--color-ink)',
                              }}
                            >
                              <HardDrive size={15} style={{ color: 'var(--color-accent)' }} />
                              <span>{t.settings.syncCardTitle}</span>
                            </span>
                            <span
                              className="soft-badge"
                              data-tone={syncInfo.mode !== 'browser-only' ? 'accent' : undefined}
                            >
                              {syncInfo.mode === 'disk'
                                ? t.settings.syncBadgeDisk(syncInfo.rev)
                                : syncInfo.mode === 'android-native'
                                  ? t.settings.syncBadgeAndroid
                                  : t.settings.syncBadgeLocal}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--color-muted)',
                              lineHeight: 1.5,
                            }}
                          >
                            {syncInfo.mode === 'disk' ? (
                              <>
                                {t.settings.syncDescDiskPrefix}{' '}
                                <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)' }}>
                                  {syncInfo.storePath || '~/.mayland/workspace-state.json'}
                                </code>
                                {syncInfo.lanUrls.length > 0 && (
                                  <>
                                    <br />
                                    {t.settings.syncDescLanPrefix}{' '}
                                    <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                                      {syncInfo.lanUrls[0]}
                                    </code>
                                  </>
                                )}
                              </>
                            ) : syncInfo.mode === 'android-native' ? (
                              t.settings.syncDescAndroid
                            ) : (
                              t.settings.syncDescLocal
                            )}
                          </div>

                          {syncInfo.mode !== 'disk' && (
                            <input
                              type="url"
                              className="drawer-field"
                              placeholder={t.settings.lanUrlPlaceholder}
                              value={remoteUrlInput}
                              onChange={(e) => setRemoteUrlInput(e.target.value)}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.8rem',
                                padding: '9px 12px',
                                backgroundColor: 'var(--color-paper-3)',
                              }}
                            />
                          )}

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="tonal-pill-btn"
                              disabled={syncBusy}
                              onClick={async () => {
                                setSyncBusy(true);
                                try {
                                  await onSyncAction(
                                    syncInfo.mode === 'disk' ? '' : remoteUrlInput,
                                    'pull'
                                  );
                                } finally {
                                  setSyncBusy(false);
                                }
                              }}
                              style={{ minHeight: 36, fontSize: '0.8rem' }}
                            >
                              <RefreshCw size={14} />
                              <span>{syncInfo.mode === 'disk' ? t.settings.pullDisk : t.settings.pullPc}</span>
                            </button>

                            <button
                              type="button"
                              className="tonal-pill-btn"
                              disabled={syncBusy}
                              onClick={async () => {
                                setSyncBusy(true);
                                try {
                                  await onSyncAction(
                                    syncInfo.mode === 'disk' ? '' : remoteUrlInput,
                                    'push'
                                  );
                                } finally {
                                  setSyncBusy(false);
                                }
                              }}
                              style={{ minHeight: 36, fontSize: '0.8rem' }}
                            >
                              <Upload size={14} />
                              <span>{syncInfo.mode === 'disk' ? t.settings.pushDisk : t.settings.pushPc}</span>
                            </button>

                            <button
                              type="button"
                              className="tonal-pill-btn"
                              onClick={() => void onExportBackup()}
                              style={{ minHeight: 36, fontSize: '0.8rem' }}
                            >
                              <Download size={14} />
                              <span>{t.settings.exportBackup}</span>
                            </button>

                            <button
                              type="button"
                              className="tonal-pill-btn"
                              onClick={() => backupInputRef.current?.click()}
                              style={{ minHeight: 36, fontSize: '0.8rem' }}
                            >
                              <Upload size={14} />
                              <span>{t.settings.importBackup}</span>
                            </button>
                          </div>

                          <input
                            ref={backupInputRef}
                            type="file"
                            accept=".json,application/json"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void onImportBackup(file);
                              }
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
