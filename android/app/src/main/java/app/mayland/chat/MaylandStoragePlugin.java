package app.mayland.chat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "MaylandStorage")
public class MaylandStoragePlugin extends Plugin {

    private static final String STATE_FILE = "mayland_workspace_state.json";

    private File getStateFile() {
        return new File(getContext().getFilesDir(), STATE_FILE);
    }

    @PluginMethod
    public void loadState(PluginCall call) {
        File target = getStateFile();
        JSObject ret = new JSObject();
        if (!target.exists()) {
            ret.put("json", (String) null);
            call.resolve(ret);
            return;
        }
        try (FileInputStream in = new FileInputStream(target);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }
            ret.put("json", out.toString(StandardCharsets.UTF_8.name()));
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to read Mayland native state: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void saveState(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("Missing json payload");
            return;
        }
        File target = getStateFile();
        File tmp = new File(getContext().getFilesDir(), STATE_FILE + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp, false)) {
            out.write(json.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (Exception ex) {
            call.reject("Failed to write Mayland native state: " + ex.getMessage(), ex);
            return;
        }
        if (target.exists() && !target.delete()) {
            // Fall through; renameTo on modern Android replaces atomically
        }
        if (!tmp.renameTo(target)) {
            call.reject("Failed to commit Mayland native state file");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("saved", true);
        call.resolve(ret);
    }
}
