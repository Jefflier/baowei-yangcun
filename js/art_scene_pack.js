/* 大厅 / 世界地图的原作背景接入。
 *
 * 图源：assets/scene/*.png，由 tools/build_scene.py 从原客户端的
 *   gameUI_dynamic_TheStronghold.swf  → village.png（羊村大厅）
 *   gameUI_dynamic_TheWorld.swf      → world1..4.png（四块大陆的羊皮纸地图）
 * 烘出来；关卡旗标坐标见 assets/scene/flags.js（同一脚本自动标定）。
 *
 * 做三件事：
 *   1. 接掉 Scene.build('hub'/'world')，换成原作插画（图没加载完先画程序化版本，load 完自动重画）；
 *   2. 把大厅的可点建筑挪到原作插画对应的位置上（Scene.hubHotspots）；
 *   3. 把关卡节点摆到原作地图的旗标位置（包装 Menu.layout）。
 *
 * 关掉：window.SVA_ORIGINAL_ART = {scene:false}
 */
(function (global) {
  'use strict';
  var SV = global.SV;
  if (!SV || !SV.Scene || !SV.Art) return;
  var Scene = SV.Scene, Art = SV.Art;
  var UI = SV.UI;
  var cfg = global.SVA_ORIGINAL_ART = global.SVA_ORIGINAL_ART || {};
  if (cfg.scene === false) return;

  var DIR = global.SVA_SCENE_DIR || 'assets/scene/';
  var SIZE = {village: [839, 736], world1: [743, 533], world2: [743, 533], world3: [743, 533], world4: [743, 533]};
  var WORLD_KEY = {1: 'world1', 2: 'world2', 3: 'world3', 4: 'world4'};
  var cache = {};
  var anyLoaded = false;

  function img(key) {
    var rec = cache[key];
    if (!rec) {
      rec = cache[key] = {im: new Image(), ok: false, w: SIZE[key][0], h: SIZE[key][1]};
      rec.im.onload = function () {
        rec.w = rec.im.naturalWidth || rec.w;
        rec.h = rec.im.naturalHeight || rec.h;
        rec.ok = rec.w > 8;
        if (rec.ok) {
          anyLoaded = true;
          Scene.invalidate();                                   // 让下一帧用原画重画
          if (key === 'village') {
            Scene.hubHotspots = buildSpots();
            // 如果这会儿已经站在大厅里，热区要重排一次
            if (UI && UI.screen === 'hub' && UI.Menu && UI.Menu.toHub) UI.Menu.toHub();
          } else if (UI && UI.screen === 'world' && UI.Menu && UI.Menu.toWorld && cfg.worldNodes !== false) {
            UI.Menu.toWorld();                                      // 原画到了：关卡节点换成贴着原画旗标的紧凑样式
          }
        }
      };
      rec.im.src = DIR + key + '.png';
    }
    return rec;
  }

  /* ---------- 1. 大厅：原作羊村插画 ---------- */
  var HUB = {scale: 720 / 736, offX: 0, offY: 0};   // 高对齐：插画按高度铺满，左右留边
  HUB.offX = (1280 - SIZE.village[0] * HUB.scale) / 2;
  function hubXY(ax, ay) { return [HUB.offX + ax * HUB.scale, HUB.offY + ay * HUB.scale]; }

  /* 原画里每栋建筑的位置（插画坐标，839×736），点哪栋进哪个功能 */
  /* ax/ay = 该建筑在原画（839×736）里的中心点。fn 里用 UI.xxx 现取，
     因为 UI.Panels / UI.Arena 是在 ui_panels.js / ui_arena.js 里后挂上去的。 */
  var HUB_SPOTS = [
    {id: 'mine',  n: '矿山',     ax: 205, ay: 200, w: 124, h: 112, fs: 16,
     fn: function () { return UI.Panels.mine(); }},
    {id: 'camp',  n: '训练营',   ax: 452, ay: 208, w: 124, h: 118, fs: 16, lv: 5,
     fn: function () { return UI.Panels.camp(); }},
    {id: 'arena', n: '竞技场',   ax: 420, ay: 314, w: 150, h: 112, fs: 16, lv: 8,
     fn: function () { return UI.Arena.open(); }},
    {id: 'lib',   n: '图鉴',     ax: 196, ay: 390, w: 118, h: 104, fs: 16,
     fn: function () { return UI.Panels.codex(); }},
    {id: 'work',  n: '宝石工坊', ax: 466, ay: 426, w: 112, h: 104, fs: 15,
     fn: function () { return UI.Panels.gems(); }},
    {id: 'shop',  n: '商店',     ax: 588, ay: 428, w: 112, h: 104, fs: 16,
     fn: function () { return UI.Panels.shop(); }},
    {id: 'board', n: '布告栏',   ax: 300, ay: 414, w: 104, h: 96, fs: 15,
     fn: function () { return UI.Panels.tasks(); }},
    {id: 'inn',   n: '好友',     ax: 612, ay: 190, w: 112, h: 100, fs: 16,
     fn: function () { return UI.Panels.friends(); }},
    {id: 'gate',  n: '出征！',   ax: 592, ay: 516, w: 150, h: 124, fs: 19, big: true,
     fn: function () { return UI.Menu.toWorld(); }}
  ];

  /* ui_menu.js 会用 SV.Scene.hubHotspots 覆盖它自带的坐标。
     只在原画真的加载出来之后才设置，否则程序化场景会配上一套对不上的热区。 */
  function buildSpots() {
    return HUB_SPOTS.map(function (s) {
      var p = hubXY(s.ax, s.ay);
      return {
        id: s.id, n: s.n, lv: s.lv, big: s.big, fs: s.fs, fn: s.fn,
        x: Math.round(p[0] - s.w / 2), y: Math.round(p[1] - s.h / 2), w: s.w, h: s.h
      };
    });
  }

  /* ---------- 2. 世界地图：原作羊皮纸 ---------- */
  var WB = {x: 120, y: 10, w: 1000, h: 700};      // 插画摆放区（右侧给地图信息面板留位置）
  function worldXF(ch) {
    var key = WORLD_KEY[ch] || WORLD_KEY[1], s = SIZE[key];
    var k = Math.min(WB.w / s[0], WB.h / s[1]);
    return {k: k, ox: WB.x + (WB.w - s[0] * k) / 2, oy: WB.y + (WB.h - s[1] * k) / 2};
  }
  function worldXY(ch, ax, ay) {
    var f = worldXF(ch);
    return [f.ox + ax * f.k, f.oy + ay * f.k];
  }

  /* ---------- 3. 换掉 Scene.build ---------- */
  var origBuild = Scene.build, origDraw = Scene.draw;

  Scene.build = function (name, ch) {
    var key = name + (ch || '');
    if ((name === 'hub' || name === 'world') && cfg.scene !== false) {
      var artKey = name === 'hub' ? 'village' : (WORLD_KEY[ch] || WORLD_KEY[1]);
      var rec = img(artKey);
      var fallback = Scene.cache[key];
      if (!rec.ok) return fallback || origBuild(name, ch);
      var s = SV.view ? SV.view.scale : 1;
      var cv = Art.mkCanvas(1280 * s, 720 * s), ctx = cv.getContext('2d');
      ctx.scale(s, s);
      if (name === 'world') {
        var bg = ctx.createRadialGradient(640, 300, 80, 640, 380, 900);
        bg.addColorStop(0, '#6b4a2c'); bg.addColorStop(1, '#33210f');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, 1280, 720);
        var f = worldXF(ch);
        ctx.drawImage(rec.im, f.ox, f.oy, SIZE[artKey][0] * f.k, SIZE[artKey][1] * f.k);
      } else {
        // 插画按高度铺满后左右留边：用插画自身的上/下色调做一条渐变，接缝不明显
        var hg = ctx.createLinearGradient(0, 0, 0, 720);
        hg.addColorStop(0, '#6d7881'); hg.addColorStop(0.55, '#9fae9c'); hg.addColorStop(1, '#d8ded9');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, 1280, 720);
        ctx.drawImage(rec.im, HUB.offX, HUB.offY, SIZE.village[0] * HUB.scale, SIZE.village[1] * HUB.scale);
      }
      return Scene.cache[key] = cv;
    }
    return origBuild(name, ch);
  };

  /* 动态层：原画已经有云/雪人/羊，只补几只散步的羊让大厅活起来 */
  var WALK = [
    {y: 470, size: 40, span: 560, x0: 300, sp: 16, ph: 0.0},
    {y: 520, size: 34, span: 700, x0: 260, sp: -13, ph: 0.4},
    {y: 560, size: 36, span: 520, x0: 520, sp: 15, ph: 0.75}
  ];
  Scene.draw = function (ctx, name, t, opts) {
    if (name !== 'hub' || !img('village').ok) return origDraw.apply(Scene, arguments);
    opts = opts || {};
    var s = SV.view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.drawImage(Scene.build(name, opts.ch), 0, 0, 1280, 720);
    for (var i = 0; i < WALK.length; i++) {
      var w = WALK[i];
      var pos = ((t * w.sp + w.ph * w.span * 2) % (w.span * 2) + w.span * 2) % (w.span * 2);
      var x = w.x0 + (pos < w.span ? pos : w.span * 2 - pos);
      if (x < 60 || x > 1220) continue;
      Art.drawSheep(ctx, x, w.y, w.size, t + i, {dir: w.sp >= 0 ? 1 : -1, speed: 3, bell: false});
    }
  };

  /* ---------- 4. 关卡节点摆到旗标位置 ---------- */
  var flags = global.SVA_SCENE_FLAGS || null;
  /* 原作世界地图上的关卡是画在羊皮纸上的交叉剑旗标，没有缩略图圆牌。原画加载好之后节点缩成一个编号牌 + 名字，
     旗标露出来；缩略图仍在右侧信息面板里。关掉：window.SVA_ORIGINAL_ART = {worldNodes:false}。 */
  function compactNodes(ch) {
    if (!flags || cfg.worldNodes === false || cfg.scene === false) return false;
    var rec = cache[WORLD_KEY[ch || (UI && UI.worldCh) || 1]];
    return !!(rec && rec.ok);
  }
  if (UI && UI.Menu && flags && UI.Menu.layout) {
    var origLayout = UI.Menu.layout;
    UI.Menu.layout = function (ch) {
      var r = origLayout(ch);
      var fl = flags[ch];
      if (!fl || !fl.length) return r;
      var list = r.list, n = list.length, pos = {};
      for (var i = 0; i < n; i++) {
        var k = fl.length === n ? i : Math.round(i * (fl.length - 1) / Math.max(1, n - 1));
        var p = worldXY(ch, fl[k][0], fl[k][1]);
        // 紧凑节点（原作的旗标剑本来就画在羊皮纸上）直接落在旗标中心；旧的大圆缩略图要往下挪一点，免得盖住旗子
        pos[list[i]] = {x: Math.round(p[0]), y: Math.round(p[1] + (compactNodes(ch) ? 0 : 14))};
      }
      return {list: list, pos: pos, flags: true};
    };
    var origPath = Scene.drawWorldPath;
    Scene.drawWorldPath = function (ctx) {
      var pos = UI.Menu && UI.Menu.pos;
      if (!pos || !flags[UI.worldCh]) return origPath(ctx);
      // 原画路线上画一条很淡的虚线，只用来提示顺序
      var list = UI.Menu.layout(UI.worldCh).list;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      var started = false;
      for (var k = 0; k < list.length; k++) {
        var p = pos[list[k]]; if (!p) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(120,80,36,.30)'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,240,190,.55)'; ctx.setLineDash([9, 11]); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    };
  }

  Object.keys(WORLD_KEY).forEach(function (k) { img(WORLD_KEY[k]); });   // 提前拉世界地图原画，进世界地图时就能用紧凑节点
  global.SVAScenePack = {compactNodes: compactNodes, img: img, HUB_SPOTS: HUB_SPOTS, worldXY: worldXY, hubXY: hubXY,
                         ready: function () { return anyLoaded; }};
})(typeof window !== 'undefined' ? window : globalThis);
