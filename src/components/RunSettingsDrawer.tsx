import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Code2,
  Globe,
  KeyRound,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  formatCompactTokens,
  getOutputCeiling,
  lookupModelSpec,
} from '../adapters/modelsDev';
import { getSearchProviderSpec } from '../adapters/searchProviders';
import { useI18n } from '../i18n';
import type {
  ProviderProfile,
  RunSettings,
  SearchProviderId,
} from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';
import { EffortSlider } from './EffortSlider';
import { RigelSlider } from './RigelSlider';
import { SearchProviderLogo } from './SearchProviderLogos';

interface RunSettingsDrawerProps {
  open: boolean;
  settings: RunSettings;
  activeProfile: ProviderProfile;
  savedPromptsCount: number;
  activeSearchProviderId: SearchProviderId;
  hasActiveSearchKey: boolean;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<RunSettings>) => void;
  onResetDefaults: () => void;
  onOpenModelPicker: () => void;
  onOpenVault: () => void;
  onOpenSearchSettings: () => void;
  onOpenGetCode: () => void;
  onOpenSavedPrompts: () => void;
}

const SwitchControl: React.FC<{
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (next: boolean) => void;
}> = ({ checked, label, hint, onChange }) => {
  return (
    <div className="toggle-row">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: '0.92rem', color: 'var(--color-ink)' }}>{label}</span>
        {hint && (
          <span style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>{hint}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="toggle-switch"
        data-checked={checked ? 'true' : 'false'}
        onClick={() => {
          triggerHaptic('light');
          onChange(!checked);
        }}
      >
        <motion.span
          className="toggle-knob"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 460, damping: 32 }}
        />
      </button>
    </div>
  );
};

export const RunSettingsDrawer: React.FC<RunSettingsDrawerProps> = ({
  open,
  settings,
  activeProfile,
  savedPromptsCount,
  activeSearchProviderId,
  hasActiveSearchKey,
  onClose,
  onUpdateSettings,
  onResetDefaults,
  onOpenModelPicker,
  onOpenVault,
  onOpenSearchSettings,
  onOpenGetCode,
  onOpenSavedPrompts,
}) => {
  const { t } = useI18n();
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(true);

  const activeSearchSpec = getSearchProviderSpec(activeSearchProviderId);

  const modelSpec = lookupModelSpec(activeProfile.preset, settings.model);
  const outputCeiling = getOutputCeiling(activeProfile.preset, settings.model);
  const isTempOff = settings.temperature === null;
  const isTopPOff = settings.topP === null;
  const isAutoMax = settings.maxTokens === null;
  const sliderTokensValue = Math.min(
    outputCeiling,
    settings.maxTokens ?? outputCeiling
  );
  const sliderStep = outputCeiling >= 500_000 ? 4096 : 1024;

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
        className="drawer-panel"
        data-side="right"
        data-open={open ? 'true' : 'false'}
        aria-label={t.runSettings.ariaLabel}
        aria-hidden={!open}
        inert={!open}
      >
            <div className="drawer-header">
              <h2 className="drawer-title">{t.runSettings.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button
                  type="button"
                  className="tonal-pill-btn"
                  style={{
                    minHeight: 36,
                    padding: '0 10px',
                    fontSize: '0.82rem',
                    backgroundColor: 'transparent',
                    color: 'var(--color-ink-2)',
                  }}
                  onClick={() => {
                    triggerHaptic('light');
                    onOpenGetCode();
                  }}
                >
                  <Code2 size={16} />
                  <span>{t.runSettings.getCode}</span>
                </button>
                <button
                  type="button"
                  className="ghost-icon-btn"
                  aria-label={t.runSettings.resetDefaultsAria}
                  onClick={() => {
                    triggerHaptic('medium');
                    onResetDefaults();
                  }}
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  type="button"
                  className="ghost-icon-btn"
                  aria-label={t.runSettings.closeAria}
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="drawer-scroll">
              {/* Model Summary Card (AI Studio Style) */}
              <button
                type="button"
                className="drawer-flat-block"
                style={{ textAlign: 'left' }}
                onClick={() => {
                  triggerHaptic('light');
                  onOpenModelPicker();
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: '0.96rem', fontWeight: 560 }}>
                    {modelSpec?.name ||
                      (settings.model
                        ? settings.model.split('/').pop()
                        : t.runSettings.setDefaultModel)}
                  </span>
                  <ChevronRight size={17} style={{ color: 'var(--color-muted)' }} />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: settings.model ? 'var(--color-ink-2)' : 'var(--color-muted)',
                    wordBreak: 'break-all',
                  }}
                >
                  {settings.model || t.runSettings.noModelSelected}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 6,
                    fontSize: '0.76rem',
                    color: 'var(--color-muted)',
                  }}
                >
                  <span>{activeProfile.name}</span>
                  {modelSpec && (
                    <span className="tabular-nums">
                      · {formatCompactTokens(modelSpec.context)} ctx ·{' '}
                      {formatCompactTokens(modelSpec.output)} out
                    </span>
                  )}
                </div>
              </button>

              {/* System Instructions */}
              <div className="drawer-flat-block">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="drawer-label">{t.runSettings.systemInstructions}</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {[
                      {
                        label: t.runSettings.presetConcise,
                        text: t.runSettings.presetConciseText,
                      },
                      {
                        label: t.runSettings.presetCoding,
                        text: t.runSettings.presetCodingText,
                      },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="soft-badge"
                        onClick={() =>
                          onUpdateSettings({ systemInstructions: preset.text })
                        }
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="soft-badge"
                      data-tone={savedPromptsCount > 0 ? 'accent' : undefined}
                      onClick={() => {
                        triggerHaptic('light');
                        onOpenSavedPrompts();
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <Bookmark size={11} />
                      <span>
                        {t.runSettings.saved}
                        {savedPromptsCount > 0 ? ` (${savedPromptsCount})` : ''}
                      </span>
                    </button>
                  </div>
                </div>

                <textarea
                  id="run-system-instructions"
                  name="systemInstructions"
                  rows={5}
                  className="drawer-inline-textarea"
                  placeholder={t.runSettings.instructionsPlaceholder}
                  value={settings.systemInstructions}
                  onChange={(e) =>
                    onUpdateSettings({ systemInstructions: e.target.value })
                  }
                />
              </div>

              <button
                type="button"
                className="drawer-flat-row"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenVault();
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
                  <KeyRound size={15} style={{ color: 'var(--color-muted)' }} />
                  <span>{t.runSettings.apiAndProviders}</span>
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-muted)' }} />
              </button>

              {/* Animated Thinking Level Slider Bar */}
              <EffortSlider
                value={settings.thinkingEffort}
                onChange={(thinkingEffort) =>
                  onUpdateSettings({ thinkingEffort })
                }
                label={t.runSettings.thinkingLevel}
                active={open}
              />

              {/* User-Facing Tools & Mobile Preferences */}
              <div>
                <button
                  type="button"
                  onClick={() => setToolsExpanded((v) => !v)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 44,
                    color: 'var(--color-ink-2)',
                    fontSize: '0.84rem',
                    fontWeight: 550,
                  }}
                >
                  <span>{t.runSettings.tools}</span>
                  <motion.span
                    animate={{ rotate: toolsExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'inline-flex' }}
                  >
                    <ChevronDown size={17} />
                  </motion.span>
                </button>

                <div
                  className="thoughts-grid"
                  data-open={toolsExpanded ? 'true' : 'false'}
                >
                  <div className="thoughts-inner">
                    <SwitchControl
                      label={t.runSettings.webSearchLabel}
                      hint={
                        hasActiveSearchKey
                          ? t.runSettings.webSearchHintActive(activeSearchSpec.name)
                          : t.runSettings.webSearchHintSetup(activeSearchSpec.name)
                      }
                      checked={Boolean((settings.webSearchEnabled ?? true) && hasActiveSearchKey)}
                      onChange={(webSearchEnabled) => {
                        if (!hasActiveSearchKey) {
                          onClose();
                          onOpenSearchSettings();
                          return;
                        }
                        onUpdateSettings({ webSearchEnabled });
                      }}
                    />
                    <button
                      type="button"
                      className="drawer-flat-row"
                      style={{ marginBottom: 4 }}
                      onClick={() => {
                        triggerHaptic('light');
                        onClose();
                        onOpenSearchSettings();
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
                        <SearchProviderLogo providerId={activeSearchSpec.id} size={20} />
                        <span>{t.runSettings.searchEnginePrefix(activeSearchSpec.name)}</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: hasActiveSearchKey ? 'var(--color-success)' : 'var(--color-muted)' }}>
                        <Globe size={12} />
                        <span>{hasActiveSearchKey ? t.runSettings.keySaved : t.runSettings.setup}</span>
                        <ChevronRight size={14} />
                      </span>
                    </button>
                    <SwitchControl
                      label={t.runSettings.webFetchLabel}
                      hint={t.runSettings.webFetchHint}
                      checked={settings.webFetchEnabled ?? true}
                      onChange={(webFetchEnabled) =>
                        onUpdateSettings({ webFetchEnabled })
                      }
                    />
                    <SwitchControl
                      label={t.runSettings.jsonLabel}
                      hint={t.runSettings.jsonHint}
                      checked={settings.jsonMode}
                      onChange={(jsonMode) => onUpdateSettings({ jsonMode })}
                    />
                    <SwitchControl
                      label={t.runSettings.autoScrollLabel}
                      hint={t.runSettings.autoScrollHint}
                      checked={settings.autoScroll ?? true}
                      onChange={(autoScroll) => onUpdateSettings({ autoScroll })}
                    />
                    <SwitchControl
                      label={t.runSettings.hapticsLabel}
                      hint={t.runSettings.hapticsHint}
                      checked={settings.hapticsEnabled ?? true}
                      onChange={(hapticsEnabled) =>
                        onUpdateSettings({ hapticsEnabled })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Settings & Appearance */}
              <div>
                <button
                  type="button"
                  onClick={() => setAdvancedExpanded((v) => !v)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 44,
                    color: 'var(--color-ink-2)',
                    fontSize: '0.84rem',
                    fontWeight: 550,
                  }}
                >
                  <span>{t.runSettings.advancedSettings}</span>
                  <motion.span
                    animate={{ rotate: advancedExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'inline-flex' }}
                  >
                    <ChevronDown size={17} />
                  </motion.span>
                </button>

                <div
                  className="thoughts-grid"
                  data-open={advancedExpanded ? 'true' : 'false'}
                >
                  <div
                    className="thoughts-inner"
                    style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontSize: '0.85rem',
                        }}
                      >
                        <span>{t.runSettings.temperature}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="soft-badge"
                            data-tone={isTempOff ? 'accent' : undefined}
                            onClick={() => {
                              triggerHaptic('light');
                              onUpdateSettings({
                                temperature: isTempOff ? 1.0 : null,
                              });
                            }}
                          >
                            {isTempOff ? t.runSettings.offProvider : t.runSettings.off}
                          </button>
                          {settings.temperature !== null && (
                            <span
                              className="tabular-nums"
                              style={{ color: 'var(--color-accent)', fontWeight: 560 }}
                            >
                              {settings.temperature.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      {settings.temperature !== null ? (
                        <RigelSlider
                          id="range-temperature"
                          ariaLabel={t.runSettings.temperature}
                          min={0}
                          max={2}
                          step={0.05}
                          value={settings.temperature}
                          onChange={(temperature) => onUpdateSettings({ temperature })}
                        />
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                          {t.runSettings.followsProviderDefault}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontSize: '0.85rem',
                        }}
                      >
                        <span>{t.runSettings.topP}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="soft-badge"
                            data-tone={isTopPOff ? 'accent' : undefined}
                            onClick={() => {
                              triggerHaptic('light');
                              onUpdateSettings({
                                topP: isTopPOff ? 0.95 : null,
                              });
                            }}
                          >
                            {isTopPOff ? t.runSettings.offProvider : t.runSettings.off}
                          </button>
                          {settings.topP !== null && (
                            <span
                              className="tabular-nums"
                              style={{ color: 'var(--color-accent)', fontWeight: 560 }}
                            >
                              {settings.topP.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      {settings.topP !== null ? (
                        <RigelSlider
                          id="range-top-p"
                          ariaLabel={t.runSettings.topP}
                          min={0.05}
                          max={1}
                          step={0.05}
                          value={settings.topP}
                          onChange={(topP) => onUpdateSettings({ topP })}
                        />
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                          {t.runSettings.followsProviderDefault}
                        </span>
                      )}
                    </div>

                    {/* Max Output Tokens — Off / Provider Max + Dynamic models.dev Ceiling */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>{t.runSettings.maxOutputTokens}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="soft-badge"
                            data-tone={isAutoMax ? 'accent' : undefined}
                            onClick={() => {
                              triggerHaptic('light');
                              onUpdateSettings({
                                maxTokens: isAutoMax ? outputCeiling : null,
                              });
                            }}
                          >
                            {isAutoMax
                              ? `${t.runSettings.offAuto} (${formatCompactTokens(outputCeiling)})`
                              : t.runSettings.offAuto}
                          </button>
                          {!isAutoMax && (
                            <span
                              className="tabular-nums"
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 560,
                                color: 'var(--color-accent)',
                              }}
                            >
                              {new Intl.NumberFormat('en-US').format(sliderTokensValue)}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isAutoMax ? (
                        <>
                          <RigelSlider
                            id="range-max-tokens"
                            ariaLabel={t.runSettings.maxOutputTokens}
                            min={1024}
                            max={outputCeiling}
                            step={sliderStep}
                            value={sliderTokensValue}
                            onChange={(maxTokens) => onUpdateSettings({ maxTokens })}
                          />

                          <input
                            id="input-max-tokens"
                            name="maxTokensExact"
                            type="number"
                            min={1}
                            max={2_000_000}
                            className="drawer-field tabular-nums"
                            value={settings.maxTokens ?? ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (Number.isFinite(val) && val > 0) {
                                onUpdateSettings({ maxTokens: val });
                              }
                            }}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.82rem',
                              padding: '8px 12px',
                              backgroundColor: 'var(--color-paper-3)',
                            }}
                          />
                        </>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                          {t.runSettings.followsProviderMax}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </aside>
    </>
  );
};
