package com.cardgamemaker.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * CardGameMaker Android 入口（原生 WebView，无 Gradle/第三方依赖）。
 *
 * 启动顺序：
 * 1) 在 127.0.0.1:8765 启动极简静态 HTTP 服务，从 APK assets/www 提供前端文件；
 * 2) 配置 WebView（JS、DOM Storage、媒体自动播放、允许本地明文 HTTP）；
 * 3) 加载 http://127.0.0.1:8765/index.html。
 *
 * 使用本地 HTTP 而不是 file:// 的原因：前端使用绝对路径 /assets/...、/audio/...，
 * fetch/decodeAudioData/localStorage/WebSocket 等能力在 file:// 下会受限。
 */
public class MainActivity extends Activity {

    /** 与 LocalHttpServer 保持一致；只监听环回地址，不对外暴露。 */
    private static final int LOCAL_PORT = 8765;

    private WebView webView;
    private LocalHttpServer server;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 游戏中常亮
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // 启动本地静态服务（失败也不崩溃：页面会显示无法连接，便于排查）
        try {
            server = new LocalHttpServer(getAssets(), LOCAL_PORT);
            server.start();
        } catch (Exception e) {
            server = null;
        }

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadsImagesAutomatically(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // 页面本身是 http://127.0.0.1，允许加载混合内容（如内联 dataURL 资源）
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        String version = "1.0.0";
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (info.versionName != null) version = info.versionName;
        } catch (Exception ignored) {
        }
        settings.setUserAgentString(settings.getUserAgentString() + " CGMAndroid/" + version);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return true;
                if (url.startsWith("http://127.0.0.1:" + LOCAL_PORT) || url.startsWith("about:")) {
                    return false; // 本地页面内跳转
                }
                // 外部链接交给系统浏览器（如帮助/开源许可）
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        setContentView(webView);
        webView.loadUrl("http://127.0.0.1:" + LOCAL_PORT + "/index.html");
    }

    /** 返回键：优先网页 history.back，无历史再退出 App。 */
    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{return history.length>1?'1':'0';}catch(e){return '0';}})()",
            value -> {
                if (value != null && value.contains("1")) {
                    webView.evaluateJavascript("history.back()", null);
                } else {
                    MainActivity.super.onBackPressed();
                }
            });
    }

    @Override
    protected void onDestroy() {
        if (server != null) {
            server.stop();
            server = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
