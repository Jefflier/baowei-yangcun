package com.baoweiyangcun.huaijiu;

import android.app.Activity;

/**
 * 侧载版（tools/build_apk.py 打的 APK）：没有广告，什么也不做。
 * Google Play 版的 AdMob 实现在 android/play/java/ 里，两边的构造函数和方法保持一致。
 */
final class Ads {
    static final boolean ENABLED = false;

    Ads(Activity activity, AdSink sink) {
    }

    void start() {
    }

    void destroy() {
    }
}
