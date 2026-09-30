/* ============================================================
 * UI 核心：DOM 助手 / 舞台缩放 / 屏幕切换 / 弹窗 / 提示 / 主循环
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D, G = SV.Game;
  const UI = SV.UI = { screen: null, hooks: {}, t: 0, modals: [] };
  SV.view = { scale: 1 };

  /* ---------- DOM 助手 ---------- */
  UI.h = function (tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) UI._append(el, arguments[i]);
    return el;
  };
  UI._append = function (el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(x => UI._append(el, x));
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  };
  const h = UI.h;
  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  UI.gemImg = (c, t, size) => h('img', { src: SV.Art.gemURL(c, t, 40), class: 'icoimg', style: size ? { width: size + 'px', height: size + 'px' } : null });
  UI.coinImg = () => h('img', { class: 'icoimg', src: SV.Art.iconURL('coin', 26, 26, (cx, w, hh) => SV.Art.coin(cx, w / 2, hh / 2, 11)) });
  UI.ptImg = () => h('img', { class: 'icoimg', src: SV.Art.iconURL('pt', 26, 26, (cx, w, hh) => { SV.Art.gem(cx, w / 2, hh / 2, 10, 3, 4, 0); }) });
  UI.candyImg = () => h('img', { class: 'icoimg', src: SV.Art.iconURL('candy', 26, 26, (cx, w, hh) => { cx.strokeStyle = '#7a4a1c'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(w / 2, hh / 2); cx.lineTo(w / 2 + 3, hh - 2); cx.stroke(); const g = cx.createRadialGradient(w / 2 - 3, hh / 2 - 8, 1, w / 2, hh / 2 - 4, 10); g.addColorStop(0, '#ffb3dc'); g.addColorStop(1, '#ff4fa0'); cx.beginPath(); cx.arc(w / 2, hh / 2 - 4, 9, 0, 7); cx.fillStyle = g; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#7a1a4a'; cx.stroke(); cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(w / 2, hh / 2 - 4, 4.5, 0.5, 4.5); cx.stroke(); }) });
  UI.wolfImg = (id, size) => h('img', { src: SV.Art.wolfIconURL(id, 56), style: { width: (size || 42) + 'px', height: (size || 42) + 'px' } });
  // 原型：没有原版界面素材时用程序化绘制兜底；js/art_ui_original.js 会把它换成原作图标
  UI.resIcon = (name, size, fallbackFn) => (fallbackFn ? fallbackFn() : h('span', { text: '•' }));
  UI.lootChip = function (l) {
    let icon = null;
    if (l.type === 'gem') icon = UI.gemImg(l.c, l.t, 26);
    else if (l.type === 'points') icon = UI.ptImg();
    else if (l.type === 'silver') icon = UI.coinImg();
    else if (l.type === 'bag') icon = UI.gemImg(5, 5, 26);
    else if (l.type === 'item' && l.id === 'lollipop') icon = UI.candyImg();
    else if (l.type === 'item' && l.id === 'bomb') icon = UI.bombImg ? UI.bombImg() : h('img', { class: 'icoimg', src: SV.Art.iconURL('bomb_ico', 26, 26, (cx, w, hh) => { SV.Art.drawBomb(cx, 44, w / 2, hh - 4, false, 0); }) });
    else if (l.type === 'wolfShard') icon = UI.wolfImg(l.id, 28);
    else icon = h('span', { text: l.id === 'straw' ? '🐑' : l.id === 'phono' ? '📻' : '⭐' });
    return h('div', { class: 'loot' }, icon, h('span', { text: G.lootText(l) }));
  };

  /* ---------- 舞台缩放 ---------- */
  UI.fit = function () {
    const st = document.getElementById('stage');
    const k = Math.min(innerWidth / 1280, innerHeight / 720);
    st.style.transform = 'scale(' + k + ') translate(-50%,-50%)';
    st.style.transformOrigin = '0 0';
    st.style.left = '50%'; st.style.top = '50%';
    // translate 使用未缩放坐标：改为手动定位
    st.style.transform = 'translate(' + (-640 * k) + 'px,' + (-360 * k) + 'px) scale(' + k + ')';
    UI.k = k;
    const rh = document.getElementById('rotate-hint');
    if (rh) rh.classList.toggle('show', innerHeight > innerWidth * 1.15 && innerWidth < 900 && !UI._rhDismissed);
    if (UI.renderer) {
      UI.renderer.resize();
      SV.view.scale = UI.renderer.scale;
      SV.Scene.invalidate();
    }
  };

  UI.toggleFullscreen = function () {
    try {
      if (!document.fullscreenElement) (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (e) { }
  };

  /* ---------- 屏幕切换 ---------- */
  UI.show = function (name) {
    document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
    const el = document.getElementById('scr-' + name);
    if (el) el.classList.add('on');
    UI.screen = name;
    if (UI.hooks['show:' + name]) UI.hooks['show:' + name]();
    UI.closeAllModals();
    if (name === 'battle') { /* music handled in battle */ }
    else SV.Audio.playBgm('calm');
  };

  /* ---------- 提示 ---------- */
  UI.toast = function (msg, kind) {
    const root = document.getElementById('toast-root');
    const el = h('div', { class: 'toast ' + (kind || ''), text: msg });
    root.appendChild(el);
    while (root.children.length > 4) root.removeChild(root.firstChild);
    setTimeout(() => el.remove(), 2500);
    if (kind === 'err') SV.Audio.play('error');
  };
  UI.banner = function (text, sub, cls) {
    const root = document.getElementById('banner-root');
    const el = h('div', { class: 'banner ' + (cls || '') }, text, sub ? h('small', { text: sub }) : null);
    root.appendChild(el); setTimeout(() => el.remove(), 2300);
  };

  /* ---------- 弹窗 ---------- */
  // opts: {title, body(Node), width, height, onClose, footer(Node), noClose}
  UI.modal = function (opts) {
    const root = document.getElementById('modal-root');
    const back = h('div', { class: 'modal-back' });
    const mh = h('div', { class: 'mh' }, h('h3', { text: opts.title || '' }));
    const mb = h('div', { class: 'mb scroll' });
    if (opts.body) UI._append(mb, opts.body);
    const m = h('div', { class: 'modal panel', style: { width: opts.width ? opts.width + 'px' : null, maxHeight: (opts.height || 660) + 'px' } }, mh, mb);
    if (opts.footer) UI._append(m, h('div', { style: { padding: '0 16px 14px' } }, opts.footer));
    back.appendChild(m); root.appendChild(back);
    const api = {
      el: m, back, body: mb, head: mh,
      close() { if (api.closed) return; api.closed = true; back.remove(); UI.modals = UI.modals.filter(x => x !== api); if (opts.onClose) opts.onClose(); },
      setBody(n) { UI.clear(mb); UI._append(mb, n); },
      setTitle(t) { mh.firstChild.textContent = t; }
    };
    if (!opts.noClose) { mh.appendChild(h('div', { class: 'x', text: '✕', onclick: () => { SV.Audio.play('click'); api.close(); } })); }
    if (!opts.noBackdropClose && !opts.noClose) back.addEventListener('mousedown', e => { if (e.target === back) api.close(); });
    UI.modals.push(api);
    return api;
  };
  UI.closeAllModals = function () { UI.modals.slice().forEach(m => m.close()); };
  UI.confirm = function (msg, onYes, opts) {
    opts = opts || {};
    const m = UI.modal({
      title: opts.title || '提示', width: 420, body: h('div', { style: { fontSize: '17px', lineHeight: 1.6, padding: '6px 4px 12px', whiteSpace: 'pre-line' } }, msg),
      footer: h('div', { class: 'row', style: { justifyContent: 'center', gap: '16px' } },
        h('button', { class: 'btn gray', text: opts.no || '取消', onclick: () => { SV.Audio.play('click'); m.close(); if (opts.onNo) opts.onNo(); } }),
        h('button', { class: 'btn ' + (opts.danger ? 'red' : 'green'), text: opts.yes || '确定', onclick: () => { SV.Audio.play('click'); m.close(); onYes(); } }))
    });
    return m;
  };
  UI.alert = function (title, node, btnText) {
    const m = UI.modal({ title, width: 480, body: node, footer: h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn green', text: btnText || '好的', onclick: () => { SV.Audio.play('click'); m.close(); } })) });
    return m;
  };

  /* ---------- 顶栏资源显示 ---------- */
  UI.resBar = function (opts) {
    opts = opts || {};
    const s = G.save;
    const av = h('canvas', { width: 92, height: 92 });
    const actx = av.getContext('2d');
    SV.Art.drawSheep(actx, 46, 84, 84, 0, { bell: true });
    const expPct = s.level >= G.MAX_LEVEL ? 100 : Math.floor(s.exp / G.expNeed(s.level) * 100);
    const bar = h('div', { class: 'topbar' },
      opts.back ? h('button', { class: 'btn sm', text: '⬅ 返回', onclick: () => { SV.Audio.play('click'); opts.back(); } }) : null,
      h('div', { class: 'avatar' }, av),
      h('div', { class: 'who' }, h('b', { text: s.name + '  Lv.' + s.level }), h('div', { class: 'bar exp' }, h('i', { style: { width: expPct + '%' } }), h('span', { text: s.level >= G.MAX_LEVEL ? 'MAX' : s.exp + '/' + G.expNeed(s.level) }))),
      h('div', { class: 'spacer' }),
      h('div', { class: 'res', title: '银币' }, UI.coinImg(), h('span', { 'data-res': 'silver', text: SV.fmtFull(s.silver) })),
      h('div', { class: 'res', title: '积分（商店货币）' }, UI.ptImg(), h('span', { 'data-res': 'points', text: s.points })),
      h('div', { class: 'res', title: '棒棒糖（噩梦入场券）' }, UI.candyImg(), h('span', { 'data-res': 'lollipop', text: s.lollipop })),
      h('div', { class: 'res', title: '宝石总数' }, UI.gemImg(3, 4, 24), h('span', { 'data-res': 'gems', text: G.gemTotal() })),
      (G.reliefNeeded() && G.reliefLeft() > 0) ? h('button', { class: 'btn sm red', title: '银币见底了，领取救济金', text: '🆘 救济金', onclick: () => { if (G.claimRelief()) { SV.Audio.play('coin'); UI.toast('领到救济金啦！加油，村长！', 'good'); UI.refreshRes(); } } }) : null,
      opts.extra || null);
    return bar;
  };
  UI.refreshRes = function (root) {
    const s = G.save; root = root || document;
    root.querySelectorAll('[data-res]').forEach(el => {
      const k = el.getAttribute('data-res');
      el.textContent = k === 'silver' ? SV.fmtFull(s.silver) : k === 'gems' ? G.gemTotal() : s[k];
    });
  };

  /* ---------- 主循环 ---------- */
  UI.start = function () {
    const cv = document.getElementById('cv');
    UI.renderer = new SV.Renderer(cv);
    const rx = document.getElementById('rh-x'), rf = document.getElementById('rh-fs');
    if (rx) rx.onclick = () => { UI._rhDismissed = true; UI.fit(); };
    if (rf) rf.onclick = () => { UI.toggleFullscreen(); try { screen.orientation.lock('landscape'); } catch (e) { } };
    UI.fit();
    addEventListener('resize', UI.fit);
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && UI.modals.length) { const m = UI.modals[UI.modals.length - 1]; if (m.head && m.head.querySelector('.x')) { SV.Audio.play('click'); m.close(); e.preventDefault(); } }
    });
    let last = performance.now(), acc = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; UI.t += dt;
      try {
        if (UI.screen === 'battle' && UI.hooks.battleFrame) UI.hooks.battleFrame(dt, now);
        else {
          SV.Scene.draw(UI.renderer.ctx, UI.screen === 'world' ? 'world' : UI.screen === 'hub' ? 'hub' : 'title', UI.t, { ch: UI.worldCh });
        }
        if (UI.hooks.frame) UI.hooks.frame(dt);
      } catch (e) { console.error(e); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // 首次交互启动音频
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && UI.screen === 'battle' && UI.Battle && UI.Battle.B && !UI.Battle.B.over && !UI.Arena.active) { UI.Battle.B.paused = true; UI.Battle.refreshTop(); }
      if (document.hidden) SV.Audio.stopBgm && 0;
    });
    const unlock = () => { SV.Audio.init(); SV.Audio.setVol(G.save.settings.sfx, G.save.settings.bgm); SV.Audio.resumeWanted(); if (UI.screen) SV.Audio.playBgm(UI.screen === 'battle' ? 'battle' : 'calm'); removeEventListener('pointerdown', unlock); };
    addEventListener('pointerdown', unlock);
  };
})(typeof window !== 'undefined' ? window : globalThis);
