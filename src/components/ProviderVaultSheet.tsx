import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  createBlankCustomProfile,
  createProfileFromPreset,
  PROVIDER_PRESETS,
} from '../adapters/providerPresets';
import { openAIAdapter } from '../adapters/openaiCompatible';
import { keyVault } from '../crypto/keyVault';
import { useI18n } from '../i18n';
import type {
  EnvelopeMetadata,
  ProviderPresetId,
  ProviderProfile,
  VaultStatus,
} from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';

interface ProviderVaultSheetProps {
  open: boolean;
  profiles: ProviderProfile[];
  activeProfileId: string;
  vaultStatus: VaultStatus;
  envelopesMeta: Record<string, EnvelopeMetadata>;
  onClose: () => void;
  onSelectProfile: (profileId: string, profileObj?: ProviderProfile) => void;
  onSaveProfile: (profile: ProviderProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onRefreshVault: () => void;
  onNotify: (message: string, tone?: 'info' | 'error') => void;
}

type PanelMode = 'edit' | 'add' | 'security';

const ALL_PRESETS = Object.values(PROVIDER_PRESETS);

function extractHost(baseUrl: string, fallbackLabel: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return fallbackLabel;
  try {
    return new URL(trimmed).host;
  } catch {
    return trimmed.replace(/^https?:\/\//, '').split('/')[0] || 'Custom';
  }
}

function getKeyToneColor(
  meta: EnvelopeMetadata | undefined,
  requiresApiKey: boolean
): string {
  if (meta) return 'var(--color-success)';
  if (!requiresApiKey) return 'var(--color-thought)';
  return 'var(--color-muted)';
}

interface ProviderNavItemProps {
  profile: ProviderProfile;
  meta: EnvelopeMetadata | undefined;
  isSelected: boolean;
  isActiveChat: boolean;
  onSelect: () => void;
}

const ProviderNavItem: React.FC<ProviderNavItemProps> = ({
  profile,
  meta,
  isSelected,
  isActiveChat,
  onSelect,
}) => {
  const { t } = useI18n();
  const dotColor = getKeyToneColor(meta, profile.requiresApiKey);
  const host = extractHost(profile.baseUrl, t.providerVault.noUrlSet);
  const statusText = meta
    ? t.providerVault.keySaved
    : !profile.requiresApiKey
      ? t.providerVault.local
      : t.providerVault.noKey;

  return (
    <button
      type="button"
      className="provider-nav-item"
      data-selected={isSelected ? 'true' : 'false'}
      onClick={onSelect}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          flex: 1,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 99,
            backgroundColor: dotColor,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: '0.86rem',
                fontWeight: isSelected ? 600 : 500,
                color: 'var(--color-ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {profile.name || t.providerVault.untitled}
            </span>
            {isActiveChat && (
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 550,
                  color: 'var(--color-accent)',
                  padding: '1px 6px',
                  borderRadius: 999,
                  backgroundColor: 'var(--color-accent-soft)',
                  flexShrink: 0,
                }}
              >
                {t.providerVault.active}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--color-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {host} · {statusText}
          </span>
        </div>
      </div>
    </button>
  );
};

export const ProviderVaultSheet: React.FC<ProviderVaultSheetProps> = ({
  open,
  profiles,
  activeProfileId,
  vaultStatus,
  envelopesMeta,
  onClose,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
  onRefreshVault,
  onNotify,
}) => {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState(activeProfileId);
  const current =
    profiles.find((p) => p.id === editingId) ??
    profiles.find((p) => p.id === activeProfileId) ??
    profiles[0];

  const [panelMode, setPanelMode] = useState<PanelMode>('edit');
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = useState(false);
  const [draft, setDraft] = useState<ProviderProfile>(current);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [pinCurrentDraft, setPinCurrentDraft] = useState('');
  const [selfTestInfo, setSelfTestInfo] = useState<string | null>(null);

  useEffect(() => {
    if (open && current) {
      setEditingId(current.id);
      setDraft(current);
      setPanelMode('edit');
      setMobileSwitcherOpen(false);
      setApiKeyInput('');
      setNewModelInput('');
      setShowKey(false);
      setAdvancedOpen(false);
      setSelfTestInfo(null);
    }
  }, [open, current?.id]);

  const handleSelectProfile = (p: ProviderProfile) => {
    setEditingId(p.id);
    setDraft(p);
    setPanelMode('edit');
    setMobileSwitcherOpen(false);
    setApiKeyInput('');
    setNewModelInput('');
    setShowKey(false);
    setAdvancedOpen(false);
    onSelectProfile(p.id, p);
    triggerHaptic('light');
  };

  const handleCreateFromPreset = (presetId: ProviderPresetId) => {
    const fresh =
      presetId === 'custom'
        ? createBlankCustomProfile()
        : createProfileFromPreset(presetId);
    onSaveProfile(fresh);
    setEditingId(fresh.id);
    setDraft(fresh);
    setPanelMode('edit');
    setMobileSwitcherOpen(false);
    setApiKeyInput('');
    setNewModelInput('');
    setShowKey(false);
    setAdvancedOpen(false);
    onSelectProfile(fresh.id, fresh);
    triggerHaptic('light');
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      onNotify(t.providerVault.errEnterName, 'error');
      return;
    }
    if (!draft.baseUrl.trim()) {
      onNotify(t.providerVault.errEnterBaseUrl, 'error');
      return;
    }

    setSaving(true);
    try {
      const cleanDefault = draft.defaultModel.trim();
      const mergedSuggested = cleanDefault
        ? Array.from(new Set([cleanDefault, ...draft.suggestedModels]))
        : draft.suggestedModels;
      const updatedProfile: ProviderProfile = {
        ...draft,
        name: draft.name.trim(),
        baseUrl: draft.baseUrl.trim(),
        defaultModel: cleanDefault,
        suggestedModels: mergedSuggested,
        updatedAt: Date.now(),
      };

      const hasNewKey = Boolean(apiKeyInput.trim());
      if (hasNewKey) {
        await keyVault.encryptApiKey(updatedProfile.id, apiKeyInput);
        setApiKeyInput('');
        setShowKey(false);
        onRefreshVault();
      }

      onSaveProfile(updatedProfile);
      setDraft(updatedProfile);
      triggerHaptic('medium');
      onNotify(
        hasNewKey
          ? t.providerVault.savedWithKeyToast(updatedProfile.name)
          : t.providerVault.savedToast(updatedProfile.name)
      );
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEndpoint = () => {
    const remaining = profiles.filter((p) => p.id !== draft.id);
    if (remaining.length === 0) return;
    const deletedId = draft.id;
    const deletedName = draft.name;
    const next = remaining[0];
    setEditingId(next.id);
    setDraft(next);
    setApiKeyInput('');
    setNewModelInput('');
    onDeleteProfile(deletedId);
    triggerHaptic('light');
    onNotify(t.providerVault.removedToast(deletedName));
  };

  const handleAddModel = () => {
    const slug = newModelInput.trim();
    if (!slug) return;
    const nextModels = Array.from(new Set([...draft.suggestedModels, slug]));
    const updated: ProviderProfile = {
      ...draft,
      defaultModel: draft.defaultModel.trim() || slug,
      suggestedModels: nextModels,
      updatedAt: Date.now(),
    };
    setDraft(updated);
    onSaveProfile(updated);
    setNewModelInput('');
    triggerHaptic('light');
    onNotify(t.providerVault.addedModelToast(slug));
  };

  const handleRemoveModel = (modelId: string) => {
    const nextModels = draft.suggestedModels.filter((m) => m !== modelId);
    const updated: ProviderProfile = {
      ...draft,
      defaultModel:
        draft.defaultModel === modelId ? nextModels[0] ?? '' : draft.defaultModel,
      suggestedModels: nextModels,
      updatedAt: Date.now(),
    };
    setDraft(updated);
    onSaveProfile(updated);
    triggerHaptic('light');
  };

  const handleFetchModels = async () => {
    if (!draft.baseUrl.trim()) {
      onNotify(t.providerVault.errBaseUrlFirst, 'error');
      return;
    }
    setFetchingModels(true);
    try {
      const models = await openAIAdapter.fetchModels(draft, apiKeyInput);
      if (models.length === 0) {
        onNotify(t.providerVault.zeroModels);
        return;
      }
      const nextDefault = draft.defaultModel.trim() || models[0];
      const updated: ProviderProfile = {
        ...draft,
        defaultModel: nextDefault,
        suggestedModels: Array.from(new Set([...models, ...draft.suggestedModels])),
        updatedAt: Date.now(),
      };
      setDraft(updated);
      onSaveProfile(updated);
      triggerHaptic('light');
      onNotify(t.providerVault.fetchedModels(models.length));
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleRunCryptoSelfTest = async () => {
    try {
      const res = await keyVault.runCryptoSelfTest();
      setSelfTestInfo(
        `${res.passed ? t.common.pass : t.common.fail} · ${res.algorithm} · ${res.durationMs}ms`
      );
      triggerHaptic('light');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleEnablePin = async () => {
    try {
      await keyVault.enableMasterPin(pinDraft);
      setPinDraft('');
      onRefreshVault();
      triggerHaptic('medium');
      onNotify(t.providerVault.pinEnabledToast);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleDisablePin = async () => {
    try {
      await keyVault.disableMasterPin(pinCurrentDraft);
      setPinCurrentDraft('');
      onRefreshVault();
      triggerHaptic('medium');
      onNotify(t.providerVault.pinDisabledToast);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const meta = envelopesMeta[draft?.id];

  return (
    <AnimatePresence>
      {open && draft && (
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
              className="center-modal provider-modal"
              aria-label={t.providerVault.ariaLabel}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Fixed Top Header */}
              <div className="provider-header">
                <h2 className="drawer-title" style={{ whiteSpace: 'nowrap' }}>
                  {t.providerVault.title}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    aria-label={t.providerVault.pinSecurityAria}
                    style={{
                      minHeight: 34,
                      padding: '0 10px',
                      fontSize: '0.8rem',
                      border:
                        panelMode === 'security'
                          ? '1px solid var(--color-accent)'
                          : '1px solid var(--color-rule-soft)',
                      backgroundColor:
                        panelMode === 'security'
                          ? 'var(--color-accent-soft)'
                          : 'transparent',
                      color:
                        panelMode === 'security'
                          ? 'var(--color-accent)'
                          : 'var(--color-ink-2)',
                    }}
                    onClick={() => {
                      setMobileSwitcherOpen(false);
                      setPanelMode((m) => (m === 'security' ? 'edit' : 'security'));
                    }}
                  >
                    <Lock size={13} />
                    <span>{vaultStatus.pinEnabled ? t.providerVault.pinOn : t.providerVault.pin}</span>
                  </button>

                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{
                      minHeight: 34,
                      padding: '0 11px',
                      fontSize: '0.8rem',
                      border:
                        panelMode === 'add'
                          ? '1px solid var(--color-accent)'
                          : '1px solid var(--color-rule-soft)',
                      backgroundColor:
                        panelMode === 'add'
                          ? 'var(--color-accent-soft)'
                          : 'var(--color-paper-2)',
                      color:
                        panelMode === 'add'
                          ? 'var(--color-accent)'
                          : 'var(--color-ink)',
                    }}
                    onClick={() => {
                      setMobileSwitcherOpen(false);
                      setPanelMode((m) => (m === 'add' ? 'edit' : 'add'));
                    }}
                  >
                    <Plus size={14} />
                    <span>{t.providerVault.add}</span>
                  </button>

                  <button
                    type="button"
                    className="ghost-icon-btn"
                    aria-label={t.providerVault.closeAria}
                    style={{ minWidth: 36, minHeight: 36 }}
                    onClick={onClose}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modular Workspace: Left Rail (Desktop) / Switcher Bar (Mobile) + Focused Detail Pane */}
              <div className="provider-workspace">
                {/* Desktop Left Modular Provider Rail */}
                <aside className="provider-rail" aria-label={t.providerVault.listAria}>
                  <div className="provider-rail-scroll">
                    {profiles.map((p) => (
                      <ProviderNavItem
                        key={p.id}
                        profile={p}
                        meta={envelopesMeta[p.id]}
                        isSelected={panelMode === 'edit' && p.id === draft.id}
                        isActiveChat={p.id === activeProfileId}
                        onSelect={() => handleSelectProfile(p)}
                      />
                    ))}
                  </div>
                </aside>

                {/* Mobile Pinned Modular Provider Switcher (Never squished!) */}
                <div className="provider-mobile-bar">
                  <button
                    type="button"
                    className="provider-mobile-trigger"
                    aria-expanded={mobileSwitcherOpen}
                    onClick={() => setMobileSwitcherOpen((v) => !v)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 99,
                          backgroundColor: getKeyToneColor(meta, draft.requiresApiKey),
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: 'var(--color-ink)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {draft.name || t.providerVault.untitled}
                        </span>
                        <span
                          style={{
                            fontSize: '0.73rem',
                            color: 'var(--color-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {extractHost(draft.baseUrl, t.providerVault.noUrlSet)} ·{' '}
                          {meta
                            ? t.providerVault.keySaved
                            : !draft.requiresApiKey
                              ? t.providerVault.local
                              : t.providerVault.noKey}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: '0.78rem',
                        color: 'var(--color-ink-2)',
                        flexShrink: 0,
                      }}
                    >
                      <span>{t.providerVault.switchLabel(profiles.length)}</span>
                      <ChevronDown
                        size={16}
                        strokeWidth={2}
                        style={{
                          transform: mobileSwitcherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 160ms ease',
                        }}
                      />
                    </span>
                  </button>

                  {mobileSwitcherOpen && (
                    <div className="provider-mobile-dropdown">
                      {profiles.map((p) => (
                        <ProviderNavItem
                          key={p.id}
                          profile={p}
                          meta={envelopesMeta[p.id]}
                          isSelected={panelMode === 'edit' && p.id === draft.id}
                          isActiveChat={p.id === activeProfileId}
                          onSelect={() => handleSelectProfile(p)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Focused Right / Main Pane */}
                <div className="provider-detail-pane">
                  {panelMode === 'add' ? (
                    <div className="provider-detail-scroll">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button
                            type="button"
                            className="ghost-icon-btn"
                            aria-label={t.providerVault.backAria}
                            style={{ minWidth: 34, minHeight: 34 }}
                            onClick={() => setPanelMode('edit')}
                          >
                            <ArrowLeft size={17} />
                          </button>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '1rem',
                              fontWeight: 560,
                            }}
                          >
                            {t.providerVault.chooseProvider}
                          </h3>
                        </div>
                      </div>

                      <div className="provider-preset-grid">
                        {ALL_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className="provider-preset-card"
                            onClick={() => handleCreateFromPreset(preset.id)}
                          >
                            <span
                              style={{
                                fontSize: '0.9rem',
                                fontWeight: 560,
                                color: 'var(--color-ink)',
                              }}
                            >
                              {preset.label}
                            </span>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--color-muted)',
                              }}
                            >
                              {preset.id === 'custom'
                                ? t.providerVault.anyOpenAiUrl
                                : `${extractHost(preset.baseUrl, t.providerVault.noUrlSet)} · ${
                                    preset.requiresApiKey
                                      ? t.providerVault.keyRequiredBadge
                                      : t.providerVault.noKeyBadge
                                  }`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : panelMode === 'security' ? (
                    <div className="provider-detail-scroll">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button
                            type="button"
                            className="ghost-icon-btn"
                            aria-label={t.providerVault.backAria}
                            style={{ minWidth: 34, minHeight: 34 }}
                            onClick={() => setPanelMode('edit')}
                          >
                            <ArrowLeft size={17} />
                          </button>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 560 }}>
                            {t.providerVault.vaultPinLock}
                          </h3>
                        </div>
                        <span
                          className="soft-badge"
                          data-tone={vaultStatus.pinEnabled ? 'accent' : undefined}
                        >
                          {vaultStatus.pinEnabled
                            ? t.providerVault.pinActive
                            : t.providerVault.autoKey}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.86rem',
                          lineHeight: 1.55,
                          color: 'var(--color-ink-2)',
                        }}
                      >
                        {t.providerVault.pinLockDesc}
                      </p>

                      {!vaultStatus.pinEnabled ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="password"
                            className="drawer-field"
                            style={{ flex: 1, minWidth: 0 }}
                            value={pinDraft}
                            onChange={(e) => setPinDraft(e.target.value)}
                            placeholder={t.providerVault.setPinPlaceholder}
                          />
                          <button
                            type="button"
                            className="accent-pill-btn"
                            onClick={handleEnablePin}
                          >
                            <Lock size={14} />
                            <span>{t.providerVault.setPin}</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input
                              type="password"
                              className="drawer-field"
                              style={{ flex: 1, minWidth: 160 }}
                              value={pinCurrentDraft}
                              onChange={(e) => setPinCurrentDraft(e.target.value)}
                              placeholder={t.providerVault.currentPinPlaceholder}
                            />
                            <button
                              type="button"
                              className="tonal-pill-btn"
                              onClick={handleDisablePin}
                            >
                              <Unlock size={14} />
                              <span>{t.providerVault.disablePin}</span>
                            </button>
                          </div>

                          <div>
                            <button
                              type="button"
                              className="tonal-pill-btn"
                              onClick={() => {
                                keyVault.lockVault();
                                onRefreshVault();
                                onClose();
                              }}
                            >
                              <Lock size={14} />
                              <span>{t.providerVault.lockVaultNow}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          paddingTop: 12,
                          borderTop: '1px solid var(--color-rule-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          className="soft-badge"
                          onClick={handleRunCryptoSelfTest}
                        >
                          {t.providerVault.verifyEncryption}
                        </button>
                        {selfTestInfo && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.74rem',
                              color: 'var(--color-success)',
                            }}
                          >
                            {selfTestInfo}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="provider-detail-scroll">
                        {/* Clean Provider Summary Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              minWidth: 0,
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '1.05rem',
                                fontWeight: 600,
                                letterSpacing: '-0.015em',
                                color: 'var(--color-ink)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {draft.name || t.providerVault.untitledProvider}
                            </h3>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--color-muted)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {extractHost(draft.baseUrl, t.providerVault.noUrlSet)}
                            </span>
                          </div>

                          {profiles.length > 1 && (
                            <button
                              type="button"
                              className="ghost-icon-btn"
                              aria-label={t.providerVault.removeProviderAria(draft.name)}
                              title={t.providerVault.removeProviderTitle}
                              style={{
                                minWidth: 36,
                                minHeight: 36,
                                color: 'var(--color-muted)',
                              }}
                              onClick={handleDeleteEndpoint}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {/* Clean, Uncluttered Core Fields */}
                        <div className="provider-field-grid">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label htmlFor="vault-profile-name" className="drawer-label">
                              {t.providerVault.nameLabel}
                            </label>
                            <input
                              id="vault-profile-name"
                              name="profileName"
                              type="text"
                              className="drawer-field"
                              placeholder={t.providerVault.namePlaceholder}
                              value={draft.name}
                              onChange={(e) =>
                                setDraft({ ...draft, name: e.target.value })
                              }
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label htmlFor="vault-base-url" className="drawer-label">
                              {t.providerVault.baseUrlLabel}
                            </label>
                            <input
                              id="vault-base-url"
                              name="baseUrl"
                              type="url"
                              className="drawer-field"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}
                              value={draft.baseUrl}
                              onChange={(e) =>
                                setDraft({ ...draft, baseUrl: e.target.value })
                              }
                              placeholder="https://api.openai.com/v1"
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <label htmlFor="vault-api-key" className="drawer-label">
                              {t.providerVault.apiKeyLabel}
                            </label>
                            {meta ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: '0.74rem',
                                    color: 'var(--color-success)',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  {t.providerVault.savedPreview(meta.maskedPreview)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    keyVault.deleteApiKey(draft.id);
                                    onRefreshVault();
                                    onNotify(t.providerVault.apiKeyClearedToast);
                                  }}
                                  style={{
                                    fontSize: '0.74rem',
                                    color: 'var(--color-danger)',
                                  }}
                                >
                                  {t.providerVault.clear}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="soft-badge"
                                data-tone={draft.requiresApiKey ? undefined : 'thought'}
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    requiresApiKey: !draft.requiresApiKey,
                                  })
                                }
                              >
                                {draft.requiresApiKey
                                  ? t.providerVault.keyRequiredToggle
                                  : t.providerVault.keyOptionalToggle}
                              </button>
                            )}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <input
                              id="vault-api-key"
                              name="apiKey"
                              type={showKey ? 'text' : 'password'}
                              className="drawer-field"
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              placeholder={
                                meta
                                  ? t.providerVault.pasteReplaceKey
                                  : draft.requiresApiKey
                                    ? t.providerVault.pasteApiKey
                                    : t.providerVault.optionalLocalKey
                              }
                              style={{ paddingRight: 40 }}
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              aria-label={showKey ? t.providerVault.hideKey : t.providerVault.showKey}
                              onClick={() => setShowKey((v) => !v)}
                              style={{
                                position: 'absolute',
                                right: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                padding: 6,
                                color: 'var(--color-muted)',
                              }}
                            >
                              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label htmlFor="vault-default-model" className="drawer-label">
                            {t.providerVault.defaultModelLabel}
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              id="vault-default-model"
                              name="defaultModel"
                              type="text"
                              className="drawer-field"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.84rem',
                              }}
                              value={draft.defaultModel}
                              placeholder={t.providerVault.defaultModelPlaceholder}
                              onChange={(e) =>
                                setDraft({ ...draft, defaultModel: e.target.value })
                              }
                            />
                            <button
                              type="button"
                              className="tonal-pill-btn"
                              disabled={fetchingModels}
                              style={{
                                border: '1px solid var(--color-rule-soft)',
                                minHeight: 40,
                                padding: '0 12px',
                              }}
                              onClick={handleFetchModels}
                            >
                              <RefreshCw size={14} />
                              <span>{fetchingModels ? '…' : t.common.fetch}</span>
                            </button>
                          </div>

                          {draft.suggestedModels.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                marginTop: 4,
                              }}
                            >
                              {draft.suggestedModels.slice(0, 24).map((modelId) => {
                                const isDefault = draft.defaultModel === modelId;
                                return (
                                  <span
                                    key={modelId}
                                    className="soft-badge"
                                    data-tone={isDefault ? 'accent' : undefined}
                                    style={{ paddingRight: 6 }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraft({ ...draft, defaultModel: modelId })
                                      }
                                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}
                                    >
                                      {modelId}
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={t.providerVault.removeModelAria(modelId)}
                                      onClick={() => handleRemoveModel(modelId)}
                                      style={{
                                        display: 'inline-flex',
                                        opacity: 0.7,
                                        padding: 2,
                                      }}
                                    >
                                      <X size={11} />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Add Custom Model ID to Saved List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label htmlFor="vault-add-model" className="drawer-label">
                            {t.providerVault.addModelLabel}
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              id="vault-add-model"
                              name="addModel"
                              type="text"
                              className="drawer-field"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.84rem',
                              }}
                              value={newModelInput}
                              placeholder={t.providerVault.addModelPlaceholder}
                              onChange={(e) => setNewModelInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddModel();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="tonal-pill-btn"
                              disabled={!newModelInput.trim()}
                              style={{
                                border: '1px solid var(--color-rule-soft)',
                                minHeight: 40,
                                padding: '0 12px',
                              }}
                              onClick={handleAddModel}
                            >
                              <Plus size={14} />
                              <span>{t.common.add}</span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsed Advanced Endpoint Overrides */}
                        <div
                          style={{
                            borderTop: '1px solid var(--color-rule-soft)',
                            paddingTop: 8,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setAdvancedOpen((v) => !v)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 36,
                              color: 'var(--color-muted)',
                              fontSize: '0.82rem',
                              fontWeight: 500,
                            }}
                          >
                            <span>{t.providerVault.pathsHeadersToggle}</span>
                            <ChevronDown
                              size={16}
                              style={{
                                transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 180ms ease',
                              }}
                            />
                          </button>

                          {advancedOpen && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                                paddingTop: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: 8,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                  }}
                                >
                                  <label
                                    htmlFor="vault-chat-path"
                                    className="drawer-label"
                                  >
                                    {t.providerVault.chatPathLabel}
                                  </label>
                                  <input
                                    id="vault-chat-path"
                                    name="chatPath"
                                    type="text"
                                    className="drawer-field"
                                    style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.8rem',
                                    }}
                                    value={draft.chatPath}
                                    onChange={(e) =>
                                      setDraft({ ...draft, chatPath: e.target.value })
                                    }
                                  />
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                  }}
                                >
                                  <label
                                    htmlFor="vault-models-path"
                                    className="drawer-label"
                                  >
                                    {t.providerVault.modelsPathLabel}
                                  </label>
                                  <input
                                    id="vault-models-path"
                                    name="modelsPath"
                                    type="text"
                                    className="drawer-field"
                                    style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.8rem',
                                    }}
                                    value={draft.modelsPath}
                                    onChange={(e) =>
                                      setDraft({ ...draft, modelsPath: e.target.value })
                                    }
                                  />
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <span className="drawer-label">
                                    {t.providerVault.customHeadersLabel}
                                  </span>
                                  <button
                                    type="button"
                                    className="soft-badge"
                                    onClick={() =>
                                      setDraft({
                                        ...draft,
                                        customHeaders: [
                                          ...draft.customHeaders,
                                          { key: '', value: '' },
                                        ],
                                      })
                                    }
                                  >
                                    <Plus size={12} />
                                    <span>{t.providerVault.addHeader}</span>
                                  </button>
                                </div>
                                {draft.customHeaders.map((pair, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      gap: 6,
                                      alignItems: 'center',
                                    }}
                                  >
                                    <input
                                      type="text"
                                      className="drawer-field"
                                      placeholder={t.providerVault.keyPlaceholder}
                                      value={pair.key}
                                      onChange={(e) => {
                                        const next = [...draft.customHeaders];
                                        next[idx] = { ...next[idx], key: e.target.value };
                                        setDraft({ ...draft, customHeaders: next });
                                      }}
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.78rem',
                                      }}
                                    />
                                    <input
                                      type="text"
                                      className="drawer-field"
                                      placeholder={t.providerVault.valuePlaceholder}
                                      value={pair.value}
                                      onChange={(e) => {
                                        const next = [...draft.customHeaders];
                                        next[idx] = { ...next[idx], value: e.target.value };
                                        setDraft({ ...draft, customHeaders: next });
                                      }}
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.78rem',
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="ghost-icon-btn"
                                      aria-label={t.providerVault.removeHeaderAria}
                                      style={{ minWidth: 34, minHeight: 34 }}
                                      onClick={() =>
                                        setDraft({
                                          ...draft,
                                          customHeaders: draft.customHeaders.filter(
                                            (_, i) => i !== idx
                                          ),
                                        })
                                      }
                                    >
                                      <X size={15} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quiet Persistent Footer Bar */}
                      <div className="modal-footer-bar">
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.74rem',
                            color: 'var(--color-muted)',
                          }}
                        >
                          <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                          <span>{t.providerVault.encryptedLocally}</span>
                        </span>

                        <button
                          type="button"
                          className="accent-pill-btn"
                          style={{ marginLeft: 'auto' }}
                          disabled={saving}
                          onClick={handleSave}
                        >
                          <Check size={16} />
                          <span>{saving ? t.common.saving : t.common.save}</span>
                        </button>
                      </div>
                    </>
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
