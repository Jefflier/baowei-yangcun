/* 手搓狼模型 v2 —— 严格照实机截图（B 站/攻略截图放大 600%）复原的矢量造型。
 *
 * 观察到的原作特征：
 *   · 头（含鬃毛）占整体高度约 2/3，是又圆又大的深蓝黑「毛团」；
 *   · 头顶有一块偏蓝灰的高光面，像戴了顶帽子，边缘散出几撮毛；
 *   · 浅灰口鼻楔形向右前方伸出，鼻尖发黑，嘴线是一道深色缝；
 *   · 白色杏眼 + 黑瞳，眼睛紧贴鬃毛下缘，上方被深色毛发压住；
 *   · 身体又小又低，浅灰肚皮，四条短腿，脚掌发灰；
 *   · 粗尾巴从身后垂下，几乎拖到地面。
 *
 * 用法：
 *   SVAWolf.draw(ctx, {x, y, size, dir:'se', phase:0.3, state:'walk', pal:{...}});
 *   dir: e/se/s/sw/w/nw/n/ne；四组基准姿态（前 3/4 / 后 3/4）左右镜像成八向。
 */
window.SVAWolf = (function () {
  var BASE = 100;               // 造型设计尺寸 100×100，脚底在 y≈96

  var PAL = {                   // 原版普通狼的取样色
    furDark: '#2b3444',         // 鬃毛主色（深蓝黑）
    furMid: '#3c4a62',          // 鬃毛次暗面
    furTop: '#556382',          // 头顶高光面
    furFace: '#8a99a8',         // 口鼻上部
    furLight: '#c9d3dc',        // 口鼻下部 / 下巴
    belly: '#c9cdd6',           // 肚皮
    eye: '#ffffff',
    pupil: '#14161c',
    mouth: '#5c2b2b',
    claw: '#9aa3ad'
  };

  function mix(p) {
    var o = {};
    for (var i in PAL) o[i] = PAL[i];
    if (p) for (var j in p) if (p[j]) o[j] = p[j];
    return o;
  }

  function ell(ctx, x, y, rx, ry, rot, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function poly(ctx, pts, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* 一团毛：主块 + 沿弧线撒几撮，剪影就不会是光滑的椭圆 */
  function furball(ctx, cx, cy, rx, ry, color, tufts, seed, phase) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    for (var i = 0; i < tufts; i++) {
      var a = -Math.PI * 1.15 + (i / (tufts - 1)) * Math.PI * 1.35;
      var wob = 1 + 0.05 * Math.sin(phase * 5 + i * 1.7 + seed);
      var px = cx + Math.cos(a) * rx * 0.88 * wob;
      var py = cy + Math.sin(a) * ry * 0.88 * wob;
      var r = (0.13 + 0.035 * ((i * 7 + seed * 13) % 4)) * rx;
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  /* 腿：深色上肢 + 灰脚掌 */
  function leg(ctx, x0, y0, x1, y1, w, pal) {
    ctx.strokeStyle = pal.furDark;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ell(ctx, x1, y1 + 1.5, w * 0.78, w * 0.5, 0, pal.claw);
  }

  /* 粗尾巴：沿着一条下坠曲线摆一串大小递减的毛团 */
  function tail(ctx, x0, y0, x1, y1, pal, phase, swing) {
    ctx.beginPath();
    for (var i = 0; i <= 8; i++) {
      var t = i / 8;
      var px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 - 14) + t * t * x1 + swing * t * 3;
      var py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + 10) + t * t * y1;
      var r = 4 + 8.5 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 1.4 * (i % 2);
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = pal.furDark;
    ctx.fill();
  }

  /* 头部：鬃毛 + 高光面 + 耳朵 + 口鼻 + 眼睛 */
  function head(ctx, hx, hy, s, pal, phase, state) {
    // 耳朵：俯视 3/4 视角下几乎埋在鬃毛里，只留两个小尖
    poly(ctx, [[hx - 13, hy - 17], [hx - 17, hy - 26], [hx - 5, hy - 21]], pal.furDark);
    poly(ctx, [[hx + 7, hy - 20], [hx + 11, hy - 29], [hx + 15, hy - 18]], pal.furDark);
    poly(ctx, [[hx + 9, hy - 20], [hx + 12, hy - 26], [hx + 14, hy - 19]], pal.furMid);

    // 鬃毛主体：占整个狼高度的约 72%（照实机截图量出来的比例）
    furball(ctx, hx, hy, 26, 28, pal.furDark, 8, 3, phase);
    // 头顶高光带：偏蓝灰的一片，压在鬃毛上半部
    ell(ctx, hx - 2, hy - 8, 18.5, 11, -0.06, pal.furTop);
    ell(ctx, hx - 7, hy - 2, 13, 12, 0, pal.furMid);
    // 脸面：鬃毛下半部偏前的一整块浅灰
    ell(ctx, hx + 7, hy + 11, 15, 12, -0.04, pal.furFace);
    // 口鼻：从脸面继续向右前方伸出的厚实一坨（上灰下白），鼻尖在右端
    ell(ctx, hx + 24, hy + 14, 12, 9, 0.05, pal.furFace);
    ell(ctx, hx + 26, hy + 18, 9.5, 5.5, 0.05, pal.furLight);
    // 鼻头 + 嘴线
    ell(ctx, hx + 33, hy + 11.5, 4.2, 3.4, 0, pal.pupil);
    ctx.strokeStyle = pal.pupil;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx + 20, hy + 16);
    ctx.lineTo(hx + 31, hy + 15.4);
    ctx.stroke();
    if (state === 'attack') {
      poly(ctx, [[hx + 21, hy + 17], [hx + 32, hy + 16.6], [hx + 30, hy + 23], [hx + 22, hy + 22]], pal.mouth);
      poly(ctx, [[hx + 23, hy + 17], [hx + 26, hy + 17], [hx + 25, hy + 21]], '#ffffff');
      poly(ctx, [[hx + 28, hy + 16.8], [hx + 31, hy + 16.8], [hx + 30, hy + 20]], '#ffffff');
    }

    // 眼睛：白杏眼 + 黑瞳，主眼在前侧、副眼被鬃毛压掉一半
    if (state !== 'die') {
      // 主眼（前侧，大而亮）
      ell(ctx, hx + 10, hy + 2, 5.6, 4.4, -0.16, pal.eye);
      ell(ctx, hx + 11.4, hy + 2.6, 2.2, 3.2, 0, pal.pupil);
      // 副眼（被鬃毛压掉一半）
      ell(ctx, hx - 4, hy + 3, 4.6, 3.9, 0.10, pal.eye);
      ell(ctx, hx - 3.2, hy + 3.4, 1.9, 2.7, 0, pal.pupil);
      // 眉骨：鬃毛压下来的暗色带
      poly(ctx, [[hx - 11, hy - 5], [hx + 17, hy - 4], [hx + 16, hy - 0.6], [hx - 10, hy - 1.6]], pal.furDark);
      poly(ctx, [[hx - 9, hy + 0.5], [hx - 1, hy + 0.8], [hx - 2, hy + 3.2], [hx - 9, hy + 3]], pal.furDark);
    } else {
      ctx.strokeStyle = pal.pupil;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy - 2); ctx.lineTo(hx, hy + 3);
      ctx.moveTo(hx, hy - 2); ctx.lineTo(hx - 6, hy + 3);
      ctx.moveTo(hx + 7, hy - 1); ctx.lineTo(hx + 13, hy + 4);
      ctx.moveTo(hx + 13, hy - 1); ctx.lineTo(hx + 7, hy + 4);
      ctx.stroke();
    }
  }

  /* ---------------- 前 3/4（朝右下 / 下） ---------------- */
  function drawFront(ctx, pal, phase, state) {
    var die = state === 'die';
    var bob = die ? 0 : (state === 'walk' ? Math.sin(phase * Math.PI * 2) * 1.4 : Math.sin(phase * 2) * 0.6);
    var swing = Math.sin(phase * Math.PI * 2);
    var lean = state === 'attack' ? 4 : 0;
    ctx.save();
    ctx.translate(0, die ? 14 : bob);
    if (die) ctx.rotate(-0.16);

    tail(ctx, 36, 78, 11, 93, pal, phase, swing);
    leg(ctx, 42, 84, 40 - swing * 5, 95, 8.5, pal);
    leg(ctx, 56, 84, 59 + swing * 5, 95, 8, pal);

    // 身体：又小又低，只露一小块浅灰肚皮
    furball(ctx, 47, 79, 15, 12, pal.furDark, 5, 1, phase);
    ell(ctx, 53, 83, 8.5, 7, 0, pal.belly);

    head(ctx, 55 + lean, 38, 1, pal, phase, state);
    ctx.restore();
  }

  /* ---------------- 后 3/4（朝右上 / 上） ---------------- */
  function drawBack(ctx, pal, phase, state) {
    var swing = Math.sin(phase * Math.PI * 2);
    var bob = state === 'walk' ? Math.sin(phase * Math.PI * 2) * 1.2 : 0;
    ctx.save();
    ctx.translate(0, bob);

    tail(ctx, 50, 76, 47, 95, pal, phase, -swing);
    leg(ctx, 42, 84, 38 + swing * 5, 95, 8.5, pal);
    leg(ctx, 59, 84, 64 - swing * 5, 95, 8, pal);
    furball(ctx, 50, 79, 16, 13, pal.furDark, 5, 5, phase);

    var hx = 50, hy = 40;
    poly(ctx, [[hx - 16, hy - 16], [hx - 24, hy - 31], [hx - 5, hy - 21]], pal.furDark);
    poly(ctx, [[hx + 6, hy - 22], [hx + 12, hy - 37], [hx + 20, hy - 18]], pal.furDark);
    furball(ctx, hx, hy, 27, 30, pal.furDark, 8, 4, phase);
    ell(ctx, hx, hy - 6, 20, 17, 0, pal.furTop);
    furball(ctx, hx - 3, hy - 16, 11, 9, pal.furTop, 5, 9, phase);
    // 只露一点侧脸和一只眼睛，方向感就出来了
    poly(ctx, [[hx + 12, hy + 6], [hx + 29, hy + 12], [hx + 30, hy + 21], [hx + 14, hy + 20]], pal.furFace);
    ell(ctx, hx + 28, hy + 13, 4.0, 3.2, 0, pal.pupil);
    ell(ctx, hx + 13, hy + 6, 4.8, 4.0, -0.1, pal.eye);
    ell(ctx, hx + 14, hy + 6.4, 2.2, 2.6, 0, pal.pupil);
    ctx.restore();
  }

  var DIRS = {
    e:  {back: false, flip: false}, se: {back: false, flip: false}, s: {back: false, flip: false},
    w:  {back: false, flip: true},  sw: {back: false, flip: true},
    n:  {back: true,  flip: false}, ne: {back: true,  flip: false}, nw: {back: true, flip: true}
  };

  function draw(ctx, o) {
    var size = o.size || 40;
    var pal = mix(o.pal);
    var d = DIRS[o.dir || 'se'] || DIRS.se;
    var k = (size / BASE) * (o.scaleMul || 1);
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.scale(k, k);
    ctx.translate(-50, -96);            // 设计稿底边中心对齐到 (x, y)
    if (d.flip) { ctx.translate(100, 0); ctx.scale(-1, 1); }
    if (d.back) drawBack(ctx, pal, o.phase || 0, o.state || 'walk');
    else drawFront(ctx, pal, o.phase || 0, o.state || 'walk');
    ctx.restore();
  }

  /* 按狼的中文名猜配色（原作 132 种狼没有开放配色数据，用名字关键字近似） */
  var KEY_PAL = [
    [/冰|霜|雪|寒|冷/, {furDark:'#26405c', furMid:'#33587d', furTop:'#5b87ad', furFace:'#9dc0da', furLight:'#e2f1ff', belly:'#dceaf5'}],
    [/火|炎|焰|燃|赤|红/, {furDark:'#4a2020', furMid:'#6d2b26', furTop:'#8c4a3c', furFace:'#c5866a', furLight:'#f0cfae', belly:'#e8c3ab'}],
    [/毒|疫|沼|绿|藤/, {furDark:'#243a24', furMid:'#33603a', furTop:'#5c8a52', furFace:'#9dbd8b', furLight:'#dceec6', belly:'#cfe0bb'}],
    [/电|雷|闪|紫|魔|法/, {furDark:'#2f2a55', furMid:'#463d7d', furTop:'#6a5fa8', furFace:'#a79fd4', furLight:'#e6e1fb', belly:'#dad4f2'}],
    [/石|岩|铁|钢|机|甲/, {furDark:'#3b3b3b', furMid:'#555555', furTop:'#7b7b7b', furFace:'#a8a8a8', furLight:'#e4e4e4', belly:'#d6d6d6'}],
    [/沙|土|褐|黄/, {furDark:'#4a3a22', furMid:'#6b5433', furTop:'#8d7048', furFace:'#b79a6a', furLight:'#ecd9b0', belly:'#dfcaa2'}],
    [/王|皇|首领|BOSS|boss|老狼/, {furDark:'#221a2c', furMid:'#3a2c4a', furTop:'#5b4874', furFace:'#957ea6', furLight:'#ead9ef', belly:'#dcc9e4'}]
  ];

  function palFor(name) {
    if (!name) return null;
    for (var i = 0; i < KEY_PAL.length; i++) if (KEY_PAL[i][0].test(name)) return KEY_PAL[i][1];
    return null;
  }

  return {draw: draw, PAL: PAL, BASE: BASE, palFor: palFor};
})();
