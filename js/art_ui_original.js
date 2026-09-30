/* 把原作**界面素材**接进 DOM 界面（资源图标、道具图标、按钮）。
 *
 * 数据来自 assets/art/material.js（gameUI_material.swf）与 assets/art/item.js（gameUI_item.swf），
 * 由 tools/export_assets.py 从原客户端导出。
 *
 * 依赖顺序：… → js/art_original.js → js/art_units.js → js/ui_core.js → 本文件 → js/main.js
 * 关掉（回到程序化图标）：window.SVA_ORIGINAL_ART = {ui: false}
 */
(function () {
  'use strict';
  var SV = window.SV, A = SV && SV.Art, UI = SV && SV.UI, O = window.SVAArt;
  if (!A || !UI || !O || !A.iconURL) return;          // 美术或界面模块还没加载
  var h = UI.h;
  var cfg = window.SVA_ORIGINAL_ART = window.SVA_ORIGINAL_ART || {tower: true, sheep: true, wolf: true};

  function has(lib, name) { return !!(O.libs[lib] && O.libs[lib][name]); }

  /* 把原作符号等比画进小画布 → data URL，<img src> 直接能用。
     数据是矢量的，所以给 2× 背衬再放大，小尺寸下也不糊。 */
  var cache = {};
  function url(lib, name, w, hh, frame) {
    if (cfg.ui === false || !has(lib, name)) return null;
    var key = lib + '/' + name + '@' + w + 'x' + hh + '#' + (frame || 0);
    if (cache[key] !== undefined) return cache[key];
    var cv = A.mkCanvas ? A.mkCanvas(w * 2, hh * 2) : null;
    var m = cv && O.measure(lib, name, frame || 0);
    if (!m) return cache[key] = null;
    var cx = cv.getContext('2d');
    cx.scale(2, 2);
    var k = Math.min(w / m.w, hh / m.h) * 0.96;        // 留一点边，别把描边裁掉
    O.draw(cx, lib, name, {frame: frame || 0, x: w / 2, y: hh / 2,
                           w: m.w * k, h: m.h * k, anchor: 'center'});
    return cache[key] = cv.toDataURL('image/png');
  }

  /* 原始符号名 → data URL（找不到就返回 null） */
  A.matURL = function (name, w, hh) { return url('material', name, w, hh); };
  A.itemURL = function (name, w, hh) { return url('item', name, w, hh); };
  A.skillURL = function (name, w, hh) { return url('skill', name, w, hh); };
  /* 不用管符号在哪个库里：material 先找，再找 item */
  A.uiURL = function (name, size) {
    return url('material', name, size, size) || url('item', name, size, size);
  };
  /* 狼身上的道具（gameUI_wolf.swf）：气球、间谍狼、火把… frame 是导出数组的下标 */
  A.propURL = function (name, w, hh, frame) { return url('wolfui', name, w, hh, frame); };
  A.icoImg = function (src, size, cls) {
    return h('img', {class: cls || 'icoimg', src: src,
                     style: size ? {width: size + 'px', height: size + 'px'} : null});
  };

  /* 界面里统一用这个取图标：拿到原版就是原版，没有就退回程序化那个。 */
  UI.resIcon = function (name, size, fallbackFn) {
    size = size || 26;
    var src = A.uiURL(name, size);
    if (src) return A.icoImg(src, size);
    var el = fallbackFn && fallbackFn();
    return el || h('span', {text: '•'});
  };

  /* 原作技能/抗性图标只在信息面板中使用。保留文字，既方便辨识又让缺失符号安全降级。 */
  UI.skillTag = function (name, text, cls) {
    var src = A.skillURL(name, 18, 18);
    return h('span', {class: 'res-tag ' + (cls || 'sk')},
      src ? A.icoImg(src, 18, 'skillico') : null,
      h('span', {text: text}));
  };

  /* ---------- 顶栏/战场的资源图标换成原版 ---------- */
  var oCoin = UI.coinImg, oPt = UI.ptImg, oCandy = UI.candyImg;
  UI.coinImg = function () { return UI.resIcon('UI_icon_coin', 26, oCoin); };       // 银币
  UI.ptImg = function () { return UI.resIcon('UI_icon_integral', 26, oPt); };       // 积分
  UI.candyImg = function () { return UI.resIcon('rmbbt', 26, oCandy); };            // 入梦棒棒糖
  UI.bombImg = function (size) {
    return UI.resIcon('baozhatong1', size || 26, function () {
      return A.icoImg(A.iconURL('bomb_ico', 26, 26, function (cx, w, hh) {
        A.drawBomb(cx, 44, w / 2, hh - 4, false, 0);
      }), size || 26);
    });
  };
  /* 机关图标：捕兽夹 / 地雷 */
  UI.trapImg = function (tid, size) {
    var name = tid === 'clamp' ? 'bushoujia1' : 'za_le';
    return UI.resIcon(name, size || 26, function () {
      return A.icoImg(A.iconURL('trap_' + tid, 40, 40, function (cx, w, hh) {
        A.drawTrap(cx, tid, 36, 20, 22, true);
      }), size || 26);
    });
  };

  /* ---------- 狼头像：原作模型 ----------
     所有「狼图标」（下一波预览条、波次页、图鉴、BOSS 卡、训练营、竞技场…）都走 UI.wolfImg → Art.wolfIconURL。
     以前它用程序化狼画一次就缓存，而第一次画的时候原作图集大多还没加载完，缓存下来的就永远是旧模型。
     现在：图集能画时用原作图集出图标（正面朝向，和塔图标一样缓存）；还没加载好就先给旧模型顶着，
     但不缓存它，图集一到位 <img> 自动换成原作模型。关掉：window.SVA_ORIGINAL_ART = {wolf:false}。 */
  var OW = window.SVAWolfOrigin, oWolfIcon = A.wolfIconURL, wcache = {};
  function wolfOriginURL(id, size) {
    var def = SV.wolfDef && SV.wolfDef(id);
    if (!OW || cfg.wolf === false || !def) return null;
    var wid = OW.idOf(def);
    if (!wid || !OW.ready(wid)) return null;
    var key = wid + '@' + size;
    if (wcache[key]) return wcache[key];
    var cv = A.mkCanvas ? A.mkCanvas(size * 2, size * 2) : null;
    if (!cv) return null;
    var cx = cv.getContext('2d');
    cx.scale(2, 2);
    // 原作图集每一帧都按自己的包围盒居中缩放进 96×96 的格子，所以直接铺满图标就是「一整只狼」；
    // 取正面（d）行走帧里偏中间的一帧，脚底贴近图标底边
    var ok = OW.draw(cx, {id: wid, dir: 'd', frame: 3, x: size / 2, y: size * 0.99, size: size * 0.98});
    if (!ok) return null;
    return wcache[key] = cv.toDataURL('image/png');
  }
  A.wolfIconURL = function (id, size) {
    size = size || 56;
    return wolfOriginURL(id, size) || oWolfIcon.call(A, id, size);
  };
  // 图集没到位时先用旧模型的图标顶着（没有原作模型的两只狼——玩具小丑、吸血鬼狼——就一直是它）；到位后换成原作的
  UI.wolfImg = function (id, size) {
    var px = size || 42, img = h('img', {src: A.wolfIconURL(id, 56), style: {width: px + 'px', height: px + 'px'}});
    var def = SV.wolfDef && SV.wolfDef(id), wid = def && OW && cfg.wolf !== false ? OW.idOf(def) : null;
    if (wid && !OW.ready(wid)) OW.whenReady(wid, function () { img.src = A.wolfIconURL(id, 56); });
    return img;
  };

  window.SVAUIKit = {ui: cfg.ui !== false, cache: cache};
})();
