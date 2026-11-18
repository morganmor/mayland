package app.mayland.chat;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MaylandStoragePlugin.class);
        registerPlugin(MaylandStreamPlugin.class);
        registerPlugin(MaylandSecureVaultPlugin.class);
        super.onCreate(savedInstanceState);

        int bgColor = Color.parseColor("#13161C");
        getWindow().getDecorView().setBackgroundColor(bgColor);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.setBackgroundColor(bgColor);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }
}
