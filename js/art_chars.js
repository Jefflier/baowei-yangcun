/* ============================================================
 * 美术 C：狼 / 羊 / 防御塔（原创设计，Canvas 程序化绘制）
 *
 * 统一美术规范：
 *  - 描边：暖棕色 OUT，线宽随尺寸缩放
 *  - 三阶着色：基色 / 高光(左上) / 阴影(右下)，再加一圈边缘光
 *  - Q 版比例：大头小身，大眼睛带双高光，腮红
 *  - 狼为「正面 3/4」双足角色，靠头部/眼神偏向表示朝向；左右翻转由 drawWolf 完成
 * 本文件在 art_units.js 之后加载，覆盖其中的狼/羊/塔绘制。
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, Art = SV.Art, OUT = Art.OUT, rr = Art.rr, ell = Art.ell;

  /* ---------- 颜色工具（hex / hsl 都支持）---------- */
  function hsl2hex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => { const v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return Math.round(v * 255).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  }
  function toRGB(c) {
    let m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // 明暗：f>0 提亮、f<0 压暗；同时接受 #hex 与 rgb()，返回 #hex（可以连续套用）
  const shade = (c, f) => {
    const [r, g, b] = toRGB(c), t = f < 0 ? 0 : 255, p = Math.abs(f);
    const h = v => Math.round((t - v) * p + v).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  };
  const A = (c, a) => { const [r, g, b] = toRGB(c); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };

  /* ============================================================
   *  狼
   * ============================================================ */
  const LOOKS = {
    xiaohuil: { body: '#aab0bb', s: 0.85 }, dahuil: { body: '#8c92a0' }, baozul: { body: '#c9b28a', hat: 'cap', hatc: '#f1c40f', extra: 'shades' },
    fashil: { body: '#9c86d0', hat: 'wizard', hatc: '#6a4bb5' }, baozoul: { body: '#c9463a', eye: 'angry', hat: 'spikes' },
    feitianl: { body: '#aab0bb', extra: 'wings' }, shamol: { body: '#e0b872', hat: 'turban', hatc: '#f4f0e0' }, shamofeitianl: { body: '#e0b872', hat: 'turban', hatc: '#f4f0e0', extra: 'wings' },
    kunjiongl: { body: '#a2a9b6', hat: 'nightcap', hatc: '#5b7cd6', eye: 'sleepy' }, lieshoul: { body: '#86a266', hat: 'feather', hatc: '#3f7a3a' },
    jingangl: { body: '#6f5c4c', s: 1.35, extra: 'muscle' }, hushil: { body: '#eef2f7', hat: 'nurse', extra: 'wings' }, tufeil: { body: '#8a7358', hat: 'bandana', hatc: '#c0392b', extra: 'patch' },
    zibaol: { body: '#b45c43', extra: 'bomb' }, renzhel: { body: '#454b59', hat: 'ninja', hatc: '#20242c' }, xiangpil: { body: '#f4a8bf', s: 1.05 },
    weisuol: { body: '#79a462', hat: 'cap', hatc: '#3f7a3a' }, shanzeil: { body: '#93704c', hat: 'horn', hatc: '#c9c9c9' }, xiaochoul: { body: '#f0dede', hat: 'clown', hatc: '#e94a6b' },
    jiangshil: { body: '#98c584', extra: 'stitch' }, jxl: { body: '#a5afba', extra: 'gear', s: 1.1 }, tanhuangl: { body: '#a8b9dc', extra: 'spring' },
    bdl: { body: '#84d65f', extra: 'virus' }, fdl: { body: '#bbc47e', extra: 'gas' }, byl1: { body: '#cfa960', extra: 'box' }, byl2: { body: '#cfa960', extra: 'box', eye: 'angry' },
    shentoul: { body: '#4c4c58', extra: 'mask', ex2: 'wings' }, gnengl: { body: '#f7e88a', extra: 'glow' }, wushil: { body: '#61508a', hat: 'wizard', hatc: '#3a2c5a' },
    sujiangl: { body: '#b8b0a0', extra: 'parachute' }, tezhongl: { body: '#647f50', hat: 'helmet', hatc: '#4a5f3a' }, huabl: {}, H_hual: { body: '#f3c9de', hat: 'flower' },
    sdsl_B: { body: '#4fa66a', hat: 'tree' }, sdxhl_B: { body: '#b9865a', hat: 'antler' }, meilyu_B: { body: '#7fd0e0', extra: 'fishtail' }, xxgl_B: { body: '#5a4a6a', hat: 'vamp', extra: 'wings' },
    hlbb1_B: { body: '#e8cf5a', s: 0.75 }, hlbb2_B: { body: '#6aa8e8', s: 0.7 }, al_B: { body: '#d8d0f0', hat: 'wizard', hatc: '#8a6ad8', s: 0.95 },
    yll_B: { body: '#9db3d6' }, yll_B2: { body: '#c98ab3' }, xuel_B: { body: '#e9f3fb', extra: 'frost' }, xuel_Z: { body: '#e9f3fb', extra: 'frost', s: 1.2 },
    liyuqil: { body: '#f08a5a', extra: 'wings' }, lyql: { body: '#f08a5a', extra: 'wings' }, xiaoliyuqil: { body: '#f08a5a', extra: 'wings', s: 0.85 },
    feizeil: { body: '#3f3f4a', extra: 'wings', hat: 'bandana', hatc: '#5a5aa0' }, daomu3: { body: '#8d6e4b', hat: 'cap', hatc: '#555' }, daomu2: { body: '#7d5a3a', hat: 'cap', hatc: '#3a3a3a' },
    daomu1: { body: '#6b4a2e', hat: 'cap', hatc: '#2a2a2a', s: 1.2 }, daomu4: { body: '#3a3f4b', hat: 'ninja', hatc: '#c0392b', s: 1.1 }, daomu6: { body: '#f0b8d4', extra: 'wings', hat: 'ribbon' },
    daomu7: { body: '#f4d4a6', extra: 'wings', hat: 'halo' }, hudunl: { body: '#7f95b3', extra: 'shield' }, jslw: { body: '#98c584', extra: 'stitch', hat: 'crown' },
    zjylc: { body: '#8a7a5a', extra: 'box', s: 1.45 }, xtxl: { body: '#7ea6d6', s: 0.85 }, wjxcl_B: { body: '#f0dede', hat: 'clown', hatc: '#3ab0e8' }, chidunl_A: { body: '#7f95b3', extra: 'shield' },
    yemanl_A: { body: '#8a5a3a', s: 1.2, eye: 'angry' }, wushengl_A: { body: '#c9a24a', hat: 'opera' }, yangpil_A: { body: '#f2efe6', extra: 'fleece' }, sdys_A: { body: '#c8b273', hat: 'helmet', hatc: '#d9c260' },
    ybklr_A: { body: '#7a4c8a', extra: 'mutant' }, pkygl2: { body: '#d6558a', hat: 'mohawk' }, amstl_B: { body: '#4a5ba0', extra: 'wings', hat: 'helmet', hatc: '#c9c9c9' }, bylX: { body: '#cfa960', eye: 'angry' }
  };
  const MARKS = ['none', 'cheeks', 'stripes', 'spots', 'brow', 'scar', 'none'];
  const BOSS_HATS = ['crown', 'horn', 'spikes', 'helmet', 'vamp', 'turban', 'mohawk', 'antler', 'ninja', 'opera', 'tree', 'crown'];
  const BOSS_EXTRAS = [null, 'muscle', 'shield', 'gear', null, 'box', 'stitch', null];
  const HAT_COLS = ['#c0392b', '#3f7a3a', '#3a6fc0', '#8a4ad0', '#c9a24a', '#2a2a30', '#d9822b'];
  const SCARF = ['#d94f3a', '#3d7fd0', '#e6b93a', '#4fae5a', '#9a5ac8'];
  function look(def) {
    if (def._look2) return def._look2;
    const id = def.id;
    const L = Object.assign({ body: null, s: 1, eye: 'dot', hat: null, extra: null, belly: null, mark: 'none', scarf: null }, LOOKS[id] || {});
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    if (!L.body) {
      L.body = hsl2hex(h % 360, 22 + (h >> 9) % 28, 52 + (h >> 4) % 20);
      if (!L.hat && (h >> 3) % 3 === 0) L.hat = ['cap', 'helmet', 'bandana', 'crown'][(h >> 6) % 4];
    }
    // 没有专属造型的狼，用哈希补一点辨识度：面部花纹 / 围巾 / 眼神
    if (L.mark === 'none' && !LOOKS[id]) L.mark = MARKS[(h >> 11) % MARKS.length];
    if (!L.scarf && !L.hat && !LOOKS[id] && (h >> 14) % 3 === 0) L.scarf = SCARF[(h >> 16) % SCARF.length];
    if (L.eye === 'dot' && !LOOKS[id] && (h >> 18) % 5 === 0) L.eye = 'angry';
    if (def.fly && !L.extra) L.extra = 'wings';
    if (def.fixed) {
      L.s = (L.s || 1) * 1.15;
      // 首领没有专属造型时，用哈希从一组头饰/装备里挑，避免一排「戴王冠的狼」
      if (!L.hat) { L.hat = BOSS_HATS[(h >> 5) % BOSS_HATS.length]; if (!L.hatc) L.hatc = HAT_COLS[(h >> 9) % HAT_COLS.length]; }
      if (!L.extra) L.extra = BOSS_EXTRAS[(h >> 12) % BOSS_EXTRAS.length];
      if ((h >> 15) % 2 === 0) L.eye = 'angry';
    }
    def._look2 = L;
    return L;
  }
  Art.wolfLook = look;

  /* ---- 单只狼（脚底为原点，朝右；u 为单位长度，整体高约 1.5u）---- */
  Art._paintWolf = function (ctx, w, u, t, flash) {
    const def = w.def, L = look(def), fly = w.fly;
    const ph = w.walk, uid = w.uid || 0;
    const body = L.body, light = shade(body, 0.38), dark = shade(body, -0.26), deep = shade(body, -0.5);
    const belly = L.belly || shade(body, 0.62);
    const lw = Math.max(1.3, u * 0.06);
    const wingy = L.extra === 'wings' || L.ex2 === 'wings' || fly;
    const step = Math.sin(ph * 2.2);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const outline = () => { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); };
    const fillG = (c1, c2, x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; };

    if (L.extra === 'glow') ell(ctx, 0, -u * 0.7, u * 0.95, u * 0.85, 'rgba(255,240,130,0.22)');
    if (L.extra === 'box') { // 背着的箱子
      rr(ctx, -u * 0.56, -u * 0.86, u * 0.44, u * 0.4, u * 0.05); ctx.fillStyle = '#c98a3e'; ctx.fill(); outline();
      ctx.fillStyle = '#e8b466'; rr(ctx, -u * 0.54, -u * 0.84, u * 0.4, u * 0.08, u * 0.03); ctx.fill();
      ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = Math.max(1, u * 0.04); ctx.beginPath(); ctx.moveTo(-u * 0.34, -u * 0.86); ctx.lineTo(-u * 0.34, -u * 0.46); ctx.stroke();
    }
    // ---- 翅膀（身后）----
    if (wingy) for (const s of [-1, 1]) {
      const fl = Math.sin(t * 16 + uid + (s > 0 ? 0.6 : 0));
      ctx.save(); ctx.translate(s * u * 0.2, -u * 0.62); ctx.rotate(s * (0.75 + fl * 0.4) - (s > 0 ? 0 : 0));
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * u * 0.1, -u * 0.5, s * u * 0.5, -u * 0.72, s * u * 0.76, -u * 0.5);
      ctx.quadraticCurveTo(s * u * 0.64, -u * 0.44, s * u * 0.7, -u * 0.34); ctx.quadraticCurveTo(s * u * 0.52, -u * 0.32, s * u * 0.54, -u * 0.2);
      ctx.quadraticCurveTo(s * u * 0.32, -u * 0.2, s * u * 0.3, -u * 0.08); ctx.closePath();
      ctx.fillStyle = fillG('#ffffff', '#d5def0', 0, -u * 0.7, 0, 0); ctx.fill(); outline();
      ctx.strokeStyle = 'rgba(120,140,180,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s * u * 0.05, -u * 0.1); ctx.quadraticCurveTo(s * u * 0.3, -u * 0.5, s * u * 0.66, -u * 0.46); ctx.stroke();
      ctx.restore();
    }
    // ---- 尾巴（蓬松，摆动）----
    const tw = Math.sin(t * 5 + uid + ph * 0.6) * 0.16;
    if (L.extra === 'fishtail') {
      ctx.save(); ctx.translate(-u * 0.12, -u * 0.22); ctx.rotate(tw);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-u * 0.4, -u * 0.05, -u * 0.62, -u * 0.34); ctx.quadraticCurveTo(-u * 0.5, -u * 0.06, -u * 0.66, u * 0.14); ctx.quadraticCurveTo(-u * 0.3, u * 0.08, 0, u * 0.06); ctx.closePath();
      ctx.fillStyle = '#4fb8d0'; ctx.fill(); outline(); ctx.restore();
    } else {
      ctx.save(); ctx.translate(-u * 0.2, -u * 0.3); ctx.rotate(-0.25 + tw);
      ctx.beginPath(); ctx.moveTo(0, u * 0.03);
      ctx.bezierCurveTo(-u * 0.3, u * 0.12, -u * 0.62, -u * 0.05, -u * 0.6, -u * 0.38);
      ctx.bezierCurveTo(-u * 0.5, -u * 0.28, -u * 0.42, -u * 0.3, -u * 0.34, -u * 0.24);
      ctx.bezierCurveTo(-u * 0.34, -u * 0.16, -u * 0.2, -u * 0.12, 0, -u * 0.1); ctx.closePath();
      ctx.fillStyle = fillG(body, dark, 0, -u * 0.4, 0, u * 0.1); ctx.fill(); outline();
      ctx.beginPath(); ctx.moveTo(-u * 0.6, -u * 0.38); ctx.bezierCurveTo(-u * 0.5, -u * 0.28, -u * 0.42, -u * 0.3, -u * 0.34, -u * 0.24); ctx.bezierCurveTo(-u * 0.44, -u * 0.44, -u * 0.52, -u * 0.44, -u * 0.6, -u * 0.38); ctx.fillStyle = belly; ctx.fill();
      ctx.restore();
    }
    // ---- 后侧手臂 ----
    const armSw = -step * u * 0.09;
    const arm = (sx, swing, front) => {
      const shx = sx * u * 0.26, shy = -u * 0.56, hx = sx * u * 0.36 + swing * 0.35, hy = -u * 0.33 + Math.abs(swing) * 0.15;
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(hx, hy); ctx.lineWidth = u * 0.15 + lw * 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(hx, hy); ctx.lineWidth = u * 0.15; ctx.strokeStyle = front ? body : dark; ctx.stroke();
      ell(ctx, hx, hy + u * 0.03, u * 0.085, u * 0.08, front ? light : body, OUT, lw);
      return [hx, hy];
    };
    arm(-1, armSw, false);
    // ---- 腿 ----
    if (L.extra === 'spring') { // 弹簧鞋
      ctx.strokeStyle = OUT; ctx.lineWidth = u * 0.09 + lw; ctx.beginPath(); for (let j = 0; j <= 8; j++) ctx.lineTo((j % 2 ? 1 : -1) * u * 0.24, -u * 0.02 - j * u * 0.034); ctx.stroke();
      ctx.strokeStyle = '#e8503a'; ctx.lineWidth = u * 0.07; ctx.beginPath(); for (let j = 0; j <= 8; j++) ctx.lineTo((j % 2 ? 1 : -1) * u * 0.24, -u * 0.02 - j * u * 0.034); ctx.stroke();
    }
    for (const k of [-1, 1]) {
      const phs = ph * 2.2 + (k > 0 ? Math.PI : 0), lift = fly ? 0 : Math.max(0, Math.sin(phs)) * u * 0.1;
      const hipX = k * u * 0.13, hipY = -u * 0.3;
      const fx = hipX + Math.cos(phs) * u * 0.05, fy = fly ? -u * 0.16 : -u * 0.06 - lift - (L.extra === 'spring' ? u * 0.3 : 0);
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(fx, fy); ctx.lineWidth = u * 0.17 + lw * 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(fx, fy); ctx.lineWidth = u * 0.17; ctx.strokeStyle = k < 0 ? dark : body; ctx.stroke();
      // 爪垫脚
      ctx.beginPath(); ctx.ellipse(fx + u * 0.03, fy + u * 0.02, u * 0.14, u * 0.075, 0, 0, Math.PI * 2); ctx.fillStyle = k < 0 ? deep : dark; ctx.fill(); outline();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (const dx of [-0.02, 0.05, 0.12]) { ctx.beginPath(); ctx.ellipse(fx + u * dx, fy + u * 0.005, u * 0.02, u * 0.03, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // ---- 躯干 ----
    ctx.beginPath(); ctx.moveTo(-u * 0.26, -u * 0.62);
    ctx.bezierCurveTo(-u * 0.36, -u * 0.4, -u * 0.3, -u * 0.14, -u * 0.12, -u * 0.13); ctx.lineTo(u * 0.12, -u * 0.13);
    ctx.bezierCurveTo(u * 0.3, -u * 0.14, u * 0.36, -u * 0.4, u * 0.26, -u * 0.62); ctx.closePath();
    ctx.fillStyle = fillG(light, dark, -u * 0.3, -u * 0.6, u * 0.3, -u * 0.15); ctx.fill(); outline();
    ctx.beginPath(); ctx.ellipse(u * 0.02, -u * 0.36, u * 0.16, u * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = belly; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-u * 0.22, -u * 0.5); ctx.quadraticCurveTo(-u * 0.29, -u * 0.32, -u * 0.18, -u * 0.18); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = u * 0.035; ctx.stroke();
    if (L.scarf) { // 围巾
      ctx.beginPath(); ctx.moveTo(-u * 0.3, -u * 0.64); ctx.quadraticCurveTo(0, -u * 0.5, u * 0.3, -u * 0.64); ctx.lineTo(u * 0.28, -u * 0.72); ctx.quadraticCurveTo(0, -u * 0.6, -u * 0.28, -u * 0.72); ctx.closePath(); ctx.fillStyle = L.scarf; ctx.fill(); outline();
      ctx.beginPath(); ctx.moveTo(u * 0.12, -u * 0.58); ctx.lineTo(u * 0.22, -u * 0.34 + Math.sin(t * 6) * u * 0.02); ctx.lineTo(u * 0.1, -u * 0.36); ctx.closePath(); ctx.fill(); outline();
    }
    bodyExtras(ctx, L, u, lw, t, w, { body, light, dark, belly, outline });
    const fh = arm(1, -armSw, true);
    if (L.extra === 'shield') { ell(ctx, fh[0] + u * 0.1, fh[1] - u * 0.06, u * 0.2, u * 0.26, '#7a8fb0', OUT, lw); ell(ctx, fh[0] + u * 0.1, fh[1] - u * 0.06, u * 0.1, u * 0.14, '#c9d6ea'); }

    // ---- 头 ----
    const hx = u * 0.04, hy = -u * 0.93, hrx = u * 0.5, hry = u * 0.43;
    // 耳朵
    const eflick = Math.sin(t * 4 + uid * 1.7) * 0.06;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(hx + s * u * 0.31, hy - u * 0.3); ctx.rotate(s * (0.42 + eflick));
      ctx.beginPath(); ctx.moveTo(-u * 0.14, u * 0.06); ctx.quadraticCurveTo(-u * 0.13, -u * 0.32, u * 0.02, -u * 0.44); ctx.quadraticCurveTo(u * 0.16, -u * 0.3, u * 0.15, u * 0.06); ctx.closePath();
      ctx.fillStyle = fillG(light, dark, 0, -u * 0.4, 0, u * 0.06); ctx.fill(); outline();
      ctx.beginPath(); ctx.moveTo(-u * 0.07, u * 0.02); ctx.quadraticCurveTo(-u * 0.06, -u * 0.22, u * 0.02, -u * 0.3); ctx.quadraticCurveTo(u * 0.09, -u * 0.2, u * 0.08, u * 0.02); ctx.closePath(); ctx.fillStyle = L.ear || '#f3a0a6'; ctx.fill();
      ctx.restore();
    }
    // 脸颊毛簇
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hx + s * hrx * 0.86, hy + hry * 0.05); ctx.lineTo(hx + s * (hrx + u * 0.13), hy + hry * 0.32); ctx.lineTo(hx + s * hrx * 0.94, hy + hry * 0.4); ctx.lineTo(hx + s * (hrx + u * 0.07), hy + hry * 0.66); ctx.lineTo(hx + s * hrx * 0.7, hy + hry * 0.72); ctx.closePath();
      ctx.fillStyle = s < 0 ? dark : body; ctx.fill(); outline();
    }
    // 头
    ctx.beginPath(); ctx.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(hx - hrx * 0.35, hy - hry * 0.5, hry * 0.1, hx, hy, hrx * 1.1); hg.addColorStop(0, shade(body, 0.3)); hg.addColorStop(0.55, body); hg.addColorStop(1, dark);
    ctx.fillStyle = hg; ctx.fill(); outline();
    // 额头毛
    ctx.fillStyle = dark; for (const dx of [-0.1, 0.02, 0.14]) { ctx.beginPath(); ctx.moveTo(hx + u * (dx - 0.06), hy - hry * 0.86); ctx.lineTo(hx + u * (dx + 0.01), hy - hry * 1.12); ctx.lineTo(hx + u * (dx + 0.08), hy - hry * 0.86); ctx.closePath(); ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = OUT; ctx.stroke(); }
    // 花纹
    faceMarks(ctx, L, u, hx, hy, hrx, hry, dark, lw);
    // 口鼻
    const mx = hx + u * 0.07, my = hy + u * 0.16;
    ctx.beginPath(); ctx.ellipse(mx, my, u * 0.3, u * 0.21, 0, 0, Math.PI * 2); ctx.fillStyle = fillG(shade(belly, 0.35), shade(belly, 0.08), 0, my - u * 0.21, 0, my + u * 0.21); ctx.fill(); outline();
    const angry = L.eye === 'angry';
    if (angry || def.boss) { // 张嘴龇牙
      ctx.beginPath(); ctx.moveTo(mx - u * 0.15, my + u * 0.05); ctx.quadraticCurveTo(mx, my + u * 0.24, mx + u * 0.15, my + u * 0.05); ctx.quadraticCurveTo(mx, my + u * 0.1, mx - u * 0.15, my + u * 0.05); ctx.fillStyle = '#8a1f2a'; ctx.fill(); outline();
      ctx.fillStyle = '#fff'; for (const dx of [-0.11, 0.09]) { ctx.beginPath(); ctx.moveTo(mx + u * dx, my + u * 0.06); ctx.lineTo(mx + u * (dx + 0.045), my + u * 0.06); ctx.lineTo(mx + u * (dx + 0.02), my + u * 0.15); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke(); }
    } else {
      ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.1, u * 0.045); ctx.beginPath(); ctx.moveTo(mx - u * 0.14, my + u * 0.06); ctx.quadraticCurveTo(mx - u * 0.07, my + u * 0.15, mx, my + u * 0.06); ctx.quadraticCurveTo(mx + u * 0.08, my + u * 0.16, mx + u * 0.16, my + u * 0.05); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx + u * 0.07, my + u * 0.085); ctx.lineTo(mx + u * 0.12, my + u * 0.085); ctx.lineTo(mx + u * 0.1, my + u * 0.16); ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = OUT; ctx.stroke();
    }
    const nose = L.hat === 'clown' ? '#e83a2c' : L.hat === 'antler' ? '#e83a2c' : '#231a1a';
    ctx.beginPath(); ctx.moveTo(mx - u * 0.09, my - u * 0.1); ctx.quadraticCurveTo(mx, my - u * 0.16, mx + u * 0.09, my - u * 0.1); ctx.quadraticCurveTo(mx + u * 0.07, my - u * 0.02, mx, my - u * 0.01); ctx.quadraticCurveTo(mx - u * 0.07, my - u * 0.02, mx - u * 0.09, my - u * 0.1); ctx.closePath();
    ctx.fillStyle = nose; ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = OUT; ctx.stroke();
    ell(ctx, mx - u * 0.03, my - u * 0.1, u * 0.025, u * 0.014, 'rgba(255,255,255,0.8)');
    // 眼睛
    for (const s of [-1, 1]) {
      const ex = hx + s * u * 0.185 + u * 0.03, ey = hy - u * 0.1;
      if (L.eye === 'sleepy') {
        ctx.beginPath(); ctx.ellipse(ex, ey, u * 0.11, u * 0.13, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); outline();
        ctx.beginPath(); ctx.ellipse(ex + u * 0.02, ey + u * 0.03, u * 0.05, u * 0.06, 0, 0, Math.PI * 2); ctx.fillStyle = '#1a1414'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex, ey - u * 0.02, u * 0.125, u * 0.08, 0, Math.PI, 0); ctx.lineTo(ex + u * 0.125, ey - u * 0.01); ctx.closePath(); ctx.fillStyle = dark; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - u * 0.12, ey - u * 0.01); ctx.lineTo(ex + u * 0.12, ey - u * 0.01); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = OUT; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.ellipse(ex, ey, u * 0.125, u * 0.15, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); outline();
        const px = ex + u * 0.035, py = ey + u * 0.012;
        ell(ctx, px, py, u * 0.085, u * 0.105, angry ? '#d9482c' : (L.iris || '#e2a92c'), '#7a4a12', Math.max(1, u * 0.02));
        ell(ctx, px, py, u * 0.045, u * 0.065, '#0c0c10');
        ell(ctx, px + u * 0.03, py - u * 0.04, u * 0.03, u * 0.033, '#fff'); ell(ctx, px - u * 0.025, py + u * 0.035, u * 0.014, u * 0.014, 'rgba(255,255,255,0.85)');
        ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.4, u * 0.07);
        ctx.beginPath();
        if (angry) { ctx.moveTo(ex - s * u * 0.15, ey - u * 0.24); ctx.lineTo(ex + s * u * 0.14, ey - u * 0.1); } else { ctx.moveTo(ex - u * 0.13, ey - u * 0.19); ctx.quadraticCurveTo(ex, ey - u * 0.27, ex + u * 0.13, ey - u * 0.19); }
        ctx.stroke();
      }
    }
    if (L.extra === 'shades') { rr(ctx, hx - u * 0.33, hy - u * 0.2, u * 0.66, u * 0.19, u * 0.06); ctx.fillStyle = '#12161c'; ctx.fill(); outline(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(hx - u * 0.27, hy - u * 0.18, u * 0.14, u * 0.035); ctx.fillRect(hx + u * 0.05, hy - u * 0.18, u * 0.14, u * 0.035); }
    if (L.extra === 'mask') { rr(ctx, hx - u * 0.38, hy - u * 0.2, u * 0.78, u * 0.17, u * 0.07); ctx.fillStyle = '#14141a'; ctx.fill(); outline(); for (const s of [-1, 1]) ell(ctx, hx + s * u * 0.17 + u * 0.03, hy - u * 0.115, u * 0.05, u * 0.035, '#f6f6ff'); }
    if (L.extra === 'patch') { ell(ctx, hx + u * 0.2, hy - u * 0.09, u * 0.13, u * 0.14, '#1a1414', OUT, lw); ctx.strokeStyle = '#1a1414'; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(hx + u * 0.08, hy - u * 0.2); ctx.lineTo(hx - u * 0.34, hy - u * 0.32); ctx.stroke(); }
    if (L.extra === 'gas') { ctx.beginPath(); ctx.ellipse(mx, my + u * 0.02, u * 0.26, u * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#4a5a44'; ctx.fill(); outline(); ell(ctx, mx, my + u * 0.06, u * 0.1, u * 0.1, '#2c342a', OUT, lw); ctx.strokeStyle = '#9db08f'; ctx.lineWidth = 1; for (const dy of [0.02, 0.06, 0.1]) { ctx.beginPath(); ctx.moveTo(mx - u * 0.06, my + u * dy); ctx.lineTo(mx + u * 0.06, my + u * dy); ctx.stroke(); } }
    // 腮红
    if (!flash) for (const s of [-1, 1]) ell(ctx, hx + s * u * 0.37, hy + u * 0.1, u * 0.07, u * 0.04, 'rgba(255,120,130,0.4)');
    // 高光
    ctx.beginPath(); ctx.ellipse(hx - hrx * 0.5, hy - hry * 0.62, hrx * 0.18, hry * 0.09, -0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();

    ctx.save(); ctx.translate(hx, hy - u * (L.hat === 'cap' || L.hat === 'feather' || L.hat === 'helmet' ? 0.17 : 0.11)); ctx.scale(1.14, 1.14); ctx.translate(-hx, -hy);
    hats(ctx, L, u, hx, hy, lw, t, def);
    ctx.restore();
    if (L.extra === 'mutant') for (let j = 0; j < 3; j++) { ell(ctx, hx - u * 0.25 + j * u * 0.25, hy - hry - u * 0.02, u * 0.08, u * 0.08, '#a9ff5a', OUT, lw); }
    if (L.extra === 'virus') for (let j = 0; j < 4; j++) { const a = j * 1.7 + t * 2; ell(ctx, Math.cos(a) * u * 0.6, -u * 0.8 + Math.sin(a) * u * 0.55, u * 0.07, u * 0.07, '#7cff5a'); }
    if (L.extra === 'frost') { ctx.strokeStyle = 'rgba(190,235,255,0.95)'; ctx.lineWidth = u * 0.05; for (let j = 0; j < 4; j++) { const a = j * 1.6 + t; ctx.beginPath(); ctx.moveTo(Math.cos(a) * u * 0.62, -u * 0.8 + Math.sin(a) * u * 0.6); ctx.lineTo(Math.cos(a) * u * 0.78, -u * 0.8 + Math.sin(a) * u * 0.72); ctx.stroke(); } }
    ctx.restore();
  };

  function faceMarks(ctx, L, u, hx, hy, hrx, hry, dark, lw) {
    switch (L.mark) {
      case 'cheeks': ctx.strokeStyle = dark; ctx.lineWidth = u * 0.045; for (const s of [-1, 1]) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.moveTo(hx + s * hrx * 0.95, hy + hry * (0.05 + j * 0.2)); ctx.lineTo(hx + s * hrx * 0.62, hy + hry * (0.12 + j * 0.2)); ctx.stroke(); } break;
      case 'stripes': ctx.fillStyle = dark; for (const dx of [-0.12, 0, 0.12]) { ctx.beginPath(); ctx.moveTo(hx + u * dx - u * 0.025, hy - hry * 0.98); ctx.lineTo(hx + u * dx + u * 0.025, hy - hry * 0.98); ctx.lineTo(hx + u * dx, hy - hry * 0.45); ctx.closePath(); ctx.fill(); } break;
      case 'spots': ctx.fillStyle = dark; for (const [dx, dy, r] of [[-0.3, -0.2, 0.05], [0.28, -0.24, 0.045], [-0.2, -0.28, 0.035], [0.34, -0.02, 0.035]]) { ctx.beginPath(); ctx.arc(hx + u * dx, hy + u * dy, u * r, 0, 7); ctx.fill(); } break;
      case 'brow': ctx.strokeStyle = shade(L.body, -0.55); ctx.lineWidth = u * 0.06; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * u * 0.06, hy - u * 0.24); ctx.lineTo(hx + s * u * 0.27, hy - u * 0.28); ctx.stroke(); } break;
      case 'scar': ctx.strokeStyle = 'rgba(160,40,40,0.9)'; ctx.lineWidth = u * 0.035; ctx.beginPath(); ctx.moveTo(hx - u * 0.28, hy - u * 0.28); ctx.lineTo(hx - u * 0.1, hy + u * 0.04); ctx.stroke(); ctx.lineWidth = u * 0.02; for (const d of [0.05, 0.13]) { ctx.beginPath(); ctx.moveTo(hx - u * (0.28 - d) - u * 0.04, hy - u * (0.28 - d * 1.6) + u * 0.02); ctx.lineTo(hx - u * (0.28 - d) + u * 0.04, hy - u * (0.28 - d * 1.6) - u * 0.02); ctx.stroke(); } break;
    }
  }

  function bodyExtras(ctx, L, u, lw, t, w, C) {
    switch (L.extra) {
      case 'muscle': ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = u * 0.04; ctx.beginPath(); ctx.arc(-u * 0.1, -u * 0.44, u * 0.13, 0.3, 2.6); ctx.stroke(); ctx.beginPath(); ctx.arc(u * 0.14, -u * 0.44, u * 0.13, 0.6, 2.9); ctx.stroke(); ell(ctx, -u * 0.32, -u * 0.5, u * 0.11, u * 0.13, C.body, OUT, lw); ell(ctx, u * 0.34, -u * 0.5, u * 0.11, u * 0.13, C.light, OUT, lw); break;
      case 'bomb': ell(ctx, 0, -u * 0.34, u * 0.19, u * 0.19, '#2a2a30', OUT, lw); ell(ctx, -u * 0.06, -u * 0.4, u * 0.05, u * 0.035, 'rgba(255,255,255,0.5)'); ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = u * 0.05; ctx.beginPath(); ctx.moveTo(0, -u * 0.52); ctx.quadraticCurveTo(u * 0.1, -u * 0.66, u * 0.2, -u * 0.6); ctx.stroke(); ell(ctx, u * 0.21, -u * 0.61, u * 0.05 + Math.sin(t * 20) * u * 0.02, u * 0.05, '#ffb02a'); break;
      case 'stitch': ctx.strokeStyle = '#2f2a28'; ctx.lineWidth = u * 0.04; ctx.beginPath(); ctx.moveTo(-u * 0.14, -u * 0.6); ctx.lineTo(u * 0.1, -u * 0.22); ctx.stroke(); for (let j = 0; j < 4; j++) { const px = -u * 0.1 + j * u * 0.06, py = -u * 0.54 + j * u * 0.1; ctx.beginPath(); ctx.moveTo(px - u * 0.04, py - u * 0.03); ctx.lineTo(px + u * 0.04, py + u * 0.03); ctx.stroke(); } ell(ctx, -u * 0.27, -u * 0.62, u * 0.04, u * 0.04, '#9aa3ab', OUT, 1); ell(ctx, u * 0.27, -u * 0.62, u * 0.04, u * 0.04, '#9aa3ab', OUT, 1); break;
      case 'gear': ctx.fillStyle = '#5b636c'; ctx.beginPath(); for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2 + t, r = j % 2 ? u * 0.11 : u * 0.17; ctx.lineTo(Math.cos(a) * r, -u * 0.38 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke(); ell(ctx, 0, -u * 0.38, u * 0.04, u * 0.04, '#d8dde2'); break;
      case 'fleece': for (const [dx, dy, r] of [[-0.24, -0.6, 0.11], [-0.08, -0.66, 0.12], [0.1, -0.66, 0.12], [0.26, -0.6, 0.11], [-0.3, -0.42, 0.1], [0.3, -0.42, 0.1], [-0.2, -0.28, 0.09], [0.2, -0.28, 0.09]]) ell(ctx, u * dx, u * dy, u * r, u * r * 0.92, '#fffdf4', OUT, Math.max(1, lw * 0.8)); break;
      case 'parachute': ctx.beginPath(); ctx.arc(0, -u * 1.85, u * 0.7, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#ff6b5a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-u * 0.7, -u * 1.85); ctx.lineTo(-u * 0.2, -u * 0.7); ctx.moveTo(u * 0.7, -u * 1.85); ctx.lineTo(u * 0.2, -u * 0.7); ctx.moveTo(0, -u * 1.85); ctx.lineTo(0, -u * 1.3); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, -u * 1.85, u * 0.7, Math.PI * 1.15, Math.PI * 1.5); ctx.lineTo(0, -u * 1.85); ctx.fill(); break;
    }
  }

  function hats(ctx, L, u, hx, hy, lw, t, def) {
    const hc = L.hatc, top = hy - u * 0.34;
    const OUTL = () => { ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke(); };
    switch (L.hat) {
      case 'nurse': rr(ctx, hx - u * 0.28, top - u * 0.14, u * 0.56, u * 0.26, u * 0.05); ctx.fillStyle = '#fff'; ctx.fill(); OUTL(); ctx.fillStyle = '#e83a4a'; ctx.fillRect(hx - u * 0.04, top - u * 0.1, u * 0.08, u * 0.18); ctx.fillRect(hx - u * 0.1, top - u * 0.05, u * 0.2, u * 0.08); break;
      case 'wizard': ctx.beginPath(); ctx.moveTo(hx - u * 0.38, top + u * 0.08); ctx.quadraticCurveTo(hx - u * 0.1, top - u * 0.1, hx + u * 0.05, top - u * 0.78); ctx.quadraticCurveTo(hx + u * 0.16, top - u * 0.2, hx + u * 0.38, top + u * 0.08); ctx.closePath(); ctx.fillStyle = hc || '#6a4bb5'; ctx.fill(); OUTL(); ctx.fillStyle = '#ffd23f'; ctx.fillRect(hx - u * 0.32, top - u * 0.03, u * 0.64, u * 0.07); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(hx - u * 0.3, top); ctx.quadraticCurveTo(hx - u * 0.05, top - u * 0.2, hx + u * 0.02, top - u * 0.7); ctx.lineTo(hx - u * 0.06, top - u * 0.1); ctx.fill(); ell(ctx, hx + u * 0.02, top - u * 0.3, u * 0.05, u * 0.05, '#ffd23f'); break;
      case 'ninja': rr(ctx, hx - u * 0.42, hy - u * 0.36, u * 0.84, u * 0.24, u * 0.06); ctx.fillStyle = hc || '#20242c'; ctx.fill(); OUTL(); ctx.beginPath(); ctx.moveTo(hx - u * 0.4, hy - u * 0.24); ctx.lineTo(hx - u * 0.78, hy - u * 0.04 + Math.sin(t * 6) * u * 0.03); ctx.lineTo(hx - u * 0.62, hy - u * 0.32); ctx.fill(); OUTL(); ctx.fillStyle = '#c9c9d4'; rr(ctx, hx - u * 0.1, hy - u * 0.34, u * 0.2, u * 0.16, u * 0.03); ctx.fill(); break;
      case 'bandana': rr(ctx, hx - u * 0.42, hy - u * 0.34, u * 0.84, u * 0.16, u * 0.05); ctx.fillStyle = hc || '#c0392b'; ctx.fill(); OUTL(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (const dx of [-0.25, -0.08, 0.1, 0.27]) ell(ctx, hx + u * dx, hy - u * 0.26, u * 0.025, u * 0.025, 'rgba(255,255,255,0.7)'); break;
      case 'cap': ctx.beginPath(); ctx.arc(hx, hy - u * 0.1, u * 0.4, Math.PI, 0); ctx.closePath(); ctx.fillStyle = hc || '#3f7a3a'; ctx.fill(); OUTL(); rr(ctx, hx + u * 0.02, hy - u * 0.16, u * 0.5, u * 0.08, u * 0.03); ctx.fillStyle = shade(hc || '#3f7a3a', -0.2); ctx.fill(); OUTL(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(hx, hy - u * 0.1, u * 0.34, Math.PI * 1.1, Math.PI * 1.45); ctx.lineTo(hx, hy - u * 0.1); ctx.fill(); break;
      case 'helmet': ctx.beginPath(); ctx.arc(hx, hy - u * 0.04, u * 0.44, Math.PI * 1.03, Math.PI * 1.97); ctx.closePath(); ctx.fillStyle = hc || '#8a9099'; ctx.fill(); OUTL(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(hx, hy - u * 0.04, u * 0.38, Math.PI * 1.15, Math.PI * 1.45); ctx.lineTo(hx, hy - u * 0.04); ctx.fill(); ctx.fillStyle = shade(hc || '#8a9099', -0.3); ctx.fillRect(hx - u * 0.02, hy - u * 0.48, u * 0.04, u * 0.12); break;
      case 'horn': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * u * 0.2, top + u * 0.05); ctx.quadraticCurveTo(hx + s * u * 0.55, top - u * 0.05, hx + s * u * 0.4, top - u * 0.45); ctx.quadraticCurveTo(hx + s * u * 0.3, top - u * 0.15, hx + s * u * 0.08, top + u * 0.03); ctx.fillStyle = '#efe9d6'; ctx.fill(); OUTL(); } break;
      case 'spikes': for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(hx + j * u * 0.17 - u * 0.08, top + u * 0.08); ctx.lineTo(hx + j * u * 0.17, top - u * 0.28); ctx.lineTo(hx + j * u * 0.17 + u * 0.08, top + u * 0.08); ctx.fillStyle = '#ffdc3a'; ctx.fill(); OUTL(); } break;
      case 'turban': ell(ctx, hx, hy - u * 0.27, u * 0.4, u * 0.22, hc || '#f4f0e0', OUT, lw); ctx.strokeStyle = shade(hc || '#f4f0e0', -0.15); ctx.lineWidth = u * 0.03; for (const dx of [-0.2, 0, 0.2]) { ctx.beginPath(); ctx.moveTo(hx + u * dx - u * 0.12, hy - u * 0.14); ctx.quadraticCurveTo(hx + u * dx, hy - u * 0.44, hx + u * dx + u * 0.12, hy - u * 0.14); ctx.stroke(); } ell(ctx, hx, hy - u * 0.36, u * 0.06, u * 0.06, '#e94a6b', OUT, 1); break;
      case 'nightcap': ctx.beginPath(); ctx.moveTo(hx - u * 0.38, hy - u * 0.2); ctx.quadraticCurveTo(hx - u * 0.1, hy - u * 0.78, hx - u * 0.54, hy - u * 0.46); ctx.lineTo(hx + u * 0.34, hy - u * 0.2); ctx.closePath(); ctx.fillStyle = hc || '#5b7cd6'; ctx.fill(); OUTL(); ell(ctx, hx - u * 0.54, hy - u * 0.46, u * 0.08, u * 0.08, '#fff', OUT, 1); rr(ctx, hx - u * 0.4, hy - u * 0.28, u * 0.76, u * 0.1, u * 0.04); ctx.fillStyle = '#fff'; ctx.fill(); OUTL(); break;
      case 'feather': ctx.beginPath(); ctx.arc(hx, hy - u * 0.1, u * 0.4, Math.PI, 0); ctx.closePath(); ctx.fillStyle = hc || '#3f7a3a'; ctx.fill(); OUTL(); ctx.beginPath(); ctx.moveTo(hx - u * 0.1, top); ctx.quadraticCurveTo(hx - u * 0.4, top - u * 0.35, hx - u * 0.12, top - u * 0.6); ctx.strokeStyle = '#e94a4a'; ctx.lineWidth = u * 0.08; ctx.stroke(); break;
      case 'clown': for (const s of [-1, 1]) ell(ctx, hx + s * u * 0.28, top + u * 0.05, u * 0.17, u * 0.15, hc || '#e94a6b', OUT, lw); break;
      case 'crown': ctx.beginPath(); ctx.moveTo(hx - u * 0.26, top + u * 0.08); ctx.lineTo(hx - u * 0.3, top - u * 0.3); ctx.lineTo(hx - u * 0.1, top - u * 0.12); ctx.lineTo(hx, top - u * 0.36); ctx.lineTo(hx + u * 0.1, top - u * 0.12); ctx.lineTo(hx + u * 0.3, top - u * 0.3); ctx.lineTo(hx + u * 0.26, top + u * 0.08); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); OUTL(); ell(ctx, hx, top - u * 0.02, u * 0.04, u * 0.04, '#e94a6b'); break;
      case 'flower': ell(ctx, hx - u * 0.14, top + u * 0.04, u * 0.15, u * 0.15, '#ff7ab8', OUT, 1); for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2; ell(ctx, hx - u * 0.14 + Math.cos(a) * u * 0.1, top + u * 0.04 + Math.sin(a) * u * 0.1, u * 0.06, u * 0.06, '#ffa6d0'); } ell(ctx, hx - u * 0.14, top + u * 0.04, u * 0.05, u * 0.05, '#ffe14a'); break;
      case 'antler': for (const s of [-1, 1]) { ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = u * 0.07; ctx.beginPath(); ctx.moveTo(hx + s * u * 0.14, top + u * 0.06); ctx.lineTo(hx + s * u * 0.28, top - u * 0.38); ctx.moveTo(hx + s * u * 0.22, top - u * 0.18); ctx.lineTo(hx + s * u * 0.44, top - u * 0.26); ctx.stroke(); } break;
      case 'tree': ctx.beginPath(); ctx.moveTo(hx - u * 0.44, top + u * 0.1); ctx.lineTo(hx, top - u * 0.7); ctx.lineTo(hx + u * 0.44, top + u * 0.1); ctx.closePath(); ctx.fillStyle = '#2f8a58'; ctx.fill(); OUTL(); ctx.fillStyle = '#3aa86a'; ctx.beginPath(); ctx.moveTo(hx - u * 0.3, top + u * 0.05); ctx.lineTo(hx, top - u * 0.5); ctx.lineTo(hx, top + u * 0.05); ctx.fill(); ell(ctx, hx, top - u * 0.72, u * 0.06, u * 0.06, '#ffd23f'); break;
      case 'vamp': ctx.beginPath(); ctx.moveTo(hx - u * 0.4, hy - u * 0.2); ctx.lineTo(hx - u * 0.4, hy - u * 0.54); ctx.lineTo(hx - u * 0.1, hy - u * 0.32); ctx.lineTo(hx + u * 0.05, hy - u * 0.6); ctx.lineTo(hx + u * 0.2, hy - u * 0.32); ctx.lineTo(hx + u * 0.42, hy - u * 0.54); ctx.lineTo(hx + u * 0.4, hy - u * 0.2); ctx.closePath(); ctx.fillStyle = '#20182a'; ctx.fill(); OUTL(); break;
      case 'ribbon': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx, top); ctx.quadraticCurveTo(hx + s * u * 0.22, top - u * 0.22, hx + s * u * 0.32, top - u * 0.02); ctx.quadraticCurveTo(hx + s * u * 0.2, top + u * 0.08, hx, top); ctx.fillStyle = '#ff5a9a'; ctx.fill(); OUTL(); } ell(ctx, hx, top, u * 0.06, u * 0.06, '#ff8ab8', OUT, 1); break;
      case 'halo': ctx.strokeStyle = 'rgba(255,225,74,0.5)'; ctx.lineWidth = u * 0.13; ctx.beginPath(); ctx.ellipse(hx, top - u * 0.22, u * 0.28, u * 0.09, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = u * 0.06; ctx.beginPath(); ctx.ellipse(hx, top - u * 0.22, u * 0.28, u * 0.09, 0, 0, Math.PI * 2); ctx.stroke(); break;
      case 'mohawk': for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.moveTo(hx - u * 0.3 + j * u * 0.15, top + u * 0.1); ctx.lineTo(hx - u * 0.22 + j * u * 0.15, top - u * 0.4 + Math.abs(j - 2) * u * 0.08); ctx.lineTo(hx - u * 0.1 + j * u * 0.15, top + u * 0.1); ctx.fillStyle = '#ff4fa0'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke(); } break;
      case 'opera': ctx.beginPath(); ctx.moveTo(hx - u * 0.32, top + u * 0.06); ctx.lineTo(hx - u * 0.22, top - u * 0.24); ctx.lineTo(hx + u * 0.22, top - u * 0.24); ctx.lineTo(hx + u * 0.32, top + u * 0.06); ctx.closePath(); ctx.fillStyle = '#c0392b'; ctx.fill(); OUTL(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = u * 0.05; ctx.beginPath(); ctx.moveTo(hx + u * 0.22, top - u * 0.22); ctx.quadraticCurveTo(hx + u * 0.62, top - u * 0.52, hx + u * 0.72, top - u * 0.1); ctx.stroke(); break;
    }
  }

  // 精灵缓存：按 (id, 帧, 尺寸) 预渲染，绘制时只需 drawImage
  const wolfSprites = new Map();
  function wolfSprite(w, u, ph, t) {
    const sc = SV.view ? SV.view.scale : 1;
    const def = w.def, L = look(def);
    const wingy = L.extra === 'wings' || L.ex2 === 'wings' || w.fly;
    const lf = Math.floor((((ph * 2.2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * 8) % 8;
    const wf = wingy ? Math.floor(((t * 16) % (Math.PI * 2)) / (Math.PI * 2) * 4) % 4 : 0;
    const key = def.id + '|' + (w.fly ? 1 : 0) + '|' + Math.round(u * sc) + '|' + lf + '|' + wf + '|' + (def.boss ? 1 : 0);
    let sp = wolfSprites.get(key);
    if (sp) return sp;
    const W = u * 4.4, H = u * 3.4;
    const cv = Art.mkCanvas(W * sc, H * sc);
    const cx = cv.getContext('2d');
    cx.scale(sc, sc);
    cx.translate(W / 2, H * 3.1 / 3.4);
    const pw = { def, fly: w.fly, walk: (lf + 0.5) / 8 * Math.PI * 2 / 2.2, uid: 0, elite: false, boss: false };
    Art._paintWolf(cx, pw, u, wf * Math.PI * 2 / 4 / 16 + lf * 0.05, false);
    sp = { c: cv, W, H, white: null, sc };
    sp.getWhite = function () {
      if (this.white) return this.white;
      const c2 = Art.mkCanvas(this.c.width, this.c.height), x2 = c2.getContext('2d');
      x2.drawImage(this.c, 0, 0); x2.globalCompositeOperation = 'source-atop'; x2.fillStyle = 'rgba(255,255,255,0.85)'; x2.fillRect(0, 0, c2.width, c2.height);
      return this.white = c2;
    };
    if (wolfSprites.size > 900) wolfSprites.clear();
    wolfSprites.set(key, sp);
    return sp;
  }
  Art._wolfSprite = wolfSprite;

  Art.drawWolf = function (ctx, w, x, y, cs, t, sel) {
    const def = w.def, L = look(def);
    const u = cs * 0.5 * def.size * (L.s || 1) * (w.elite ? 1.25 : 1) * (w.boss ? 1.1 : 1);
    const dir = w.dir >= 0 ? 1 : -1;
    const fly = w.fly;
    const ph = w.walk;
    const bob = Math.abs(Math.sin(ph * 1.2)) * u * 0.1;
    const lift = fly ? cs * 0.42 + Math.sin(t * 5 + w.uid) * cs * 0.04 : 0;
    const alpha = w.invis ? 0.32 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ell(ctx, x, y + u * 0.06, u * (fly ? 0.45 : 0.62), u * 0.14, 'rgba(0,0,0,' + (fly ? 0.14 : 0.24) + ')');
    ctx.translate(x, y - lift - bob);
    ctx.scale(dir, 1);
    const sp = wolfSprite(w, u, ph, t + w.uid * 0.37);
    ctx.drawImage(w.hitFlash > 0 ? sp.getWhite() : sp.c, -sp.W / 2, -sp.H * 3.1 / 3.4, sp.W, sp.H);
    ctx.restore();

    Art.drawWolfOverlay(ctx, w, x, y - lift - bob, cs, t, sel, u, -u * 1.7);
  };

  /* 血条 / 状态特效 / BOSS 名牌 / 选中圈。程序化狼和原作模型狼共用（原作模型只负责画身体）。
     (x,y) 是脚底；u 是「半个身位」的尺度；top 是头顶（负数，相对脚底）。 */
  Art.drawWolfOverlay = function (ctx, w, x, y, cs, t, sel, u, top) {
    const def = w.def;
    ctx.save();
    ctx.translate(x, y);
    // 状态特效优先用原作素材（js/art_fx_original.js）；它画过的状态，程序化版本就跳过
    const OF = Art.origFx, own = (OF && OF.status(ctx, w, cs, t, u, top)) || {};
    if (!own.slow && w.slows && w.slows.length && w.burnT <= 0) { ell(ctx, 0, -u * 0.7, u * 0.78, u * 0.78, 'rgba(120,200,255,0.16)', 'rgba(140,210,255,0.7)', 1.5); }
    if (!own.poison && w.poisons && w.poisons.length) { for (let j = 0; j < 3; j++) { const bt = (t * 0.9 + j * 0.33) % 1; ell(ctx, Math.sin(j * 2.3 + t) * u * 0.4, -u * 0.5 - bt * u * 0.9, u * 0.07, u * 0.07, 'rgba(90,220,90,' + (1 - bt) + ')'); } }
    if (!own.burn && w.burnT > 0) { for (let j = 0; j < 3; j++) { const bt = (t * 1.6 + j * 0.33) % 1; ctx.fillStyle = 'rgba(255,' + Math.round(120 + 80 * bt) + ',30,' + (1 - bt) + ')'; ctx.beginPath(); ctx.ellipse((j - 1) * u * 0.3, -u * 0.6 - bt * u * 0.8, u * 0.11 * (1 - bt * 0.5), u * 0.16, 0, 0, Math.PI * 2); ctx.fill(); } }
    if (!own.stun && w.stunT > 0) { for (let j = 0; j < 3; j++) { const a = t * 6 + j * 2.1; ctx.fillStyle = '#ffd23f'; ctx.font = Math.round(u * 0.35) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', Math.cos(a) * u * 0.4, top - u * 0.1 + Math.sin(a) * u * 0.12); } }
    if (!own.curse && w.curse) { ell(ctx, 0, -u * 0.7, u * 0.85, u * 0.8, 'rgba(60,20,90,0.28)', 'rgba(150,80,220,0.8)', 2); }
    if (!own.shield && w.shield > 0) { ell(ctx, 0, -u * 0.7, u * 0.88, u * 0.84, 'rgba(120,210,255,0.18)', 'rgba(150,220,255,0.9)', 2); }
    if (!own.silence && w.silT > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(u * 0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('…', 0, top); }
    if (sel && OF && OF.focus(ctx, w, cs, t, u, top)) { /* 原作的焦点箭头 */ }
    else if (sel) { ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.ellipse(0, -u * 0.7, u * 0.9, u * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    if (w.noBar) { ctx.restore(); return; }
    const bw = Math.max(cs * 0.6, u * 1.2) * (w.boss ? 1.3 : 1), bh = Math.max(3, cs * (w.boss ? 0.1 : 0.075));
    const frac = Math.max(0, w.hp / w.maxhp);
    const by = top - u * 0.12;
    rr(ctx, -bw / 2 - 1, by - 1, bw + 2, bh + 2, bh / 2); ctx.fillStyle = 'rgba(20,10,5,0.75)'; ctx.fill();
    if (frac > 0) { rr(ctx, -bw / 2, by, Math.max(bh, bw * frac), bh, bh / 2); ctx.fillStyle = frac > 0.6 ? '#5fd35a' : frac > 0.3 ? '#f5c33b' : '#ee4b3a'; ctx.fill(); }
    if (w.shield > 0) { rr(ctx, -bw / 2, by - bh * 0.5, bw * Math.min(1, w.shield / w.maxhp * 3), bh * 0.5, 1); ctx.fillStyle = '#8fdcff'; ctx.fill(); }
    if (w.boss || w.elite) {
      ctx.font = 'bold ' + Math.round(cs * 0.22) + 'px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,5,0.85)';
      ctx.strokeText(def.n + (w.elite ? '·精英' : ''), 0, by - 3); ctx.fillStyle = w.boss ? '#ffd23f' : '#ffb27a'; ctx.fillText(def.n + (w.elite ? '·精英' : ''), 0, by - 3);
    }
    ctx.restore();
  };

  /* ============================================================
   *  羊（脚底为原点；s = 身高约 0.95s；opts: dir, bell, mood, speed）
   *  mood: idle | happy | scared | cry | angry | sleep
   * ============================================================ */
  const WOOL = ['#fffdf7', '#f2eef8', '#d9d4ea'];      // 亮 / 中 / 影
  Art.drawSheep = function (ctx, x, y, s, t, opts) {
    opts = opts || {};
    const dir = opts.dir || 1, mood = opts.mood || 'idle';
    const bob = Math.abs(Math.sin(t * (opts.speed || 4))) * s * (mood === 'sleep' ? 0.01 : 0.05);
    const lw = Math.max(1.2, s * 0.045);
    const blink = (t % 3.2) > 3.05;
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(dir, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ell(ctx, 0, s * 0.02, s * 0.36, s * 0.07, 'rgba(0,0,0,0.2)');
    // 腿 + 蹄
    for (const k of [-1, 1]) {
      const sw = Math.sin(t * (opts.speed || 4) * 1.5 + (k > 0 ? Math.PI : 0)) * s * 0.025;
      ctx.beginPath(); ctx.moveTo(k * s * 0.13, -s * 0.22); ctx.lineTo(k * s * 0.13 + sw, -s * 0.04); ctx.lineWidth = s * 0.11 + lw * 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = s * 0.11; ctx.strokeStyle = '#5a4436'; ctx.stroke();
      ell(ctx, k * s * 0.13 + sw, -s * 0.03, s * 0.075, s * 0.04, '#2f2420', OUT, lw * 0.8);
    }
    // 尾巴
    ell(ctx, -s * 0.33, -s * 0.32, s * 0.08, s * 0.07, WOOL[0], OUT, lw);
    // 身体：一圈绒球形成云朵轮廓
    const puffs = [];
    const N = 11;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; puffs.push([Math.cos(a) * s * 0.29, -s * 0.42 + Math.sin(a) * s * 0.23, s * (0.13 + 0.015 * Math.sin(i * 2.3))]); }
    puffs.push([0, -s * 0.42, s * 0.3]);
    for (const [px, py, pr] of puffs) ell(ctx, px, py, pr, pr, WOOL[0], OUT, lw * 1.15);
    for (const [px, py, pr] of puffs) ell(ctx, px, py, pr - lw * 0.5, pr - lw * 0.5, WOOL[0]);
    // 阴影（右下）与高光（左上）
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -s * 0.42, s * 0.4, s * 0.34, 0, 0, Math.PI * 2); ctx.clip();
    ell(ctx, s * 0.12, -s * 0.2, s * 0.42, s * 0.3, A(WOOL[2], 0.65));
    ell(ctx, -s * 0.16, -s * 0.6, s * 0.16, s * 0.08, 'rgba(255,255,255,0.75)');
    ctx.restore();
    // 毛卷
    ctx.strokeStyle = 'rgba(150,140,190,0.55)'; ctx.lineWidth = Math.max(1, s * 0.022);
    for (const [cx0, cy0] of [[-0.22, -0.38], [0.18, -0.3], [-0.06, -0.24], [0.26, -0.5], [-0.28, -0.52]]) { ctx.beginPath(); ctx.arc(cx0 * s, cy0 * s, s * 0.045, 0.3, Math.PI * 1.5); ctx.stroke(); }
    // 头
    const hy = -s * 0.66, ear = Math.sin(t * 3.5) * 0.08 * (mood === 'sleep' ? 0.2 : 1);
    // 耳朵（垂耳）
    for (const k of [-1, 1]) {
      ctx.save(); ctx.translate(k * s * 0.24, hy + s * 0.02); ctx.rotate(k * (0.85 + ear) * (mood === 'scared' ? 0.6 : mood === 'angry' ? 1.1 : 1));
      ctx.beginPath(); ctx.ellipse(0, s * 0.06, s * 0.075, s * 0.16, 0, 0, Math.PI * 2); ctx.fillStyle = '#f2cdb0'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke();
      ell(ctx, 0, s * 0.07, s * 0.035, s * 0.09, '#f6a8b0');
      ctx.restore();
    }
    // 卷角
    for (const k of [-1, 1]) {
      ctx.save(); ctx.translate(k * s * 0.17, hy - s * 0.17);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(k * s * 0.16, -s * 0.1, k * s * 0.3, s * 0.02, k * s * 0.2, s * 0.12); ctx.bezierCurveTo(k * s * 0.14, s * 0.18, k * s * 0.06, s * 0.12, k * s * 0.1, s * 0.06);
      ctx.lineWidth = s * 0.08 + lw * 2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = s * 0.08; ctx.strokeStyle = '#d99a4a'; ctx.stroke();
      ctx.lineWidth = s * 0.025; ctx.strokeStyle = '#f3c884'; ctx.beginPath(); ctx.moveTo(k * s * 0.02, -s * 0.02); ctx.bezierCurveTo(k * s * 0.14, -s * 0.1, k * s * 0.24, -s * 0.02, k * s * 0.2, s * 0.06); ctx.stroke();
      ctx.restore();
    }
    // 脸
    ctx.beginPath(); ctx.ellipse(0, hy, s * 0.26, s * 0.235, 0, 0, Math.PI * 2);
    const fg = ctx.createRadialGradient(-s * 0.08, hy - s * 0.1, s * 0.02, 0, hy, s * 0.3); fg.addColorStop(0, '#fff0de'); fg.addColorStop(1, '#f1cba6');
    ctx.fillStyle = fg; ctx.fill(); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = OUT; ctx.stroke();
    // 头顶毛绒刘海
    for (const [bx, by, br] of [[-0.12, -0.19, 0.09], [0, -0.22, 0.1], [0.12, -0.19, 0.09]]) ell(ctx, bx * s, hy + by * s, br * s, br * s * 0.9, WOOL[0], OUT, lw);
    for (const [bx, by, br] of [[-0.12, -0.19, 0.09], [0, -0.22, 0.1], [0.12, -0.19, 0.09]]) ell(ctx, bx * s, hy + by * s, br * s - lw * 0.4, br * s * 0.9 - lw * 0.4, WOOL[0]);
    // 表情
    const ex = s * 0.105, ey = hy + s * 0.01;
    const eye = (k) => {
      const cx0 = k * ex;
      if (mood === 'happy' || (mood === 'idle' && blink) || mood === 'sleep') {
        ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3; ctx.beginPath();
        if (mood === 'happy') { ctx.arc(cx0, ey + s * 0.02, s * 0.05, Math.PI * 1.1, Math.PI * 1.9); } else { ctx.moveTo(cx0 - s * 0.05, ey); ctx.quadraticCurveTo(cx0, ey + s * 0.035, cx0 + s * 0.05, ey); }
        ctx.stroke();
      } else if (mood === 'cry') {
        ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.3; ctx.beginPath(); ctx.moveTo(cx0 - s * 0.05, ey + s * 0.02); ctx.quadraticCurveTo(cx0, ey - s * 0.03, cx0 + s * 0.05, ey + s * 0.02); ctx.stroke();
      } else {
        const big = mood === 'scared' ? 1.15 : 1;
        ell(ctx, cx0, ey, s * 0.062 * big, s * 0.078 * big, '#fff', OUT, Math.max(1, lw * 0.5));
        const off = mood === 'scared' ? 0 : s * 0.012;
        if (mood !== 'scared') { ell(ctx, cx0 + off, ey + s * 0.006, s * 0.045, s * 0.058, '#5a3a22'); }
        ell(ctx, cx0 + off, ey + s * 0.006, s * (mood === 'scared' ? 0.02 : 0.03), s * (mood === 'scared' ? 0.026 : 0.042), '#1e1410');
        if (mood !== 'scared') { ell(ctx, cx0 + off + s * 0.014, ey - s * 0.016, s * 0.017, s * 0.019, '#fff'); ell(ctx, cx0 + off - s * 0.012, ey + s * 0.022, s * 0.008, s * 0.008, 'rgba(255,255,255,0.8)'); }
      }
    };
    eye(-1); eye(1);
    if (mood === 'angry') { ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.5; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * s * 0.17, ey - s * 0.11); ctx.lineTo(k * s * 0.05, ey - s * 0.065); ctx.stroke(); } }
    if (mood === 'scared') { ctx.strokeStyle = OUT; ctx.lineWidth = lw; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * s * 0.16, ey - s * 0.1); ctx.lineTo(k * s * 0.06, ey - s * 0.115); ctx.stroke(); } ell(ctx, s * 0.22, hy - s * 0.1 + Math.sin(t * 5) * s * 0.01, s * 0.03, s * 0.045, '#9fdcff', OUT, 1); }
    if (mood === 'cry') for (const k of [-1, 1]) { const f = (t * 1.8 + (k > 0 ? 0.5 : 0)) % 1; ctx.fillStyle = 'rgba(120,200,255,0.85)'; ctx.beginPath(); ctx.ellipse(k * ex * 1.15, ey + s * 0.05 + f * s * 0.12, s * 0.02, s * 0.03, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(k * ex * 1.15 - s * 0.012, ey + s * 0.03, s * 0.024, f * s * 0.12); }
    // 鼻子 + 嘴
    ell(ctx, 0, hy + s * 0.07, s * 0.032, s * 0.022, '#e58a8f', OUT, lw * 0.6);
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.9; ctx.beginPath();
    if (mood === 'happy') { ctx.moveTo(-s * 0.06, hy + s * 0.1); ctx.quadraticCurveTo(0, hy + s * 0.17, s * 0.06, hy + s * 0.1); }
    else if (mood === 'scared' || mood === 'cry') { ctx.moveTo(-s * 0.05, hy + s * 0.14); ctx.quadraticCurveTo(-s * 0.025, hy + s * 0.11, 0, hy + s * 0.14); ctx.quadraticCurveTo(s * 0.025, hy + s * 0.17, s * 0.05, hy + s * 0.14); }
    else if (mood === 'angry') { ctx.moveTo(-s * 0.05, hy + s * 0.14); ctx.quadraticCurveTo(0, hy + s * 0.1, s * 0.05, hy + s * 0.14); }
    else { ctx.moveTo(-s * 0.05, hy + s * 0.11); ctx.quadraticCurveTo(0, hy + s * 0.15, s * 0.05, hy + s * 0.11); }
    ctx.stroke();
    for (const k of [-1, 1]) ell(ctx, k * s * 0.17, hy + s * 0.08, s * 0.045, s * 0.027, mood === 'angry' ? 'rgba(240,80,70,0.5)' : 'rgba(255,120,130,0.42)');
    if (mood === 'sleep') { ctx.fillStyle = '#6a7ad0'; ctx.font = 'bold ' + Math.round(s * 0.2) + 'px sans-serif'; ctx.textAlign = 'center'; const f = (t * 0.6) % 1; ctx.globalAlpha = 1 - f; ctx.fillText('z', s * 0.3 + f * s * 0.1, hy - s * 0.1 - f * s * 0.2); ctx.globalAlpha = 1; }
    // 铃铛
    if (opts.bell) {
      ctx.strokeStyle = '#d33a2c'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(-s * 0.15, hy + s * 0.2); ctx.quadraticCurveTo(0, hy + s * 0.29, s * 0.15, hy + s * 0.2); ctx.stroke();
      ell(ctx, 0, hy + s * 0.27, s * 0.055, s * 0.055, '#ffd23f', OUT, lw * 0.9); ctx.fillStyle = '#b8860b'; ctx.fillRect(-s * 0.01, hy + s * 0.27, s * 0.02, s * 0.03); ell(ctx, -s * 0.02, hy + s * 0.255, s * 0.015, s * 0.015, 'rgba(255,255,255,0.8)');
    }
    ctx.restore();
  };

  /* ============================================================
   *  防御塔（2.5D：顶面亮、正面暗；随等级出现旗帜/金边/光环等外观进阶）
   *  cx,cy = 格子中心；opts:{mini}
   * ============================================================ */
  function lvColor(frac) {
    return frac >= 1 ? '#ff4d4d' : frac >= 0.8 ? '#ffd23f' : frac >= 0.55 ? '#b78bff' : frac >= 0.3 ? '#dfe6ee' : '#d99a5b';
  }
  Art.lvColor = lvColor;

  function plinth(ctx, cs, cx, cy, col, tier) {
    const lw = Math.max(1.5, cs * 0.035);
    ell(ctx, cx, cy + cs * 0.31, cs * 0.47, cs * 0.15, 'rgba(0,0,0,0.28)');
    rr(ctx, cx - cs * 0.42, cy + cs * 0.1, cs * 0.84, cs * 0.26, cs * 0.08); ctx.fillStyle = shade(col, -0.2); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke();
    rr(ctx, cx - cs * 0.42, cy + cs * 0.02, cs * 0.84, cs * 0.22, cs * 0.09);
    const g = ctx.createLinearGradient(0, cy + cs * 0.02, 0, cy + cs * 0.24); g.addColorStop(0, shade(col, 0.3)); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,45,30,0.35)'; ctx.lineWidth = 1;
    for (const dx of [-0.24, 0, 0.24]) { ctx.beginPath(); ctx.moveTo(cx + dx * cs, cy + cs * 0.11); ctx.lineTo(cx + dx * cs, cy + cs * 0.35); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - cs * 0.42, cy + cs * 0.22); ctx.lineTo(cx + cs * 0.42, cy + cs * 0.22); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; rr(ctx, cx - cs * 0.34, cy + cs * 0.045, cs * 0.5, cs * 0.04, cs * 0.02); ctx.fill();
    if (tier >= 3) for (const dx of [-0.36, 0.36]) ell(ctx, cx + dx * cs, cy + cs * 0.13, cs * 0.035, cs * 0.035, '#ffd23f', OUT, 1);
  }

  Art.drawTower = function (ctx, b, cs, cx, cy, t, opts) {
    opts = opts || {};
    const type = b.type, gem = b.gem, T = SV.D.towers[type];
    const aim = b.aim || 0, rec = (b.recoil || 0) > 0 ? b.recoil / 0.12 : 0;
    const gc = gem ? SV.GEM_COLORS[gem.c] : null, gh = gc ? (gem.c === 5 ? '#b38cff' : gc.hex) : null;
    const lf = b.lv / T.max, tier = lf >= 1 ? 4 : lf >= 0.8 ? 3 : lf >= 0.55 ? 2 : lf >= 0.3 ? 1 : 0;
    const lw = Math.max(1.5, cs * 0.035);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const stroke = (w) => { ctx.lineWidth = w || lw; ctx.strokeStyle = OUT; ctx.stroke(); };
    if (tier >= 4) { const gl = ctx.createRadialGradient(cx, cy - cs * 0.3, cs * 0.1, cx, cy - cs * 0.3, cs * 0.8); gl.addColorStop(0, 'rgba(255,220,120,0.28)'); gl.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - cs * 0.8, cy - cs * 1.1, cs * 1.6, cs * 1.6); }

    if (type === 'sentry') {
      plinth(ctx, cs, cx, cy, '#b8b2a6', tier);
      // 木塔身
      ctx.beginPath(); ctx.moveTo(cx - cs * 0.28, cy + cs * 0.12); ctx.lineTo(cx - cs * 0.2, cy - cs * 0.42); ctx.lineTo(cx + cs * 0.2, cy - cs * 0.42); ctx.lineTo(cx + cs * 0.28, cy + cs * 0.12); ctx.closePath();
      const g = ctx.createLinearGradient(cx - cs * 0.28, 0, cx + cs * 0.28, 0); g.addColorStop(0, '#e3b370'); g.addColorStop(0.55, '#c58f4f'); g.addColorStop(1, '#94622f');
      ctx.fillStyle = g; ctx.fill(); stroke();
      ctx.strokeStyle = 'rgba(80,45,15,0.5)'; ctx.lineWidth = 1;
      for (const dx of [-0.13, 0, 0.13]) { ctx.beginPath(); ctx.moveTo(cx + dx * cs, cy - cs * 0.4); ctx.lineTo(cx + dx * cs * 1.25, cy + cs * 0.1); ctx.stroke(); }
      for (let k = 1; k < 3; k++) { const yy = cy + cs * 0.12 - k * cs * 0.18; ctx.strokeStyle = tier >= 2 ? '#6b7280' : 'rgba(80,45,15,0.6)'; ctx.lineWidth = tier >= 2 ? Math.max(2, cs * 0.04) : 1; ctx.beginPath(); ctx.moveTo(cx - cs * (0.27 - k * 0.025), yy); ctx.lineTo(cx + cs * (0.27 - k * 0.025), yy); ctx.stroke(); }
      rr(ctx, cx - cs * 0.045, cy - cs * 0.22, cs * 0.09, cs * 0.14, cs * 0.03); ctx.fillStyle = '#2a1c10'; ctx.fill();
      // 平台与栏杆
      rr(ctx, cx - cs * 0.32, cy - cs * 0.5, cs * 0.64, cs * 0.12, cs * 0.03); ctx.fillStyle = '#8a5a2c'; ctx.fill(); stroke();
      ctx.fillStyle = '#7a4c22'; for (const dx of [-0.28, -0.14, 0, 0.14, 0.28]) { ctx.fillRect(cx + dx * cs - cs * 0.015, cy - cs * 0.56, cs * 0.03, cs * 0.07); }
      // 屋顶（瓦片扇形）
      ctx.beginPath(); ctx.moveTo(cx - cs * 0.38, cy - cs * 0.5); ctx.lineTo(cx, cy - cs * 0.99); ctx.lineTo(cx + cs * 0.38, cy - cs * 0.5); ctx.closePath();
      const rc = gh ? shade(gh, 0.02) : '#e2552e'; const rg = ctx.createLinearGradient(cx - cs * 0.38, 0, cx + cs * 0.38, 0); rg.addColorStop(0, shade(rc, 0.3)); rg.addColorStop(0.5, rc); rg.addColorStop(1, shade(rc, -0.3)); ctx.fillStyle = rg; ctx.fill(); stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; for (let k = 1; k <= 3; k++) { const yy = cy - cs * 0.5 - k * cs * 0.12, hw = cs * (0.38 - k * 0.09); ctx.beginPath(); ctx.moveTo(cx - hw, yy); ctx.quadraticCurveTo(cx, yy + cs * 0.05, cx + hw, yy); ctx.stroke(); }
      if (tier >= 3) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(2, cs * 0.04); ctx.beginPath(); ctx.moveTo(cx - cs * 0.38, cy - cs * 0.5); ctx.lineTo(cx, cy - cs * 0.99); ctx.lineTo(cx + cs * 0.38, cy - cs * 0.5); ctx.stroke(); }
      // 弩
      ctx.save(); ctx.translate(cx, cy - cs * 0.44); ctx.rotate(aim); ctx.translate(-rec * cs * 0.05, 0);
      ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.7; ctx.beginPath(); ctx.moveTo(cs * 0.07, -cs * 0.15); ctx.quadraticCurveTo(cs * 0.22, 0, cs * 0.07, cs * 0.15); ctx.stroke();
      ctx.strokeStyle = tier >= 2 ? '#c9a24a' : '#7a4e2a'; ctx.lineWidth = lw * 1.0; ctx.beginPath(); ctx.moveTo(cs * 0.07, -cs * 0.15); ctx.quadraticCurveTo(cs * 0.22, 0, cs * 0.07, cs * 0.15); ctx.stroke();
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cs * 0.07, -cs * 0.15); ctx.lineTo(cs * 0.03 - rec * cs * 0.02, 0); ctx.lineTo(cs * 0.07, cs * 0.15); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw * 1.5; ctx.beginPath(); ctx.moveTo(-cs * 0.08, 0); ctx.lineTo(cs * 0.3, 0); ctx.stroke();
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(-cs * 0.06, 0); ctx.lineTo(cs * 0.28, 0); ctx.stroke();
      ctx.fillStyle = '#cfd6de'; ctx.beginPath(); ctx.moveTo(cs * 0.28, -cs * 0.035); ctx.lineTo(cs * 0.36, 0); ctx.lineTo(cs * 0.28, cs * 0.035); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.restore();
      // 旗
      ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx, cy - cs * 0.99); ctx.lineTo(cx, cy - cs * 1.17); ctx.stroke();
      const fw = Math.sin(t * 5) * cs * 0.025;
      ctx.beginPath(); ctx.moveTo(cx, cy - cs * 1.17); ctx.quadraticCurveTo(cx + cs * 0.1, cy - cs * 1.2 + fw, cx + cs * 0.18, cy - cs * 1.13 + fw); ctx.quadraticCurveTo(cx + cs * 0.1, cy - cs * 1.13, cx, cy - cs * 1.05); ctx.closePath(); ctx.fillStyle = gh || '#fff'; ctx.fill(); stroke();
      if (tier >= 2) { ctx.beginPath(); ctx.moveTo(cx - cs * 0.02, cy - cs * 1.1); ctx.lineTo(cx - cs * 0.14, cy - cs * 1.06 + fw); ctx.lineTo(cx - cs * 0.02, cy - cs * 1.02); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); stroke(); }
    } else if (type === 'scatter') {
      plinth(ctx, cs, cx, cy, '#a9b3c0', tier);
      ell(ctx, cx, cy - cs * 0.02, cs * 0.35, cs * 0.28, '#5f7186', OUT, lw);
      rr(ctx, cx - cs * 0.3, cy - cs * 0.2, cs * 0.6, cs * 0.2, cs * 0.05); const mg = ctx.createLinearGradient(cx - cs * 0.3, 0, cx + cs * 0.3, 0); mg.addColorStop(0, '#9fb0c2'); mg.addColorStop(0.5, '#6f8299'); mg.addColorStop(1, '#4a586a'); ctx.fillStyle = mg; ctx.fill(); stroke();
      // 圆顶
      ctx.beginPath(); ctx.arc(cx, cy - cs * 0.2, cs * 0.3, Math.PI, 0); ctx.closePath();
      const dg = ctx.createRadialGradient(cx - cs * 0.1, cy - cs * 0.42, cs * 0.04, cx, cy - cs * 0.22, cs * 0.4); dg.addColorStop(0, '#b5f0f6'); dg.addColorStop(0.5, '#4fb4c6'); dg.addColorStop(1, '#2a7080');
      ctx.fillStyle = dg; ctx.fill(); stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1.5, cs * 0.03); ctx.beginPath(); ctx.arc(cx, cy - cs * 0.2, cs * 0.22, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
      for (const dx of [-0.22, 0.22]) ell(ctx, cx + dx * cs, cy - cs * 0.1, cs * 0.02, cs * 0.02, '#dfe8f0');
      // 三管炮（随瞄准旋转）
      ctx.save(); ctx.translate(cx, cy - cs * 0.26); ctx.rotate(aim);
      ell(ctx, 0, 0, cs * 0.09, cs * 0.09, '#3a4654', OUT, lw);
      const nb = tier >= 3 ? 5 : 3, spread = tier >= 3 ? 0.26 : 0.32;
      for (let i = 0; i < nb; i++) {
        const da = (i - (nb - 1) / 2) * spread; ctx.save(); ctx.rotate(da); ctx.translate(-rec * cs * 0.05, 0);
        rr(ctx, cs * 0.06, -cs * 0.045, cs * 0.34, cs * 0.09, cs * 0.03); const bg = ctx.createLinearGradient(0, -cs * 0.045, 0, cs * 0.045); bg.addColorStop(0, '#7a8a9c'); bg.addColorStop(1, '#3a4654'); ctx.fillStyle = bg; ctx.fill(); stroke();
        rr(ctx, cs * 0.34, -cs * 0.055, cs * 0.06, cs * 0.11, cs * 0.02); ctx.fillStyle = gh || '#c9a24a'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke();
        ell(ctx, cs * 0.4, 0, cs * 0.022, cs * 0.04, '#0d1114'); ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx + cs * 0.12, cy - cs * 0.48); ctx.lineTo(cx + cs * 0.12, cy - cs * 0.62); ctx.stroke(); ell(ctx, cx + cs * 0.12, cy - cs * 0.64, cs * 0.04, cs * 0.04, gh || '#f5f2e6', OUT, lw);
    } else if (type === 'cannon') {
      plinth(ctx, cs, cx, cy, '#a59c8e', tier);
      // 炮架
      rr(ctx, cx - cs * 0.32, cy - cs * 0.08, cs * 0.64, cs * 0.24, cs * 0.06); const cg = ctx.createLinearGradient(0, cy - cs * 0.08, 0, cy + cs * 0.16); cg.addColorStop(0, '#b98247'); cg.addColorStop(1, '#7d5127'); ctx.fillStyle = cg; ctx.fill(); stroke();
      for (const dx of [-0.24, 0.24]) {
        ell(ctx, cx + dx * cs, cy + cs * 0.16, cs * 0.15, cs * 0.15, '#6b4a2a', OUT, lw); ell(ctx, cx + dx * cs, cy + cs * 0.16, cs * 0.1, cs * 0.1, '#8a6238');
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + dx * cs - Math.cos(a) * cs * 0.1, cy + cs * 0.16 - Math.sin(a) * cs * 0.1); ctx.lineTo(cx + dx * cs + Math.cos(a) * cs * 0.1, cy + cs * 0.16 + Math.sin(a) * cs * 0.1); ctx.stroke(); }
        ell(ctx, cx + dx * cs, cy + cs * 0.16, cs * 0.035, cs * 0.035, '#d0d0d0', OUT, 1);
      }
      // 炮弹堆
      for (const [dx, dy] of [[0.36, 0.2], [0.44, 0.2], [0.4, 0.13]]) ell(ctx, cx + dx * cs, cy + dy * cs, cs * 0.045, cs * 0.045, '#2a2d33', OUT, 1);
      ctx.save(); ctx.translate(cx, cy - cs * 0.13); ctx.rotate(aim); ctx.translate(-rec * cs * 0.09, 0);
      const len = tier >= 3 ? 0.66 : 0.6;
      const bg = ctx.createLinearGradient(0, -cs * 0.15, 0, cs * 0.15); bg.addColorStop(0, '#6a707a'); bg.addColorStop(0.45, '#33373e'); bg.addColorStop(1, '#17191d');
      ctx.beginPath(); ctx.moveTo(-cs * 0.14, -cs * 0.11); ctx.lineTo(cs * len * 0.72, -cs * 0.13); ctx.lineTo(cs * len * 0.72, cs * 0.13); ctx.lineTo(-cs * 0.14, cs * 0.11); ctx.closePath(); ctx.fillStyle = bg; ctx.fill(); stroke();
      ell(ctx, -cs * 0.14, 0, cs * 0.08, cs * 0.11, '#2a2d33', OUT, lw);
      rr(ctx, cs * len * 0.68, -cs * 0.17, cs * 0.1, cs * 0.34, cs * 0.03); ctx.fillStyle = '#454b54'; ctx.fill(); stroke();
      ell(ctx, cs * len * 0.78, 0, cs * 0.03, cs * 0.1, '#000');
      ctx.fillStyle = gh || '#c9a24a'; ctx.fillRect(cs * 0.1, -cs * 0.125, cs * 0.06, cs * 0.25); if (tier >= 2) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(cs * 0.28, -cs * 0.13, cs * 0.05, cs * 0.26); }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-cs * 0.12, -cs * 0.09, cs * len * 0.8, cs * 0.04);
      ctx.restore();
      if (rec > 0.3) { ell(ctx, cx + Math.cos(aim) * cs * 0.66, cy - cs * 0.13 + Math.sin(aim) * cs * 0.66, cs * 0.18 * rec, cs * 0.18 * rec, 'rgba(255,220,140,' + rec + ')'); ell(ctx, cx + Math.cos(aim) * cs * 0.66, cy - cs * 0.13 + Math.sin(aim) * cs * 0.66, cs * 0.09 * rec, cs * 0.09 * rec, 'rgba(255,255,255,' + rec + ')'); }
    } else if (type === 'pulse') {
      plinth(ctx, cs, cx, cy, '#a7b6c4', tier);
      const col = gh || '#7fe3ff';
      ctx.strokeStyle = A(col, 0.55); ctx.lineWidth = Math.max(1.5, cs * 0.03); ctx.beginPath(); ctx.ellipse(cx, cy + cs * 0.12, cs * 0.34, cs * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
      // 三根线圈柱
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI * 2 / 3 + Math.PI / 2, px = cx + Math.cos(a) * cs * 0.3, py = cy + cs * 0.06 + Math.sin(a) * cs * 0.07;
        rr(ctx, px - cs * 0.035, py - cs * 0.3, cs * 0.07, cs * 0.32, cs * 0.03); ctx.fillStyle = '#5f7a92'; ctx.fill(); stroke();
        ctx.strokeStyle = '#c9d6e2'; ctx.lineWidth = 1.2; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(px - cs * 0.035, py - cs * 0.26 + j * cs * 0.07); ctx.lineTo(px + cs * 0.035, py - cs * 0.24 + j * cs * 0.07); ctx.stroke(); }
        ell(ctx, px, py - cs * 0.32, cs * 0.045, cs * 0.045, col, OUT, 1);
        if (rec > 0.2) { ctx.strokeStyle = A(col, rec); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py - cs * 0.32); ctx.lineTo(cx + (Math.sin(t * 40 + k) * 0.03) * cs, cy - cs * 0.42); ctx.stroke(); }
      }
      const hov = Math.sin(t * 2.2 + b.id) * cs * 0.03;
      ctx.save(); ctx.translate(cx, cy - cs * 0.42 + hov);
      ell(ctx, 0, cs * 0.02, cs * 0.5, cs * 0.5, A(col, 0.12));
      ctx.beginPath(); ctx.moveTo(0, -cs * 0.5); ctx.lineTo(cs * 0.2, -cs * 0.15); ctx.lineTo(cs * 0.15, cs * 0.3); ctx.lineTo(0, cs * 0.42); ctx.lineTo(-cs * 0.15, cs * 0.3); ctx.lineTo(-cs * 0.2, -cs * 0.15); ctx.closePath();
      const cg = ctx.createLinearGradient(-cs * 0.2, -cs * 0.5, cs * 0.2, cs * 0.4); cg.addColorStop(0, shade(col, 0.65)); cg.addColorStop(0.5, col); cg.addColorStop(1, shade(col, -0.4));
      ctx.fillStyle = cg; ctx.fill(); stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(0, -cs * 0.5); ctx.lineTo(-cs * 0.2, -cs * 0.15); ctx.lineTo(-cs * 0.02, -cs * 0.05); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -cs * 0.5); ctx.lineTo(-cs * 0.02, cs * 0.42); ctx.moveTo(-cs * 0.2, -cs * 0.15); ctx.lineTo(cs * 0.15, cs * 0.3); ctx.stroke();
      for (let k = 0; k < (tier >= 3 ? 3 : 2); k++) { ctx.save(); ctx.rotate(t * (k % 2 ? -1.3 : 1.1) + k); ctx.strokeStyle = A(col, 0.85); ctx.lineWidth = Math.max(1.5, cs * 0.04); ctx.beginPath(); ctx.ellipse(0, cs * (k * 0.1 - 0.08), cs * (0.36 - k * 0.05), cs * 0.1, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      ctx.restore();
      if (rec > 0.2) { ctx.strokeStyle = A(col, rec); ctx.lineWidth = cs * 0.08; ctx.beginPath(); ctx.arc(cx, cy - cs * 0.42, cs * (0.5 - rec * 0.2), 0, Math.PI * 2); ctx.stroke(); }
    } else if (type === 'inlay') {
      plinth(ctx, cs, cx, cy, '#b3ab9c', tier);
      const pg = ctx.createLinearGradient(cx - cs * 0.2, 0, cx + cs * 0.2, 0); pg.addColorStop(0, '#e2d9c7'); pg.addColorStop(0.5, '#bdb4a2'); pg.addColorStop(1, '#8a8274');
      rr(ctx, cx - cs * 0.2, cy - cs * 0.42, cs * 0.4, cs * 0.5, cs * 0.05); ctx.fillStyle = pg; ctx.fill(); stroke();
      ctx.strokeStyle = 'rgba(60,50,35,0.45)'; ctx.lineWidth = 1; for (const yy of [-0.3, -0.12]) { ctx.beginPath(); ctx.moveTo(cx - cs * 0.2, cy + yy * cs); ctx.lineTo(cx + cs * 0.2, cy + yy * cs); ctx.stroke(); }
      const rune = gem ? A(gh, 0.9) : 'rgba(90,80,60,0.6)'; ctx.strokeStyle = rune; ctx.lineWidth = Math.max(1.2, cs * 0.025);
      ctx.beginPath(); ctx.moveTo(cx, cy - cs * 0.36); ctx.lineTo(cx, cy - cs * 0.04); ctx.moveTo(cx - cs * 0.1, cy - cs * 0.24); ctx.lineTo(cx + cs * 0.1, cy - cs * 0.24); ctx.moveTo(cx - cs * 0.07, cy - cs * 0.14); ctx.lineTo(cx + cs * 0.07, cy - cs * 0.14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - cs * 0.32, cy - cs * 0.42); ctx.lineTo(cx - cs * 0.2, cy - cs * 0.56); ctx.lineTo(cx + cs * 0.2, cy - cs * 0.56); ctx.lineTo(cx + cs * 0.32, cy - cs * 0.42); ctx.closePath(); ctx.fillStyle = '#9a917f'; ctx.fill(); stroke();
      // 四爪托座
      ctx.strokeStyle = tier >= 2 ? '#e0b64a' : '#8a7f6a'; ctx.lineWidth = Math.max(2, cs * 0.05);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * cs * 0.16, cy - cs * 0.55); ctx.quadraticCurveTo(cx + s * cs * 0.3, cy - cs * 0.68, cx + s * cs * 0.2, cy - cs * 0.9); ctx.stroke(); }
      if (gem) {
        const hov = Math.sin(t * 2.6 + b.id) * cs * 0.025, pulse = (b.recoil || 0) > 0 ? 1.25 : 1;
        Art.gem(ctx, cx, cy - cs * 0.78 + hov, cs * 0.26 * pulse, gem.c, gem.t, t);
      } else { ell(ctx, cx, cy - cs * 0.6, cs * 0.14, cs * 0.06, '#1b1612', OUT, lw); }
    }
    // 宝石徽记（非镶嵌塔）
    if (gem && type !== 'inlay') Art.gem(ctx, cx + cs * 0.3, cy + cs * 0.22, cs * 0.14, gem.c, gem.t, t);
    // 等级徽章
    if (!opts.mini) {
      const bx = cx - cs * 0.36, by = cy + cs * 0.3;
      ctx.font = 'bold ' + Math.round(cs * 0.24) + 'px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const txt = String(b.lv), tw = ctx.measureText(txt).width + cs * 0.12;
      rr(ctx, bx - tw / 2, by - cs * 0.12, tw, cs * 0.24, cs * 0.08); ctx.fillStyle = 'rgba(30,20,10,0.8)'; ctx.fill();
      ctx.strokeStyle = lvColor(lf); ctx.lineWidth = Math.max(1, cs * 0.03); ctx.stroke();
      ctx.fillStyle = lvColor(lf); ctx.fillText(txt, bx, by + 1);
    }
    if (b.disT > 0) {
      ctx.fillStyle = 'rgba(30,30,40,0.55)'; ctx.fillRect(cx - cs * 0.42, cy - cs * 1.0, cs * 0.84, cs * 1.4);
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold ' + Math.round(cs * 0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💤', cx, cy - cs * 0.3);
    }
    if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, b.flash * 1.4) + ')'; ell(ctx, cx, cy - cs * 0.2, cs * 0.5, cs * 0.7, ctx.fillStyle); }
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
