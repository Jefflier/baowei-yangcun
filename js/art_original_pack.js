/* 把原作矢量包接进游戏（默认开启「塔 + 羊」，狼可选）。
 *
 * 依赖顺序：assets/art/*.js → js/art_original.js → js/art_chars.js → 本文件
 * 关闭：window.SVA_ORIGINAL_ART = {tower:false, sheep:false, wolf:false}
 */
(function () {
  var A = (window.SV && SV.Art) || window.Art;
  if (!A || !A.drawTower) return;                 // 美术模块还没加载
  var O = window.SVAArt;
  var cfg = window.SVA_ORIGINAL_ART = window.SVA_ORIGINAL_ART || {tower: true, sheep: true, wolf: true};
  // 注意：js/art_units_original.js 等模块会先把 window.SVA_ORIGINAL_ART 建成 {}（它只关心自己的开关），
  // 所以这里必须逐个键补默认值 —— 不能只在「对象不存在」时才给默认值，否则塔/羊/狼会被悄悄退回程序化绘制。
  if (cfg.tower === undefined) cfg.tower = true;
  if (cfg.sheep === undefined) cfg.sheep = true;
  if (cfg.wolf === undefined) cfg.wolf = true;

  var TOWER_KEY = {sentry: 'shaota', scatter: 'sandanta', cannon: 'paota',
                   pulse: 'bodongta', inlay: 'xiangqianta'};
  var SHEEP_KEY = {idle: 'sheepHigh', happy: 'sheepHigh', scared: 'sheepAfraid',
                   cry: 'sheepCry', angry: 'sheepAnger', sleep: 'sleepSheep',
                   dream: 'dreamSheep', fear: 'sheepFear'};

  function has(lib, name) { return !!(O && O.libs[lib] && O.libs[lib][name]); }

  /* 塔：原版的塔符号是 6 帧，第 0 帧是「建造中」的占位，导出时已经只取了 1~5，
     所以导出数据里的下标 0~4 就是五档外观。分档点与 art_chars.js 的 tier 保持一致。 */
  function tierFrame(b) {
    var T = SV.D.towers[b.type];
    var lf = b.lv / T.max;
    return lf >= 1 ? 4 : lf >= 0.8 ? 3 : lf >= 0.55 ? 2 : lf >= 0.3 ? 1 : 0;
  }

  var origTower = A.drawTower;
  A.drawTower = function (ctx, b, cs, cx, cy, t, opts) {
    opts = opts || {};
    var key = TOWER_KEY[b.type];
    if (!cfg.tower || !key || !has('tower', key)) return origTower.apply(A, arguments);
    ctx.save();
    if (opts.mini) ctx.globalAlpha *= 0.85;
    var frame = tierFrame(b);
    SVAArt.draw(ctx, 'tower', key, {
      // 原点在格子中心、比例 = 格宽/65（与原作一致）；固定比例，升级时塔不会忽大忽小
      frame: frame, x: cx, y: cy, scale: cs / 65, anchor: 'origin'
    });
    // 宝石：原作是把镶嵌的宝石画在塔身的插槽里（镶嵌塔用原画宝石改色，其余塔画程序化宝石）
    drawSocketGem(ctx, b, cs, cx, cy, frame, key, t);
    // 等级牌：原作只在「看对手防线」时才显示等级气泡，普通战斗里塔上是干净的，
    // 所以默认只在选中/悬停时显示；想常显设 window.SVA_ORIGINAL_ART = {levelBadge: 'always'}
    if (!opts.mini && cfg.levelBadge !== false &&
        (cfg.levelBadge === 'always' || opts.sel)) levelBadge(ctx, b, cs, cx, cy, frame);
    ctx.restore();
  };

  /* 宝石插槽：位置/大小按各塔外框的比例给（x,y 是外框内的相对坐标，r 是相对外框宽） */
  var GEM_SOCKET = {
    sentry:  {x: 0.50, y: 0.64, r: 0.115},
    scatter: {x: 0.50, y: 0.58, r: 0.115},
    cannon:  {x: 0.50, y: 0.50, r: 0.110},
    pulse:   {x: 0.50, y: 0.34, r: 0.140},
    inlay:   {x: 0.50, y: 0.34, r: 0.140}
  };
  function drawSocketGem(ctx, b, cs, cx, cy, frame, key, t) {
    if (!b.gem || !has('tower', key)) return;
    // 镶嵌塔：塔身是空底座（tools/export_assets.py 把原画烘死的红宝石摘掉了），
    // 宝石层 xiangqianta_gem 是同一颗原画宝石按 6 种宝石色改了色，帧号 = 档位 * 6 + 宝石色序
    if (b.type === 'inlay' && has('tower', 'xiangqianta_gem')) {
      SVAArt.draw(ctx, 'tower', 'xiangqianta_gem', {frame: frame * 6 + (b.gem.c | 0), x: cx, y: cy, scale: cs / 65, anchor: 'origin'});
      return;
    }
    var fr = SVAArt.frameOf('tower', key, frame);
    if (!fr) return;
    var S = GEM_SOCKET[b.type] || GEM_SOCKET.sentry;
    var sx = cs / 65;
    var w = fr.vb[2] * sx, h = fr.vb[3] * sx;
    var gx = cx + (fr.vb[0] + S.x * fr.vb[2]) * sx;
    var gy = cy + (fr.vb[1] + S.y * fr.vb[3]) * sx;
    A.gem(ctx, gx, gy, S.r * w, b.gem.c, b.gem.t, t);
  }

  /* 等级牌：原作是在塔顶上方挂一个白色气泡（building.levelBubble）写等级数字。
     气泡的顶点朝下指着塔，位置按当前档位的外框高度算。 */
  function levelBadge(ctx, b, cs, cx, cy, frame) {
    var lv = Math.round(b.lv || 0);
    if (!lv) return;
    var m = SVAArt.measure('tower', TOWER_KEY[b.type], frame);
    if (!m) return;
    var fr0 = SVAArt.frameOf('tower', TOWER_KEY[b.type], frame);
    var top = cy + (fr0 ? fr0.vb[1] : -m.h) * (cs / 65) - cs * 0.03;   // 塔顶
    var txt = '' + lv;
    // 牌子的尺寸固定跟格子走（不跟塔的宽度走），否则升档变大的塔会挂出一个巨大的气泡
    var w = cs * (txt.length >= 3 ? 0.58 : 0.47);
    var pillCy;
    if (has('building', 'levelBubble')) {
      SVAArt.draw(ctx, 'building', 'levelBubble', {x: cx, y: top, w: w, anchor: 'bottom'});
      pillCy = top - w * (22.85 / 49.65);      // 气泡本体（三角尖之上）的中心
    } else {
      var h = w * 0.5;
      pillCy = top - h * 0.62;
      A.rr(ctx, cx - w / 2, pillCy - h / 2, w, h, h / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
      ctx.lineWidth = Math.max(1, cs * 0.025); ctx.strokeStyle = '#6b4a2c'; ctx.stroke();
    }
    ctx.font = 'bold ' + Math.round(cs * 0.21) + 'px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(1, cs * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText(txt, cx, pillCy + cs * 0.005);
    ctx.fillStyle = '#2b2118';
    ctx.fillText(txt, cx, pillCy + cs * 0.005);
  }

  /* 羊：按情绪映射到原作的 7 种表情，走动时循环帧 */
  var origSheep = A.drawSheep;
  A.drawSheep = function (ctx, x, y, size, t, opts) {
    opts = opts || {};
    var key = SHEEP_KEY[opts.mood] || 'sheepHigh';
    if (!cfg.sheep || !has('sheep', key)) return origSheep.apply(A, arguments);
    var e = O.libs.sheep[key];
    var fr = Math.floor((t || 0) * (opts.speed || 3) * 0.5) % e.frames.length;
    ctx.save();
    if (opts.dir < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    SVAArt.draw(ctx, 'sheep', key, {frame: fr, x: x, y: y, w: size * 1.6, anchor: 'bottom'});
    ctx.restore();
  };

  /* 狼：优先用原作模型（assets/wolf/<id>.png，由 tools/build_wolves.ps1烘出来），
     没有图集时退回手搓骨架（js/art_wolf.js），再退回原来的程序化狼。
     默认关闭——把 window.SVA_ORIGINAL_ART.wolf 设为 true 才启用。 */
  if (A.drawWolf) {
    var origWolf = A.drawWolf;
    A.drawWolf = function (ctx, w, x, y, cs, t, focus) {
      if (!cfg.wolf) return origWolf.apply(A, arguments);
      var def = w.def || {};
      var size = cs * 0.9 * (def.size || 1) * (w.elite ? 1.2 : 1) * (w.boss ? 1.1 : 1);
      var OW = window.SVAWolfOrigin;
      // 会飞的狼是吊着气球飘在半空的：影子留在地面，本体抬高（比例与手搓狼一致）
      var flying = w.fly && !(w.hp <= 0);
      var lift = flying ? cs * 0.42 + Math.sin((t || 0) * 5 + (w.uid || 0)) * cs * 0.04 : 0;
      if (flying && A.ell) A.ell(ctx, x, y + cs * 0.06, cs * 0.42, cs * 0.13, 'rgba(0,0,0,0.14)');
      if (OW) {
        var wid = OW.idOf(def);
        if (wid) {
          // 原作只有 d/l/u/r 四个朝向：优先用移动方向，取不到就按左右。
          // 帧号不在这里取模 —— 每只狼的行走帧数都不一样，让 SVAWolfOrigin 用自己的列数取模。
          var d = w.wdir != null ? w.wdir : (w.dir >= 0 ? 'r' : 'l');
          var fr = Math.floor((w.walk || 0) * 3);
          ctx.save();
          if (w.invis) ctx.globalAlpha *= 0.32;
          var drawn = OW.draw(ctx, {id: wid, dir: d, frame: fr, x: x, y: y + size * 0.06 - lift,
                                    size: size, dead: w.hp <= 0, flash: w.hitFlash > 0 ? 1 : 0});
          ctx.restore();
          if (drawn) {
            // 原作里会飞的狼吊的是气球（gameUI_wolf.swf 的 balloon）
            if (flying && has('wolfui', 'balloon')) {
              SVAArt.draw(ctx, 'wolfui', 'balloon',
                          {x: x + size * 0.10, y: y - size * 0.78 - lift, w: size * 0.5, anchor: 'bottom'});
            }
            // 原作模型只负责画身体；血条、状态特效（减速/中毒/燃烧/眩晕/护盾…）、BOSS 名牌、选中圈
            // 由程序化狼那一套共用（以前这里直接 return，用了原作模型的狼就没有血条了）
            if (w.hp > 0 && A.drawWolfOverlay) A.drawWolfOverlay(ctx, w, x, y - lift, cs, t, focus, size * 0.55, -size * 0.95);
            return;
          }
        }
      }
      if (!window.SVAWolf) return origWolf.apply(A, arguments);
      var dir = ({0: 'w', 1: 'se', 2: 'n', 3: 'sw'})[w.dir] || 'se';
      var state = w.dead || w.hp <= 0 ? 'die' : (w.attack ? 'attack' : (w.walk ? 'walk' : 'idle'));
      var pal = def.__pal || SVAWolf.palFor(def.n);
      var fsz = cs * (def.boss ? 1.15 : 1.0);
      SVAWolf.draw(ctx, {x: x, y: y - lift, size: fsz, dir: dir,
                         phase: (w.walk || 0), state: state, pal: pal});
      // 图集还没加载完时走的兜底分支：血条、状态特效、选中标记照样要有
      if (w.hp > 0 && A.drawWolfOverlay) A.drawWolfOverlay(ctx, w, x, y - lift, cs, t, focus, fsz * 0.55, -fsz * 0.95);
      else if (focus) { ctx.beginPath(); ctx.arc(x, y - cs * 0.4, cs * 0.55, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(255,225,74,0.9)'; ctx.lineWidth = 2; ctx.stroke(); }
    };
  }

  /* 狼的死亡动画：用图集 _dead 行（原作每只狼的倒地帧，烘图时每 3 帧取 1）。
     f 是引擎 killWolf 推的 die 特效（带狼的外观快照）；画不出来（图集没加载完 / 没有死亡图）返回 false，
     渲染器就退回程序化的小星星。飞行狼从空中落到地上；最后 25% 淡出。 */
  A.drawWolfDeath = function (ctx, f, px, py, cs) {
    var OW = window.SVAWolfOrigin;
    if (!cfg.wolf || !OW || !f.def) return false;
    var wid = OW.idOf(f.def);
    if (!wid) return false;
    var cols = OW.deadColsOf(wid);
    if (!cols) return false;
    var k = Math.min(1, f.t / f.ttl);
    var size = cs * 0.9 * (f.def.size || 1) * (f.elite ? 1.2 : 1) * (f.boss ? 1.1 : 1);
    var lift = f.fly ? cs * 0.42 * Math.max(0, 1 - k * 2.2) : 0;
    var d = f.wdir != null ? f.wdir : (f.dir >= 0 ? 'r' : 'l');
    ctx.save();
    ctx.globalAlpha *= (f.invis ? 0.32 : 1) * (k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1);
    var ok = OW.draw(ctx, {id: wid, dir: d, frame: Math.floor(k * cols), hold: true, dead: true,
                           x: px, y: py + size * 0.06 - lift, size: size});
    ctx.restore();
    return !!ok;
  };

  window.SVAOriginalPack = {tower: true, sheep: true, wolf: !!cfg.wolf, cfg: cfg};
})();
