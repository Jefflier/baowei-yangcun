/* ============================================================
 * 场景插画：标题 / 大厅（羊村） / 世界地图背景
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, Art = SV.Art, OUT = Art.OUT, rr = Art.rr, ell = Art.ell, shade = Art.shade;
  const Scene = SV.Scene = { cache: {}, W: 1280, H: 720 };

  function sky(ctx, top, bot, H) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, H); }
  function hill(ctx, y, amp, col, seed, w, freq) {
    ctx.beginPath(); ctx.moveTo(0, 720);
    for (let x = 0; x <= 1280; x += 16) ctx.lineTo(x, y + Math.sin(x * (freq || 0.004) + seed) * amp + Math.sin(x * (freq || 0.004) * 2.3 + seed * 2) * amp * 0.4);
    ctx.lineTo(1280, 720); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  function cloud(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    for (const [dx, dy, r] of [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.2, 0.75], [0.3, -0.35, 0.8], [-0.4, -0.25, 0.65]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,225,245,.55)'; ctx.beginPath(); ctx.ellipse(x, y + s * 0.55, s * 1.6, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }
  function tuft(ctx, x, y, s, col) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.3, y - s); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.2); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.3, y - s); ctx.stroke(); }
  function flower(ctx, x, y, s, c) { ctx.fillStyle = c; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.7, 0, 7); ctx.fill(); } ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, 7); ctx.fill(); }
  function fence(ctx, x0, y, x1, s) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.fillStyle = '#c99b5a';
    for (let x = x0; x <= x1; x += s) { rr(ctx, x - s * 0.1, y - s * 0.9, s * 0.2, s, 2); ctx.fill(); ctx.stroke(); }
    ctx.fillRect(x0, y - s * 0.65, x1 - x0, s * 0.14); ctx.strokeRect(x0, y - s * 0.65, x1 - x0, s * 0.14);
    ctx.fillRect(x0, y - s * 0.32, x1 - x0, s * 0.14); ctx.strokeRect(x0, y - s * 0.32, x1 - x0, s * 0.14);
  }

  /* ---------- 建筑 ---------- */
  function sign(ctx, x, y, w, h, text, col) {
    rr(ctx, x - w / 2, y - h / 2, w, h, 6); ctx.fillStyle = col || '#c68a4a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(h * 0.6) + 'px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,30,10,.8)'; ctx.strokeText(text, x, y + 1); ctx.fillText(text, x, y + 1);
  }
  const B = {
    mine(ctx, x, y) {   // 矿洞
      ell(ctx, x, y + 6, 120, 20, 'rgba(0,0,0,.2)');
      ctx.beginPath(); ctx.moveTo(x - 115, y); ctx.quadraticCurveTo(x - 100, y - 130, x, y - 140); ctx.quadraticCurveTo(x + 100, y - 130, x + 115, y); ctx.closePath();
      const g = ctx.createLinearGradient(x - 100, y - 140, x + 100, y); g.addColorStop(0, '#b9b2a5'); g.addColorStop(1, '#7a7468'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 50, y); ctx.lineTo(x - 50, y - 60); ctx.quadraticCurveTo(x, y - 95, x + 50, y - 60); ctx.lineTo(x + 50, y); ctx.closePath(); ctx.fillStyle = '#1a1410'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(x - 58, y - 64, 10, 64); ctx.fillRect(x + 48, y - 64, 10, 64); ctx.fillRect(x - 58, y - 72, 116, 10); ctx.strokeRect(x - 58, y - 72, 116, 10);
      // 宝石点缀
      Art.gem(ctx, x - 80, y - 40, 9, 0, 3, 0); Art.gem(ctx, x + 84, y - 60, 9, 4, 3, 0); Art.gem(ctx, x + 66, y - 20, 7, 1, 2, 0);
      // 矿车
      rr(ctx, x + 60, y - 22, 46, 24, 4); ctx.fillStyle = '#6a7480'; ctx.fill(); ctx.stroke(); ell(ctx, x + 72, y + 6, 6, 6, '#333', OUT, 2); ell(ctx, x + 96, y + 6, 6, 6, '#333', OUT, 2);
      Art.gem(ctx, x + 82, y - 28, 8, 3, 2, 0); Art.gem(ctx, x + 96, y - 26, 6, 2, 1, 0);
    },
    arena(ctx, x, y) {  // 竞技场
      ell(ctx, x, y + 6, 130, 20, 'rgba(0,0,0,.2)');
      rr(ctx, x - 120, y - 92, 240, 96, 12); const g = ctx.createLinearGradient(0, y - 92, 0, y); g.addColorStop(0, '#e9d8b0'); g.addColorStop(1, '#cdb88a'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      for (let i = 0; i < 6; i++) { const ax = x - 100 + i * 40; ctx.beginPath(); ctx.moveTo(ax - 14, y); ctx.lineTo(ax - 14, y - 40); ctx.arc(ax, y - 40, 14, Math.PI, 0); ctx.lineTo(ax + 14, y); ctx.closePath(); ctx.fillStyle = '#5a3a20'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
      rr(ctx, x - 130, y - 108, 260, 20, 8); ctx.fillStyle = '#c0392b'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 110 + i * 55, y - 108); ctx.lineTo(x - 110 + i * 55, y - 88); ctx.stroke(); }
      // 旗
      for (const dx of [-100, 100]) { ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + dx, y - 108); ctx.lineTo(x + dx, y - 150); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + dx, y - 150); ctx.lineTo(x + dx + 26, y - 140); ctx.lineTo(x + dx, y - 130); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke(); }
      // 交叉剑
      ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 24, y - 84); ctx.lineTo(x + 24, y - 44); ctx.moveTo(x + 24, y - 84); ctx.lineTo(x - 24, y - 44); ctx.stroke();
      ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 24, y - 84); ctx.lineTo(x + 24, y - 44); ctx.moveTo(x + 24, y - 84); ctx.lineTo(x - 24, y - 44); ctx.stroke();
    },
    shop(ctx, x, y) {   // 商店
      Art.house(ctx, x, y, 120, 1.3, 1.25, '#e2553a', '#fbeed0');
      // 遮阳篷
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - 78 + i * 26, y - 62); ctx.lineTo(x - 52 + i * 26, y - 62); ctx.lineTo(x - 52 + i * 26, y - 44); ctx.arc(x - 65 + i * 26, y - 44, 13, 0, Math.PI); ctx.closePath(); ctx.fillStyle = i % 2 ? '#fff' : '#ff6a4a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
      rr(ctx, x - 70, y - 30, 140, 12, 3); ctx.fillStyle = '#a56a2f'; ctx.fill(); ctx.stroke();
      Art.gem(ctx, x - 40, y - 36, 9, 0, 3, 0); Art.gem(ctx, x - 12, y - 36, 9, 4, 3, 0); Art.gem(ctx, x + 16, y - 36, 9, 1, 3, 0); Art.coin(ctx, x + 46, y - 36, 9);
    },
    workshop(ctx, x, y) { // 宝石工坊
      Art.house(ctx, x, y, 120, 1.15, 1.35, '#7a4fd6', '#ece2ff');
      Art.gem(ctx, x, y - 168, 26, 3, 5, 0);
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 142); ctx.lineTo(x, y - 156); ctx.stroke();
      Art.gem(ctx, x - 50, y - 14, 10, 1, 2, 0); Art.gem(ctx, x + 50, y - 14, 10, 0, 2, 0);
    },
    camp(ctx, x, y) {   // 训练营帐篷
      ell(ctx, x, y + 6, 100, 16, 'rgba(0,0,0,.2)');
      ctx.beginPath(); ctx.moveTo(x - 95, y); ctx.lineTo(x, y - 120); ctx.lineTo(x + 95, y); ctx.closePath(); ctx.fillStyle = '#d9483a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 32, y); ctx.lineTo(x, y - 74); ctx.lineTo(x + 32, y); ctx.closePath(); ctx.fillStyle = '#2a1a10'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 55, y - 48); ctx.lineTo(x, y - 120); ctx.lineTo(x + 55, y - 48); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 120); ctx.lineTo(x, y - 150); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y - 150); ctx.lineTo(x + 28, y - 142); ctx.lineTo(x, y - 134); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
      // 木靶
      ell(ctx, x + 120, y - 26, 20, 20, '#f5e6c0', OUT, 3); ell(ctx, x + 120, y - 26, 12, 12, '#e94a4a'); ell(ctx, x + 120, y - 26, 5, 5, '#fff');
      ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 120, y - 6); ctx.lineTo(x + 120, y + 6); ctx.stroke();
    },
    gate(ctx, x, y) {   // 出征大门
      ell(ctx, x, y + 8, 150, 22, 'rgba(0,0,0,.22)');
      for (const dx of [-105, 105]) { rr(ctx, x + dx - 24, y - 150, 48, 156, 8); const g = ctx.createLinearGradient(x + dx - 24, 0, x + dx + 24, 0); g.addColorStop(0, '#d9a866'); g.addColorStop(1, '#a4703a'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + dx - 30, y - 150); ctx.lineTo(x + dx, y - 186); ctx.lineTo(x + dx + 30, y - 150); ctx.closePath(); ctx.fillStyle = '#e2552e'; ctx.fill(); ctx.stroke(); }
      rr(ctx, x - 130, y - 168, 260, 36, 10); ctx.fillStyle = '#b57d3f'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
      sign(ctx, x, y - 150, 190, 30, '前往羊羊大陆', '#c0392b');
      // 草皮"门帘"
      ctx.beginPath(); ctx.moveTo(x - 82, y); ctx.lineTo(x - 82, y - 120); ctx.quadraticCurveTo(x, y - 170, x + 82, y - 120); ctx.lineTo(x + 82, y); ctx.closePath();
      const g2 = ctx.createRadialGradient(x, y - 70, 10, x, y - 70, 100); g2.addColorStop(0, '#fff6c8'); g2.addColorStop(1, '#8fd0ff'); ctx.fillStyle = g2; ctx.fill();
      Art.drawSheep(ctx, x - 10, y - 4, 60, 0, {});
    },
    board(ctx, x, y) {  // 布告栏
      ell(ctx, x, y + 4, 50, 8, 'rgba(0,0,0,.2)');
      ctx.fillStyle = '#7a4e2a'; ctx.fillRect(x - 30, y - 54, 8, 58); ctx.fillRect(x + 22, y - 54, 8, 58); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(x - 30, y - 54, 8, 58); ctx.strokeRect(x + 22, y - 54, 8, 58);
      rr(ctx, x - 46, y - 96, 92, 56, 8); ctx.fillStyle = '#c98a4a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      for (const [dx, dy, c] of [[-26, -84, '#fff'], [6, -88, '#fff8c8'], [-14, -62, '#dff0ff'], [16, -64, '#ffe2e2']]) { rr(ctx, x + dx, y + dy, 24, 20, 2); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); ell(ctx, x + dx + 12, y + dy + 2, 3, 3, '#e33', OUT, 1); }
    },
    inn(ctx, x, y) {    // 好友小屋
      Art.house(ctx, x, y, 90, 1.2, 1.1, '#3fa0ff', '#fff4d0');
      rr(ctx, x + 50, y - 34, 32, 22, 3); ctx.fillStyle = '#e94a4a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 50, y - 34); ctx.lineTo(x + 66, y - 22); ctx.lineTo(x + 82, y - 34); ctx.stroke();
      Art.drawSheep(ctx, x - 62, y + 4, 34, 0, { bell: true });
    },
    library(ctx, x, y) {  // 图鉴塔
      ell(ctx, x, y + 6, 70, 12, 'rgba(0,0,0,.2)');
      rr(ctx, x - 48, y - 170, 96, 174, 8); const g = ctx.createLinearGradient(x - 48, 0, x + 48, 0); g.addColorStop(0, '#c9b58a'); g.addColorStop(1, '#a08a5e'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 62, y - 168); ctx.lineTo(x, y - 232); ctx.lineTo(x + 62, y - 168); ctx.closePath(); ctx.fillStyle = '#3b6fb5'; ctx.fill(); ctx.stroke();
      for (const yy of [-135, -85]) { ctx.beginPath(); ctx.arc(x, y + yy, 14, Math.PI, 0); ctx.lineTo(x + 14, y + yy + 26); ctx.lineTo(x - 14, y + yy + 26); ctx.closePath(); ctx.fillStyle = '#7fd0ff'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke(); }
      rr(ctx, x - 16, y - 40, 32, 44, 4); ctx.fillStyle = '#6a4222'; ctx.fill(); ctx.stroke();
      ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📖', x, y - 190);
    }
  };
  Scene.B = B;

  function houseRow(ctx, y, list) { for (const [x, s, roof] of list) Art.house(ctx, x, y, s, 1, 1, roof, '#f8ecc9'); }

  /* ---------- 预渲染背景（静态）---------- */
  Scene.build = function (name, ch) {
    const key = name + (ch || '');
    if (Scene.cache[key]) return Scene.cache[key];
    const s = SV.view ? SV.view.scale : 1;
    const cv = Art.mkCanvas(1280 * s, 720 * s), ctx = cv.getContext('2d'); ctx.scale(s, s);
    if (name === 'title' || name === 'hub') {
      sky(ctx, '#5cc0ff', '#d5f2ff', 420);
      // 太阳
      const sg = ctx.createRadialGradient(1050, 140, 10, 1050, 140, 130); sg.addColorStop(0, 'rgba(255,250,200,1)'); sg.addColorStop(0.3, 'rgba(255,240,150,.7)'); sg.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = sg; ctx.fillRect(850, 0, 400, 340);
      ell(ctx, 1050, 140, 48, 48, '#fff6b8', '#ffd84a', 4);
      hill(ctx, 300, 40, '#9fd6f2', 1, 0, 0.003);
      hill(ctx, 340, 34, '#7fc86a', 2, 0, 0.005);
      hill(ctx, 385, 26, '#6cba50', 4, 0, 0.007);
      // 远处树
      for (let i = 0; i < 26; i++) { const x = (i * 53 + 20) % 1280, y = 350 + Math.sin(x * 0.005 + 4) * 26 + 34 + (i % 3) * 8; Art.drawDeco(ctx, 'tree', x, y, 42, SV.hash2(i, 1, 5), SV.hash2(i, 2, 5)); }
      // 前景草地
      const gg = ctx.createLinearGradient(0, 400, 0, 720); gg.addColorStop(0, '#8fd05a'); gg.addColorStop(1, '#5aa832'); ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(0, 720); for (let x = 0; x <= 1280; x += 16) ctx.lineTo(x, 400 + Math.sin(x * 0.006 + 1) * 10); ctx.lineTo(1280, 720); ctx.fill();
      // 小路
      ctx.beginPath(); ctx.moveTo(-20, 690); ctx.bezierCurveTo(300, 560, 500, 690, 700, 560); ctx.bezierCurveTo(880, 470, 1000, 560, 1300, 520); ctx.lineWidth = 62; ctx.strokeStyle = '#ecd88e'; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 50; ctx.strokeStyle = '#f4e4a6'; ctx.stroke();
      for (let i = 0; i < 90; i++) { const x = SV.hash2(i, 3, 9) * 1280, y = 410 + SV.hash2(i, 4, 9) * 300; if (i % 3 === 0) flower(ctx, x, y, 4, ['#ff7ab8', '#fff', '#ffb02a', '#b78bff'][i % 4]); else tuft(ctx, x, y, 8, '#3f8a26'); }
      if (name === 'title') {
        houseRow(ctx, 395, [[180, 56, '#f08a1c'], [250, 62, '#ee6a2a'], [320, 52, '#f2a02a'], [1010, 60, '#f08a1c'], [1090, 54, '#ee6a2a'], [1160, 62, '#f2a02a']]);
        fence(ctx, 120, 470, 420, 26); fence(ctx, 860, 470, 1200, 26);
        for (const [x, y, sz] of [[60, 440, 90], [1230, 470, 96], [520, 405, 60], [790, 400, 60]]) Art.drawDeco(ctx, 'tree', x, y, sz, 0.5, 0.05 * (x % 5));
      } else {
        // 大厅建筑
        B.mine(ctx, 160, 372); B.arena(ctx, 1140, 350);
        B.library(ctx, 1190, 590);
        B.shop(ctx, 430, 470);
        B.workshop(ctx, 660, 420);
        B.camp(ctx, 210, 585);
        B.board(ctx, 520, 640);
        B.inn(ctx, 790, 640);
        B.gate(ctx, 960, 550);
        for (const [x, y, sz] of [[60, 470, 80], [340, 400, 66], [560, 380, 58], [860, 395, 60], [1040, 420, 64], [40, 640, 92], [1250, 660, 90], [330, 660, 70]]) Art.drawDeco(ctx, 'tree', x, y, sz, 0.5, 0.1 * ((x % 7) + 1) / 7);
      }
    } else if (name === 'world') {
      const pal = { 1: ['#8ed15a', '#6cba3c', '#4ea52c', '#dcecb0'], 2: ['#e8f2f8', '#b7d6e8', '#7fb0d0', '#f7fbff'], 3: ['#9aa4ad', '#7a848e', '#5a646e', '#c9d0d6'], 4: ['#c7b48a', '#a8946a', '#7a6a48', '#e6dcbc'] }[ch] || ['#8ed15a', '#6cba3c', '#4ea52c', '#dcecb0'];
      const g = ctx.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
      for (let i = 0; i < 120; i++) { const x = SV.hash2(i, 1, ch) * 1280, y = 70 + SV.hash2(i, 2, ch) * 650, r = 20 + SV.hash2(i, 3, ch) * 60; ell(ctx, x, y, r, r * 0.45, 'rgba(255,255,255,.06)'); }
      const kind = ch === 1 ? 'tree' : ch === 2 ? 'pine' : ch === 3 ? 'machine' : 'rock';
      for (let i = 0; i < 150; i++) { const x = SV.hash2(i, 5, ch) * 1280, y = 80 + SV.hash2(i, 6, ch) * 660; Art.drawDeco(ctx, kind, x, y, 46, SV.hash2(i, 7, ch), SV.hash2(i, 8, ch)); }
    }
    return Scene.cache[key] = cv;
  };
  Scene.invalidate = function () { Scene.cache = {}; };

  /* ---------- 动态层 ---------- */
  const sheepPos = [[0.1, 560, 1], [0.4, 610, -1], [0.7, 520, 1], [0.25, 660, 1], [0.85, 650, -1]];
  Scene.draw = function (ctx, name, t, opts) {
    opts = opts || {};
    const s = SV.view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const bg = Scene.build(name, opts.ch);
    ctx.drawImage(bg, 0, 0, 1280, 720);
    if (name === 'title' || name === 'hub') {
      // 云
      for (let i = 0; i < 6; i++) { const x = ((t * (8 + i * 3) + i * 300) % 1600) - 160, y = 60 + (i * 47) % 200; cloud(ctx, x, y, 26 + (i % 3) * 10); }
      // 风车/炊烟
      if (name === 'hub') {
        for (const [x, y] of [[430, 360], [660, 300]]) for (let i = 0; i < 4; i++) { const k = (t * 0.4 + i * 0.25) % 1; ell(ctx, x + Math.sin(k * 6 + i) * 8, y - k * 60, 6 + k * 9, 6 + k * 9, 'rgba(255,255,255,' + (0.55 * (1 - k)) + ')'); }
        // 大门光
        const k = 0.5 + 0.5 * Math.sin(t * 2.4); ell(ctx, 960, 480, 90, 14, 'rgba(255,255,200,' + (0.1 + 0.15 * k) + ')');
        // 矿车闪光
        for (let i = 0; i < 3; i++) { const k2 = (t * 0.8 + i * 0.33) % 1; ctx.fillStyle = 'rgba(255,255,255,' + Math.sin(k2 * 3.14) + ')'; ctx.font = '16px sans-serif'; ctx.fillText('✦', 90 + i * 55, 330 - k2 * 24); }
      }
      // 羊群散步
      const n = name === 'title' ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const [ph, y, dir0] = sheepPos[i];
        const span = 1000, sp = 14 + i * 4;
        const pos = ((t * sp + ph * span) % (span * 2));
        const x = pos < span ? pos + 120 : span * 2 - pos + 120, d = pos < span ? 1 : -1;
        if (name === 'hub' && Math.abs(x - 960) < 140 && y < 600 && y > 480) continue;
        Art.drawSheep(ctx, x, y + (name === 'hub' ? 40 : 0), 46 + (i % 2) * 8, t + i, { dir: d, bell: i === 1 });
      }
      if (name === 'title') {
        // 远处灰太狼剪影探头
        const k = Math.max(0, Math.sin(t * 0.6));
        ctx.save(); ctx.translate(1180, 560); ctx.scale(1, 1);
        const def = SV.wolfDef('dahuil'); const w = { def, x: 0, y: 0, dir: -1, walk: t * 3, fly: false, uid: 1, hp: 1, maxhp: 1, slows: [], poisons: [], burnT: 0, stunT: 0, curse: null, shield: 0, silT: 0, invis: false, hitFlash: 0, boss: false, noBar: true };
        ctx.globalAlpha = 0.85; Art.drawWolf(ctx, w, -60 - 30 * k, 40, 96, t, false); ctx.restore();
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
