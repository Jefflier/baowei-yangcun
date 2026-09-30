/* 原作狼模型渲染器 —— 直接用 assets/wolf/<id>.png 精灵图（原作 SWF 逐帧烘出来的）。
 *
 * 图集布局（由 tools/build_wolves.ps1 生成）：
 *   assets/wolf/<id>.png        4 行（d / l / u / r）× 24 列（行走帧），单元格 96×96
 *   assets/wolf/<id>_dead.png   同上，12 列（死亡动画，每 3 帧取 1）
 *
 * 用法：
 *   SVAWolfOrigin.draw(ctx, {id:'bdl', dir:'r', frame:3, x, y, size});
 *   dir 可用 d/l/u/r；游戏里只有左右时给 r 或 l（l 会水平镜像 r）。
 */
window.SVAWolfOrigin = (function () {
  // 注意：每只狼的行走帧数都不一样（实测 10~34 列），列数是从图片宽度量出来的。
  // 早期版本把列数写死成 24，导致 58 只狼取到越界帧、整只退回手搓模型（看起来就是朝向/造型乱跳）。
  var CELL = 96, DEF_COLS = 24, ROWS = 4;
  var DIRS = {d: 0, l: 1, u: 2, r: 3};
  var cache = {};          // id -> {img, dead, ok, failed, cols, deadCols}

  /* 哪些狼的哪个朝向行要水平镜像（assets/wolf/flips.js，tools/wolf_flips.py 从 SWF 的朝向选择器矩阵里扫出来）。
     原作里很多狼只画了一个侧面，另一侧是同一份动画 scaleX=-1 镜像出来的；烘图时丢了这个矩阵，
     所以图集里这两行是同一个方向。不重烘，运行时翻：每帧都按自己的包围盒居中进单元格，镜像后位置大小不变。 */
  var FLIPS = window.SVA_WOLF_FLIPS || {};

  /* 图集目录：默认相对页面（index.html 在根目录），放在 tools/ 下的测试页请设
     window.SVA_WOLF_DIR = '../assets/wolf/'。 */
  function base() {
    return window.SVA_WOLF_DIR || 'assets/wolf/';
  }

  function load(id) {
    if (cache[id]) return cache[id];
    var rec = {img: new Image(), dead: new Image(), ok: false, failed: false,
               cols: DEF_COLS, deadCols: DEF_COLS};
    cache[id] = rec;
    rec.img.onload = function () {
      rec.cols = Math.max(1, Math.round(rec.img.naturalWidth / CELL));
      rec.ok = rec.img.naturalWidth >= CELL && rec.img.naturalHeight >= CELL;
      if (!rec.ok) rec.failed = true;
    };
    rec.img.onerror = function () { rec.failed = true; };
    rec.img.src = base() + id + '.png';
    rec.dead.onload = function () {
      rec.deadCols = Math.max(1, Math.round(rec.dead.naturalWidth / CELL));
    };
    rec.dead.src = base() + id + '_dead.png';
    // 顺手把别名模型也拉起来（sdys_A 之类用的是 sdys 的图），免得开场先闪一下手搓狼
    var alt = aliasOf(id) || [];
    for (var i = 0; i < alt.length; i++) if (alt[i] !== id) load(alt[i]);
    return rec;
  }

  /* data.js 的键 → 原站真实存在的模型名。原站没有专门 SWF 的变体复用基础模型：
     D_glykl → glykl、sdys_A → sdys、yll_B / yll_B2 → yll、bylX → byl、daomu2_Z → daomu2… */
  /* 原站上确实没有对应 SWF 的少数几只，只能借同族模型（名字一样 / 就是同一只的大小版本）。
     宁可借模型，也别掉回完全不同的手搓画风；原站要是补了图就把这里删掉。 */
  var EXTRA_ALIAS = {
    bylX: ['byl2'],              // 两只都叫「愤怒的搬运狼」
    liyuqil: ['xiaoliyuqil'],    // 鲤鱼旗狼 → 小鲤鱼旗狼（同族）
    lyql: ['xiaoliyuqil']
  };

  function aliasOf(id) {
    if (!id) return null;
    var s = String(id);
    var cand = [s, s.replace(/^[DH]_?/, ''), s.replace(/_[A-Za-z]\d?$/, ''), s.replace(/X$/, '')];
    var extra = EXTRA_ALIAS[s] || [];
    for (var e = 0; e < extra.length; e++) cand.push(extra[e]);
    var seen = {}, list = [];
    for (var i = 0; i < cand.length; i++) {
      var v = cand[i];
      if (!v || seen[v]) continue;
      seen[v] = 1; list.push(v);
      var lv = v.toLowerCase();
      if (lv !== v && !seen[lv]) { seen[lv] = 1; list.push(lv); }
    }
    return list;
  }

  /* 挑一只真能画的：先试自己，再按别名顺序试 */
  function pick(id) {
    var list = aliasOf(id) || [];
    for (var i = 0; i < list.length; i++) {
      var r = load(list[i]);
      if (r.ok) return {rec: r, id: list[i]};
      if (!r.failed && r.img.complete && r.img.naturalWidth) return {rec: r, id: list[i]};
    }
    return null;
  }

  function ready(id) { return !!pick(id); }

  /* 等这只狼的图集能画了再回调（已经能画就立刻回调）。图标 <img> 靠它在图集加载完之后换成原作模型 */
  function whenReady(id, cb) {
    if (pick(id)) { cb(); return; }
    var list = aliasOf(id) || [], done = false;
    var check = function () { if (!done && pick(id)) { done = true; cb(); } };
    for (var i = 0; i < list.length; i++) {
      var r = load(list[i]);
      if (!r.failed) r.img.addEventListener('load', check);
    }
  }

  function colsOf(id) {
    var p = pick(id);
    return p ? (p.rec.cols || DEF_COLS) : DEF_COLS;
  }

  /* 死亡动画的帧数（_dead.png 的列数）；还没加载好 / 没有死亡图返回 0 */
  function deadColsOf(id) {
    var p = pick(id);
    return p && p.rec.dead.naturalWidth >= CELL ? (p.rec.deadCols || DEF_COLS) : 0;
  }

  function draw(ctx, o) {
    var id = o.id;
    if (!id) return false;
    var p = pick(id);
    if (!p) return false;
    var r = p.rec;
    var dir = DIRS[o.dir] != null ? o.dir : 'r';
    var row = DIRS[dir];
    var flip = !!(FLIPS[p.id] && FLIPS[p.id].indexOf(dir) >= 0);
    var useDead = o.dead && r.dead.naturalWidth >= CELL;
    var cols = useDead ? (r.deadCols || DEF_COLS) : (r.cols || DEF_COLS);
    var img = useDead ? r.dead : r.img;
    var n = Math.floor(o.frame || 0);
    if (!isFinite(n)) n = 0;
    // o.hold：停在最后一帧（死亡动画不循环）
    n = o.hold ? Math.max(0, Math.min(cols - 1, n)) : ((n % cols) + cols) % cols;
    var sx = n * CELL, sy = row * CELL;
    if (img.naturalWidth < (n + 1) * CELL) return false;
    var size = o.size || CELL;
    var k = size / CELL;
    if (flip) { ctx.save(); ctx.translate(o.x, 0); ctx.scale(-1, 1); ctx.translate(-o.x, 0); }
    ctx.drawImage(img, sx, sy, CELL, CELL, o.x - size / 2, o.y - size, size, size);
    if (o.flash) {                      // 受击闪白：同一帧叠加一遍（加色），透明处不受影响
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
      ctx.drawImage(img, sx, sy, CELL, CELL, o.x - size / 2, o.y - size, size, size);
      ctx.restore();
    }
    if (flip) ctx.restore();
    return true;
  }

  /* 用游戏的狼定义反查资源 id（data.js 的键与 SWF 文件名一致） */
  var byDef = null;
  function idOf(def) {
    if (!def || !window.SV || !SV.D || !SV.D.wolves) return null;
    // SV.wolfDef() 会把 id 写回定义对象，最省事
    if (def.id && SV.D.wolves[def.id] === def) return def.id;
    if (def.__wid) return def.__wid;
    if (!byDef) {
      byDef = new Map();
      for (var k in SV.D.wolves) {
        var d = SV.D.wolves[k];
        if (d && typeof d === 'object') { byDef.set(d, k); if (!d.__wid && !d.id) d.__wid = k; }
      }
    }
    return byDef.get(def) || null;
  }

  return {draw: draw, ready: ready, whenReady: whenReady, idOf: idOf, colsOf: colsOf, deadColsOf: deadColsOf, aliasOf: aliasOf, resolve: pick,
          CELL: CELL, DIRS: DIRS, load: load, cache: cache};
})();
