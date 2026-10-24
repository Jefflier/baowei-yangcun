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
})();
