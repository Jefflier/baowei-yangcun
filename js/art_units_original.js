/* 战斗画面里的原作矢量：墙 / 辅助建筑 / 障碍物 / 危险设施 / 机关。
 *
 * 图源：assets/art/building.js、obstacle.js、landform.js（tools/export_assets.py 从原客户端导出）。
 * 依赖顺序：assets/art/*.js → js/art_original.js → js/art_chars.js → js/art_units.js → 本文件
 *
 * 关掉：window.SVA_ORIGINAL_ART.units = false
 */
(function (global) {
  'use strict';
  var SV = global.SV;
  if (!SV || !SV.Art) return;
  var Art = SV.Art, O = global.SVAArt;
  var cfg = global.SVA_ORIGINAL_ART = global.SVA_ORIGINAL_ART || {};
  if (!O || cfg.units === false) return;

  function has(lib, name) { return !!(O.libs[lib] && O.libs[lib][name]); }
  var on = cfg.units !== false;

  /* ---------- 障碍物：把主题装饰换成原作矢量 ---------- */
  var OBST = {
    tree:  ['zhangai_shu1', 'zhangai_shu2', 'zhangai_shu3'],
    forest: ['zhangai_shu1', 'zhangai_shu2', 'zhangai_shu3'],
    bush:  ['zhangai_shu4'],
    rock:  ['zhangai_shitou1', 'zhangai_shitou2', 'zhangai_shitou3', 'zhangai_shitou4']
  };
  /* 主题 → 用哪组原作障碍（没有对应组就退回程序化） */
  var DECO_BY_KIND = {
    tree: 'tree', dead: 'tree',
    rock: 'rock', lava: 'rock',
    pine: null, palm: null, machine: null
  };

  function pick(list, hsh) { return list[Math.min(list.length - 1, Math.floor(hsh * list.length))]; }

  /** 场地内/外的一块障碍（树、石头） */
  Art.drawObstacle = function (ctx, x, y, cs, hsh, hsh2, ch) {
    if (!on) return false;
    var group = OBST[(hsh2 || 0) < 0.16 ? 'bush' : 'tree'];
    var name = pick(group, hsh);
    if (!has('obstacle', name)) return false;
    // (x,y) 是格子底边中点（略靠上）；原作障碍的原点在格子中心，比例 = 格宽/65
    SVAArt.draw(ctx, 'obstacle', name, {x: x, y: y - (ch || cs) * 0.44, scale: cs / 65, anchor: 'origin'});
    return true;
  };

  var origDeco = Art.drawDeco;
  Art.drawDeco = function (ctx, kind, x, y, s, hsh, hsh2) {
    var grp = DECO_BY_KIND[kind];
    if (!on || !grp) return origDeco.apply(Art, arguments);
    var name = pick(OBST[grp], hsh);
    if (!has('obstacle', name)) return origDeco.apply(Art, arguments);
    SVAArt.draw(ctx, 'obstacle', name, {x: x, y: y, w: s * 1.06, anchor: 'bottom'});
  };

  /* ---------- 危险设施：火山 / 反应炉 / 核电厂 ---------- */
  var HAZARD = {volcano: 'zhangai_huoshan1', reactor: 'zhangai_fanyinglu',
                nuclear: 'zhangai_hedianchang1'};
  Art.drawHazardFacility = function (ctx, hz, cs, x, y, w, h) {
    if (!on) return false;
    var name = HAZARD[hz.kind];
    if (!name || !has('obstacle', name)) return false;
    // 原点在设施占地的中心，比例 = 格宽/65
    SVAArt.draw(ctx, 'obstacle', name, {x: x + w / 2, y: y + h / 2, scale: cs / 65, anchor: 'origin'});
    return true;
  };

  /* ---------- 墙 ---------- */
  if (has('building', 'qiang')) {
    var origWall = Art.drawWall;
    Art.drawWall = function (ctx, cs, cx, cy) {
      if (!on || !has('building', 'qiang')) return origWall.apply(Art, arguments);
      SVAArt.draw(ctx, 'building', 'qiang', {x: cx, y: cy, scale: cs / 65, anchor: 'origin'});
    };
  }

  /* ---------- 辅助建筑（盘龙柱 / 牛郎 / 织女 / 元宵灯楼） ---------- */
  var STATUE = {panlong: 'panlong', niulang: 'niulang', zhinu: 'zhinv', lantern: 'denglou'};
  var origStatue = Art.drawStatue;
  Art.drawStatue = function (ctx, sid, cs, cx, cy, t) {
    var name = STATUE[sid];
    if (!on || !name || !has('building', name)) return origStatue.apply(Art, arguments);
    SVAArt.draw(ctx, 'building', name, {x: cx, y: cy, scale: cs / 65, anchor: 'origin'});
  };

  /* ---------- 机关：爆炸箱 / 弹簧 ---------- */
  if (has('landform', 'WoodenBox') || has('landform', 'SpringOutT')) {
    var origAnim = Art.drawAnimated;
    Art.drawAnimated = function (ctx, bg, map, t, dmap) {
      var cs = bg.cs, ox = bg.ox, oy = bg.oy, A = bg.anim, ay = bg.ay || 1;
      // 动画层在「格子压扁」的坐标里画；箱子/弹簧是直立的图，绕格子中心把压扁抵消掉
      function upright(py, fn) { ctx.save(); ctx.translate(0, py); ctx.scale(1, 1 / ay); ctx.translate(0, -py); fn(); ctx.restore(); }
      if (on && A) {
        // 爆炸箱：原点在格子中心，比例 = 格宽/65
        if (has('landform', 'WoodenBox')) {
          for (var i = 0; i < A.crates.length; i++) {
            var ci = A.crates[i], c = ci % map.cols, r = (ci / map.cols) | 0;
            (function (px, py) {
              upright(py, function () { SVAArt.draw(ctx, 'landform', 'WoodenBox', {x: px, y: py, scale: cs / 65, anchor: 'origin'}); });
            })(ox + c * cs + cs / 2, oy + r * cs + cs / 2);
          }
          A = Object.assign({}, A, {crates: []});
        }
        // 弹簧（原作是俯视的一张图，这里给一点缩放脉动）
        if (has('landform', 'SpringOutT')) {
          for (var k = 0; k < A.springs.length; k++) {
            var si = A.springs[k], sc2 = si % map.cols, sr = (si / map.cols) | 0;
            var pulse = 1 + 0.06 * Math.sin(t * 5 + si);
            (function (px, py, pl) {
              upright(py, function () { SVAArt.draw(ctx, 'landform', 'SpringOutT', {x: px, y: py, scale: cs / 65 * pl, anchor: 'origin'}); });
            })(ox + sc2 * cs + cs / 2, oy + sr * cs + cs / 2, pulse);
          }
          A = Object.assign({}, A, {springs: []});
        }
      }
      return origAnim.call(Art, ctx, bg && Object.assign({}, bg, {anim: A}), map, t, dmap);
    };
  }

  global.SVAUnitsOriginal = {on: on, obstacle: OBST, hazard: HAZARD};
})(typeof window !== 'undefined' ? window : globalThis);
