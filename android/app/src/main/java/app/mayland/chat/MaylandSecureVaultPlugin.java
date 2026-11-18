package app.mayland.chat;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "MaylandSecureVault")
public class MaylandSecureVaultPlugin extends Plugin {

    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "mayland_search_vault_master_v1";
    private static final String PREFS_NAME = "mayland_secure_search_vault";
    private static final String ENTRY_PREFIX = "secret.";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;

    private final Object vaultLock = new Object();

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateMasterKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE_PROVIDER);
        ks.load(null);

        if (ks.containsAlias(KEY_ALIAS)) {
            KeyStore.Entry entry = ks.getEntry(KEY_ALIAS, null);
            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_PROVIDER
        );
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    @SuppressWarnings("deprecation")
    private boolean isHardwareBacked(SecretKey key) {
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance(
                key.getAlgorithm(),
                KEYSTORE_PROVIDER
            );
            KeyInfo info = (KeyInfo) factory.getKeySpec(key, KeyInfo.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                int level = info.getSecurityLevel();
                return level == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT
                    || level == KeyProperties.SECURITY_LEVEL_STRONGBOX;
            }
            return info.isInsideSecureHardware();
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String formatMaskedKey(String rawKey) {
        String trimmed = rawKey.trim();
        if (trimmed.length() <= 6) {
            return "••••••";
        }
        if (trimmed.length() <= 12) {
            return trimmed.substring(0, 2) + "••••" + trimmed.substring(trimmed.length() - 2);
        }
        return trimmed.substring(0, 5) + "••••" + trimmed.substring(trimmed.length() - 4);
    }

    private static String computeKeyHashPrefix(String rawKey) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(rawKey.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 6 && i < digest.length; i++) {
            sb.append(String.format("%02x", digest[i] & 0xff));
        }
        return sb.toString();
    }

    private String encryptString(SecretKey key, String plaintext, StringBuilder outIvB64)
        throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] iv = cipher.getIV();
        byte[] cipherBytes = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        outIvB64.append(Base64.encodeToString(iv, Base64.NO_WRAP));
        return Base64.encodeToString(cipherBytes, Base64.NO_WRAP);
    }

    private String decryptString(SecretKey key, String ivB64, String cipherB64)
        throws Exception {
        byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
        byte[] cipherBytes = Base64.decode(cipherB64, Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] plainBytes = cipher.doFinal(cipherBytes);
        return new String(plainBytes, StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void setSecret(PluginCall call) {
        String id = call.getString("id");
        String value = call.getString("value");
        if (id == null || id.trim().isEmpty()) {
            call.reject("Missing secret id");
            return;
        }
        if (value == null || value.trim().isEmpty()) {
            call.reject("API key cannot be empty");
            return;
        }

        String cleanId = id.trim();
        String cleanVal = value.trim();

        synchronized (vaultLock) {
            try {
                SecretKey key = getOrCreateMasterKey();
                boolean hw = isHardwareBacked(key);
                StringBuilder ivBuilder = new StringBuilder();
                String cipherB64 = encryptString(key, cleanVal, ivBuilder);
                String maskedPreview = formatMaskedKey(cleanVal);
                String keyHashPrefix = computeKeyHashPrefix(cleanVal);
                long now = System.currentTimeMillis();

                JSObject record = new JSObject();
                record.put("v", 1);
                record.put("ivB64", ivBuilder.toString());
                record.put("ciphertextB64", cipherB64);
                record.put("maskedPreview", maskedPreview);
                record.put("keyHashPrefix", keyHashPrefix);
                record.put("updatedAt", now);

                boolean committed = getPrefs()
                    .edit()
                    .putString(ENTRY_PREFIX + cleanId, record.toString())
                    .commit();

                if (!committed) {
                    call.reject("Failed to commit encrypted secret to Android SharedPreferences");
                    return;
                }

                JSObject ret = new JSObject();
                ret.put("providerId", cleanId);
                ret.put("hasKey", true);
                ret.put("maskedPreview", maskedPreview);
                ret.put("keyHashPrefix", keyHashPrefix);
                ret.put("updatedAt", now);
                ret.put("backend", "android-keystore");
                ret.put("hardwareBacked", hw);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Android Keystore encryption failed: " + ex.getMessage(), ex);
            }
        }
    }

    @PluginMethod
    public void getSecret(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) {
            call.reject("Missing secret id");
            return;
        }

        String cleanId = id.trim();
        synchronized (vaultLock) {
            try {
                String raw = getPrefs().getString(ENTRY_PREFIX + cleanId, null);
                if (raw == null || raw.isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("found", false);
                    ret.put("value", (String) null);
                    call.resolve(ret);
                    return;
                }

                JSObject record = new JSObject(raw);
                String ivB64 = record.getString("ivB64");
                String cipherB64 = record.getString("ciphertextB64");
                if (ivB64 == null || cipherB64 == null) {
                    call.reject("Corrupted secret envelope");
                    return;
                }

                SecretKey key = getOrCreateMasterKey();
                String plain = decryptString(key, ivB64, cipherB64);

                JSObject ret = new JSObject();
                ret.put("found", true);
                ret.put("value", plain);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Android Keystore decryption failed: " + ex.getMessage(), ex);
            }
        }
    }

    @PluginMethod
    public void deleteSecret(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) {
            call.reject("Missing secret id");
            return;
        }

        String cleanId = id.trim();
        synchronized (vaultLock) {
            boolean committed = getPrefs()
                .edit()
                .remove(ENTRY_PREFIX + cleanId)
                .commit();
            JSObject ret = new JSObject();
            ret.put("deleted", committed);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void listMetadata(PluginCall call) {
        synchronized (vaultLock) {
            try {
                SecretKey key = getOrCreateMasterKey();
                boolean hw = isHardwareBacked(key);
                Map<String, ?> all = getPrefs().getAll();
                JSObject entries = new JSObject();

                for (Map.Entry<String, ?> item : all.entrySet()) {
                    String k = item.getKey();
                    if (k == null || !k.startsWith(ENTRY_PREFIX)) continue;
                    if (!(item.getValue() instanceof String)) continue;

                    String providerId = k.substring(ENTRY_PREFIX.length());
                    try {
                        JSObject rec = new JSObject((String) item.getValue());
                        JSObject meta = new JSObject();
                        meta.put("providerId", providerId);
                        meta.put("hasKey", true);
                        meta.put("maskedPreview", rec.optString("maskedPreview", "••••••"));
                        meta.put("keyHashPrefix", rec.optString("keyHashPrefix", ""));
                        meta.put("updatedAt", rec.optLong("updatedAt", 0L));
                        meta.put("backend", "android-keystore");
                        meta.put("hardwareBacked", hw);
                        entries.put(providerId, meta);
                    } catch (Exception ignored) {
                        // Skip malformed record
                    }
                }

                JSObject ret = new JSObject();
                ret.put("entries", entries);
                ret.put("backend", "android-keystore");
                ret.put("hardwareBacked", hw);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Failed to inspect Android Keystore vault: " + ex.getMessage(), ex);
            }
        }
    }

    @PluginMethod
    public void verifyVault(PluginCall call) {
        synchronized (vaultLock) {
            long t0 = System.currentTimeMillis();
            try {
                SecretKey key = getOrCreateMasterKey();
                boolean hw = isHardwareBacked(key);
                String probe = "mayland-ks-probe-" + t0;
                StringBuilder ivBuilder = new StringBuilder();
                String cipherB64 = encryptString(key, probe, ivBuilder);
                String decoded = decryptString(key, ivBuilder.toString(), cipherB64);

                int count = 0;
                for (String k : getPrefs().getAll().keySet()) {
                    if (k != null && k.startsWith(ENTRY_PREFIX)) {
                        count += 1;
                    }
                }

                long elapsed = Math.max(1L, System.currentTimeMillis() - t0);
                JSObject ret = new JSObject();
                ret.put("passed", probe.equals(decoded));
                ret.put("backend", "android-keystore");
                ret.put("hardwareBacked", hw);
                ret.put("algorithm", "AndroidKeyStore AES-256-GCM");
                ret.put("keyCount", count);
                ret.put("durationMs", elapsed);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Android Keystore self-test failed: " + ex.getMessage(), ex);
            }
        }
    }
}
