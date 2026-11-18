import { describe, expect, it } from 'vitest';
import { createKeyVault, KeyVaultError, type KeyVaultStorage } from './keyVault';

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
    // Helper exposed for test assertions
    _rawDump: () => Array.from(items.entries()),
  } as KeyVaultStorage & { _rawDump: () => Array<[string, string]> };
}

describe('keyVault (AES-256-GCM + PBKDF2-SHA256)', () => {
  it('encrypts API key with AES-256-GCM without storing plaintext and decrypts accurately', async () => {
    const storage = createMemoryStorage() as KeyVaultStorage & {
      _rawDump: () => Array<[string, string]>;
    };
    const vault = createKeyVault(storage);
    const secret = 'sk-or-v1-super-secret-mayland-9876543210';

    const meta = await vault.encryptApiKey('openrouter-1', secret);
    expect(meta.algorithm).toBe('AES-GCM-256');
    expect(meta.kdf).toBe('DEVICE-WRAP');
    expect(meta.maskedPreview).toBe('sk-or••••3210');

    // Verify raw persisted strings contain zero plaintext secret
    const serialized = JSON.stringify(storage._rawDump());
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('super-secret-mayland');

    const decrypted = await vault.decryptApiKey('openrouter-1');
    expect(decrypted).toBe(secret);
  });

  it('upgrades existing keys to PBKDF2 Master PIN, locks/unlocks, and rejects wrong PIN', async () => {
    const storage = createMemoryStorage();
    const vault = createKeyVault(storage);
    const fwSecret = 'fw_live_fireworks_key_abc12345';

    await vault.encryptApiKey('fireworks-1', fwSecret);
    await vault.enableMasterPin('246810');

    expect(vault.getVaultStatus().pinEnabled).toBe(true);
    expect(vault.getEnvelopeMeta('fireworks-1')?.kdf).toBe('PBKDF2-SHA256');

    vault.lockVault();
    expect(vault.getVaultStatus().unlocked).toBe(false);

    await expect(vault.decryptApiKey('fireworks-1')).rejects.toBeInstanceOf(
      KeyVaultError
    );
    await expect(vault.unlockWithPin('000000')).rejects.toMatchObject({
      code: 'INVALID_PIN',
    });

    await vault.unlockWithPin('246810');
    expect(vault.getVaultStatus().unlocked).toBe(true);
    expect(await vault.decryptApiKey('fireworks-1')).toBe(fwSecret);

    await vault.disableMasterPin('246810');
    expect(vault.getVaultStatus().pinEnabled).toBe(false);
    expect(vault.getEnvelopeMeta('fireworks-1')?.kdf).toBe('DEVICE-WRAP');
    expect(await vault.decryptApiKey('fireworks-1')).toBe(fwSecret);
  });

  it('passes live cryptographic self-test', async () => {
    const vault = createKeyVault(createMemoryStorage());
    const result = await vault.runCryptoSelfTest();
    expect(result.passed).toBe(true);
    expect(result.algorithm).toContain('AES-256-GCM');
  });

  it('exports and imports encrypted vault envelopes & workspace key across separate stores', async () => {
    const profileStorage = createMemoryStorage();
    const targetStorage = createMemoryStorage();
    const vaultA = createKeyVault(profileStorage);
    const vaultB = createKeyVault(targetStorage);
    const apiKey = 'sk-strata-live-sync-key-12345';

    await vaultA.encryptApiKey('strata-custom', apiKey);
    const exported = await vaultA.exportSyncVault();
    expect(exported.envelopes['strata-custom']).toBeDefined();
    expect(exported.deviceKeyJwk?.kty).toBe('oct');

    await vaultB.importSyncVault(exported);
    const decryptedInOtherProfile = await vaultB.decryptApiKey('strata-custom');
    expect(decryptedInOtherProfile).toBe(apiKey);
  });
});
