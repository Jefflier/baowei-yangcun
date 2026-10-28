package com.baoweiyangcun.huaijiu;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Google Play 版的激励视频广告（AdMob），只在 Gradle 的 play 版本里编译；侧载版用 android/sideload/ 里的空实现。
 * 网页通过 SVAds（下面带 @JavascriptInterface 的方法，跑在 WebView 的 JS 桥线程上）问有没有广告、要求播放，
 * 结果经 AdSink 回到 android/app.js 的 SVApp.onAd，由网页发奖励。
 * 流程：UMP 征求同意（欧盟 / 英国等地区要求，其它地区直接通过）→ 初始化 SDK → 预加载一条 → 播完再加载下一条。
 * 广告位 ID 来自 BuildConfig（android/build.gradle.kts：调试版固定用谷歌的测试 ID，正式版用 gradle.properties 里的）。
 */
final class Ads {
    static final boolean ENABLED = true;

    private final Activity activity;
    private final AdSink sink;
    private final ConsentInformation consent;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean initialized = new AtomicBoolean();
    private volatile RewardedAd ad;   // 加载好、还没播的那条；JS 桥线程也会读
    private boolean loading;          // 以下几个只在主线程读写
    private int failures;
    private boolean destroyed;

    Ads(Activity activity, AdSink sink) {
        this.activity = activity;
        this.sink = sink;
        consent = UserMessagingPlatform.getConsentInformation(activity);
    }

    /** onCreate 里调：更新同意状态，需要时弹同意表单；以前已经同意过的不用等这一步，直接初始化 */
    void start() {
        consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(),
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> initIfAllowed()),
                requestError -> initIfAllowed());   // 没网之类：沿用上次的同意结果
        initIfAllowed();
    }

    private void initIfAllowed() {
        if (destroyed || !consent.canRequestAds() || initialized.getAndSet(true)) return;
        // 玩家里有不少小朋友：最多放 PG 级（建议家长指导）的广告
        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG).build());
        // 官方建议在后台线程初始化，免得拖慢启动
        new Thread(() -> MobileAds.initialize(activity.getApplicationContext(), status -> main.post(this::load))).start();
    }

    private void load() {
        if (destroyed || ad != null || loading) return;
        loading = true;
        RewardedAd.load(activity, BuildConfig.ADMOB_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(RewardedAd loaded) {
                loading = false;
                failures = 0;
                ad = loaded;
                sink.send("ready", false);
            }

            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                loading = false;
                // 没填充 / 没网：10 秒、20 秒、40 秒……最多隔 10 分钟再试
                main.postDelayed(Ads.this::load, Math.min(600_000L, 10_000L << Math.min(failures++, 6)));
            }
        });
    }

    @JavascriptInterface
    public boolean isReady() {
        return ad != null;
    }

    /** 播放加载好的那条，没有就返回 false。看没看完在关掉时一起报（closed + earned） */
    @JavascriptInterface
    public boolean show() {
        final RewardedAd showing = ad;
        if (showing == null) return false;
        ad = null;
        main.post(() -> {
            final boolean[] earned = {false};
            showing.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    sink.send("closed", earned[0]);
                    load();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    sink.send("failed", false);
                    load();
                }
            });
            showing.show(activity, reward -> earned[0] = true);
        });
        return true;
    }

    /** 欧盟 / 英国等地区要求能随时改同意设置：这时游戏设置里显示「广告隐私选项」 */
    @JavascriptInterface
    public boolean privacyOptionsRequired() {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    @JavascriptInterface
    public void showPrivacyOptions() {
        main.post(() -> UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> initIfAllowed()));
    }

    void destroy() {
        destroyed = true;
        main.removeCallbacksAndMessages(null);
    }
}
