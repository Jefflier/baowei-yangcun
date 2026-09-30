/* ============================================================
 * 美术 A：地形 / 装饰 / 羊村（全部使用 Canvas 程序化绘制）
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV;
  const Art = SV.Art = SV.Art || {};

  /* ---------- 颜色工具 ---------- */
  function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  Art.shade = function (hex, f) {
    const [r, g, b] = hex2rgb(hex);
    const t = f < 0 ? 0 : 255, p = Math.abs(f);
    return 'rgb(' + Math.round((t - r) * p + r) + ',' + Math.round((t - g) * p + g) + ',' + Math.round((t - b) * p + b) + ')';
  };
  Art.alpha = function (hex, a) { const [r, g, b] = hex2rgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  Art.OUT = '#3a2616';
  const OUT = Art.OUT;
  Art.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  const rr = Art.rr;
  Art.ell = function (ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  const ell = Art.ell;
  Art.mkCanvas = function (w, h) {
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
    return null;
  };

  /* ---------- 主题调色板 ---------- */
  const THEMES = {
    grass: { outer: '#8ec73e', outer2: '#7cb432', ground: '#efdc8f', ground2: '#e8d283', edge: '#a88a45', deco: 'tree' },
    river: { outer: '#8ec73e', outer2: '#7cb432', ground: '#efdc8f', ground2: '#e8d283', edge: '#a88a45', deco: 'tree' },
    desert: { outer: '#e9b455', outer2: '#dca442', ground: '#f6dea0', ground2: '#eed38e', edge: '#b58a3e', deco: 'palm' },
    canyon: { outer: '#b58c5a', outer2: '#a37b4c', ground: '#dcc08f', ground2: '#d3b57f', edge: '#7b5a35', deco: 'rock' },
    ruins: { outer: '#8bbf47', outer2: '#79ab39', ground: '#e6d9a3', ground2: '#ddcf95', edge: '#9a8646', deco: 'tree' },
    swamp: { outer: '#5e7f3d', outer2: '#4e6c31', ground: '#b5ac72', ground2: '#a9a066', edge: '#5d5730', deco: 'dead' },
    mine: { outer: '#75706c', outer2: '#67625e', ground: '#c9b797', ground2: '#bfad8c', edge: '#5a4a3a', deco: 'rock' },
    volcano: { outer: '#4d332f', outer2: '#412b28', ground: '#9a6448', ground2: '#8f5a41', edge: '#2a1712', deco: 'lava' },
    snow: { outer: '#e9f3f9', outer2: '#d9e8f1', ground: '#fbfdff', ground2: '#e9f3f9', edge: '#98b3c7', deco: 'pine' },
    beach: { outer: '#46b3da', outer2: '#3aa3cb', ground: '#f6e4aa', ground2: '#eed99a', edge: '#b59a55', deco: 'palm' },
    factory: { outer: '#7a838d', outer2: '#6b747e', ground: '#bcc2c9', ground2: '#b1b8c0', edge: '#464d55', deco: 'machine' },
    forest: { outer: '#4c9438', outer2: '#3f8330', ground: '#dbc98a', ground2: '#d1bf7d', edge: '#7a6a35', deco: 'tree' },
    town: { outer: '#8ec73e', outer2: '#7cb432', ground: '#dccca4', ground2: '#d2c197', edge: '#8a7a55', deco: 'tree' }
  };
  Art.THEMES = THEMES;

  /* ---------- 装饰物 ---------- */
  function tree(ctx, x, y, s, h, kind) {
    // (x,y) 为树根中心，s 为格子尺寸
    const sc = s * (0.85 + h * 0.35);
    const cols = kind === 1 ? ['#f0b429', '#d98d1f', '#ffd35a'] : kind === 2 ? ['#b5c92a', '#94a81f', '#d2e455'] : ['#4ea52c', '#2f7a1e', '#7ed44a'];
    ell(ctx, x, y + sc * 0.05, sc * 0.42, sc * 0.14, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = '#7a4e2a'; rr(ctx, x - sc * 0.07, y - sc * 0.32, sc * 0.14, sc * 0.36, sc * 0.03); ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = OUT; ctx.stroke();
    const blobs = [[0, -0.62, 0.36], [-0.24, -0.46, 0.28], [0.24, -0.46, 0.28], [0, -0.42, 0.3]];
    for (const [dx, dy, r] of blobs) { ell(ctx, x + dx * sc, y + dy * sc, r * sc, r * sc * 0.92, cols[1], OUT, Math.max(1, s * 0.03)); }
    for (const [dx, dy, r] of blobs) { ell(ctx, x + dx * sc - r * sc * 0.08, y + dy * sc - r * sc * 0.1, r * sc * 0.82, r * sc * 0.74, cols[0]); }
    ell(ctx, x - sc * 0.08, y - sc * 0.7, sc * 0.16, sc * 0.1, cols[2]);
  }
  function palm(ctx, x, y, s, h) {
    const sc = s * (0.9 + h * 0.3);
    ell(ctx, x, y + sc * 0.04, sc * 0.3, sc * 0.1, 'rgba(0,0,0,0.16)');
    ctx.strokeStyle = OUT; ctx.lineWidth = sc * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sc * 0.12, y - sc * 0.4, x + sc * 0.05, y - sc * 0.75); ctx.stroke();
    ctx.strokeStyle = '#a06a3a'; ctx.lineWidth = sc * 0.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sc * 0.12, y - sc * 0.4, x + sc * 0.05, y - sc * 0.75); ctx.stroke();
    const tx = x + sc * 0.05, ty = y - sc * 0.75;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.62;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sc * 0.18, -sc * 0.34, sc * 0.02, -sc * 0.5); ctx.quadraticCurveTo(-sc * 0.18, -sc * 0.3, 0, 0);
      ctx.fillStyle = k % 2 ? '#3f9a2a' : '#5cbb36'; ctx.fill(); ctx.lineWidth = Math.max(1, sc * 0.03); ctx.strokeStyle = OUT; ctx.stroke();
      ctx.restore();
    }
    ell(ctx, tx + sc * 0.05, ty + sc * 0.06, sc * 0.05, sc * 0.05, '#7a4e2a', OUT, 1);
  }
  function pine(ctx, x, y, s, h) {
    const sc = s * (0.85 + h * 0.35);
    ell(ctx, x, y + sc * 0.04, sc * 0.34, sc * 0.11, 'rgba(60,90,120,0.2)');
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - sc * 0.05, y - sc * 0.2, sc * 0.1, sc * 0.24);
    for (let k = 0; k < 3; k++) {
      const by = y - sc * (0.16 + k * 0.28), w = sc * (0.46 - k * 0.1), hh = sc * 0.42;
      ctx.beginPath(); ctx.moveTo(x - w, by); ctx.lineTo(x, by - hh); ctx.lineTo(x + w, by); ctx.closePath();
      ctx.fillStyle = k % 2 ? '#2f8a58' : '#3a9a64'; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - w * 0.72, by - hh * 0.28); ctx.lineTo(x, by - hh); ctx.lineTo(x + w * 0.72, by - hh * 0.28);
      ctx.quadraticCurveTo(x + w * 0.3, by - hh * 0.4, x, by - hh * 0.3); ctx.quadraticCurveTo(x - w * 0.3, by - hh * 0.4, x - w * 0.72, by - hh * 0.28);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
  }
  function rock(ctx, x, y, s, h, col) {
    const sc = s * (0.7 + h * 0.5);
    col = col || '#9aa0a8';
    ell(ctx, x, y + sc * 0.04, sc * 0.44, sc * 0.13, 'rgba(0,0,0,0.2)');
    ctx.beginPath(); ctx.moveTo(x - sc * 0.42, y); ctx.lineTo(x - sc * 0.34, y - sc * 0.34); ctx.lineTo(x - sc * 0.1, y - sc * 0.56); ctx.lineTo(x + sc * 0.18, y - sc * 0.5);
    ctx.lineTo(x + sc * 0.42, y - sc * 0.2); ctx.lineTo(x + sc * 0.4, y); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.035); ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - sc * 0.3, y - sc * 0.32); ctx.lineTo(x - sc * 0.1, y - sc * 0.52); ctx.lineTo(x + sc * 0.16, y - sc * 0.46); ctx.lineTo(x + sc * 0.0, y - sc * 0.3); ctx.closePath();
    ctx.fillStyle = Art.shade(col, 0.28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + sc * 0.0, y - sc * 0.3); ctx.lineTo(x + sc * 0.16, y - sc * 0.46); ctx.lineTo(x + sc * 0.4, y - sc * 0.2); ctx.lineTo(x + sc * 0.38, y - sc * 0.02); ctx.lineTo(x + sc * 0.1, y - sc * 0.06); ctx.closePath();
    ctx.fillStyle = Art.shade(col, -0.18); ctx.fill();
  }
  function deadTree(ctx, x, y, s, h) {
    const sc = s * (0.9 + h * 0.3);
    ell(ctx, x, y + sc * 0.04, sc * 0.3, sc * 0.1, 'rgba(0,0,0,0.2)');
    ctx.strokeStyle = OUT; ctx.lineCap = 'round';
    const br = [[0, 0, 0, -0.5, 0.14], [0, -0.35, -0.28, -0.62, 0.09], [0, -0.42, 0.26, -0.7, 0.09], [-0.15, -0.5, -0.32, -0.42, 0.06], [0.14, -0.55, 0.32, -0.5, 0.06]];
    for (const pass of [1, 0]) for (const [x1, y1, x2, y2, w] of br) {
      ctx.lineWidth = sc * w + (pass ? sc * 0.05 : 0); ctx.strokeStyle = pass ? OUT : '#6a5238';
      ctx.beginPath(); ctx.moveTo(x + x1 * sc, y + y1 * sc); ctx.lineTo(x + x2 * sc, y + y2 * sc); ctx.stroke();
    }
    ell(ctx, x - sc * 0.32, y - sc * 0.5, sc * 0.14, sc * 0.06, '#6f8f3a'); ell(ctx, x + sc * 0.3, y - sc * 0.72, sc * 0.12, sc * 0.05, '#6f8f3a');
  }
  function cactus(ctx, x, y, s, h) {
    const sc = s * (0.8 + h * 0.3);
    ell(ctx, x, y + sc * 0.04, sc * 0.3, sc * 0.09, 'rgba(0,0,0,0.16)');
    const g = '#4faa3a';
    rr(ctx, x - sc * 0.1, y - sc * 0.62, sc * 0.2, sc * 0.66, sc * 0.1); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = OUT; ctx.stroke();
    rr(ctx, x - sc * 0.32, y - sc * 0.46, sc * 0.16, sc * 0.3, sc * 0.08); ctx.fill(); ctx.stroke();
    rr(ctx, x + sc * 0.16, y - sc * 0.36, sc * 0.16, sc * 0.26, sc * 0.08); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e94a6b'; ell(ctx, x, y - sc * 0.64, sc * 0.06, sc * 0.05, '#f06a8c');
  }
  function iceSpike(ctx, x, y, s, h) {
    const sc = s * (0.7 + h * 0.5);
    ell(ctx, x, y + sc * 0.04, sc * 0.4, sc * 0.12, 'rgba(40,80,120,0.2)');
    const sp = [[-0.2, 0.34, 0.5], [0.05, 0.3, 0.75], [0.26, 0.28, 0.42]];
    for (const [dx, w, hh] of sp) {
      ctx.beginPath(); ctx.moveTo(x + dx * sc - w * sc * 0.5, y); ctx.lineTo(x + dx * sc, y - hh * sc); ctx.lineTo(x + dx * sc + w * sc * 0.5, y); ctx.closePath();
      const g = ctx.createLinearGradient(x + dx * sc - 10, y - hh * sc, x + dx * sc + 10, y);
      g.addColorStop(0, '#dff6ff'); g.addColorStop(1, '#7cc6ee'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = '#2a5e86'; ctx.stroke();
    }
  }
  function lavaRock(ctx, x, y, s, h) {
    rock(ctx, x, y, s, h, '#5a3a34');
    const sc = s * (0.7 + h * 0.5);
    ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - sc * 0.15, y - sc * 0.12); ctx.lineTo(x - sc * 0.02, y - sc * 0.32); ctx.lineTo(x + sc * 0.12, y - sc * 0.22); ctx.stroke();
  }
  function machine(ctx, x, y, s, h, k) {
    const sc = s * (0.85 + h * 0.2);
    ell(ctx, x, y + sc * 0.04, sc * 0.44, sc * 0.12, 'rgba(0,0,0,0.22)');
    if (k < 0.34) { // 箱子
      rr(ctx, x - sc * 0.4, y - sc * 0.55, sc * 0.8, sc * 0.55, sc * 0.05); ctx.fillStyle = '#c98a3e'; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.035); ctx.strokeStyle = OUT; ctx.stroke();
      ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(x - sc * 0.4, y - sc * 0.28); ctx.lineTo(x + sc * 0.4, y - sc * 0.28); ctx.moveTo(x, y - sc * 0.55); ctx.lineTo(x, y); ctx.stroke();
    } else if (k < 0.67) { // 油桶/管道
      rr(ctx, x - sc * 0.22, y - sc * 0.62, sc * 0.44, sc * 0.66, sc * 0.12); ctx.fillStyle = '#4c7bc4'; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.035); ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#e8eef8'; ctx.fillRect(x - sc * 0.22, y - sc * 0.42, sc * 0.44, sc * 0.06); ctx.fillRect(x - sc * 0.22, y - sc * 0.2, sc * 0.44, sc * 0.06);
    } else { // 齿轮
      ctx.save(); ctx.translate(x, y - sc * 0.32);
      ctx.fillStyle = '#8f98a3'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? sc * 0.28 : sc * 0.38; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ell(ctx, 0, 0, sc * 0.13, sc * 0.13, '#4c545c', OUT, 1); ctx.restore();
    }
  }
  function house(ctx, x, y, s, w, h, roof, wall) {
    // 以底边中心 (x,y) 绘制小屋，宽 w*s 高 h*s
    const W = w * s, H = h * s;
    ell(ctx, x, y + s * 0.03, W * 0.56, s * 0.1, 'rgba(0,0,0,0.2)');
    rr(ctx, x - W / 2, y - H * 0.55, W, H * 0.55, s * 0.04); ctx.fillStyle = wall || '#f6e7c1'; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.035); ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - W * 0.62, y - H * 0.5); ctx.lineTo(x, y - H); ctx.lineTo(x + W * 0.62, y - H * 0.5); ctx.closePath();
    ctx.fillStyle = roof || '#f08a1c'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - W * 0.4, y - H * 0.58); ctx.lineTo(x, y - H * 0.94); ctx.lineTo(x + W * 0.4, y - H * 0.58); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
    rr(ctx, x - W * 0.12, y - H * 0.34, W * 0.24, H * 0.34, s * 0.03); ctx.fillStyle = '#8a5a2a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke();
    rr(ctx, x + W * 0.22, y - H * 0.42, W * 0.18, H * 0.16, s * 0.02); ctx.fillStyle = '#9fdcf6'; ctx.fill(); ctx.stroke();
  }
  Art.house = house;

  Art.drawDeco = function (ctx, kind, x, y, s, hsh, hsh2) {
    const k2 = hsh2;
    switch (kind) {
      case 'tree': tree(ctx, x, y, s, hsh, hsh2 < 0.12 ? 1 : hsh2 < 0.22 ? 2 : 0); break;
      case 'palm': if (hsh2 < 0.18) cactus(ctx, x, y, s, hsh); else palm(ctx, x, y, s, hsh); break;
      case 'pine': if (hsh2 < 0.2) iceSpike(ctx, x, y, s, hsh); else pine(ctx, x, y, s, hsh); break;
      case 'rock': rock(ctx, x, y, s, hsh, hsh2 < 0.5 ? '#a99e8e' : '#8f959c'); break;
      case 'dead': if (hsh2 < 0.3) rock(ctx, x, y, s, hsh, '#7d7a66'); else deadTree(ctx, x, y, s, hsh); break;
      case 'lava': lavaRock(ctx, x, y, s, hsh); break;
      case 'machine': machine(ctx, x, y, s, hsh, hsh2); break;
    }
  };

  /* ---------- 地面砖 ---------- */
  function groundTile(ctx, x, y, s, th, ci, cj, seed) {
    ctx.fillStyle = ((ci + cj) & 1) ? th.ground : th.ground2;
    ctx.fillRect(x, y, s + 0.5, s + 0.5);
    // 纹理点缀
    const h1 = SV.hash2(ci, cj, seed), h2 = SV.hash2(cj, ci, seed + 7);
    if (h1 < 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ell(ctx, x + s * (0.2 + h1 * 0.6), y + s * (0.2 + h2 * 0.6), s * 0.04, s * 0.025, ctx.fillStyle);
    }
    if (h2 < 0.3) {
      ctx.strokeStyle = 'rgba(80,120,30,0.35)'; ctx.lineWidth = Math.max(1, s * 0.025);
      const px = x + s * (0.15 + h2 * 2), py = y + s * (0.3 + h1 * 0.5);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - s * 0.04, py - s * 0.08); ctx.moveTo(px, py); ctx.lineTo(px + s * 0.04, py - s * 0.09); ctx.stroke();
    }
  }

  function planks(ctx, x, y, s, horiz) {
    ctx.fillStyle = '#c08a4a'; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#7a5028'; ctx.lineWidth = Math.max(1, s * 0.03);
    const n = 5;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); if (horiz) { ctx.moveTo(x + s * i / n, y); ctx.lineTo(x + s * i / n, y + s); } else { ctx.moveTo(x, y + s * i / n); ctx.lineTo(x + s, y + s * i / n); } ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,230,180,0.25)';
    for (let i = 0; i < n; i++) { ctx.beginPath(); if (horiz) { ctx.moveTo(x + s * (i + 0.5) / n, y + 2); ctx.lineTo(x + s * (i + 0.5) / n, y + s - 2); } else { ctx.moveTo(x + 2, y + s * (i + 0.5) / n); ctx.lineTo(x + s - 2, y + s * (i + 0.5) / n); } ctx.stroke(); }
  }
  function steelGrate(ctx, x, y, s, hole) {
    ctx.fillStyle = hole ? '#20262c' : '#6a747f'; ctx.fillRect(x, y, s, s);
    if (hole) { ctx.strokeStyle = '#48525c'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeRect(x + 1, y + 1, s - 2, s - 2); ctx.fillStyle = '#0d1114'; ell(ctx, x + s / 2, y + s / 2, s * 0.32, s * 0.32, '#0d1114'); return; }
    ctx.strokeStyle = '#9aa5b0'; ctx.lineWidth = Math.max(1, s * 0.04);
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + s * i / 4, y); ctx.lineTo(x + s * i / 4, y + s); ctx.moveTo(x, y + s * i / 4); ctx.lineTo(x + s, y + s * i / 4); ctx.stroke(); }
    ctx.strokeStyle = '#2f373f'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
  }

  /* ---------- 整张背景 ---------- */
  // 返回 {canvas, cs, M, W, H, anim:[...]}
  /* 格子是 cs × ch 的长方形（ch = cs × 50/65，见 SV.CELL_AR）。
     地面瓦片/描边/格线这些「贴地」的东西按正方形画，再用 squash() 沿 y 压扁；
     树、房子、障碍这类直立的东西不压扁，只把摆放位置换成 oy + 行 × ch。
     opt = {W, H, ox, oy}：背景画布直接铺满整个战斗视口（原作底图比棋盘大得多），
     ox/oy 是棋盘左上角在画布里的位置。不给就退回「棋盘 + M 格边距」。 */
  function squash(ctx, oy, ay, fn) {
    ctx.save(); ctx.translate(0, oy); ctx.scale(1, ay); ctx.translate(0, -oy);
    fn(); ctx.restore();
  }
  Art.squash = squash;

  /* 峡谷：原作的「峡谷与桥」关（菲洛克村）里，深沟是游戏自己画的（底图 m5 只有沙地）。
     数据里沟两侧的「崖边」格带 feat=峡谷与桥（type 7），中间夹着的 type 0 格就是沟。 */
  function paintChasm(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#9a6a34'); g.addColorStop(0.12, '#5a3818'); g.addColorStop(0.3, '#2c190b'); g.addColorStop(0.7, '#2c190b');
    g.addColorStop(0.88, '#5a3818'); g.addColorStop(1, '#9a6a34');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,214,140,0.55)';                    // 两侧亮边（沙岩崖沿）
    ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);
    ctx.strokeStyle = 'rgba(20,10,4,0.5)'; ctx.lineWidth = 2;    // 崖壁纹路
    for (let k = 0; k < h; k += 11) { ctx.beginPath(); ctx.moveTo(x + 4, y + k); ctx.lineTo(x + w * 0.16, y + k + 5); ctx.moveTo(x + w - 4, y + k + 3); ctx.lineTo(x + w * 0.84, y + k + 8); ctx.stroke(); }
  }
  function chasmCells(map) {
    const out = [], cols = map.cols;
    for (let r = 0; r < map.rows; r++) {
      let c = 0;
      while (c < cols) {
        const i = r * cols + c;
        if (map.feat[i] && /峡谷与桥/.test(map.feat[i]) && c + 1 < cols && map.type[i + 1] === 0 && !map.feat[i + 1]) {
          let e = c + 1;
          while (e < cols && map.type[r * cols + e] === 0 && !map.feat[r * cols + e]) e++;
          if (e < cols && map.feat[r * cols + e] && /峡谷与桥/.test(map.feat[r * cols + e])) { for (let k = c + 1; k < e; k++) out.push([k, r]); c = e; continue; }
        }
        c++;
      }
    }
    return out;
  }

  Art.buildBackground = function (map, cs, scale, M, ch, opt) {
    M = M == null ? 1 : M;
    ch = ch || cs;
    const ay = ch / cs;
    let th = THEMES[map.theme] || THEMES.grass;
    const cols = map.cols, rows = map.rows;
    const W = opt ? opt.W : (cols + 2 * M) * cs, H = opt ? opt.H : (rows + 2 * M) * ch;
    const cv = Art.mkCanvas(W * scale, H * scale);
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    const seed = map.idx * 131 + 7;
    const ox = opt ? opt.ox : M * cs, oy = opt ? opt.oy : M * ch;
    const Mx = Math.ceil(ox / cs), My = Math.ceil(oy / ch);       // 画布上棋盘外还能摆多少格装饰

    // 1. 外围底色 + 花纹（有原作底图时改用原作装饰）
    const usedArt = !!(global.SVAMapArt && global.SVAMapArt.drawInto(ctx, map, cs, M, W, H, ch, {ox, oy}));
    const reg = usedArt && global.SVAMapArt.registered ? global.SVAMapArt.registered(map) : null;   // 标定过的原画：羊村/出怪台已烘在图里
    if (usedArt && global.SVAMapArt.field) {
      // 场地色跟着原作底图走，本作的格子才和底图接得上
      const fc = global.SVAMapArt.field(map);
      if (fc) {
        const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b);
          return '#' + A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join(''); };
        // 尽量贴近原画场地色；格子深浅只差一点点，避免出现原作没有的「棋盘格」
        const g1 = mix(fc, th.ground, 0.85);
        th = Object.assign({}, th, {ground: g1, ground2: Art.shade(g1, -0.045), edge: Art.shade(g1, -0.28)});
      }
    }
    if (!usedArt) {
      ctx.fillStyle = th.outer; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < Math.round((W / cs) * (H / ch) * 2); i++) {
        const hx = SV.hash2(i, 3, seed), hy = SV.hash2(i, 5, seed), hr = SV.hash2(i, 9, seed);
        ell(ctx, hx * W, hy * H, cs * (0.15 + hr * 0.3), cs * (0.08 + hr * 0.14), Art.alpha(th.outer2 === th.outer ? '#000000' : th.outer2, 0.55));
      }
      if (map.theme === 'beach') { // 海浪
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
        for (let i = 0; i < 60; i++) { const x = SV.hash2(i, 1, seed) * W, y = SV.hash2(i, 2, seed) * H; ctx.beginPath(); ctx.arc(x, y, cs * 0.2, Math.PI, 0); ctx.stroke(); }
      }
    }
    // 2. 可行走/建造区域
    const playable = (c, r) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
      const i = r * cols + c; const t = map.type[i];
      if (t === 0) return false;
      return true;
    };
    squash(ctx, oy, ay, () => {
    const chasm = chasmCells(map);
    if (chasm.length) {          // 同一列连续的沟格合成一条，渐变才连贯
      const byCol = {};
      for (const [c, r] of chasm) (byCol[c] = byCol[c] || []).push(r);
      const cs2 = Object.keys(byCol).map(Number).sort((a, b) => a - b);
      const x0 = cs2[0], x1 = cs2[cs2.length - 1];
      const rowsHit = {};
      for (const [c, r] of chasm) rowsHit[r] = 1;
      let r = 0;
      while (r < rows) {
        if (!rowsHit[r]) { r++; continue; }
        let e = r; while (e + 1 < rows && rowsHit[e + 1]) e++;
        paintChasm(ctx, ox + x0 * cs, oy + r * cs, (x1 - x0 + 1) * cs, (e - r + 1) * cs);
        r = e + 1;
      }
    }
    // 底部阴影（悬崖感）
    if (!reg) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!playable(c, r)) continue;
      ctx.fillStyle = Art.alpha(th.edge, 0.55);
      ctx.fillRect(ox + c * cs - 2, oy + r * cs - 2, cs + 4, cs + 5);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!playable(c, r)) continue;
      const i = r * cols + c, t = map.type[i], f = map.feat[i];
      const x = ox + c * cs, y = oy + r * cs;
      if (!reg) groundTile(ctx, x, y, cs, th, c, r, seed);
      if (t === 6) { // 特殊塔位
        ctx.fillStyle = '#a8adb5'; rr(ctx, x + cs * 0.06, y + cs * 0.06, cs * 0.88, cs * 0.88, cs * 0.12); ctx.fill(); ctx.strokeStyle = '#5a6068'; ctx.lineWidth = Math.max(1.5, cs * 0.04); ctx.stroke();
        ctx.fillStyle = '#c9ced6'; rr(ctx, x + cs * 0.14, y + cs * 0.14, cs * 0.72, cs * 0.72, cs * 0.08); ctx.fill();
        for (const [px, py] of [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]) ell(ctx, x + cs * px, y + cs * py, cs * 0.03, cs * 0.03, '#6b727a');
      }
      if (t === 7 || f) {
        if (reg && f && /峡谷与桥/.test(f) && !((c > 0 && map.feat[i - 1] === f) || (c < cols - 1 && map.feat[i + 1] === f))) {
          /* 崖边格：原画里是沙地，不画木板 */
        } else if (f && /桥/.test(f) && !/钢网|有洞/.test(f)) {
          // 河岸/峡谷/桥：木板
          const horiz = ((c > 0 && map.type[i - 1] !== 0 && map.feat[i - 1]) || (c < cols - 1 && map.type[i + 1] !== 0 && map.feat[i + 1])) ? true : false;
          planks(ctx, x, y, cs, !horiz ? false : true);
          ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, cs * 0.03); ctx.strokeRect(x, y, cs, cs);
        } else if (f && /钢网桥/.test(f)) steelGrate(ctx, x, y, cs, /有洞/.test(f));
        else if (f === '沼地') { ctx.fillStyle = '#6b5a34'; ctx.fillRect(x, y, cs, cs); for (let k = 0; k < 4; k++) ell(ctx, x + SV.hash2(i, k, seed) * cs, y + SV.hash2(k, i, seed) * cs, cs * 0.1, cs * 0.06, 'rgba(120,160,70,0.6)'); }
        else if (f && /铁路|带棚/.test(f)) {
          ctx.fillStyle = '#8f7a5a'; ctx.fillRect(x, y, cs, cs);
          ctx.strokeStyle = '#5a4a32'; ctx.lineWidth = cs * 0.08; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + cs * (k + 0.5) / 4, y + cs * 0.1); ctx.lineTo(x + cs * (k + 0.5) / 4, y + cs * 0.9); ctx.stroke(); }
          ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = cs * 0.06; ctx.beginPath(); ctx.moveTo(x, y + cs * 0.3); ctx.lineTo(x + cs, y + cs * 0.3); ctx.moveTo(x, y + cs * 0.7); ctx.lineTo(x + cs, y + cs * 0.7); ctx.stroke();
        } else if (f && /雪山走道/.test(f)) { ctx.fillStyle = '#cfe6f3'; ctx.fillRect(x, y, cs, cs); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = cs * 0.06; ctx.strokeRect(x + cs * 0.08, y + cs * 0.08, cs * 0.84, cs * 0.84); }
        else if (f && /石板|雕像周围/.test(f)) { ctx.fillStyle = '#b9b3a4'; ctx.fillRect(x, y, cs, cs); ctx.strokeStyle = '#7b7568'; ctx.lineWidth = Math.max(1, cs * 0.04); ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2); ctx.beginPath(); ctx.moveTo(x, y + cs / 2); ctx.lineTo(x + cs, y + cs / 2); ctx.moveTo(x + cs / 2, y); ctx.lineTo(x + cs / 2, y + cs); ctx.stroke(); }
        else if (f && /火山盆地边缘/.test(f)) { ctx.fillStyle = '#7a4a38'; ctx.fillRect(x, y, cs, cs); ctx.fillStyle = 'rgba(255,120,40,0.25)'; ell(ctx, x + cs / 2, y + cs / 2, cs * 0.4, cs * 0.3, 'rgba(255,120,40,0.25)'); }
        else if (f && /金字塔/.test(f)) {
          ctx.fillStyle = '#e2c581'; ctx.fillRect(x, y, cs, cs);
          for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#d1b06a' : '#ecd292'; ctx.fillRect(x + cs * k * 0.125, y + cs * k * 0.125, cs * (1 - k * 0.25), cs * (1 - k * 0.25)); }
        } else if (f && /峡谷|河岸/.test(f)) planks(ctx, x, y, cs, true);
        else if (f === '弹簧') { /* 动画层绘制 */ }
        else if (f === '爆炸箱') { /* 动画层 */ }
        else if (f === '传送带') { ctx.fillStyle = '#3f464d'; ctx.fillRect(x, y, cs, cs); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, cs, cs * 0.08); ctx.fillRect(x, y + cs * 0.92, cs, cs * 0.08); }
        else if (t === 7) { ctx.fillStyle = 'rgba(120,90,50,0.22)'; ctx.fillRect(x, y, cs, cs); }
      }
    }
    // 3. 区域边缘描边（表现"空地"轮廓）——用原画时不画：原作的场地没有边框
    ctx.strokeStyle = th.edge; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.lineCap = 'round';
    if (!reg) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!playable(c, r)) continue;
      const x = ox + c * cs, y = oy + r * cs;
      ctx.beginPath();
      if (!playable(c, r - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + cs, y); }
      if (!playable(c, r + 1)) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
      if (!playable(c - 1, r)) { ctx.moveTo(x, y); ctx.lineTo(x, y + cs); }
      if (!playable(c + 1, r)) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
      ctx.stroke();
    }
    // 4. 网格线（很淡；用原画时不画）
    ctx.strokeStyle = 'rgba(90,70,30,0.12)'; ctx.lineWidth = 1;
    if (!reg) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c; if (map.type[i] !== 1 && map.type[i] !== 6) continue;
      ctx.strokeRect(ox + c * cs + 0.5, oy + r * cs + 0.5, cs - 1, cs - 1);
    }
    });   // squash

    // 5. 装饰（按行由上到下，后画的盖住前面）
    const anim = { belts: [], portals: [], springs: [], crates: [], hazards: map.hazards, spawns: [], goals: [] };
    const decoKind = th.deco;
    const items = [];
    for (let r = -My; r < rows + My; r++) for (let c = -Mx; c < cols + Mx; c++) {
      const inb = c >= 0 && r >= 0 && c < cols && r < rows;
      const i = inb ? r * cols + c : -1;
      if (inb && map.type[i] !== 0) continue;
      const f = inb ? map.feat[i] : null;
      items.push({ r, c, i, f, inb });
    }
    for (const it of items) {
      const { r, c, i, f, inb } = it;
      const x = ox + c * cs + cs / 2, y = oy + (r + 1) * ch - ch * 0.06;
      const h1 = SV.hash2(c + 50, r + 50, seed), h2 = SV.hash2(r + 70, c + 30, seed + 3);
      // 用原作底图时，外圈（棋盘以外）的树石由底图自带，这里不再重复叠一层
      if (!inb && usedArt) continue;
      if (reg && !f) continue;       // 标定过的原画：格子里的树石已经烘在图里
      if (f) {
        if (f === '火山' || f === '反应炉' || f === '核电厂') continue;    // 由集群绘制
        if (reg && f === '障碍') continue;         // 标定过的原画：障碍物已经烘在图里
        if (f === '障碍' && Art.drawObstacle && Art.drawObstacle(ctx, x, y, cs, h1, h2, ch)) continue;
        if (/熔岩沟/.test(f)) { squash(ctx, oy, ay, () => { ctx.fillStyle = '#b8320f'; ctx.fillRect(ox + c * cs, oy + r * cs, cs, cs); ctx.fillStyle = '#ff8a1f'; for (let k = 0; k < 3; k++) ell(ctx, ox + c * cs + SV.hash2(k, i, seed) * cs, oy + r * cs + SV.hash2(i, k, seed) * cs, cs * 0.16, cs * 0.08, '#ffb84a'); }); continue; }
        if (/火山盆地$/.test(f)) { squash(ctx, oy, ay, () => { ctx.fillStyle = '#34201c'; ctx.fillRect(ox + c * cs, oy + r * cs, cs, cs); ell(ctx, ox + c * cs + cs / 2, oy + r * cs + cs / 2, cs * 0.36, cs * 0.28, '#e2551b'); ell(ctx, ox + c * cs + cs / 2, oy + r * cs + cs / 2, cs * 0.22, cs * 0.16, '#ffb03a'); }); continue; }
        if (/雪山地洞/.test(f)) { squash(ctx, oy, ay, () => { ctx.fillStyle = '#c7e3f3'; ctx.fillRect(ox + c * cs, oy + r * cs, cs, cs); ell(ctx, ox + c * cs + cs / 2, oy + r * cs + cs * 0.62, cs * 0.34, cs * 0.3, '#1f3346', OUT, 1.5); }); iceSpike(ctx, x, y - ch * 0.1, cs * 0.7, h1); continue; }
        if (/有洞的钢网桥/.test(f)) continue;    // 已在地面层绘制（非 playable 时另绘）
        if (f === '雕像') { statueDeco(ctx, x, y, cs, h1); continue; }
      }
      if (inb || SV.hash2(c + 9, r + 9, seed) < 0.94) {
        // 外围减少一些空缺
        Art.drawDeco(ctx, decoKind, x + (h1 - 0.5) * cs * 0.3, y + (h2 - 0.5) * cs * 0.15, cs, h1, h2);
        if (!inb || h2 < 0.35) Art.drawDeco(ctx, decoKind, x + (h2 - 0.5) * cs * 0.5, y - cs * 0.28 + (h1 - 0.5) * cs * 0.1, cs * 0.8, h2, h1);
      }
    }
    // 有洞的钢网桥（type 0 且 feat）
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, f = map.feat[i];
      if (map.type[i] === 0 && f && /有洞的钢网桥/.test(f)) squash(ctx, oy, ay, () => steelGrate(ctx, ox + c * cs, oy + r * cs, cs, true));
    }
    // 集群设施
    for (const hz of map.hazards) paintHazard(ctx, map, hz, cs, ch, ox, oy);
    // 特殊：金字塔整体（如果存在）— 略
    // 6. 出怪口 & 羊村
    // 用了标定过的原画：出怪台和羊村已经烘在图里，不再叠程序化的洞口/房子
    for (const s of map.spawns) { if (!reg) squash(ctx, oy, ay, () => paintSpawn(ctx, map, s, cs, ox, oy)); anim.spawns.push(s); }
    for (const g of map.goals) { if (!reg) paintGoal(ctx, map, g, cs, ch, ox, oy, th); anim.goals.push(g); }
    // 动画层收集
    for (let i = 0; i < map.type.length; i++) {
      if (map.belt[i]) anim.belts.push(i);
      if (map.type[i] === 4 || map.type[i] === 5) anim.portals.push(i);
      if (map.feat[i] === '弹簧') anim.springs.push(i);
      if (map.feat[i] === '爆炸箱') anim.crates.push(i);
    }
    return { canvas: cv, cs, ch, M, W, H, ox, oy, anim, scale, reg: !!reg };
  };

  function statueDeco(ctx, x, y, cs, h) {
    ell(ctx, x, y + cs * 0.04, cs * 0.34, cs * 0.1, 'rgba(0,0,0,0.22)');
    rr(ctx, x - cs * 0.3, y - cs * 0.22, cs * 0.6, cs * 0.24, cs * 0.04); ctx.fillStyle = '#b9b3a4'; ctx.fill(); ctx.lineWidth = Math.max(1, cs * 0.035); ctx.strokeStyle = OUT; ctx.stroke();
    rr(ctx, x - cs * 0.14, y - cs * 0.72, cs * 0.28, cs * 0.52, cs * 0.06); ctx.fillStyle = '#d5cfc0'; ctx.fill(); ctx.stroke();
    ell(ctx, x, y - cs * 0.78, cs * 0.14, cs * 0.14, '#d5cfc0', OUT, Math.max(1, cs * 0.035));
  }

  function paintSpawn(ctx, map, i, cs, ox, oy) {
    const c = i % map.cols, r = (i / map.cols) | 0;
    const x = ox + c * cs, y = oy + r * cs;
    // 洞口
    const g = ctx.createRadialGradient(x + cs / 2, y + cs / 2, cs * 0.05, x + cs / 2, y + cs / 2, cs * 0.5);
    g.addColorStop(0, '#0d0906'); g.addColorStop(0.7, '#3b2a1a'); g.addColorStop(1, 'rgba(90,60,30,0.0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, cs, cs);
    ell(ctx, x + cs / 2, y + cs / 2, cs * 0.42, cs * 0.34, null, '#6b4626', Math.max(2, cs * 0.06));
    // 狼爪印
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ell(ctx, x + cs / 2, y + cs * 0.56, cs * 0.1, cs * 0.08, ctx.fillStyle);
    for (const dx of [-0.16, -0.06, 0.06, 0.16]) ell(ctx, x + cs / 2 + dx * cs, y + cs * (0.4 - Math.abs(dx) * 0.2), cs * 0.04, cs * 0.05, ctx.fillStyle);
  }

  function paintGoal(ctx, map, i, cs, ch, ox, oy, th) {
    const c = i % map.cols, r = (i / map.cols) | 0;
    const x = ox + c * cs, y = oy + r * ch;
    // 篱笆门 + 羊村房子
    const lab = map.labels[i] || '';
    // 房子放在出口外侧
    let hx = x + cs / 2, hy = y + ch * 0.95, dir = 0;
    if (/→/.test(lab)) dir = 1; else if (/←/.test(lab)) dir = -1; else if (/↑/.test(lab)) dir = 2; else if (/↓/.test(lab)) dir = 3;
    const oneOut = (dx, dy) => { const nc = c + dx, nr = r + dy; return nc < 0 || nr < 0 || nc >= map.cols || nr >= map.rows || map.type[nr * map.cols + nc] === 0; };
    if (!dir) { if (c === map.cols - 1 || oneOut(1, 0)) dir = 1; else if (c === 0 || oneOut(-1, 0)) dir = -1; else if (r === 0 || oneOut(0, -1)) dir = 2; else dir = 3; }
    // 门
    ctx.fillStyle = Art.alpha('#e8b96a', 0.9); ctx.fillRect(x, y, cs, ch);
    // 篱笆
    ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, cs * 0.03);
    const post = (px, py) => { rr(ctx, px - cs * 0.05, py - cs * 0.3, cs * 0.1, cs * 0.34, cs * 0.03); ctx.fillStyle = '#b9824a'; ctx.fill(); ctx.stroke(); };
    if (dir === 1 || dir === -1) { const px = dir === 1 ? x + cs * 0.9 : x + cs * 0.1; post(px, y + cs * 0.15); post(px, y + cs * 0.95); }
    else { const py = dir === 2 ? y + cs * 0.1 : y + cs * 0.92; post(x + cs * 0.12, py + (dir === 2 ? cs * 0.3 : 0)); post(x + cs * 0.88, py + (dir === 2 ? cs * 0.3 : 0)); }
    // 房屋簇
    const cx = dir === 1 ? x + cs * 1.7 : dir === -1 ? x - cs * 0.7 : x + cs / 2;
    const cy = dir === 2 ? y - cs * 0.15 : dir === 3 ? y + cs * 1.9 : y + cs * 0.95;
    const s = cs;
    house(ctx, cx - s * 0.5, cy + s * 0.3, s, 0.95, 0.95, '#f08a1c', '#f6e7c1');
    house(ctx, cx + s * 0.5, cy + s * 0.08, s, 0.85, 0.85, '#ee6a2a', '#f4dfb0');
    house(ctx, cx, cy - s * 0.45, s, 0.8, 0.8, '#f2a02a', '#f8ecc9');
    // 小旗
    ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, cs * 0.04); ctx.beginPath(); ctx.moveTo(cx + s * 1.0, cy + s * 0.5); ctx.lineTo(cx + s * 1.0, cy - s * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 1.0, cy - s * 0.4); ctx.lineTo(cx + s * 1.34, cy - s * 0.3); ctx.lineTo(cx + s * 1.0, cy - s * 0.2); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  }

  function paintHazard(ctx, map, hz, cs, ch, ox, oy) {
    let minC = 999, maxC = -1, minR = 999, maxR = -1;
    for (const c of hz.cells) { const cc = c % map.cols, rr2 = (c / map.cols) | 0; minC = Math.min(minC, cc); maxC = Math.max(maxC, cc); minR = Math.min(minR, rr2); maxR = Math.max(maxR, rr2); }
    const x = ox + minC * cs, y = oy + minR * ch, w = (maxC - minC + 1) * cs, h = (maxR - minR + 1) * ch;
    const cx = x + w / 2, by = y + h;
    // 动画层（drawAnimated）在被压扁的坐标系里画，所以 hz.px 用「正方形格」坐标
    const sy = oy + minR * cs, sh = (maxR - minR + 1) * cs;
    hz.px = { cx, cy: sy + sh / 2, w, h: sh, x, y: sy };
    // 有原作矢量就用原作的火山 / 反应炉 / 核电厂；动效仍由下面的动画层叠加
    if (Art.drawHazardFacility && Art.drawHazardFacility(ctx, hz, cs, x, y, w, h)) return;
    if (hz.kind === 'volcano') {
      ell(ctx, cx, by - cs * 0.02, w * 0.5, h * 0.16, 'rgba(0,0,0,0.25)');
      ctx.beginPath(); ctx.moveTo(x + w * 0.02, by); ctx.lineTo(cx - w * 0.18, y + h * 0.18); ctx.lineTo(cx + w * 0.18, y + h * 0.18); ctx.lineTo(x + w * 0.98, by); ctx.closePath();
      const g = ctx.createLinearGradient(x, y, x + w, by); g.addColorStop(0, '#7a4a3a'); g.addColorStop(1, '#3d241c'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(2, cs * 0.05); ctx.strokeStyle = OUT; ctx.stroke();
      ell(ctx, cx, y + h * 0.18, w * 0.19, h * 0.09, '#ff7a1a', OUT, Math.max(1.5, cs * 0.04));
      ell(ctx, cx, y + h * 0.19, w * 0.13, h * 0.055, '#ffd05a');
      ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = Math.max(2, cs * 0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.05, y + h * 0.24); ctx.quadraticCurveTo(cx - w * 0.14, y + h * 0.5, cx - w * 0.2, by - h * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + w * 0.06, y + h * 0.26); ctx.quadraticCurveTo(cx + w * 0.12, y + h * 0.55, cx + w * 0.24, by - h * 0.06); ctx.stroke();
    } else if (hz.kind === 'reactor') {
      const rw = Math.max(cs * 0.7, w * 0.8);
      ell(ctx, cx, by - cs * 0.02, rw * 0.6, cs * 0.14, 'rgba(0,0,0,0.25)');
      rr(ctx, cx - rw / 2, y + h * 0.18, rw, h * 0.8, cs * 0.16); const g = ctx.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0); g.addColorStop(0, '#7b8794'); g.addColorStop(0.5, '#c5ced8'); g.addColorStop(1, '#6a7580'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(2, cs * 0.05); ctx.strokeStyle = OUT; ctx.stroke();
      rr(ctx, cx - rw * 0.34, y + h * 0.3, rw * 0.68, h * 0.34, cs * 0.1); ctx.fillStyle = '#39d98a'; ctx.fill(); ctx.lineWidth = Math.max(1.5, cs * 0.035); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, cx - rw * 0.15, y + h * 0.4, rw * 0.06, h * 0.05, ctx.fillStyle); ell(ctx, cx + rw * 0.12, y + h * 0.5, rw * 0.05, h * 0.04, ctx.fillStyle);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - rw / 2, y + h * 0.72, rw, h * 0.07);
    } else if (hz.kind === 'nuclear') {
      const rw = Math.max(cs * 0.8, w * 0.85);
      ell(ctx, cx, by - cs * 0.02, rw * 0.6, cs * 0.14, 'rgba(0,0,0,0.25)');
      ctx.beginPath(); ctx.moveTo(cx - rw * 0.5, by); ctx.quadraticCurveTo(cx - rw * 0.26, y + h * 0.55, cx - rw * 0.34, y + h * 0.12); ctx.lineTo(cx + rw * 0.34, y + h * 0.12); ctx.quadraticCurveTo(cx + rw * 0.26, y + h * 0.55, cx + rw * 0.5, by); ctx.closePath();
      const g = ctx.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0); g.addColorStop(0, '#9aa3ad'); g.addColorStop(0.5, '#e6ebf0'); g.addColorStop(1, '#8b949e'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(2, cs * 0.05); ctx.strokeStyle = OUT; ctx.stroke();
      ell(ctx, cx, y + h * 0.12, rw * 0.34, h * 0.06, '#59626c', OUT, Math.max(1.5, cs * 0.04));
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(cx - rw * 0.06, y + h * 0.42); ctx.lineTo(cx + rw * 0.1, y + h * 0.42); ctx.lineTo(cx, y + h * 0.58); ctx.lineTo(cx + rw * 0.08, y + h * 0.58); ctx.lineTo(cx - rw * 0.1, y + h * 0.8); ctx.lineTo(cx - rw * 0.02, y + h * 0.6); ctx.lineTo(cx - rw * 0.1, y + h * 0.6); ctx.closePath(); ctx.fill();
    }
  }

  /* ---------- 动态地形层（每帧）---------- */
  Art.drawAnimated = function (ctx, bg, map, t, dmap) {
    const cs = bg.cs, ox = bg.ox, oy = bg.oy, cols = map.cols, ay = bg.ay || 1;
    const A = bg.anim;
    // 传送带
    for (const i of A.belts) {
      const c = i % cols, r = (i / cols) | 0, x = ox + c * cs, y = oy + r * cs, b = map.belt[i];
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cs, cs); ctx.clip();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(2, cs * 0.08); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const off = (t * 0.6) % 1;
      for (let k = -1; k < 3; k++) {
        const p = (k + off) / 2 * cs * 1.2 - cs * 0.1;
        ctx.beginPath();
        if (b[0]) { const px = x + (b[0] > 0 ? p : cs - p); ctx.moveTo(px - b[0] * cs * 0.08, y + cs * 0.3); ctx.lineTo(px + b[0] * cs * 0.08, y + cs * 0.5); ctx.lineTo(px - b[0] * cs * 0.08, y + cs * 0.7); }
        else { const py = y + (b[1] > 0 ? p : cs - p); ctx.moveTo(x + cs * 0.3, py - b[1] * cs * 0.08); ctx.lineTo(x + cs * 0.5, py + b[1] * cs * 0.08); ctx.lineTo(x + cs * 0.7, py - b[1] * cs * 0.08); }
        ctx.stroke();
      }
      ctx.restore();
    }
    // 传送门
    for (const i of A.portals) {
      const c = i % cols, r = (i / cols) | 0, x = ox + c * cs + cs / 2, y = oy + r * cs + cs / 2;
      const col = map.type[i] === 4 ? '#4aa3ff' : '#ff9a3a';
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * (k % 2 ? -1.6 : 1.4) + k);
        ctx.strokeStyle = Art.alpha(col, 0.9 - k * 0.22); ctx.lineWidth = Math.max(1.5, cs * 0.06);
        ctx.beginPath(); ctx.ellipse(0, 0, cs * (0.42 - k * 0.09), cs * (0.3 - k * 0.06), 0, 0, Math.PI * 1.5); ctx.stroke(); ctx.restore();
      }
      ell(ctx, x, y, cs * 0.12, cs * 0.09, 'rgba(255,255,255,' + (0.55 + 0.3 * Math.sin(t * 6)) + ')');
    }
    // 弹簧
    for (const i of A.springs) {
      const c = i % cols, r = (i / cols) | 0, x = ox + c * cs + cs / 2, y = oy + r * cs + cs * 0.72;
      const k = 0.5 + 0.5 * Math.sin(t * 5 + i);
      ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, cs * 0.05);
      ell(ctx, x, y + cs * 0.06, cs * 0.28, cs * 0.09, '#d7d9de', OUT, Math.max(1.5, cs * 0.04));
      ctx.strokeStyle = '#e8503a'; ctx.lineWidth = Math.max(2, cs * 0.08);
      const h = cs * (0.2 + 0.1 * k);
      ctx.beginPath(); for (let j = 0; j <= 5; j++) { ctx.lineTo(x + (j % 2 ? cs * 0.14 : -cs * 0.14), y - h * j / 5); } ctx.stroke();
      ell(ctx, x, y - h - cs * 0.02, cs * 0.28, cs * 0.09, '#f4c53a', OUT, Math.max(1.5, cs * 0.04));
    }
    // 爆炸箱
    for (const i of A.crates) {
      const c = i % cols, r = (i / cols) | 0, x = ox + c * cs, y = oy + r * cs;
      rr(ctx, x + cs * 0.14, y + cs * 0.2, cs * 0.72, cs * 0.66, cs * 0.06); ctx.fillStyle = '#d8442c'; ctx.fill(); ctx.lineWidth = Math.max(1.5, cs * 0.04); ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(cs * 0.22) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TNT', x + cs / 2, y + cs * 0.53);
    }
    // 出怪口脉动
    for (const i of A.spawns) {
      const c = i % cols, r = (i / cols) | 0, x = ox + c * cs + cs / 2, y = oy + r * cs + cs / 2;
      const k = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.strokeStyle = 'rgba(255,90,60,' + (0.25 + k * 0.35) + ')'; ctx.lineWidth = Math.max(2, cs * 0.06);
      ctx.beginPath(); ctx.ellipse(x, y, cs * (0.42 + k * 0.08), cs * (0.34 + k * 0.06), 0, 0, Math.PI * 2); ctx.stroke();
      // 箭头
      const lab = map.labels[i] || '';
      let dx = 0, dy = 0; if (/→/.test(lab)) dx = 1; else if (/←/.test(lab)) dx = -1; else if (/↑/.test(lab)) dy = -1; else if (/↓/.test(lab)) dy = 1;
      if (dx || dy) {
        const ax = x + dx * cs * 0.62 + dx * Math.sin(t * 4) * cs * 0.05, ay = y + dy * cs * 0.62 + dy * Math.sin(t * 4) * cs * 0.05;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(dy, dx)); ctx.fillStyle = '#ff5a3c'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-cs * 0.12, -cs * 0.14); ctx.lineTo(cs * 0.14, 0); ctx.lineTo(-cs * 0.12, cs * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    // 危险设施动效
    for (const hz of A.hazards) {
      if (!hz.px) continue;
      const p = hz.px;
      const fl = Math.max(0, hz.flash || 0);
      if (hz.kind === 'volcano') {
        const k = 0.5 + 0.5 * Math.sin(t * 4 + p.cx);
        ell(ctx, p.cx, p.y + p.h * 0.18, p.w * 0.14, p.h * 0.05, 'rgba(255,220,120,' + (0.3 + 0.4 * k + fl) + ')');
        if (fl > 0) {
          const n = 7;
          for (let j = 0; j < n; j++) {
            const a = j / n * Math.PI * 2, rr2 = (0.6 - fl) * cs * 1.8;
            ell(ctx, p.cx + Math.cos(a) * rr2, p.y + p.h * 0.2 + Math.sin(a) * rr2 * 0.6 - (0.6 - fl) * cs * 0.8, cs * 0.12, cs * 0.12, 'rgba(255,140,40,' + fl * 1.4 + ')');
          }
          ctx.strokeStyle = 'rgba(255,120,40,' + fl + ')'; ctx.lineWidth = Math.max(2, cs * 0.08); ctx.strokeRect(p.x - cs, p.y - cs, p.w + cs * 2, p.h + cs * 2);
        }
      } else if (hz.kind === 'reactor') {
        for (let j = 0; j < 3; j++) { const bt = (t * 0.8 + j * 0.33) % 1; ell(ctx, p.cx + Math.sin(j * 2 + t) * p.w * 0.15, p.y + p.h * 0.6 - bt * p.h * 0.4, cs * 0.05, cs * 0.05, 'rgba(255,255,255,' + (1 - bt) * 0.7 + ')'); }
        if (fl > 0) { ctx.strokeStyle = 'rgba(80,220,160,' + fl + ')'; ctx.lineWidth = Math.max(2, cs * 0.1); ctx.strokeRect(p.x - cs, p.y - cs, p.w + cs * 2, p.h + cs * 2); }
      } else if (hz.kind === 'nuclear') {
        if (fl > 0) { ctx.strokeStyle = 'rgba(255,240,90,' + fl + ')'; ctx.lineWidth = Math.max(2, cs * 0.1); ctx.strokeRect(p.x - cs, p.y - cs, p.w + cs * 2, p.h + cs * 2); }
        const sp = (t * 3) % 1; ell(ctx, p.cx, p.y + p.h * 0.1, cs * 0.25, cs * 0.12, 'rgba(255,255,120,' + (0.5 * (1 - sp)) + ')');
      }
      if (Art.origFx && Art.origFx.hazard) Art.origFx.hazard(ctx, hz, p, cs, ay);      // 原作的喷发 / 脉冲特效叠在上面
    }
  };

  Art.house2 = house;
})(typeof window !== 'undefined' ? window : globalThis);
