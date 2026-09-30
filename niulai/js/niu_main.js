/* 牛来攻城 —— 启动 */
(function () {
  'use strict';
  const NL = window.NL;
  const tips = ['牛群正在集结……', '墙越结实，牛越愿意绕路', '撞城牛专挑最薄的墙', '奶牛会给同伴回血，先打它！', '散弹塔对飞天牛伤害翻倍', '牛郎像的牧歌能安抚牛群'];
  function prog(p, t) { const f = document.getElementById('ld-fill'); if (f) f.style.width = p + '%'; const tp = document.getElementById('ld-tip'); if (tp && t) tp.textContent = t; }
  function boot() {
    try {
      prog(40, tips[(Math.random() * tips.length) | 0]);
      NL.UI.boot();
      prog(100);
      setTimeout(() => document.getElementById('loading').classList.add('hide'), 300);
    } catch (e) {
      console.error(e);
      const tp = document.getElementById('ld-tip'); if (tp) tp.textContent = '启动失败：' + e.message;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.NLDEBUG = NL;
})();
