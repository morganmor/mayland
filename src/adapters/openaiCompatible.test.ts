import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildOpenAIPayload,
  createThinkStreamParser,
  generateCodeSnippet,
  openAIAdapter,
  resolveEndpointUrl,
  RollingTokenMeter,
} from './openaiCompatible';
import { createBlankCustomProfile, createProfileFromPreset } from './providerPresets';
import { getOutputCeiling, lookupModelSpec } from './modelsDev';
import { createDefaultSettings } from '../store/maylandStore';
import type { RunSettings } from '../types/mayland';

describe('OpenAI-Compatible Adapter', () => {
  it('resolves base URLs and custom paths without duplicate slashes', () => {
    expect(
      resolveEndpointUrl('https://openrouter.ai/api/v1/', '/chat/completions')
    ).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(
      resolveEndpointUrl(
        'https://api.fireworks.ai/inference/v1/chat/completions',
        '/chat/completions'
      )
    ).toBe('https://api.fireworks.ai/inference/v1/chat/completions');
    expect(resolveEndpointUrl('https://ai-gateway.vercel.sh/v1', 'models')).toBe(
      'https://ai-gateway.vercel.sh/v1/models'
    );
  });

  it('splits <think>...</think> blocks cleanly across arbitrary chunk boundaries', () => {
    const parser = createThinkStreamParser(true);
    const chunks = ['<thi', 'nk>Analisis langkah ', '1 dan 2</thi', 'nk>Jawaban akhir!'];

    let thinking = '';
    let content = '';
    for (const c of chunks) {
      const out = parser.push(c);
      thinking += out.thinking;
      content += out.content;
    }
    const tail = parser.flush();
    thinking += tail.thinking;
    content += tail.content;

    expect(thinking).toBe('Analisis langkah 1 dan 2');
    expect(content).toBe('Jawaban akhir!');
  });

  it('builds OpenAI payload with system prompt, attachments, json mode, and safe code snippet', () => {
    const profile = createProfileFromPreset('fireworks', 'fw-test');
    const settings: RunSettings = {
      profileId: profile.id,
      model: 'accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast',
      systemInstructions: 'Reply concisely.',
      thinkingEffort: 'high',
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 128000,
      jsonMode: true,
      hapticsEnabled: true,
      autoScroll: true,
    };

    const payload = buildOpenAIPayload(
      [
        {
          id: 'u1',
          role: 'user',
          content: 'Analisis data ini',
          attachments: [
            {
              id: 'a1',
              kind: 'text',
              name: 'sample.json',
              mimeType: 'application/json',
              size: 16,
              textContent: '{"status":"ok"}',
            },
          ],
          createdAt: 1,
        },
      ],
      settings
    );

    expect(payload.model).toBe(
      'accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast'
    );
    expect(payload.max_tokens).toBe(128000);
    expect(payload.response_format).toEqual({ type: 'json_object' });
    expect(payload.reasoning_effort).toBe('high');
    expect((payload.messages as Array<{ role: string }>)[0].role).toBe('system');

    const curl = generateCodeSnippet(profile, settings, [], 'curl');
    expect(curl).toContain('$MAYLAND_API_KEY');
    expect(curl).toContain('https://api.fireworks.ai/inference/v1/chat/completions');
  });

  it('omits max_tokens when Auto (null) and resolves real models.dev ceilings', () => {
    const profile = createProfileFromPreset('openrouter', 'or-test');
    const autoSettings: RunSettings = {
      profileId: profile.id,
      model: 'google/gemini-4-hydrogen',
      systemInstructions: '',
      thinkingEffort: 'xhigh',
      temperature: 0.7,
      topP: 0.95,
      maxTokens: null,
      jsonMode: false,
      hapticsEnabled: true,
      autoScroll: true,
    };

    const autoPayload = buildOpenAIPayload(
      [{ id: 'u1', role: 'user', content: 'Hi', createdAt: 1 }],
      autoSettings
    );
    expect('max_tokens' in autoPayload).toBe(false);
    expect(autoPayload.reasoning_effort).toBe('high');

    const spec = lookupModelSpec('openrouter', 'google/gemini-4-hydrogen');
    expect(spec?.output).toBe(943_718);
    expect(getOutputCeiling('openrouter', 'x-ai/grok-4.20')).toBe(1_800_000);

    const maxPayload = buildOpenAIPayload(
      [{ id: 'u2', role: 'user', content: 'Max test', createdAt: 2 }],
      { ...autoSettings, thinkingEffort: 'max' }
    );
    expect(maxPayload.reasoning_effort).toBe('max');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches models for custom endpoints without requiring a saved API key and falls back to /v1/models on 404', async () => {
    const custom = createBlankCustomProfile();
    custom.name = 'DEEPSEEK';
    custom.baseUrl = 'https://example-tunnel.trycloudflare.com';
    expect(custom.requiresApiKey).toBe(false);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 'deepseek-v4.1' }, { id: 'deepseek-r1' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const models = await openAIAdapter.fetchModels(custom);
    expect(models).toEqual(['deepseek-v4.1', 'deepseek-r1']);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://example-tunnel.trycloudflare.com/models',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example-tunnel.trycloudflare.com/v1/models',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses an unsaved override API key when fetching models before Save is clicked', async () => {
    const openrouter = createProfileFromPreset('openrouter', 'or-fetch-test');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'custom/model-a' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const models = await openAIAdapter.fetchModels(openrouter, 'sk-live-unsaved');
    expect(models).toEqual(['custom/model-a']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-live-unsaved',
        }),
      })
    );
  });

  it('includes fetch_web tool when webFetchEnabled is true and executes multi-round tool calls', async () => {
    const custom = createBlankCustomProfile();
    custom.baseUrl = 'https://example-ai.test/v1';
    const settings: RunSettings = {
      profileId: custom.id,
      model: 'deepseek-v4.1',
      systemInstructions: '',
      thinkingEffort: 'high',
      temperature: 0.7,
      topP: 0.95,
      maxTokens: null,
      jsonMode: false,
      webFetchEnabled: true,
      hapticsEnabled: true,
      autoScroll: true,
    };

    const payload = buildOpenAIPayload(
      [{ id: 'u1', role: 'user', content: 'Summarize https://example.org', createdAt: 1 }],
      settings
    );
    expect(Array.isArray(payload.tools)).toBe(true);
    expect(payload.tool_choice).toBe('auto');

    vi.spyOn(globalThis, 'fetch')
      // Round 1: model calls fetch_web tool
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_web_1',
                      type: 'function',
                      function: {
                        name: 'fetch_web',
                        arguments: JSON.stringify({ url: 'https://example.org' }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // Tool execution: fetch_web retrieves example.org HTML
      .mockResolvedValueOnce(
        new Response('<html><head><title>Example Domain</title></head><body><p>Live web content.</p></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      )
      // Round 2: model returns final answer
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Page title is Example Domain.' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    let completedContent = '';
    let completedThinking = '';
    await openAIAdapter.sendChat({
      profile: custom,
      history: [{ id: 'u1', role: 'user', content: 'Check https://example.org', createdAt: 1 }],
      settings,
      handlers: {
        onComplete(res) {
          completedContent = res.content;
          completedThinking = res.thinking;
        },
      },
    });

    expect(completedContent).toBe('Page title is Example Domain.');
    expect(completedThinking).toContain('Example Domain');
  });

  it('tracks exact rolling decode tokens/sec matching 45ms inter-token cadence and server timings', () => {
    const meter = new RollingTokenMeter();
    // Simulate 45ms per single-token SSE chunk -> 22.2 tok/s
    for (let i = 0; i <= 25; i += 1) {
      meter.recordDelta('kata', 1000 + i * 45);
    }
    expect(meter.getTotalTokens()).toBe(26);
    expect(meter.getInstantTokPerSec(1000 + 25 * 45)).toBe(22.2);

    // Server telemetry overrides heuristic when present
    meter.recordServerTelemetry(128, 22.4, 2500);
    expect(meter.getTotalTokens()).toBe(128);
    expect(meter.getInstantTokPerSec(2500)).toBe(22.4);
  });

  it('preserves full >500k-token (>2M chars) attached markdown documents without truncation', () => {
    const profile = createProfileFromPreset('openrouter', 'or-long');
    const settings: RunSettings = {
      profileId: profile.id,
      model: 'google/gemini-4-hydrogen',
      systemInstructions: '',
      thinkingEffort: 'high',
      temperature: 0.7,
      topP: 0.95,
      maxTokens: null,
      jsonMode: false,
      hapticsEnabled: true,
      autoScroll: true,
    };

    const bigMarkdown = `${'# Chapter\n'.repeat(200_000)}END_MARKER_600K`;
    const payload = buildOpenAIPayload(
      [
        {
          id: 'u-big',
          role: 'user',
          content: 'Analyze entire manuscript',
          attachments: [
            {
              id: 'att-big',
              kind: 'text',
              name: 'manuscript.md',
              mimeType: 'text/markdown',
              size: bigMarkdown.length,
              textContent: bigMarkdown,
            },
          ],
          createdAt: 1,
        },
      ],
      settings
    );

    const msgs = payload.messages as Array<{ role: string; content: string }>;
    expect(msgs[0].content.length).toBeGreaterThan(2_000_000);
    expect(msgs[0].content).toContain('END_MARKER_600K');
  });

  it('includes search_web tool only when webSearchEnabled and a search key is available', () => {
    const profile = createProfileFromPreset('openrouter', 'or-search');
    const settings: RunSettings = {
      profileId: profile.id,
      model: 'google/gemini-4-hydrogen',
      systemInstructions: '',
      thinkingEffort: 'high',
      temperature: 0.7,
      topP: 0.95,
      maxTokens: null,
      jsonMode: false,
      webFetchEnabled: true,
      webSearchEnabled: true,
      hapticsEnabled: true,
      autoScroll: true,
    };

    const withoutKeyPayload = buildOpenAIPayload(
      [{ id: 'u1', role: 'user', content: 'Latest news?', createdAt: 1 }],
      settings,
      { enableWebSearchTool: false }
    );
    const toolsNoKey = (withoutKeyPayload.tools as Array<{ function: { name: string } }>).map(
      (t) => t.function.name
    );
    expect(toolsNoKey).toEqual(['fetch_web']);

    const withKeyPayload = buildOpenAIPayload(
      [{ id: 'u1', role: 'user', content: 'Latest news?', createdAt: 1 }],
      settings,
      { enableWebSearchTool: true }
    );
    const toolsWithKey = (withKeyPayload.tools as Array<{ function: { name: string } }>).map(
      (t) => t.function.name
    );
    expect(toolsWithKey).toEqual(['fetch_web', 'search_web']);
  });

  it('defaults temperature to 1.0 and omits temperature, top_p, and max_tokens when turned off (null)', () => {
    const profile = createProfileFromPreset('openrouter', 'or-defaults');
    const defaults = createDefaultSettings(profile);
    expect(defaults.temperature).toBe(1.0);
    expect(defaults.maxTokens).toBeNull();

    const providerManagedPayload = buildOpenAIPayload(
      [{ id: 'u1', role: 'user', content: 'Hello', createdAt: 1 }],
      {
        ...defaults,
        temperature: null,
        topP: null,
        maxTokens: null,
      }
    );

    expect('temperature' in providerManagedPayload).toBe(false);
    expect('top_p' in providerManagedPayload).toBe(false);
    expect('max_tokens' in providerManagedPayload).toBe(false);
  });

  it('serializes PDF and arbitrary uploaded files cleanly alongside prompt text', () => {
    const profile = createProfileFromPreset('openrouter', 'or-files');
    const settings = createDefaultSettings(profile);
    const payload = buildOpenAIPayload(
      [
        {
          id: 'u-files',
          role: 'user',
          content: 'Inspect these files',
          attachments: [
            {
              id: 'f-pdf',
              kind: 'file',
              name: 'spec.pdf',
              mimeType: 'application/pdf',
              size: 4096,
              dataUrl: 'data:application/pdf;base64,JVBERg==',
            },
            {
              id: 'f-zip',
              kind: 'file',
              name: 'assets.zip',
              mimeType: 'application/zip',
              size: 2048,
            },
          ],
          createdAt: 1,
        },
      ],
      settings
    );

    const msgs = payload.messages as Array<{
      role: string;
      content: Array<Record<string, unknown>>;
    }>;
    expect(Array.isArray(msgs[0].content)).toBe(true);
    expect(msgs[0].content[0]).toEqual({
      type: 'text',
      text: 'Inspect these files\n\n[Attached File: assets.zip (application/zip, 2.0 KB)]',
    });
    expect(msgs[0].content[1]).toEqual({
      type: 'file',
      file: {
        filename: 'spec.pdf',
        file_data: 'data:application/pdf;base64,JVBERg==',
      },
    });
  });
});
