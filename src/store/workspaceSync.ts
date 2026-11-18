import { CapacitorHttp } from '@capacitor/core';
import { createDefaultProfiles } from '../adapters/providerPresets';
import { keyVault, type VaultSyncSnapshot } from '../crypto/keyVault';
import type {
  Conversation,
  ProviderProfile,
  SavedSystemPrompt,
  SearchEngineConfig,
  ThemeMode,
} from '../types/mayland';
import {
  isNativeMobile,
  loadNativeWorkspaceState,
  saveNativeWorkspaceState,
} from '../utils/nativeBridge';

export interface WorkspaceSyncState {
  version: 1;
  profiles: ProviderProfile[];
  conversations: Conversation[];
  activeConvId: string;
  theme: ThemeMode;
  proseFont: 'editorial' | 'clean';
  savedPrompts?: SavedSystemPrompt[];
  searchEngineConfig?: SearchEngineConfig;
  vault: VaultSyncSnapshot;
  updatedAt: number;
}

export interface SyncStatusInfo {
  mode: 'disk' | 'android-native' | 'browser-only';
  rev: number;
  updatedAt: number;
  storePath?: string;
  lanUrls: string[];
  remoteSyncUrl: string;
  lastError?: string;
}

const SYNC_REV_KEY = 'mayland.sync.rev.v1';
const REMOTE_SYNC_URL_KEY = 'mayland.sync.remote_url.v1';

const DEFAULT_PROFILE_IDS = new Set(createDefaultProfiles().map((p) => p.id));

export function getStoredSyncedRev(): number {
  try {
    const raw = localStorage.getItem(SYNC_REV_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setStoredSyncedRev(rev: number): void {
  try {
    localStorage.setItem(SYNC_REV_KEY, String(rev));
  } catch {
    // ignore
  }
}

export function getRemoteSyncUrl(): string {
  try {
    return localStorage.getItem(REMOTE_SYNC_URL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setRemoteSyncUrl(url: string): void {
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean) {
      localStorage.setItem(REMOTE_SYNC_URL_KEY, clean);
    } else {
      localStorage.removeItem(REMOTE_SYNC_URL_KEY);
    }
  } catch {
    // ignore
  }
}

export function isPristineWorkspace(state: {
  profiles: ProviderProfile[];
  conversations: Conversation[];
  theme: ThemeMode;
  envelopesCount: number;
  savedPromptsCount?: number;
}): boolean {
  if (state.envelopesCount > 0) return false;
  if ((state.savedPromptsCount ?? 0) > 0) return false;
  if (state.theme !== 'dark') return false;
  if (
    state.conversations.length > 1 ||
    state.conversations.some((c) => c.messages.length > 0 || c.title !== 'Playground')
  ) {
    return false;
  }
  const hasCustomProfile = state.profiles.some((p) => !DEFAULT_PROFILE_IDS.has(p.id));
  if (hasCustomProfile) return false;
  return true;
}

export function mergeWorkspacesForFirstSync(
  remote: WorkspaceSyncState,
  local: WorkspaceSyncState
): WorkspaceSyncState {
  const mergedProfiles: ProviderProfile[] = [...remote.profiles];
  const seenProfileIds = new Set(remote.profiles.map((p) => p.id));
  const seenEndpointKeys = new Set(
    remote.profiles.map((p) => `${p.name.toLowerCase()}::${p.baseUrl.toLowerCase()}`)
  );

  for (const lp of local.profiles) {
    const epKey = `${lp.name.toLowerCase()}::${lp.baseUrl.toLowerCase()}`;
    if (!seenProfileIds.has(lp.id) && !seenEndpointKeys.has(epKey)) {
      mergedProfiles.push(lp);
      seenProfileIds.add(lp.id);
      seenEndpointKeys.add(epKey);
    }
  }

  const convMap = new Map<string, Conversation>();
  for (const rc of remote.conversations) {
    convMap.set(rc.id, rc);
  }
  for (const lc of local.conversations) {
    const existing = convMap.get(lc.id);
    if (!existing) {
      const isEmptyDefault = lc.messages.length === 0 && lc.title === 'Playground';
      if (!isEmptyDefault || convMap.size === 0) {
        convMap.set(lc.id, lc);
      }
    } else if (lc.updatedAt > existing.updatedAt) {
      convMap.set(lc.id, lc);
    }
  }

  const mergedConvs = Array.from(convMap.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  const nonEmptyActive =
    mergedConvs.find((c) => c.id === remote.activeConvId)?.id ??
    mergedConvs.find((c) => c.id === local.activeConvId)?.id ??
    mergedConvs[0]?.id ??
    remote.activeConvId;

  const promptMap = new Map<string, SavedSystemPrompt>();
  for (const p of remote.savedPrompts ?? []) promptMap.set(p.id, p);
  for (const p of local.savedPrompts ?? []) {
    const existing = promptMap.get(p.id);
    if (!existing || p.updatedAt > existing.updatedAt) {
      promptMap.set(p.id, p);
    }
  }

  return {
    version: 1,
    profiles: mergedProfiles,
    conversations: mergedConvs,
    activeConvId: nonEmptyActive,
    theme: remote.theme !== 'dark' ? remote.theme : local.theme,
    proseFont: remote.proseFont ?? local.proseFont,
    savedPrompts: Array.from(promptMap.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    ),
    searchEngineConfig: remote.searchEngineConfig ?? local.searchEngineConfig,
    vault: {
      envelopes: {
        ...(local.vault?.envelopes ?? {}),
        ...(remote.vault?.envelopes ?? {}),
      },
      pinConfig: remote.vault?.pinConfig ?? local.vault?.pinConfig ?? null,
      deviceKeyJwk: remote.vault?.deviceKeyJwk ?? local.vault?.deviceKeyJwk ?? null,
    },
    updatedAt: Math.max(remote.updatedAt ?? 0, local.updatedAt ?? 0, Date.now()),
  };
}

interface ServerStoreResponse {
  rev?: number;
  updatedAt?: number;
  state?: WorkspaceSyncState | null;
  storePath?: string;
  lanUrls?: string[];
  hasState?: boolean;
}

function getStoreEndpoint(overrideBaseUrl?: string): string | null {
  if (overrideBaseUrl) {
    const clean = overrideBaseUrl.trim().replace(/\/+$/, '');
    return clean ? `${clean}/__mayland_store` : null;
  }
  if (isNativeMobile()) {
    const saved = getRemoteSyncUrl();
    return saved ? `${saved}/__mayland_store` : null;
  }
  if (typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
    return '/__mayland_store';
  }
  return null;
}

async function fetchStoreJson(
  url: string,
  init?: RequestInit
): Promise<ServerStoreResponse | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return null;
    return (await res.json()) as ServerStoreResponse;
  } catch {
    if (isNativeMobile() && url.startsWith('http')) {
      try {
        const method = (init?.method ?? 'GET').toUpperCase();
        const nativeRes = await CapacitorHttp.request({
          url,
          method,
          headers: { 'Content-Type': 'application/json' },
          data: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        if (nativeRes.status >= 200 && nativeRes.status < 300) {
          return (
            typeof nativeRes.data === 'string'
              ? JSON.parse(nativeRes.data)
              : nativeRes.data
          ) as ServerStoreResponse;
        }
      } catch {
        // ignore native sync error
      }
    }
    return null;
  }
}

export async function fetchWorkspaceMeta(overrideBaseUrl?: string): Promise<ServerStoreResponse | null> {
  const endpoint = getStoreEndpoint(overrideBaseUrl);
  if (!endpoint) return null;
  return fetchStoreJson(`${endpoint}?meta=1`, { method: 'GET' });
}

export async function pullWorkspaceFromEndpoint(
  overrideBaseUrl?: string
): Promise<ServerStoreResponse | null> {
  const endpoint = getStoreEndpoint(overrideBaseUrl);
  if (!endpoint) return null;
  return fetchStoreJson(endpoint, { method: 'GET' });
}

export async function pushWorkspaceToTarget(
  state: WorkspaceSyncState,
  overrideBaseUrl?: string
): Promise<{ ok: boolean; rev?: number; storePath?: string; updatedAt?: number }> {
  if (isNativeMobile() && !overrideBaseUrl) {
    const saved = await saveNativeWorkspaceState(JSON.stringify(state));
    return { ok: saved, updatedAt: state.updatedAt };
  }

  const endpoint = getStoreEndpoint(overrideBaseUrl);
  if (!endpoint) return { ok: false };

  const res = await fetchStoreJson(endpoint, {
    method: 'POST',
    body: JSON.stringify({ state }),
  });
  if (!res || typeof res.rev !== 'number') {
    return { ok: false };
  }
  if (!overrideBaseUrl) {
    setStoredSyncedRev(res.rev);
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('mayland-sync');
        ch.postMessage({ type: 'synced', rev: res.rev, updatedAt: res.updatedAt });
        ch.close();
      }
    } catch {
      // ignore
    }
  }
  if (isNativeMobile()) {
    await saveNativeWorkspaceState(JSON.stringify(state));
  }
  return {
    ok: true,
    rev: res.rev,
    updatedAt: res.updatedAt,
    storePath: res.storePath,
  };
}

export async function loadNativeStoredWorkspace(): Promise<WorkspaceSyncState | null> {
  if (!isNativeMobile()) return null;
  const raw = await loadNativeWorkspaceState();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkspaceSyncState;
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export async function buildCurrentWorkspaceSnapshot(input: {
  profiles: ProviderProfile[];
  conversations: Conversation[];
  activeConvId: string;
  theme: ThemeMode;
  proseFont: 'editorial' | 'clean';
  savedPrompts?: SavedSystemPrompt[];
  searchEngineConfig?: SearchEngineConfig;
  preferredJwk?: JsonWebKey | null;
}): Promise<WorkspaceSyncState> {
  const vault = await keyVault.exportSyncVault(input.preferredJwk);
  return {
    version: 1,
    profiles: input.profiles,
    conversations: input.conversations,
    activeConvId: input.activeConvId,
    theme: input.theme,
    proseFont: input.proseFont,
    savedPrompts: input.savedPrompts ?? [],
    searchEngineConfig: input.searchEngineConfig,
    vault,
    updatedAt: Date.now(),
  };
}
