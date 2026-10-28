package com.baoweiyangcun.huaijiu;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 安卓外壳：一个全屏 WebView。游戏文件由 tools/build_apk.py 打进 APK 的 assets/www/，
 * 挂在 https://appassets.androidplatform.net/ 下（安卓给本地资源保留的域名，和 androidx WebViewAssetLoader 同一个），
 * 是正常的 https 页面，localStorage 存档、Web Audio 都和浏览器里一样。
 *
 * 针对安卓 15 / 16 / 17（目标 API 37）的处理：
 *  - 强制边到边：沉浸模式隐藏系统栏，挖孔 / 刘海、没能隐藏的系统栏（如桌面窗口的标题栏）和输入法按 insets 让出位置；
 *  - 预测性返回：返回键走 OnBackInvokedCallback（目标 36+ 不再调用 onBackPressed），交给网页逐级处理；
 *  - 大屏强制可调整大小（16 起忽略横屏锁定，17 起不能再退出）：配置变化不重建 Activity，网页随窗口缩放；
 *  - 后台音频收紧（17）：切后台暂停 WebView，网页同时挂起 AudioContext（android/app.js），不在后台出声。
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final int BG = 0xFF0F1A0C;     // 和 css/style.css 里 body 的底色一致：挖孔让出的那条边
    private static final int SKY = 0xFF7FD0FF;    // 网页加载画面的天蓝色，WebView 第一帧之前先垫着，免得白屏一闪
    private static final Map<String, String> MIME = new HashMap<String, String>();

    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("txt", "text/plain");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("webp", "image/webp");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("gif", "image/gif");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("ogg", "audio/ogg");
        MIME.put("wav", "audio/wav");
        MIME.put("woff2", "font/woff2");
    }

    private FrameLayout root;
    private WebView web;
    private Object backCallback;                  // OnBackInvokedCallback（API 33+）；用 Object 存，老系统上不用加载这个类
    private boolean resumed;
    private Ads ads;                              // Google Play 版是 AdMob 激励视频，侧载版是空实现

    @Override
    @SuppressWarnings("deprecation")   // setDecorFitsSystemWindows：安卓 15 起强制边到边、调用无效，11–14 上仍需要
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window win = getWindow();
        win.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // 一波狼要打好几分钟，别息屏
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = win.getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            win.setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 30) win.setDecorFitsSystemWindows(false);

        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                return applyInsets(v, insets);
            }
        });
        setContentView(root);
        ads = new Ads(this, new AdSink() {
            @Override
            public void send(String event, boolean earned) {
                sendAdEvent(event, earned);
            }
        });
        createWebView();
        hideSystemBars();
        ads.start();

        if (Build.VERSION.SDK_INT >= 33) {
            OnBackInvokedCallback cb = new OnBackInvokedCallback() {
                @Override
                public void onBackInvoked() {
                    onBack();
                }
            };
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, cb);
            backCallback = cb;
        }
    }

    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(SKY);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                  // 存档在 localStorage
        s.setMediaPlaybackRequiresUserGesture(false);  // 音效、音乐不用等第一次点击
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                            // 不跟系统字体大小走：界面是固定 1280×720 的排版，整体缩放
        s.setSafeBrowsingEnabled(false);               // 只加载 APK 里自带的文件
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient());
        if (Ads.ENABLED) web.addJavascriptInterface(ads, "SVAds");   // 页面只加载 APK 自带的文件，外链都交给浏览器
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.loadUrl(HOME);
    }

    /** 沉浸模式：隐藏状态栏和导航栏，从边缘滑动时临时浮出来 */
    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c == null) return;
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            c.hide(WindowInsets.Type.systemBars());
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    /**
     * 边到边：给挖孔 / 刘海、仍然显示着的系统栏、弹出的输入法让出位置（隐藏掉的系统栏 insets 为 0，临时浮出时也不占位）。
     * 让出来的部分是深色底；网页随之变小，舞台自己等比缩放，输入框始终在键盘上方。
     */
    @SuppressWarnings("deprecation")
    private WindowInsets applyInsets(View v, WindowInsets in) {
        if (Build.VERSION.SDK_INT >= 30) {
            Insets s = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
            v.setPadding(s.left, s.top, s.right, s.bottom);
            return WindowInsets.CONSUMED;
        }
        int l = in.getSystemWindowInsetLeft(), t = in.getSystemWindowInsetTop();
        int r = in.getSystemWindowInsetRight(), b = in.getSystemWindowInsetBottom();
        if (Build.VERSION.SDK_INT >= 28) {
            DisplayCutout c = in.getDisplayCutout();
            if (c != null) {
                l = Math.max(l, c.getSafeInsetLeft());
                t = Math.max(t, c.getSafeInsetTop());
                r = Math.max(r, c.getSafeInsetRight());
                b = Math.max(b, c.getSafeInsetBottom());
            }
        }
        v.setPadding(l, t, r, b);
        return in.consumeSystemWindowInsets();
    }

    /** 广告事件转给网页（android/app.js 的 SVApp.onAd 发奖励、刷新按钮）；event 只会是 Ads 里写死的几个词 */
    private void sendAdEvent(final String event, final boolean earned) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) {
                    web.evaluateJavascript("window.SVApp && SVApp.onAd && SVApp.onAd('" + event + "', " + earned + ")", null);
                }
            }
        });
    }

    /** 返回键：先让网页处理（关弹窗、取消建造、撤退确认、退回上一层，见 android/app.js），网页说到头了就退到后台 */
    private void onBack() {
        if (web == null) {
            moveTaskToBack(true);
            return;
        }
        web.evaluateJavascript("window.SVApp ? SVApp.back() : 'exit'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String result) {
                if (!"\"handled\"".equals(result)) moveTaskToBack(true);
            }
        });
    }

    /** 安卓 12L 及以前的返回键（13+ 由 OnBackInvokedCallback 接管，不会走到这里） */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        onBack();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        if (web != null) web.onResume();
        hideSystemBars();
    }

    /** 切到后台：WebView 暂停，页面变成隐藏状态 → 游戏存档、战斗暂停、音频挂起 */
    @Override
    protected void onPause() {
        resumed = false;
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback((OnBackInvokedCallback) backCallback);
        }
        if (ads != null) ads.destroy();
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** 本地资源：https://appassets.androidplatform.net/路径 → APK 里的 assets/www/路径；其它网址一律不放行 */
    private WebResourceResponse serve(Uri u) {
        if (!"https".equals(u.getScheme()) || !HOST.equals(u.getHost())) return status(403, "Forbidden");
        String path = u.getPath();
        if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
        if (path.contains("..")) return status(403, "Forbidden");
        int dot = path.lastIndexOf('.');
        String mime = MIME.get(dot < 0 ? "" : path.substring(dot + 1).toLowerCase());
        if (mime == null) mime = "application/octet-stream";
        try {
            InputStream in = getAssets().open("www" + path);
            WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") || mime.endsWith("json") ? "utf-8" : null, in);
            Map<String, String> h = new HashMap<String, String>();
            h.put("Cache-Control", "no-cache");
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return status(404, "Not Found");
        }
    }

    private static WebResourceResponse status(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, new HashMap<String, String>(),
                new ByteArrayInputStream(new byte[0]));
    }

    private final class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return serve(request.getUrl());
        }

        /** 页面里的外链（资料来源的论坛等）用系统浏览器打开，游戏窗口不跳走 */
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            if ("https".equals(u.getScheme()) || "http".equals(u.getScheme())) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException e) {
                    // 没装浏览器：什么也不做
                }
            }
            return true;
        }

        /** 渲染进程崩溃或在后台被系统回收：换一个新的 WebView 重新载入（存档在 localStorage 里，不受影响） */
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            if (view == web) {
                root.removeView(web);
                web.destroy();
                web = null;
                createWebView();
                if (!resumed) web.onPause();
            } else {
                view.destroy();
            }
            return true;
        }
    }
}
