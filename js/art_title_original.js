/* 标题画面：用原作入口宣传图（first_install.jpg）当底图。
 *
 * 图源：assets/ui/images.js（tools/export_ui_images.py 从原站静态图打包，data URI 内联）。
 * 原图 760×471，自带「保卫羊村」标题字、被炮弹炸飞的狼、三座炮塔和小羊，所以标题画面不再另画 logo 文字：
 * 给 #scr-title 加 .orig 类，由 css/style.css 把「怀旧服」徽章和按钮挪到图上留白处。
 *
 * 图没加载完 / 缺文件时保持程序化的羊村场景。关掉：window.SVA_ORIGINAL_ART = {title:false}
 */
(function (global) {
  'use strict';
  var SV = global.SV;
  if (!SV || !SV.Scene || !SV.Art) return;
  var Scene = SV.Scene, Art = SV.Art;
  var cfg = global.SVA_ORIGINAL_ART = global.SVA_ORIGINAL_ART || {};
  var src = global.SVA_UI && global.SVA_UI.title;
  if (cfg.title === false || !src) return;

  var im = new Image(), ok = false;
  function mark(on) {
    var el = document.getElementById('scr-title');
    if (el) el.classList.toggle('orig', on);
  }
  im.onload = function () {
    ok = im.naturalWidth > 8;
    if (ok) { Scene.invalidate(); mark(true); }
  };
  im.src = src;

  var origBuild = Scene.build, origDraw = Scene.draw;

  /* 按宽度铺满 1280，顶端对齐（标题字在图的左上角，宁可裁掉底部的草地），底部压一层暗角让按钮和页脚看得清 */
  Scene.build = function (name, ch) {
    if (name !== 'title' || !ok || cfg.title === false) return origBuild.apply(Scene, arguments);
    if (Scene.cache.title) return Scene.cache.title;
    var s = SV.view ? SV.view.scale : 1;
    var cv = Art.mkCanvas(1280 * s, 720 * s), ctx = cv.getContext('2d');
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    var k = 1280 / im.naturalWidth;
    ctx.drawImage(im, 0, 0, 1280, im.naturalHeight * k);
    var g = ctx.createLinearGradient(0, 470, 0, 720);
    g.addColorStop(0, 'rgba(20,50,10,0)'); g.addColorStop(1, 'rgba(20,50,10,0.38)');
    ctx.fillStyle = g; ctx.fillRect(0, 470, 1280, 250);
    return Scene.cache.title = cv;
  };

  Scene.draw = function (ctx, name, t, opts) {
    if (name !== 'title' || !ok || cfg.title === false) return origDraw.apply(Scene, arguments);
    var s = SV.view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.drawImage(Scene.build('title'), 0, 0, 1280, 720);
  };

  global.SVATitleArt = { ready: function () { return ok; } };
})(typeof window !== 'undefined' ? window : globalThis);
