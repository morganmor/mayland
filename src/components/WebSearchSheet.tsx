import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowUpRight,
  Paperclip,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { SEARCH_PROVIDERS, getSearchProviderSpec } from '../adapters/searchProviders';
import {
  executeWebSearch,
  formatSearchResultsForPrompt,
} from '../adapters/webSearchTool';
import type {
  Attachment,
  SearchEngineConfig,
  SearchKeyMetadata,
  SearchProviderId,
  WebSearchResult,
} from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';
import { SearchProviderLogo } from './SearchProviderLogos';

interface WebSearchSheetProps {
  open: boolean;
  config: SearchEngineConfig;
  keyMetadata: Partial<Record<SearchProviderId, SearchKeyMetadata>>;
  onClose: () => void;
  onConfigChange: (next: SearchEngineConfig) => void;
  onOpenSearchSettings: () => void;
  onAttachResults: (attachment: Attachment, queryText: string) => void;
  onAskAiWithResults: (promptText: string) => void;
}

function getDomainLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

export const WebSearchSheet: React.FC<WebSearchSheetProps> = ({
  open,
  config,
  keyMetadata,
  onClose,
  onConfigChange,
  onOpenSearchSettings,
  onAttachResults,
  onAskAiWithResults,
}) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<WebSearchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const configuredProviders = SEARCH_PROVIDERS.filter((p) =>
    Boolean(keyMetadata[p.id])
  );
  const activeSpec = getSearchProviderSpec(config.activeProviderId);
  const activeHasKey = Boolean(keyMetadata[config.activeProviderId]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      abortRef.current?.abort();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleRunSearch = async (overrideProviderId?: SearchProviderId) => {
    const providerId = overrideProviderId ?? config.activeProviderId;
    const cleaned = query.trim();
    if (!cleaned) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    triggerHaptic('light');
    try {
      const res = await executeWebSearch({
        providerId,
        query: cleaned,
        maxResults: config.maxResults,
        signal: controller.signal,
      });
      setResult(res);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setResult({
          ok: false,
          providerId,
          providerName: getSearchProviderSpec(providerId).name,
          query: cleaned,
          results: [],
          elapsedMs: 1,
          error: (err as Error).message || 'Search failed.',
        });
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAttachToComposer = () => {
    if (!result || !result.ok) return;
    const formatted = formatSearchResultsForPrompt(result);
    const attachment: Attachment = {
      id: `att-search-${Date.now().toString(36)}`,
      kind: 'text',
      name: `search-${result.providerId}.txt`,
      mimeType: 'text/plain',
      size: formatted.length,
      textContent: formatted,
    };
    triggerHaptic('medium');
    onAttachResults(attachment, result.query);
    onClose();
  };

  const handleSendToAi = () => {
    if (!result || !result.ok) return;
    const formatted = formatSearchResultsForPrompt(result);
    const promptText = `Based on these live ${result.providerName} search results, answer the query: "${result.query}"\n\n${formatted}`;
    triggerHaptic('medium');
    onClose();
    onAskAiWithResults(promptText);
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
              className="center-modal web-search-modal"
              aria-label="Web Search Engine"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="provider-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <SearchProviderLogo providerId={activeSpec.id} size={30} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <h2 className="drawer-title">Web Search</h2>
                    <span style={{ fontSize: '0.73rem', color: 'var(--color-muted)' }}>
                      {activeSpec.name} · {activeHasKey ? 'Ready' : 'API key required'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{ minHeight: 34, padding: '0 10px', fontSize: '0.78rem' }}
                    onClick={() => {
                      triggerHaptic('light');
                      onClose();
                      onOpenSearchSettings();
                    }}
                  >
                    <Settings size={13} />
                    <span>Providers</span>
                  </button>
                  <button
                    type="button"
                    className="ghost-icon-btn"
                    aria-label="Close web search"
                    style={{ minWidth: 36, minHeight: 36 }}
                    onClick={onClose}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="sheet-scroll" style={{ paddingTop: 14 }}>
                {/* Provider Quick Switcher Chips (when multiple configured) */}
                {configuredProviders.length > 0 && (
                  <div className="search-chip-strip no-scrollbar">
                    {configuredProviders.map((prov) => {
                      const active = prov.id === config.activeProviderId;
                      return (
                        <button
                          key={prov.id}
                          type="button"
                          className="search-provider-chip"
                          data-active={active ? 'true' : 'false'}
                          onClick={() => {
                            triggerHaptic('light');
                            onConfigChange({ ...config, activeProviderId: prov.id });
                            if (query.trim()) {
                              void handleRunSearch(prov.id);
                            }
                          }}
                        >
                          <SearchProviderLogo providerId={prov.id} size={18} />
                          <span>{prov.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search Input Row */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRunSearch();
                  }}
                  style={{ display: 'flex', gap: 8 }}
                >
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      ref={inputRef}
                      id="web-search-query"
                      name="webSearchQuery"
                      type="search"
                      className="drawer-field"
                      placeholder={`Search the web with ${activeSpec.name}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="accent-pill-btn"
                    disabled={searching || !query.trim() || !activeHasKey}
                    style={{ minHeight: 42, padding: '0 16px' }}
                  >
                    <span>{searching ? 'Searching…' : 'Search'}</span>
                  </button>
                </form>

                {/* Setup Empty State if no API key saved */}
                {!activeHasKey && (
                  <div className="drawer-section-card" style={{ gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                        Connect a Free Monthly Search API
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', lineHeight: 1.5 }}>
                        Add an API key for any supported provider in Settings → Search Engine. Your key is stored securely on-device.
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SEARCH_PROVIDERS.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 9px 4px 5px',
                            borderRadius: 999,
                            backgroundColor: 'var(--color-paper-3)',
                            fontSize: '0.75rem',
                            color: 'var(--color-ink-2)',
                          }}
                        >
                          <SearchProviderLogo providerId={p.id} size={20} />
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <button
                        type="button"
                        className="accent-pill-btn"
                        style={{ minHeight: 38, padding: '0 14px', fontSize: '0.84rem' }}
                        onClick={() => {
                          triggerHaptic('light');
                          onClose();
                          onOpenSearchSettings();
                        }}
                      >
                        <Settings size={14} />
                        <span>Add Search API Key</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {result && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {!result.ok ? (
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: 14,
                          backgroundColor: 'var(--color-danger-soft)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 9,
                          fontSize: '0.86rem',
                          color: 'var(--color-ink)',
                        }}
                      >
                        <AlertCircle
                          size={17}
                          style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }}
                        />
                        <span>{result.error}</span>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            fontSize: '0.76rem',
                            color: 'var(--color-muted)',
                          }}
                        >
                          <span className="tabular-nums">
                            {result.results.length} results from {result.providerName} ·{' '}
                            {result.elapsedMs}ms
                          </span>
                        </div>

                        {result.answer && (
                          <div className="drawer-section-card" style={{ gap: 6 }}>
                            <span className="drawer-label" style={{ color: 'var(--color-accent)' }}>
                              Quick Answer
                            </span>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '0.88rem',
                                lineHeight: 1.52,
                                color: 'var(--color-ink)',
                              }}
                            >
                              {result.answer}
                            </p>
                          </div>
                        )}

                        {result.results.length === 0 ? (
                          <div
                            style={{
                              padding: '20px 12px',
                              textAlign: 'center',
                              fontSize: '0.84rem',
                              color: 'var(--color-muted)',
                            }}
                          >
                            No web results returned for "{result.query}".
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {result.results.map((item, idx) => (
                              <a
                                key={`${item.url}-${idx}`}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="search-result-card"
                              >
                                <div className="search-result-head">
                                  <span className="search-result-domain">
                                    {getDomainLabel(item.url)}
                                    {item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ''}
                                  </span>
                                  <ArrowUpRight
                                    size={14}
                                    style={{ color: 'var(--color-muted)', flexShrink: 0 }}
                                  />
                                </div>
                                <span className="search-result-title">{item.title}</span>
                                {item.snippet && (
                                  <p className="search-result-snippet">{item.snippet}</p>
                                )}
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {result?.ok && result.results.length > 0 && (
                <div className="modal-footer-bar">
                  <button
                    type="button"
                    className="tonal-pill-btn"
                    style={{ minHeight: 38, padding: '0 13px', fontSize: '0.82rem' }}
                    onClick={handleAttachToComposer}
                  >
                    <Paperclip size={14} />
                    <span>Attach to Prompt</span>
                  </button>

                  <button
                    type="button"
                    className="accent-pill-btn"
                    style={{ minHeight: 38, padding: '0 15px', fontSize: '0.84rem' }}
                    onClick={handleSendToAi}
                  >
                    <Sparkles size={14} />
                    <span>Ask AI with Results</span>
                  </button>
                </div>
              )}
            </motion.section>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
