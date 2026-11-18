import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { keyVault, KeyVaultError } from '../crypto/keyVault';
import type {
  Attachment,
  ChatMessage,
  MessageMetrics,
  ProviderProfile,
  RequestPhase,
  RunSettings,
  SearchProviderId,
  ThinkingEffort,
} from '../types/mayland';
import { isNativeMobile } from '../utils/nativeBridge';
import { formatFileSize } from '../utils/fileAttachments';
import { estimateMessagesTokens, estimateTextTokens } from '../utils/tokenEstimator';
import { executeWebFetch, WEB_FETCH_TOOL_DEFINITION } from './webFetchTool';
import { getSearchProviderSpec } from './searchProviders';
import { executeWebSearch, WEB_SEARCH_TOOL_DEFINITION } from './webSearchTool';

export interface StreamChatHandlers {
  onPhase?: (phase: RequestPhase) => void;
  onThinkingDelta?: (delta: string) => void;
  onContentDelta?: (delta: string) => void;
  onStreamStats?: (stats: { tokPerSec?: number; completionTokens: number }) => void;
  onComplete?: (result: {
    content: string;
    thinking: string;
    thinkingDurationMs?: number;
    metrics: MessageMetrics;
  }) => void;
  onError?: (error: Error) => void;
}

/**
 * Tracks real-time SSE decode token cadence over a sliding 3s window
 * while preferring server-reported `timings` / `usage` whenever emitted.
 */
export class RollingTokenMeter {
  private readonly samples: Array<{ t: number; tokens: number }> = [];
  private sseTokens = 0;
  private reportedCompletionTokens: number | null = null;
  private serverTokPerSec: number | null = null;
  private lastTokenAt: number | null = null;

  private prune(nowMs: number): void {
    const cutoff = nowMs - 3000;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  recordDelta(text: string, nowMs = performance.now()): number {
    if (!text) return 0;
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const estTokens =
      text.length <= 16 && words <= 2
        ? 1
        : Math.max(1, Math.round(text.length / 3.2));
    this.sseTokens += estTokens;
    this.lastTokenAt = nowMs;
    this.samples.push({ t: nowMs, tokens: estTokens });
    this.prune(nowMs);
    return estTokens;
  }

  recordServerTelemetry(
    completionTokens?: number,
    predictedPerSec?: number,
    nowMs = performance.now()
  ): void {
    if (
      typeof predictedPerSec === 'number' &&
      Number.isFinite(predictedPerSec) &&
      predictedPerSec > 0
    ) {
      this.serverTokPerSec = predictedPerSec;
    }
    if (
      typeof completionTokens === 'number' &&
      Number.isFinite(completionTokens) &&
      completionTokens >= 0
    ) {
      const prev = this.reportedCompletionTokens ?? this.sseTokens;
      const diff = completionTokens - prev;
      this.reportedCompletionTokens = completionTokens;
      if (diff > 0) {
        this.sseTokens = completionTokens;
        this.lastTokenAt = nowMs;
        this.samples.push({ t: nowMs, tokens: diff });
        this.prune(nowMs);
      }
    }
  }

  getTotalTokens(): number {
    if (this.reportedCompletionTokens !== null && this.reportedCompletionTokens > 0) {
      return this.reportedCompletionTokens;
    }
    return this.sseTokens;
  }

  getLastTokenAt(): number | null {
    return this.lastTokenAt;
  }

  getServerTokPerSec(): number | null {
    return this.serverTokPerSec;
  }

  getInstantTokPerSec(nowMs = performance.now()): number | undefined {
    if (this.serverTokPerSec !== null) {
      return Math.round(this.serverTokPerSec * 10) / 10;
    }
    this.prune(nowMs);
    if (this.samples.length < 2) return undefined;
    const spanMs = this.samples[this.samples.length - 1].t - this.samples[0].t;
    if (spanMs < 220) return undefined;
    let intervalTokens = 0;
    for (let i = 1; i < this.samples.length; i += 1) {
      intervalTokens += this.samples[i].tokens;
    }
    if (intervalTokens <= 0) return undefined;
    return Math.round((intervalTokens / (spanMs / 1000)) * 10) / 10;
  }
}

export interface StreamThinkParser {
  push(chunk: string): { thinking: string; content: string };
  flush(): { thinking: string; content: string };
}

/**
 * Stateful streaming tag parser separating `<think>...</think>` reasoning blocks
 * from visible answer prose, even when tags split across network chunk boundaries.
 */
export function createThinkStreamParser(enabled = true): StreamThinkParser {
  let inThink = false;
  let buffer = '';

  const OPEN_TAG = '<think>';
  const CLOSE_TAG = '</think>';

  function partialSuffixMatch(text: string, tag: string): number {
    const maxCheck = Math.min(text.length, tag.length - 1);
    for (let len = maxCheck; len >= 1; len -= 1) {
      if (text.endsWith(tag.slice(0, len))) {
        return len;
      }
    }
    return 0;
  }

  return {
    push(chunk: string) {
      if (!enabled) {
        return { thinking: '', content: chunk };
      }

      buffer += chunk;
      let outThinking = '';
      let outContent = '';

      while (buffer.length > 0) {
        if (!inThink) {
          const openIdx = buffer.indexOf(OPEN_TAG);
          if (openIdx !== -1) {
            outContent += buffer.slice(0, openIdx);
            buffer = buffer.slice(openIdx + OPEN_TAG.length);
            inThink = true;
            continue;
          }
          const keepLen = partialSuffixMatch(buffer, OPEN_TAG);
          outContent += buffer.slice(0, buffer.length - keepLen);
          buffer = buffer.slice(buffer.length - keepLen);
          break;
        } else {
          const closeIdx = buffer.indexOf(CLOSE_TAG);
          if (closeIdx !== -1) {
            outThinking += buffer.slice(0, closeIdx);
            buffer = buffer.slice(closeIdx + CLOSE_TAG.length);
            inThink = false;
            continue;
          }
          const keepLen = partialSuffixMatch(buffer, CLOSE_TAG);
          outThinking += buffer.slice(0, buffer.length - keepLen);
          buffer = buffer.slice(buffer.length - keepLen);
          break;
        }
      }

      return { thinking: outThinking, content: outContent };
    },

    flush() {
      if (!buffer) return { thinking: '', content: '' };
      const rem = buffer;
      buffer = '';
      return inThink
        ? { thinking: rem, content: '' }
        : { thinking: '', content: rem };
    },
  };
}

export function resolveEndpointUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const cleanPath = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;

  if (cleanBase.endsWith(cleanPath)) {
    return cleanBase;
  }
  return `${cleanBase}${cleanPath}`;
}

function mapReasoningEffort(effort: ThinkingEffort): string | undefined {
  switch (effort) {
    case 'off':
      return undefined;
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    case 'xhigh':
      return 'high';
    case 'max':
      return 'max';
  }
}

function isPdfFileAttachment(att: Attachment): boolean {
  return (
    att.kind === 'file' &&
    Boolean(att.dataUrl) &&
    (att.mimeType.toLowerCase() === 'application/pdf' ||
      att.name.toLowerCase().endsWith('.pdf'))
  );
}

function formatMessageContent(
  text: string,
  attachments?: Attachment[]
): string | Array<Record<string, unknown>> {
  const list = attachments ?? [];
  const textAttachments = list.filter((a) => a.kind === 'text' && a.textContent);
  const imageAttachments = list.filter((a) => a.kind === 'image' && a.dataUrl);
  const pdfAttachments = list.filter(isPdfFileAttachment);
  const binaryAttachments = list.filter(
    (a) => a.kind === 'file' && !isPdfFileAttachment(a)
  );

  let combinedText = text;
  if (textAttachments.length > 0) {
    const contextBlocks = textAttachments
      .map(
        (att) =>
          `\n\n[Attached File: ${att.name}]\n\`\`\`\n${att.textContent ?? ''}\n\`\`\``
      )
      .join('');
    combinedText = `${combinedText}${contextBlocks}`.trim();
  }
  if (binaryAttachments.length > 0) {
    const fileNotes = binaryAttachments
      .map(
        (att) =>
          `\n\n[Attached File: ${att.name} (${att.mimeType || 'binary'}, ${formatFileSize(att.size)})]`
      )
      .join('');
    combinedText = `${combinedText}${fileNotes}`.trim();
  }

  if (imageAttachments.length === 0 && pdfAttachments.length === 0) {
    return combinedText;
  }

  const parts: Array<Record<string, unknown>> = [];
  if (combinedText) {
    parts.push({ type: 'text', text: combinedText });
  }
  for (const img of imageAttachments) {
    parts.push({
      type: 'image_url',
      image_url: { url: img.dataUrl },
    });
  }
  for (const pdf of pdfAttachments) {
    parts.push({
      type: 'file',
      file: {
        filename: pdf.name,
        file_data: pdf.dataUrl,
      },
    });
  }
  return parts;
}

export function buildOpenAIPayload(
  history: ChatMessage[],
  settings: RunSettings,
  options?: {
    omitOptionalParams?: boolean;
    extraMessages?: Array<Record<string, unknown>>;
    enableWebSearchTool?: boolean;
  }
): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = [];

  if (settings.systemInstructions.trim()) {
    messages.push({
      role: 'system',
      content: settings.systemInstructions.trim(),
    });
  }

  for (const msg of history) {
    if (msg.error && !msg.content.trim()) continue;
    messages.push({
      role: msg.role,
      content:
        msg.role === 'user'
          ? formatMessageContent(msg.content, msg.attachments)
          : msg.content,
    });
  }

  if (options?.extraMessages?.length) {
    messages.push(...options.extraMessages);
  }

  const payload: Record<string, unknown> = {
    model: settings.model.trim(),
    messages,
    stream: true,
  };

  if (
    typeof settings.temperature === 'number' &&
    Number.isFinite(settings.temperature)
  ) {
    payload.temperature = settings.temperature;
  }

  if (typeof settings.topP === 'number' && Number.isFinite(settings.topP)) {
    payload.top_p = settings.topP;
  }

  if (typeof settings.maxTokens === 'number' && settings.maxTokens > 0) {
    payload.max_tokens = settings.maxTokens;
  }

  if (!options?.omitOptionalParams) {
    if (settings.jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    if (settings.thinkingEffort !== 'off') {
      const mapped = mapReasoningEffort(settings.thinkingEffort);
      if (mapped) {
        payload.reasoning_effort = mapped;
      }
    }

    const tools: Array<Record<string, unknown>> = [];
    if (settings.webFetchEnabled) {
      tools.push(WEB_FETCH_TOOL_DEFINITION);
    }
    if (settings.webSearchEnabled && options?.enableWebSearchTool) {
      tools.push(WEB_SEARCH_TOOL_DEFINITION);
    }
    if (tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    payload.stream_options = { include_usage: true };
  }

  return payload;
}

function buildHeaders(
  profile: ProviderProfile,
  decryptedKey?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (decryptedKey && decryptedKey.trim()) {
    headers.Authorization = `Bearer ${decryptedKey.trim()}`;
  }

  for (const pair of profile.customHeaders) {
    const k = pair.key.trim();
    const v = pair.value.trim();
    if (k && v) {
      headers[k] = v;
    }
  }

  return headers;
}

async function parseErrorResponse(res: Response): Promise<string> {
  const status = res.status;
  let detail = '';
  try {
    const rawText = await res.text();
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText) as {
          error?: { message?: string } | string;
          message?: string;
        };
        if (typeof parsed.error === 'string') detail = parsed.error;
        else if (parsed.error?.message) detail = parsed.error.message;
        else if (parsed.message) detail = parsed.message;
        else detail = rawText.slice(0, 220);
      } catch {
        detail = rawText.slice(0, 220);
      }
    }
  } catch {
    // ignore body read errors
  }

  if (status === 401) {
    return `401 Unauthorized — API key was rejected by the provider.${detail ? ` (${detail})` : ''}`;
  }
  if (status === 402 || status === 429) {
    return `${status} Quota / Rate Limit — Provider credit or rate limit reached.${detail ? ` (${detail})` : ''}`;
  }
  if (status === 404) {
    return `404 Not Found — Check your Base URL or model ID in provider settings.${detail ? ` (${detail})` : ''}`;
  }
  return `HTTP ${status}${detail ? `: ${detail}` : ' — Request failed from provider endpoint.'}`;
}

interface NativeStreamEvent {
  streamId: string;
  type: 'open' | 'chunk' | 'end' | 'error';
  status?: number;
  headers?: Record<string, string>;
  data?: string;
  message?: string;
}

interface MaylandStreamPlugin {
  startStream(options: {
    streamId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<{ started: boolean }>;
  cancelStream(options: { streamId: string }): Promise<{ cancelled: boolean }>;
  addListener(
    eventName: 'streamEvent',
    listenerFunc: (evt: NativeStreamEvent) => void
  ): Promise<PluginListenerHandle>;
}

const MaylandStream = registerPlugin<MaylandStreamPlugin>('MaylandStream');

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function fetchViaNativeStream(
  url: string,
  init: RequestInit
): Promise<Response> {
  const streamId = `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const headers = (init.headers as Record<string, string> | undefined) ?? {};
  const body =
    typeof init.body === 'string'
      ? init.body
      : init.body
        ? String(init.body)
        : undefined;

  let listenerHandle: PluginListenerHandle | null = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    listenerHandle?.remove().catch(() => undefined);
  };

  return await new Promise<Response>((resolve, reject) => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let opened = false;

    const onAbort = () => {
      MaylandStream.cancelStream({ streamId }).catch(() => undefined);
      cleanup();
      if (!opened) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      } else {
        try {
          streamController?.error(
            new DOMException('The operation was aborted.', 'AbortError')
          );
        } catch {
          // ignore closed controller
        }
      }
    };

    if (init.signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    init.signal?.addEventListener('abort', onAbort, { once: true });

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
      cancel() {
        MaylandStream.cancelStream({ streamId }).catch(() => undefined);
        init.signal?.removeEventListener('abort', onAbort);
        cleanup();
      },
    });

    MaylandStream.addListener('streamEvent', (evt) => {
      if (evt.streamId !== streamId) return;

      if (evt.type === 'open') {
        opened = true;
        const respHeaders = new Headers();
        for (const [k, v] of Object.entries(evt.headers ?? {})) {
          if (typeof v === 'string') respHeaders.set(k, v);
        }
        resolve(
          new Response(readable, {
            status: evt.status ?? 200,
            headers: respHeaders,
          })
        );
        return;
      }

      if (evt.type === 'chunk') {
        if (evt.data && streamController) {
          streamController.enqueue(base64ToUint8Array(evt.data));
        }
        return;
      }

      if (evt.type === 'end') {
        init.signal?.removeEventListener('abort', onAbort);
        cleanup();
        try {
          streamController?.close();
        } catch {
          // ignore already closed
        }
        return;
      }

      if (evt.type === 'error') {
        init.signal?.removeEventListener('abort', onAbort);
        cleanup();
        const err = new Error(evt.message || 'Native HTTP stream failed');
        if (!opened) {
          reject(err);
        } else {
          try {
            streamController?.error(err);
          } catch {
            // ignore
          }
        }
      }
    })
      .then((handle) => {
        listenerHandle = handle;
        if (init.signal?.aborted) {
          onAbort();
          return undefined;
        }
        return MaylandStream.startStream({
          streamId,
          url,
          method: init.method ?? 'GET',
          headers,
          body,
        });
      })
      .catch((err) => {
        init.signal?.removeEventListener('abort', onAbort);
        cleanup();
        if (!opened) reject(err);
      });
  });
}

async function fetchWithCorsFallback(
  url: string,
  init: RequestInit
): Promise<Response> {
  if (isNativeMobile() && Capacitor.isPluginAvailable('MaylandStream')) {
    return await fetchViaNativeStream(url, init);
  }

  try {
    return await fetch(url, init);
  } catch (err) {
    if ((err as Error).name === 'AbortError' || init.signal?.aborted) {
      throw err;
    }

    if (isNativeMobile()) {
      const headers = (init.headers as Record<string, string> | undefined) ?? {};
      const nativeRes = await CapacitorHttp.request({
        url,
        method: init.method ?? 'GET',
        headers,
        data:
          typeof init.body === 'string'
            ? init.body
            : init.body
              ? String(init.body)
              : undefined,
        responseType: 'text',
      });
      const textBody =
        typeof nativeRes.data === 'string'
          ? nativeRes.data
          : JSON.stringify(nativeRes.data ?? {});
      const respHeaders = new Headers();
      for (const [k, v] of Object.entries(nativeRes.headers ?? {})) {
        if (typeof v === 'string') respHeaders.set(k, v);
      }
      return new Response(textBody, {
        status: nativeRes.status,
        headers: respHeaders,
      });
    }

    if (
      typeof window !== 'undefined' &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ) {
      try {
        const proxyUrl = `/__mayland_proxy?target=${encodeURIComponent(url)}`;
        const proxyRes = await fetch(proxyUrl, init);
        if (proxyRes.headers.get('x-mayland-proxy') === '1') {
          return proxyRes;
        }
      } catch (proxyErr) {
        if ((proxyErr as Error).name === 'AbortError' || init.signal?.aborted) {
          throw proxyErr;
        }
      }
    }

    throw new Error(
      `Could not reach ${url}. If running in a browser, the server may be offline or blocking CORS.`
    );
  }
}

async function resolveRequestApiKey(
  profile: ProviderProfile,
  options?: { overrideKey?: string; allowEmptyOnKeyNotFound?: boolean }
): Promise<string> {
  const manual = options?.overrideKey?.trim();
  if (manual) return manual;

  try {
    return await keyVault.decryptApiKey(profile.id);
  } catch (err) {
    if (err instanceof KeyVaultError && err.code === 'KEY_NOT_FOUND') {
      if (
        options?.allowEmptyOnKeyNotFound ||
        !profile.requiresApiKey ||
        profile.preset === 'custom'
      ) {
        return '';
      }
    }
    throw err;
  }
}

interface AccumulatedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export class OpenAICompatibleAdapter {
  async sendChat(params: {
    profile: ProviderProfile;
    history: ChatMessage[];
    settings: RunSettings;
    searchEngine?: {
      providerId: SearchProviderId;
      hasKey: boolean;
      maxResults?: number;
    };
    signal?: AbortSignal;
    handlers?: StreamChatHandlers;
  }): Promise<void> {
    const { profile, history, settings, searchEngine, signal, handlers } = params;
    const enableWebSearchTool = Boolean(
      settings.webSearchEnabled && searchEngine?.hasKey
    );
    const tStart = performance.now();

    try {
      handlers?.onPhase?.('decrypting');
      const apiKey = await resolveRequestApiKey(profile);

      handlers?.onPhase?.('connecting');
      const chatPath = profile.chatPath || '/chat/completions';
      const endpoint = resolveEndpointUrl(profile.baseUrl, chatPath);
      const headers = buildHeaders(profile, apiKey);

      const cleanBase = profile.baseUrl.trim().replace(/\/+$/, '');
      const toolMessages: Array<Record<string, unknown>> = [];
      let omitOptionalParams = false;

      let fullContent = '';
      let fullThinking = '';
      let firstTokenAt: number | undefined;
      let thinkingStartedAt: number | undefined;
      let thinkingEndedAt: number | undefined;
      let promptTokens = estimateMessagesTokens(history, settings.systemInstructions);
      let completionTokens = 0;
      let totalTokens = promptTokens;
      let usageReported = false;
      const meter = new RollingTokenMeter();

      const MAX_TOOL_ROUNDS = 4;
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        let payload = buildOpenAIPayload(history, settings, {
          omitOptionalParams,
          extraMessages: toolMessages,
          enableWebSearchTool,
        });
        let effectiveEndpoint = endpoint;
        let res = await fetchWithCorsFallback(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal,
        });

        if (res.status === 404 && !cleanBase.endsWith('/v1') && chatPath === '/chat/completions') {
          const fallbackEndpoint = `${cleanBase}/v1/chat/completions`;
          const fallbackRes = await fetchWithCorsFallback(fallbackEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal,
          });
          if (fallbackRes.ok || fallbackRes.status !== 404) {
            res = fallbackRes;
            effectiveEndpoint = fallbackEndpoint;
          }
        }

        // Fallback gracefully if a strict OpenAI-compatible server rejects optional params or tools
        if (!res.ok && res.status === 400 && !omitOptionalParams) {
          const errPreview = await res.clone().text().catch(() => '');
          if (/reasoning_effort|stream_options|response_format|tools|tool_choice|unknown|unrecognized/i.test(errPreview)) {
            omitOptionalParams = true;
            payload = buildOpenAIPayload(history, settings, {
              omitOptionalParams: true,
              extraMessages: toolMessages,
              enableWebSearchTool,
            });
            res = await fetchWithCorsFallback(effectiveEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
              signal,
            });
          }
        }

        if (!res.ok) {
          const message = await parseErrorResponse(res);
          throw new Error(message);
        }

        const contentType = res.headers.get('content-type') ?? '';
        const isStream = contentType.includes('text/event-stream') && res.body;

        let roundContent = '';
        const toolCallMap = new Map<number, AccumulatedToolCall>();

        if (!isStream) {
          const json = (await res.json()) as {
            choices?: Array<{
              message?: {
                content?: string | null;
                reasoning_content?: string;
                reasoning?: string;
                tool_calls?: Array<{
                  id?: string;
                  type?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            };
          };

          if (!firstTokenAt) firstTokenAt = performance.now();
          const choiceMsg = json.choices?.[0]?.message;
          const rawReasoning = choiceMsg?.reasoning_content ?? choiceMsg?.reasoning ?? '';
          const rawContent = choiceMsg?.content ?? '';

          const parser = createThinkStreamParser(true);
          const parsed = parser.push(rawContent);
          const tail = parser.flush();

          const roundThinking = `${rawReasoning}${parsed.thinking}${tail.thinking}`.trim();
          roundContent = `${parsed.content}${tail.content}`;

          if (roundThinking) {
            fullThinking += (fullThinking ? '\n' : '') + roundThinking;
            handlers?.onPhase?.('thinking');
            handlers?.onThinkingDelta?.(roundThinking);
          }

          const rawCalls = choiceMsg?.tool_calls ?? [];
          rawCalls.forEach((tc, idx) => {
            if (!tc.function?.name) return;
            toolCallMap.set(idx, {
              id: tc.id || `call-${round}-${idx}`,
              type: 'function',
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments ?? '{}',
              },
            });
          });

          if (roundContent && toolCallMap.size === 0) {
            fullContent += roundContent;
            handlers?.onPhase?.('streaming');
            handlers?.onContentDelta?.(roundContent);
          }

          if (json.usage) {
            usageReported = true;
            promptTokens = json.usage.prompt_tokens ?? promptTokens;
            completionTokens =
              json.usage.completion_tokens ?? estimateTextTokens(fullContent + fullThinking);
            totalTokens = json.usage.total_tokens ?? promptTokens + completionTokens;
          } else {
            completionTokens = estimateTextTokens(fullContent + fullThinking);
            totalTokens = promptTokens + completionTokens;
          }
        } else {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          const parser = createThinkStreamParser(true);
          let sseBuffer = '';
          let currentPhase: RequestPhase = 'connecting';

          const emitPhase = (next: RequestPhase) => {
            if (currentPhase !== next) {
              currentPhase = next;
              handlers?.onPhase?.(next);
            }
          };

          const processLine = (line: string) => {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) return;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') return;

            let parsedChunk: {
              choices?: Array<{
                delta?: {
                  content?: string;
                  reasoning_content?: string;
                  reasoning?: string;
                  thinking?: string;
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    type?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
              }>;
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
              };
              timings?: {
                prompt_n?: number;
                predicted_n?: number;
                predicted_ms?: number;
                predicted_per_second?: number;
              };
              stats?: {
                tokens_per_second?: number;
              };
            };

            try {
              parsedChunk = JSON.parse(dataStr);
            } catch {
              return;
            }

            const now = performance.now();
            const rawSpeed =
              parsedChunk.timings?.predicted_per_second ??
              (parsedChunk.timings?.predicted_n &&
              parsedChunk.timings?.predicted_ms &&
              parsedChunk.timings.predicted_ms > 0
                ? parsedChunk.timings.predicted_n / (parsedChunk.timings.predicted_ms / 1000)
                : undefined) ??
              parsedChunk.stats?.tokens_per_second;

            if (parsedChunk.usage) {
              usageReported = true;
              promptTokens = parsedChunk.usage.prompt_tokens ?? promptTokens;
              completionTokens = parsedChunk.usage.completion_tokens ?? completionTokens;
              totalTokens =
                parsedChunk.usage.total_tokens ?? promptTokens + completionTokens;
              meter.recordServerTelemetry(
                parsedChunk.usage.completion_tokens,
                rawSpeed,
                now
              );
              handlers?.onStreamStats?.({
                tokPerSec: meter.getInstantTokPerSec(now),
                completionTokens: meter.getTotalTokens(),
              });
            } else if (parsedChunk.timings || rawSpeed !== undefined) {
              if (
                typeof parsedChunk.timings?.prompt_n === 'number' &&
                parsedChunk.timings.prompt_n > 0
              ) {
                promptTokens = parsedChunk.timings.prompt_n;
              }
              if (
                typeof parsedChunk.timings?.predicted_n === 'number' &&
                parsedChunk.timings.predicted_n > 0
              ) {
                usageReported = true;
                completionTokens = parsedChunk.timings.predicted_n;
                totalTokens = promptTokens + completionTokens;
              }
              meter.recordServerTelemetry(parsedChunk.timings?.predicted_n, rawSpeed, now);
              handlers?.onStreamStats?.({
                tokPerSec: meter.getInstantTokPerSec(now),
                completionTokens: meter.getTotalTokens(),
              });
            }

            const delta = parsedChunk.choices?.[0]?.delta;
            if (!delta) return;

            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const existing = toolCallMap.get(idx) ?? {
                  id: tc.id || `call-${round}-${idx}`,
                  type: 'function' as const,
                  function: { name: '', arguments: '' },
                };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.function.name += tc.function.name;
                if (tc.function?.arguments) {
                  existing.function.arguments += tc.function.arguments;
                }
                toolCallMap.set(idx, existing);
              }
            }

            const directThinking =
              delta.reasoning_content ?? delta.reasoning ?? delta.thinking ?? '';
            if (directThinking) {
              if (!firstTokenAt) firstTokenAt = now;
              if (!thinkingStartedAt) thinkingStartedAt = now;
              emitPhase('thinking');
              fullThinking += directThinking;
              meter.recordDelta(directThinking, now);
              handlers?.onThinkingDelta?.(directThinking);
              handlers?.onStreamStats?.({
                tokPerSec: meter.getInstantTokPerSec(now),
                completionTokens: meter.getTotalTokens(),
              });
            }

            if (typeof delta.content === 'string' && delta.content.length > 0) {
              if (!firstTokenAt) firstTokenAt = now;
              const split = parser.push(delta.content);
              if (split.thinking) {
                if (!thinkingStartedAt) thinkingStartedAt = now;
                emitPhase('thinking');
                fullThinking += split.thinking;
                handlers?.onThinkingDelta?.(split.thinking);
              }
              if (split.content) {
                if (thinkingStartedAt && !thinkingEndedAt) {
                  thinkingEndedAt = now;
                }
                emitPhase('streaming');
                roundContent += split.content;
                fullContent += split.content;
                handlers?.onContentDelta?.(split.content);
              }
              meter.recordDelta(delta.content, now);
              handlers?.onStreamStats?.({
                tokPerSec: meter.getInstantTokPerSec(now),
                completionTokens: meter.getTotalTokens(),
              });
            }
          };

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split(/\r?\n/);
            sseBuffer = lines.pop() ?? '';
            for (const line of lines) {
              processLine(line);
            }
          }

          if (sseBuffer.trim()) {
            processLine(sseBuffer);
          }

          const tail = parser.flush();
          if (tail.thinking) {
            fullThinking += tail.thinking;
            handlers?.onThinkingDelta?.(tail.thinking);
          }
          if (tail.content) {
            roundContent += tail.content;
            fullContent += tail.content;
            handlers?.onContentDelta?.(tail.content);
          }
        }

        const roundToolCalls = Array.from(toolCallMap.values()).filter(
          (t) => Boolean(t.function.name)
        );
        if (roundToolCalls.length === 0 || round >= MAX_TOOL_ROUNDS - 1) {
          break;
        }

        if (!thinkingStartedAt) thinkingStartedAt = performance.now();
        handlers?.onPhase?.('thinking');

        toolMessages.push({
          role: 'assistant',
          content: roundContent || null,
          tool_calls: roundToolCalls,
        });

        for (const tc of roundToolCalls) {
          let toolOutput = '';
          if (tc.function.name === 'fetch_web') {
            let parsedArgs: { url?: string } = {};
            try {
              parsedArgs = JSON.parse(tc.function.arguments || '{}') as { url?: string };
            } catch {
              parsedArgs = {};
            }
            const targetUrl = parsedArgs.url?.trim() ?? '';
            const stepNote = `\n[Web Fetch] Reading ${targetUrl || '(missing url)'}…\n`;
            fullThinking += stepNote;
            handlers?.onThinkingDelta?.(stepNote);

            const fetched = targetUrl
              ? await executeWebFetch(targetUrl, signal)
              : {
                  ok: false,
                  url: '',
                  finalUrl: '',
                  status: 400,
                  title: '',
                  content: '',
                  error: 'Missing url parameter.',
                };

            const doneNote = fetched.ok
              ? `[Web Fetch] Loaded "${fetched.title || fetched.finalUrl}" (HTTP ${fetched.status}, ${fetched.content.length} chars)\n`
              : `[Web Fetch] Failed: ${fetched.error || `HTTP ${fetched.status}`}\n`;
            fullThinking += doneNote;
            handlers?.onThinkingDelta?.(doneNote);

            toolOutput = JSON.stringify(fetched);
          } else if (tc.function.name === 'search_web') {
            let parsedArgs: { query?: string; max_results?: number } = {};
            try {
              parsedArgs = JSON.parse(tc.function.arguments || '{}') as {
                query?: string;
                max_results?: number;
              };
            } catch {
              parsedArgs = {};
            }
            const q = parsedArgs.query?.trim() ?? '';
            const providerId = searchEngine?.providerId ?? 'tavily';
            const providerLabel = getSearchProviderSpec(providerId).name;
            const stepNote = `\n[Web Search · ${providerLabel}] Searching "${q || '(empty query)'}"…\n`;
            fullThinking += stepNote;
            handlers?.onThinkingDelta?.(stepNote);

            const searched = await executeWebSearch({
              providerId,
              query: q,
              maxResults: parsedArgs.max_results ?? searchEngine?.maxResults ?? 6,
              signal,
            });

            const doneNote = searched.ok
              ? `[Web Search · ${providerLabel}] Found ${searched.results.length} result${searched.results.length === 1 ? '' : 's'} (${searched.elapsedMs}ms)\n`
              : `[Web Search · ${providerLabel}] Failed: ${searched.error || 'Search error'}\n`;
            fullThinking += doneNote;
            handlers?.onThinkingDelta?.(doneNote);

            toolOutput = JSON.stringify(searched);
          } else {
            toolOutput = JSON.stringify({
              ok: false,
              error: `Unsupported tool "${tc.function.name}"`,
            });
          }

          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: toolOutput,
          });
        }

        thinkingEndedAt = performance.now();
        handlers?.onPhase?.('connecting');
      }

      const sseCountedTokens = meter.getTotalTokens();
      if (!usageReported) {
        completionTokens =
          sseCountedTokens > 0
            ? sseCountedTokens
            : estimateTextTokens(fullContent + fullThinking);
        totalTokens = promptTokens + completionTokens;
      }

      const tEnd = performance.now();
      const durationMs = Math.max(1, Math.round(tEnd - tStart));
      const ttftMs = firstTokenAt ? Math.max(1, Math.round(firstTokenAt - tStart)) : durationMs;
      const decodeEndAt = meter.getLastTokenAt() ?? tEnd;
      const streamElapsedSec = Math.max(
        0.05,
        (decodeEndAt - (firstTokenAt ?? tStart)) / 1000
      );
      const serverSpeed = meter.getServerTokPerSec();
      const tokPerSec =
        serverSpeed !== null
          ? Math.round(serverSpeed * 10) / 10
          : Math.round((completionTokens / streamElapsedSec) * 10) / 10;
      const thinkingDurationMs =
        thinkingStartedAt && thinkingEndedAt
          ? Math.max(100, Math.round(thinkingEndedAt - thinkingStartedAt))
          : fullThinking
            ? Math.max(200, Math.round(durationMs * 0.35))
            : undefined;

      handlers?.onPhase?.('idle');
      handlers?.onComplete?.({
        content: fullContent,
        thinking: fullThinking,
        thinkingDurationMs,
        metrics: {
          promptTokens,
          completionTokens,
          totalTokens,
          ttftMs,
          durationMs,
          tokPerSec,
          model: settings.model,
          providerName: profile.name,
          estimated: !usageReported,
        },
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        handlers?.onPhase?.('idle');
        return;
      }
      handlers?.onPhase?.('error');
      const errorObj =
        err instanceof Error
          ? err
          : new Error('Failed to connect to the OpenAI-compatible endpoint.');
      handlers?.onError?.(errorObj);
    }
  }

  async fetchModels(profile: ProviderProfile, overrideApiKey?: string): Promise<string[]> {
    const apiKey = await resolveRequestApiKey(profile, {
      overrideKey: overrideApiKey,
      allowEmptyOnKeyNotFound: true,
    });

    const modelsPath = profile.modelsPath || '/models';
    const primaryEndpoint = resolveEndpointUrl(profile.baseUrl, modelsPath);
    const headers = buildHeaders(profile, apiKey);

    let res = await fetchWithCorsFallback(primaryEndpoint, { method: 'GET', headers });

    const cleanBase = profile.baseUrl.trim().replace(/\/+$/, '');
    if (res.status === 404 && !cleanBase.endsWith('/v1') && modelsPath === '/models') {
      const fallbackEndpoint = `${cleanBase}/v1/models`;
      try {
        const fallbackRes = await fetchWithCorsFallback(fallbackEndpoint, {
          method: 'GET',
          headers,
        });
        if (fallbackRes.ok) {
          res = fallbackRes;
        }
      } catch {
        // retain primary response error
      }
    }

    if (!res.ok) {
      throw new Error(await parseErrorResponse(res));
    }

    const json = (await res.json()) as
      | Array<{ id?: string; name?: string } | string>
      | {
          data?: Array<{ id?: string; name?: string } | string>;
          models?: Array<{ id?: string; name?: string; model?: string } | string>;
        };

    const rawItems = Array.isArray(json)
      ? json
      : (json.data ?? json.models ?? []);
    const ids = rawItems
      .map((item) =>
        typeof item === 'string'
          ? item
          : (item.id ?? (item as { model?: string }).model ?? item.name ?? '')
      )
      .filter(Boolean);
    return Array.from(new Set(ids)).slice(0, 200);
  }
}

export function generateCodeSnippet(
  profile: ProviderProfile,
  settings: RunSettings,
  history: ChatMessage[],
  kind: 'curl' | 'fetch'
): string {
  const endpoint = resolveEndpointUrl(profile.baseUrl, profile.chatPath);
  const sampleHistory =
    history.length > 0
      ? history.slice(-4)
      : [
          {
            id: 'sample-1',
            role: 'user' as const,
            content: 'Hello Mayland, summarize our architecture in three bullet points.',
            createdAt: Date.now(),
          },
        ];
  const payload = buildOpenAIPayload(sampleHistory, settings);
  const customHeaders = profile.customHeaders.filter((h) => h.key.trim() && h.value.trim());

  if (kind === 'curl') {
    const headerLines = [
      `  -H "Content-Type: application/json" \\`,
      `  -H "Authorization: Bearer $MAYLAND_API_KEY" \\`,
      ...customHeaders.map((h) => `  -H "${h.key}: ${h.value}" \\`),
    ].join('\n');
    return `curl "${endpoint}" \\\n${headerLines}\n  -d '${JSON.stringify(payload, null, 2)}'`;
  }

  const headerRecord: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ${apiKey}',
  };
  for (const h of customHeaders) {
    headerRecord[h.key] = h.value;
  }

  return `const response = await fetch("${endpoint}", {\n  method: "POST",\n  headers: {\n${Object.entries(
    headerRecord
  )
    .map(([k, v]) => `    "${k}": ${k === 'Authorization' ? '`Bearer ${apiKey}`' : JSON.stringify(v)}`)
    .join(',\n')}\n  },\n  body: JSON.stringify(${JSON.stringify(payload, null, 2)})\n});\n\nconst data = await response.json();\nconsole.log(data);`;
}

export const openAIAdapter = new OpenAICompatibleAdapter();
