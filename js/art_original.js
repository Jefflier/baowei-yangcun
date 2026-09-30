/* 原版矢量美术渲染器 —— 数据来自 assets/art/*.js（由 tools/export_assets.py 从原作 SWF 导出）。
 *
 * 用法：
 *   <script src="assets/art/tower.js"></script>
 *   <script src="js/art_original.js"></script>
 *   SVAArt.tower(ctx, 'shaota', 3, x, y, cell);          // 3 级哨塔，按格宽自适应
 *   SVAArt.draw(ctx, 'sheep', 'sheepHigh', {frame:0, x, y, w, h, anchor:'bottom'});
 */
window.SVAArt = (function () {
  var libs = window.SVA_ART || {};
  var pathCache = new Map();
  var MAX_CACHE = 4000;

  function path(d) {
    var p = pathCache.get(d);
    if (!p) {
      if (pathCache.size > MAX_CACHE) pathCache.clear();
      p = new Path2D(d);
      pathCache.set(d, p);
    }
    return p;
  }

  function css(c) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] / 255) + ')';
  }

  function paint(ctx, g) {
    if (g.k === 'solid') return css(g.c);
    var grad;
    if (g.k === 'lin') grad = ctx.createLinearGradient(g.p0[0], g.p0[1], g.p1[0], g.p1[1]);
    else grad = ctx.createRadialGradient(g.c[0], g.c[1], 0, g.c[0], g.c[1], Math.max(g.r, 0.01));
    for (var i = 0; i < g.stops.length; i++) {
      var s = g.stops[i];
      grad.addColorStop(Math.max(0, Math.min(1, s[0])), css(s[1]));
    }
    return grad;
  }

  function drawPrims(ctx, prims) {
    for (var i = 0; i < prims.length; i++) {
      var q = prims[i], t = q.t;
      ctx.save();
      ctx.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
      var p = path(q.d);
      if (q.f) {
        ctx.fillStyle = paint(ctx, q.f);
        ctx.fill(p, q.r === 'evenodd' ? 'evenodd' : 'nonzero');
      }
      if (q.s) {
        ctx.strokeStyle = css(q.s.c);
        ctx.lineWidth = q.s.w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(p);
      }
      ctx.restore();
    }
  }

  function entry(lib, name) {
    var pack = libs[lib];
    return pack && pack[name];
  }

  function frameOf(e, frame) {
    if (!e || !e.frames.length) return null;
    var f = frame | 0;
    if (f < 0) f += e.frames.length;
    return e.frames[Math.max(0, Math.min(e.frames.length - 1, f))];
  }

  function measure(lib, name, frame) {
    var fr = frameOf(entry(lib, name), frame);
    return fr ? {w: fr.vb[2], h: fr.vb[3], n: entry(lib, name).frames.length} : null;
  }

  /* 把整帧画进 (x,y,w,h)：anchor 决定对齐点，默认底部居中（单位/建筑用）。 */
  function draw(ctx, lib, name, o) {
    var e = entry(lib, name);
    var fr = frameOf(e, o.frame || 0);
    if (!fr) return false;
    var vb = fr.vb;
    var sx = o.w ? o.w / vb[2] : (o.scale || 1);
    var sy = o.h ? o.h / vb[3] : (o.scale || 1);
    if (o.w && !o.h) sy = sx;
    if (o.h && !o.w) sx = sy;
    var anchor = o.anchor || 'bottom';
    var ax = anchor.indexOf('left') >= 0 ? 0 : (anchor.indexOf('right') >= 0 ? 1 : 0.5);
    var ay = anchor.indexOf('top') >= 0 ? 0 : (anchor.indexOf('bottom') >= 0 ? 1 : 0.5);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.flip ? -sx : sx, sy);
    // 'origin'：素材自己的原点(0,0)落在 (x,y)。原作把塔/墙/障碍的原点放在格子中心，
    // 用这个锚点 + 固定比例（格宽/65）画，才和原作的位置、大小一致。
    if (anchor !== 'origin') ctx.translate(-(vb[0] + vb[2] * ax), -(vb[1] + vb[3] * ay));
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    drawPrims(ctx, fr.p);
    ctx.restore();
    return true;
  }

  /* 按格子尺寸画单位：cell 是格宽，ratio 是相对格宽的比例。 */
  function unit(ctx, lib, name, frame, x, y, cell, ratio, anchor) {
    var e = entry(lib, name);
    var fr = frameOf(e, frame);
    if (!fr) return false;
    var w = cell * (ratio || 1);
    var h = w * fr.vb[3] / fr.vb[2];
    return draw(ctx, lib, name, {frame: frame, x: x, y: y, w: w, h: h, anchor: anchor || 'bottom'});
  }

  function list(lib) {
    var pack = libs[lib] || {};
    return Object.keys(pack).map(function (k) {
      return {name: k, frames: pack[k].frames.length, w: pack[k].frames[0].vb[2], h: pack[k].frames[0].vb[3]};
    });
  }

  return {draw: draw, unit: unit, measure: measure, list: list, libs: libs,
          frameOf: function (lib, name, f) { return frameOf(entry(lib, name), f); }};
})();
