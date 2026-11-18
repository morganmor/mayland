import { createDefaultProfiles } from '../adapters/providerPresets';
import { SEARCH_PROVIDER_MAP } from '../adapters/searchProviders';
import { keyVault } from '../crypto/keyVault';
import type {
  AppLanguage,
  Conversation,
  ProviderProfile,
  RunSettings,
  SavedSystemPrompt,
  SearchEngineConfig,
  SearchProviderId,
  ThemeMode,
} from '../types/mayland';

const PROFILES_KEY = 'mayland.profiles.v1';
const CONVS_KEY = 'mayland.conversations.v1';
const ACTIVE_CONV_KEY = 'mayland.active_conv.v1';
const THEME_KEY = 'mayland.theme.v1';
const LANGUAGE_KEY = 'mayland.language.v1';
const PROSE_FONT_KEY = 'mayland.prose_font.v1';
const SAVED_PROMPTS_KEY = 'mayland.saved_prompts.v1';
const SEARCH_ENGINE_KEY = 'mayland.search_engine.v1';
const TEMP_DEFAULT_MIGRATED_KEY = 'mayland.temp_default_1_0.v1';

export function createDefaultSettings(profile: ProviderProfile): RunSettings {
  return {
    profileId: profile.id,
    model: profile.defaultModel,
    systemInstructions: '',
    thinkingEffort: 'high',
    temperature: 1.0,
    topP: 0.95,
    maxTokens: null,
    jsonMode: false,
    webFetchEnabled: true,
    webSearchEnabled: true,
    hapticsEnabled: true,
    autoScroll: true,
  };
}

export function createNewConversation(profile: ProviderProfile): Conversation {
  const now = Date.now();
  return {
    id: `conv-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Playground',
    messages: [],
    settings: createDefaultSettings(profile),
    createdAt: now,
    updatedAt: now,
  };
}

export function loadProfiles(): ProviderProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) {
      const defaults = createDefaultProfiles();
      localStorage.setItem(PROFILES_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw) as ProviderProfile[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const freshDefaults = createDefaultProfiles();
      const byId = new Map(freshDefaults.map((d) => [d.id, d]));
      const envelopesMeta = keyVault.listAllMetadata();
      return parsed.map((p) => {
        const ref = byId.get(p.id);
        if (!ref) {
          if (p.preset === 'custom' && p.requiresApiKey && !envelopesMeta[p.id]) {
            return { ...p, requiresApiKey: false };
          }
          return p;
        }
        const isStaleDefaultModel =
          p.defaultModel === 'anthropic/claude-sonnet-4' ||
          p.defaultModel === 'accounts/fireworks/models/deepseek-v3p1';
        return {
          ...p,
          defaultModel: isStaleDefaultModel ? ref.defaultModel : p.defaultModel,
          suggestedModels: Array.from(
            new Set([...ref.suggestedModels, ...p.suggestedModels])
          ),
        };
      });
    }
  } catch {
    // ignore storage errors
  }
  return createDefaultProfiles();
}

export function saveProfiles(profiles: ProviderProfile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // ignore storage quota
  }
}

export function loadConversations(fallbackProfile: ProviderProfile): {
  conversations: Conversation[];
  activeId: string;
} {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    const active = localStorage.getItem(ACTIVE_CONV_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Conversation[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        let needsTempMigration = false;
        try {
          if (!localStorage.getItem(TEMP_DEFAULT_MIGRATED_KEY)) {
            needsTempMigration = true;
            localStorage.setItem(TEMP_DEFAULT_MIGRATED_KEY, '1');
          }
        } catch {
          // ignore storage lock
        }

        const normalized = parsed.map((conv) => {
          const merged = {
            ...createDefaultSettings(fallbackProfile),
            ...conv.settings,
          };
          if (merged.model === 'anthropic/claude-sonnet-4') {
            merged.model = fallbackProfile.defaultModel;
          }
          if (merged.maxTokens === 4096) {
            merged.maxTokens = null;
          }
          if (needsTempMigration && merged.temperature === 0.7) {
            merged.temperature = 1.0;
          }
          return {
            ...conv,
            settings: merged,
          };
        });
        const activeId =
          active && normalized.some((c) => c.id === active)
            ? active
            : normalized[0].id;
        return { conversations: normalized, activeId };
      }
    }
  } catch {
    // ignore
  }
  const initial = createNewConversation(fallbackProfile);
  return { conversations: [initial], activeId: initial.id };
}

export function saveConversations(
  conversations: Conversation[],
  activeId: string
): void {
  try {
    localStorage.setItem(CONVS_KEY, JSON.stringify(conversations));
    localStorage.setItem(ACTIVE_CONV_KEY, activeId);
  } catch {
    // ignore
  }
}

export const THEME_OPTIONS: ReadonlyArray<{
  id: ThemeMode;
  label: string;
  swatchBg: string;
  swatchAccent: string;
}> = [
  { id: 'dark', label: 'Dark', swatchBg: '#161920', swatchAccent: '#5CB8FF' },
  { id: 'obsidian', label: 'Obsidian', swatchBg: '#0C0E13', swatchAccent: '#63BCFF' },
  {
    id: 'space-adventure',
    label: 'Space Adventure',
    swatchBg: '#0E1530',
    swatchAccent: '#69C6FF',
  },
  {
    id: 'space-night',
    label: 'Sleep Night',
    swatchBg: '#08090F',
    swatchAccent: '#486D9E',
  },
  { id: 'light', label: 'Light', swatchBg: '#F4F6FA', swatchAccent: '#2666D6' },
];

export function loadTheme(): ThemeMode {
  try {
    const val = localStorage.getItem(THEME_KEY);
    if (
      val === 'dark' ||
      val === 'obsidian' ||
      val === 'space-adventure' ||
      val === 'space-night' ||
      val === 'light'
    ) {
      return val;
    }
  } catch {
    // ignore
  }
  return 'dark';
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadLanguage(): AppLanguage {
  try {
    const val = localStorage.getItem(LANGUAGE_KEY);
    if (val === 'en' || val === 'id') return val;
  } catch {
    // ignore
  }
  return 'en';
}

export function saveLanguage(lang: AppLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // ignore
  }
}

export function loadProseFont(): 'editorial' | 'clean' {
  try {
    const val = localStorage.getItem(PROSE_FONT_KEY);
    if (val === 'editorial' || val === 'clean') return val;
  } catch {
    // ignore
  }
  return 'editorial';
}

export function saveProseFont(font: 'editorial' | 'clean'): void {
  try {
    localStorage.setItem(PROSE_FONT_KEY, font);
  } catch {
    // ignore
  }
}

export function loadSavedPrompts(): SavedSystemPrompt[] {
  try {
    const raw = localStorage.getItem(SAVED_PROMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSystemPrompt[];
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && p.id && p.name && typeof p.content === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveSavedPrompts(prompts: SavedSystemPrompt[]): void {
  try {
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(prompts));
  } catch {
    // ignore
  }
}

export function loadSearchEngineConfig(): SearchEngineConfig {
  try {
    const raw = localStorage.getItem(SEARCH_ENGINE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SearchEngineConfig>;
      const providerId =
        parsed.activeProviderId && parsed.activeProviderId in SEARCH_PROVIDER_MAP
          ? (parsed.activeProviderId as SearchProviderId)
          : 'tavily';
      const maxResults =
        typeof parsed.maxResults === 'number' && Number.isFinite(parsed.maxResults)
          ? Math.min(10, Math.max(1, Math.round(parsed.maxResults)))
          : 6;
      return {
        activeProviderId: providerId,
        maxResults,
      };
    }
  } catch {
    // ignore
  }
  return {
    activeProviderId: 'tavily',
    maxResults: 6,
  };
}

export function saveSearchEngineConfig(config: SearchEngineConfig): void {
  try {
    localStorage.setItem(SEARCH_ENGINE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}
