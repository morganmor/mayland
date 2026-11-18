import { describe, expect, it } from 'vitest';
import { createKeyVault, type KeyVaultStorage } from './keyVault';
import { createSearchKeyStore } from './searchKeyStore';

function createMemoryStorage(): KeyVaultStorage {
  const items = new Map<string, string>();
  let deviceKey: CryptoKey | null = null;
  return {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => {
      items.set(k, v);
    },
    removeItem: (k) => {
      items.delete(k);
    },
    getDeviceKey: async () => deviceKey,
    setDeviceKey: async (k) => {
      deviceKey = k;
    },
    _dump: () => Array.from(items.entries()),
  } as KeyVaultStorage & { _dump: () => Array<[string, string]> };
}

describe('searchKeyStore (Android Keystore & WebCrypto AES-256-GCM)', () => {
  it('stores search keys encrypted on web without plaintext leakage', async () => {
    const storage = createMemoryStorage() as KeyVaultStorage & {
      _dump: () => Array<[string, string]>;
    };
    const webVault = createKeyVault(storage);
    const store = createSearchKeyStore({ webVault, useNative: false });
    const rawKey = 'tvly-dev-super-secret-search-key-8899';

    const meta = await store.saveKey('tavily', rawKey);
    expect(meta.backend).toBe('webcrypto-vault');
    expect(meta.maskedPreview).toBe('tvly-••••8899');

    const dumped = JSON.stringify(storage._dump());
    expect(dumped).not.toContain(rawKey);
    expect(dumped).not.toContain('super-secret-search-key');

    expect(await store.getKey('tavily')).toBe(rawKey);
    const listed = await store.listMetadata();
    expect(listed.tavily?.hasKey).toBe(true);

    await store.deleteKey('tavily');
    expect(await store.getKey('tavily')).toBeNull();
  });

  it('delegates to native Android Keystore plugin when running on Android', async () => {
    const nativeSecrets = new Map<string, string>();
    const nativePlugin = {
      async setSecret({ id, value }: { id: string; value: string }) {
        nativeSecrets.set(id, value);
        return {
          providerId: id,
          hasKey: true,
          maskedPreview: `${value.slice(0, 5)}••••${value.slice(-4)}`,
          keyHashPrefix: 'aabbccddeeff',
          updatedAt: 123456,
          backend: 'android-keystore' as const,
          hardwareBacked: true,
        };
      },
      async getSecret({ id }: { id: string }) {
        const v = nativeSecrets.get(id) ?? null;
        return { found: v !== null, value: v };
      },
      async deleteSecret({ id }: { id: string }) {
        nativeSecrets.delete(id);
        return { deleted: true };
      },
      async listMetadata() {
        const entries: Record<string, {
          providerId: string;
          hasKey: boolean;
          maskedPreview: string;
          keyHashPrefix: string;
          updatedAt: number;
          backend: 'android-keystore';
          hardwareBacked: boolean;
        }> = {};
        for (const [id, v] of nativeSecrets.entries()) {
          entries[id] = {
            providerId: id,
            hasKey: true,
            maskedPreview: `${v.slice(0, 5)}••••${v.slice(-4)}`,
            keyHashPrefix: 'aabbccddeeff',
            updatedAt: 123456,
            backend: 'android-keystore',
            hardwareBacked: true,
          };
        }
        return { entries, backend: 'android-keystore' as const, hardwareBacked: true };
      },
      async verifyVault() {
        return {
          passed: true,
          backend: 'android-keystore' as const,
          hardwareBacked: true,
          algorithm: 'AndroidKeyStore AES-256-GCM',
          keyCount: nativeSecrets.size,
          durationMs: 2,
        };
      },
    };

    const store = createSearchKeyStore({ nativePlugin, useNative: true });
    const meta = await store.saveKey('brave', 'BSA-native-keystore-9876');
    expect(meta.backend).toBe('android-keystore');
    expect(meta.hardwareBacked).toBe(true);
    expect(await store.getKey('brave')).toBe('BSA-native-keystore-9876');

    const info = await store.getVaultInfo();
    expect(info.backend).toBe('android-keystore');
    expect(info.hardwareBacked).toBe(true);
    expect(info.keyCount).toBe(1);

    const verification = await store.verifyVault();
    expect(verification.passed).toBe(true);
    expect(verification.algorithm).toBe('AndroidKeyStore AES-256-GCM');
  });
});
