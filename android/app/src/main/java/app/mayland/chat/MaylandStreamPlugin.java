package app.mayland.chat;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "MaylandStream")
public class MaylandStreamPlugin extends Plugin {

    private static final class ActiveStream {
        final AtomicBoolean aborted = new AtomicBoolean(false);
        volatile HttpURLConnection conn;
    }

    private final ConcurrentHashMap<String, ActiveStream> active = new ConcurrentHashMap<>();
    private final ExecutorService pool = Executors.newCachedThreadPool();

    private void emitStreamEvent(JSObject payload) {
        notifyListeners("streamEvent", payload);
    }

    @PluginMethod
    public void startStream(PluginCall call) {
        String streamId = call.getString("streamId");
        String urlStr = call.getString("url");
        if (streamId == null || urlStr == null || urlStr.trim().isEmpty()) {
            call.reject("Missing streamId or url");
            return;
        }

        String method = call.getString("method", "GET");
        JSObject headers = call.getObject("headers");
        String body = call.getString("body");

        ActiveStream handle = new ActiveStream();
        active.put(streamId, handle);

        JSObject ack = new JSObject();
        ack.put("started", true);
        call.resolve(ack);

        pool.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                handle.conn = conn;
                conn.setRequestMethod(method);
                conn.setConnectTimeout(20000);
                // Unlimited read timeout so long thinking/prefill pauses never drop SSE sockets
                conn.setReadTimeout(0);
                conn.setInstanceFollowRedirects(true);
                conn.setUseCaches(false);

                boolean hasAcceptEncoding = false;
                if (headers != null) {
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        String val = headers.getString(key);
                        if (val != null) {
                            if ("accept-encoding".equalsIgnoreCase(key)) {
                                hasAcceptEncoding = true;
                            }
                            conn.setRequestProperty(key, val);
                        }
                    }
                }
                if (!hasAcceptEncoding) {
                    conn.setRequestProperty("Accept-Encoding", "identity");
                }

                if (body != null && !"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
                    byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
                    conn.setDoOutput(true);
                    conn.setFixedLengthStreamingMode(bodyBytes.length);
                    try (OutputStream out = conn.getOutputStream()) {
                        out.write(bodyBytes);
                        out.flush();
                    }
                }

                if (handle.aborted.get()) {
                    return;
                }

                int status = conn.getResponseCode();
                JSObject respHeaders = new JSObject();
                Map<String, List<String>> rawHeaders = conn.getHeaderFields();
                if (rawHeaders != null) {
                    for (Map.Entry<String, List<String>> entry : rawHeaders.entrySet()) {
                        if (entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) {
                            continue;
                        }
                        respHeaders.put(entry.getKey().toLowerCase(), String.join(", ", entry.getValue()));
                    }
                }

                JSObject openEvt = new JSObject();
                openEvt.put("streamId", streamId);
                openEvt.put("type", "open");
                openEvt.put("status", status);
                openEvt.put("headers", respHeaders);
                emitStreamEvent(openEvt);

                InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                if (in != null) {
                    byte[] buf = new byte[4096];
                    int read;
                    while (!handle.aborted.get() && (read = in.read(buf)) != -1) {
                        if (read == 0) continue;
                        String b64 = Base64.encodeToString(buf, 0, read, Base64.NO_WRAP);
                        JSObject chunkEvt = new JSObject();
                        chunkEvt.put("streamId", streamId);
                        chunkEvt.put("type", "chunk");
                        chunkEvt.put("data", b64);
                        emitStreamEvent(chunkEvt);
                    }
                    try {
                        in.close();
                    } catch (Exception ignored) {
                        // ignore close error
                    }
                }

                if (!handle.aborted.get()) {
                    JSObject endEvt = new JSObject();
                    endEvt.put("streamId", streamId);
                    endEvt.put("type", "end");
                    emitStreamEvent(endEvt);
                }
            } catch (Exception ex) {
                if (!handle.aborted.get()) {
                    JSObject errEvt = new JSObject();
                    errEvt.put("streamId", streamId);
                    errEvt.put("type", "error");
                    errEvt.put("message", ex.getMessage() != null ? ex.getMessage() : "Native HTTP stream failed");
                    emitStreamEvent(errEvt);
                }
            } finally {
                active.remove(streamId);
                if (conn != null) {
                    try {
                        conn.disconnect();
                    } catch (Exception ignored) {
                        // ignore disconnect error
                    }
                }
            }
        });
    }

    @PluginMethod
    public void cancelStream(PluginCall call) {
        String streamId = call.getString("streamId");
        if (streamId != null) {
            ActiveStream handle = active.remove(streamId);
            if (handle != null) {
                handle.aborted.set(true);
                HttpURLConnection conn = handle.conn;
                if (conn != null) {
                    pool.execute(() -> {
                        try {
                            conn.disconnect();
                        } catch (Exception ignored) {
                            // ignore
                        }
                    });
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        for (ActiveStream handle : active.values()) {
            handle.aborted.set(true);
            if (handle.conn != null) {
                try {
                    handle.conn.disconnect();
                } catch (Exception ignored) {
                    // ignore
                }
            }
        }
        active.clear();
        pool.shutdownNow();
        super.handleOnDestroy();
    }
}
