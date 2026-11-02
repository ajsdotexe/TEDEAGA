package app.tedeaga.mobile;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureStore")
public class SecureStorePlugin extends Plugin {
    private static final String KEY_ALIAS = "tedeaga.secure-store.v1";
    private static final String PREFS = "tedeaga_secure_values";

    @PluginMethod
    public void get(PluginCall call) {
        String name = call.getString("key", "");
        String encoded = getContext().getSharedPreferences(PREFS, 0).getString(name, null);
        JSObject result = new JSObject();
        result.put("value", encoded == null ? JSObject.NULL : decrypt(encoded));
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("key", "");
        String value = call.getString("value", "");
        getContext().getSharedPreferences(PREFS, 0).edit().putString(name, encrypt(value)).apply();
        call.resolve();
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String name = call.getString("key", "");
        getContext().getSharedPreferences(PREFS, 0).edit().remove(name).apply();
        call.resolve();
    }

    private SecretKey secretKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }

    private String encrypt(String value) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey());
            byte[] data = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(data, Base64.NO_WRAP);
        } catch (Exception e) { throw new RuntimeException("Não foi possível proteger a chave", e); }
    }

    private String decrypt(String encoded) {
        try {
            String[] parts = encoded.split("\\.", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new RuntimeException("Não foi possível ler a chave protegida", e); }
    }
}
