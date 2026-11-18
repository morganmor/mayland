export type ThemeMode =
  | 'dark'
  | 'obsidian'
  | 'space-adventure'
  | 'space-night'
  | 'light';

export type AppLanguage = 'en' | 'id';

export type ProviderPresetId =
  | 'openrouter'
  | 'fireworks'
  | 'vercel'
  | 'groq'
  | 'together'
  | 'deepseek'
  | 'ollama'
  | 'custom';

export type ThinkingEffort = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type RequestPhase =
  | 'idle'
  | 'decrypting'
  | 'connecting'
  | 'thinking'
  | 'streaming'
  | 'error';

export type MaybotMood =
  | 'idle'
  | 'happy'
  | 'listening'
  | 'decrypting'
  | 'connecting'
  | 'thinking'
  | 'streaming'
  | 'error';

export interface HeaderPair {
  key: string;
  value: string;
}

export interface ProviderProfile {
  id: string;
  name: string;
  preset: ProviderPresetId;
  baseUrl: string;
  chatPath: string;
  modelsPath: string;
  defaultModel: string;
  suggestedModels: string[];
  customHeaders: HeaderPair[];
  requiresApiKey: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EncryptedKeyEnvelope {
  version: 1;
  algorithm: 'AES-GCM-256';
  kdf: 'DEVICE-WRAP' | 'PBKDF2-SHA256';
  iterations?: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
  maskedPreview: string;
  keyHashPrefix: string;
  updatedAt: number;
}

export interface EnvelopeMetadata {
  profileId: string;
  hasKey: boolean;
  algorithm: 'AES-GCM-256';
  kdf: 'DEVICE-WRAP' | 'PBKDF2-SHA256';
  iterations?: number;
  ivPreview: string;
  ciphertextPreview: string;
  maskedPreview: string;
  keyHashPrefix: string;
  updatedAt: number;
}

export interface VaultStatus {
  pinEnabled: boolean;
  unlocked: boolean;
  keyCount: number;
  cryptoAvailable: boolean;
}

export interface RunSettings {
  profileId: string;
  model: string;
  systemInstructions: string;
  thinkingEffort: ThinkingEffort;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  jsonMode: boolean;
  webFetchEnabled?: boolean;
  webSearchEnabled?: boolean;
  hapticsEnabled: boolean;
  autoScroll: boolean;
}

export type SearchProviderId =
  | 'tavily'
  | 'brave'
  | 'exa'
  | 'serpapi'
  | 'linkup'
  | 'firecrawl'
  | 'parallel'
  | 'langsearch';

export interface SearchProviderSpec {
  id: SearchProviderId;
  name: string;
  tagline: string;
  freeMonthlyQuota: string;
  noCardRequired: boolean;
  keyPlaceholder: string;
  apiKeyUrl: string;
  endpointHost: string;
  accentColor: string;
}

export interface SearchKeyMetadata {
  providerId: SearchProviderId;
  hasKey: boolean;
  maskedPreview: string;
  keyHashPrefix: string;
  updatedAt: number;
  backend: 'android-keystore' | 'webcrypto-vault';
  hardwareBacked?: boolean;
}

export interface SearchEngineConfig {
  activeProviderId: SearchProviderId;
  maxResults: number;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
}

export interface WebSearchResult {
  ok: boolean;
  providerId: SearchProviderId;
  providerName: string;
  query: string;
  answer?: string;
  results: SearchResultItem[];
  elapsedMs: number;
  error?: string;
}

export interface SavedSystemPrompt {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  kind: 'image' | 'text' | 'file';
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  textContent?: string;
}

export interface MessageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  ttftMs?: number;
  durationMs?: number;
  tokPerSec?: number;
  model: string;
  providerName: string;
  estimated?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  thinkingDurationMs?: number;
  attachments?: Attachment[];
  metrics?: MessageMetrics;
  feedback?: 'up' | 'down' | null;
  error?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  settings: RunSettings;
  createdAt: number;
  updatedAt: number;
}
