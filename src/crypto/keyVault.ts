import type {
  EncryptedKeyEnvelope,
  EnvelopeMetadata,
  VaultStatus,
} from '../types/mayland';

const ENVELOPES_STORAGE_KEY = 'mayland.crypto.envelopes.v1';
const PIN_CONFIG_STORAGE_KEY = 'mayland.crypto.pin.v1';
const IDB_NAME = 'mayland_keyvault_db';
const IDB_STORE = 'master_keys';
const IDB_DEVICE_KEY_ID = 'device_aes_gcm_256';
const PIN_VERIFIER_TOKEN = 'MAYLAND_PIN_VERIFIER_OK_V1';
const PBKDF2_ITERATIONS = 310_000;

export interface PinConfigRecord {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltB64: string;
  verifierIvB64: string;
  verifierCiphertextB64: string;
  updatedAt: number;
}

export interface VaultSyncSnapshot {
  envelopes: Record<string, EncryptedKeyEnvelope>;
  pinConfig: PinConfigRecord | null;
  deviceKeyJwk?: JsonWebKey | null;
}

export interface KeyVaultStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  getDeviceKey(): Promise<CryptoKey | null>;
  setDeviceKey(key: CryptoKey): Promise<void>;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function formatMaskedKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.length <= 6) {
    return '••••••';
  }
  if (trimmed.length <= 12) {
    return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 5)}••••${trimmed.slice(-4)}`;
}

async function computeKeyHashPrefix(rawKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(rawKey));
  const bytes = new Uint8Array(digest).slice(0, 6);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function openVaultIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function createBrowserStorage(): KeyVaultStorage {
  let memoryFallbackKey: CryptoKey | null = null;
  const fallbackMap = new Map<string, string>();

  return {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return fallbackMap.get(key) ?? null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        fallbackMap.set(key, value);
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        fallbackMap.delete(key);
      }
    },
    async getDeviceKey() {
      if (typeof indexedDB === 'undefined') {
        return memoryFallbackKey;
      }
      try {
        const db = await openVaultIdb();
        return await new Promise<CryptoKey | null>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const req = store.get(IDB_DEVICE_KEY_ID);
          req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
          req.onerror = () => reject(req.error);
        });
      } catch {
        return memoryFallbackKey;
      }
    },
    async setDeviceKey(key) {
      memoryFallbackKey = key;
      if (typeof indexedDB === 'undefined') return;
      try {
        const db = await openVaultIdb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          const req = store.put(key, IDB_DEVICE_KEY_ID);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        // Fallback already populated in memoryFallbackKey
      }
    },
  };
}

export class KeyVaultError extends Error {
  code:
    | 'CRYPTO_UNAVAILABLE'
    | 'VAULT_LOCKED'
    | 'INVALID_PIN'
    | 'KEY_NOT_FOUND'
    | 'DECRYPT_FAILED';

  constructor(
    code: KeyVaultError['code'],
    message: string
  ) {
    super(message);
    this.name = 'KeyVaultError';
    this.code = code;
  }
}

export function createKeyVault(storage: KeyVaultStorage = createBrowserStorage()) {
  let unlockedPinKey: CryptoKey | null = null;
  let cachedDeviceKey: CryptoKey | null = null;

  function ensureWebCrypto(): void {
    if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
      throw new KeyVaultError(
        'CRYPTO_UNAVAILABLE',
        'WebCrypto SubtleCrypto is unavailable in this environment.'
      );
    }
  }

  function readEnvelopes(): Record<string, EncryptedKeyEnvelope> {
    const raw = storage.getItem(ENVELOPES_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, EncryptedKeyEnvelope>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeEnvelopes(map: Record<string, EncryptedKeyEnvelope>): void {
    storage.setItem(ENVELOPES_STORAGE_KEY, JSON.stringify(map));
  }

  function readPinConfig(): PinConfigRecord | null {
    const raw = storage.getItem(PIN_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PinConfigRecord;
      return parsed && parsed.kdf === 'PBKDF2-SHA256' ? parsed : null;
    } catch {
      return null;
    }
  }

  async function getOrCreateDeviceKey(): Promise<CryptoKey> {
    ensureWebCrypto();
    if (cachedDeviceKey) return cachedDeviceKey;

    const existing = await storage.getDeviceKey();
    if (existing) {
      cachedDeviceKey = existing;
      return existing;
    }

    const generated = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    await storage.setDeviceKey(generated);
    cachedDeviceKey = generated;
    return generated;
  }

  async function derivePinKey(
    pin: string,
    saltBytes: Uint8Array,
    iterations = PBKDF2_ITERATIONS
  ): Promise<CryptoKey> {
    ensureWebCrypto();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: toArrayBuffer(saltBytes),
        iterations,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptWithKey(
    key: CryptoKey,
    plaintext: string
  ): Promise<{ ivB64: string; ciphertextB64: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      textEncoder.encode(plaintext)
    );
    return {
      ivB64: bytesToBase64(iv),
      ciphertextB64: bytesToBase64(new Uint8Array(cipherBuf)),
    };
  }

  async function decryptWithKey(
    key: CryptoKey,
    ivB64: string,
    ciphertextB64: string
  ): Promise<string> {
    try {
      const iv = base64ToBytes(ivB64);
      const cipher = base64ToBytes(ciphertextB64);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key,
        toArrayBuffer(cipher)
      );
      return textDecoder.decode(plainBuf);
    } catch {
      throw new KeyVaultError(
        'DECRYPT_FAILED',
        'AES-256-GCM decryption failed. Encrypted payload or key mismatch.'
      );
    }
  }

  async function getActiveWriteKey(): Promise<{
    key: CryptoKey;
    kdf: 'DEVICE-WRAP' | 'PBKDF2-SHA256';
    iterations?: number;
    saltB64: string;
  }> {
    const pinCfg = readPinConfig();
    if (pinCfg) {
      if (!unlockedPinKey) {
        throw new KeyVaultError(
          'VAULT_LOCKED',
          'Vault is locked by your Master PIN. Unlock it to continue.'
        );
      }
      return {
        key: unlockedPinKey,
        kdf: 'PBKDF2-SHA256',
        iterations: pinCfg.iterations,
        saltB64: pinCfg.saltB64,
      };
    }

    const deviceKey = await getOrCreateDeviceKey();
    const freshSalt = crypto.getRandomValues(new Uint8Array(16));
    return {
      key: deviceKey,
      kdf: 'DEVICE-WRAP',
      saltB64: bytesToBase64(freshSalt),
    };
  }

  async function resolveKeyForEnvelope(
    envelope: EncryptedKeyEnvelope
  ): Promise<CryptoKey> {
    if (envelope.kdf === 'PBKDF2-SHA256') {
      if (!unlockedPinKey) {
        throw new KeyVaultError(
          'VAULT_LOCKED',
          'API key vault is locked. Enter your Master PIN to decrypt.'
        );
      }
      return unlockedPinKey;
    }
    return getOrCreateDeviceKey();
  }

  return {
    getVaultStatus(): VaultStatus {
      const pinCfg = readPinConfig();
      const envelopes = readEnvelopes();
      return {
        pinEnabled: Boolean(pinCfg),
        unlocked: pinCfg ? unlockedPinKey !== null : true,
        keyCount: Object.keys(envelopes).length,
        cryptoAvailable:
          typeof globalThis.crypto !== 'undefined' && Boolean(globalThis.crypto.subtle),
      };
    },

    async encryptApiKey(profileId: string, rawApiKey: string): Promise<EnvelopeMetadata> {
      const cleaned = rawApiKey.trim();
      if (!cleaned) {
        throw new Error('API key cannot be empty.');
      }

      const active = await getActiveWriteKey();
      const { ivB64, ciphertextB64 } = await encryptWithKey(active.key, cleaned);
      const keyHashPrefix = await computeKeyHashPrefix(cleaned);
      const now = Date.now();

      const envelope: EncryptedKeyEnvelope = {
        version: 1,
        algorithm: 'AES-GCM-256',
        kdf: active.kdf,
        iterations: active.iterations,
        saltB64: active.saltB64,
        ivB64,
        ciphertextB64,
        maskedPreview: formatMaskedKey(cleaned),
        keyHashPrefix,
        updatedAt: now,
      };

      const map = readEnvelopes();
      map[profileId] = envelope;
      writeEnvelopes(map);

      return {
        profileId,
        hasKey: true,
        algorithm: envelope.algorithm,
        kdf: envelope.kdf,
        iterations: envelope.iterations,
        ivPreview: `${envelope.ivB64.slice(0, 10)}…`,
        ciphertextPreview: `${envelope.ciphertextB64.slice(0, 18)}…`,
        maskedPreview: envelope.maskedPreview,
        keyHashPrefix: envelope.keyHashPrefix,
        updatedAt: envelope.updatedAt,
      };
    },

    async decryptApiKey(profileId: string): Promise<string> {
      const map = readEnvelopes();
      const envelope = map[profileId];
      if (!envelope) {
        throw new KeyVaultError(
          'KEY_NOT_FOUND',
          'No API key saved for this provider profile yet.'
        );
      }
      const key = await resolveKeyForEnvelope(envelope);
      return decryptWithKey(key, envelope.ivB64, envelope.ciphertextB64);
    },

    getEnvelopeMeta(profileId: string): EnvelopeMetadata | null {
      const map = readEnvelopes();
      const envelope = map[profileId];
      if (!envelope) return null;
      return {
        profileId,
        hasKey: true,
        algorithm: envelope.algorithm,
        kdf: envelope.kdf,
        iterations: envelope.iterations,
        ivPreview: `${envelope.ivB64.slice(0, 10)}…`,
        ciphertextPreview: `${envelope.ciphertextB64.slice(0, 18)}…`,
        maskedPreview: envelope.maskedPreview,
        keyHashPrefix: envelope.keyHashPrefix,
        updatedAt: envelope.updatedAt,
      };
    },

    listAllMetadata(): Record<string, EnvelopeMetadata> {
      const map = readEnvelopes();
      const out: Record<string, EnvelopeMetadata> = {};
      for (const [id, envelope] of Object.entries(map)) {
        out[id] = {
          profileId: id,
          hasKey: true,
          algorithm: envelope.algorithm,
          kdf: envelope.kdf,
          iterations: envelope.iterations,
          ivPreview: `${envelope.ivB64.slice(0, 10)}…`,
          ciphertextPreview: `${envelope.ciphertextB64.slice(0, 18)}…`,
          maskedPreview: envelope.maskedPreview,
          keyHashPrefix: envelope.keyHashPrefix,
          updatedAt: envelope.updatedAt,
        };
      }
      return out;
    },

    deleteApiKey(profileId: string): void {
      const map = readEnvelopes();
      if (profileId in map) {
        delete map[profileId];
        writeEnvelopes(map);
      }
    },

    async enableMasterPin(pin: string): Promise<void> {
      const cleaned = pin.trim();
      if (cleaned.length < 4) {
        throw new Error('Master PIN must be at least 4 characters.');
      }

      const existingPin = readPinConfig();
      if (existingPin && !unlockedPinKey) {
        throw new KeyVaultError(
          'VAULT_LOCKED',
          'Unlock the current PIN before setting a new one.'
        );
      }

      const currentEnvelopes = readEnvelopes();
      const decryptedPairs: Array<[string, string, EncryptedKeyEnvelope]> = [];
      for (const [id, env] of Object.entries(currentEnvelopes)) {
        const key = await resolveKeyForEnvelope(env);
        const plain = await decryptWithKey(key, env.ivB64, env.ciphertextB64);
        decryptedPairs.push([id, plain, env]);
      }

      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = bytesToBase64(saltBytes);
      const pinKey = await derivePinKey(cleaned, saltBytes, PBKDF2_ITERATIONS);
      const verifier = await encryptWithKey(pinKey, PIN_VERIFIER_TOKEN);

      const reencrypted: Record<string, EncryptedKeyEnvelope> = {};
      for (const [id, plain, oldEnv] of decryptedPairs) {
        const { ivB64, ciphertextB64 } = await encryptWithKey(pinKey, plain);
        reencrypted[id] = {
          ...oldEnv,
          kdf: 'PBKDF2-SHA256',
          iterations: PBKDF2_ITERATIONS,
          saltB64,
          ivB64,
          ciphertextB64,
          updatedAt: Date.now(),
        };
      }

      const pinCfg: PinConfigRecord = {
        version: 1,
        kdf: 'PBKDF2-SHA256',
        iterations: PBKDF2_ITERATIONS,
        saltB64,
        verifierIvB64: verifier.ivB64,
        verifierCiphertextB64: verifier.ciphertextB64,
        updatedAt: Date.now(),
      };

      storage.setItem(PIN_CONFIG_STORAGE_KEY, JSON.stringify(pinCfg));
      writeEnvelopes(reencrypted);
      unlockedPinKey = pinKey;
    },

    async unlockWithPin(pin: string): Promise<void> {
      const pinCfg = readPinConfig();
      if (!pinCfg) {
        unlockedPinKey = null;
        return;
      }

      const saltBytes = base64ToBytes(pinCfg.saltB64);
      const candidateKey = await derivePinKey(pin.trim(), saltBytes, pinCfg.iterations);
      let verified: string;
      try {
        verified = await decryptWithKey(
          candidateKey,
          pinCfg.verifierIvB64,
          pinCfg.verifierCiphertextB64
        );
      } catch {
        throw new KeyVaultError('INVALID_PIN', 'Incorrect Master PIN.');
      }

      if (verified !== PIN_VERIFIER_TOKEN) {
        throw new KeyVaultError('INVALID_PIN', 'Incorrect Master PIN.');
      }

      unlockedPinKey = candidateKey;
    },

    async disableMasterPin(currentPin: string): Promise<void> {
      const pinCfg = readPinConfig();
      if (!pinCfg) return;

      await this.unlockWithPin(currentPin);
      const deviceKey = await getOrCreateDeviceKey();
      const currentEnvelopes = readEnvelopes();
      const reencrypted: Record<string, EncryptedKeyEnvelope> = {};

      for (const [id, env] of Object.entries(currentEnvelopes)) {
        const key = await resolveKeyForEnvelope(env);
        const plain = await decryptWithKey(key, env.ivB64, env.ciphertextB64);
        const { ivB64, ciphertextB64 } = await encryptWithKey(deviceKey, plain);
        const freshSalt = crypto.getRandomValues(new Uint8Array(16));
        reencrypted[id] = {
          ...env,
          kdf: 'DEVICE-WRAP',
          iterations: undefined,
          saltB64: bytesToBase64(freshSalt),
          ivB64,
          ciphertextB64,
          updatedAt: Date.now(),
        };
      }

      writeEnvelopes(reencrypted);
      storage.removeItem(PIN_CONFIG_STORAGE_KEY);
      unlockedPinKey = null;
    },

    lockVault(): void {
      unlockedPinKey = null;
    },

    async runCryptoSelfTest(): Promise<{
      passed: boolean;
      algorithm: string;
      sampleCipherPreview: string;
      durationMs: number;
    }> {
      const t0 = performance.now();
      const active = await getActiveWriteKey();
      const probe = `mayland-probe-${Date.now()}`;
      const { ivB64, ciphertextB64 } = await encryptWithKey(active.key, probe);
      const decoded = await decryptWithKey(active.key, ivB64, ciphertextB64);
      const durationMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        passed: decoded === probe,
        algorithm: `AES-256-GCM (${active.kdf})`,
        sampleCipherPreview: `${ivB64.slice(0, 8)}:${ciphertextB64.slice(0, 14)}…`,
        durationMs,
      };
    },

    async exportSyncVault(preferredJwk?: JsonWebKey | null): Promise<VaultSyncSnapshot> {
      const envelopes = readEnvelopes();
      const pinConfig = readPinConfig();

      if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
        return { envelopes, pinConfig, deviceKeyJwk: preferredJwk ?? null };
      }

      const oldKey = cachedDeviceKey ?? (await storage.getDeviceKey());
      let targetKey: CryptoKey | null = null;
      let switchedKey = false;

      if (preferredJwk) {
        try {
          targetKey = await crypto.subtle.importKey(
            'jwk',
            preferredJwk,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          if (oldKey !== targetKey) {
            switchedKey = Boolean(oldKey);
          }
        } catch {
          targetKey = null;
        }
      }

      if (!targetKey) {
        if (oldKey && oldKey.extractable) {
          targetKey = oldKey;
        } else {
          targetKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          switchedKey = Boolean(oldKey);
        }
      }

      const nextEnvelopes: Record<string, EncryptedKeyEnvelope> = { ...envelopes };
      if (switchedKey && oldKey) {
        for (const [id, env] of Object.entries(nextEnvelopes)) {
          if (env.kdf !== 'DEVICE-WRAP') continue;
          try {
            const plain = await decryptWithKey(oldKey, env.ivB64, env.ciphertextB64);
            const reenc = await encryptWithKey(targetKey, plain);
            nextEnvelopes[id] = {
              ...env,
              ivB64: reenc.ivB64,
              ciphertextB64: reenc.ciphertextB64,
              updatedAt: Date.now(),
            };
          } catch {
            // Envelope might already be wrapped with targetKey; keep as-is
          }
        }
        writeEnvelopes(nextEnvelopes);
      }

      await storage.setDeviceKey(targetKey);
      cachedDeviceKey = targetKey;
      const deviceKeyJwk = await crypto.subtle.exportKey('jwk', targetKey);

      return {
        envelopes: nextEnvelopes,
        pinConfig,
        deviceKeyJwk,
      };
    },

    async importSyncVault(snapshot: Partial<VaultSyncSnapshot>): Promise<void> {
      if (snapshot.deviceKeyJwk && globalThis.crypto?.subtle) {
        try {
          const imported = await crypto.subtle.importKey(
            'jwk',
            snapshot.deviceKeyJwk,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          await storage.setDeviceKey(imported);
          cachedDeviceKey = imported;
        } catch {
          // ignore malformed JWK
        }
      }

      if (snapshot.envelopes && typeof snapshot.envelopes === 'object') {
        writeEnvelopes(snapshot.envelopes);
      }

      if (snapshot.pinConfig) {
        const existingPin = readPinConfig();
        if (
          !existingPin ||
          existingPin.saltB64 !== snapshot.pinConfig.saltB64 ||
          existingPin.verifierCiphertextB64 !== snapshot.pinConfig.verifierCiphertextB64
        ) {
          unlockedPinKey = null;
        }
        storage.setItem(PIN_CONFIG_STORAGE_KEY, JSON.stringify(snapshot.pinConfig));
      } else if (snapshot.pinConfig === null) {
        storage.removeItem(PIN_CONFIG_STORAGE_KEY);
        unlockedPinKey = null;
      }
    },
  };
}

export const keyVault = createKeyVault();
