import { CapacitorHttp } from '@capacitor/core';
import { isNativeMobile } from '../utils/nativeBridge';

export const WEB_FETCH_TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'fetch_web',
    description:
      'Fetch and read the text content of a live public web page URL (http/https). Use whenever the user shares a link or asks for information from a website.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full http:// or https:// webpage URL to fetch.',
        },
      },
      required: ['url'],
    },
  },
};

export interface WebFetchResult {
  ok: boolean;
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  content: string;
  error?: string;
}

const MAX_EXTRACTED_CHARS = 16000;

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function extractReadableWebText(
  raw: string,
  contentType = 'text/html'
): { title: string; content: string } {
  if (!raw) return { title: '', content: '' };

  if (contentType.includes('application/json')) {
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      return {
        title: 'JSON Document',
        content: pretty.slice(0, MAX_EXTRACTED_CHARS),
      };
    } catch {
      return { title: '', content: raw.slice(0, MAX_EXTRACTED_CHARS) };
    }
  }

  if (!contentType.includes('html') && !/<[a-z][\s\S]*>/i.test(raw)) {
    return {
      title: '',
      content: raw.trim().slice(0, MAX_EXTRACTED_CHARS),
    };
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  const title = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim())
    : '';

  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
    .replace(/<(br|hr)\b[^>]*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ');

  const cleaned = decodeHtmlEntities(stripped)
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const content =
    cleaned.length > MAX_EXTRACTED_CHARS
      ? `${cleaned.slice(0, MAX_EXTRACTED_CHARS)}\n\n[Truncated after ${MAX_EXTRACTED_CHARS} chars]`
      : cleaned;

  return { title, content };
}

export function normalizeWebUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported.');
  }
  return parsed;
}

export async function executeWebFetch(
  rawUrl: string,
  signal?: AbortSignal
): Promise<WebFetchResult> {
  let targetUrl: URL;
  try {
    targetUrl = normalizeWebUrl(rawUrl);
  } catch (err) {
    return {
      ok: false,
      url: rawUrl,
      finalUrl: rawUrl,
      status: 400,
      title: '',
      content: '',
      error: (err as Error).message || 'Invalid URL provided.',
    };
  }

  const urlStr = targetUrl.toString();

  if (isNativeMobile()) {
    try {
      const nativeRes = await CapacitorHttp.request({
        url: urlStr,
        method: 'GET',
        headers: {
          'User-Agent': 'Mayland-Android/1.0',
          Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9',
        },
        responseType: 'text',
      });
      const bodyStr =
        typeof nativeRes.data === 'string'
          ? nativeRes.data
          : JSON.stringify(nativeRes.data ?? '');
      const headersLower = Object.fromEntries(
        Object.entries(nativeRes.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      const { title, content } = extractReadableWebText(
        bodyStr,
        headersLower['content-type'] ?? 'text/html'
      );
      return {
        ok: nativeRes.status >= 200 && nativeRes.status < 300,
        url: urlStr,
        finalUrl: nativeRes.url || urlStr,
        status: nativeRes.status,
        title,
        content,
      };
    } catch (err) {
      return {
        ok: false,
        url: urlStr,
        finalUrl: urlStr,
        status: 502,
        title: '',
        content: '',
        error: (err as Error).message || 'Native web fetch failed.',
      };
    }
  }

  // Use Vite host endpoint in desktop browsers to avoid external site CORS blocks
  if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
    try {
      const proxyRes = await fetch('/__mayland_webfetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlStr }),
        signal,
      });
      if (proxyRes.ok || proxyRes.status === 502 || proxyRes.status === 400) {
        const json = (await proxyRes.json()) as {
          ok?: boolean;
          status?: number;
          url?: string;
          finalUrl?: string;
          contentType?: string;
          body?: string;
          error?: string;
        };
        if (json.error) {
          return {
            ok: false,
            url: urlStr,
            finalUrl: urlStr,
            status: proxyRes.status,
            title: '',
            content: '',
            error: json.error,
          };
        }
        const { title, content } = extractReadableWebText(
          json.body ?? '',
          json.contentType ?? 'text/html'
        );
        return {
          ok: Boolean(json.ok),
          url: urlStr,
          finalUrl: json.finalUrl || urlStr,
          status: json.status ?? proxyRes.status,
          title,
          content,
        };
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      // fall through to direct fetch when running without Vite middleware
    }
  }

  try {
    const res = await fetch(urlStr, { method: 'GET', signal });
    const ct = res.headers.get('content-type') ?? 'text/html';
    const raw = await res.text();
    const { title, content } = extractReadableWebText(raw, ct);
    return {
      ok: res.ok,
      url: urlStr,
      finalUrl: res.url || urlStr,
      status: res.status,
      title,
      content,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return {
      ok: false,
      url: urlStr,
      finalUrl: urlStr,
      status: 502,
      title: '',
      content: '',
      error: (err as Error).message || 'Web fetch failed.',
    };
  }
}
