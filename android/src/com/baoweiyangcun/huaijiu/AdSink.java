package com.baoweiyangcun.huaijiu;

/** Ads → 网页的事件出口：MainActivity 实现，转成 android/app.js 里的 SVApp.onAd(event, earned) */
interface AdSink {
    /** event：ready（有广告可看了）/ closed（广告关了，earned = 看完了、该发奖励）/ failed（没放出来） */
    void send(String event, boolean earned);
}
