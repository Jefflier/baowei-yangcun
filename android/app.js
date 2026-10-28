/* ============================================================
 * 安卓 App 专用：tools/build_apk.py 打包时插到 index.html 末尾（网页版、exe 版不带）。
 * 外壳是 android/src/com/baoweiyangcun/huaijiu/MainActivity.java。
 * ============================================================ */
(function () {
  'use strict';
  const SV = window.SV, UI = SV.UI;
  document.documentElement.classList.add('sv-app');

  // App 本来就是全屏的：网页里的「全屏」按钮用不上，藏起来
  UI.toggleFullscreen = function () { };
  const css = document.createElement('style');
  css.textContent = '.sv-app button[title^="全屏"], .sv-app #rh-fs { display: none !important; }';
  document.head.appendChild(css);

  // 返回键（MainActivity.onBack 调用）：返回 'handled' 表示网页处理掉了，'exit' 表示到头了，App 退到后台
  window.SVApp = {
    back() {
      const ld = document.getElementById('loading');
      if (ld && !ld.classList.contains('hide')) return 'exit';
      const m = UI.modals[UI.modals.length - 1];
      if (m) {
        // 和 Esc 一样只关带 ✕ 的弹窗；结算、起名这类必须点按钮的弹窗不动
        if (m.head && m.head.querySelector('.x')) { SV.Audio.play('click'); m.close(); }
        return 'handled';
      }
      if (UI.screen === 'battle') {
        const A = UI.Arena, BU = UI.Battle;
        if (A && A.active) {
          if (A.B && !A.B.over) UI.confirm('放弃这场挑战？', () => A.quit(), { yes: '放弃', danger: true, title: '竞技场' });
        } else if (BU.moving || BU.place || BU.sel) BU.cancel();      // 先取消建造 / 选中 / 搬迁（相当于右键）
        else if (BU.B && !BU.B.over) BU.retreat();                    // 再按一次：撤退确认
        return 'handled';
      }
      if (UI.screen === 'world') { SV.Audio.play('click'); UI.Menu.toHub(); return 'handled'; }
      if (UI.screen === 'hub') { SV.Audio.play('click'); UI.Menu.toTitle(); return 'handled'; }
      return 'exit';
    }
  };

  // 切到后台（WebView.onPause 会把页面置为隐藏）就挂起音频：安卓 17 起不许在后台出声，也省电
  document.addEventListener('visibilitychange', () => {
    const c = SV.Audio.ctx; if (!c) return;
    if (document.hidden) c.suspend(); else c.resume();
  });

  /* ---------- 激励视频广告：只有 Google Play 版有（android/play/ 的 Ads.java 把 SVAds 挂到页面上；侧载版没有，下面整段不生效） ----------
   * 玩家自己点大厅的 📺，选一样奖励再看广告；看完才发，每天限 LIMIT 次。战斗里不放广告。 */
  const Ads = window.SVAds;
  if (!Ads) return;
  const G = SV.Game, h = UI.h, LIMIT = 5;
  const REWARDS = [
    { icon: '🪙', name: '银币', desc: L => SV.fmt(4000 + L * 150) + ' 银币', loot: L => [{ type: 'silver', n: 4000 + L * 150 }] },
    { icon: '💣', name: '炸弹', desc: () => '炸弹 ×3', loot: () => [{ type: 'item', id: 'bomb', n: 3 }] },
    { icon: '🍭', name: '棒棒糖', desc: () => '棒棒糖 ×2（噩梦模式入场券）', loot: () => [{ type: 'item', id: 'lollipop', n: 2 }] }
  ];
  const rec = () => { const r = G.save.adReward || (G.save.adReward = { day: '', n: 0 }); if (r.day !== G.today()) { r.day = G.today(); r.n = 0; } return r; };
  const left = () => Math.max(0, LIMIT - rec().n);
  let pending = null, panel = null, hubBtn = null;

  const hubBtnContent = () => ['📺', left() ? h('span', { class: 'dot', text: left() }) : null];
  UI.hooks.hubButtons = () => (hubBtn = h('button', { class: 'btn sm purple', title: '看广告领奖励', onclick: () => { SV.Audio.play('click'); open(); } }, hubBtnContent()));
  const updateHub = () => { if (hubBtn) { UI.clear(hubBtn); UI._append(hubBtn, hubBtnContent()); } };

  // 欧盟 / 英国等地区要求能随时改广告同意设置（GDPR）：需要时设置里多一个入口
  UI.hooks.settingsRows = () => Ads.privacyOptionsRequired()
    ? h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'bold', style: { width: '80px' }, text: '广告隐私' }),
      h('button', { class: 'btn sm blue', text: '🔒 广告隐私选项', onclick: () => { SV.Audio.play('click'); Ads.showPrivacyOptions(); } }))
    : null;

  function open() {
    panel = UI.modal({ title: '📺 看广告领奖励', onClose: () => { panel = null; } });
    render();
  }
  function render() {
    if (!panel) return;
    const n = left(), ready = Ads.isReady();
    panel.setBody(h('div', { style: { width: '460px' } },
      h('div', { class: 'small muted', style: { marginBottom: '8px' }, text: '看完一段广告，选一样奖励。今天还能领 ' + n + ' / ' + LIMIT + ' 次，第二天刷新。' }),
      REWARDS.map(r => h('div', { class: 'card row', style: { padding: '8px 10px', marginBottom: '8px' } },
        h('span', { style: { fontSize: '28px' }, text: r.icon }),
        h('div', { class: 'grow' }, h('b', { text: r.name }), h('div', { class: 'small muted', text: r.desc(G.save.level) })),
        h('button', { class: 'btn sm ' + (n && ready ? 'green' : 'gray'), disabled: !(n && ready), text: !n ? '今天领完了' : ready ? '▶ 看广告领取' : '广告加载中…', onclick: () => watch(r) }))),
      h('div', { class: 'small muted', text: '广告由 Google AdMob 提供；中途关掉不发奖励，也不算次数。' })));
  }
  function watch(r) {
    if (pending || !left()) return;
    if (!Ads.isReady()) { UI.toast('广告还没加载好，过一会儿再试', 'err'); render(); return; }
    SV.Audio.play('click');
    pending = r;
    if (!Ads.show()) { pending = null; UI.toast('广告没能打开，过一会儿再试', 'err'); render(); }
  }

  // MainActivity 转发的广告事件：ready = 有广告可看了；closed = 广告关掉了（earned：看完了）；failed = 没放出来
  window.SVApp.onAd = function (ev, earned) {
    if (ev === 'closed' || ev === 'failed') {
      const r = pending; pending = null;
      if (r && earned) {
        rec().n++;
        const loot = r.loot(G.save.level);
        loot.forEach(l => G.giveLoot(l));
        G.persist(true);
        UI.refreshRes();
        SV.Audio.play('coin');
        UI.toast('📺 领到 ' + loot.map(l => G.lootText(l)).join('、'), 'good');
      } else if (r) UI.toast(ev === 'failed' ? '广告没能播放，过一会儿再试' : '没看完广告，这次不发奖励', 'err');
    }
    render(); updateHub();
  };
})();
