package uz.shifokortop.app;

import android.app.Activity;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Shifokor top: shows the live site (GitHub Pages) inside the app.
 * Site updates appear in the app by themselves; the site's service worker keeps the list for offline use.
 * Phone numbers open the dialer, map links open Yandex/Google Maps or the browser.
 */
public class MainActivity extends Activity {
    private static final String HOST = "temurbekmadaminov362-beep.github.io";
    private static final String PATH = "/shifokortop";
    private static final String HOME = "https://" + HOST + PATH + "/";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // language, theme, device id; also needed by the service worker
        s.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        s.setSupportMultipleWindows(false);    // target=_blank links come back to shouldOverrideUrlLoading
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " ShifokorTopApp/1");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openOutside(request.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
        });

        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl(HOME);
    }

    /** true = handled here (opened in another app), false = keep inside the app */
    private boolean openOutside(Uri u) {
        if (u == null) return true;
        String scheme = u.getScheme();
        String path = u.getPath() == null ? "" : u.getPath();
        if ("https".equals(scheme) && HOST.equals(u.getHost()) && path.startsWith(PATH)) return false;
        try {
            Intent i = "tel".equals(scheme) ? new Intent(Intent.ACTION_DIAL, u) : new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception ignored) {
            // no app can open it: stay on the page
        }
        return true;
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            NetworkInfo ni = cm == null ? null : cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        } catch (Exception e) {
            return true;
        }
    }

    private void showOffline() {
        String html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:sans-serif;"
            + "background:#f3f5f2;color:#13221e;text-align:center;padding:24px;box-sizing:border-box}"
            + "@media(prefers-color-scheme:dark){body{background:#0f1614;color:#e5ede9}}"
            + "button{margin-top:18px;min-height:48px;padding:10px 22px;border:0;border-radius:10px;background:#1a5a9c;color:#fff;font-size:16px;font-weight:600}"
            + "p{max-width:32ch;line-height:1.5}</style></head><body><div>"
            + "<h2>Shifokor top</h2>"
            + "<p>Internet yo'q. Ulanib, qayta urinib ko'ring.</p>"
            + "<p>Нет интернета. Подключитесь и попробуйте снова.</p>"
            + "<button onclick=\"location.href='" + HOME + "'\">Qayta urinish / Повторить</button>"
            + "</div></body></html>";
        web.loadDataWithBaseURL(HOME, html, "text/html", "UTF-8", HOME);
    }

    @Override
    public void onBackPressed() {
        // first let the page close an open doctor card, then go back, then leave the app
        web.evaluateJavascript("(window.__stBack && window.__stBack()) ? 1 : 0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if ("1".equals(handled)) return;
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
