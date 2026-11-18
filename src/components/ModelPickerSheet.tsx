import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, KeyRound, Plus, RefreshCw, X } from 'lucide-react';
import {
  formatCompactTokens,
  getModelSpecsForPreset,
  lookupModelSpec,
  syncModelsDevCatalog,
} from '../adapters/modelsDev';
import { openAIAdapter } from '../adapters/openaiCompatible';
import { useI18n } from '../i18n';
import type {
  ProviderProfile,
  RunSettings,
  ThinkingEffort,
} from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';

interface ModelPickerSheetProps {
  open: boolean;
  profiles: ProviderProfile[];
  settings: RunSettings;
  onClose: () => void;
  onSelectProfileAndModel: (profileId: string, model: string) => void;
  onSaveProfile: (profile: ProviderProfile) => void;
  onChangeThinking?: (effort: ThinkingEffort) => void;
  onOpenVault: () => void;
  onNotify?: (message: string, tone?: 'info' | 'error') => void;
}

export const ModelPickerSheet: React.FC<ModelPickerSheetProps> = ({
  open,
  profiles,
  settings,
  onClose,
  onSelectProfileAndModel,
  onSaveProfile,
  onOpenVault,
  onNotify,
}) => {
  const { t } = useI18n();
  const activeProfile =
    profiles.find((p) => p.id === settings.profileId) ?? profiles[0];
  const [customModel, setCustomModel] = useState(settings.model);
  const [syncing, setSyncing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    setCustomModel(settings.model);
  }, [settings.model]);

  const knownSpecs = activeProfile
    ? getModelSpecsForPreset(activeProfile.preset)
    : [];

  // Combine profile's custom/fetched suggestions with models.dev specs cleanly
  const modelIds = activeProfile
    ? Array.from(
        new Set([
          ...activeProfile.suggestedModels,
          ...knownSpecs.map((s) => s.id),
        ])
      )
    : [];

  const handleSyncModelsDev = async () => {
    setSyncing(true);
    try {
      const count = await syncModelsDevCatalog();
      setCatalogTick((t) => t + 1);
      triggerHaptic('light');
      onNotify?.(t.modelPicker.syncedSpecs(count));
    } catch (err) {
      onNotify?.((err as Error).message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleFetchFromEndpoint = async () => {
    if (!activeProfile?.baseUrl.trim()) {
      onNotify?.(t.modelPicker.errBaseUrlFirst, 'error');
      return;
    }
    setFetching(true);
    try {
      const fetched = await openAIAdapter.fetchModels(activeProfile);
      if (fetched.length === 0) {
        onNotify?.(t.modelPicker.zeroModels);
        return;
      }
      const nextDefault = activeProfile.defaultModel.trim() || fetched[0];
      onSaveProfile({
        ...activeProfile,
        defaultModel: nextDefault,
        suggestedModels: Array.from(
          new Set([...fetched, ...activeProfile.suggestedModels])
        ),
        updatedAt: Date.now(),
      });
      if (!settings.model) {
        onSelectProfileAndModel(activeProfile.id, nextDefault);
      }
      triggerHaptic('light');
      onNotify?.(t.modelPicker.fetchedModels(fetched.length));
    } catch (err) {
      onNotify?.((err as Error).message, 'error');
    } finally {
      setFetching(false);
    }
  };

  const handleAddAndUseModel = () => {
    const slug = customModel.trim();
    if (!slug || !activeProfile) return;
    if (!activeProfile.suggestedModels.includes(slug)) {
      onSaveProfile({
        ...activeProfile,
        defaultModel: activeProfile.defaultModel.trim() || slug,
        suggestedModels: [slug, ...activeProfile.suggestedModels],
        updatedAt: Date.now(),
      });
    }
    triggerHaptic('light');
    onSelectProfileAndModel(activeProfile.id, slug);
    onClose();
  };

  const handleRemoveSavedModel = (modelId: string) => {
    if (!activeProfile) return;
    const nextModels = activeProfile.suggestedModels.filter((m) => m !== modelId);
    onSaveProfile({
      ...activeProfile,
      defaultModel:
        activeProfile.defaultModel === modelId
          ? nextModels[0] ?? ''
          : activeProfile.defaultModel,
      suggestedModels: nextModels,
      updatedAt: Date.now(),
    });
    triggerHaptic('light');
  };

  const trimmedCustom = customModel.trim();
  const isAlreadyListed = Boolean(trimmedCustom && modelIds.includes(trimmedCustom));

  return (
    <AnimatePresence>
      {open && activeProfile && (
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
              aria-label={t.modelPicker.ariaLabel}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="drawer-header" style={{ paddingTop: 14 }}>
                <h2 className="drawer-title">{t.modelPicker.title}</h2>
                <button
                  type="button"
                  className="ghost-icon-btn"
                  aria-label={t.modelPicker.closeAria}
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="sheet-scroll" data-tick={catalogTick}>
                {/* Endpoint Switcher */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="drawer-label">{t.modelPicker.providerLabel}</span>
                    <button
                      type="button"
                      className="soft-badge"
                      onClick={() => {
                        onClose();
                        onOpenVault();
                      }}
                    >
                      <KeyRound size={12} />
                      <span>{t.modelPicker.manageProviders}</span>
                    </button>
                  </div>

                  <div className="provider-switch-row">
                    {profiles.map((p) => {
                      const active = p.id === activeProfile.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="provider-switch-chip"
                          data-active={active ? 'true' : 'false'}
                          onClick={() => {
                            triggerHaptic('light');
                            setCustomModel(p.defaultModel);
                            onSelectProfileAndModel(p.id, p.defaultModel);
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 99,
                              backgroundColor: active
                                ? 'var(--color-accent)'
                                : 'var(--color-muted)',
                              flexShrink: 0,
                            }}
                          />
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add / Select Model ID Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="custom-model-slug" className="drawer-label">
                    {t.modelPicker.addOrEnterModelId}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="custom-model-slug"
                      name="customModel"
                      type="text"
                      className="drawer-field"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.84rem',
                      }}
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAndUseModel();
                        }
                      }}
                      placeholder={t.modelPicker.modelSlugPlaceholder}
                    />
                    <button
                      type="button"
                      className="accent-pill-btn"
                      disabled={!trimmedCustom}
                      onClick={handleAddAndUseModel}
                    >
                      {!isAlreadyListed && <Plus size={15} />}
                      <span>{isAlreadyListed ? t.common.use : t.common.add}</span>
                    </button>
                  </div>
                </div>

                {/* Models List + Fetch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="drawer-label">{t.modelPicker.availableModels}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="soft-badge"
                        disabled={fetching}
                        onClick={handleFetchFromEndpoint}
                      >
                        <RefreshCw size={12} />
                        <span>{fetching ? t.common.fetching : t.common.fetch}</span>
                      </button>
                      <button
                        type="button"
                        className="soft-badge"
                        disabled={syncing}
                        onClick={handleSyncModelsDev}
                      >
                        <RefreshCw size={12} />
                        <span>{syncing ? t.modelPicker.syncing : t.modelPicker.refreshSpecs}</span>
                      </button>
                    </div>
                  </div>

                  {modelIds.length === 0 ? (
                    <p
                      style={{
                        margin: '6px 0',
                        fontSize: '0.82rem',
                        color: 'var(--color-muted)',
                      }}
                    >
                      {t.modelPicker.noModelsSaved}
                    </p>
                  ) : (
                    modelIds.map((modelId) => {
                      const selected = settings.model === modelId;
                      const spec = lookupModelSpec(activeProfile.preset, modelId);
                      const isSavedCustom =
                        activeProfile.suggestedModels.includes(modelId);
                      return (
                        <div
                          key={modelId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 10,
                            border: selected
                              ? '1px solid var(--color-rule)'
                              : '1px solid transparent',
                            backgroundColor: selected
                              ? 'var(--color-paper-2)'
                              : 'transparent',
                            paddingRight: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              onSelectProfileAndModel(activeProfile.id, modelId);
                              onClose();
                            }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              minHeight: 44,
                              padding: '8px 12px',
                              textAlign: 'left',
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
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.83rem',
                                  color: selected
                                    ? 'var(--color-accent)'
                                    : 'var(--color-ink)',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {modelId}
                              </span>
                              {spec && (
                                <span
                                  className="tabular-nums"
                                  style={{
                                    fontSize: '0.73rem',
                                    color: 'var(--color-muted)',
                                  }}
                                >
                                  {spec.name} · {formatCompactTokens(spec.context)} ctx ·{' '}
                                  {formatCompactTokens(spec.output)} out
                                </span>
                              )}
                            </div>
                            {selected && (
                              <Check
                                size={16}
                                style={{ color: 'var(--color-accent)', flexShrink: 0 }}
                              />
                            )}
                          </button>

                          {isSavedCustom && (
                            <button
                              type="button"
                              className="ghost-icon-btn"
                              aria-label={`Remove ${modelId}`}
                              style={{
                                minWidth: 32,
                                minHeight: 32,
                                color: 'var(--color-muted)',
                              }}
                              onClick={() => handleRemoveSavedModel(modelId)}
                            >
                              <X size={14} />
                            </button>
                          )}
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
