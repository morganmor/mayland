import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { SEARCH_PROVIDERS, getSearchProviderSpec } from '../adapters/searchProviders';
import { executeWebSearch } from '../adapters/webSearchTool';
import type { SearchVaultInfo } from '../crypto/searchKeyStore';
import type {
  SearchEngineConfig,
  SearchKeyMetadata,
  SearchProviderId,
} from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';
import { SearchProviderLogo } from './SearchProviderLogos';

interface SearchEngineSettingsPanelProps {
  config: SearchEngineConfig;
  keyMetadata: Partial<Record<SearchProviderId, SearchKeyMetadata>>;
  vaultInfo: SearchVaultInfo;
  onConfigChange: (next: SearchEngineConfig) => void;
  onSaveKey: (providerId: SearchProviderId, rawKey: string) => Promise<void>;
  onDeleteKey: (providerId: SearchProviderId) => Promise<void>;
  onVerifyVault: () => Promise<{
    passed: boolean;
    algorithm: string;
    hardwareBacked: boolean;
    durationMs: number;
  }>;
  onOpenSearchSheet?: () => void;
  onNotify: (message: string, tone?: 'info' | 'error') => void;
}

const RESULT_COUNT_OPTIONS = [5, 8, 10] as const;

export const SearchEngineSettingsPanel: React.FC<SearchEngineSettingsPanelProps> = ({
  config,
  keyMetadata,
  vaultInfo,
  onConfigChange,
  onSaveKey,
  onDeleteKey,
  onVerifyVault,
  onOpenSearchSheet,
  onNotify,
}) => {
  const [expandedId, setExpandedId] = useState<SearchProviderId | null>(
    config.activeProviderId
  );
  const [draftKeys, setDraftKeys] = useState<Partial<Record<SearchProviderId, string>>>(
    {}
  );
  const [visibleKeys, setVisibleKeys] = useState<
    Partial<Record<SearchProviderId, boolean>>
  >({});
  const [savingId, setSavingId] = useState<SearchProviderId | null>(null);
  const [testingId, setTestingId] = useState<SearchProviderId | null>(null);
  const [testResults, setTestResults] = useState<
    Partial<Record<SearchProviderId, { ok: boolean; text: string }>>
  >({});
  const [vaultCheckNote, setVaultCheckNote] = useState<string | null>(null);

  const activeSpec = getSearchProviderSpec(config.activeProviderId);
  const activeMeta = keyMetadata[config.activeProviderId];
  const savedCount = Object.keys(keyMetadata).length;

  const handleSave = async (providerId: SearchProviderId) => {
    const raw = (draftKeys[providerId] ?? '').trim();
    if (!raw) {
      onNotify('Paste an API key first.', 'error');
      return;
    }

    setSavingId(providerId);
    try {
      await onSaveKey(providerId, raw);
      setDraftKeys((prev) => ({ ...prev, [providerId]: '' }));
      setVisibleKeys((prev) => ({ ...prev, [providerId]: false }));
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      if (!keyMetadata[config.activeProviderId]) {
        onConfigChange({ ...config, activeProviderId: providerId });
      }
      triggerHaptic('medium');
    } catch (err) {
      onNotify((err as Error).message || 'Failed to store API key securely.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleTest = async (providerId: SearchProviderId) => {
    setTestingId(providerId);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    try {
      const res = await executeWebSearch({
        providerId,
        query: 'OpenAI GPT',
        maxResults: 3,
      });
      if (res.ok) {
        triggerHaptic('light');
        setTestResults((prev) => ({
          ...prev,
          [providerId]: {
            ok: true,
            text: `Connected · ${res.results.length} results in ${res.elapsedMs}ms`,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [providerId]: {
            ok: false,
            text: res.error || 'Connection test failed',
          },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          ok: false,
          text: (err as Error).message || 'Connection test failed',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleVerify = async () => {
    try {
      const res = await onVerifyVault();
      triggerHaptic('light');
      const hwLabel = res.hardwareBacked ? ' · Hardware-backed' : '';
      setVaultCheckNote(
        `${res.passed ? 'PASS' : 'FAIL'} · ${res.algorithm}${hwLabel} · ${res.durationMs}ms`
      );
    } catch (err) {
      onNotify((err as Error).message || 'Vault verification failed.', 'error');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 className="drawer-title">Search Engine</h3>
        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
          Monthly free search API providers. Paste an API key to enable live web search.
        </span>
      </div>

      {/* Secure Storage Status Banner */}
      <div className="drawer-section-card" style={{ gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: '0.86rem',
              fontWeight: 560,
              color: 'var(--color-ink)',
            }}
          >
            <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
            <span>
              {vaultInfo.backend === 'android-keystore'
                ? 'Android Keystore Vault'
                : 'Encrypted Local Vault'}
            </span>
          </span>
          <span className="soft-badge" data-tone="success">
            {vaultInfo.hardwareBacked
              ? 'Hardware AES-256-GCM'
              : 'AES-256-GCM'}
          </span>
        </div>

        <span style={{ fontSize: '0.76rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>
          {vaultInfo.backend === 'android-keystore'
            ? 'Search API keys are encrypted with a non-exportable AndroidKeyStore AES-256-GCM key inside app-private Android storage and excluded from cloud/file backups.'
            : 'Search API keys are encrypted locally with WebCrypto AES-256-GCM before storage — never saved in plaintext.'}
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="soft-badge"
              onClick={handleVerify}
            >
              Verify encryption
            </button>
            {vaultCheckNote && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--color-success)',
                }}
              >
                {vaultCheckNote}
              </span>
            )}
          </div>
          <span
            className="tabular-nums"
            style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}
          >
            {savedCount}/{SEARCH_PROVIDERS.length} keys saved
          </span>
        </div>
      </div>

      {/* Active Search Provider & Max Results Strip */}
      <div className="search-active-strip">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            flex: 1,
          }}
        >
          <SearchProviderLogo providerId={activeSpec.id} size={36} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                {activeSpec.name}
              </span>
              <span
                className="soft-badge"
                data-tone={activeMeta ? 'success' : undefined}
              >
                {activeMeta ? `Active · ${activeMeta.maskedPreview}` : 'Needs API key'}
              </span>
            </div>
            <span style={{ fontSize: '0.73rem', color: 'var(--color-muted)' }}>
              {activeSpec.freeMonthlyQuota}
              {activeSpec.noCardRequired ? ' · No card required' : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="search-count-pills" role="group" aria-label="Results per search">
            {RESULT_COUNT_OPTIONS.map((cnt) => (
              <button
                key={cnt}
                type="button"
                className="search-count-pill tabular-nums"
                data-active={config.maxResults === cnt ? 'true' : 'false'}
                onClick={() => {
                  triggerHaptic('light');
                  onConfigChange({ ...config, maxResults: cnt });
                }}
              >
                {cnt} res
              </button>
            ))}
          </div>

          {onOpenSearchSheet && (
            <button
              type="button"
              className="tonal-pill-btn"
              style={{ minHeight: 34, padding: '0 12px', fontSize: '0.78rem' }}
              onClick={() => {
                triggerHaptic('light');
                onOpenSearchSheet();
              }}
            >
              <Search size={13} />
              <span>Try Search</span>
            </button>
          )}
        </div>
      </div>

      {/* Free Monthly Providers Directory */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="drawer-label">Providers with Free Monthly Tiers</span>
        <div className="search-provider-list">
          {SEARCH_PROVIDERS.map((provider) => {
            const meta = keyMetadata[provider.id];
            const isActive = config.activeProviderId === provider.id;
            const isExpanded = expandedId === provider.id;
            const draft = draftKeys[provider.id] ?? '';
            const showSecret = Boolean(visibleKeys[provider.id]);
            const testResult = testResults[provider.id];
            const isSaving = savingId === provider.id;
            const isTesting = testingId === provider.id;

            return (
              <div
                key={provider.id}
                className="search-provider-card"
                data-active={isActive ? 'true' : 'false'}
                data-expanded={isExpanded ? 'true' : 'false'}
              >
                <button
                  type="button"
                  className="search-provider-head"
                  aria-expanded={isExpanded}
                  onClick={() => {
                    triggerHaptic('light');
                    setExpandedId((cur) => (cur === provider.id ? null : provider.id));
                  }}
                >
                  <SearchProviderLogo providerId={provider.id} size={38} />

                  <div className="search-provider-meta">
                    <div className="search-provider-title-row">
                      <span className="search-provider-name">{provider.name}</span>
                      {isActive && (
                        <span className="soft-badge" data-tone="accent">
                          Active
                        </span>
                      )}
                      {meta && (
                        <span className="soft-badge" data-tone="success">
                          Key saved
                        </span>
                      )}
                    </div>
                    <span className="search-provider-tagline">{provider.tagline}</span>
                    <div className="search-provider-badges">
                      <span className="search-quota-pill">
                        {provider.freeMonthlyQuota}
                      </span>
                      <span className="search-card-pill">
                        {provider.noCardRequired ? 'No card' : 'Card verification'}
                      </span>
                    </div>
                  </div>

                  <ChevronDown
                    size={16}
                    style={{
                      color: 'var(--color-muted)',
                      flexShrink: 0,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 160ms var(--ease-out)',
                    }}
                  />
                </button>

                {isExpanded && (
                  <div className="search-provider-body">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.73rem',
                          color: 'var(--color-muted)',
                        }}
                      >
                        {provider.endpointHost}
                        {meta ? ` · ${meta.maskedPreview}` : ''}
                      </span>

                      <a
                        href={provider.apiKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="search-get-key-link"
                      >
                        <span>Get free API key</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        <input
                          id={`search-key-${provider.id}`}
                          name={`searchKey_${provider.id}`}
                          type={showSecret ? 'text' : 'password'}
                          className="drawer-field"
                          autoComplete="off"
                          value={draft}
                          placeholder={
                            meta
                              ? 'Paste new API key to replace…'
                              : `Enter ${provider.name} API key (${provider.keyPlaceholder})`
                          }
                          onChange={(e) =>
                            setDraftKeys((prev) => ({
                              ...prev,
                              [provider.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && draft.trim()) {
                              e.preventDefault();
                              void handleSave(provider.id);
                            }
                          }}
                          style={{
                            paddingRight: 40,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--color-paper-3)',
                          }}
                        />
                        <button
                          type="button"
                          aria-label={showSecret ? 'Hide API key' : 'Show API key'}
                          onClick={() =>
                            setVisibleKeys((prev) => ({
                              ...prev,
                              [provider.id]: !prev[provider.id],
                            }))
                          }
                          style={{
                            position: 'absolute',
                            right: 6,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            padding: 6,
                            color: 'var(--color-muted)',
                          }}
                        >
                          {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="accent-pill-btn"
                        disabled={isSaving || !draft.trim()}
                        onClick={() => void handleSave(provider.id)}
                        style={{ minHeight: 40, padding: '0 14px', fontSize: '0.82rem' }}
                      >
                        <Check size={14} />
                        <span>{isSaving ? 'Saving…' : 'Save Key'}</span>
                      </button>
                    </div>

                    {meta && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!isActive && (
                            <button
                              type="button"
                              className="tonal-pill-btn"
                              style={{ minHeight: 34, padding: '0 12px', fontSize: '0.78rem' }}
                              onClick={() => {
                                triggerHaptic('light');
                                onConfigChange({
                                  ...config,
                                  activeProviderId: provider.id,
                                });
                                onNotify(`Active search engine set to ${provider.name}`);
                              }}
                            >
                              <Check size={13} />
                              <span>Set Active</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="tonal-pill-btn"
                            disabled={isTesting}
                            style={{ minHeight: 34, padding: '0 12px', fontSize: '0.78rem' }}
                            onClick={() => void handleTest(provider.id)}
                          >
                            <FlaskConical size={13} />
                            <span>{isTesting ? 'Testing…' : 'Test Search'}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          className="turn-action-btn turn-action-btn--sm"
                          data-tone="danger"
                          onClick={() => {
                            triggerHaptic('medium');
                            void onDeleteKey(provider.id);
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}

                    {testResult && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          fontFamily: 'var(--font-mono)',
                          color: testResult.ok
                            ? 'var(--color-success)'
                            : 'var(--color-danger)',
                          wordBreak: 'break-word',
                        }}
                      >
                        {testResult.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
