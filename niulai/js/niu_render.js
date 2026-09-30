/* ============================================================
 * 牛来攻城 —— 战斗渲染（1280×720 逻辑坐标，按窗口缩放 × devicePixelRatio 出图）
 *   地块 20×12，格子 56×44（与原作一样是扁的长方形格，塔按 格宽/65 的比例画）
 * ============================================================ */
(function (root) {
  'use strict';
  const NL = root.NL, D = NL.D, Art = NL.Art;
  const TAU = Math.PI * 2;
  const OX = 12, OY = 54, CW = 56, CH = 44, W = 1280, H = 720;
  const CITY_X = OX + D.COLS * CW;           // 1132
  NL.VIEW = { OX, OY, CW, CH, W, H, CITY_X };
  const ell = Art.ell, rr = Art.rr;
  const sx = x => OX + x * CW, sy = y => OY + y * CH;
  function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s || 0) * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

  function Render(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.pr = 1; this.bg = null; this.bgKey = '';
  }
  NL.Render = Render;
  const R = Render.prototype;
  R.resize = function (k) {
    const dpr = Math.min(2.5, root.devicePixelRatio || 1);
    const pr = Math.max(1, k * dpr);
    if (Math.abs(pr - this.pr) < 0.01 && this.cv.width) return;
    this.pr = pr; Art.pr = pr;
    this.cv.width = Math.round(W * pr); this.cv.height = Math.round(H * pr);
    Art.clearCache(); this.bg = null; this.bgKey = '';
  };

  /* ============================================================
   * 静态底图：地面 / 河 / 桥 / 入口 / 城池（不含会动的东西），按关卡缓存
   * ============================================================ */
  R.background = function (g) {
    const key = g.L.id + '|' + this.pr;
    if (this.bg && this.bgKey === key) return this.bg;
    const cv = document.createElement('canvas'); cv.width = this.cv.width; cv.height = this.cv.height;
    const c = cv.getContext('2d'); c.scale(this.pr, this.pr); c.lineJoin = 'round'; c.lineCap = 'round';
    const th = D.THEMES[g.L.theme] || D.THEMES.grass;
    drawGround(c, g, th);
    drawCityStatic(c, g, th);
    this.bg = cv; this.bgKey = key;
    return cv;
  };
  function drawGround(c, g, th) {
    // 场外：深色的树篱/岩壁
    c.fillStyle = th.lava ? '#2e2420' : th === D.THEMES.snow ? '#9fb3c4' : '#3f6a2a';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const x = hash(i, 1, 7) * W, y = hash(i, 2, 7) < 0.5 ? hash(i, 3, 7) * OY : OY + g.rows * CH + hash(i, 3, 7) * (H - OY - g.rows * CH);
      ell(c, x, y, 18 + hash(i, 4, 7) * 22, 12 + hash(i, 5, 7) * 10);
      c.fillStyle = th.lava ? 'rgba(80,50,40,0.6)' : th === D.THEMES.snow ? 'rgba(230,240,248,0.7)' : 'rgba(90,140,60,0.55)'; c.fill();
    }
    // 地块
    const x0 = OX, y0 = OY, gw = g.cols * CW, gh = g.rows * CH;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 14;
    c.fillStyle = th.g2; c.fillRect(x0, y0, gw, gh);
    c.restore();
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const i = y * g.cols + x, ch = g.chr[i];
      const X = sx(x), Y = sy(y);
      c.fillStyle = (x + y) % 2 ? th.g1 : th.g2;
      c.fillRect(X, Y, CW, CH);
      if (ch === 'S') { c.fillStyle = th.dirt; c.globalAlpha = 0.85; c.fillRect(X, Y, CW, CH); c.globalAlpha = 1; }
      if (ch === 'G') { c.fillStyle = '#c9b48a'; c.fillRect(X, Y, CW, CH); c.strokeStyle = 'rgba(90,70,40,0.35)'; c.lineWidth = 1; for (let k = 0; k < 3; k++) { c.strokeRect(X + 2 + (k % 2) * 10, Y + 2 + k * 14, 26, 12); c.strokeRect(X + 28 + (k % 2) * 10 - 10, Y + 2 + k * 14, 26, 12); } }
    }
    // 地面细节
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const i = y * g.cols + x, ch = g.chr[i];
      if (ch !== '.' && ch !== 'T' && ch !== 'R' && ch !== 'M') continue;
      const n = 2 + Math.floor(hash(x, y, 3) * 3);
      for (let k = 0; k < n; k++) {
        const X = sx(x) + 6 + hash(x, y, 10 + k) * (CW - 12), Y = sy(y) + 6 + hash(x, y, 20 + k) * (CH - 12), r = hash(x, y, 30 + k);
        if (th.lava) { c.strokeStyle = r < 0.2 ? 'rgba(255,120,40,0.5)' : 'rgba(40,28,22,0.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + 6, Y + 3); c.lineTo(X + 9, Y - 2); c.stroke(); }
        else if (g.L.theme === 'snow') { c.fillStyle = r < 0.5 ? 'rgba(170,195,215,0.6)' : 'rgba(255,255,255,0.9)'; ell(c, X, Y, 3 + r * 4, 1.5 + r * 2); c.fill(); }
        else if (g.L.theme === 'canyon') { c.strokeStyle = 'rgba(150,110,60,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y + 6, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        else if (r < 0.14) { // 小花
          c.fillStyle = ['#fff', '#ffd23f', '#ff8ab0', '#b8a0ff'][Math.floor(r * 28) % 4];
          for (let a = 0; a < 5; a++) { ell(c, X + Math.cos(a * 1.26) * 2.4, Y + Math.sin(a * 1.26) * 2.4, 1.8, 1.8); c.fill(); }
          c.fillStyle = '#ffb000'; ell(c, X, Y, 1.3, 1.3); c.fill();
        } else { // 草丛
          c.strokeStyle = 'rgba(60,110,40,0.55)'; c.lineWidth = 1.3;
          c.beginPath(); c.moveTo(X - 3, Y + 3); c.lineTo(X - 4, Y - 3); c.moveTo(X, Y + 3); c.lineTo(X, Y - 5); c.moveTo(X + 3, Y + 3); c.lineTo(X + 4, Y - 3); c.stroke();
        }
      }
    }
    // 河 / 熔岩
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const i = y * g.cols + x; if (g.chr[i] !== '~') continue;
      const X = sx(x), Y = sy(y);
      c.fillStyle = th.water; c.fillRect(X, Y, CW, CH);
      const land = (dx, dy) => { const xx = x + dx, yy = y + dy; if (!g.inb(xx, yy)) return false; const ch = g.chr[yy * g.cols + xx]; return ch !== '~' && ch !== '='; };
      c.fillStyle = th.bank;
      if (land(0, -1)) c.fillRect(X, Y, CW, 5);
      if (land(0, 1)) { c.fillStyle = th.lava ? '#1e1512' : 'rgba(40,70,30,0.6)'; c.fillRect(X, Y + CH - 4, CW, 4); c.fillStyle = th.bank; }
      if (land(-1, 0)) c.fillRect(X, Y, 4, CH);
      if (land(1, 0)) c.fillRect(X + CW - 4, Y, 4, CH);
    }
    // 桥 / 大路
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const i = y * g.cols + x; if (g.chr[i] !== '=') continue;
      const X = sx(x), Y = sy(y);
      const wat = (dx, dy) => { const xx = x + dx, yy = y + dy; return g.inb(xx, yy) && g.chr[yy * g.cols + xx] === '~'; };
      const bridgeH = wat(0, -1) || wat(0, 1), bridgeV = wat(-1, 0) || wat(1, 0);
      if (bridgeH || bridgeV) {
        c.fillStyle = th.water; c.fillRect(X, Y, CW, CH);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(X, Y + 4, CW, CH - 2);
        for (let k = 0; k < 7; k++) {
          if (bridgeH) { c.fillStyle = k % 2 ? '#b98a54' : '#a87a46'; c.fillRect(X + k * CW / 7, Y + 3, CW / 7 - 1, CH - 6); }
          else { c.fillStyle = k % 2 ? '#b98a54' : '#a87a46'; c.fillRect(X + 3, Y + k * CH / 7, CW - 6, CH / 7 - 1); }
        }
        c.fillStyle = '#6a4a2a';
        if (bridgeH) { c.fillRect(X, Y + 1, CW, 4); c.fillRect(X, Y + CH - 5, CW, 4); }
        else { c.fillRect(X + 1, Y, 4, CH); c.fillRect(X + CW - 5, Y, 4, CH); }
      } else {
        c.fillStyle = th.dirt; c.fillRect(X, Y, CW, CH);
        c.fillStyle = 'rgba(120,90,50,0.3)'; for (let k = 0; k < 4; k++) { ell(c, X + 8 + hash(x, y, k) * 40, Y + 8 + hash(x, y, k + 9) * 28, 3, 2); c.fill(); }
      }
    }
    // 入口：牛群的战旗 + 蹄印
    for (const grp of g.spawnGroups) {
      for (const s of grp) {
        const X = sx(s % g.cols), Y = sy((s / g.cols) | 0);
        c.fillStyle = 'rgba(80,50,20,0.35)';
        for (let k = 0; k < 3; k++) { ell(c, X + 10 + k * 16, Y + 14 + (k % 2) * 14, 3, 4); c.fill(); ell(c, X + 16 + k * 16, Y + 14 + (k % 2) * 14, 3, 4); c.fill(); }
      }
      const s0 = grp[0], X = sx(s0 % g.cols) + 6, Y = sy((s0 / g.cols) | 0) + 4;
      c.strokeStyle = '#5a3a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(X, Y + 30); c.lineTo(X, Y - 8); c.stroke();
      c.beginPath(); c.moveTo(X, Y - 8); c.lineTo(X + 30, Y - 2); c.lineTo(X + 24, Y + 6); c.lineTo(X + 30, Y + 14); c.lineTo(X, Y + 12); c.closePath();
      c.fillStyle = '#d8303a'; c.fill(); c.strokeStyle = '#7a1018'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#fff'; c.font = 'bold 14px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('牛', X + 13, Y + 3);
    }
    // 地块描边
    c.strokeStyle = 'rgba(40,30,20,0.35)'; c.lineWidth = 2; c.strokeRect(x0, y0, gw, gh);
  }

  /* 城池：城墙 + 城门楼 + 房子（羊和城门在 drawCityLive 里画） */
  function gateSpan(g) {
    let y0 = 99, y1 = -1;
    for (const i of g.goals) { const y = (i / g.cols) | 0; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { top: sy(y0), bot: sy(y1 + 1), mid: (sy(y0) + sy(y1 + 1)) / 2 };
  }
  function drawCityStatic(c, g, th) {
    const gs = gateSpan(g);
    const WX = CITY_X + 2, WW = 44;
    // 城里的地面
    const pg = c.createLinearGradient(CITY_X, 0, W, 0); pg.addColorStop(0, '#b9a887'); pg.addColorStop(1, '#a8977a');
    c.fillStyle = pg; c.fillRect(CITY_X, 0, W - CITY_X, H);
    c.strokeStyle = 'rgba(80,60,40,0.18)'; c.lineWidth = 1;
    for (let y = 0; y < H; y += 18) for (let x = WX + WW + ((y / 18) % 2) * 14; x < W; x += 28) c.strokeRect(x, y, 28, 18);
    // 房子
    const houses = [];
    for (let y = 30; y < H - 40; y += 96) houses.push(y);
    houses.forEach((y, k) => house(c, WX + WW + 18 + (k % 2) * 30, y, k));
    // 城墙
    const wg = c.createLinearGradient(WX, 0, WX + WW, 0); wg.addColorStop(0, '#cfc2a4'); wg.addColorStop(1, '#b3a584');
    c.fillStyle = '#7d705a'; c.fillRect(WX - 6, 0, 8, H);                       // 外墙面（朝西）
    c.fillStyle = wg; c.fillRect(WX, 0, WW, H);                                  // 墙顶
    c.strokeStyle = 'rgba(90,75,55,0.45)'; c.lineWidth = 1;
    for (let y = 0; y < H; y += 16) { c.beginPath(); c.moveTo(WX, y); c.lineTo(WX + WW, y); c.stroke(); for (let x = WX + ((y / 16) % 2) * 11; x < WX + WW; x += 22) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } }
    // 垛口
    for (let y = 4; y < H; y += 22) {
      if (y + 16 > gs.top - 8 && y < gs.bot + 8) continue;
      c.fillStyle = '#8f8268'; c.fillRect(WX - 10, y, 12, 14);
      c.fillStyle = '#d8ccb0'; c.fillRect(WX - 8, y, 10, 11);
    }
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(WX + WW - 6, 0, 6, H);
    // 城门洞
    c.fillStyle = '#3a2a1e'; c.fillRect(WX - 6, gs.top + 4, WW + 8, gs.bot - gs.top - 8);
    c.fillStyle = '#c9b48a'; c.fillRect(WX + 8, gs.top + 10, WW - 6, gs.bot - gs.top - 20);
    // 角楼（上下两端）
    for (const y of [OY + 10, OY + g.rows * CH - 30]) pavilion(c, WX + WW / 2, y + 30, 0.55, false);
  }
  function house(c, x, y, k) {
    const w = 70, h = 40, roof = ['#4a5a6a', '#8a3a2a', '#5a4a3a'][k % 3];
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 4, y + h - 2, w, 6);
    c.fillStyle = '#f2ead8'; c.fillRect(x, y + 14, w, h - 14);
    c.strokeStyle = '#7a6a50'; c.lineWidth = 1.5; c.strokeRect(x, y + 14, w, h - 14);
    c.fillStyle = '#6a4a2a'; c.fillRect(x + w / 2 - 6, y + 24, 12, h - 24);
    c.fillStyle = '#8ab4d0'; c.fillRect(x + 8, y + 22, 12, 9); c.fillRect(x + w - 20, y + 22, 12, 9);
    c.beginPath(); c.moveTo(x - 8, y + 16); c.quadraticCurveTo(x + w / 2, y + 6, x + w + 8, y + 16); c.lineTo(x + w - 6, y - 2); c.quadraticCurveTo(x + w / 2, y - 8, x + 6, y - 2); c.closePath();
    c.fillStyle = roof; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.15)'; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x + i * w / 6, y - 3); c.lineTo(x + i * w / 6 - 2, y + 12); c.stroke(); }
  }
  // 城门楼 / 角楼：两层飞檐 + 红柱
  function pavilion(c, x, y, k, big) {
    c.save(); c.translate(x, y); c.scale(k, k);
    c.fillStyle = '#8f8268'; c.fillRect(-46, -8, 92, 14);
    c.fillStyle = '#b8302a'; for (const px of [-36, -14, 14, 36]) c.fillRect(px - 3.5, -52, 7, 46);
    c.fillStyle = '#f3e3c0'; c.fillRect(-40, -46, 80, 8);
    const eave = (yy, w) => {
      c.beginPath(); c.moveTo(-w - 10, yy + 2); c.quadraticCurveTo(-w, yy + 4, -w + 6, yy - 4); c.lineTo(-w * 0.55, yy - 22); c.lineTo(w * 0.55, yy - 22); c.lineTo(w - 6, yy - 4); c.quadraticCurveTo(w, yy + 4, w + 10, yy + 2); c.lineTo(w, yy + 8); c.lineTo(-w, yy + 8); c.closePath();
      c.fillStyle = '#3e4c5a'; c.fill(); c.strokeStyle = '#1e2630'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#c9a23a'; c.fillRect(-w, yy + 6, 2 * w, 3);
    };
    eave(-52, 56);
    c.fillStyle = '#b8302a'; for (const px of [-24, 24]) c.fillRect(px - 3, -88, 6, 22);
    c.fillStyle = '#f3e3c0'; c.fillRect(-28, -84, 56, 7);
    eave(-86, 40);
    c.fillStyle = '#c9a23a'; ell(c, 0, -110, 5, 5); c.fill();
    if (big) {
      rr(c, -20, -76, 40, 20, 3); c.fillStyle = '#2a4a8a'; c.fill(); c.strokeStyle = '#c9a23a'; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = '#ffe27a'; c.font = 'bold 13px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('羊城', 0, -66);
    }
    c.restore();
  }

  /* ============================================================
   * 每帧
   * ============================================================ */
  R.draw = function (S) {
    const g = S.g, c = this.ctx, t = S.t;
    c.setTransform(this.pr, 0, 0, this.pr, 0, 0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    let shx = 0, shy = 0;
    if (S.shake > 0) { shx = (Math.random() - 0.5) * S.shake * 8; shy = (Math.random() - 0.5) * S.shake * 6; }
    c.save(); c.translate(shx, shy);
    c.drawImage(this.background(g), 0, 0, W, H);
    const th = D.THEMES[g.L.theme] || D.THEMES.grass;
    this.water(c, g, th, t);
    if (S.mode || S.showGrid) this.grid(c, g, S);
    if (S.skill === 'gunmu' && S.hover) {
      const Y = sy(S.hover.y);
      c.fillStyle = 'rgba(160,100,40,0.28)'; c.fillRect(OX, Y, g.cols * CW, CH);
      c.strokeStyle = 'rgba(255,220,120,0.9)'; c.lineWidth = 2; c.setLineDash([8, 6]); c.strokeRect(OX, Y, g.cols * CW, CH); c.setLineDash([]);
    }
    this.paths(c, g, S, t);
    // 草垛（贴地）
    for (const b of g.blds) if (b.kind === 'hay') Art.drawHay(c, sx(b.x + 0.5), sy(b.y + 0.5), CW, b.bites / D.hay.bites, t);
    // 统一按脚底 y 排序
    const list = [];
    for (let i = 0; i < g.n; i++) { const ch = g.chr[i]; if (ch === 'T' || ch === 'R' || ch === 'M') list.push({ y: sy(((i / g.cols) | 0) + 0.5) + CH * 0.2, k: 'obs', i, ch }); }
    for (const b of g.blds) if (b.kind !== 'hay') list.push({ y: sy(b.y + 0.5) + CH * 0.22, k: 'b', b });
    for (const cw of g.cows) if (cw.alive && !cw.fly) list.push({ y: sy(cw.y + cw.jy) + CH * 0.28, k: 'cow', c: cw });
    for (const f of g.fx) if (f.k === 'die' && !f.fly) list.push({ y: sy(f.y) + CH * 0.28, k: 'die', f });
    list.sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e.k === 'obs') Art.drawObstacle(c, e.ch, sx(e.i % g.cols + 0.5), sy(((e.i / g.cols) | 0) + 0.5), CW, hash(e.i, 7, g.L.id), g.L.theme, t);
      else if (e.k === 'b') this.building(c, g, e.b, S, t);
      else if (e.k === 'cow') this.cow(c, g, e.c, S, t);
      else this.death(c, e.f, t);
    }
    this.cityLive(c, g, S, t);
    for (const r of g.rollers) this.roller(c, r, t);
    // 炮弹影子 + 弹道
    for (const p of g.proj) this.projectile(c, p, t);
    // 天上的：飞天牛
    const fl = g.cows.filter(cw => cw.alive && cw.fly).sort((a, b) => a.y - b.y);
    for (const cw of fl) this.cow(c, g, cw, S, t);
    for (const f of g.fx) if (f.k === 'die' && f.fly) this.death(c, f, t);
    for (const f of g.fx) this.fx(c, g, f, t);
    // 叠加层
    for (const cw of g.cows) if (cw.alive) this.cowOverlay(c, g, cw, S, t);
    this.lines(c, g, t);
    for (const f of g.fx) if (f.k === 'say') this.say(c, f);
    for (const b of g.blds) if (b.kind !== 'hay' && (b.hp < b.maxHp || b.dis > 0)) this.bOverlay(c, b, t);
    this.selection(c, g, S, t);
    this.ghost(c, g, S, t);
    this.bossBar(c, g);
    c.restore();
    const fz = g.fx.find(f => f.k === 'freezeAll');
    if (fz) { c.fillStyle = 'rgba(160,220,255,' + (0.35 * (1 - fz.t / fz.T)) + ')'; c.fillRect(0, 0, W, H); }
    if (S.flashRed > 0) { c.fillStyle = 'rgba(255,40,30,' + (S.flashRed * 0.25) + ')'; c.fillRect(0, 0, W, H); }
  };

  R.water = function (c, g, th, t) {
    for (let i = 0; i < g.n; i++) {
      const ch = g.chr[i]; if (ch !== '~') continue;
      const x = i % g.cols, y = (i / g.cols) | 0, X = sx(x), Y = sy(y);
      c.save(); c.beginPath(); c.rect(X, Y, CW, CH); c.clip();
      if (th.lava) {
        for (let k = 0; k < 3; k++) {
          const ph = t * 0.8 + hash(x, y, k) * 6, r = (ph % 1);
          c.fillStyle = 'rgba(255,220,90,' + (0.5 * (1 - r)) + ')';
          ell(c, X + hash(x, y, k + 3) * CW, Y + hash(x, y, k + 5) * CH, 3 + r * 8, 2 + r * 5); c.fill();
        }
        c.strokeStyle = 'rgba(120,30,0,0.35)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(X, Y + CH * 0.5 + Math.sin(t + x) * 4); c.quadraticCurveTo(X + CW / 2, Y + CH * 0.3, X + CW, Y + CH * 0.55 + Math.cos(t + y) * 4); c.stroke();
      } else {
        c.strokeStyle = th.water2; c.lineWidth = 1.6; c.globalAlpha = 0.7;
        for (let k = 0; k < 2; k++) {
          const yy = Y + CH * (0.3 + k * 0.4) + Math.sin(t * 1.5 + x * 0.7 + k) * 2, xx = X + ((t * 12 + hash(x, y, k) * CW) % CW);
          c.beginPath(); c.moveTo(xx - 8, yy); c.quadraticCurveTo(xx, yy - 3, xx + 8, yy); c.stroke();
        }
      }
      c.restore();
    }
  };
  R.grid = function (c, g, S) {
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1;
    for (let i = 0; i < g.n; i++) {
      if (g.ter[i] !== NL.T.GRASS || g.occ[i]) continue;
      c.strokeRect(sx(i % g.cols) + 0.5, sy((i / g.cols) | 0) + 0.5, CW - 1, CH - 1);
    }
    // 雕像的光环范围
    for (const b of g.blds) if (b.kind === 'statue') {
      const S0 = D.statues[b.sid];
      ell(c, sx(b.x + 0.5), sy(b.y + 0.5), S0.r * CW, S0.r * CH);
      c.fillStyle = b.sid === 'niulang' ? 'rgba(255,150,200,0.08)' : 'rgba(255,220,100,0.08)'; c.fill();
    }
  };

  /* 牛的路线：白色虚线；要撞开的建筑标红色「撞」；有撞城牛的关卡再画一条橙色的攻城路线 */
  R.paths = function (c, g, S, t) {
    const P = S.preview;
    if (!S.showPath && !P) return;
    const one = (cells, breach, col, w, dash) => {
      c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash); c.lineDashOffset = -t * 30;
      c.beginPath();
      cells.forEach((ci, k) => { const X = sx(ci % g.cols + 0.5), Y = sy(((ci / g.cols) | 0) + 0.5); if (k) c.lineTo(X, Y); else c.moveTo(X, Y); });
      c.stroke(); c.setLineDash([]);
      for (const b of breach) {
        const X = sx(b % g.cols + 0.5), Y = sy(((b / g.cols) | 0) + 0.5) - CH * 0.55;
        c.fillStyle = 'rgba(220,40,30,0.92)'; ell(c, X, Y, 11, 11); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#fff'; c.font = 'bold 12px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('撞', X, Y + 1);
      }
    };
    // 飞天牛的航线：从入口直线飞向城门
    if (g.L.cows.some(e => D.cows[e[0]].fly)) {
      c.strokeStyle = 'rgba(150,215,255,0.55)'; c.lineWidth = 2; c.setLineDash([2, 8]); c.lineDashOffset = -t * 20;
      for (const grp of g.spawnGroups) {
        const s0 = grp[(grp.length / 2) | 0], X0 = sx(s0 % g.cols + 0.15), Y0 = sy(((s0 / g.cols) | 0) + 0.5), X1 = sx(g.gate.x), Y1 = sy(g.gate.y);
        c.beginPath(); c.moveTo(X0, Y0); c.lineTo(X1, Y1); c.stroke();
        const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2;
        c.setLineDash([]); c.font = '13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillText('🎈', mx, my - 8); c.setLineDash([2, 8]);
      }
      c.setLineDash([]);
    }
    const src = P ? P : this.pathCache(g);
    for (const p of src.siege) one(p.cells, [], 'rgba(255,140,40,0.55)', 2, [3, 7]);
    for (const p of src.norm) one(p.cells, p.breach, P ? (P.ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,90,70,0.85)') : 'rgba(255,255,255,0.45)', P ? 3 : 2.2, [10, 8]);
  };
  R.pathCache = function (g) {
    if (this._pc && this._pc.fN === g.fN) return this._pc.v;
    const v = NL.paths(g);
    this._pc = { fN: g.fN, v };
    return v;
  };
  // 每个入口组取中间那格走一遍
  NL.paths = function (g, fN, fS, occ) {
    const norm = [], siege = [];
    const hasSiege = g.L.cows.some(e => D.cows[e[0]].siegeAI);
    for (const grp of g.spawnGroups) {
      const s = grp[(grp.length / 2) | 0];
      norm.push(g.pathFrom(s, false, fN || g.fN, occ));
      if (hasSiege) siege.push(g.pathFrom(s, true, fS || g.fS, occ));
    }
    return { norm, siege };
  };

  /* ---------- 建筑 ---------- */
  R.building = function (c, g, b, S, t) {
    const X = sx(b.x + 0.5), Y = sy(b.y + 0.5);
    const hurt = b.hit > 0 ? Math.sin(b.hit * 60) * 2 : 0;
    c.save(); c.translate(hurt, 0);
    if (S.sel === b || S.hoverB === b) { ell(c, X, Y + CH * 0.2, CW * 0.46, CH * 0.3); c.fillStyle = S.sel === b ? 'rgba(255,230,90,0.45)' : 'rgba(255,255,255,0.25)'; c.fill(); }
    if (b.kind === 'tower') {
      if (b.dis > 0) c.filter = 'grayscale(0.8) brightness(0.85)';
      Art.drawTower(c, b.type, b.lv, X, Y, CW, { recoil: b.fireT > 0 ? b.fireT / 0.18 : 0 });
      c.filter = 'none';
    } else if (b.kind === 'wall') Art.drawWall(c, b.lv, X, Y, CW, b.hp / b.maxHp, t);
    else if (b.kind === 'statue') {
      Art.drawStatue(c, b.sid, X, Y, CW);
      if (b.sid === 'niulang' && Math.floor(t * 2 + b.id) % 3 === 0) note(c, X + 10, Y - CH * 1.6 - (t * 20 % 12), 1 - (t * 2 % 1));
    }
    c.restore();
  };
  function note(c, X, Y, a) {
    c.save(); c.globalAlpha = Math.max(0, a); c.fillStyle = '#ff6fae'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText('♪', X, Y); c.restore();
  }
  R.bOverlay = function (c, b, t) {
    const X = sx(b.x + 0.5), top = b.kind === 'tower' ? sy(b.y + 0.5) + Art.towerTop(b.type, b.lv, CW) - 4 : sy(b.y) - (b.kind === 'statue' ? CH * 1.2 : 8);
    if (b.hp < b.maxHp) hpBar(c, X, top, 34, 5, b.hp / b.maxHp, b.hp / b.maxHp < 0.35 ? '#ff5a3a' : '#7ad84a');
    if (b.dis > 0) {
      if (b.disK === 'ring') {
        c.save(); c.translate(X, top - 12 + Math.sin(t * 6) * 2);
        ell(c, 0, 0, 10, 4); c.lineWidth = 3; c.strokeStyle = '#c9901a'; c.stroke(); ell(c, 0, 0, 10, 4); c.lineWidth = 1.5; c.strokeStyle = '#ffe27a'; c.stroke();
        c.restore();
      } else stars(c, X, top - 10, t, 12);
    }
  };
  function hpBar(c, X, Y, w, h, k, col) {
    c.fillStyle = 'rgba(20,12,6,0.75)'; rr(c, X - w / 2 - 1, Y - 1, w + 2, h + 2, 2); c.fill();
    c.fillStyle = col; c.fillRect(X - w / 2, Y, w * Math.max(0, Math.min(1, k)), h);
  }
  function stars(c, X, Y, t, r) {
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + k * TAU / 3, px = X + Math.cos(a) * r, py = Y + Math.sin(a) * r * 0.35;
      c.fillStyle = '#ffe23a'; c.strokeStyle = '#8a6a0a'; c.lineWidth = 1;
      c.beginPath(); for (let j = 0; j < 10; j++) { const rr2 = j % 2 ? 2 : 4.6, aa = j * Math.PI / 5 - Math.PI / 2; c.lineTo(px + Math.cos(aa) * rr2, py + Math.sin(aa) * rr2); } c.closePath(); c.fill(); c.stroke();
    }
  }

  /* ---------- 牛 ---------- */
  R.cowPos = function (cw, t) {
    let X = sx(cw.x + cw.jx), Y = sy(cw.y + cw.jy) + CH * 0.28;
    if (cw.fly) Y -= CH * 1.0 + Math.sin(t * 3 + cw.uid) * 4;
    if (cw.ram > 0) X += cw.dir * Math.pow(Math.sin(t * 13 + cw.uid), 2) * 5;
    return { X, Y };
  };
  R.cow = function (c, g, cw, S, t) {
    const { X, Y } = this.cowPos(cw, t);
    const gy = sy(cw.y + cw.jy) + CH * 0.28;
    const sz = D.cows[cw.id].size;
    c.fillStyle = cw.fly ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.22)'; ell(c, X, gy, CW * 0.36 * sz, CH * 0.13 * sz); c.fill();
    if (cw.enraged) { const gr = c.createRadialGradient(X, Y - CH * 0.5 * sz, 2, X, Y - CH * 0.5 * sz, CW * 0.9 * sz); gr.addColorStop(0, 'rgba(255,60,20,0.35)'); gr.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = gr; ell(c, X, Y - CH * 0.5 * sz, CW * 0.9 * sz, CW * 0.8 * sz); c.fill(); }
    if (cw.chargeT > 0) { c.fillStyle = 'rgba(200,170,120,0.45)'; for (let k = 1; k <= 3; k++) { ell(c, X - cw.dir * k * 9, gy - 3, 7 - k, 4 - k * 0.8); c.fill(); } }
    const moving = cw.moving && cw.stun <= 0;
    const frame = moving ? Math.floor(cw.walk * 7) % 8 : Math.floor(t * 3 + cw.uid) % 8;
    let v = cw.trip > 0 ? 't' : cw.chargeT > 0 ? 'c' : cw.enraged ? 'e' : moving || cw.fly ? '' : 'i';
    if (cw.stood) v += 'u';
    const rot = cw.trip > 0 ? 0 : cw.ram > 0 ? 0.1 : cw.eat > 0 ? 0.14 : 0;
    Art.drawCow(c, cw.id, X, Y, frame, cw.dir, v, cw.flash > 0, CW, rot);
    if (cw.fly) Art.drawBalloon(c, X - cw.dir * 4, Y - CH * 0.95 * sz, CW * 0.62, t);
    if (cw.frozen > 0) { c.fillStyle = 'rgba(170,225,255,0.45)'; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5; rr(c, X - CW * 0.48 * sz, Y - CH * 1.1 * sz, CW * 0.96 * sz, CH * 1.1 * sz, 6); c.fill(); c.stroke(); }
  };
  // 血条的高度：海报牛按老规矩，正片牛按模型高度（站着的牛更高）
  R.cowTop = function (cw, Y) {
    const sz = D.cows[cw.id].size, k = CH * 1.25 * sz + (cw.id === 'qingniu' ? 10 : 0);
    if (Art.style !== 'su' || !NL.SU) return Y - k;
    return Y - Math.max(k, NL.SU.top(cw.id, cw.stood) * Art.cowScale(cw.id, CW) * 0.95 + 4);
  };
  R.cowOverlay = function (c, g, cw, S, t) {
    const { X, Y } = this.cowPos(cw, t);
    const sz = D.cows[cw.id].size, top = this.cowTop(cw, Y);
    if (cw.hp < cw.maxHp && !cw.boss) hpBar(c, X, top, 26 * Math.max(0.8, sz), 4, cw.hp / cw.maxHp, '#ff5a3a');
    if (cw.boss) {
      hpBar(c, X, top, 60, 6, cw.hp / cw.maxHp, cw.enraged ? '#ff2a2a' : '#ffb02a');
      c.font = 'bold 12px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(D.cows[cw.id].n, X, top - 2); c.fillStyle = '#ffe27a'; c.fillText(D.cows[cw.id].n, X, top - 2);
    }
    if (cw.stun > 0 && cw.frozen <= 0) stars(c, X, top - 6, t, 11);
    if (cw.burnT > 0) for (let k = 0; k < 3; k++) { const fx = X - 10 + k * 10, fy = Y - CH * 0.55 * sz - Math.abs(Math.sin(t * 12 + k * 2)) * 6; c.fillStyle = 'rgba(255,120,20,0.85)'; ell(c, fx, fy, 3.5, 6); c.fill(); c.fillStyle = 'rgba(255,230,90,0.9)'; ell(c, fx, fy + 2, 2, 3); c.fill(); }
    if (cw.poiT > 0) for (let k = 0; k < 2; k++) { const ph = (t * 1.5 + k * 0.5) % 1; c.fillStyle = 'rgba(120,230,60,' + (0.8 * (1 - ph)) + ')'; ell(c, X - 6 + k * 12, Y - CH * 0.6 * sz - ph * 16, 3, 3); c.fill(); }
    if (cw.slowT > 0 && cw.frozen <= 0) { c.fillStyle = 'rgba(120,200,255,0.9)'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('❄', X + 12 * sz, top + 14); }
    if (cw.calm) note(c, X - 8, top - 2 - (t * 18 % 10), 1);
    if (cw.eat > 0) { c.font = 'bold 11px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.strokeText('嚼嚼', X, top - 2); c.fillStyle = '#5a8a1a'; c.fillText('嚼嚼', X, top - 2); }
    if (cw.uid === g.focus) {
      const a = t * 3;
      c.save(); c.translate(X, Y - CH * 0.5 * sz); c.rotate(a);
      c.strokeStyle = '#ff3a2a'; c.lineWidth = 2.5; ell(c, 0, 0, 16 * sz + 4, 16 * sz + 4); c.stroke();
      for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(16 * sz, 0); c.lineTo(16 * sz + 9, 0); c.stroke(); }
      c.restore();
    }
  };
  /* ---------- 台词气泡 ---------- */
  function bubble(c, X, Y, txt, a) {
    c.save(); c.globalAlpha *= Math.max(0, Math.min(1, a));
    c.font = 'bold 12px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(txt).width + 14, h = 20;
    const x0 = Math.max(4, Math.min(W - w - 4, X - w / 2)), y0 = Math.max(OY, Y - h - 8);
    c.fillStyle = '#fffef4'; c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.5;
    rr(c, x0, y0, w, h, 8); c.fill(); c.stroke();
    const tx = Math.max(x0 + 8, Math.min(x0 + w - 12, X - 3));
    c.beginPath(); c.moveTo(tx, y0 + h - 0.5); c.lineTo(tx + 3, y0 + h + 7); c.lineTo(tx + 8, y0 + h - 0.5); c.fill();
    c.beginPath(); c.moveTo(tx, y0 + h); c.lineTo(tx + 3, y0 + h + 7); c.lineTo(tx + 8, y0 + h); c.stroke();
    c.fillStyle = '#2a1a0a'; c.fillText(txt, x0 + w / 2, y0 + h / 2 + 1);
    c.restore();
  }
  R.say = function (c, f) {
    const k = f.t / f.T;
    bubble(c, sx(f.x), sy(f.y) - CH * 0.9 - k * 10, f.txt, Math.min(k * 8, (1 - k) * 5));
  };
  // 牛来一家三口隔一阵冒一句台词（同屏最多 3 个气泡）
  R.lines = function (c, g, t) {
    let n = 0;
    for (const cw of g.cows) {
      const L = cw.alive && !cw.fly && D.cows[cw.id].lines;
      if (!L || n >= 3) continue;
      const P = 7, ph = t + cw.uid * 2.37, cyc = Math.floor(ph / P), f = ph - cyc * P, h = hash(cw.uid, cyc, 3);
      if (f > 2.4 || h > 0.3) continue;
      n++;
      const { X, Y } = this.cowPos(cw, t);
      bubble(c, X, this.cowTop(cw, Y) - 4, L[Math.floor(h * 100) % L.length], Math.min(f * 6, (2.4 - f) * 4));
    }
  };

  R.death = function (c, f, t) {
    const k = Math.min(1, f.t / f.T);
    let X = sx(f.x), Y = sy(f.y) + CH * 0.28;
    if (f.fly) Y -= CH * 1.0 * Math.max(0, 1 - k * 2.5);
    const a = k > 0.6 ? (1 - k) / 0.4 : 1;
    if (Art.style === 'su') {
      // 正片：愣 0.15 秒，然后没有任何过渡，「啪」地四脚朝天
      Art.drawCow(c, f.id, X, Y - (k < 0.15 ? 0 : Math.max(0, Math.sin((k - 0.15) * 14)) * 5 * (1 - k)), 0, f.dir, k < 0.15 ? 'i' : 'd', k < 0.1, CW, 0, a);
    } else {
      const rot = Math.min(1, k * 3) * (Math.PI / 2) * 0.95;
      Art.drawCow(c, f.id, X, Y - Math.sin(Math.min(1, k * 3) * Math.PI) * 8, 0, f.dir, 'i', k < 0.1, CW, -rot, a);
    }
    if (f.boss && k < 0.8) { c.fillStyle = 'rgba(255,220,120,' + (0.6 * (1 - k)) + ')'; ell(c, X, Y - 20, 40 + k * 60, 30 + k * 40); c.fill(); }
    // 赏金
    if (f.gold) {
      const gy = Y - CH * 0.9 - k * 26;
      c.save(); c.globalAlpha = Math.min(1, (1 - k) * 2);
      c.font = 'bold 14px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = 'rgba(90,50,0,0.85)'; c.strokeText('+' + f.gold, X, gy); c.fillStyle = '#ffe23a'; c.fillText('+' + f.gold, X, gy);
      c.restore();
    }
    if (k < 0.5 && f.id !== 'feitian') { c.save(); c.globalAlpha = 1 - k * 2; c.font = 'bold 12px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; const tx = f.boss ? '哞——！！' : '哞~'; c.strokeText(tx, X + 16, Y - CH * 1.2); c.fillText(tx, X + 16, Y - CH * 1.2); c.restore(); }
  };

  /* ---------- 城门 / 城头的羊 ---------- */
  R.cityLive = function (c, g, S, t) {
    const gs = gateSpan(g), WX = CITY_X + 2, WW = 44;
    const hitK = S.gateHit > 0 ? S.gateHit : 0;
    // 城门：两扇木门
    c.save();
    c.translate(hitK ? Math.sin(t * 80) * 3 * hitK : 0, 0);
    const dy0 = gs.top + 8, dh = gs.bot - gs.top - 16;
    for (let k = 0; k < 2; k++) {
      const y = dy0 + k * dh / 2;
      const dg = c.createLinearGradient(WX - 6, 0, WX + 6, 0); dg.addColorStop(0, '#8a4a22'); dg.addColorStop(1, '#6a3414');
      c.fillStyle = dg; c.fillRect(WX - 6, y, 14, dh / 2 - 1);
      c.fillStyle = '#e0b040';
      for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) { ell(c, WX - 2 + i * 6, y + 8 + j * (dh / 2 - 14) / 3, 1.8, 1.8); c.fill(); }
      c.strokeStyle = '#3a1a08'; c.lineWidth = 1.5; c.strokeRect(WX - 6, y, 14, dh / 2 - 1);
    }
    if (hitK) { c.fillStyle = 'rgba(255,60,40,' + (hitK * 0.35) + ')'; c.fillRect(WX - 8, dy0, 18, dh); }
    c.restore();
    // 城门楼
    pavilion(c, WX + WW / 2 + 2, gs.mid + 10, 0.72, true);
    // 城头的羊：平时开心，城门挨打时害怕，城防低了哭
    const ratio = g.hp / g.maxHp;
    const mood = g.over ? (g.win ? 'happy' : 'cry') : S.gateHit > 0 ? 'scared' : ratio < 0.35 ? 'cry' : ratio < 0.7 ? 'angry' : 'happy';
    const spots = [];
    for (let y = OY + 70; y < OY + g.rows * CH - 40; y += 88) if (y < gs.top - 40 || y > gs.bot + 30) spots.push(y);
    spots.forEach((y, k) => {
      const hop = mood === 'happy' && g.over ? Math.abs(Math.sin(t * 6 + k)) * 8 : 0;
      Art.drawSheep(c, mood, WX + WW / 2 - 4, y - hop, 34, t + k * 0.3, true);
    });
  };

  /* ---------- 滚木 ---------- */
  R.roller = function (c, r, t) {
    const X = sx(r.x), Y = sy(r.row + 0.5) + CH * 0.1;
    c.save(); c.translate(X, Y);
    c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, 0, CH * 0.25, CW * 0.5, CH * 0.12); c.fill();
    const lw = CW * 0.95, lh = CH * 0.46;
    rr(c, -lw / 2, -lh, lw, lh, lh / 2); c.fillStyle = '#9a6a3a'; c.fill(); c.strokeStyle = '#4a2a10'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(60,30,10,0.5)'; c.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { const xx = ((k * lw / 4 + t * 180) % lw) - lw / 2; c.beginPath(); c.moveTo(xx, -lh + 3); c.lineTo(xx + 4, -3); c.stroke(); }
    ell(c, -lw / 2 + lh * 0.25, -lh / 2, lh * 0.25, lh / 2 - 1); c.fillStyle = '#d8a870'; c.fill(); c.stroke();
    c.restore();
  };

  /* ---------- 弹道 ---------- */
  const ZK = CH * 1.15;
  R.projectile = function (c, p, t) {
    const X = sx(p.x), Yg = sy(p.y), Y = Yg - p.z * ZK;
    const a = p.ang != null ? Math.atan2(Math.sin(p.ang) * CH, Math.cos(p.ang) * CW) : 0;
    switch (p.k) {
      case 'arrow':
        c.save(); c.translate(X, Y); c.rotate(a);
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-11, 0); c.lineTo(5, 0); c.stroke();
        c.fillStyle = '#d8dde2'; c.beginPath(); c.moveTo(9, 0); c.lineTo(3, -3.5); c.lineTo(3, 3.5); c.closePath(); c.fill();
        c.fillStyle = '#e04a3a'; c.fillRect(-12, -2.5, 4, 5);
        c.restore(); break;
      case 'bolt':
        c.fillStyle = 'rgba(255,210,80,0.35)'; ell(c, X, Y, 7, 7); c.fill();
        c.fillStyle = '#fff2a8'; ell(c, X, Y, 3.4, 3.4); c.fill(); break;
      case 'shell': {
        c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, X, Yg, 6, 3); c.fill();
        const gr = c.createRadialGradient(X - 2, Y - 2, 1, X, Y, 7); gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(1, '#1e1e1e');
        c.fillStyle = gr; ell(c, X, Y, 6.5, 6.5); c.fill();
        c.fillStyle = 'rgba(255,160,40,0.9)'; ell(c, X + 3, Y - 4, 2, 2); c.fill(); break;
      }
      case 'ice':
        c.save(); c.translate(X, Y); c.rotate(t * 8);
        c.fillStyle = 'rgba(150,220,255,0.35)'; ell(c, 0, 0, 10, 10); c.fill();
        c.fillStyle = '#e6f8ff'; c.strokeStyle = '#3f9ed8'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(0, -7); c.lineTo(4, 0); c.lineTo(0, 7); c.lineTo(-4, 0); c.closePath(); c.fill(); c.stroke();
        c.restore(); break;
      case 'fire': {
        const tx = X - Math.cos(a) * 10, ty = Y - Math.sin(a) * 10;
        const gr = c.createRadialGradient(X, Y, 1, X, Y, 12); gr.addColorStop(0, 'rgba(255,240,150,1)'); gr.addColorStop(0.4, 'rgba(255,130,30,0.9)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = 'rgba(255,100,20,0.4)'; ell(c, tx, ty, 6, 4); c.fill();
        c.fillStyle = gr; ell(c, X, Y, 12, 12); c.fill(); break;
      }
      case 'poison':
        c.fillStyle = 'rgba(120,230,60,0.3)'; ell(c, X, Y, 9, 9); c.fill();
        c.fillStyle = '#7ad83a'; c.strokeStyle = '#2a6a10'; c.lineWidth = 1.5; ell(c, X, Y, 5, 5); c.fill(); c.stroke();
        c.fillStyle = '#d8ffb0'; ell(c, X - 1.5, Y - 1.5, 1.5, 1.5); c.fill(); break;
    }
  };

  /* ---------- 特效 ---------- */
  R.fx = function (c, g, f, t) {
    const k = f.t / f.T;
    const X = f.x != null ? sx(f.x) : 0, Y = f.y != null ? sy(f.y) : 0;
    switch (f.k) {
      case 'hit': {
        const yy = Y - (f.z || 0.4) * ZK;
        c.fillStyle = f.c || '#fff'; c.globalAlpha = 1 - k;
        ell(c, X, yy, (f.big ? 9 : 5) + k * 8, (f.big ? 9 : 5) + k * 8); c.fill();
        c.globalAlpha = 1; break;
      }
      case 'boom': {
        const r = f.r * CW * (0.4 + k * 0.7);
        c.globalAlpha = 1 - k;
        const gr = c.createRadialGradient(X, Y - 6, 2, X, Y - 6, r);
        gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.35, f.fire ? '#ff7a1a' : '#ffb03a'); gr.addColorStop(1, 'rgba(120,60,20,0)');
        c.fillStyle = gr; ell(c, X, Y - 6, r, r * 0.8); c.fill();
        c.strokeStyle = 'rgba(255,240,200,0.8)'; c.lineWidth = 3; ell(c, X, Y, f.r * CW * (0.3 + k), f.r * CH * (0.3 + k)); c.stroke();
        c.globalAlpha = 1; break;
      }
      case 'frost':
        c.globalAlpha = 1 - k; c.strokeStyle = '#bfefff'; c.lineWidth = 3;
        ell(c, X, Y, f.r * CW * (0.3 + k * 0.7), f.r * CH * (0.3 + k * 0.7)); c.stroke();
        c.fillStyle = 'rgba(190,240,255,0.3)'; c.fill(); c.globalAlpha = 1; break;
      case 'heal':
        c.globalAlpha = 1 - k; c.fillStyle = f.b ? '#7ad8ff' : '#5aff7a'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
        c.fillText(f.b ? '🔧' : '+', X, Y - CH * 0.8 - k * 18); c.globalAlpha = 1; break;
      case 'ring':
        c.globalAlpha = 1 - k; c.strokeStyle = f.c; c.lineWidth = 3;
        ell(c, X, Y, f.r * CW * k, f.r * CH * k); c.stroke(); c.globalAlpha = 1; break;
      case 'ringThrow': {
        const px = sx(f.x + (f.x2 - f.x) * k), py = sy(f.y + (f.y2 - f.y) * k) - Math.sin(k * Math.PI) * 50 - CH;
        c.save(); c.translate(px, py); c.rotate(t * 15);
        ell(c, 0, 0, 10, 10); c.lineWidth = 3.5; c.strokeStyle = '#c9901a'; c.stroke(); ell(c, 0, 0, 10, 10); c.lineWidth = 1.5; c.strokeStyle = '#fff2a0'; c.stroke();
        c.restore(); break;
      }
      case 'quake':
        c.globalAlpha = 1 - k; c.strokeStyle = '#8a5a2a'; c.lineWidth = 5 * (1 - k) + 1;
        ell(c, X, Y, f.r * CW * k, f.r * CH * k); c.stroke();
        c.fillStyle = 'rgba(140,100,60,0.35)'; c.fill(); c.globalAlpha = 1; break;
      case 'rubble':
        for (let j = 0; j < 7; j++) {
          const a = j * 0.9 + 0.3, d = k * 26, px = X + Math.cos(a) * d, py = Y - Math.sin(k * Math.PI) * 18 + Math.sin(a) * d * 0.5;
          c.fillStyle = f.what === 'wall' ? '#8a7a64' : '#a08a6a'; c.globalAlpha = 1 - k;
          c.fillRect(px - 3, py - 3, 6, 5);
        }
        c.fillStyle = 'rgba(180,160,130,' + (0.5 * (1 - k)) + ')'; ell(c, X, Y - 10, 20 + k * 20, 12 + k * 10); c.fill();
        c.globalAlpha = 1; break;
      case 'gate':
        c.globalAlpha = 1 - k; c.font = 'bold 18px "Microsoft YaHei",sans-serif'; c.textAlign = 'center';
        c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText('-' + f.pow, CITY_X + 20, Y - 20 - k * 20); c.fillStyle = '#e02a1a'; c.fillText('-' + f.pow, CITY_X + 20, Y - 20 - k * 20);
        c.globalAlpha = 1; break;
      case 'immune':
        c.globalAlpha = 1 - k; c.font = 'bold 11px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ddd'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3;
        c.strokeText('免疫', X, Y - CH - k * 12); c.fillText('免疫', X, Y - CH - k * 12); c.globalAlpha = 1; break;
      case 'munch':
        if (k < 0.8) for (let j = 0; j < 3; j++) { const ph = (k * 3 + j / 3) % 1; c.fillStyle = 'rgba(220,190,70,' + (1 - ph) + ')'; c.fillRect(X - 8 + j * 8 + Math.sin(ph * 6) * 3, Y - ph * 14, 4, 2); }
        break;
      case 'bump': {
        c.globalAlpha = 1 - k;
        c.fillStyle = 'rgba(210,180,130,0.6)'; ell(c, X, Y, 8 + k * 10, 5 + k * 5); c.fill();
        c.font = 'bold ' + (f.big ? 16 : 12) + 'px "Microsoft YaHei",sans-serif'; c.textAlign = 'center';
        c.lineWidth = 3; c.strokeStyle = '#fff'; const tx = f.big ? '轰！' : '咚'; c.strokeText(tx, X, Y - CH * 0.7 - k * 10); c.fillStyle = f.big ? '#e0301a' : '#8a4a1a'; c.fillText(tx, X, Y - CH * 0.7 - k * 10);
        c.globalAlpha = 1; break;
      }
      case 'beam': {
        const x1 = sx(f.x), y1 = sy(f.y) - 1.0 * ZK, x2 = sx(f.x2), y2 = sy(f.y2) - 0.4 * ZK;
        c.globalAlpha = 1 - k;
        c.strokeStyle = 'rgba(255,90,70,0.45)'; c.lineWidth = 14 * (1 - k) + 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.strokeStyle = '#fff2e0'; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.globalAlpha = 1; break;
      }
      case 'chain': {
        c.globalAlpha = 1 - k;
        for (const [col, w] of [['rgba(170,120,255,0.55)', 6], ['#f2e8ff', 2]]) {
          c.strokeStyle = col; c.lineWidth = w; c.beginPath();
          f.pts.forEach((p, j) => {
            const px = sx(p.x), py = sy(p.y) - p.z * ZK;
            if (!j) { c.moveTo(px, py); return; }
            const q = f.pts[j - 1], qx = sx(q.x), qy = sy(q.y) - q.z * ZK;
            for (let s = 1; s <= 4; s++) { const u = s / 4; c.lineTo(qx + (px - qx) * u + (s < 4 ? (hash(j, s, (t * 30) | 0) - 0.5) * 14 : 0), qy + (py - qy) * u + (s < 4 ? (hash(s, j, (t * 30) | 0) - 0.5) * 14 : 0)); }
          });
          c.stroke();
        }
        c.globalAlpha = 1; break;
      }
    }
  };

  /* ---------- 选中 / 建造预览 ---------- */
  R.selection = function (c, g, S, t) {
    const b = S.sel;
    if (!b || b.dead) return;
    const X = sx(b.x + 0.5), Y = sy(b.y + 0.5);
    if (b.kind === 'tower') {
      const T = D.towers[b.type], r = T.rng[b.lv - 1] * b.aura.rng;
      ell(c, X, Y, r * CW, r * CH); c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill();
      c.strokeStyle = 'rgba(255,240,160,0.9)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
    } else if (b.kind === 'statue') {
      const S0 = D.statues[b.sid];
      ell(c, X, Y, S0.r * CW, S0.r * CH); c.fillStyle = 'rgba(255,200,120,0.12)'; c.fill(); c.strokeStyle = 'rgba(255,220,140,0.9)'; c.lineWidth = 2; c.stroke();
    }
  };
  R.ghost = function (c, g, S, t) {
    const m = S.mode, h = S.hover;
    if (!m || !h || !g.inb(h.x, h.y)) return;
    const X = sx(h.x + 0.5), Y = sy(h.y + 0.5);
    const ok = S.ghostOk;
    c.fillStyle = ok ? 'rgba(120,255,120,0.28)' : 'rgba(255,70,50,0.35)'; c.fillRect(sx(h.x), sy(h.y), CW, CH);
    c.save(); c.globalAlpha = 0.6;
    if (m.kind === 'tower') {
      const T = D.towers[m.type];
      ell(c, X, Y, T.rng[0] * CW, T.rng[0] * CH); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill(); c.strokeStyle = ok ? 'rgba(255,255,255,0.9)' : 'rgba(255,90,70,0.9)'; c.lineWidth = 2; c.stroke();
      Art.drawTower(c, m.type, 1, X, Y, CW);
    } else if (m.kind === 'wall') Art.drawWall(c, 1, X, Y, CW, 1, t);
    else if (m.kind === 'hay') Art.drawHay(c, X, Y, CW, 1, t);
    else if (m.kind === 'statue') {
      const S0 = D.statues[m.sid];
      ell(c, X, Y, S0.r * CW, S0.r * CH); c.fillStyle = 'rgba(255,220,140,0.15)'; c.fill();
      Art.drawStatue(c, m.sid, X, Y, CW);
    }
    c.restore();
  };
  R.bossBar = function (c, g) {
    const b = g.cows.find(cw => cw.alive && cw.boss);
    if (!b) return;
    const w = 360, X = W / 2 - w / 2, Y = 60;
    c.fillStyle = 'rgba(30,14,8,0.8)'; rr(c, X - 8, Y - 4, w + 16, 26, 8); c.fill();
    c.fillStyle = '#3a1a10'; c.fillRect(X, Y + 10, w, 8);
    const gr = c.createLinearGradient(X, 0, X + w, 0); gr.addColorStop(0, '#ff5a2a'); gr.addColorStop(1, '#ffc23a');
    c.fillStyle = gr; c.fillRect(X, Y + 10, w * b.hp / b.maxHp, 8);
    c.font = 'bold 11px "Microsoft YaHei",sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#ffe27a';
    c.fillText(D.cows[b.id].n + (b.enraged ? ' · 狂暴！' : ''), X, Y - 2);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.fillText(Math.ceil(b.hp) + ' / ' + b.maxHp, X + w, Y - 2);
  };

  /* ============================================================
   * 标题 / 选关用的装饰画面：一群牛冲向羊城
   * ============================================================ */
  R.drawTitle = function (t, herd) {
    const c = this.ctx;
    c.setTransform(this.pr, 0, 0, this.pr, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7fd0ff'); sky.addColorStop(0.55, '#d8f2ff'); sky.addColorStop(0.56, '#a6d86a'); sky.addColorStop(1, '#6fae3a');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // 云
    for (let k = 0; k < 5; k++) { const x = ((k * 330 + t * (8 + k * 3)) % (W + 300)) - 150, y = 60 + k * 37 % 140; c.fillStyle = 'rgba(255,255,255,0.85)'; ell(c, x, y, 70, 22); c.fill(); ell(c, x + 40, y - 12, 44, 22); c.fill(); ell(c, x - 40, y - 6, 38, 18); c.fill(); }
    // 远山
    c.fillStyle = '#8cc26a'; c.beginPath(); c.moveTo(0, 400); for (let x = 0; x <= W; x += 40) c.lineTo(x, 380 - Math.sin(x / 140) * 40 - Math.sin(x / 57) * 12); c.lineTo(W, 420); c.lineTo(0, 420); c.fill();
    // 羊城（右侧）
    c.save(); c.translate(1010, 430);
    c.fillStyle = '#b3a584'; c.fillRect(0, -80, 280, 90);
    for (let x = 0; x < 280; x += 24) { c.fillStyle = '#cfc2a4'; c.fillRect(x, -96, 16, 18); }
    c.fillStyle = '#3a2a1e'; c.beginPath(); c.moveTo(90, 10); c.lineTo(90, -40); c.arc(120, -40, 30, Math.PI, 0); c.lineTo(150, 10); c.fill();
    c.restore();
    pavilion(c, 1130, 340, 1.1, true);
    for (let k = 0; k < 4; k++) Art.drawSheep(c, 'scared', 1030 + k * 70 + (k > 1 ? 60 : 0), 336 + (k === 1 ? 0 : 0), 42, t + k * 0.2, true);
    // 牛群
    for (const h of herd) {
      const X = ((h.x + t * h.v * 60) % (W + 400)) - 200;
      if (X > 980) continue;
      const Y = h.y;
      c.fillStyle = 'rgba(0,0,0,0.18)'; ell(c, X, Y, 30 * h.s, 8 * h.s); c.fill();
      c.fillStyle = 'rgba(210,190,140,0.35)'; ell(c, X - 40 * h.s, Y - 4, 22 * h.s, 9 * h.s); c.fill();
      Art.drawCow(c, h.id, X, Y, Math.floor(t * 12 * h.v + h.x) % 8, 1, '', false, 56 * h.s * 1.25);
      if (D.cows[h.id].fly) Art.drawBalloon(c, X - 4, Y - 50 * h.s, 36 * h.s, t);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
