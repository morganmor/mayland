import { CapacitorHttp } from '@capacitor/core';
import { getSearchProviderSpec } from './searchProviders';
import { searchKeyStore } from '../crypto/searchKeyStore';
import type {
  SearchProviderId,
  SearchResultItem,
  WebSearchResult,
} from '../types/mayland';
import { isNativeMobile } from '../utils/nativeBridge';

export const WEB_SEARCH_TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'search_web',
    description:
      'Search the live web using the user-configured search engine API to get recent facts, news, documentation, and source URLs.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Concise search query keywords or question.',
        },
        max_results: {
          type: 'integer',
          description: 'Optional maximum number of search results (1-10).',
        },
      },
      required: ['query'],
    },
  },
};

interface HttpResponseBox {
  ok: boolean;
  status: number;
  data: unknown;
  rawText: string;
}

async function performSearchHttp(options: {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<HttpResponseBox> {
  const { url, method, headers, body, signal } = options;
  const serializedBody = body ? JSON.stringify(body) : undefined;

  if (isNativeMobile()) {
    const nativeRes = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: body ?? undefined,
      responseType: 'text',
    });
    const rawText =
      typeof nativeRes.data === 'string'
        ? nativeRes.data
        : JSON.stringify(nativeRes.data ?? {});
    let parsed: unknown = nativeRes.data;
    if (typeof nativeRes.data === 'string') {
      try {
        parsed = JSON.parse(nativeRes.data);
      } catch {
        parsed = { message: nativeRes.data };
      }
    }
    return {
      ok: nativeRes.status >= 200 && nativeRes.status < 300,
      status: nativeRes.status,
      data: parsed,
      rawText,
    };
  }

  const init: RequestInit = {
    method,
    headers,
    body: serializedBody,
    signal,
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if ((err as Error).name === 'AbortError' || signal?.aborted) {
      throw err;
    }
    if (
      typeof window !== 'undefined' &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ) {
      const proxyUrl = `/__mayland_proxy?target=${encodeURIComponent(url)}`;
      res = await fetch(proxyUrl, init);
    } else {
      throw err;
    }
  }

  const rawText = await res.text();
  let parsed: unknown = {};
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { message: rawText };
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    data: parsed,
    rawText,
  };
}

function extractApiError(status: number, data: unknown, rawText: string, providerName: string): string {
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const nestedErr = obj.error && typeof obj.error === 'object'
    ? (obj.error as Record<string, unknown>).message
    : typeof obj.error === 'string'
      ? obj.error
      : undefined;
  const detail = String(
    nestedErr ?? obj.message ?? obj.detail ?? obj.msg ?? rawText.slice(0, 180)
  ).trim();

  if (status === 401 || status === 403) {
    return `${providerName}: Invalid or unauthorized API key (HTTP ${status}).${detail ? ` ${detail}` : ''}`;
  }
  if (status === 402 || status === 429) {
    return `${providerName}: Monthly free quota or rate limit reached (HTTP ${status}).${detail ? ` ${detail}` : ''}`;
  }
  return `${providerName} search failed (HTTP ${status})${detail ? `: ${detail}` : ''}`;
}

function clampCount(count?: number): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return 6;
  return Math.min(10, Math.max(1, Math.round(count)));
}

function cleanText(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.replace(/\s+/g, ' ').trim();
}

export async function executeWebSearchWithKey(params: {
  providerId: SearchProviderId;
  apiKey: string;
  query: string;
  maxResults?: number;
  signal?: AbortSignal;
}): Promise<WebSearchResult> {
  const { providerId, apiKey, query, signal } = params;
  const cleanedQuery = query.trim();
  const count = clampCount(params.maxResults);
  const spec = getSearchProviderSpec(providerId);
  const t0 = performance.now();

  if (!cleanedQuery) {
    return {
      ok: false,
      providerId,
      providerName: spec.name,
      query: '',
      results: [],
      elapsedMs: 1,
      error: 'Search query cannot be empty.',
    };
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return {
      ok: false,
      providerId,
      providerName: spec.name,
      query: cleanedQuery,
      results: [],
      elapsedMs: 1,
      error: `No API key configured for ${spec.name}. Add it in Settings → Search Engine.`,
    };
  }

  try {
    let box: HttpResponseBox;

    switch (providerId) {
      case 'tavily': {
        box = await performSearchHttp({
          url: 'https://api.tavily.com/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: {
            query: cleanedQuery,
            search_depth: 'basic',
            max_results: count,
            include_answer: true,
          },
          signal,
        });
        break;
      }
      case 'brave': {
        const qs = new URLSearchParams({
          q: cleanedQuery,
          count: String(count),
        });
        box = await performSearchHttp({
          url: `https://api.search.brave.com/res/v1/web/search?${qs.toString()}`,
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': trimmedKey,
          },
          signal,
        });
        break;
      }
      case 'exa': {
        box = await performSearchHttp({
          url: 'https://api.exa.ai/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': trimmedKey,
          },
          body: {
            query: cleanedQuery,
            type: 'auto',
            numResults: count,
            contents: { highlights: true },
          },
          signal,
        });
        break;
      }
      case 'serpapi': {
        const qs = new URLSearchParams({
          engine: 'google',
          q: cleanedQuery,
          num: String(count),
          api_key: trimmedKey,
        });
        box = await performSearchHttp({
          url: `https://serpapi.com/search.json?${qs.toString()}`,
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal,
        });
        break;
      }
      case 'linkup': {
        box = await performSearchHttp({
          url: 'https://api.linkup.so/v1/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: {
            q: cleanedQuery,
            depth: 'standard',
            outputType: 'searchResults',
          },
          signal,
        });
        break;
      }
      case 'firecrawl': {
        box = await performSearchHttp({
          url: 'https://api.firecrawl.dev/v2/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: {
            query: cleanedQuery,
            limit: count,
          },
          signal,
        });
        break;
      }
      case 'parallel': {
        box = await performSearchHttp({
          url: 'https://api.parallel.ai/v1/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': trimmedKey,
          },
          body: {
            objective: cleanedQuery,
            search_queries: [cleanedQuery],
            mode: 'fast',
            advanced_settings: {
              max_results: count,
            },
          },
          signal,
        });
        break;
      }
      case 'langsearch': {
        box = await performSearchHttp({
          url: 'https://api.langsearch.com/v1/web-search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: {
            query: cleanedQuery,
            count,
            summary: true,
            freshness: 'noLimit',
          },
          signal,
        });
        break;
      }
    }

    const elapsedMs = Math.max(1, Math.round(performance.now() - t0));

    if (!box.ok) {
      return {
        ok: false,
        providerId,
        providerName: spec.name,
        query: cleanedQuery,
        results: [],
        elapsedMs,
        error: extractApiError(box.status, box.data, box.rawText, spec.name),
      };
    }

    const normalized = normalizeProviderResponse(providerId, box.data, count);
    if (normalized.error) {
      return {
        ok: false,
        providerId,
        providerName: spec.name,
        query: cleanedQuery,
        results: [],
        elapsedMs,
        error: normalized.error,
      };
    }

    return {
      ok: true,
      providerId,
      providerName: spec.name,
      query: cleanedQuery,
      answer: normalized.answer,
      results: normalized.results,
      elapsedMs,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return {
      ok: false,
      providerId,
      providerName: spec.name,
      query: cleanedQuery,
      results: [],
      elapsedMs: Math.max(1, Math.round(performance.now() - t0)),
      error: (err as Error).message || `${spec.name} request failed.`,
    };
  }
}

export function normalizeProviderResponse(
  providerId: SearchProviderId,
  data: unknown,
  limit: number
): { answer?: string; results: SearchResultItem[]; error?: string } {
  const root = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const items: SearchResultItem[] = [];
  let answer: string | undefined;

  switch (providerId) {
    case 'tavily': {
      answer = cleanText(root.answer) || undefined;
      const raw = Array.isArray(root.results) ? root.results : [];
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.url);
        if (!url) continue;
        items.push({
          title: cleanText(row.title) || url,
          url,
          snippet: cleanText(row.content || row.raw_content).slice(0, 600),
          score: typeof row.score === 'number' ? row.score : undefined,
        });
      }
      break;
    }

    case 'brave': {
      const web = (root.web && typeof root.web === 'object'
        ? root.web
        : {}) as Record<string, unknown>;
      const raw = Array.isArray(web.results) ? web.results : [];
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.url);
        if (!url) continue;
        items.push({
          title: cleanText(row.title) || url,
          url,
          snippet: cleanText(row.description).slice(0, 600),
          publishedAt: cleanText(row.page_age) || undefined,
        });
      }
      break;
    }

    case 'exa': {
      const raw = Array.isArray(root.results) ? root.results : [];
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.url);
        if (!url) continue;
        const highlights = Array.isArray(row.highlights)
          ? row.highlights.map((h) => cleanText(h)).filter(Boolean).join(' … ')
          : '';
        items.push({
          title: cleanText(row.title) || url,
          url,
          snippet: cleanText(highlights || row.summary || row.text).slice(0, 600),
          publishedAt: cleanText(row.publishedDate) || undefined,
          score: typeof row.score === 'number' ? row.score : undefined,
        });
      }
      break;
    }

    case 'serpapi': {
      if (typeof root.error === 'string' && root.error) {
        return { results: [], error: `SerpApi: ${root.error}` };
      }
      const box = (root.answer_box && typeof root.answer_box === 'object'
        ? root.answer_box
        : {}) as Record<string, unknown>;
      answer = cleanText(box.answer || box.snippet) || undefined;
      const raw = Array.isArray(root.organic_results) ? root.organic_results : [];
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.link || row.url);
        if (!url) continue;
        items.push({
          title: cleanText(row.title) || url,
          url,
          snippet: cleanText(row.snippet).slice(0, 600),
        });
      }
      break;
    }

    case 'linkup': {
      answer = cleanText(root.answer) || undefined;
      const raw = Array.isArray(root.results) ? root.results : [];
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.url);
        if (!url) continue;
        items.push({
          title: cleanText(row.name || row.title) || url,
          url,
          snippet: cleanText(row.content).slice(0, 600),
          publishedAt: cleanText(row.publishedAt) || undefined,
        });
      }
      break;
    }

    case 'firecrawl': {
      if (root.success === false && typeof root.error === 'string') {
        return { results: [], error: `Firecrawl: ${root.error}` };
      }
      const payloadData = root.data;
      let raw: unknown[] = [];
      if (Array.isArray(payloadData)) {
        raw = payloadData;
      } else if (payloadData && typeof payloadData === 'object') {
        const webArr = (payloadData as Record<string, unknown>).web;
        if (Array.isArray(webArr)) raw = webArr;
      }
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.url);
        if (!url) continue;
        items.push({
          title: cleanText(row.title) || url,
          url,
          snippet: cleanText(row.description || row.markdown).slice(0, 600),
        });
      }
      break;
    }

    case 'parallel': {
      const raw = Array.isArray(root.results) ? root.results : [];
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.url);
        if (!url) continue;
        const excerpts = Array.isArray(row.excerpts)
          ? row.excerpts.map((x) => cleanText(x)).filter(Boolean).join(' … ')
          : '';
        items.push({
          title: cleanText(row.title) || url,
          url,
          snippet: cleanText(excerpts).slice(0, 600),
          publishedAt: cleanText(row.publish_date) || undefined,
        });
      }
      break;
    }

    case 'langsearch': {
      if (typeof root.code === 'number' && root.code >= 400) {
        return {
          results: [],
          error: `LangSearch: ${cleanText(root.msg) || `Error code ${root.code}`}`,
        };
      }
      const d = (root.data && typeof root.data === 'object'
        ? root.data
        : {}) as Record<string, unknown>;
      const webPages = (d.webPages && typeof d.webPages === 'object'
        ? d.webPages
        : {}) as Record<string, unknown>;
      const raw = Array.isArray(webPages.value) ? webPages.value : [];
      for (const r of raw) {
        const row = r as Record<string, unknown>;
        const url = cleanText(row.url);
        if (!url) continue;
        items.push({
          title: cleanText(row.name || row.title) || url,
          url,
          snippet: cleanText(row.summary || row.snippet || row.text).slice(0, 600),
          publishedAt: cleanText(row.datePublished) || undefined,
        });
      }
      break;
    }
  }

  return {
    answer,
    results: items.slice(0, limit),
  };
}

export async function executeWebSearch(params: {
  providerId: SearchProviderId;
  query: string;
  maxResults?: number;
  signal?: AbortSignal;
}): Promise<WebSearchResult> {
  const apiKey = await searchKeyStore.getKey(params.providerId);
  if (!apiKey) {
    const spec = getSearchProviderSpec(params.providerId);
    return {
      ok: false,
      providerId: params.providerId,
      providerName: spec.name,
      query: params.query.trim(),
      results: [],
      elapsedMs: 1,
      error: `No API key saved for ${spec.name}. Open Settings → Search Engine to add your key.`,
    };
  }

  return executeWebSearchWithKey({
    providerId: params.providerId,
    apiKey,
    query: params.query,
    maxResults: params.maxResults,
    signal: params.signal,
  });
}

export function formatSearchResultsForPrompt(res: WebSearchResult): string {
  const lines: string[] = [
    `Web Search Results (${res.providerName}) for "${res.query}":`,
  ];
  if (res.answer) {
    lines.push(`Summary: ${res.answer}`);
  }
  res.results.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.title}`);
    lines.push(`   URL: ${item.url}`);
    if (item.snippet) {
      lines.push(`   Snippet: ${item.snippet}`);
    }
  });
  return lines.join('\n');
}
