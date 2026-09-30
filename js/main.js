/* ============================================================
 * 启动
 * ============================================================ */
(function () {
  'use strict';
  const SV = window.SV, G = SV.Game, UI = SV.UI;
  const tips = ['正在集结羊羊……', '给狼群一点颜色瞧瞧！', '造墙要留一条路哦', '黑散弹是对空之王', '冰镶嵌 30 级就够用', '别忘了每日签到'];
  function setProg(p, t) { const f = document.getElementById('ld-fill'); if (f) f.style.width = p + '%'; const tp = document.getElementById('ld-tip'); if (tp && t) tp.textContent = t; }
  function boot() {
    try {
      setProg(20, tips[0]);
      G.load();
      G.checkAch();
      setProg(50, tips[1]);
      UI.start();
      UI.Battle.frameHook = UI.hooks.battleFrame;
      setProg(80, tips[2]);
      G.on('achieved', a => UI.toast('🏆 成就达成：' + a.name, 'good'));
      G.on('levelup', L => UI.toast('🎊 村长升级！Lv.' + L, 'good'));
      G.on('wolfUnlocked', id => UI.toast('🐺 解锁新狼卡：' + SV.wolfDef(id).n, 'good'));
      UI.Menu.toTitle();
      setProg(100);
      setTimeout(() => document.getElementById('loading').classList.add('hide'), 250);
      setInterval(() => { if (!G.inBattle) G.persist(); }, 20000);
      addEventListener('beforeunload', () => { if (!G.inBattle) G.persist(true); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && !G.inBattle) G.persist(true); });
    } catch (e) {
      console.error(e);
      const tp = document.getElementById('ld-tip'); if (tp) tp.textContent = '启动失败：' + e.message;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // 调试入口
  window.SVDEBUG = { G, UI, SV };
})();
