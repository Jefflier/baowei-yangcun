/* 原作地图底图 —— assets/map/m*.png（由 tools/build_maps.py 从 gameUI/dynamic/m*.swf 烘出来）。
 *
 * 两种用法：
 *
 * 1. **标定过的关卡**（assets/map/register.js 里有这一关）：原作底图上把羊村、出怪台、树石都烘好了，
 *    而且格子是 65×50 的长方形（SV.CELL_W/CELL_H）。register.js 给出「棋盘左上角在原图里的像素位置」，
 *    渲染时按 cs/65 等比缩放、把这个点对到棋盘左上角，羊村/出怪台就正好落在对应的格子上，
 *    不需要（也不应该）再叠一层程序化的房子和树。
 * 2. **没标定的关卡**：退回旧办法——按主题挑一张相近的底图，把「场地」矩形缩放到棋盘上。
 *
 * 用法（art_terrain.js 在用）：
 *   SVAMapArt.drawInto(ctx, map, cs, M, W, H, ch, {ox, oy});   // 铺到画布，返回是否成功
 *   SVAMapArt.registered(map)                                   // 这一关有没有标定过
 */
window.SVAMapArt = (function () {
  var THEME_BG = {
    grass: 'm1', forest: 'm2', river: 'm1', swamp: 'm2',
    desert: 'm3', canyon: 'm6', beach: 'm5', mine: 'm3',
    snow: 'm10', ice: 'm11', volcano: 'm7',
    factory: 'm15', ruins: 'm18', cave: 'm18'
  };
  var INSET = 0.16;                 // 没有标定数据时的兜底内缩
  /* 场地矩形与场地代表色：tools/build_maps.py 标定后写进 assets/map/fields.js。
     那个文件可能排在后面加载，所以这里每次都现取。 */
  function fields() { return window.SVA_MAP_FIELDS || {}; }
  /* 逐关标定：assets/map/register.js（tools/map_register.py 生成） */
  function regs() { return window.SVA_MAP_REG || {}; }
  var cache = {};
  var dir = window.SVA_MAP_DIR || 'assets/map/';

  function img(id) {
    var rec = cache[id];
    if (!rec) {
      rec = cache[id] = {im: new Image(), ok: false};
      rec.im.onload = function () { rec.ok = rec.im.naturalWidth > 8; };
      rec.im.src = dir + id + '.png';
    }
    return rec;
  }

  function regOf(map) {              // 标定过（有 x,y）
    if (window.SVA_ORIGINAL_ART && window.SVA_ORIGINAL_ART.map === false) return null;
    var r = regs()[map.idx];
    return r && r.art && r.x != null ? r : null;
  }

  function bgFor(map) {
    var r = regs()[map.idx];          // 只指定了底图、没标定的关卡：走「场地缩放」的旧办法，但底图是对的
    return r && r.art ? r.art : (THEME_BG[map.theme] || THEME_BG.grass);
  }

  /* 场地矩形（原图像素）。没有标定数据就退回「四周各内缩 16%」。 */
  function fieldRect(id, iw, ih) {
    var f = fields()[id];
    var r = f && (f.rect || (Array.isArray(f) ? f : null));   // 兼容两种 fields.js 写法
    if (r && r[2] > 8 && r[3] > 8) return r;
    return [iw * INSET, ih * INSET, iw * (1 - 2 * INSET), ih * (1 - 2 * INSET)];
  }

  function drawInto(ctx, map, cs, M, W, H, ch, o) {
    if (window.SVA_ORIGINAL_ART && window.SVA_ORIGINAL_ART.map === false) return false;
    ch = ch || cs;
    var ox = o && o.ox != null ? o.ox : M * cs, oy = o && o.oy != null ? o.oy : M * ch;
    var r = regOf(map);
    var id = bgFor(map);
    var rec = img(id);
    if (!rec.ok) return false;
    var im = rec.im, iw = im.naturalWidth, ih = im.naturalHeight;
    ctx.save();
    if (r) {
      // 标定过：原图 1 像素 = cs/65 屏幕像素，棋盘左上角 = 原图 (r.x, r.y)
      var k0 = cs / (window.SV && SV.CELL_W || 65);
      var ax = ox - r.x * k0, ay0 = oy - r.y * k0, aw = iw * k0, ah = ih * k0;
      if (r.edge) { ctx.fillStyle = r.edge; ctx.fillRect(0, 0, W, H); }
      if (ax > 0 || ay0 > 0 || ax + aw < W || ay0 + ah < H) {
        // 原画比视口小：图外用「放大 + 模糊」的原画自己补，比纯色更接得上
        try {
          var cw = Math.max(W / aw, H / ah) * 1.4, w2 = aw * cw, h2 = ah * cw;
          ctx.filter = 'blur(10px)';
          ctx.drawImage(im, (W - w2) / 2, (H - h2) / 2, w2, h2);
          ctx.filter = 'none';
        } catch (e) { /* 不支持 filter 就用纯色 */ }
      }
      ctx.drawImage(im, ax, ay0, aw, ah);
      // 补丁：这一关不该有的烘焙物（如第 6 关不该有第 8 关的雕像台）用周围的地面色盖掉
      if (r.patch) {
        for (var i = 0; i < r.patch.length; i++) {
          var pt = r.patch[i];
          ctx.fillStyle = pt.fill || r.edge || '#000';
          if (pt.round) { ctx.beginPath(); ctx.ellipse(ax + (pt.rect[0] + pt.rect[2] / 2) * k0, ay0 + (pt.rect[1] + pt.rect[3] / 2) * k0, pt.rect[2] / 2 * k0, pt.rect[3] / 2 * k0, 0, 0, 7); ctx.fill(); }
          else ctx.fillRect(ax + pt.rect[0] * k0, ay0 + pt.rect[1] * k0, pt.rect[2] * k0, pt.rect[3] * k0);
        }
      }
      ctx.restore();
      return true;
    }
    var fr = fieldRect(id, iw, ih);
    var fx = fr[0], fy = fr[1], fw = fr[2], fh = fr[3];
    // 场地等比缩放到棋盘。用 max 保证棋盘不会露出场地外的树石，
    // 但限制最多放大 1.25 倍，免得跟棋盘长宽比差太多时把装饰环整个挤出画布。
    var bw = map.cols * cs, bh = map.rows * ch;
    var kMin = Math.min(bw / fw, bh / fh);
    var k = Math.min(Math.max(bw / fw, bh / fh), kMin * 1.25);
    var dw = iw * k, dh = ih * k;
    var dx = ox + bw / 2 - (fx + fw / 2) * k;
    var dy = oy + bh / 2 - (fy + fh / 2) * k;
    ctx.drawImage(im, dx, dy, dw, dh);
    ctx.restore();
    return true;
  }

  /* 底图是懒加载的：第一次建背景时图还没到，所以先按程序化画；等图 load 完再重画一次，
     并把结果回填到同一个 canvas（渲染器持有的是这个引用，尺寸不变）。 */
  function installRebuild() {
    var Art = window.SV && window.SV.Art;
    if (!Art || !Art.buildBackground || Art.__mapArtWrapped) return;
    Art.__mapArtWrapped = true;
    var orig = Art.buildBackground;
    Art.buildBackground = function (map) {
      var args = arguments;
      var res = orig.apply(Art, args);
      if (!res || img(bgFor(map)).ok) return res;
      var rec = img(bgFor(map));
      var prev = rec.im.onload;
      rec.im.onload = function () {
        if (prev) prev();
        try {
          var res2 = orig.apply(Art, args);
          var dst = res.canvas.getContext('2d');
          dst.setTransform(1, 0, 0, 1, 0, 0);
          dst.clearRect(0, 0, res.canvas.width, res.canvas.height);
          dst.drawImage(res2.canvas, 0, 0, res.canvas.width, res.canvas.height);
          res.reg = res2.reg; res.anim = res2.anim;
          if (window.SV && SV.renderer) SV.renderer.bgReady = true;
        } catch (e) { /* 回填失败就保持程序化画面 */ }
      };
      return res;
    };
  }
  function warm() {              // 标定过的底图提前拉起来，进关卡/看缩略图时基本已就绪
    var R = regs(), seen = {};
    for (var k in R) if (R[k] && R[k].art && !seen[R[k].art]) { seen[R[k].art] = 1; img(R[k].art); }
  }
  function init() { installRebuild(); setTimeout(warm, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {drawInto: drawInto, bgFor: bgFor, cache: cache, THEME_BG: THEME_BG,
          registered: function (map) { var r = regOf(map); return r && img(r.art).ok ? r : null; },
          field: function (map) { var f = fields()[bgFor(map)]; return (f && f.color) || null; },
          ready: function (map) { return !!img(bgFor(map)).ok; },
          prefetch: function (map) { img(bgFor(map)); }};
})();
