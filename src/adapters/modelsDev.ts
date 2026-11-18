import type { ProviderPresetId } from '../types/mayland';

export interface ModelSpec {
  id: string;
  name: string;
  context: number;
  output: number;
  reasoning?: boolean;
}

const CACHE_KEY = 'mayland.models_dev_cache.v1';

// Verified snapshot sourced directly from https://models.dev/api.json
export const BUNDLED_MODELS_DEV: Partial<Record<ProviderPresetId, ModelSpec[]>> = {
  openrouter: [
    {
      id: 'google/gemini-4-hydrogen',
      name: 'Gemini 4 Hydrogen',
      context: 1_048_576,
      output: 943_718,
      reasoning: true,
    },
    {
      id: 'anthropic/claude-sonnet-5.5',
      name: 'Claude Sonnet 5.5',
      context: 1_000_000,
      output: 128_000,
      reasoning: true,
    },
    {
      id: 'anthropic/claude-fable-5.2',
      name: 'Claude Fable 5.2',
      context: 1_000_000,
      output: 128_000,
      reasoning: true,
    },
    {
      id: 'openai/gpt-5.5',
      name: 'GPT-5.5',
      context: 1_050_000,
      output: 128_000,
      reasoning: true,
    },
    {
      id: 'deepseek/deepseek-v4.1-flash-1017',
      name: 'DeepSeek V4.1 Flash',
      context: 1_048_576,
      output: 943_718,
      reasoning: true,
    },
    {
      id: 'x-ai/grok-4.20',
      name: 'Grok 4.20',
      context: 2_000_000,
      output: 1_800_000,
      reasoning: true,
    },
    {
      id: 'moonshotai/kimi-k3.1-pro',
      name: 'Kimi K3.1 Pro',
      context: 1_048_576,
      output: 943_718,
      reasoning: true,
    },
    {
      id: 'google/gemini-4-carbon',
      name: 'Gemini 4 Carbon',
      context: 1_048_576,
      output: 943_718,
      reasoning: true,
    },
  ],
  fireworks: [
    {
      id: 'accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast',
      name: 'DeepSeek V4.1 Flash Ultrafast',
      context: 1_000_000,
      output: 384_000,
      reasoning: true,
    },
    {
      id: 'accounts/fireworks/models/kimi-k3p1-pro',
      name: 'Kimi K3.1 Pro',
      context: 1_048_576,
      output: 1_048_576,
      reasoning: true,
    },
    {
      id: 'accounts/fireworks/models/minimax-m3p1-flash',
      name: 'MiniMax-M3.1-Flash',
      context: 1_000_000,
      output: 512_000,
      reasoning: true,
    },
    {
      id: 'accounts/fireworks/models/muse-spark-open',
      name: 'Muse Spark Open',
      context: 1_048_576,
      output: 131_072,
      reasoning: true,
    },
    {
      id: 'accounts/fireworks/models/glm-5p3-flash',
      name: 'GLM 5.3 Flash',
      context: 1_048_573,
      output: 131_072,
      reasoning: true,
    },
  ],
  vercel: [
    {
      id: 'anthropic/claude-sonnet-5.5',
      name: 'Claude Sonnet 5.5',
      context: 1_000_000,
      output: 128_000,
      reasoning: true,
    },
    {
      id: 'google/gemini-4-hydrogen',
      name: 'Gemini 4 Hydrogen',
      context: 1_000_000,
      output: 1_000_000,
      reasoning: true,
    },
    {
      id: 'openai/gpt-5.5',
      name: 'GPT-5.5',
      context: 1_000_000,
      output: 128_000,
      reasoning: true,
    },
    {
      id: 'deepseek/deepseek-v4.1-flash-1017-ultrafast',
      name: 'DeepSeek V4.1 Flash Ultrafast',
      context: 1_048_576,
      output: 1_048_576,
      reasoning: true,
    },
    {
      id: 'spacexai/grok-4.20-reasoning',
      name: 'Grok 4.20 Reasoning',
      context: 2_000_000,
      output: 2_000_000,
      reasoning: true,
    },
  ],
  groq: [
    {
      id: 'openai/gpt-oss-120b',
      name: 'GPT OSS 120B',
      context: 131_072,
      output: 65_536,
      reasoning: true,
    },
    {
      id: 'qwen/qwen3.8-27b',
      name: 'Qwen3.8 27B',
      context: 131_072,
      output: 16_384,
      reasoning: true,
    },
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      context: 131_072,
      output: 32_768,
      reasoning: false,
    },
  ],
  together: [
    {
      id: 'moonshotai/Kimi-K3.1-Pro',
      name: 'Kimi K3.1 Pro',
      context: 1_048_576,
      output: 1_048_576,
      reasoning: true,
    },
    {
      id: 'deepseek-ai/DeepSeek-V4.1-Flash',
      name: 'DeepSeek V4.1 Flash',
      context: 1_048_576,
      output: 384_000,
      reasoning: true,
    },
    {
      id: 'zai-org/GLM-5.3-Flash',
      name: 'GLM-5.3-Flash',
      context: 1_048_575,
      output: 400_000,
      reasoning: true,
    },
  ],
  deepseek: [
    {
      id: 'deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      context: 1_048_576,
      output: 393_216,
      reasoning: true,
    },
    {
      id: 'deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      context: 1_048_576,
      output: 393_216,
      reasoning: true,
    },
  ],
};

const MODELS_DEV_KEY_MAP: Partial<Record<ProviderPresetId, string>> = {
  openrouter: 'openrouter',
  fireworks: 'fireworks-ai',
  vercel: 'vercel',
  groq: 'groq',
  together: 'togetherai',
  deepseek: 'deepseek',
};

let runtimeCatalogCache: Partial<Record<ProviderPresetId, ModelSpec[]>> | null = null;

function readCachedCatalog(): Partial<Record<ProviderPresetId, ModelSpec[]>> {
  if (runtimeCatalogCache) return runtimeCatalogCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<ProviderPresetId, ModelSpec[]>>;
      runtimeCatalogCache = parsed;
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export function getModelSpecsForPreset(preset: ProviderPresetId): ModelSpec[] {
  const cached = readCachedCatalog();
  const fromCache = cached[preset];
  const bundled = BUNDLED_MODELS_DEV[preset] ?? [];
  if (!fromCache || fromCache.length === 0) return bundled;

  const seen = new Set(bundled.map((m) => m.id));
  return [...bundled, ...fromCache.filter((m) => !seen.has(m.id))];
}

export function lookupModelSpec(
  preset: ProviderPresetId,
  modelId: string
): ModelSpec | undefined {
  const normalized = modelId.trim();
  const list = getModelSpecsForPreset(preset);
  const direct = list.find((m) => m.id === normalized);
  if (direct) return direct;

  // Cross-preset lookup for custom endpoints using standard model slugs
  for (const specs of Object.values(BUNDLED_MODELS_DEV)) {
    const found = specs?.find(
      (m) => m.id === normalized || m.id.endsWith(`/${normalized}`)
    );
    if (found) return found;
  }
  return undefined;
}

export function getOutputCeiling(preset: ProviderPresetId, modelId: string): number {
  const spec = lookupModelSpec(preset, modelId);
  if (spec && spec.output > 0) return spec.output;
  return 1_048_576; // 1M modern ceiling fallback for custom/unlisted models
}

export function formatCompactTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return String(tokens);
}

export async function syncModelsDevCatalog(): Promise<number> {
  const res = await fetch('https://models.dev/api.json');
  if (!res.ok) {
    throw new Error(`models.dev returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<
    string,
    {
      models?: Record<
        string,
        {
          name?: string;
          release_date?: string;
          reasoning?: boolean;
          limit?: { context?: number; output?: number };
        }
      >;
    }
  >;

  const nextCache: Partial<Record<ProviderPresetId, ModelSpec[]>> = {};
  let totalSaved = 0;

  for (const [presetKey, apiKey] of Object.entries(MODELS_DEV_KEY_MAP) as Array<
    [ProviderPresetId, string]
  >) {
    const providerModels = data[apiKey]?.models;
    if (!providerModels) continue;

    const specs: ModelSpec[] = Object.entries(providerModels)
      .filter(([, m]) => (m.limit?.output ?? 0) > 0)
      .sort((a, b) =>
        String(b[1].release_date ?? '').localeCompare(String(a[1].release_date ?? ''))
      )
      .slice(0, 60)
      .map(([id, m]) => ({
        id,
        name: m.name ?? id,
        context: m.limit?.context ?? 128_000,
        output: m.limit?.output ?? 128_000,
        reasoning: m.reasoning,
      }));

    nextCache[presetKey] = specs;
    totalSaved += specs.length;
  }

  runtimeCatalogCache = nextCache;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(nextCache));
  } catch {
    // ignore storage quota errors
  }
  return totalSaved;
}
