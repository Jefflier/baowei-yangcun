/* 原作弹道 + 战斗特效（数据：assets/art/bullet.js、effect.js，来自 gameUI_bullet.swf / gameUI_effect.swf）。
 *
 * 引擎（combat.js）只发「语义」事件：{type:'hit', tower, cname}、{type:'ring', kind:'shield'} 之类；
 * 这里决定每一种事件用原作的哪个符号、怎么摆。没有素材（或 SVA_ORIGINAL_ART.fx=false）时函数返回 false，
 * render.js 就退回原来的程序化画法，所以关掉这个文件游戏照样能玩。
 *
 * 对应关系里「确定」与「推断」要分开看（原作的塔↔子弹配置在服务端，客户端里没有）：
 *   确定：波动塔 = bullet210（社区模拟器里写明）；六色宝石的颜色一眼可见；effect0T0 与 bullet0T0 成对
 *   推断：哨塔/散弹塔 = 010~015 的小球（040/050/060 与 011/012/013 是同一张图的副本）；炮塔 = 020~026 火箭；
 *         镶嵌塔的弹道不用 110/120/130/140（带尾翼的小胶囊，看着像炮弹）——实机反馈镶嵌塔打的是「宝石色的大光点」，
 *         所以改成程序化的发光球（Art.orb）。见 docs/ART_PIPELINE.md §14.2
 *
 * 坐标：渲染器在「格子压扁」的世界坐标里（y 被压成 ay 倍）。精灵要站直，所以每个精灵都套 r.upright()，
 * 位置仍按压扁前的 (ox + x·cs, oy + y·cs) 算，比例固定 cs/65（与塔、狼、墙一致）。
 */
(function () {
  var A = window.SV && SV.Art;
  var O = window.SVAArt;
  if (!A || !O) return;
  var cfg = window.SVA_ORIGINAL_ART = window.SVA_ORIGINAL_ART || {};
  if (cfg.fx === undefined) cfg.fx = true;

  function has(lib, name) { return !!(O.libs[lib] && O.libs[lib][name]); }
  function on() { return cfg.fx !== false; }
  function nFrames(lib, name) { var e = O.libs[lib] && O.libs[lib][name]; return e ? e.frames.length : 0; }

  /* 画一帧：(X,Y) 是素材原点的屏幕位置（压扁前坐标），rot 弧度，flip 水平镜像 */
  function put(ctx, lib, name, frame, X, Y, scale, rot, flip, alpha) {
    if (!has(lib, name)) return false;
    ctx.save();
    ctx.translate(X, Y);
    if (rot) ctx.rotate(rot);
    O.draw(ctx, lib, name, {frame: frame, x: 0, y: 0, scale: scale, anchor: 'origin', flip: !!flip, alpha: alpha});
    ctx.restore();
    return true;
  }
  // 按生命进度 k∈[0,1] 取帧（播一遍）/ 按时间循环取帧
  /* 宝石色的大光点：宝石色的大光晕 + 近白的发光核心 + 三个越来越淡的拖尾残影（不画实心球，也不用加色混合）。
     (X,Y) 压扁前的屏幕坐标，ang = 屏幕方向角（拖尾在身后），hex = 宝石色；黑宝石本色是暗的，光点用紫色 */
  function orb(ctx, X, Y, cs, hex, ang, t, phase) {
    var c = hex === '#3a3a3a' || !hex ? [150, 110, 255] : [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    var pulse = 1 + 0.08 * Math.sin(t * 20 + (phase || 0));
    var R = cs * 0.17 * pulse, H = cs * 0.62 * pulse;
    // 宝石色；mix 向白色靠拢的比例。不用加色混合：浅色地面上加色会直接爆成白的，看不出是什么颜色
    var rgb = function (a, mix) {
      mix = mix || 0;
      return 'rgba(' + Math.round(c[0] + (255 - c[0]) * mix) + ',' + Math.round(c[1] + (255 - c[1]) * mix) + ',' + Math.round(c[2] + (255 - c[2]) * mix) + ',' + a + ')';
    };
    ctx.save();
    for (var i = 3; i >= 1; i--) {                                   // 拖尾残影：越靠后越小越淡
      var tx = X - Math.cos(ang) * cs * 0.17 * i, ty = Y - Math.sin(ang) * cs * 0.17 * i, tr = R * (1 - 0.17 * i) * 1.8;
      var g0 = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
      g0.addColorStop(0, rgb(0.55 - 0.14 * i, 0.1)); g0.addColorStop(1, rgb(0));
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
    }
    var g = ctx.createRadialGradient(X, Y, 0, X, Y, H);                // 大光晕：宝石色，向外渐隐
    g.addColorStop(0, rgb(0.85)); g.addColorStop(0.35, rgb(0.5)); g.addColorStop(0.7, rgb(0.16)); g.addColorStop(1, rgb(0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, H, 0, Math.PI * 2); ctx.fill();
    var b = ctx.createRadialGradient(X, Y, 0, X, Y, R * 1.2);          // 发光核心：中心近白，外圈饱和的宝石色，边缘柔和
    b.addColorStop(0, 'rgba(255,255,255,1)'); b.addColorStop(0.3, rgb(1, 0.6)); b.addColorStop(0.7, rgb(1)); b.addColorStop(1, rgb(0));
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(X, Y, R * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  A.orb = orb;

  function byLife(lib, name, k) { var n = nFrames(lib, name); return Math.min(n - 1, Math.max(0, Math.floor(k * n))); }
  function byLoop(lib, name, t, fps) { var n = nFrames(lib, name); return n ? Math.floor(t * fps) % n : 0; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------------- 弹道：塔 × 宝石 → 符号 ---------------- */
  var BALL = {none: 'bullet010', hong: 'bullet011', lan: 'bullet012', lv: 'bullet013', huang: 'bullet015', hei: 'bullet010'};
  var ROCKET = {none: 'bullet020', hong: 'bullet021', lan: 'bullet022', lv: 'bullet023', zi: 'bullet024', huang: 'bullet025', hei: 'bullet026'};
  // 镶嵌塔：黄=闪光、紫=连锁闪电、无宝石=不开火，只有红 / 绿 / 蓝 / 黑打出弹道，画成宝石色的大光点（orb）；
  // 原来的 110/120/130/140（小胶囊 + 乌鸦）不再用，导出的符号留在 bullet.js 里备查
  // 波动塔：body = 底图；over = 叠在弹头上的彩色弧（211/212 本身很淡，只能当叠加层）
  var PULSE = {none: {body: 'bullet210'}, hei: {body: 'bullet210'},
               hong: {body: 'bullet210', over: 'bullet211'}, lan: {body: 'bullet210', over: 'bullet212'},
               lv: {body: 'bullet213'}, zi: {body: 'bullet214'}, huang: {body: 'bullet215'}};
  // 这些弹道的 8 帧是「拖尾越拉越长」，按飞行进度播；其余按时间循环
  var BY_LIFE = {bullet210: 1, bullet213: 1};
  var SCALE = {bullet210: 0.95, bullet211: 1.1, bullet212: 1.1, bullet213: 0.9, bullet214: 0.9, bullet215: 1.0, bullet140: 1.0};

  function boltName(p) {
    var cn = p.st.cname || 'none', ty = p.b.type;
    if (ty === 'cannon') return ROCKET[cn] || ROCKET.none;
    return BALL[cn] || BALL.none;                 // 哨塔 / 散弹塔（紫宝石是瞬发闪电，不会走到这里）
  }

  /* 屏幕方向角：世界方向 (dx,dy)（格子单位）经过 y 压扁后的角度 */
  function screenAng(dx, dy, ay) { return Math.atan2(dy * ay, dx); }
  /* 朝右画的素材飞向左边时，翻面而不是倒过来 */
  function orient(ang) { return Math.cos(ang) < 0 ? {rot: ang - Math.PI, flip: true} : {rot: ang, flip: false}; }

  function drawProj(ctx, p, r, t) {
    if (!on()) return false;
    var cs = r.cs, k0 = cs / 65;
    if (p.kind === 'bolt') {
      if (p.delay > 0) return true;
      if (p.b.type === 'inlay') {                                       // 镶嵌塔：宝石色的大光点
        var oX = r.ox + p.x * cs, oY = r.oy + p.y * cs;
        var oa = screenAng(Math.cos(p.rot || 0), Math.sin(p.rot || 0), r.ay);
        r.upright(ctx, oY, function () { orb(ctx, oX, oY, cs, p.color, oa, t, (p.b.id || 0) * 1.7); });
        return true;
      }
      var nm = boltName(p);
      if (!nm || !has('bullet', nm)) return false;
      var X = r.ox + p.x * cs, Y = r.oy + p.y * cs;
      var o = orient(screenAng(Math.cos(p.rot || 0), Math.sin(p.rot || 0), r.ay));
      var fr = byLoop('bullet', nm, t + (p.b.id || 0) * 0.13, 16);
      r.upright(ctx, Y, function () {
        // 小球不必转向（转了反而怪），有方向的素材（火箭、胶囊、乌鸦）才按飞行方向摆
        var dirful = nm !== 'bullet010' && nm !== 'bullet011' && nm !== 'bullet012' && nm !== 'bullet013' && nm !== 'bullet015';
        put(ctx, 'bullet', nm, fr, X, Y, k0 * (SCALE[nm] || 1), dirful ? o.rot : 0, dirful && o.flip);
      });
      return true;
    }
    if (p.kind === 'shell') {
      var nmS = ROCKET[p.st.cname || 'none'] || ROCKET.none;
      if (!has('bullet', nmS)) return false;
      var k = p.t / p.dur;
      var gx = r.ox + (p.sx + (p.tx - p.sx) * k) * cs, gy = r.oy + (p.sy + (p.ty - p.sy) * k) * cs;
      var h = Math.sin(k * Math.PI) * p.hi * cs;
      // 沿抛物线的切线方向摆：水平速度 dX，竖直（压扁前坐标）= 地面推进 - 抬升的导数
      var dX = (p.tx - p.sx) * cs, dY = (p.ty - p.sy) * cs - p.hi * cs * Math.PI * Math.cos(k * Math.PI);
      var oS = orient(Math.atan2(dY * r.ay, dX));
      // 影子留在地面（火箭飞得越高影子越淡越小）
      ctx.beginPath(); ctx.ellipse(gx, gy, cs * 0.12 * (1 - 0.3 * Math.sin(k * Math.PI)), cs * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      r.upright(ctx, gy - h, function () { put(ctx, 'bullet', nmS, 0, gx, gy - h, k0, oS.rot, oS.flip); });
      return true;
    }
    return false;
  }

  /* ---------------- 命中 / 技能特效 ---------------- */
  /* spr：在格子坐标 (x,y) 处播一个符号。dy 是往上抬多少格（脚底→身体中部），sc 是相对 cs/65 的倍数 */
  function spr(ctx, r, name, k, x, y, sc, o) {
    o = o || {};
    if (!has('effect', name)) return false;
    var X = r.ox + x * r.cs, Y = r.oy + (y - (o.dy || 0)) * r.cs;
    var fr = o.loop ? byLoop('effect', name, o.loop, 12) : byLife('effect', name, k);
    r.upright(ctx, Y, function () { put(ctx, 'effect', name, fr, X, Y, r.cs / 65 * sc, o.rot, o.flip, o.alpha); });
    return true;
  }

  // 命中：塔种 × 宝石 → 命中符号
  function hitSprite(f) {
    var ty = f.tower, cn = f.cname;
    if (f.curse) return {n: 'effectCuss', sc: 1.0, dy: 0.35};
    if (f.crit) return {n: 'effectCrit', sc: 0.75, dy: 0.3};
    if (ty === 'pulse') return {n: 'effect040', sc: 1.0, dy: 0.25};
    if (ty === 'inlay') {
      if (cn === 'huang') return {n: 'allAttack', sc: 0.9, dy: 0.4};
      if (cn === 'hei') return {n: 'effect040', sc: 0.9, dy: 0.3};       // 原来是乌鸦羽毛（跟着已经不用的乌鸦弹）
      if (cn === 'hong') return {n: 'effect030', sc: 0.75, dy: 0.25};
      return {n: 'effect020', sc: 0.8, dy: 0.25};
    }
    return {n: 'effect010', sc: 0.95, dy: 0.3};   // 哨塔 / 散弹塔
  }

  /* fx() 返回 true = 已用原作素材画好，渲染器不必再画程序化版本 */
  function drawFx(ctx, f, r, t) {
    if (!on()) return false;
    var k = f.t / f.ttl;
    switch (f.type) {
      case 'hit': {
        var hs = hitSprite(f);
        return spr(ctx, r, hs.n, k, f.x, f.y + 0.3, hs.sc, {dy: hs.dy});
      }
      case 'beam': {                                  // 波动塔：一道水平飞出去的波
        var spec = PULSE[f.cname || 'none'] || PULSE.none;
        if (!has('bullet', spec.body)) return false;
        var run = 0.6, u = Math.min(1, k / run), fade = k < run ? 1 : 1 - (k - run) / (1 - run);
        var dx = f.x2 - f.x1, dy = f.y2 - f.y1;
        var o = orient(screenAng(dx, dy, r.ay));
        var kk = r.cs / 65;
        for (var g = 0; g < 3; g++) {                 // 头部 + 两个残影，才有「一条线扫过去」的感觉
          var uu = u - g * 0.13; if (uu < 0) continue;
          var X = r.ox + (f.x1 + dx * uu) * r.cs, Y = r.oy + (f.y1 + dy * uu) * r.cs;
          (function (X, Y, al) {
            r.upright(ctx, Y, function () {
              var fr = BY_LIFE[spec.body] ? byLife('bullet', spec.body, k) : byLoop('bullet', spec.body, t, 14);
              put(ctx, 'bullet', spec.body, fr, X, Y, kk * (SCALE[spec.body] || 1), o.rot, o.flip, al);
              if (spec.over) put(ctx, 'bullet', spec.over, 0, X + Math.cos(o.rot) * 10 * kk * (o.flip ? -1 : 1), Y, kk * (SCALE[spec.over] || 1), o.rot, o.flip, al);
            });
          })(X, Y, fade * (g === 0 ? 1 : g === 1 ? 0.5 : 0.25));
        }
        return true;
      }
      case 'flash': {                                 // 镶嵌塔·黄宝石：全场闪光。素材本身是压扁的椭圆，按射程放大
        var sc = f.r * 2 * 65 / 63 * 0.95;
        return spr(ctx, r, 'allAttackAOE', k, f.x, f.y + 0.1, sc, {dy: 0.1});
      }
      case 'boom': {
        if (f.kind === 'shell') {                     // 炮弹落地：火团垫底，闪光 + 烟盖在上面
          var s0 = f.r / 0.9;
          spr(ctx, r, 'effect030', k, f.x, f.y, 0.9 * s0, {dy: 0.05});
          return spr(ctx, r, 'effect020', k, f.x, f.y, 1.0 * s0, {dy: 0.1});
        }
        if (f.kind === 'bomb') return spr(ctx, r, 'effect204', k, f.x, f.y, f.r * 2 * 65 / 91 * 0.9, {dy: 0.35});
        if (f.kind === 'mine') return spr(ctx, r, 'effect310', k, f.x, f.y, 1.3, {dy: 0.05});
        if (f.kind === 'burst') return spr(ctx, r, 'effectSuicide', k, f.x, f.y + 0.2, 0.95, {dy: 0.2});
        if (f.kind === 'cloud') { spr(ctx, r, 'signCloud', k, f.x, f.y + 0.3, 1.1, {dy: 1.05, alpha: 1 - k * k}); return spr(ctx, r, 'effectCloud', k, f.x, f.y + 0.2, f.r * 2 * 65 / 66 * 0.8, {dy: 0.1}); }
        return false;
      }
      case 'ring': {
        switch (f.kind) {
          case 'shield': return spr(ctx, r, 'signShield', k, f.x, f.y + 0.3, 1.1, {dy: 1.0 + k * 0.3, alpha: 1 - k * k});
          case 'summon': spr(ctx, r, 'signSummon', k, f.x, f.y + 0.3, 1.1, {dy: 1.05, alpha: 1 - k * k}); return spr(ctx, r, 'effectSummon', k, f.x, f.y + 0.3, 1.3);
          case 'heal': spr(ctx, r, 'signCure', k, f.x, f.y + 0.3, 1.1, {dy: 1.05 + k * 0.3, alpha: 1 - k * k}); return spr(ctx, r, 'effectCure', k, f.x, f.y + 0.3, 3.0, {alpha: 0.9});
          case 'revive': return spr(ctx, r, 'effectRelive', k, f.x, f.y + 0.3, 1.2, {dy: 0.35});
          case 'clamp': return spr(ctx, r, 'effect220', k, f.x, f.y + 0.3, 1.0, {dy: 0.1});
          case 'bomb': return true;                   // 炸弹的冲击环：蘑菇云已经够了
        }
        return false;
      }
      case 'blink': {
        if (f.kind === 'mirror') return spr(ctx, r, 'effectMirror', k, f.x, f.y + 0.3, 1.6, {dy: 0.4});
        return spr(ctx, r, f.kind === 'out' ? 'effectBlinkOut' : 'effectBlinkIn', k, f.x, f.y + 0.3, 1.1, {dy: 0.35});
      }
      case 'tele': return spr(ctx, r, 'teleport', k, f.x, f.y + 0.3, 1.1, {dy: 0.15});
      case 'dust': return spr(ctx, r, 'effectRun', k, f.x, f.y + 0.3, 0.9);
      case 'curse': return spr(ctx, r, 'effectCussBreak', k, f.x, f.y + 0.3, 1.2, {dy: 0.4});
      case 'boss': return spr(ctx, r, 'effectBoss', k, f.x, f.y + 0.3, 0.7, {dy: 0.1});
    }
    return false;
  }

  /* 画完程序化的线条之后再叠的精灵（电弧线条没有对应素材，但每个落点有一团电光） */
  function drawFxOver(ctx, f, r, t) {
    if (!on()) return;
    if (f.type === 'arc') {
      var k = f.t / f.ttl, n = f.pts.length;
      for (var i = 1; i < n; i++) spr(ctx, r, 'effectLinks', Math.min(0.55, k * 0.6), f.pts[i][0], f.pts[i][1] + 0.25, 0.9, {dy: 0.1, alpha: 1 - k * k});
    }
  }

  /* ---------------- 狼身上的状态 ----------------
   * (0,0) 是脚底，u 是半个身位，top 是头顶（负数）。返回哪些状态已用原作素材画过（程序化版本就跳过）。 */
  function drawStatus(ctx, w, cs, t, u, top) {
    if (!on() || !has('effect', 'statusBurn')) return null;
    // 状态精灵挂在狼身上，比例跟狼自己走：原作狼的格子是 96 像素，u = 0.55 × 画出来的狼宽（art_original_pack.js）
    var own = {}, k0 = clamp(u / 52.8, 0.5, 1.7);
    var ph = t + (w.uid || 0) * 0.37;
    function loop(name, y, sc, alpha) { return put(ctx, 'effect', name, byLoop('effect', name, ph, 12), 0, y, k0 * (sc || 1), 0, false, alpha); }
    if (w.slows && w.slows.length && w.burnT <= 0) {
      own.slow = loop('statusCold', 0, 0.85, 0.95); loop('statusMCold_SLOWF', -u * 0.7, 1.4);
    }
    if (w.poisons && w.poisons.length) own.poison = loop('statusPoison', top - u * 0.15, 0.9);
    if (w.burnT > 0) own.burn = loop('statusBurn', 0, 1.0);
    if (w.stunT > 0) own.stun = loop('statusVertigo', top + u * 0.15, 1.0);
    if (w.curse) own.curse = loop('statusCuss', -u * 0.7, 1.0, 0.9);
    if (w.shield > 0) own.shield = loop('statusShield', -u * 0.7, 1.0, 0.9);
    if (w.fearT > 0) own.fear = put(ctx, 'effect', 'statusIntimidate', 0, 0, top - u * 0.3, k0);
    if (w.silT > 0) own.silence = put(ctx, 'effect', 'statusSilence', 0, w.fearT > 0 ? u * 0.55 : 0, top - u * 0.3, k0);
    return own;
  }

  /* 地形危险物（火山喷发、核电厂脉冲）。在「压扁」的世界坐标里画，所以精灵要用 ay 站直。
   * hz.flash 从 0.6 降到 0；p 是设施占位（压扁前坐标：x,y,w,h,cx）。 */
  function drawHazard(ctx, hz, p, cs, ay, t) {
    if (!on() || !(hz.flash > 0)) return false;
    var k = 1 - hz.flash / 0.6, cy = p.y + p.h * 0.5, big = hz.big ? 1.5 : 1, ok = false;
    ctx.save(); ctx.translate(0, cy); ctx.scale(1, 1 / ay); ctx.translate(0, -cy);
    if (hz.kind === 'volcano') ok = put(ctx, 'effect', 'pathBurn', byLife('effect', 'pathBurn', k), p.cx, cy, cs / 65 * 1.5 * big);
    else if (hz.kind === 'nuclear') ok = put(ctx, 'effect', 'effectHedian', byLife('effect', 'effectHedian', k), p.cx, cy, cs / 65 * 2.1);
    ctx.restore();
    return ok;
  }

  /* 被选中/焦点的狼：原作是头顶一个上下晃的橙色箭头 */
  function drawFocus(ctx, w, cs, t, u, top) {
    if (!on() || !has('effect', 'arrowhead')) return false;
    var bob = Math.sin(t * 7) * cs * 0.03;
    return put(ctx, 'effect', 'arrowhead', byLoop('effect', 'arrowhead', t, 12), 0, top - u * 0.55 + bob, clamp(u / 52.8, 0.6, 1.4) * 0.6);
  }

  A.origFx = {proj: drawProj, fx: drawFx, fxOver: drawFxOver, status: drawStatus, focus: drawFocus, hazard: drawHazard,
              BALL: BALL, ROCKET: ROCKET, PULSE: PULSE, ready: function () { return on() && has('bullet', 'bullet010'); }};
})();
