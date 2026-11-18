import { Capacitor, registerPlugin } from '@capacitor/core';
import { keyVault } from '../crypto/keyVault';
import { SEARCH_PROVIDERS } from '../adapters/searchProviders';
import type { SearchKeyMetadata, SearchProviderId } from '../types/mayland';
import { isNativeMobile } from '../utils/nativeBridge';

interface NativeVaultMetaEntry {
  providerId: string;
  hasKey: boolean;
  maskedPreview: string;
  keyHashPrefix: string;
  updatedAt: number;
  backend: 'android-keystore';
  hardwareBacked?: boolean;
}

interface MaylandSecureVaultPlugin {
  setSecret(options: { id: string; value: string }): Promise<NativeVaultMetaEntry>;
  getSecret(options: { id: string }): Promise<{ found: boolean; value: string | null }>;
  deleteSecret(options: { id: string }): Promise<{ deleted: boolean }>;
  listMetadata(): Promise<{
    entries: Record<string, NativeVaultMetaEntry>;
    backend: 'android-keystore';
    hardwareBacked?: boolean;
  }>;
  verifyVault(): Promise<{
    passed: boolean;
    backend: 'android-keystore';
    hardwareBacked?: boolean;
    algorithm: string;
    keyCount: number;
    durationMs: number;
  }>;
}

const MaylandSecureVault =
  registerPlugin<MaylandSecureVaultPlugin>('MaylandSecureVault');

const SEARCH_KEY_PREFIX = 'search:';

export interface SearchVaultInfo {
  backend: 'android-keystore' | 'webcrypto-vault';
  hardwareBacked: boolean;
  algorithm: string;
  keyCount: number;
}

export interface SearchKeyVaultLike {
  encryptApiKey(profileId: string, rawApiKey: string): Promise<{
    maskedPreview: string;
    keyHashPrefix: string;
    updatedAt: number;
  }>;
  decryptApiKey(profileId: string): Promise<string>;
  deleteApiKey(profileId: string): void;
  listAllMetadata(): Record<
    string,
    {
      profileId: string;
      hasKey: boolean;
      maskedPreview: string;
      keyHashPrefix: string;
      updatedAt: number;
    }
  >;
  runCryptoSelfTest(): Promise<{
    passed: boolean;
    algorithm: string;
    durationMs: number;
  }>;
}

function canUseAndroidKeystore(nativeOverride?: boolean): boolean {
  const native = nativeOverride ?? isNativeMobile();
  if (!native) return false;
  try {
    return Capacitor.isPluginAvailable('MaylandSecureVault');
  } catch {
    return false;
  }
}

export function createSearchKeyStore(deps?: {
  nativePlugin?: MaylandSecureVaultPlugin;
  useNative?: boolean;
  webVault?: SearchKeyVaultLike;
}) {
  const vault = deps?.webVault ?? keyVault;

  const isNativeVaultActive = () =>
    Boolean(deps?.nativePlugin) || canUseAndroidKeystore(deps?.useNative);

  const getNativePlugin = () => deps?.nativePlugin ?? MaylandSecureVault;

  return {
    async saveKey(
      providerId: SearchProviderId,
      rawApiKey: string
    ): Promise<SearchKeyMetadata> {
      const cleaned = rawApiKey.trim();
      if (!cleaned) {
        throw new Error('API key cannot be empty.');
      }

      if (isNativeVaultActive()) {
        const res = await getNativePlugin().setSecret({
          id: providerId,
          value: cleaned,
        });
        return {
          providerId,
          hasKey: true,
          maskedPreview: res.maskedPreview,
          keyHashPrefix: res.keyHashPrefix,
          updatedAt: res.updatedAt,
          backend: 'android-keystore',
          hardwareBacked: Boolean(res.hardwareBacked),
        };
      }

      const meta = await vault.encryptApiKey(`${SEARCH_KEY_PREFIX}${providerId}`, cleaned);
      return {
        providerId,
        hasKey: true,
        maskedPreview: meta.maskedPreview,
        keyHashPrefix: meta.keyHashPrefix,
        updatedAt: meta.updatedAt,
        backend: 'webcrypto-vault',
      };
    },

    async getKey(providerId: SearchProviderId): Promise<string | null> {
      if (isNativeVaultActive()) {
        const res = await getNativePlugin().getSecret({ id: providerId });
        return res.found && res.value ? res.value : null;
      }

      try {
        return await vault.decryptApiKey(`${SEARCH_KEY_PREFIX}${providerId}`);
      } catch {
        return null;
      }
    },

    async deleteKey(providerId: SearchProviderId): Promise<void> {
      if (isNativeVaultActive()) {
        await getNativePlugin().deleteSecret({ id: providerId });
        return;
      }
      vault.deleteApiKey(`${SEARCH_KEY_PREFIX}${providerId}`);
    },

    async listMetadata(): Promise<
      Partial<Record<SearchProviderId, SearchKeyMetadata>>
    > {
      if (isNativeVaultActive()) {
        const res = await getNativePlugin().listMetadata();
        const out: Partial<Record<SearchProviderId, SearchKeyMetadata>> = {};
        for (const p of SEARCH_PROVIDERS) {
          const entry = res.entries?.[p.id];
          if (entry && entry.hasKey) {
            out[p.id] = {
              providerId: p.id,
              hasKey: true,
              maskedPreview: entry.maskedPreview,
              keyHashPrefix: entry.keyHashPrefix,
              updatedAt: entry.updatedAt,
              backend: 'android-keystore',
              hardwareBacked: Boolean(entry.hardwareBacked ?? res.hardwareBacked),
            };
          }
        }
        return out;
      }

      const all = vault.listAllMetadata();
      const out: Partial<Record<SearchProviderId, SearchKeyMetadata>> = {};
      for (const p of SEARCH_PROVIDERS) {
        const entry = all[`${SEARCH_KEY_PREFIX}${p.id}`];
        if (entry && entry.hasKey) {
          out[p.id] = {
            providerId: p.id,
            hasKey: true,
            maskedPreview: entry.maskedPreview,
            keyHashPrefix: entry.keyHashPrefix,
            updatedAt: entry.updatedAt,
            backend: 'webcrypto-vault',
          };
        }
      }
      return out;
    },

    async getVaultInfo(): Promise<SearchVaultInfo> {
      if (isNativeVaultActive()) {
        try {
          const res = await getNativePlugin().verifyVault();
          return {
            backend: 'android-keystore',
            hardwareBacked: Boolean(res.hardwareBacked),
            algorithm: res.algorithm || 'AndroidKeyStore AES-256-GCM',
            keyCount: res.keyCount ?? 0,
          };
        } catch {
          return {
            backend: 'android-keystore',
            hardwareBacked: false,
            algorithm: 'AndroidKeyStore AES-256-GCM',
            keyCount: 0,
          };
        }
      }

      const meta = await this.listMetadata();
      return {
        backend: 'webcrypto-vault',
        hardwareBacked: false,
        algorithm: 'WebCrypto AES-256-GCM',
        keyCount: Object.keys(meta).length,
      };
    },

    async verifyVault(): Promise<{
      passed: boolean;
      backend: 'android-keystore' | 'webcrypto-vault';
      hardwareBacked: boolean;
      algorithm: string;
      durationMs: number;
    }> {
      if (isNativeVaultActive()) {
        const res = await getNativePlugin().verifyVault();
        return {
          passed: Boolean(res.passed),
          backend: 'android-keystore',
          hardwareBacked: Boolean(res.hardwareBacked),
          algorithm: res.algorithm || 'AndroidKeyStore AES-256-GCM',
          durationMs: res.durationMs ?? 1,
        };
      }

      const res = await vault.runCryptoSelfTest();
      return {
        passed: res.passed,
        backend: 'webcrypto-vault',
        hardwareBacked: false,
        algorithm: res.algorithm,
        durationMs: res.durationMs,
      };
    },
  };
}

export const searchKeyStore = createSearchKeyStore();
