/* ============================================================
 * 美术 B：宝石 / 建筑 / 图标（塔、狼、羊的绘制在 art_chars.js）
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, Art = SV.Art, OUT = Art.OUT, rr = Art.rr, ell = Art.ell, shade = Art.shade;

  /* ---------- 宝石 ---------- */
  // 绘制宝石：c 颜色索引(0..5)，t 阶(1..5)，r 半径，(x,y) 中心
  Art.gem = function (ctx, x, y, r, c, t, time) {
    const hex = SV.GEM_COLORS[c].hex;
    const base = c === 5 ? '#4a4a55' : hex;
    const light = c === 5 ? '#8a8a99' : shade(hex, 0.5), dark = c === 5 ? '#17171c' : shade(hex, -0.45);
    time = time || 0;
    ctx.save(); ctx.translate(x, y);
    // 光晕
    if (t >= 3) {
      const k = t >= 4 ? 1.6 : 1.35;
      const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * k * 1.5);
      g.addColorStop(0, Art.alpha(c === 5 ? '#b38cff' : hex, 0.55 + 0.15 * Math.sin(time * 4))); g.addColorStop(1, Art.alpha(c === 5 ? '#b38cff' : hex, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * k * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.strokeStyle = OUT;
    const facet = (pts, col) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] * r, p[1] * r) : ctx.moveTo(p[0] * r, p[1] * r)); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
    if (t === 1) {                          // 碎片：不规则小块
      facet([[-0.7, 0.4], [-0.4, -0.5], [0.2, -0.7], [0.75, -0.1], [0.5, 0.6], [-0.2, 0.7]], base);
      facet([[-0.4, -0.5], [0.2, -0.7], [0.05, -0.05], [-0.5, 0.05]], light);
      facet([[0.05, -0.05], [0.75, -0.1], [0.5, 0.6], [-0.2, 0.7]], dark);
    } else if (t === 2) {                   // 晶体：六棱柱
      facet([[-0.55, -0.35], [0, -0.85], [0.55, -0.35], [0.55, 0.45], [0, 0.85], [-0.55, 0.45]], base);
      facet([[-0.55, -0.35], [0, -0.85], [0, -0.05]], light);
      facet([[0, -0.85], [0.55, -0.35], [0, -0.05]], shade(hex, 0.15));
      facet([[0, -0.05], [0.55, -0.35], [0.55, 0.45], [0, 0.85]], dark);
    } else {                                // 宝石 / 精华 / 强化：切工宝石
      const w = t >= 5 ? 0.95 : 0.85;
      facet([[-w, -0.15], [-w * 0.5, -0.75], [w * 0.5, -0.75], [w, -0.15], [0, 0.95]], base);
      facet([[-w, -0.15], [-w * 0.5, -0.75], [0, -0.15]], light);
      facet([[-w * 0.5, -0.75], [w * 0.5, -0.75], [0, -0.15]], shade(hex, 0.25));
      facet([[w * 0.5, -0.75], [w, -0.15], [0, -0.15]], base);
      facet([[-w, -0.15], [0, -0.15], [0, 0.95]], shade(hex, -0.12));
      facet([[w, -0.15], [0, -0.15], [0, 0.95]], dark);
      if (t >= 4) { // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-w * 0.35, -0.5, r * 0.07, r * 0.13, -0.6, 0, Math.PI * 2); ctx.fill();
        const sp = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * sp) + ')'; ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.9); ctx.lineTo(r * 0.7, -r * 0.5); ctx.moveTo(r * 0.5, -r * 0.7); ctx.lineTo(r * 0.9, -r * 0.7); ctx.stroke();
      }
      if (t >= 5) { // 强化：金边
        ctx.save(); ctx.scale(r, r); ctx.lineJoin = 'round'; ctx.lineWidth = 0.13; ctx.strokeStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(-w, -0.15); ctx.lineTo(-w * 0.5, -0.75); ctx.lineTo(w * 0.5, -0.75); ctx.lineTo(w, -0.15); ctx.lineTo(0, 0.95); ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  };
  const iconCache = {};
  Art.iconURL = function (key, w, h, drawFn) {
    const k = key + '@' + w + 'x' + h;
    if (iconCache[k]) return iconCache[k];
    const cv = Art.mkCanvas(w * 2, h * 2); if (!cv) return '';
    const cx = cv.getContext('2d'); cx.scale(2, 2);
    drawFn(cx, w, h);
    return iconCache[k] = cv.toDataURL();
  };
  Art.gemURL = function (c, t, size) {
    size = size || 40;
    return Art.iconURL('gem' + c + '_' + t, size, size, (cx, w, h) => Art.gem(cx, w / 2, h / 2, w * 0.36, c, t, 0));
  };

  /* ---------- 墙 / 雕像 / 机关 ---------- */
  Art.drawWall = function (ctx, cs, cx, cy) {
    ell(ctx, cx, cy + cs * 0.3, cs * 0.44, cs * 0.12, 'rgba(0,0,0,0.22)');
    const x = cx - cs * 0.42, w = cs * 0.84;
    rr(ctx, x, cy - cs * 0.12, w, cs * 0.44, cs * 0.06); ctx.fillStyle = '#b9b09f'; ctx.fill(); ctx.lineWidth = Math.max(1.5, cs * 0.035); ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, cy - cs * 0.12); ctx.lineTo(x + cs * 0.1, cy - cs * 0.3); ctx.lineTo(x + w - cs * 0.1, cy - cs * 0.3); ctx.lineTo(x + w, cy - cs * 0.12); ctx.closePath();
    ctx.fillStyle = '#d9d1c1'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,60,45,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, cy + cs * 0.1); ctx.lineTo(x + w, cy + cs * 0.1); ctx.moveTo(cx, cy - cs * 0.12); ctx.lineTo(cx, cy + cs * 0.1); ctx.moveTo(cx - cs * 0.2, cy + cs * 0.1); ctx.lineTo(cx - cs * 0.2, cy + cs * 0.32); ctx.moveTo(cx + cs * 0.2, cy + cs * 0.1); ctx.lineTo(cx + cs * 0.2, cy + cs * 0.32); ctx.stroke();
  };
  Art.drawStatue = function (ctx, sid, cs, cx, cy, t) {
    const lw = Math.max(1.5, cs * 0.035);
    ell(ctx, cx, cy + cs * 0.32, cs * 0.4, cs * 0.12, 'rgba(0,0,0,0.25)');
    rr(ctx, cx - cs * 0.34, cy + cs * 0.12, cs * 0.68, cs * 0.22, cs * 0.05); ctx.fillStyle = '#c8c0b0'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke();
    if (sid === 'panlong') {
      rr(ctx, cx - cs * 0.14, cy - cs * 0.6, cs * 0.28, cs * 0.72, cs * 0.06); ctx.fillStyle = '#d33a2c'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffcf40'; ctx.lineWidth = cs * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - cs * 0.12, cy + cs * 0.06); ctx.bezierCurveTo(cx + cs * 0.2, cy - cs * 0.06, cx - cs * 0.2, cy - cs * 0.24, cx + cs * 0.12, cy - cs * 0.36); ctx.bezierCurveTo(cx - cs * 0.16, cy - cs * 0.46, cx + cs * 0.1, cy - cs * 0.55, cx, cy - cs * 0.6); ctx.stroke();
      ell(ctx, cx, cy - cs * 0.66, cs * 0.14, cs * 0.1, '#ffcf40', OUT, lw); ell(ctx, cx + cs * 0.04, cy - cs * 0.68, cs * 0.02, cs * 0.02, '#000');
    } else if (sid === 'niulang') {
      rr(ctx, cx - cs * 0.15, cy - cs * 0.4, cs * 0.3, cs * 0.56, cs * 0.08); ctx.fillStyle = '#3a7bd5'; ctx.fill(); ctx.stroke();
      ell(ctx, cx, cy - cs * 0.52, cs * 0.14, cs * 0.14, '#f6d2a6', OUT, lw);
      ctx.beginPath(); ctx.moveTo(cx - cs * 0.2, cy - cs * 0.56); ctx.lineTo(cx, cy - cs * 0.78); ctx.lineTo(cx + cs * 0.2, cy - cs * 0.56); ctx.closePath(); ctx.fillStyle = '#e8c15a'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#7a4e2a'; ctx.lineWidth = cs * 0.05; ctx.beginPath(); ctx.moveTo(cx + cs * 0.22, cy - cs * 0.3); ctx.lineTo(cx + cs * 0.3, cy + cs * 0.1); ctx.stroke();
    } else if (sid === 'zhinu') {
      rr(ctx, cx - cs * 0.15, cy - cs * 0.4, cs * 0.3, cs * 0.56, cs * 0.1); ctx.fillStyle = '#ee6fa8'; ctx.fill(); ctx.stroke();
      ell(ctx, cx, cy - cs * 0.52, cs * 0.14, cs * 0.14, '#f6d2a6', OUT, lw);
      ell(ctx, cx, cy - cs * 0.66, cs * 0.16, cs * 0.07, '#3a2a2a', OUT, lw);
      ctx.strokeStyle = '#ffd6ec'; ctx.lineWidth = cs * 0.05; ctx.beginPath(); ctx.moveTo(cx - cs * 0.12, cy - cs * 0.2); ctx.quadraticCurveTo(cx - cs * 0.4 + Math.sin(t * 3) * cs * 0.04, cy - cs * 0.1, cx - cs * 0.3, cy + cs * 0.1); ctx.stroke();
    } else {
      ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx, cy - cs * 0.6); ctx.lineTo(cx, cy - cs * 0.46); ctx.stroke();
      ell(ctx, cx, cy - cs * 0.2, cs * 0.24, cs * 0.28, '#e83a2c', OUT, lw);
      ell(ctx, cx, cy - cs * 0.2, cs * 0.24, cs * 0.28, null);
      ctx.fillStyle = 'rgba(255,220,120,0.5)'; ell(ctx, cx - cs * 0.06, cy - cs * 0.28, cs * 0.08, cs * 0.12, ctx.fillStyle);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - cs * 0.06, cy - cs * 0.5, cs * 0.12, cs * 0.06); ctx.fillRect(cx - cs * 0.06, cy + cs * 0.06, cs * 0.12, cs * 0.05);
    }
  };
  // 炸弹（装在墙顶）：圆炸弹 + 引信火花；armed=true 时红灯闪烁
  Art.drawBomb = function (ctx, cs, cx, cy, armed, t) {
    const lw = Math.max(1.2, cs * 0.03), r = cs * 0.17, by = cy - cs * 0.36;
    ell(ctx, cx, by + r * 0.95, r * 0.9, r * 0.28, 'rgba(0,0,0,0.28)');
    ell(ctx, cx, by, r, r, '#2c2f38', OUT, lw);
    ell(ctx, cx - r * 0.35, by - r * 0.35, r * 0.28, r * 0.2, 'rgba(255,255,255,0.55)');
    rr(ctx, cx - r * 0.28, by - r * 1.25, r * 0.56, r * 0.42, r * 0.1); ctx.fillStyle = '#8a8f99'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
    ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = Math.max(1.5, cs * 0.04); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, by - r * 1.25); ctx.quadraticCurveTo(cx + r * 0.5, by - r * 1.7, cx + r * 0.9, by - r * 1.45); ctx.stroke();
    const on = armed ? (Math.sin((t || 0) * 12) > -0.2) : false;
    const sx = cx + r * 0.9, sy = by - r * 1.45;
    if (on) { ell(ctx, sx, sy, r * 0.42, r * 0.42, 'rgba(255,190,60,0.55)'); ell(ctx, sx, sy, r * 0.22, r * 0.22, '#fff2a0'); }
    else ell(ctx, sx, sy, r * 0.16, r * 0.16, armed ? '#b04a2a' : '#7a6a58');
    ell(ctx, cx, by + r * 0.2, r * 0.2, r * 0.2, armed && on ? '#ff3b30' : '#5a1f1b');
  };
  Art.drawTrap = function (ctx, tid, cs, cx, cy, ready) {
    const lw = Math.max(1.5, cs * 0.035);
    if (tid === 'clamp') {
      ctx.globalAlpha = ready ? 1 : 0.45;
      ell(ctx, cx, cy + cs * 0.08, cs * 0.36, cs * 0.16, '#7c8894', OUT, lw);
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(cx + k * cs * 0.09 - cs * 0.04, cy + cs * 0.06); ctx.lineTo(cx + k * cs * 0.09, cy - cs * 0.1); ctx.lineTo(cx + k * cs * 0.09 + cs * 0.04, cy + cs * 0.06); ctx.fillStyle = '#d9e0e8'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = ready ? 1 : 0.45;
      ell(ctx, cx, cy + cs * 0.12, cs * 0.2, cs * 0.12, '#2b2f36', OUT, lw);
      ell(ctx, cx, cy + cs * 0.06, cs * 0.16, cs * 0.06, '#c83a2a');
      ctx.globalAlpha = 1;
    }
  };

  /* ---------- 图标 ---------- */
  Art.towerIconURL = function (type, gem, lv) {
    return Art.iconURL('tw_' + type + '_' + (gem ? gem.c + '_' + gem.t : 'n') + '_' + (lv || 1), 64, 64, (cx, w, h) => {
      const b = { type, lv: lv || 1, gem: gem || null, id: 1, aim: -0.5 };
      Art.drawTower(cx, b, 48, 32, 40, 0.4, { mini: true });
    });
  };
  Art.wolfIconURL = function (id, size) {
    size = size || 56;
    // 未知的 id（比如商店里把非狼卡的东西传进来）不该把整个面板炸掉，画个灰底问号
    if (!SV.wolfDef(id)) return Art.iconURL('wf_' + id + '_none', size, size, (cx, w, h) => {
      cx.beginPath(); cx.arc(w / 2, h / 2, w * 0.36, 0, 7);
      cx.fillStyle = '#cfc7b6'; cx.fill();
      cx.lineWidth = Math.max(1, w * 0.05); cx.strokeStyle = '#8a7d66'; cx.stroke();
      cx.fillStyle = '#6b5f4a'; cx.font = 'bold ' + Math.round(w * 0.5) + 'px sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('?', w / 2, h / 2 + w * 0.02);
    });
    return Art.iconURL('wf_' + id, size, size, (cx, w, h) => {
      const def = SV.wolfDef(id);
      const w0 = { def, noBar: true, x: 0, y: 0, dir: 1, walk: 0.6, fly: false, uid: 1, hp: 1, maxhp: 1, slows: [], poisons: [], burnT: 0, stunT: 0, curse: null, shield: 0, silT: 0, invis: false, hitFlash: 0, elite: false, boss: false };
      cx.translate(w * 0.44, h * 0.92);
      Art.drawWolfBody(cx, w0, w * 0.74 / Math.max(0.8, Math.min(1.5, def.size)));
    });
  };
  Art.drawWolfBody = function (ctx, w, cs) {
    // 调用主绘制但不画血条：临时把 hp 设为 0 长度并 clip 上方
    Art.drawWolf(ctx, w, 0, 0, cs, 0.4, false);
  };
  Art.coin = function (ctx, x, y, r) {
    ell(ctx, x, y, r, r, '#f4c53a', OUT, Math.max(1, r * 0.18));
    ell(ctx, x, y, r * 0.7, r * 0.7, '#ffe27a');
    ctx.fillStyle = '#c99a1e'; ctx.font = 'bold ' + Math.round(r * 1.1) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('¥', x, y + r * 0.05);
  };
})(typeof window !== 'undefined' ? window : globalThis);
