import type { ProviderPresetId, ProviderProfile } from '../types/mayland';
import { BUNDLED_MODELS_DEV } from './modelsDev';

export interface ProviderPresetMeta {
  id: ProviderPresetId;
  label: string;
  shortLabel: string;
  baseUrl: string;
  chatPath: string;
  modelsPath: string;
  defaultModel: string;
  suggestedModels: string[];
  requiresApiKey: boolean;
  defaultHeaders: Array<{ key: string; value: string }>;
  hint: string;
}

const modelsFor = (id: ProviderPresetId, fallback: string[]) =>
  BUNDLED_MODELS_DEV[id]?.map((m) => m.id) ?? fallback;

export const PROVIDER_PRESETS: Record<ProviderPresetId, ProviderPresetMeta> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    shortLabel: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'google/gemini-4-hydrogen',
    suggestedModels: modelsFor('openrouter', ['google/gemini-4-hydrogen']),
    requiresApiKey: true,
    defaultHeaders: [
      { key: 'HTTP-Referer', value: 'https://mayland.app' },
      { key: 'X-Title', value: 'Mayland Mobile' },
    ],
    hint: 'One key for Gemini 4, Claude 5.5, GPT-5.5, DeepSeek V4, Grok 4.20, and more.',
  },
  fireworks: {
    id: 'fireworks',
    label: 'Fireworks AI',
    shortLabel: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast',
    suggestedModels: modelsFor('fireworks', [
      'accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast',
    ]),
    requiresApiKey: true,
    defaultHeaders: [],
    hint: 'High-speed OpenAI-compatible inference for DeepSeek V4.1, Kimi K3.1, MiniMax, and GLM.',
  },
  vercel: {
    id: 'vercel',
    label: 'Vercel AI Gateway',
    shortLabel: 'Vercel GW',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'anthropic/claude-sonnet-5.5',
    suggestedModels: modelsFor('vercel', ['anthropic/claude-sonnet-5.5']),
    requiresApiKey: true,
    defaultHeaders: [],
    hint: 'Unified OpenAI-compatible gateway from Vercel AI SDK.',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    shortLabel: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'openai/gpt-oss-120b',
    suggestedModels: modelsFor('groq', ['openai/gpt-oss-120b']),
    requiresApiKey: true,
    defaultHeaders: [],
    hint: 'Ultra-low latency LPU inference for fast mobile chat.',
  },
  together: {
    id: 'together',
    label: 'Together AI',
    shortLabel: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'moonshotai/Kimi-K3.1-Pro',
    suggestedModels: modelsFor('together', ['moonshotai/Kimi-K3.1-Pro']),
    requiresApiKey: true,
    defaultHeaders: [],
    hint: 'OpenAI-compatible endpoint for Kimi K3.1, DeepSeek V4.1, and GLM 5.3.',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek Direct',
    shortLabel: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'deepseek-v4-flash',
    suggestedModels: modelsFor('deepseek', ['deepseek-v4-flash']),
    requiresApiKey: true,
    defaultHeaders: [],
    hint: 'Supports native reasoning_content for the Thoughts panel.',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama / Local Server',
    shortLabel: 'Local/Ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'qwen3:8b',
    suggestedModels: ['qwen3:8b', 'llama3.2:latest', 'deepseek-r1:8b'],
    requiresApiKey: false,
    defaultHeaders: [],
    hint: 'Local or LAN AI server (API key optional).',
  },
  custom: {
    id: 'custom',
    label: 'Custom OpenAI Endpoint',
    shortLabel: 'Custom',
    baseUrl: 'https://api.example.com/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'gpt-5.5',
    suggestedModels: [],
    requiresApiKey: true,
    defaultHeaders: [],
    hint: 'Any custom Base URL, completions path, and custom headers.',
  },
};

export function createProfileFromPreset(
  presetId: ProviderPresetId,
  idOverride?: string
): ProviderProfile {
  const preset = PROVIDER_PRESETS[presetId];
  const now = Date.now();
  return {
    id: idOverride ?? `profile-${presetId}-${now.toString(36)}`,
    name: preset.label,
    preset: presetId,
    baseUrl: preset.baseUrl,
    chatPath: preset.chatPath,
    modelsPath: preset.modelsPath,
    defaultModel: preset.defaultModel,
    suggestedModels: [...preset.suggestedModels],
    customHeaders: preset.defaultHeaders.map((h) => ({ ...h })),
    requiresApiKey: preset.requiresApiKey,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankCustomProfile(): ProviderProfile {
  const now = Date.now();
  return {
    id: `profile-custom-${now.toString(36)}`,
    name: 'New Endpoint',
    preset: 'custom',
    baseUrl: '',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: '',
    suggestedModels: [],
    customHeaders: [],
    requiresApiKey: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultProfiles(): ProviderProfile[] {
  return [
    createProfileFromPreset('openrouter', 'default-openrouter'),
    createProfileFromPreset('fireworks', 'default-fireworks'),
    createProfileFromPreset('vercel', 'default-vercel'),
  ];
}
