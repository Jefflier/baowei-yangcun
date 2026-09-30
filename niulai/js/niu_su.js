/* ============================================================
 * 牛来攻城 —— 「正片」牛：致敬动画电影《牛来》的 SketchUp 建模
 *   电影海报是唯美水墨，正片是建筑软件里拉出来的方块牛。这里照着来：
 *   · 每头牛由长方体 / 低面数棱柱拼成，平涂着色 + 黑色描边（SketchUp 默认样式）
 *   · 按面的平均深度排序（画家算法）；零件直接互相插着，没有脖子没有关节，于是会自然地穿模
 *   · 个别面「法线反了」，露出 SketchUp 的蓝灰色背面；翅膀、披风是单面片，转过去也是蓝的
 *   · 走路只有 4 个关键帧（8 帧缓存两两相同 = 卡顿），腿是直棍，脚会离地
 *   · 牛妈妈直立行走，背上焊着一个忽大忽小的杯子；被她奶过的牛来也会站起来
 *   · 倒下时没有过渡，直接四脚朝天，头插进地里
 * 模型空间：x 朝前（牛头方向）、y 朝上、z 朝镜头；原点 = 两脚中间的地面；1 单位 ≈ 牛身长的 1%
 * 画到 ctx 上时和 Q 版牛同一套约定（朝右、原点在脚下、y 向下），缓存 / 图标 / 渲染都不用改
 * ============================================================ */
(function (root) {
  'use strict';
  const NL = root.NL = root.NL || {};
  const SU = NL.SU = {};
  const TAU = Math.PI * 2;

  /* ---------- 相机：绕 y 转一点露出正脸，再俯视一点露出背 ---------- */
  const YAW = -0.62, PITCH = 0.34;
  const cY = Math.cos(YAW), sY = Math.sin(YAW), cP = Math.cos(PITCH), sP = Math.sin(PITCH);
  function view(p) {
    const x = p[0] * cY + p[2] * sY, z = -p[0] * sY + p[2] * cY, y = p[1];
    return [x, y * cP - z * sP, y * sP + z * cP];
  }
  const LIGHT = nrm([-0.35, 0.8, 0.5]);
  const BACK = '#a4b1c0';      // SketchUp 默认材质的背面色
  const EDGE = '#151515';

  /* ---------- 向量 / 矩阵（3×4） ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function nrm(a) { const d = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / d, a[1] / d, a[2] / d]; }
  // Newell 法求多边形法线（顶点从法线那一侧看是逆时针）
  function newell(P) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const d = Math.hypot(x, y, z);
    return d < 1e-9 ? null : [x / d, y / d, z / d];
  }
  function centroid(P) { let x = 0, y = 0, z = 0; for (const p of P) { x += p[0]; y += p[1]; z += p[2]; } return [x / P.length, y / P.length, z / P.length]; }
  function mul(A, B) {
    const r = new Array(12);
    for (let i = 0; i < 3; i++) {
      const a0 = A[i * 4], a1 = A[i * 4 + 1], a2 = A[i * 4 + 2];
      for (let j = 0; j < 3; j++) r[i * 4 + j] = a0 * B[j] + a1 * B[4 + j] + a2 * B[8 + j];
      r[i * 4 + 3] = a0 * B[3] + a1 * B[7] + a2 * B[11] + A[i * 4 + 3];
    }
    return r;
  }
  function ap(M, p) { return [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]]; }

  // 2D 小工具（贴图用，面内坐标：u 向右、v 向上、原点在面心）
  function ngon(cx, cy, r, n, rot, ry) { const P = []; for (let i = 0; i < n; i++) { const a = (rot || 0) + i / n * TAU; P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * (ry || r)]); } return P; }
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }

  /* ============================================================
   * 场景：搭积木 + 画家算法
   * ============================================================ */
  function Scene() { this.items = []; this.M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; this.st = []; this.marks = {}; }
  const SP = Scene.prototype;
  SP.push = function () { this.st.push(this.M); return this; };
  SP.pop = function () { this.M = this.st.pop(); return this; };
  SP.at = function (x, y, z) { this.M = mul(this.M, [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z]); return this; };
  SP.rx = function (a) { const c = Math.cos(a), s = Math.sin(a); this.M = mul(this.M, [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]); return this; };
  SP.ry = function (a) { const c = Math.cos(a), s = Math.sin(a); this.M = mul(this.M, [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]); return this; };
  SP.rz = function (a) { const c = Math.cos(a), s = Math.sin(a); this.M = mul(this.M, [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]); return this; };
  SP.sc = function (k) { this.M = mul(this.M, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0]); return this; };
  SP.mark = function (name, p) { this.marks[name] = view(ap(this.M, p)); return this; };

  // 闭合凸体：把每个面的顶点顺序统一成「从外面看逆时针」（按面心相对体心的方向判断），这样才能剔除背面
  SP.solid = function (polys, col, o) {
    o = o || {};
    const P = polys.map(poly => poly.map(p => ap(this.M, p)));
    const C = centroid([].concat(...P));
    return P.map((poly, i) => {
      const n = newell(poly);
      if (n && dot(n, sub(centroid(poly), C)) < 0) poly.reverse();
      const f = { p: poly, col: (o.cols && o.cols[i]) || col, rev: !!(o.rev && o.rev.indexOf(i) >= 0), cull: true, dec: [] };
      this.items.push(f);
      return f;
    });
  };
  // 长方体；返回 6 个面 { px nx py ny pz nz }（rev 用下标 0..5 按这个顺序）
  SP.box = function (x0, y0, z0, x1, y1, z1, col, o) {
    const f = this.solid([
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]
    ], col, o);
    return { px: f[0], nx: f[1], py: f[2], ny: f[3], pz: f[4], nz: f[5] };
  };
  // a→b 的 n 棱柱 / 棱台 / 棱锥（r1 = 0）；返回 [底, 顶, 侧面…]
  SP.tube = function (a, b, r0, r1, n, col, o) {
    const d = nrm(sub(b, a)), up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = nrm(cross(d, up)), e2 = cross(e1, d);
    const ring = (c, r) => {
      const R = [];
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * TAU, u = Math.cos(t) * r, v = Math.sin(t) * r; R.push([c[0] + e1[0] * u + e2[0] * v, c[1] + e1[1] * u + e2[1] * v, c[2] + e1[2] * u + e2[2] * v]); }
      return R;
    };
    const A = ring(a, r0), B = ring(b, r1), cone = r1 < 0.01, polys = [A.slice()];
    if (!cone) polys.push(B.slice());
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; polys.push(cone ? [A[i], A[j], b] : [A[i], A[j], B[j], B[i]]); }
    return this.solid(polys, col, o);
  };
  // 单面片（不剔除，转到背面就是 SketchUp 的蓝灰色）
  SP.plane = function (pts, col, o) { const f = { p: pts.map(p => ap(this.M, p)), col, rev: !!(o && o.rev), cull: false, dec: [] }; this.items.push(f); return f; };
  // 线（鼻环、金刚琢）：w 是描边粗细的倍数
  SP.wire = function (pts, col, w, closed) { this.items.push({ wire: true, p: pts.map(p => ap(this.M, p)), col, w, closed }); return this; };
  // 贴图：贴在某个面上的平面多边形。可以贴出面外——贴歪了也是正片的一部分
  SP.decal = function (f, pts, col, o) {
    const n = newell(f.p); if (!n) return;
    const C = centroid(f.p);
    let V = sub([0, 1, 0], [n[0] * n[1], n[1] * n[1], n[2] * n[1]]);                      // 世界「上」投影到面内
    if (Math.hypot(V[0], V[1], V[2]) < 0.2) V = sub([1, 0, 0], [n[0] * n[0], n[1] * n[0], n[2] * n[0]]);   // 顶面 / 底面：拿 x 当「上」
    V = nrm(V);
    const U = cross(V, n), off = (o && o.off) || 0.25;
    f.dec.push({ p: pts.map(q => [C[0] + U[0] * q[0] + V[0] * q[1] + n[0] * off, C[1] + U[1] * q[0] + V[1] * q[1] + n[1] * off, C[2] + U[2] * q[0] + V[2] * q[1] + n[2] * off]), col, line: o && o.line });
  };

  const rgbCache = new Map();
  function rgb(h) {
    let c = rgbCache.get(h);
    if (!c) { let s = h.replace('#', ''); if (s.length === 3) s = s.split('').map(q => q + q).join(''); c = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); rgbCache.set(h, c); }
    return c;
  }
  function lit(h, n) {
    const c = rgb(h), k = 0.64 + 0.36 * Math.max(0, dot(n, LIGHT)) + 0.05 * Math.max(0, n[2]);
    return 'rgb(' + Math.min(255, Math.round(c[0] * k)) + ',' + Math.min(255, Math.round(c[1] * k)) + ',' + Math.min(255, Math.round(c[2] * k)) + ')';
  }
  function path(ctx, V, close) { ctx.beginPath(); ctx.moveTo(V[0][0], -V[0][1]); for (let i = 1; i < V.length; i++) ctx.lineTo(V[i][0], -V[i][1]); if (close) ctx.closePath(); }

  SP.draw = function (ctx, lw) {
    const list = [];
    for (const f of this.items) {
      const V = f.p.map(view);
      if (f.wire) { list.push({ f, V, z: centroid(V)[2] + 2 }); continue; }
      const n = newell(V);
      if (!n) continue;
      const front = n[2] > 0;
      if (!front && f.cull) continue;
      list.push({ f, V, n: front ? n : [-n[0], -n[1], -n[2]], front, z: centroid(V)[2] });
    }
    list.sort((a, b) => a.z - b.z);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const it of list) {
      const f = it.f;
      if (f.wire) {
        path(ctx, it.V, f.closed);
        ctx.strokeStyle = EDGE; ctx.lineWidth = lw * (f.w + 1.6); ctx.stroke();
        ctx.strokeStyle = f.col; ctx.lineWidth = lw * f.w; ctx.stroke();
        continue;
      }
      const back = it.front === f.rev;          // 反面朝外 = 蓝灰
      path(ctx, it.V, true);
      ctx.fillStyle = lit(back ? BACK : f.col, it.n); ctx.fill();
      ctx.strokeStyle = EDGE; ctx.lineWidth = lw; ctx.stroke();
      if (it.front) for (const d of f.dec) {
        path(ctx, d.p.map(view), true);
        ctx.fillStyle = lit(d.col, it.n); ctx.fill();
        if (d.line) { ctx.lineWidth = lw * 0.8; ctx.stroke(); }
      }
    }
  };

  /* ============================================================
   * 牛的积木
   * ============================================================ */
  // 4 个关键帧：迈左腿 / 并腿 / 迈右腿 / 并腿。点头和腿不同步（故意的）
  const SWING = [0.5, 0.05, -0.5, -0.05], BOB = [0, 2, 0, 2], NOD = [0, 0.08, -0.03, -0.09], TAIL = [0.3, 0, -0.3, 0.05];
  const CUP = [0.55, 1.35, 0.8, 1.7, 0.6, 1.15, 0.95, 1.5];        // 杯子每一帧的大小（物理意义不明）

  function sym(fn) { fn(1); fn(-1); }

  function eyes(S, f, P, pose) {
    const E = P.eyes || {};
    const white = E.white || '#ffffff', pup = pose.enrage ? '#ff2a1a' : (E.pupil || '#111111');
    const r1 = E.r1 || 5, r2 = E.r2 || 3.7;                        // 一只大一只小
    S.decal(f, ngon(-6, 4.6, r1, 7, 0.3), white, { line: true });
    S.decal(f, ngon(5.8, 3.6, r2, 6, 0.1), white, { line: true });
    S.decal(f, ngon(-6 + r1 * 0.35, 4.6 + r1 * 0.3, r1 * 0.42, 5), pup, { off: 0.45 });   // 两只眼睛各看各的
    S.decal(f, ngon(5.8 - r2 * 0.4, 3.6 - r2 * 0.35, r2 * 0.48, 5), pup, { off: 0.45 });
    if (E.sleepy) S.decal(f, rect(-11.5, 4.8, 10.5, 10.5), P.headC || P.col, { off: 0.6 });
    if (E.brow) { S.decal(f, [[-11.5, 11], [-2.4, 8.2], [-2.4, 6.6], [-11.5, 9.2]], '#111111', { off: 0.6 }); S.decal(f, [[11, 9.6], [2.2, 7.4], [2.2, 5.8], [11, 7.8]], '#111111', { off: 0.6 }); }
  }

  function horns(S, P, hl, hh) {
    const c = P.hornC || '#eee3c8';
    switch (P.horn) {
      case 'small': sym(s => S.tube([7, hh - 1, s * 6], [9, hh + 9, s * 11], 2.6, 1, 4, c)); break;
      case 'nub': sym(s => S.box(5, hh - 1, s > 0 ? 4 : -8, 9, hh + 3, s > 0 ? 8 : -4, c)); break;
      case 'long': sym(s => { S.tube([8, hh - 3, s * 7], [16, hh + 3, s * 19], 3.2, 2.2, 4, c); S.tube([16, hh + 3, s * 19], [25, hh + 14, s * 21], 2.2, 0.01, 4, c); }); break;
      case 'crescent': sym(s => { S.tube([6, hh - 3, s * 8], [2, hh + 1, s * 22], 3.6, 2.8, 5, c); S.tube([2, hh + 1, s * 22], [5, hh + 11, s * 28], 2.8, 2, 5, c); S.tube([5, hh + 11, s * 28], [13, hh + 17, s * 22], 2, 0.01, 5, c); }); break;
      case 'yak': sym(s => { S.tube([6, hh - 2, s * 8], [6, hh + 3, s * 17], 3, 2.2, 4, c); S.tube([6, hh + 3, s * 17], [10, hh + 14, s * 17], 2.2, 0.01, 4, c); }); break;
      case 'metal': sym(s => S.tube([7, hh - 1, s * 7], [10, hh + 10, s * 13], 3, 0.01, 4, '#b8c2cc')); break;
      case 'blade': sym(s => {
        S.tube([7, hh - 1, s * 7], [10, hh + 8, s * 12], 2.6, 1.2, 4, c);
        S.push().at(10, hh + 7, s * 12); S.plane([[0, 0, 0], [4, 1, 0], [7, 15, 0], [-1, 3, 0]], '#dfe6ee'); S.pop();
      }); break;
      case 'single': S.tube([10, hh - 2, 0], [17, hh + 17, 0], 4, 0.01, 5, c); break;
      case 'demon': sym(s => { S.tube([6, hh - 2, s * 8], [0, hh + 5, s * 22], 4.2, 3.4, 5, c); S.tube([0, hh + 5, s * 22], [4, hh + 20, s * 27], 3.4, 2.4, 5, c); S.tube([4, hh + 20, s * 27], [15, hh + 29, s * 21], 2.4, 0.01, 5, c); }); break;
    }
  }

  // 头：原点 = 头盒子的后下角中线；朝 +x。没有脖子，直接插在身子上
  function head(S, P, pose) {
    const hl = P.hl || 26, hh = P.hh || 25, hw = P.hw || 24;
    S.box(3, hh - 7, hw / 2 - 1, 9, hh - 3, hw / 2 + 8, P.ear || P.col, { rev: P.earRev ? [4, 2] : null });
    S.box(3, hh - 7, -hw / 2 - 8, 9, hh - 3, -hw / 2 + 1, P.ear || P.col);
    const hd = S.box(0, 0, -hw / 2, hl, hh, hw / 2, P.headC || P.col, { rev: P.headRev });
    const sn = S.box(hl - 3, 1, -hw / 2 + 2.5, hl + 7, 11, hw / 2 - 2.5, P.snout);
    S.decal(sn.px, rect(-5, -0.5, -2.6, 2.6), '#2a1616');                  // 鼻孔是方的
    S.decal(sn.px, rect(2, 0, 4.4, 3.1), '#2a1616');
    S.decal(sn.px, [[-5, -3.2], [5, -1.8], [5, -1], [-5, -2.4]], '#5a2626'); // 嘴是歪的
    eyes(S, hd.px, P, pose);
    if (P.band) { S.decal(hd.px, rect(-11.5, 7.6, 11.5, 10.2), '#e8b830', { off: 0.7 }); S.decal(hd.px, ngon(0, 8.9, 2, 6), '#c9303a', { off: 0.9 }); }
    if (P.helmet) S.box(-1, hh - 5, -hw / 2 - 1.5, hl * 0.72, hh + 3, hw / 2 + 1.5, '#a3adb6');
    if (P.ram) {                                                              // 攻城锤：木头 + 铁箍 + 铁锤头，用皮带捆在头上
      S.tube([hl * 0.2, hh + 4, 0], [hl + 24, hh + 4, 0], 5.5, 5.5, 6, '#9a6a3a');
      S.tube([hl + 2, hh + 4, 0], [hl + 6, hh + 4, 0], 6.4, 6.4, 6, '#7a828a');
      S.tube([hl + 22, hh + 4, 0], [hl + 32, hh + 4, 0], 7.8, 7.8, 6, '#7a828a');
      S.box(9, -1, -hw / 2 - 1, 12, hh + 1, hw / 2 + 1, '#4a2a10');
    }
    if (P.ring) S.wire(ngon(0, 0, 3.4, 8).map(q => [hl + 7.6, 1 + q[1] * 0.9, q[0]]), '#f0c030', 1.5, true);
    horns(S, P, hl, hh);
    if (P.goldRing) {                                                         // 金刚琢：在头顶转
      const a = [0.25, -0.1, 0.3, -0.2, 0.15, -0.05, 0.35, 0][pose.frame];
      S.push().at(6, hh + 30, 0).rz(a);
      S.wire(ngon(0, 0, 12, 10).map(q => [q[0], 0, q[1]]), '#e8b830', 3, true);
      S.pop();
    }
  }

  // 四条腿的牛
  function quad(S, P, pose) {
    const L = P.L || 76, H = P.H || 32, W = P.W || 30, LH = P.LH || 24, lw = P.lw || 8;
    const k = pose.k, walk = pose.walk, sw = walk ? SWING[k] : 0, bob = walk ? BOB[k] : 0;
    const y0 = LH, y1 = LH + H;
    // 腿：一根直棍，没有膝盖，绕胯转（脚会离地）
    [[L / 2 - 10, W / 2 - 5, 1], [L / 2 - 10, -W / 2 + 5, -1], [-L / 2 + 10, W / 2 - 5, -1], [-L / 2 + 10, -W / 2 + 5, 1]].forEach(([lx, lz, s], i) => {
      let a = sw * s;
      if (pose.charge) a = i < 2 ? 0.75 : -0.75;
      if (P.splay) a = (i < 2 ? 0.95 : -0.95) + [0, 0.15, 0, -0.15][k] * s;
      S.push().at(lx, y0 + 6 + bob, lz).rz(a);
      if (P.splay) S.rx(lz > 0 ? -0.4 : 0.4);
      S.box(-lw / 2, -(LH + 6), -lw / 2, lw / 2, 0, lw / 2, P.leg || P.col);
      S.box(-lw / 2 - 0.7, -(LH + 6), -lw / 2 - 0.7, lw / 2 + 0.7, -(LH + 1), lw / 2 + 0.7, P.hoof);
      S.pop();
    });
    S.push().at(0, bob, 0);
    const body = S.box(-L / 2, y0, -W / 2, L / 2, y1, W / 2, P.col, { rev: P.bodyRev });
    if (P.spots) for (const sp of P.spots) S.decal(body.pz, sp, P.spotC);
    if (P.mud) { S.decal(body.pz, [[-L / 2 + 4, -H / 2 + 1], [-4, -H / 2 + 5], [8, -H / 2 + 2], [L / 2 - 6, -H / 2 + 6], [L / 2 - 6, -H / 2], [-L / 2 + 4, -H / 2]], '#6a4a2c'); }
    if (P.armor) {
      const ar = S.box(-L / 2 - 2.5, y0 + H * 0.35, -W / 2 - 2.5, L / 2 + 1.5, y1 + 3, W / 2 + 2.5, '#a3adb6');
      for (let u = -L / 2 + 6; u < L / 2 - 2; u += 10) S.decal(ar.pz, rect(u, 3, u + 2.4, 5.4), '#4a545c');
    }
    if (P.fringe) for (let i = 0; i < 7; i++) { const x0 = -L / 2 + i * L / 7; S.box(x0, y0 - 9 - (i % 2) * 4, W / 2 - 1, x0 + L / 7 - 1.5, y0 + 10, W / 2 + 1.5, P.fringe); }
    if (P.snow) S.box(-14, y1 - 0.5, -9, 12, y1 + 3.5, 10, '#fbfdff');
    if (P.wings) {                                                             // 单面片的翅膀：远处那只转过去就是蓝的
      const fl = [0, 6, 2, 8, 0, 6, 2, 8][pose.frame];
      sym(s => S.plane([[-12, y1, s * (W / 2 - 3)], [8, y1, s * (W / 2 - 3)], [2, y1 + 18 + fl, s * (W / 2 + 18)], [-18, y1 + 12 + fl, s * (W / 2 + 12)]], '#ffffff'));
    }
    // 尾巴
    S.push().at(-L / 2 + 1, y1 - 3, 0).rx(walk ? TAIL[k] : 0.1);
    S.tube([0, 0, 0], [-7, -20, 0], 1.8, 1.4, 4, P.col);
    S.box(-10, -27, -2.5, -4, -19, 2.5, P.tuft || P.hoof);
    S.mark('tail', [-7, -25, 0]);
    S.pop();
    // 头：直接插在身子前上角
    S.push().at(L / 2 + (P.hx != null ? P.hx : -6), y1 + (P.hy != null ? P.hy : -9), 0).rz(pose.charge ? -0.45 : (walk ? NOD[k] : 0));
    head(S, P, pose);
    S.pop();
    S.pop();
  }

  // 站起来的牛（牛妈妈、站起来的牛来、两个 BOSS）
  function biped(S, P, pose) {
    const T = P.T || 26, TH = P.TH || 44, W = P.W || 26, LH = P.LH || 28, lw = P.lw || 9;
    const k = pose.k, walk = pose.walk, sw = walk ? SWING[k] * 0.8 : 0, bob = walk ? BOB[k] : 0;
    const y0 = LH, y1 = LH + TH;
    sym(s => {                                                                // 后腿：蹄子往前多伸一截，像穿了鞋
      S.push().at(0, y0 + 5 + bob, s * (W / 2 - 6)).rz(sw * s);
      S.box(-lw / 2, -(LH + 5), -lw / 2, lw / 2, 0, lw / 2, P.leg || P.col);
      S.box(-lw / 2 - 0.8, -(LH + 5), -lw / 2 - 0.8, lw / 2 + 3, -LH, lw / 2 + 0.8, P.hoof);
      S.pop();
    });
    S.push().at(0, bob, 0);
    const body = S.box(-T / 2, y0, -W / 2, T / 2, y1, W / 2, P.col, { rev: P.bodyRev });
    if (P.belly) S.decal(body.px, rect(-W / 2 + 4, -TH / 2 + 5, W / 2 - 4, TH / 2 - 9), P.belly);
    if (P.spots) for (const sp of P.spots) S.decal(body.pz, sp, P.spotC);
    if (P.goldArmor) { const ga = S.box(T / 2 - 3, y0 + TH * 0.42, -W / 2 + 3, T / 2 + 3, y1 - 5, W / 2 - 3, '#e2b030'); S.decal(ga.px, ngon(0, 0, 3.4, 6), '#d8303a', { line: true }); }
    // 前腿当胳膊：挂在肩膀外面甩；T-pose = 狂暴
    sym(s => {
      S.push().at(0, y1 - 5, s * (W / 2 + lw / 2));
      if (pose.tpose) S.rx(-s * Math.PI / 2); else S.rz(-sw * s * 1.1);
      S.box(-lw / 2, -30, -lw / 2, lw / 2, 3, lw / 2, P.leg || P.col);
      S.box(-lw / 2 - 0.7, -30, -lw / 2 - 0.7, lw / 2 + 0.7, -25, lw / 2 + 0.7, P.hoof);
      S.pop();
    });
    if (P.cape) {                                                             // 披风：两片单面片，一片法线是反的
      const wv = [0, 4, 1, 5, 0, 3, 1, 4][pose.frame];
      S.plane([[-T / 2 - 1, y1 - 2, W / 2 + 4], [-T / 2 - 1, y1 - 2, 0], [-T / 2 - 12 - wv, 10, 0], [-T / 2 - 10 - wv, 10, W / 2 + 10]], '#c02830');
      S.plane([[-T / 2 - 1, y1 - 2, 0], [-T / 2 - 1, y1 - 2, -W / 2 - 4], [-T / 2 - 10 - wv, 10, -W / 2 - 10], [-T / 2 - 12 - wv, 10, 0]], '#c02830', { rev: true });
    }
    if (P.cup) {                                                              // 背上焊着的杯子，每一帧大小都不一样
      S.push().at(-T / 2 - 4, y0 + TH * 0.74, W / 2 - 4).rz(0.3).sc(CUP[pose.frame]);
      const cp = S.tube([0, -10, 0], [0, 10, 0], 8.5, 10, 8, '#f4f4f0');       // 白底红边的搪瓷杯
      S.decal(cp[1], ngon(0, 0, 8.4, 8), '#6a3a1a');
      for (let i = 2; i < cp.length; i++) { S.decal(cp[i], rect(-4, 6.5, 4, 9.5), '#d8303a'); S.decal(cp[i], rect(-4, -2, 4, 2), '#d8303a'); }
      S.box(-14, -5, -1.8, -8, 6, 1.8, '#f4f4f0');
      S.pop();
    }
    S.push().at(-T / 2 + 1, y0 + 8, 0).rz(-0.5).rx(walk ? TAIL[k] : 0.1);
    S.tube([0, 0, 0], [-4, -20, 0], 1.8, 1.4, 4, P.col);
    S.box(-7, -27, -2.5, -1, -19, 2.5, P.tuft || P.hoof);
    S.mark('tail', [-4, -25, 0]);
    S.pop();
    S.push().at(-(P.hb != null ? P.hb : 8), y1 - 3, 0).rz(walk ? NOD[k] : 0);
    head(S, P, pose);
    S.pop();
    S.pop();
  }

  /* ---------- 12 头牛 ---------- */
  const MD = {
    huang: { b: quad, col: '#d69a3c', leg: '#c98e33', hoof: '#4a3018', snout: '#eab79c', horn: 'small', tuft: '#7a4a1a', headRev: [2] },
    calf: {
      b: quad, L: 54, H: 24, W: 22, LH: 19, lw: 6.5, col: '#e2ae72', leg: '#d69f63', hoof: '#6a4a2a', snout: '#f3c3a8', horn: 'nub', tuft: '#8a5a2a',
      hl: 24, hh: 23, hw: 22, hx: -8, hy: -8, earRev: true, eyes: { r1: 5, r2: 3.6 },
      up: { b: biped, T: 20, TH: 30, W: 20, LH: 20, lw: 6.5, hb: 8 }             // 被牛妈妈奶过之后：站起来了
    },
    naiu: {
      b: biped, T: 26, TH: 46, W: 28, LH: 26, col: '#f2f1ea', leg: '#e6e4da', hoof: '#3a3a3a', snout: '#ffb3c0', horn: 'small', tuft: '#222222', cup: true,
      spotC: '#1e1e1e', spots: [[[-9, 10], [2, 15], [7, 6], [-1, 1], [-10, 3]], [[5, -6], [16, -3], [15, -15], [4, -13]], [[-13, -12], [-6, -9], [-7, -19], [-14, -18]]]
    },
    douniu: { b: quad, L: 80, H: 34, W: 30, col: '#3b2b25', leg: '#33241f', hoof: '#140c0a', snout: '#7a5a4c', horn: 'long', hornC: '#f3ead2', tuft: '#140c0a', eyes: { brow: true }, ring: true },
    shuiniu: { b: quad, L: 84, H: 36, W: 34, LH: 23, col: '#6b7780', leg: '#5d6870', hoof: '#2a2f33', snout: '#454d54', horn: 'crescent', hornC: '#d8cfbb', tuft: '#2a2f33', eyes: { sleepy: true, r1: 3.8, r2: 3.8 }, mud: true },
    maoniu: { b: quad, L: 82, H: 36, W: 34, LH: 22, col: '#4a3426', leg: '#3e2b1f', hoof: '#1a110b', snout: '#735544', horn: 'yak', hornC: '#efe4c9', tuft: '#2e2016', fringe: '#35251a', snow: true },
    zhuang: { b: quad, L: 84, H: 36, W: 32, col: '#8e5a34', leg: '#7e4e2c', hoof: '#3a2412', snout: '#d6a282', horn: 'small', eyes: { brow: true }, ram: true, bodyRev: [2] },
    feitian: {
      b: quad, L: 70, H: 30, W: 28, LH: 20, col: '#f6eefa', leg: '#efe2f4', hoof: '#8a7a9a', snout: '#ffc2d6', horn: 'small', hornC: '#fff0d0', tuft: '#c9a6e6', splay: true, wings: true,
      spotC: '#f2a6c8', spots: [[[-20, 4], [-10, 8], [-8, -2], [-18, -4]], [[6, 2], [16, 6], [14, -6]]]
    },
    tiejia: { b: quad, L: 80, H: 34, W: 31, col: '#7a6958', leg: '#6d5d4e', hoof: '#2a2a2a', snout: '#b39a86', horn: 'metal', eyes: { brow: true }, armor: true, helmet: true },
    huoniu: { b: quad, L: 78, H: 33, W: 30, col: '#b8472a', leg: '#a53e24', hoof: '#3a1a10', snout: '#f0a47e', horn: 'blade', tuft: '#ffb43a', eyes: { brow: true }, fire: true },
    qingniu: { b: biped, T: 30, TH: 50, W: 32, LH: 28, lw: 10, col: '#3f8e98', leg: '#387f88', hoof: '#1e3a40', snout: '#9ad0cf', horn: 'single', tuft: '#23555c', belly: '#6fb7bd', eyes: { brow: true }, band: true, goldRing: true },
    mowang: {
      b: biped, T: 32, TH: 52, W: 36, LH: 30, lw: 11, col: '#2e2323', leg: '#281e1e', hoof: '#0f0909', snout: '#6a4a44', horn: 'demon', hornC: '#f2c230', tuft: '#b3202a',
      eyes: { white: '#ffd23f', pupil: '#1a0a00', brow: true }, ring: true, cape: true, goldArmor: true
    }
  };
  SU.MD = MD;
  // 模型大概有多高（模型单位），血条 / 台词气泡往上让一让
  const TOP = { naiu: 110, qingniu: 150, mowang: 150 };
  SU.top = function (id, up) { return up ? 84 : TOP[id] || 86; };

  function flame(ctx, x, y, s, col, lw) {
    ctx.beginPath(); ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x - s * 0.35, y - s * 1.1); ctx.lineTo(x - s * 0.05, y - s * 0.5); ctx.lineTo(x + s * 0.25, y - s * 1.6);
    ctx.lineTo(x + s * 0.6, y - s * 0.3); ctx.lineTo(x + s * 0.4, y + s * 0.35); ctx.lineTo(x - s * 0.4, y + s * 0.35); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = lw; ctx.stroke();
  }

  /* 画一头「正片」牛（原点在脚下，朝右）。p = 走路相位 0..2π
   * o: { frame, walk, charge, enrage, up(站起来), trip(绊倒), dead(四脚朝天) } */
  SU.cow = function (ctx, id, p, o) {
    o = o || {};
    const base = MD[id] || MD.huang;
    const P = o.up && base.up ? Object.assign({}, base, base.up) : base;
    const frame = o.frame != null ? o.frame & 7 : Math.round(p / TAU * 8) & 7;
    const pose = { frame, k: frame >> 1, walk: o.walk !== false && !o.dead, charge: !!o.charge, enrage: !!o.enrage, tpose: !!o.enrage && !!P.cape };
    const S = new Scene();
    if (pose.tpose) S.ry(-0.95);                                               // 狂暴：转过来正对镜头摆 T-pose，然后平移着走
    if (o.dead) {
      // 没有过渡，直接翻过去：四条腿的四脚朝天（头插进地里），站着的仰面躺平
      if (P.b === quad) S.at(0, (P.LH || 24) + (P.H || 32), 0).rx(Math.PI);
      else { const Ht = (P.LH || 28) + (P.TH || 44) + 30; S.at(Ht * 0.45, (P.T || 26) / 2, 0).rz(Math.PI / 2); }
    } else if (o.trip && !pose.tpose) {
      const fx = P.b === quad ? (P.L || 76) / 2 - 10 : 4;                    // 绊倒：绕前脚往前栽，脸插进地里
      S.at(fx, 0, 0).rz(-0.95).at(-fx, 0, 0);
    }
    P.b(S, P, pose);
    const m = ctx.getTransform(), k = Math.hypot(m.a, m.b) || 1;
    const lw = ((NL.Art && NL.Art.pr) || 1) * 0.9 / k;                       // 描边 ≈ 0.9 个 CSS 像素
    S.draw(ctx, lw);
    if (P.fire && S.marks.tail && !o.dead) {
      const t = S.marks.tail, s = [1, 1.25, 0.9, 1.35, 1.05, 0.85, 1.2, 1][frame];
      flame(ctx, t[0], -t[1], 10 * s, '#ff7a1a', lw); flame(ctx, t[0], -t[1] + 1, 5.5 * s, '#ffe04a', lw);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
