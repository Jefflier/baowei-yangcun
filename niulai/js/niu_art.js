/* ============================================================
 * 牛来攻城 —— 美术
 *   牛有两套画法，设置里切换：
 *     「正片」（默认）：致敬电影《牛来》的 SketchUp 方块建模，见 niu_su.js
 *     「海报」：手搓的 Q 版矢量（侧身 + 正脸大头）——海报仅供参考，以正片为准
 *   两套都按帧烘进离屏画布缓存
 *   塔 / 石墙 / 盘龙柱 / 织女 / 牛郎 / 树石 / 羊 / 气球：直接用保卫羊村导出的原作矢量（SVAArt），
 *     同样按比例烘进缓存；缺素材时退回程序化画法
 * 坐标约定：画牛时原点 = 两脚中间的地面，朝右；1 单位 ≈ 牛身长的 1%
 * ============================================================ */
(function (root) {
  'use strict';
  const NL = root.NL = root.NL || {};
  const Art = NL.Art = { pr: 1 };
  const TAU = Math.PI * 2;

  /* ---------- 颜色小工具 ---------- */
  function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, k) { const A = hex2rgb(a), B = hex2rgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')'; }
  function shade(c, k) { return k >= 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k); }
  Art.mix = mix; Art.shade = shade;

  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  Art.ell = ell; Art.rr = rr;
  function fillStroke(ctx, fill, line, lw) { ctx.fillStyle = fill; ctx.fill(); if (line) { ctx.lineWidth = lw || 2.2; ctx.strokeStyle = line; ctx.stroke(); } }
  // 沿二次曲线画一个由粗到细的角
  function horn(ctx, x0, y0, cx, cy, x1, y1, w0, fill, line) {
    const N = 10, L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      const x = a * x0 + b * cx + c * x1, y = a * y0 + b * cy + c * y1;
      const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
      const d = Math.hypot(dx, dy) || 1, w = w0 * (1 - t * 0.92) / 2;
      L.push([x - dy / d * w, y + dx / d * w]); R.push([x + dy / d * w, y - dx / d * w]);
    }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (const p of L) ctx.lineTo(p[0], p[1]);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath(); fillStroke(ctx, fill, line, 1.8);
  }

  /* ---------- 牛的造型表 ---------- */
  const STY = {
    huang: { body: '#e0a044', belly: '#f6d9a0', muzzle: '#f8cfae', horn: 'small', hornC: '#f5ead0', hoof: '#5a3a1a', tuft: '#8a5a22', eyes: 'cute', blush: true },
    calf: { body: '#ecbd7c', belly: '#fae6c4', muzzle: '#fbd6bd', horn: 'nub', hornC: '#f5ead0', hoof: '#6a4a2a', tuft: '#a0703a', eyes: 'big', blush: true, headK: 1.18 },
    naiu: { body: '#fbfaf4', belly: '#ffffff', muzzle: '#ffb6c4', horn: 'small', hornC: '#efe2c2', hoof: '#4a4a4a', tuft: '#333', eyes: 'cute', blush: true, spots: '#2e2e2e', bell: true, udder: true },
    douniu: { body: '#3c2c27', belly: '#5d463d', muzzle: '#8a665a', horn: 'long', hornC: '#fff4dc', hoof: '#1c1210', tuft: '#1e1512', eyes: 'angry', ring: true },
    shuiniu: { body: '#65717a', belly: '#88949c', muzzle: '#434b52', horn: 'crescent', hornC: '#d6ccb8', hoof: '#2a2f33', tuft: '#3a4046', eyes: 'sleepy', mud: true },
    maoniu: { body: '#4b3527', belly: '#5e4432', muzzle: '#7b5c48', horn: 'yak', hornC: '#f1e6cc', hoof: '#21160f', tuft: '#2e2016', eyes: 'cute', fringe: '#35251a', snow: true },
    zhuang: { body: '#925c36', belly: '#c08a5c', muzzle: '#d9a585', horn: 'small', hornC: '#efe2c2', hoof: '#3a2412', tuft: '#5a3818', eyes: 'angry', ram: true },
    feitian: { body: '#f6f0ff', belly: '#ffffff', muzzle: '#ffc2d6', horn: 'small', hornC: '#fff0d0', hoof: '#8a7a9a', tuft: '#c9a6e6', eyes: 'big', blush: true, spots: '#f2a6c8', fly: true },
    tiejia: { body: '#7c6b5a', belly: '#9c8a78', muzzle: '#b39a86', horn: 'metal', hornC: '#c8d0d8', hoof: '#2a2a2a', tuft: '#4a3c30', eyes: 'angry', armor: true },
    huoniu: { body: '#b44a2c', belly: '#d9774c', muzzle: '#f0a47e', horn: 'blade', hornC: '#fff0d6', hoof: '#3a1a10', tuft: '#ffb43a', eyes: 'angry', fire: true },
    qingniu: { body: '#3f8e98', belly: '#6fb7bd', muzzle: '#9ad0cf', horn: 'single', hornC: '#f3ecd2', hoof: '#1e3a40', tuft: '#23555c', eyes: 'angry', band: true, goldRing: true },
    mowang: { body: '#2c2222', belly: '#4a3434', muzzle: '#6a4a44', horn: 'demon', hornC: '#ffd23f', hoof: '#120c0c', tuft: '#b3202a', eyes: 'glow', ring: true, cape: true, goldArmor: true }
  };
  Art.STY = STY;

  // 'su' = 正片（方块建模），'poster' = 海报（Q 版）
  Art.style = 'su';
  Art.setStyle = function (st) { if (st !== Art.style) { Art.style = st; Art.clearCache(); } };
  Art.cowRaw = function (ctx, id, p, o) {
    if (Art.style === 'su' && NL.SU) NL.SU.cow(ctx, id, p, o);
    else Art.cowPoster(ctx, id, p, o);
  };

  function leg(ctx, x, y, ang, len, w, fill, hoof, line) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    rr(ctx, -w / 2, -2, w, len + 2, w * 0.45); fillStroke(ctx, fill, line, 1.8);
    rr(ctx, -w / 2 - 0.4, len - 5, w + 0.8, 6, 2); fillStroke(ctx, hoof, line, 1.4);
    ctx.restore();
  }

  /* 画一头海报牛（原点在脚下，朝右）。p = 走路相位 0..2π，o: {flash, walk, charge, enrage, t} */
  Art.cowPoster = function (ctx, id, p, o) {
    o = o || {};
    const S = STY[id] || STY.huang;
    const line = shade(S.body, -0.55), bodyC = S.body;
    const walking = o.walk !== false && !S.fly;
    const A = walking ? 0.5 : 0;
    const bob = walking ? -Math.abs(Math.sin(p)) * 1.6 : Math.sin(p) * 0.6;
    const t = o.t || 0;
    const legC = shade(bodyC, -0.08), legFar = shade(bodyC, -0.3);
    const legLen = S.fly ? 20 : 22, hipY = -22;
    const sw = S.fly ? Math.sin(p) * 0.25 : 0;

    // 远侧的腿
    leg(ctx, -16, hipY + bob, S.fly ? 0.3 + sw : Math.sin(p + Math.PI) * A, legLen, 8, legFar, shade(S.hoof, -0.2), line);
    leg(ctx, 26, hipY + bob, S.fly ? -0.25 - sw : Math.sin(p) * A, legLen, 8, legFar, shade(S.hoof, -0.2), line);

    ctx.save(); ctx.translate(0, bob);
    // 披风（牛魔王）
    if (S.cape) {
      const wv = Math.sin(t * 6 + p) * 3;
      ctx.beginPath(); ctx.moveTo(20, -50); ctx.quadraticCurveTo(-10, -62, -46, -46 + wv);
      ctx.quadraticCurveTo(-58, -26 + wv, -50, -8 + wv * 0.6); ctx.quadraticCurveTo(-30, -18, -10, -22); ctx.closePath();
      const g = ctx.createLinearGradient(0, -60, -50, -10); g.addColorStop(0, '#d8303a'); g.addColorStop(1, '#7a0f18');
      fillStroke(ctx, g, '#4a0a10', 2);
    }
    // 尾巴
    const tw = Math.sin(t * 5 + p * 0.5) * 5;
    ctx.beginPath(); ctx.moveTo(-34, -42); ctx.quadraticCurveTo(-46 + tw * 0.3, -36, -44 + tw, -18);
    ctx.lineWidth = 3; ctx.strokeStyle = line; ctx.lineCap = 'round'; ctx.stroke();
    if (S.fire) {
      const fl = 1 + Math.sin(t * 22) * 0.15;
      ell(ctx, -44 + tw, -18, 7 * fl, 10 * fl); ctx.fillStyle = 'rgba(255,120,20,0.85)'; ctx.fill();
      ell(ctx, -44 + tw, -16, 4 * fl, 6 * fl); ctx.fillStyle = '#ffe36a'; ctx.fill();
    } else { ell(ctx, -44 + tw, -17, 3.6, 5.5); fillStroke(ctx, S.tuft, line, 1.4); }

    // 身体
    ell(ctx, -2, -36, 37, 19);
    const bg = ctx.createLinearGradient(0, -56, 0, -16); bg.addColorStop(0, shade(bodyC, 0.12)); bg.addColorStop(1, shade(bodyC, -0.1));
    fillStroke(ctx, bg, line, 2.4);
    ctx.save(); ell(ctx, -2, -36, 37, 19); ctx.clip();
    ell(ctx, 2, -22, 28, 10); ctx.fillStyle = S.belly; ctx.fill();
    if (S.spots) {
      ctx.fillStyle = S.spots;
      ell(ctx, -16, -44, 11, 8, 0.3); ctx.fill(); ell(ctx, 8, -48, 8, 6, -0.4); ctx.fill(); ell(ctx, -28, -30, 7, 9); ctx.fill(); ell(ctx, 18, -32, 5, 4); ctx.fill();
    }
    if (S.mud) { ctx.fillStyle = 'rgba(90,64,40,0.55)'; ell(ctx, -14, -24, 12, 5); ctx.fill(); ell(ctx, 12, -20, 8, 4); ctx.fill(); }
    if (S.fire) { ctx.strokeStyle = 'rgba(80,20,10,0.35)'; ctx.lineWidth = 3; for (let k = -20; k <= 10; k += 10) { ctx.beginPath(); ctx.moveTo(k, -54); ctx.quadraticCurveTo(k + 4, -40, k - 2, -28); ctx.stroke(); } }
    if (S.armor) {
      const ag = ctx.createLinearGradient(0, -56, 0, -30); ag.addColorStop(0, '#dfe5ea'); ag.addColorStop(1, '#8a949c');
      ctx.beginPath(); ctx.moveTo(-40, -34); ctx.quadraticCurveTo(-2, -64, 36, -34); ctx.lineTo(36, -28); ctx.quadraticCurveTo(-2, -44, -40, -28); ctx.closePath();
      ctx.fillStyle = ag; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-40, -34); ctx.quadraticCurveTo(-2, -64, 36, -34); ctx.lineTo(36, -44); ctx.lineTo(-40, -44); ctx.closePath(); ctx.fillStyle = ag; ctx.fill();
      ctx.fillStyle = '#5a646c'; for (let k = -30; k <= 26; k += 11) { ell(ctx, k, -38 - Math.cos(k / 40) * 8, 1.8, 1.8); ctx.fill(); }
      ctx.strokeStyle = '#5a646c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-2, -55); ctx.lineTo(-2, -30); ctx.stroke();
    }
    if (S.goldArmor) {
      const ag = ctx.createLinearGradient(20, -50, 40, -20); ag.addColorStop(0, '#fff2a8'); ag.addColorStop(1, '#c9901a');
      ell(ctx, 26, -34, 14, 16); ctx.fillStyle = ag; ctx.fill();
      ctx.strokeStyle = '#8a5a0a'; ctx.lineWidth = 1.6; ctx.stroke();
      ell(ctx, 26, -34, 5, 5); ctx.fillStyle = '#d8303a'; ctx.fill();
    }
    ctx.restore();
    if (S.udder) { ell(ctx, -6, -17, 7, 4.5); fillStroke(ctx, '#ffb3c6', '#c46a86', 1.4); }
    if (S.fringe) {
      ctx.beginPath(); ctx.moveTo(-38, -32);
      for (let k = -38; k <= 30; k += 6) ctx.lineTo(k + 3, -14 + ((k / 6) % 2 ? 2 : -1) + Math.sin(t * 4 + k) * 0.8), ctx.lineTo(k + 6, -24);
      ctx.lineTo(32, -34); ctx.quadraticCurveTo(-2, -26, -38, -32); ctx.closePath();
      fillStroke(ctx, S.fringe, shade(S.fringe, -0.4), 1.4);
    }
    if (S.snow) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(ctx, -10, -53, 9, 3.5); ctx.fill(); ell(ctx, 10, -54, 6, 2.5); ctx.fill(); }
    if (S.goldRing) {
      const ry = -70 + Math.sin(t * 3) * 2.5;
      ctx.save(); ctx.translate(-6, ry); ctx.rotate(Math.sin(t * 2) * 0.2);
      ell(ctx, 0, 0, 11, 4.5); ctx.lineWidth = 3.6; ctx.strokeStyle = '#c9901a'; ctx.stroke();
      ell(ctx, 0, 0, 11, 4.5); ctx.lineWidth = 2; ctx.strokeStyle = '#ffe27a'; ctx.stroke();
      ctx.fillStyle = '#fff'; ell(ctx, 6, -2.5, 1.5, 1.2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 近侧的腿
    leg(ctx, -26, hipY + bob, S.fly ? 0.2 - sw : Math.sin(p) * A, legLen, 8.5, legC, S.hoof, line);
    leg(ctx, 16, hipY + bob, S.fly ? -0.35 + sw : Math.sin(p + Math.PI) * A, legLen, 8.5, legC, S.hoof, line);
    if (S.mud) { ctx.fillStyle = 'rgba(90,64,40,0.6)'; ell(ctx, -26, -6 + bob * 0, 5, 3); ctx.fill(); ell(ctx, 16, -6, 5, 3); ctx.fill(); }

    // 头
    const hb = walking ? Math.sin(p * 2) * 1.2 : Math.sin(t * 2) * 0.8;
    const hk = S.headK || 1;
    ctx.save();
    ctx.translate(34, -52 + bob + hb);
    if (o.charge) ctx.rotate(0.18);
    ctx.scale(hk, hk);
    const headLine = line;
    // 角（远侧 / 两边）
    const drawHorns = (front) => {
      const hc = S.hornC, hl = shade(S.hornC, -0.45);
      switch (S.horn) {
        case 'small':
          if (!front) horn(ctx, -10, -12, -16, -20, -12, -26, 6, hc, hl); else horn(ctx, 10, -12, 16, -20, 12, -26, 6, hc, hl); break;
        case 'nub':
          if (front) { ell(ctx, -8, -15, 3, 2.5); fillStroke(ctx, hc, hl, 1.2); ell(ctx, 8, -15, 3, 2.5); fillStroke(ctx, hc, hl, 1.2); } break;
        case 'long':
          if (!front) horn(ctx, -10, -11, -26, -16, -30, -32, 7, hc, hl); else horn(ctx, 10, -11, 26, -16, 30, -32, 7, hc, hl); break;
        case 'crescent':
          if (!front) horn(ctx, -10, -10, -40, -14, -34, -34, 9, hc, hl); else horn(ctx, 10, -10, 40, -14, 34, -34, 9, hc, hl); break;
        case 'yak':
          if (!front) horn(ctx, -10, -12, -24, -14, -22, -34, 7, hc, hl); else horn(ctx, 10, -12, 24, -14, 22, -34, 7, hc, hl); break;
        case 'metal':
          if (!front) horn(ctx, -10, -12, -20, -18, -18, -30, 7, hc, '#5a646c'); else horn(ctx, 10, -12, 20, -18, 18, -30, 7, hc, '#5a646c'); break;
        case 'blade':
          if (!front) { horn(ctx, -10, -12, -18, -18, -16, -28, 6, hc, hl); ctx.beginPath(); ctx.moveTo(-17, -27); ctx.lineTo(-22, -40); ctx.lineTo(-13, -29); ctx.closePath(); fillStroke(ctx, '#e8eef4', '#6a7a8a', 1.2); }
          else { horn(ctx, 10, -12, 18, -18, 16, -28, 6, hc, hl); ctx.beginPath(); ctx.moveTo(17, -27); ctx.lineTo(22, -40); ctx.lineTo(13, -29); ctx.closePath(); fillStroke(ctx, '#e8eef4', '#6a7a8a', 1.2); }
          break;
        case 'single':
          if (front) horn(ctx, 3, -13, 6, -26, 14, -34, 9, hc, hl); break;
        case 'demon':
          if (!front) horn(ctx, -11, -11, -34, -12, -30, -40, 10, hc, '#8a5a0a'); else horn(ctx, 11, -11, 34, -12, 30, -40, 10, hc, '#8a5a0a'); break;
      }
    };
    drawHorns(false);
    // 耳朵
    const earC = shade(bodyC, -0.05);
    ctx.save(); ctx.translate(-17, -6); ctx.rotate(-0.35); ell(ctx, -5, 0, 8, 4); fillStroke(ctx, earC, headLine, 1.8); ell(ctx, -5, 0, 5, 2.2); ctx.fillStyle = '#f7a9b8'; ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(17, -6); ctx.rotate(0.35); ell(ctx, 5, 0, 8, 4); fillStroke(ctx, earC, headLine, 1.8); ell(ctx, 5, 0, 5, 2.2); ctx.fillStyle = '#f7a9b8'; ctx.fill(); ctx.restore();
    // 头
    ell(ctx, 0, 0, 18, 16);
    const hg = ctx.createRadialGradient(-5, -7, 2, 0, 0, 20); hg.addColorStop(0, shade(bodyC, 0.18)); hg.addColorStop(1, shade(bodyC, -0.06));
    fillStroke(ctx, hg, headLine, 2.4);
    if (id === 'naiu') { ctx.save(); ell(ctx, 0, 0, 18, 16); ctx.clip(); ctx.fillStyle = S.spots; ell(ctx, -10, -8, 8, 7); ctx.fill(); ctx.restore(); }
    if (S.fringe) { ctx.beginPath(); ctx.moveTo(-14, -8); for (let k = -14; k <= 14; k += 4) { ctx.lineTo(k + 2, -2 + (k % 8 ? 1 : 2)); ctx.lineTo(k + 4, -9); } ctx.lineTo(14, -12); ctx.quadraticCurveTo(0, -20, -14, -8); ctx.closePath(); fillStroke(ctx, S.fringe, shade(S.fringe, -0.4), 1.2); }
    if (S.band) { ctx.save(); ell(ctx, 0, 0, 18, 16); ctx.clip(); ctx.fillStyle = '#e8b830'; ctx.fillRect(-20, -12, 40, 4); ctx.fillStyle = '#c9303a'; ell(ctx, 0, -10, 3, 3); ctx.fill(); ctx.restore(); }
    if (S.armor) {
      ctx.beginPath(); ctx.moveTo(-17, -3); ctx.quadraticCurveTo(0, -26, 17, -3); ctx.lineTo(13, -5); ctx.quadraticCurveTo(0, -16, -13, -5); ctx.closePath();
      fillStroke(ctx, '#c8d0d8', '#5a646c', 1.4);
    }
    if (S.ram) {
      // 攻城锤：木头锤身 + 铁箍 + 铁锤头，绑在额头上
      ctx.save(); ctx.translate(0, -9);
      rr(ctx, -4, -6, 44, 11, 5); fillStroke(ctx, '#9a6a3a', '#4a2a10', 1.8);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-2, 1, 40, 3);
      ctx.fillStyle = '#6a7078'; ctx.fillRect(8, -6.5, 3, 12); ctx.fillRect(22, -6.5, 3, 12);
      rr(ctx, 38, -9, 10, 17, 3); fillStroke(ctx, '#8a929a', '#3a4046', 1.8);
      ctx.beginPath(); ctx.moveTo(48, -6); ctx.lineTo(54, -3); ctx.lineTo(48, 0); ctx.moveTo(48, 1); ctx.lineTo(54, 4); ctx.lineTo(48, 7); ctx.fillStyle = '#5a6068'; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(15, -12); ctx.stroke();
    }
    // 嘴套
    ell(ctx, 3, 7, 13, 9);
    fillStroke(ctx, S.muzzle, shade(S.muzzle, -0.45), 2);
    ctx.fillStyle = shade(S.muzzle, -0.55);
    ell(ctx, -2.5, 6, 1.8, 2.6); ctx.fill(); ell(ctx, 8.5, 6, 1.8, 2.6); ctx.fill();
    ctx.beginPath(); ctx.arc(3, 10.5, 3.4, 0.25, Math.PI - 0.25); ctx.lineWidth = 1.3; ctx.strokeStyle = shade(S.muzzle, -0.55); ctx.stroke();
    if (S.ring) { ctx.beginPath(); ctx.arc(3, 11, 4, 0.1, Math.PI - 0.1); ctx.lineWidth = 2.2; ctx.strokeStyle = '#f0c030'; ctx.stroke(); }
    // 眼睛
    const ey = -4;
    for (const ex of [-7.5, 7.5]) {
      if (S.eyes === 'glow') {
        ell(ctx, ex, ey, 4.4, 3.6); ctx.fillStyle = o.enrage ? '#ff3a1a' : '#ffcf2a'; ctx.fill();
        ell(ctx, ex, ey, 1.2, 3.2); ctx.fillStyle = '#1a0a00'; ctx.fill();
      } else if (S.eyes === 'sleepy') {
        ell(ctx, ex, ey, 3.8, 3.6); ctx.fillStyle = '#1a1414'; ctx.fill();
        ctx.fillStyle = shade(bodyC, 0.05); ctx.fillRect(ex - 4.5, ey - 4.5, 9, 3.4);
        ctx.fillStyle = '#fff'; ell(ctx, ex + 1.2, ey + 0.5, 1.1, 1.1); ctx.fill();
      } else {
        const big = S.eyes === 'big' ? 1.25 : 1;
        ell(ctx, ex, ey, 3.6 * big, 4.4 * big); ctx.fillStyle = '#1a1414'; ctx.fill();
        ctx.fillStyle = '#fff'; ell(ctx, ex + 1.2 * big, ey - 1.6 * big, 1.5 * big, 1.5 * big); ctx.fill(); ell(ctx, ex - 1.2, ey + 1.8, 0.8, 0.8); ctx.fill();
      }
      if (S.eyes === 'angry' || S.eyes === 'glow') {
        ctx.beginPath(); ctx.moveTo(ex - 5 * Math.sign(ex) * -1, ey - 8.5); ctx.lineTo(ex + 4.5 * Math.sign(ex) * -1, ey - 5.2);
        ctx.lineWidth = 2.4; ctx.strokeStyle = S.eyes === 'glow' ? '#000' : shade(bodyC, -0.7); ctx.lineCap = 'round'; ctx.stroke();
      }
    }
    if (S.blush) { ctx.fillStyle = 'rgba(255,120,150,0.35)'; ell(ctx, -12, 3, 3.6, 2.2); ctx.fill(); ell(ctx, 13, 3, 3.6, 2.2); ctx.fill(); }
    drawHorns(true);
    ctx.restore();
    // 铃铛（奶牛）
    if (S.bell) {
      ctx.save(); ctx.translate(32, -35 + bob);
      ctx.strokeStyle = '#c9303a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -8, 9, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-4, -5, 0, -5); ctx.quadraticCurveTo(4, -5, 4, 0); ctx.lineTo(5, 3); ctx.lineTo(-5, 3); ctx.closePath();
      fillStroke(ctx, '#ffd23f', '#8a5a0a', 1.2);
      ell(ctx, 0, 3.6, 1.5, 1.5); ctx.fillStyle = '#8a5a0a'; ctx.fill();
      ctx.restore();
    }
  };

  /* ---------- 牛的精灵缓存 ---------- */
  const BOUNDS = { x0: -92, x1: 112, y0: -150, y1: 16 };
  const cowCache = new Map();
  Art.cowScale = function (id, cell) { const C = NL.D.cows[id]; return cell * 0.9 * (C ? C.size : 1) / 100; };
  Art.clearCache = function () { cowCache.clear(); spriteCache.clear(); iconCache.clear(); };
  // frame 0..7 走路帧；v 变体（可组合）：c 冲锋 / e 狂暴 / i 待机 / u 站起来 / t 绊倒 / d 四脚朝天；flash 白闪
  Art.cowSprite = function (id, frame, v, flash, cell) {
    const key = id + '|' + frame + '|' + v + '|' + (flash ? 1 : 0) + '|' + cell;
    let s = cowCache.get(key);
    if (s) return s;
    const sc = Art.cowScale(id, cell), pr = Art.pr;
    const w = Math.ceil((BOUNDS.x1 - BOUNDS.x0) * sc * pr), h = Math.ceil((BOUNDS.y1 - BOUNDS.y0) * sc * pr);
    const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h);
    const c = cv.getContext('2d');
    c.scale(sc * pr, sc * pr); c.translate(-BOUNDS.x0, -BOUNDS.y0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const has = ch => v.indexOf(ch) >= 0;
    Art.cowRaw(c, id, frame / 8 * TAU, { frame, walk: !has('i') && !has('t') && !has('d'), charge: has('c'), enrage: has('e'), up: has('u'), trip: has('t'), dead: has('d'), t: frame * 0.13 });
    if (flash) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,0.42)'; c.fillRect(0, 0, cv.width, cv.height); }
    s = { cv, dx: BOUNDS.x0 * sc, dy: BOUNDS.y0 * sc, w: w / pr, h: h / pr };
    if (cowCache.size > 1600) cowCache.clear();
    cowCache.set(key, s);
    return s;
  };
  // 在 (X,Y)（脚底）画牛；dir=-1 朝左
  Art.drawCow = function (ctx, id, X, Y, frame, dir, v, flash, cell, rot, alpha) {
    const s = Art.cowSprite(id, frame, v, flash, cell);
    ctx.save(); ctx.translate(X, Y);
    if (dir < 0) ctx.scale(-1, 1);
    if (rot) ctx.rotate(rot);
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.drawImage(s.cv, s.dx, s.dy, s.w, s.h);
    ctx.restore();
  };

  /* ---------- 原作矢量的精灵缓存（塔 / 墙 / 雕像 / 树石 / 羊 / 气球） ---------- */
  const spriteCache = new Map();
  Art.hasArt = function (lib, name) { return !!(root.SVAArt && root.SVAArt.libs[lib] && root.SVAArt.libs[lib][name]); };
  Art.artSprite = function (lib, name, frame, scale, overlay) {
    const key = lib + '|' + name + '|' + frame + '|' + scale.toFixed(4) + '|' + (overlay ? overlay.k : '');
    let s = spriteCache.get(key);
    if (s) return s;
    const fr = root.SVAArt && root.SVAArt.frameOf(lib, name, frame);
    if (!fr) return null;
    const vb = fr.vb, pr = Art.pr, pad = 2;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(vb[2] * scale * pr + pad * 2); cv.height = Math.ceil(vb[3] * scale * pr + pad * 2);
    const c = cv.getContext('2d');
    c.translate(pad, pad); c.scale(scale * pr, scale * pr); c.translate(-vb[0], -vb[1]);
    root.SVAArt.draw(c, lib, name, { frame, x: 0, y: 0, scale: 1, anchor: 'origin' });
    if (overlay) overlay.fn(c, vb);
    s = { cv, dx: vb[0] * scale - pad / pr, dy: vb[1] * scale - pad / pr, w: cv.width / pr, h: cv.height / pr, vb };
    spriteCache.set(key, s);
    return s;
  };
  Art.drawArt = function (ctx, lib, name, frame, X, Y, scale, alpha, flip) {
    const s = Art.artSprite(lib, name, frame, scale);
    if (!s) return false;
    ctx.save(); ctx.translate(X, Y); if (flip) ctx.scale(-1, 1);
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.drawImage(s.cv, s.dx, s.dy, s.w, s.h);
    ctx.restore();
    return true;
  };

  /* ---------- 塔 ---------- */
  Art.towerTop = function (type, lv, cell) {
    const T = NL.D.towers[type], fr = root.SVAArt && root.SVAArt.frameOf('tower', T.art, lv - 1);
    return fr ? fr.vb[1] * cell / 65 : -cell * 1.05;
  };
  Art.drawTower = function (ctx, type, lv, X, Y, cell, o) {
    o = o || {};
    const T = NL.D.towers[type], sc = cell / 65, tier = Math.max(0, Math.min(4, lv - 1));
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.recoil) { ctx.translate(X, Y); ctx.scale(1 + o.recoil * 0.05, 1 - o.recoil * 0.06); ctx.translate(-X, -Y); }
    const ok = Art.drawArt(ctx, 'tower', T.art, tier, X, Y, sc);
    if (ok && T.gem != null) Art.drawArt(ctx, 'tower', 'xiangqianta_gem', tier * 6 + T.gem, X, Y, sc);
    if (!ok) Art.towerFallback(ctx, type, lv, X, Y, cell);
    ctx.restore();
  };
  const GEMC = ['#ff4a3a', '#52d14a', '#ffd23f', '#a46bff', '#3fa0ff', '#3a3a3a'];
  Art.GEMC = GEMC;
  Art.towerFallback = function (ctx, type, lv, X, Y, cell) {
    const T = NL.D.towers[type], w = cell * 0.62, h = cell * (0.8 + lv * 0.06);
    const tierC = ['#a8a090', '#7fb0e0', '#f0c850', '#e06a50', '#ffd23f'][lv - 1];
    rr(ctx, X - w / 2, Y - h, w, h, 6); fillStroke(ctx, tierC, '#4a3a2a', 2);
    rr(ctx, X - w / 2 - 3, Y - h - 6, w + 6, 10, 3); fillStroke(ctx, shade(tierC, -0.15), '#4a3a2a', 2);
    const c = T.gem != null ? GEMC[T.gem] : '#6a5a4a';
    ell(ctx, X, Y - h * 0.55, w * 0.18, w * 0.18); fillStroke(ctx, c, '#2a2016', 1.5);
  };

  /* ---------- 墙：木栅 / 石墙（原作 qiang）/ 铁壁（石墙 + 铁箍） ---------- */
  Art.drawWall = function (ctx, lv, X, Y, cell, hpK, t) {
    const sc = cell / 65;
    if (lv >= 2 && Art.hasArt('building', 'qiang')) {
      if (lv === 2) Art.drawArt(ctx, 'building', 'qiang', 0, X, Y, sc);
      else {
        const s = Art.artSprite('building', 'qiang', 0, sc, { k: 'iron', fn: ironOverlay });
        ctx.drawImage(s.cv, X + s.dx, Y + s.dy, s.w, s.h);
      }
    } else if (lv >= 2) {
      rr(ctx, X - cell * 0.42, Y - cell * 0.62, cell * 0.84, cell * 0.8, 5);
      fillStroke(ctx, lv === 3 ? '#8a939c' : '#a89880', '#4a3a2a', 2);
    } else woodFence(ctx, X, Y, cell);
    if (hpK < 0.65) cracks(ctx, X, Y, cell, hpK, lv);
  };
  function ironOverlay(c, vb) {
    c.save();
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(120,135,150,0.35)'; c.fillRect(vb[0], vb[1], vb[2], vb[3]);
    c.fillStyle = 'rgba(60,70,80,0.9)';
    const y1 = vb[1] + vb[3] * 0.38, y2 = vb[1] + vb[3] * 0.7;
    c.fillRect(vb[0], y1, vb[2], 4); c.fillRect(vb[0], y2, vb[2], 4);
    c.fillStyle = '#d8dee4';
    for (let x = vb[0] + 6; x < vb[0] + vb[2] - 3; x += 11) { c.beginPath(); c.arc(x, y1 + 2, 1.6, 0, TAU); c.fill(); c.beginPath(); c.arc(x, y2 + 2, 1.6, 0, TAU); c.fill(); }
    c.restore();
  }
  function woodFence(ctx, X, Y, cell) {
    const w = cell * 0.86, h = cell * 0.62;
    ctx.save(); ctx.translate(X, Y);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ell(ctx, 0, 2, w * 0.55, cell * 0.12); ctx.fill();
    // 横木
    for (const yy of [-h * 0.35, -h * 0.7]) { rr(ctx, -w / 2, yy - 3, w, 6, 2); fillStroke(ctx, '#b07a44', '#5a3a1a', 1.5); }
    // 尖木桩
    const n = 4;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + w * (i + 0.5) / n, top = -h - (i % 2) * 4;
      ctx.beginPath(); ctx.moveTo(x - 4.5, 0); ctx.lineTo(x - 4.5, top + 6); ctx.lineTo(x, top); ctx.lineTo(x + 4.5, top + 6); ctx.lineTo(x + 4.5, 0); ctx.closePath();
      const g = ctx.createLinearGradient(x - 4, 0, x + 4, 0); g.addColorStop(0, '#d8a060'); g.addColorStop(1, '#9a6430');
      fillStroke(ctx, g, '#5a3a1a', 1.5);
    }
    ctx.restore();
  }
  function cracks(ctx, X, Y, cell, k, lv) {
    ctx.save(); ctx.translate(X, Y - cell * 0.35);
    ctx.strokeStyle = lv === 1 ? 'rgba(60,30,10,0.85)' : 'rgba(40,30,20,0.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-cell * 0.15, -cell * 0.2); ctx.lineTo(-cell * 0.05, -cell * 0.05); ctx.lineTo(-cell * 0.14, cell * 0.08); ctx.lineTo(-cell * 0.02, cell * 0.2); ctx.stroke();
    if (k < 0.35) { ctx.beginPath(); ctx.moveTo(cell * 0.16, -cell * 0.25); ctx.lineTo(cell * 0.06, -cell * 0.08); ctx.lineTo(cell * 0.18, cell * 0.05); ctx.stroke(); }
    ctx.restore();
  }

  /* ---------- 雕像 / 草垛 / 障碍 ---------- */
  Art.drawStatue = function (ctx, sid, X, Y, cell, alpha) {
    const S = NL.D.statues[sid];
    if (!Art.drawArt(ctx, 'building', S.art, 0, X, Y, cell / 65, alpha)) {
      rr(ctx, X - cell * 0.3, Y - cell * 1.2, cell * 0.6, cell * 1.2, 6); fillStroke(ctx, '#e8c050', '#6a4a1a', 2);
    }
  };
  Art.drawHay = function (ctx, X, Y, cell, bitesK, t) {
    const k = 0.55 + 0.45 * bitesK;
    ctx.save(); ctx.translate(X, Y + cell * 0.18);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ell(ctx, 0, 0, cell * 0.36, cell * 0.1); ctx.fill();
    ctx.scale(k, k);
    const w = cell * 0.62, h = cell * 0.5;
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(-w / 2, -h, 0, -h * 1.05); ctx.quadraticCurveTo(w / 2, -h, w / 2, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#ffe38a'); g.addColorStop(1, '#d8a93a');
    fillStroke(ctx, g, '#8a6a1a', 1.6);
    ctx.strokeStyle = 'rgba(140,100,20,0.6)'; ctx.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * w / 8, -2); ctx.quadraticCurveTo(i * w / 9, -h * 0.6, i * w / 14, -h * 0.95); ctx.stroke(); }
    ctx.strokeStyle = '#b8402a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-w * 0.42, -h * 0.35); ctx.quadraticCurveTo(0, -h * 0.25, w * 0.42, -h * 0.35); ctx.stroke();
    ctx.restore();
  };
  const TREES = ['zhangai_shu1', 'zhangai_shu2', 'zhangai_shu3'], ROCKS = ['zhangai_shitou1', 'zhangai_shitou2', 'zhangai_shitou3'];
  Art.drawObstacle = function (ctx, ch, X, Y, cell, seed, theme, t) {
    const sc = cell / 65;
    if (ch === 'M') return windmill(ctx, X, Y, cell, t);
    if (ch === 'T' && theme === 'snow') return pine(ctx, X, Y, cell, seed, true);
    if (ch === 'T' && theme === 'volcano') return deadTree(ctx, X, Y, cell);
    if (ch === 'R' && theme === 'volcano') return basalt(ctx, X, Y, cell, seed);
    const list = ch === 'T' ? TREES : ROCKS;
    const name = list[Math.floor(seed * list.length) % list.length];
    const k = ch === 'T' ? (name === 'zhangai_shu3' ? 0.72 : 0.95) : (name === 'zhangai_shitou3' ? 0.95 : 1.05);
    if (!Art.drawArt(ctx, 'obstacle', name, 0, X, Y + cell * 0.1, sc * k)) {
      if (ch === 'T') pine(ctx, X, Y, cell, seed, false);
      else { ell(ctx, X, Y - cell * 0.12, cell * 0.36, cell * 0.26); fillStroke(ctx, '#9a948a', '#4a463e', 2); }
    }
  };
  function pine(ctx, X, Y, cell, seed, snow) {
    ctx.save(); ctx.translate(X, Y + cell * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ell(ctx, 0, 0, cell * 0.34, cell * 0.1); ctx.fill();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-3, -cell * 0.25, 6, cell * 0.25);
    for (let i = 0; i < 3; i++) {
      const w = cell * (0.42 - i * 0.1), y = -cell * (0.2 + i * 0.28);
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(0, y - cell * 0.42); ctx.lineTo(w, y); ctx.closePath();
      fillStroke(ctx, snow ? '#3f6f5a' : '#3f8f3a', '#1f3f2a', 1.5);
      if (snow) { ctx.beginPath(); ctx.moveTo(-w * 0.55, y - cell * 0.18); ctx.lineTo(0, y - cell * 0.42); ctx.lineTo(w * 0.55, y - cell * 0.18); ctx.quadraticCurveTo(0, y - cell * 0.1, -w * 0.55, y - cell * 0.18); ctx.fillStyle = '#fff'; ctx.fill(); }
    }
    ctx.restore();
  }
  function deadTree(ctx, X, Y, cell) {
    ctx.save(); ctx.translate(X, Y + cell * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, 0, 0, cell * 0.3, cell * 0.09); ctx.fill();
    ctx.strokeStyle = '#2a1e18'; ctx.lineCap = 'round';
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -cell * 0.7); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -cell * 0.4); ctx.lineTo(-cell * 0.25, -cell * 0.75); ctx.moveTo(0, -cell * 0.55); ctx.lineTo(cell * 0.22, -cell * 0.9); ctx.moveTo(0, -cell * 0.7); ctx.lineTo(-cell * 0.08, -cell * 1.0); ctx.stroke();
    ctx.restore();
  }
  function basalt(ctx, X, Y, cell, seed) {
    ctx.save(); ctx.translate(X, Y + cell * 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 0, 0, cell * 0.4, cell * 0.12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-cell * 0.38, 0); ctx.lineTo(-cell * 0.3, -cell * 0.45); ctx.lineTo(-cell * 0.05, -cell * 0.62); ctx.lineTo(cell * 0.25, -cell * 0.5); ctx.lineTo(cell * 0.38, 0); ctx.closePath();
    fillStroke(ctx, '#3a302c', '#15100e', 2);
    ctx.strokeStyle = 'rgba(255,110,30,0.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-cell * 0.2, -cell * 0.1); ctx.lineTo(-cell * 0.08, -cell * 0.3); ctx.lineTo(cell * 0.1, -cell * 0.22); ctx.stroke();
    ctx.restore();
  }
  function windmill(ctx, X, Y, cell, t) {
    ctx.save(); ctx.translate(X, Y + cell * 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ell(ctx, 0, 0, cell * 0.38, cell * 0.11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-cell * 0.3, 0); ctx.lineTo(-cell * 0.18, -cell * 0.95); ctx.lineTo(cell * 0.18, -cell * 0.95); ctx.lineTo(cell * 0.3, 0); ctx.closePath();
    fillStroke(ctx, '#f3e6c8', '#6a5238', 2);
    ctx.beginPath(); ctx.moveTo(-cell * 0.24, -cell * 0.95); ctx.lineTo(0, -cell * 1.2); ctx.lineTo(cell * 0.24, -cell * 0.95); ctx.closePath(); fillStroke(ctx, '#c0503a', '#6a2a1a', 2);
    rr(ctx, -cell * 0.07, -cell * 0.28, cell * 0.14, cell * 0.28, 3); fillStroke(ctx, '#8a5a2a', '#4a2a10', 1.2);
    ctx.translate(0, -cell * 0.8); ctx.rotate(t * 1.2);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#6a5238'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.rect(cell * 0.04, -cell * 0.06, cell * 0.5, cell * 0.12); ctx.fill(); ctx.stroke();
    }
    ell(ctx, 0, 0, cell * 0.06, cell * 0.06); ctx.fillStyle = '#6a5238'; ctx.fill();
    ctx.restore();
  }

  /* ---------- 羊（原作 7 种表情）和飞天牛的气球 ---------- */
  Art.drawSheep = function (ctx, mood, X, Y, w, t, flip) {
    const key = { happy: 'sheepHigh', scared: 'sheepAfraid', cry: 'sheepCry', angry: 'sheepAnger' }[mood] || 'sheepHigh';
    if (Art.hasArt('sheep', key)) {
      const n = root.SVAArt.libs.sheep[key].frames.length;
      const fr = Math.floor(t * 6) % n;
      const fr0 = root.SVAArt.frameOf('sheep', key, fr);
      const sc = w / fr0.vb[2];
      const s = Art.artSprite('sheep', key, fr, sc);
      ctx.save(); ctx.translate(X, Y); if (flip) ctx.scale(-1, 1);
      ctx.drawImage(s.cv, -s.w / 2, -s.h, s.w, s.h);
      ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(X, Y);
    ell(ctx, 0, -w * 0.45, w * 0.42, w * 0.38); fillStroke(ctx, '#fff', '#8a8a8a', 1.5);
    ell(ctx, 0, -w * 0.5, w * 0.2, w * 0.2); ctx.fillStyle = '#f6dcc0'; ctx.fill();
    ctx.restore();
  };
  Art.drawBalloon = function (ctx, X, Y, w, t) {
    ctx.strokeStyle = 'rgba(80,60,40,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 2, Y - w * 0.55); ctx.stroke();
    if (Art.hasArt('wolfui', 'balloon')) {
      const fr = root.SVAArt.frameOf('wolfui', 'balloon', 0), sc = w / fr.vb[2];
      const s = Art.artSprite('wolfui', 'balloon', 0, sc);
      ctx.drawImage(s.cv, X - s.w / 2, Y - w * 0.5 - s.h, s.w, s.h);
      return;
    }
    ell(ctx, X - w * 0.18, Y - w * 0.8, w * 0.26, w * 0.3); fillStroke(ctx, '#ff5a5a', '#8a1a1a', 1.5);
    ell(ctx, X + w * 0.18, Y - w * 0.8, w * 0.26, w * 0.3); fillStroke(ctx, '#4a8aff', '#1a3a8a', 1.5);
  };

  /* ---------- 图标（DOM 按钮用的 dataURL） ---------- */
  const iconCache = new Map();
  Art.icon = function (key, w, h, fn) {
    const k = key + '|' + w + '|' + h;
    if (iconCache.has(k)) return iconCache.get(k);
    const cv = document.createElement('canvas'); const pr = 2;
    cv.width = w * pr; cv.height = h * pr;
    const c = cv.getContext('2d'); c.scale(pr, pr); c.lineJoin = 'round'; c.lineCap = 'round';
    const save = Art.pr; Art.pr = pr;
    try { fn(c, w, h); } catch (e) { console.error(e); }
    Art.pr = save;
    const url = cv.toDataURL();
    iconCache.set(k, url);
    return url;
  };
  // style 省略 = 当前画法；传 'poster' 可以强制画海报版（标题页的「海报」）
  Art.cowIcon = function (id, size, style) {
    const st = style || Art.style, su = st === 'su';
    return Art.icon('cow_' + st + '_' + id, size, size, (c, w, h) => {
      const tall = su && ['naiu', 'qingniu', 'mowang'].indexOf(id) >= 0;      // 站着的牛更高
      const sc = w * 0.84 / 130 / (NL.D.cows[id].size > 1.5 ? 1.2 : 1) * (tall ? 0.92 : 1);
      c.translate(w * (su ? 0.42 : 0.46), h * (tall ? 0.92 : 0.86)); c.scale(sc, sc);
      if (STY[id] && STY[id].fly) { c.save(); c.translate(0, -8); }
      const save = Art.style; Art.style = st;
      try { Art.cowRaw(c, id, 0.8, { frame: 0, walk: false, t: 0.5 }); } finally { Art.style = save; }
      if (STY[id] && STY[id].fly) c.restore();
    });
  };
  Art.towerIcon = function (type, lv, size) {
    return Art.icon('tw_' + type + lv, size, size, (c, w, h) => { Art.drawTower(c, type, lv || 1, w / 2, h * 0.86, w * 0.72); });
  };
  Art.buildIcon = function (kind, size) {
    return Art.icon('b_' + kind, size, size, (c, w, h) => {
      if (kind === 'wall') { Art.drawWall(c, 1, w * 0.3, h * 0.8, w * 0.5, 1, 0); Art.drawWall(c, 2, w * 0.68, h * 0.9, w * 0.5, 1, 0); }
      else if (kind === 'hay') Art.drawHay(c, w / 2, h * 0.72, w * 0.95, 1, 0);
      else Art.drawStatue(c, kind, w / 2, h * 0.9, w * 0.72);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
