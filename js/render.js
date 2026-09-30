/* ============================================================
 * 战斗渲染器
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, Art = SV.Art, OUT = Art.OUT;

  function Renderer(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 1280; this.H = 720;
    this.scale = 1;
    this.B = null; this.bg = null;
    this.view = { x: 0, y: 56, w: 980, h: 664 };
    this.cs = 48; this.ch = 37; this.ay = 1; this.ox = 0; this.oy = 0;
    this.t = 0;
    this.resize();
  }
  SV.Renderer = Renderer;
  const R = Renderer.prototype;

  R.resize = function () {
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const box = this.cv.getBoundingClientRect();
    const cssW = box.width || this.W;
    const s = Math.min(2.5, Math.max(1, (cssW / this.W) * dpr));
    this.scale = s;
    const w = Math.round(this.W * s), h = Math.round(this.H * s);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    if (this.B) this.setBattle(this.B, true);
  };

  R.setView = function (v) { this.view = v; if (this.B) this.setBattle(this.B, true); };

  R.setBattle = function (B, keep) {
    this.B = B;
    const map = B.map, v = this.view;
    // 标定过的原画：棋盘外还要留出羊村/出怪台的位置，边距放大，但不能超出原画本身（否则要用模糊图补边）
    let Mx = 1, My = 1;
    const rg0 = global.SVA_MAP_REG && global.SVA_MAP_REG[map.idx];
    if (rg0 && rg0.bx1) {          // bx/by/bx1/by1 = 原画不透明区域（舞台底色已被抠掉，PNG 比实际画面大）
      const CW = SV.CELL_W, CH = SV.CELL_H, cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
      Mx = cl(Math.min((rg0.x - rg0.bx) / CW, (rg0.bx1 - rg0.x - map.cols * CW) / CW), 0.6, 2);
      My = cl(Math.min((rg0.y - rg0.by) / CH, (rg0.by1 - rg0.y - map.rows * CH) / CH), 0.6, 1.4);
    }
    const M = Mx;
    // 格子是 65×50 的长方形（SV.CELL_AR）：cs 是格宽，ch 是格高，逻辑坐标 (x,y) → 屏幕 (ox + x·cs, oy + y·ch)
    const AR = SV.CELL_AR || 1;
    const cs = Math.floor(Math.min(v.w / (map.cols + 2 * Mx), v.h / ((map.rows + 2 * My) * AR)));
    const ch = Math.round(cs * AR);
    this.cs = cs; this.ch = ch; this.ay = ch / cs;
    this.ox = Math.floor(v.x + (v.w - map.cols * cs) / 2);
    this.oy = Math.floor(v.y + (v.h - map.rows * ch) / 2);
    if (global.SVAMapArt && global.SVAMapArt.prefetch) global.SVAMapArt.prefetch(map);
    // 背景画布铺满整个视口（原作底图比棋盘大得多，棋盘外的树石/羊村是原画的一部分）
    this.bg = Art.buildBackground(map, cs, this.scale, M, ch, { W: v.w, H: v.h, ox: this.ox - v.x, oy: this.oy - v.y });
    const th = Art.THEMES[map.theme] || Art.THEMES.grass;
    const rg = global.SVA_MAP_REG && global.SVA_MAP_REG[map.idx];
    this.backdrop = (rg && rg.edge) || th.outer;
    this.bgX = v.x; this.bgY = v.y;
  };

  /* 直立绘制：世界层（地面、射程、特效）是沿 y 压扁的，塔/狼/羊/文字这类「站着的东西」
     要按原比例画。以 (·, py) 为锚点把压扁抵消掉，锚点的屏幕位置不变。 */
  R.upright = function (ctx, py, fn) {
    ctx.save(); ctx.translate(0, py); ctx.scale(1, 1 / this.ay); ctx.translate(0, -py);
    fn(); ctx.restore();
  };

  /* 屏幕(逻辑坐标) → 格子 */
  R.toCell = function (px, py) {
    const cx = Math.floor((px - this.ox) / this.cs), cy = Math.floor((py - this.oy) / this.ch);
    return { x: cx, y: cy, ok: this.B && this.B.map.inb(cx, cy) };
  };
  R.clientToLogical = function (cx, cy) {
    const r = this.cv.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * this.W, y: (cy - r.top) / r.height * this.H };
  };
  R.wolfAt = function (px, py) {
    const B = this.B; if (!B) return null;
    let best = null, bd = Infinity;
    for (const w of B.wolves) {
      if (!w.alive) continue;
      const wx = this.ox + w.x * this.cs, wy = this.oy + (w.y + 0.05) * this.ch - (w.fly ? this.cs * 0.4 : 0) - this.cs * 0.28;
      const d = Math.hypot(px - wx, py - wy);
      if (d < this.cs * 0.5 * w.def.size + this.cs * 0.25 && d < bd) { bd = d; best = w; }
    }
    return best;
  };

  R.draw = function (t, ui) {
    const B = this.B, ctx = this.ctx; if (!B) return;
    ui = ui || {};
    this.t = t;
    const s = this.scale, cs = this.cs, ox = this.ox, oy = this.oy;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = this.backdrop || '#20301a'; ctx.fillRect(0, 0, this.W, this.H);
    // 背景
    ctx.drawImage(this.bg.canvas, this.bgX, this.bgY, this.bg.W, this.bg.H);
    // 此后都在「格子压扁」的世界坐标里：y 沿 oy 压成 ay 倍（射程圈自然变成椭圆，与原作一致）
    ctx.save(); ctx.translate(0, oy); ctx.scale(1, this.ay); ctx.translate(0, -oy);
    // 动态地形
    ctx.save(); ctx.translate(this.bgX, this.bgY);
    Art.drawAnimated(ctx, { cs, ch: this.ch, ay: this.ay, ox: this.bg.ox, oy: this.bg.oy, anim: this.bg.anim, reg: this.bg.reg }, B.map, t);
    ctx.restore();
    // 格线（建造模式加强）
    if (ui.ghost || ui.showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
      for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
        const i = r * B.cols + c;
        if (B.map.buildableBase(i) && !B.occ[i]) {
          ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(ox + c * cs + 1, oy + r * cs + 1, cs - 2, cs - 2);
          ctx.strokeRect(ox + c * cs + 0.5, oy + r * cs + 0.5, cs - 1, cs - 1);
        }
      }
    }
    // 走狼路线提示
    if (ui.showPath) this.drawPaths(ctx, B);
    // 选中射程
    if (ui.selected && ui.selected.kind === 'tower') this.drawRange(ctx, B, ui.selected, true);
    if (ui.hoverB && ui.hoverB.kind === 'tower' && ui.hoverB !== ui.selected) this.drawRange(ctx, B, ui.hoverB, false);
    // 收集可绘制对象
    const items = [];
    for (const b of B.buildings) items.push({ y: (b.y + 1) * cs, kind: 'b', o: b });
    for (const w of B.wolves) if (w.alive) items.push({ y: (w.y + 0.3) * cs + (w.fly ? 4 * cs : 0), kind: 'w', o: w });
    for (const f of B.fx) if (f.type === 'die' && f.def && Art.drawWolfDeath) items.push({ y: (f.y + 0.3) * cs - 1, kind: 'd', o: f });   // 死亡动画跟活着的狼一起按前后排序
    // 守村的羊：站在羊村口旁边，狼漏怪时会吓哭，通关后欢呼
    if (this._lkB !== B) { this._lkB = B; this._lk = B.stats.leaks; this.scareUntil = 0; }
    if (B.stats.leaks > this._lk) this.scareUntil = t + 2.4;
    this._lk = B.stats.leaks;
    const mood = B.over ? (B.win ? 'happy' : 'cry') : (t < this.scareUntil ? 'scared' : 'idle');
    this.sheepSpots(B).forEach((o, k) => items.push({ y: (o.gy + 0.05) * cs, kind: 's', o: Object.assign({ k }, o) }));
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.kind === 'b') this.drawBuilding(ctx, B, it.o, t, ui);
      else if (it.kind === 'd') {
        const f = it.o, px = ox + f.x * cs, py = oy + (f.y + 0.3 + (f.lane || 0) * 0.6) * cs;
        this.upright(ctx, py, () => { f.drawn = Art.drawWolfDeath(ctx, f, px, py, cs); });
      } else if (it.kind === 's') {
        const o = it.o, sx = ox + o.gx * cs, sy = oy + o.gy * cs;
        this.upright(ctx, sy, () => Art.drawSheep(ctx, sx, sy, cs * 0.62, t + o.k * 1.7, { mood, bell: true, dir: 1, speed: mood === 'scared' ? 9 : 3 }));
      } else {
        const w = it.o;
        const lane = w.lane || 0;
        const px = ox + w.x * cs, py = oy + (w.y + 0.3 + lane * 0.6) * cs;
        this.upright(ctx, py, () => Art.drawWolf(ctx, w, px, py, cs, t, ui.focus === w.uid));
      }
    }
    // 弹道
    this.drawProjs(ctx, B, t);
    // 特效
    this.drawFx(ctx, B, t);
    // 狼的台词气泡（js/wolf_talk.js）
    if (global.SV && SV.WolfTalk) SV.WolfTalk.draw(ctx, this);
    // 预览 ghost
    if (ui.ghost && ui.hover && ui.hover.ok) this.drawGhost(ctx, B, ui, t);
    // 选中框
    if (ui.selected) {
      const b = ui.selected;
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 20;
      ctx.strokeRect(ox + b.x * cs + 2, oy + b.y * cs + 2, cs - 4, cs - 4); ctx.setLineDash([]);
    }
    // 浮动文字
    for (const f of B.floats) {
      const k = f.t / f.ttl;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = 'bold ' + Math.round(cs * (f.crit ? 0.34 : 0.26)) + 'px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center';
      const px = ox + f.x * cs, py = oy + (f.y - k * 0.6) * cs;
      this.upright(ctx, py, () => {
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.9)'; ctx.strokeText(f.text, px, py);
        ctx.fillStyle = f.crit ? '#ffe14a' : '#ffffff'; ctx.fillText(f.text, px, py);
      });
      ctx.globalAlpha = 1;
    }
    ctx.restore();          // 结束「压扁」坐标系
    // 出怪口/羊村标签
    // 阴影渐晕
    if (ui.dim) { ctx.fillStyle = 'rgba(0,0,0,' + ui.dim + ')'; ctx.fillRect(0, 0, this.W, this.H); }
  };

  /* 守村的羊站在哪：把相邻的羊村格连成一片（第 5/12 关是 3×3 的大村子），
     每片站 1~3 只，排在最靠下那一行——像站在村口。返回格子单位的 {gx 中心, gy 脚底}。 */
  R.sheepSpots = function (B) {
    if (B._sheepSpots) return B._sheepSpots;
    const map = B.map, cols = map.cols, isGoal = new Set(map.goals), seen = new Set(), spots = [];
    for (const g0 of map.goals) {
      if (seen.has(g0)) continue;
      const comp = [], st = [g0]; seen.add(g0);
      while (st.length) {
        const u = st.pop(); comp.push(u);
        const ux = u % cols, uy = (u / cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = ux + dx, y = uy + dy; if (x < 0 || y < 0 || x >= cols || y >= map.rows) continue;
          const j = y * cols + x; if (isGoal.has(j) && !seen.has(j)) { seen.add(j); st.push(j); }
        }
      }
      const by = Math.max.apply(null, comp.map(u => (u / cols) | 0));
      const row = comp.filter(u => ((u / cols) | 0) === by).map(u => u % cols).sort((a, b) => a - b);
      const pick = row.length >= 3 ? [row[0], row[(row.length - 1) >> 1], row[row.length - 1]] : row.length === 2 ? [row[0], row[1]] : [row[0]];
      pick.forEach(cx => spots.push({ gx: cx + 0.5, gy: by + 0.92 }));
    }
    return (B._sheepSpots = spots.slice(0, 6));
  };

  R.drawPaths = function (ctx, B) {
    const cs = this.cs, ox = this.ox, oy = this.oy;
    ctx.save(); ctx.strokeStyle = 'rgba(255,90,60,0.75)'; ctx.lineWidth = Math.max(2, cs * 0.07); ctx.setLineDash([cs * 0.16, cs * 0.14]); ctx.lineDashOffset = -this.t * 18; ctx.lineJoin = 'round';
    for (const s of B.map.spawns) {
      let c = s, guard = 0; ctx.beginPath(); ctx.moveTo(ox + (c % B.cols + 0.5) * cs, oy + ((c / B.cols | 0) + 0.5) * cs);
      while (c >= 0 && guard++ < 400) { const n = B.field.nxt[c]; if (n < 0) break; ctx.lineTo(ox + (n % B.cols + 0.5) * cs, oy + ((n / B.cols | 0) + 0.5) * cs); c = n; if (B.map.type[c] === 5) { ctx.moveTo(ox + (c % B.cols + 0.5) * cs, oy + ((c / B.cols | 0) + 0.5) * cs); } }
      ctx.stroke();
    }
    // 飞行路线
    ctx.strokeStyle = 'rgba(120,200,255,0.6)';
    for (const s of B.map.spawns) {
      let bg = -1, bd = Infinity; const sx = s % B.cols + 0.5, sy = (s / B.cols | 0) + 0.5;
      for (const g of B.map.goals) { const gx = g % B.cols + 0.5, gy = (g / B.cols | 0) + 0.5, d = Math.hypot(gx - sx, gy - sy); if (d < bd) { bd = d; bg = g; } }
      if (bg < 0) continue;
      ctx.beginPath(); ctx.moveTo(ox + sx * cs, oy + sy * cs); ctx.lineTo(ox + (bg % B.cols + 0.5) * cs, oy + ((bg / B.cols | 0) + 0.5) * cs); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();
  };

  R.drawRange = function (ctx, B, b, strong) {
    const cs = this.cs, st = B.towerStats(b);
    if (st.idle) return;
    const cx = this.ox + (b.x + 0.5) * cs, cy = this.oy + (b.y + 0.5) * cs, r = st.range * cs;
    const col = st.cname ? SV.GEM_COLORS[SV.CID.indexOf(st.cname)].hex : '#ffffff';
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (st.minRange) ctx.arc(cx, cy, st.minRange * cs, 0, Math.PI * 2, true);
    ctx.fillStyle = Art.alpha(col === '#3a3a3a' ? '#9a9aff' : col, strong ? 0.16 : 0.09); ctx.fill('evenodd');
    ctx.lineWidth = strong ? 2.5 : 1.5; ctx.strokeStyle = Art.alpha(col === '#3a3a3a' ? '#b3b3ff' : col, strong ? 0.9 : 0.5); ctx.stroke();
    if (st.kind === 'beam') { ctx.strokeStyle = 'rgba(127,227,255,0.4)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(cx, cy, st.beamLen * cs, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  };

  R.drawBuilding = function (ctx, B, b, t, ui) {
    const cs = this.cs, cx = this.ox + (b.x + 0.5) * cs, cy = this.oy + (b.y + 0.5) * cs;
    this.upright(ctx, cy, () => {
      if (b.kind === 'tower') Art.drawTower(ctx, b, cs, cx, cy, t, {sel: ui.selected === b || ui.hoverB === b});
      else if (b.kind === 'wall') { Art.drawWall(ctx, cs, cx, cy); if (b.bomb) Art.drawBomb(ctx, cs, cx, cy, b.bomb.arm <= 0, t); }
      else if (b.kind === 'statue') Art.drawStatue(ctx, b.sid, cs, cx, cy, t);
      else if (b.kind === 'trap') Art.drawTrap(ctx, b.tid, cs, cx, cy, b.cd <= 0);
    });
    // 雕像光环提示
    if (b.kind === 'statue' && b.sid !== 'lantern' && ui.selected === b) {
      ctx.fillStyle = 'rgba(255,220,100,0.16)';
      for (const [dx, dy] of [[1, 0], [2, 0], [-1, 0], [-2, 0], [0, 1], [0, 2], [0, -1], [0, -2]]) ctx.fillRect(this.ox + (b.x + dx) * cs + 2, this.oy + (b.y + dy) * cs + 2, cs - 4, cs - 4);
    }
  };

  R.drawGhost = function (ctx, B, ui, t) {
    const cs = this.cs, g = ui.ghost, h = ui.hover;
    const valid = ui.ghostValid;
    const cx = this.ox + (h.x + 0.5) * cs, cy = this.oy + (h.y + 0.5) * cs;
    ctx.save();
    ctx.globalAlpha = valid ? 0.85 : 0.4;
    if (g.kind === 'tower') {
      const fake = { type: g.type, lv: g.lv, gem: g.gem, id: 0, aim: -0.4, disT: 0 };
      // 射程
      const fb = Object.assign({ aura: B.auraAt(h.x, h.y), x: h.x, y: h.y, kind: 'tower' }, fake);
      const st = B.towerStats(fb);
      const r = st.range * cs;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); if (st.minRange) ctx.arc(cx, cy, st.minRange * cs, 0, Math.PI * 2, true);
      ctx.fillStyle = valid ? 'rgba(255,255,255,0.14)' : 'rgba(255,60,60,0.12)'; ctx.fill('evenodd');
      ctx.lineWidth = 2; ctx.strokeStyle = valid ? 'rgba(255,255,255,0.7)' : 'rgba(255,80,80,0.8)'; ctx.stroke();
      this.upright(ctx, cy, () => Art.drawTower(ctx, fb, cs, cx, cy, t, { mini: true }));
    } else if (g.kind === 'wall') this.upright(ctx, cy, () => Art.drawWall(ctx, cs, cx, cy));
    else if (g.kind === 'bomb') {
      const wb = B.buildingAt(h.x, h.y);
      if (wb && wb.kind === 'wall') this.upright(ctx, cy, () => { Art.drawWall(ctx, cs, cx, cy); Art.drawBomb(ctx, cs, cx, cy, false, t); });
      ctx.beginPath(); ctx.arc(cx, cy, SV.BOMB.r * cs, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,170,40,0.12)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,170,40,0.7)'; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    else if (g.kind === 'statue') this.upright(ctx, cy, () => Art.drawStatue(ctx, g.sid, cs, cx, cy, t));
    else if (g.kind === 'trap') this.upright(ctx, cy, () => Art.drawTrap(ctx, g.tid, cs, cx, cy, true));
    ctx.restore();
    if (!valid) { ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(this.ox + h.x * cs + 1, this.oy + h.y * cs + 1, cs - 2, cs - 2); }
    else { ctx.strokeStyle = 'rgba(120,255,140,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(this.ox + h.x * cs + 1, this.oy + h.y * cs + 1, cs - 2, cs - 2); }
  };

  R.drawProjs = function (ctx, B, t) {
    const cs = this.cs, ox = this.ox, oy = this.oy, F = Art.origFx;
    for (const p of B.projs) {
      if (F && F.proj(ctx, p, this, t)) continue;        // 原作子弹（js/art_fx_original.js）；没素材才画下面的程序化版本
      if (p.kind === 'bolt') {
        if (p.delay > 0) continue;
        const x = ox + p.x * cs, y = oy + p.y * cs;
        const rot = p.rot || 0;
        if (p.b && p.b.type === 'inlay' && Art.orb) {          // 镶嵌塔：宝石色的大光点（关掉原作特效时也是它）
          const oa = Math.atan2(Math.sin(rot) * this.ay, Math.cos(rot));
          this.upright(ctx, y, () => Art.orb(ctx, x, y, cs, p.color, oa, t, (p.b.id || 0) * 1.7));
          continue;
        }
        ctx.strokeStyle = Art.alpha(p.color === '#3a3a3a' ? '#9a7aff' : p.color, 0.5); ctx.lineWidth = Math.max(2, cs * 0.07); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - Math.cos(rot) * cs * 0.28, y - Math.sin(rot) * cs * 0.28); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = p.st.cname ? (p.color === '#3a3a3a' ? '#c9b3ff' : p.color) : '#fff7d0'; ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, cs * 0.075), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
      } else if (p.kind === 'shell') {
        const k = p.t / p.dur;
        const x = ox + (p.sx + (p.tx - p.sx) * k) * cs, gy = oy + (p.sy + (p.ty - p.sy) * k) * cs;
        const h = Math.sin(k * Math.PI) * p.hi * cs;
        ell2(ctx, x, gy, cs * 0.12, cs * 0.05, 'rgba(0,0,0,0.25)');
        ctx.beginPath(); ctx.arc(x, gy - h, Math.max(3, cs * 0.11), 0, Math.PI * 2); ctx.fillStyle = p.st.cname ? (p.st.cname === 'hei' ? '#555' : SV.GEM_COLORS[SV.CID.indexOf(p.st.cname)].hex) : '#2a2d33'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - cs * 0.03, gy - h - cs * 0.03, cs * 0.03, 0, 7); ctx.fill();
      }
    }
  };
  function ell2(ctx, x, y, rx, ry, f) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = f; ctx.fill(); }

  R.drawFx = function (ctx, B, t) {
    const cs = this.cs, ox = this.ox, oy = this.oy, F = Art.origFx;
    for (const f of B.fx) {
      const k = f.t / f.ttl, a = 1 - k;
      if (F && F.fx(ctx, f, this, t)) continue;          // 原作特效已画好
      switch (f.type) {
        case 'hit': {          // 命中火花（没有原作素材时的替身）
          const x = ox + f.x * cs, y = oy + (f.y + 0.05) * cs, r = cs * (0.1 + 0.16 * k);
          ctx.strokeStyle = f.crit ? 'rgba(255,225,74,' + a + ')' : 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'boss': break;
        case 'flash': {
          const r = f.r * cs * (0.3 + 0.7 * k);
          const g = ctx.createRadialGradient(ox + f.x * cs, oy + f.y * cs, 0, ox + f.x * cs, oy + f.y * cs, r);
          g.addColorStop(0, 'rgba(255,240,150,' + (0.5 * a) + ')'); g.addColorStop(0.85, 'rgba(255,225,90,' + (0.25 * a) + ')'); g.addColorStop(1, 'rgba(255,225,90,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox + f.x * cs, oy + f.y * cs, r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,240,140,' + a + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ox + f.x * cs, oy + f.y * cs, r, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'beam': {
          ctx.lineCap = 'round';
          ctx.strokeStyle = Art.alpha(f.color === '#3a3a3a' ? '#a68aff' : f.color, 0.35 * a); ctx.lineWidth = cs * 0.5 * a + 2;
          ctx.beginPath(); ctx.moveTo(ox + f.x1 * cs, oy + f.y1 * cs); ctx.lineTo(ox + f.x2 * cs, oy + f.y2 * cs); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * a) + ')'; ctx.lineWidth = cs * 0.14 * a + 1;
          ctx.beginPath(); ctx.moveTo(ox + f.x1 * cs, oy + f.y1 * cs); ctx.lineTo(ox + f.x2 * cs, oy + f.y2 * cs); ctx.stroke();
          break;
        }
        case 'arc': {
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            for (let j = 0; j < f.pts.length - 1; j++) {
              const [x1, y1] = f.pts[j], [x2, y2] = f.pts[j + 1];
              const segs = 5;
              for (let s = 0; s <= segs; s++) {
                const u = s / segs, jx = (s > 0 && s < segs ? (Math.sin(f.t * 90 + s * 7 + j * 3) * 0.08) : 0), jy = (s > 0 && s < segs ? (Math.cos(f.t * 80 + s * 5 + j) * 0.08) : 0);
                const px = ox + (x1 + (x2 - x1) * u + jx) * cs, py = oy + (y1 + (y2 - y1) * u + jy) * cs;
                if (j === 0 && s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
              }
            }
            ctx.strokeStyle = pass ? 'rgba(255,255,255,' + a + ')' : Art.alpha(f.color, 0.8 * a); ctx.lineWidth = pass ? Math.max(1, cs * 0.04) : cs * (f.thick ? 0.14 : 0.1); ctx.stroke();
          }
          break;
        }
        case 'boom': {
          const r = f.r * cs * (0.35 + 0.65 * Math.sqrt(k));
          const g = ctx.createRadialGradient(ox + f.x * cs, oy + f.y * cs, r * 0.1, ox + f.x * cs, oy + f.y * cs, r);
          g.addColorStop(0, Art.alpha(f.color === '#3a3a3a' ? '#9a7aff' : f.color, 0.7 * a)); g.addColorStop(1, Art.alpha(f.color === '#3a3a3a' ? '#9a7aff' : f.color, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox + f.x * cs, oy + f.y * cs, r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * a) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + f.x * cs, oy + f.y * cs, r * 0.8, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = Art.alpha(f.color || '#ffffff', a); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(ox + f.x * cs, oy + (f.y + 0.1) * cs, cs * (0.2 + k * 0.8), cs * (0.14 + k * 0.5), 0, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'coin': {
          const x = ox + f.x * cs, y = oy + (f.y - 0.2 - k * 0.7) * cs;
          ctx.globalAlpha = Math.min(1, a * 2);
          this.upright(ctx, y, () => {
            Art.coin(ctx, x - cs * 0.15, y, cs * 0.11);
            ctx.font = 'bold ' + Math.round(cs * 0.22) + 'px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.9)';
            ctx.strokeText('+' + SV.fmt(f.n), x - cs * 0.02, y + cs * 0.07); ctx.fillStyle = '#ffe27a'; ctx.fillText('+' + SV.fmt(f.n), x - cs * 0.02, y + cs * 0.07);
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'die': {
          if (f.drawn) break;              // 原作死亡动画已经画过了
          const x = ox + f.x * cs, y = oy + (f.y + 0.1) * cs;
          for (let j = 0; j < 6; j++) { const ang = j / 6 * Math.PI * 2 + 0.4, d = k * cs * 0.55 * f.size; ell2(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.7 - cs * 0.2, cs * 0.12 * (1 - k) * f.size, cs * 0.12 * (1 - k) * f.size, 'rgba(240,240,240,' + a * 0.8 + ')'); }
          ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.font = Math.round(cs * 0.3 * f.size) + 'px sans-serif'; ctx.textAlign = 'center';
          this.upright(ctx, y, () => ctx.fillText('✦', x, y - cs * 0.3 - k * cs * 0.3));
          break;
        }
        case 'blink': case 'tele': {
          const x = ox + f.x * cs, y = oy + (f.y - 0.2) * cs;
          ctx.strokeStyle = f.type === 'tele' ? 'rgba(90,170,255,' + a + ')' : 'rgba(200,160,255,' + a + ')'; ctx.lineWidth = 3;
          for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.ellipse(x, y, cs * (0.15 + k * 0.5 + j * 0.15), cs * (0.25 + k * 0.4 + j * 0.1), 0, 0, Math.PI * 2); ctx.stroke(); }
          break;
        }
        case 'dust': {
          const x = ox + f.x * cs, y = oy + (f.y + 0.2) * cs;
          for (let j = 0; j < 3; j++) ell2(ctx, x - (j + 1) * cs * 0.15 * k * 2, y - j * cs * 0.02, cs * 0.09 * (1 - k), cs * 0.07 * (1 - k), 'rgba(210,190,150,' + a + ')');
          break;
        }
        case 'curse': {
          const x = ox + f.x * cs, y = oy + f.y * cs;
          const r = cs * 1.6 * (0.3 + k * 0.7);
          ctx.strokeStyle = 'rgba(160,90,255,' + a + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(80,30,130,' + (a * 0.3) + ')'; ctx.fill();
          break;
        }
        case 'leak': {
          const x = ox + f.x * cs, y = oy + (f.y - k * 0.6) * cs;
          ctx.globalAlpha = a; ctx.fillStyle = '#ff5a4a'; ctx.font = 'bold ' + Math.round(cs * 0.34) + 'px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,10,10,0.9)';
          this.upright(ctx, y, () => { ctx.strokeText('漏！', x, y); ctx.fillText('漏！', x, y); }); ctx.globalAlpha = 1;
          break;
        }
      }
      if (F && F.fxOver) F.fxOver(ctx, f, this, t);      // 程序化线条画完后再叠的原作精灵（电弧落点的电光）
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
