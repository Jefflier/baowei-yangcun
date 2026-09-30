/* ============================================================
 * 战斗引擎 B：塔属性 / 宝石效果 / 弹道 / 伤害 / 狼的状态与技能
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D;
  const P = SV.Battle.prototype;
  const CID = ['hong', 'lv', 'huang', 'zi', 'lan', 'hei'];
  SV.CID = CID;

  /* ---------- 塔属性 ---------- */
  P.towerStats = function (b) {
    const sig = b.lv + '|' + (b.gem ? b.gem.c + '_' + b.gem.t : '-') + '|' + b.aura.dmg + '|' + b.aura.spd + '|' + b.aura.rng + '|' + this.speedMult;
    if (b._sig === sig) return b._st;
    const T = D.towers[b.type], g = b.gem, lv = b.lv;
    const cname = g ? CID[g.c] : null, t = g ? g.t : 0, ix = t - 1;
    const st = {
      type: b.type, cname, t, kind: 'bolt', targets: 1, shots: 1, idle: false, air: true, ground: true, seeInvis: false,
      range: SV.TOWER_RANGE[b.type] * b.aura.rng, minRange: 0, splash: 0.9, splashRate: 0.5, rateMul: 1
    };
    let dmg;
    if (b.type === 'inlay') {
      if (!g) { st.idle = true; dmg = 0; }
      else {
        const gc = SV.GEM_COLORS[g.c];
        dmg = (gc.a + gc.b * lv + gc.c * lv * lv) * gc.rate[ix];
      }
    } else dmg = T.atk[lv - 1];
    dmg *= b.aura.dmg * this.dmgMul;
    st.dmg = dmg;
    const sc = b.type === 'sentry';
    if (b.type === 'cannon') { st.kind = 'shell'; st.air = false; }
    if (b.type === 'pulse') { st.kind = 'beam'; st.seeInvis = true; st.beamLen = 5; st.pierce = 10; }
    if (g) {
      switch (b.type) {
        case 'sentry': case 'scatter':
          if (b.type === 'scatter') st.targets = 3;
          switch (cname) {
            case 'hong': st.burn = { dps: (sc ? 10 : 7) * t, dur: 3 }; break;
            case 'lv': st.poison = { dps: dmg * 0.15 * t, dur: 4 }; break;
            case 'huang': st.crit = { p: 0.10 + 0.02 * t, m: 1.5 + 0.3 * t }; break;
            case 'zi': st.range *= 1 + (sc ? 0.10 : 0.08) * t; st.lightning = true; break;
            case 'lan': st.slow = { v: (sc ? [9, 13, 16, 19, 22] : [8, 11, 14, 16, 18])[ix] / 100, dur: 2 }; break;
            case 'hei':
              if (sc) st.combo = { p: 0.075, n: t + 1 };
              else { st.targets = 1; st.shots = t + 2; st.rateMul = 1 - (0.35 + 0.05 * t); }
              break;
          }
          break;
        case 'cannon':
          switch (cname) {
            case 'hong': st.fear = { p: 0.02 * t }; break;
            case 'lv': st.poison = { dps: dmg * 0.1 * t, dur: 2 }; break;
            case 'huang': st.stun = { p: 0.04 * t, dur: 2 }; break;
            case 'zi': st.knock = { p: 0.02 * t }; break;
            case 'lan': st.slow = { v: [12, 16, 20, 23, 26][ix] / 100, dur: 2 }; break;
            case 'hei': st.range *= 1 + 0.15 * t; st.minRange = 1.5; st.splashRate = 0.5 + 0.1 * t; break;
          }
          break;
        case 'pulse':
          switch (cname) {
            case 'hong': st.fear = { p: 0.02 * t }; break;
            case 'lv': st.poison = { dps: dmg * 0.15 * t, dur: 4 }; break;
            case 'huang': st.stun = { p: 0.02 * t, dur: 2 }; break;
            case 'zi': st.knock = { p: 0.01 * t }; break;
            case 'lan': st.slow = { v: [22, 31, 39, 44, 50][ix] / 100 * (0.3 + 0.7 * lv / 100), dur: 2 }; break;
            case 'hei': st.combo = { p: 0.075, n: t + 1 }; break;
          }
          break;
        case 'inlay':
          switch (cname) {
            case 'hong': st.burn = { dps: t * (20 + 2 * lv), dur: 3 }; break;
            case 'lv': st.poison = { dps: dmg * (1 + 0.2 * (t - 1)), dur: 12 }; break;
            case 'huang': st.kind = 'flash'; st.seeInvis = true; st.targets = 99; st.lightType = true; break;
            case 'zi': st.kind = 'chain'; st.lightning = true; st.chain = { n: t, decay: 0.6 - 0.05 * (t - 1) }; break;
            case 'lan': st.slow = { v: D.slowXq[Math.min(59, lv - 1)][ix] / 100, dur: 2.5 }; break;
            case 'hei': st.curse = { energy: 0.625 * lv * t }; break;
          }
          break;
      }
    }
    st.interval = 1 / ((T.rate / 10) * this.speedMult * b.aura.spd * st.rateMul);
    b._sig = sig; b._st = st;
    return st;
  };

  /* ---------- 目标选择 ---------- */
  P.wolfPathDist = function (w) {
    if (w.fly) return Math.hypot(w.gx - w.x, w.gy - w.y) * 1.02;
    const c = (w.y | 0) * this.cols + (w.x | 0);
    const d = this.field.dist[c];
    return isFinite(d) ? d : 999;
  };

  P.canTarget = function (b, st, w) {
    if (!w.alive) return false;
    if (w.fly && !st.air) return false;
    if (!w.fly && !st.ground) return false;
    if (w.invis && !st.seeInvis) return false;
    if (st.lightning && (w.def.res.light || 0) >= 1) return false;
    return true;
  };

  P.findTargets = function (b, st) {
    const cx = b.x + 0.5, cy = b.y + 0.5, R = st.range, R2 = R * R, m2 = st.minRange * st.minRange;
    const cands = [];
    for (const w of this.wolves) {
      if (!this.canTarget(b, st, w)) continue;
      const dx = w.x - cx, dy = w.y - cy, d2 = dx * dx + dy * dy;
      if (d2 > R2 || d2 < m2) continue;
      cands.push(w);
    }
    if (!cands.length) return cands;
    const focus = this.focusId;
    const mode = b.mode;
    for (const w of cands) {
      w._pd = this.wolfPathDist(w);
      w._d2 = (w.x - cx) * (w.x - cx) + (w.y - cy) * (w.y - cy);
    }
    cands.sort((a, c) => {
      if (focus) { if (a.uid === focus) return -1; if (c.uid === focus) return 1; }
      if (a.taunt !== c.taunt) return a.taunt ? -1 : 1;
      switch (mode) {
        case 'near': return a._d2 - c._d2;
        case 'strong': return c.hp - a.hp;
        case 'weak': return a.hp - c.hp;
        case 'air': if (a.fly !== c.fly) return a.fly ? -1 : 1; return a._pd - c._pd;
        default: return a._pd - c._pd;
      }
    });
    return cands;
  };

  /* ---------- 塔开火 ---------- */
  P.updateTower = function (b, dt) {
    if (b.flash > 0) b.flash -= dt;
    if (b.kind !== 'tower') return;
    if (b.disT > 0) { b.disT -= dt; return; }
    if (b.spdT > 0) { b.spdT -= dt; if (b.spdT <= 0) b.spdMulT = 1; }
    const st = this.towerStats(b);
    if (st.idle) return;
    const f = b.spdMulT;
    b.cd -= dt * f;
    if (b.cd > 0) return;
    const targets = this.findTargets(b, st);
    if (!targets.length) { b.cd = 0; return; }
    b.cd = st.interval;
    this.fireTower(b, st, targets);
  };

  P.critRoll = function (st, w) {
    if (!st.crit) return 1;
    if (this.rng.next() < st.crit.p) return st.crit.m;
    return 1;
  };

  P.fireTower = function (b, st, targets) {
    const cx = b.x + 0.5, cy = b.y + 0.4;
    b.aim = Math.atan2(targets[0].y - cy, targets[0].x - cx);
    b.recoil = 0.12;
    this.emit('shoot', { b, st });
    switch (st.kind) {
      case 'bolt': {
        const n = st.targets;
        for (let k = 0; k < Math.min(n, targets.length); k++) {
          const w = targets[k];
          if (st.shots > 1) { for (let s = 0; s < st.shots; s++) this.launchBolt(b, st, w, s * 0.03); }
          else this.launchBolt(b, st, w, 0);
        }
        break;
      }
      case 'shell': {
        const w = targets[0];
        const d = Math.hypot(w.x - cx, w.y - cy);
        const tt = Math.max(0.25, d / 6.5);
        const v = this.wolfVel(w);
        const lx = SV.clamp(w.x + v.x * tt, 0, this.cols), ly = SV.clamp(w.y + v.y * tt, 0, this.rows);
        this.projs.push({ kind: 'shell', b, st, sx: cx, sy: cy, tx: lx, ty: ly, t: 0, dur: tt, hi: 0.5 + d * 0.12, target: w });
        break;
      }
      case 'beam': {
        const w = targets[0];
        this.fireBeam(b, st, w);
        break;
      }
      case 'flash': {
        this.fx.push({ type: 'flash', x: cx, y: cy, r: st.range, t: 0, ttl: 0.35, color: '#ffe36b' });
        for (const w of targets) { this.hitWolf(b, st, w, st.dmg, { light: true }); this.fxHit(b, st, w); }
        break;
      }
      case 'chain': {
        this.fireChain(b, st, targets[0]);
        break;
      }
    }
  };

  /* 命中的画面事件：tower/cname 决定用哪个原作特效（js/art_fx_original.js），没有素材时渲染器画个小火花。
     只影响画面，不碰随机数；场上特效太多时不再追加，免得高倍速下堆积。 */
  P.fxHit = function (b, st, w, o) {
    if (this.fx.length > 180) return;
    o = o || {};
    this.fx.push({ type: 'hit', x: w.x, y: w.y, t: 0, ttl: o.ttl || 0.34, tower: b ? b.type : '', cname: st ? st.cname : null, crit: !!o.crit, curse: !!o.curse });
  };

  P.wolfVel = function (w) {
    if (w.fly) { const d = Math.hypot(w.gx - w.x, w.gy - w.y) || 1; const s = this.wolfSpeed(w); return { x: (w.gx - w.x) / d * s, y: (w.gy - w.y) / d * s }; }
    if (w.tx < 0) return { x: 0, y: 0 };
    const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy) || 1, s = this.wolfSpeed(w);
    return { x: dx / d * s, y: dy / d * s };
  };

  P.launchBolt = function (b, st, w, delay) {
    const cx = b.x + 0.5, cy = b.y + 0.35;
    if (st.lightning) {           // 闪电：瞬时命中
      let dmg = st.dmg;
      const mult = this.critRoll(st, w);
      this.fx.push({ type: 'arc', pts: [[cx, cy - 0.2], [w.x, w.y - 0.2]], t: 0, ttl: 0.16, color: '#c9a7ff' });
      this.hitWolf(b, st, w, dmg * (b.type === 'scatter' && w.fly ? 2 : 1), { light: true, crit: mult });
      return;
    }
    this.projs.push({
      kind: 'bolt', b, st, x: cx, y: cy, w, delay: delay || 0,
      spd: b.type === 'scatter' ? 13 : 16, color: st.cname ? SV.GEM_COLORS[CID.indexOf(st.cname)].hex : '#ffe9a8', dmgMul: (b.type === 'scatter' && w.fly) ? 2 : 1
    });
  };

  P.fireBeam = function (b, st, w) {
    const cx = b.x + 0.5, cy = b.y + 0.5;
    let dx = w.x - cx, dy = w.y - cy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const L = st.beamLen, ex = cx + dx * L, ey = cy + dy * L;
    this.fx.push({ type: 'beam', cname: st.cname, x1: cx, y1: cy, x2: ex, y2: ey, t: 0, ttl: 0.28, color: st.cname ? SV.GEM_COLORS[CID.indexOf(st.cname)].hex : '#7fe3ff' });
    const hit = [];
    for (const u of this.wolves) {
      if (!u.alive || (u.invis && !st.seeInvis)) continue;
      const px = u.x - cx, py = u.y - cy;
      const proj = px * dx + py * dy;
      if (proj < 0 || proj > L) continue;
      const perp = Math.abs(px * dy - py * dx);
      if (perp <= 0.55) hit.push([proj, u]);
    }
    hit.sort((a, c) => a[0] - c[0]);
    for (let k = 0; k < Math.min(st.pierce, hit.length); k++) { this.hitWolf(b, st, hit[k][1], st.dmg, {}); this.fxHit(b, st, hit[k][1], { ttl: 0.3 }); }
  };

  P.fireChain = function (b, st, w) {
    const cx = b.x + 0.5, cy = b.y + 0.4;
    let cur = w, dmg = st.dmg; const used = new Set([w.uid]);
    const pts = [[cx, cy - 0.2], [w.x, w.y - 0.2]];
    this.hitWolf(b, st, w, dmg, { light: true });
    for (let j = 0; j < st.chain.n; j++) {
      dmg *= (1 - st.chain.decay);
      let best = null, bd = 3.0;
      for (const u of this.wolves) {
        if (!u.alive || used.has(u.uid) || (u.invis && !st.seeInvis)) continue;
        if ((u.def.res.light || 0) >= 1) continue;
        const d = Math.hypot(u.x - cur.x, u.y - cur.y);
        if (d < bd) { bd = d; best = u; }
      }
      if (!best) break;
      used.add(best.uid); pts.push([best.x, best.y - 0.2]);
      this.hitWolf(b, st, best, dmg, { light: true });
      cur = best;
    }
    this.fx.push({ type: 'arc', pts, t: 0, ttl: 0.22, color: '#d6b8ff', thick: true });
  };

  /* ---------- 弹道更新 ---------- */
  P.updateProjs = function (dt) {
    const arr = this.projs;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      if (p.kind === 'bolt') {
        if (p.delay > 0) { p.delay -= dt; continue; }
        const w = p.w;
        if (!w.alive) { arr.splice(i, 1); continue; }
        const dx = w.x - p.x, dy = (w.y - 0.15) - p.y, d = Math.hypot(dx, dy), step = p.spd * dt;
        if (d <= step + 0.12) {
          arr.splice(i, 1);
          const mult = this.critRoll(p.st, w);
          this.hitWolf(p.b, p.st, w, p.st.dmg * p.dmgMul, { crit: mult });
          this.fxHit(p.b, p.st, w, { crit: mult > 1 });
          if (p.b.type === 'sentry' && p.st.combo && this.rng.next() < p.st.combo.p) {
            for (let k = 1; k < p.st.combo.n; k++) if (w.alive) this.hitWolf(p.b, p.st, w, p.st.dmg, { combo: true });
          }
        } else { p.x += dx / d * step; p.y += dy / d * step; p.rot = Math.atan2(dy, dx); }
      } else if (p.kind === 'shell') {
        p.t += dt;
        if (p.t >= p.dur) { arr.splice(i, 1); this.landShell(p); }
      }
    }
  };

  P.landShell = function (p) {
    const { b, st } = p; const x = p.tx, y = p.ty;
    this.fx.push({ type: 'boom', kind: 'shell', x, y, r: st.splash, t: 0, ttl: 0.45, color: st.cname ? SV.GEM_COLORS[CID.indexOf(st.cname)].hex : '#ffb84d' });
    // 直接命中：最近的狼（地面）
    let main = null, bd = 0.7;
    for (const u of this.wolves) {
      if (!u.alive || u.fly) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < bd) { bd = d; main = u; }
    }
    for (const u of this.wolves) {
      if (!u.alive || u.fly) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (u === main) { this.hitWolf(b, st, u, st.dmg, { crit: 1 }); }
      else if (d <= st.splash) this.hitWolf(b, st, u, st.dmg * st.splashRate, { splash: true });
    }
    if (b.type === 'cannon' && p.st.comboBoom) { /* reserved */ }
  };

  /* ---------- 命中 & 伤害 ---------- */
  P.hitWolf = function (b, st, w, dmg, o) {
    if (!w.alive) return;
    o = o || {};
    // 元素/光抗性
    const res = w.def.res;
    let amt = dmg;
    if (o.light || st.lightning) { const r = res.light || 0; if (r >= 1) return; amt *= (1 - r); }
    if (o.crit && o.crit > 1) { const cr = res.crit || 0; amt *= 1 + (o.crit - 1) * (1 - cr); }
    const shown = this.damage(w, amt, { tower: b, crit: o.crit > 1, splash: o.splash });
    // 附带效果
    const rng = this.rng;
    if (!w.alive) { return; }
    if (st.poison) this.addPoison(w, st.poison.dps, st.poison.dur);
    if (st.burn) this.addBurn(w, st.burn.dps, st.burn.dur);
    if (st.slow) this.addSlow(w, st.slow.v, st.slow.dur);
    if (st.stun && rng.next() < st.stun.p * (1 - (res.vertigo || 0))) this.stun(w, st.stun.dur);
    if (st.fear && rng.next() < st.fear.p) { w.fearT = 0.7; w.silT = Math.max(w.silT, 0.7); }
    if (st.knock && rng.next() < st.knock.p * (1 - (res.beat || 0))) this.pushBack(w, 0.9);
    if (st.curse) {
      if (!w.curse) { w.curse = { t: 5, energy: st.curse.energy, hits: 0 }; this.fxHit(b, st, w, { curse: true, ttl: 0.4 }); }
      else { w.curse.energy = Math.max(w.curse.energy, st.curse.energy); w.curse.t = 5; }
    }
    if (b && b.kind === 'tower' && o.combo) { /* visual only */ }
  };

  P.addPoison = function (w, dps, dur) {
    const res = w.def.res.poison || 0;
    dps *= (1 - res);
    if (dps <= 0) return;
    // 同强度刷新，否则新增
    for (const p of w.poisons) if (Math.abs(p.dps - dps) < 1e-6) { p.t = Math.max(p.t, dur); return; }
    w.poisons.push({ dps, t: dur });
    if (w.poisons.length > 5) { w.poisons.sort((a, c) => c.dps - a.dps); w.poisons.length = 5; }
  };
  P.addBurn = function (w, dps, dur) {
    const r = w.def.res.fire || 0; dps *= (1 - r);
    if (dps <= 0) return;
    w.burnDps = Math.max(w.burnDps, dps); w.burnT = dur;
    w.slows.length = 0;                                 // 冰火互相抵消
  };
  P.addSlow = function (w, v, dur) {
    if (w.burnT > 0) return;                            // 燃烧中免疫减速（互相抵消）
    const r = w.def.res.frost || 0; v *= (1 - r);
    if (v === 0) return;
    for (const s of w.slows) if (Math.abs(s.v - v) < 1e-6) { s.t = Math.max(s.t, dur); return; }
    w.slows.push({ v, t: dur });
    if (w.slows.length > 6) { w.slows.sort((a, c) => c.v - a.v); w.slows.length = 6; }
  };
  P.slowValue = function (w) {
    if (!w.slows.length) return 0;
    let m = -Infinity, m2 = 0;
    for (const s of w.slows) { if (s.v > m) { m2 = Math.max(m2, 0); m = s.v; } else if (s.v > m2) m2 = s.v; }
    if (m <= 0) return m;
    return Math.min(0.88, m + m2 * 0.3);
  };
  P.stun = function (w, dur) { w.stunT = Math.max(w.stunT, dur); this.cancelCasts(w); };
  P.cancelCasts = function (w) { w.casting = 0; };
  P.pushBack = function (w, d) {
    if (w.fly) { w.x -= (w.gx - w.x) / (Math.hypot(w.gx - w.x, w.gy - w.y) || 1) * d * 0.5; return; }
    const dx = w.lastx - w.x, dy = w.lasty - w.y, dd = Math.hypot(dx, dy);
    if (dd < 1e-3) return;
    const m = Math.min(d, dd);
    w.x += dx / dd * m; w.y += dy / dd * m; w.tx = -1;
  };

  /* 基础伤害入口 */
  P.damage = function (w, amt, o) {
    if (!w.alive || amt <= 0) return 0;
    o = o || {};
    if (w.dr && !o.dot) amt *= (1 - w.dr);
    if (!o.dot && w.shield > 0) {
      const ab = Math.min(w.shield, amt); w.shield -= ab; amt -= ab;
      if (amt <= 0) return 0;
    }
    w.hp -= amt;
    w.hitFlash = 0.08;
    if (o.tower) { o.tower.dmgDealt = (o.tower.dmgDealt || 0) + amt; }
    this.stats.dmg += amt;
    if (w.curse && !o.curseTick) w.curse.hits++;
    if (this.showDamage && !o.dot && this.floats.length < 40) {
      this.floats.push({ x: w.x + (this.rng.next() - 0.5) * 0.3, y: w.y - 0.5, text: SV.fmt(amt), t: 0, ttl: 0.7, crit: o.crit });
    }
    if (w.hp <= 0) this.killWolf(w, o.tower);
    return amt;
  };

  /* ---------- 狼：生成 ---------- */
  P.spawnWolf = function (id, o) {
    o = o || {};
    const def = o.def || SV.wolfDef(id); if (!def) return null;
    const wv = o.wave;
    const spawns = this.map.spawns;
    const sidx = spawns[(o.spawn || 0) % spawns.length];
    const level = o.level != null ? o.level : (wv ? wv.level : 10);
    let diff = wv ? wv.diff : 1;
    if (o.diffMul && o.random) diff = o.diffMul;
    else if (o.diffMul) diff *= o.diffMul;
    let hp;
    if (o.hp != null) hp = o.hp;
    else if (def.fixed) hp = Math.floor(def.a * diff);
    else hp = SV.wolfHP(id, level, diff);
    if (o.hp == null) hp = Math.max(1, Math.floor(hp * this.hpScale));
    if (o.elite) hp = Math.floor(hp * 2.6);
    const sx = (sidx % this.cols) + 0.5, sy = ((sidx / this.cols) | 0) + 0.5;
    const jitter = o.x != null ? 0 : 0.2;
    const w = {
      uid: this.uid++, id, def, x: o.x != null ? o.x : sx + (this.rng.next() - 0.5) * jitter, y: o.y != null ? o.y : sy + (this.rng.next() - 0.5) * jitter,
      hp, maxhp: hp, fly: !!def.fly, alive: true, wave: wv || null, boss: !!o.boss, elite: !!o.elite, random: !!o.random,
      wt: o.wt != null ? o.wt : def.pop, lastx: sx, lasty: sy, tx: -1, ty: -1, gx: 0, gy: 0,
      slows: [], poisons: [], burnT: 0, burnDps: 0, stunT: 0, fearT: 0, silT: 0, curse: null,
      invis: false, shield: 0, shieldT: 0, sprintT: 0, revived: false, hitFlash: 0, spawnT: 0, walk: this.rng.next() * 6,
      lane: (this.rng.next() - 0.5) * 0.3, speedMul: o.speedMul || 1, team: o.team || 'wolf', size: def.size * (o.elite ? 1.25 : 1) * (o.boss ? 1.15 : 1),
      dir: 1, taunt: false, sm: 0, child: !!o.child, noReward: !!o.noReward, popv: o.popv
    };
    // 最近的羊村入口（飞狼用）
    let bg = -1, bd = Infinity;
    for (const g of this.map.goals) { const gx = (g % this.cols) + 0.5, gy = ((g / this.cols) | 0) + 0.5; const d = Math.hypot(gx - w.x, gy - w.y); if (d < bd) { bd = d; bg = g; } }
    w.gx = (bg % this.cols) + 0.5; w.gy = ((bg / this.cols) | 0) + 0.5;
    this.initSkills(w);
    this.wolves.push(w);
    if (w.boss && this.fx.length < 180) this.fx.push({ type: 'boss', x: w.x, y: w.y, t: 0, ttl: 1.2 });   // 出场警告圈（原作 effectBoss）
    if (wv) { wv.alive++; wv.spawned++; }
    if (this.wolves.length > this.stats.maxWolves) this.stats.maxWolves = this.wolves.length;
    this.emit('spawn', w);
    return w;
  };

  P.initSkills = function (w) {
    const sk = w.def.sk, r = this.rng;
    w.sk = {};
    if (sk.sprint) w.sk.sprint = { cd: r.range(1.5, 4), on: 0, lv: sk.sprint };
    if (sk.blink) w.sk.blink = { cd: r.range(2, 5) };
    if (sk.invisible) w.sk.invisible = { cd: r.range(1, 4), on: 0 };
    if (sk.shield) w.sk.shield = { cd: r.range(2, 5) };
    if (sk.summon && w.def.sm) w.sk.summon = { cd: r.range(3, 6) };
    if (sk.divide) w.sk.divide = { cd: r.range(4, 8) };
    if (sk.heal) w.sk.heal = { cd: r.range(2, 4) };
    if (sk.cloud) w.sk.cloud = { cd: r.range(2, 4) };
    w.dr = sk.armor ? Math.min(0.6, 0.12 * sk.armor) : 0;
  };

  /* ---------- 狼：速度 & 移动 ---------- */
  P.wolfSpeed = function (w) {
    if (w.stunT > 0) return 0;
    let v = w.def.speed * w.speedMul;
    const s = this.slowValue(w);
    v *= 1 - s;
    if (w.sprintT > 0) v *= 1.5 + 0.2 * Math.min(3, w.sk.sprint ? w.sk.sprint.lv : 1);
    if (!w.fly && this.map.belt.some(Boolean)) {
      const c = (w.y | 0) * this.cols + (w.x | 0), bt = this.map.belt[c];
      if (bt && w.tx >= 0) {
        const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy) || 1;
        v *= 1 + 0.3 * ((dx / d) * bt[0] + (dy / d) * bt[1]);
      }
    }
    return Math.max(0.05 * w.def.speed, v);
  };

  P.updateWolf = function (w, dt) {
    if (w.hitFlash > 0) w.hitFlash -= dt;
    w.spawnT += dt;
    // ---- DOT ----
    if (w.burnT > 0) { w.burnT -= dt; this.damage(w, w.burnDps * dt, { dot: true, curseTick: true }); if (!w.alive) return; }
    if (w.poisons.length) {
      let top = 0;
      for (const p of w.poisons) { if (p.t > 0 && p.dps > top) top = p.dps; p.t -= dt; }
      w.poisons = w.poisons.filter(p => p.t > 0);
      if (top > 0) { this.damage(w, top * dt, { dot: true, curseTick: true }); if (!w.alive) return; }
    }
    if (w.slows.length) { for (const s of w.slows) s.t -= dt; w.slows = w.slows.filter(s => s.t > 0); }
    if (w.stunT > 0) w.stunT -= dt;
    if (w.silT > 0) w.silT -= dt;
    if (w.shieldT > 0) { w.shieldT -= dt; if (w.shieldT <= 0) w.shield = 0; }
    if (w.sprintT > 0) w.sprintT -= dt;
    if (w.curse) {
      w.curse.t -= dt;
      if (w.curse.t <= 0) this.popCurse(w);
      if (!w.alive) return;
    }
    // ---- 技能 ----
    if (w.stunT <= 0) this.updateSkills(w, dt);
    if (!w.alive) return;
    // ---- 移动 ----
    if (w.stunT > 0) return;
    if (w.fearT > 0) { w.fearT -= dt; this.pushBack(w, 0.9 * w.def.speed * dt * 2.2); return; }
    this.moveWolf(w, dt);
  };

  P.popCurse = function (w) {
    const c = w.curse; w.curse = null;
    if (!c) return;
    const dmg = c.energy * c.hits;
    this.fx.push({ type: 'curse', x: w.x, y: w.y, t: 0, ttl: 0.45 });
    if (dmg > 0) this.damage(w, dmg, { dot: true, curseTick: true });
    for (const u of this.wolves) {
      if (!u.alive) continue;
      if (Math.hypot(u.x - w.x, u.y - w.y) <= 1.6) { u.silT = Math.max(u.silT, 2); this.cancelCasts(u); }
    }
  };

  P.moveWolf = function (w, dt) {
    let move = this.wolfSpeed(w) * dt;
    w.walk += move * 6;
    if (w.fly) {
      const dx = w.gx - w.x, dy = w.gy - w.y, d = Math.hypot(dx, dy);
      if (d <= move + 0.05) { w.x = w.gx; w.y = w.gy; this.leakWolf(w); return; }
        w.x += dx / d * move; w.y += dy / d * move;
        if (Math.abs(dx) > 0.05) w.dir = dx > 0 ? 1 : -1;
        // 原作狼模型有 d/l/u/r 四个朝向，这里记下当前朝向（供原版图集使用）
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) w.wdir = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'd' : 'u') : (dx > 0 ? 'r' : 'l');
      return;
    }
    let guard = 0;
    while (move > 1e-6 && guard++ < 6) {
      if (w.tx < 0) {
        const c = (w.y | 0) * this.cols + (w.x | 0);
        const n = this.field.nxt[c];
        if (n < 0) {
          // 已在羊村入口？
          if (this.map.type[c] === 3) { this.leakWolf(w); return; }
          // 被困（例如传送出口区域被封死）：超时按"进村"处理，避免卡死整场战斗
          w.stuck = (w.stuck || 0) + dt;
          if (w.stuck > 3) this.leakWolf(w);
          return;
        }
        w.stuck = 0;
        w.tx = (n % this.cols) + 0.5; w.ty = ((n / this.cols) | 0) + 0.5;
        w.lastx = (c % this.cols) + 0.5; w.lasty = ((c / this.cols) | 0) + 0.5;
        // 传送：入口→出口是瞬移
        if (this.map.type[c] === 4 && this.map.type[n] === 5) {
          this.fx.push({ type: 'tele', x: w.x, y: w.y, t: 0, ttl: 0.4 });
          const outs = (this.map.teleOut[this.map.teleId[c]] || []).filter(o => this.field.walk[o] && isFinite(this.field.dist[o]));
          let pick = n;
          if (outs.length) {           // 偏向更近的出口，几率接近对半
            let tot = 0; const ws = outs.map(o => { const wgt = 1 / (this.field.dist[o] + 4); tot += wgt; return wgt; });
            let r = this.rng.next() * tot; pick = outs[outs.length - 1];
            for (let k = 0; k < outs.length; k++) { r -= ws[k]; if (r <= 0) { pick = outs[k]; break; } }
          }
          w.x = (pick % this.cols) + 0.5; w.y = ((pick / this.cols) | 0) + 0.5; w.tx = -1;
          this.fx.push({ type: 'tele', x: w.x, y: w.y, t: 0, ttl: 0.4 });
          continue;
        }
      }
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (d <= move) {
        w.x = w.tx; w.y = w.ty; move -= d; w.tx = -1;
        const c = (w.y | 0) * this.cols + (w.x | 0);
        if (this.map.type[c] === 3) { this.leakWolf(w); return; }
        if (this.map.springs.size && this.map.feat[c] === '弹簧' && !w.child) {
          // 弹簧：把狼弹向前方 3 格
          let cc = c, n = 0;
          for (let k = 0; k < 3; k++) { const nx = this.field.nxt[cc]; if (nx < 0 || this.map.type[nx] === 3 || this.map.type[nx] === 4) break; cc = nx; n++; }
          if (n) { this.fx.push({ type: 'dust', x: w.x, y: w.y, t: 0, ttl: 0.4 }); w.x = (cc % this.cols) + 0.5; w.y = ((cc / this.cols) | 0) + 0.5; w.tx = -1; w.stunT = Math.max(w.stunT, 0.5); this.fx.push({ type: 'blink', kind: 'in', x: w.x, y: w.y, t: 0, ttl: 0.5 }); }
        }
      } else {
        w.x += dx / d * move; w.y += dy / d * move; move = 0;
        if (Math.abs(dx) > 0.02) w.dir = dx > 0 ? 1 : -1;
        // 朝向跟着移动方向走（原作狼模型有 d/l/u/r 四个朝向；只影响画面，不参与任何判定）
        if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) w.wdir = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'd' : 'u') : (dx > 0 ? 'r' : 'l');
      }
    }
  };

  /* ---------- 狼：技能 ---------- */
  P.updateSkills = function (w, dt) {
    const S = w.sk, r = this.rng;
    const silenced = w.silT > 0;
    if (S.sprint) {
      S.sprint.cd -= dt;
      if (S.sprint.cd <= 0 && !silenced) { w.sprintT = 1.6 + 0.3 * Math.min(4, S.sprint.lv); S.sprint.cd = 7 - Math.min(3, S.sprint.lv * 0.5) + r.range(0, 2); this.fx.push({ type: 'dust', x: w.x, y: w.y, t: 0, ttl: 0.4 }); }
    }
    if (S.blink) {
      S.blink.cd -= dt;
      if (S.blink.cd <= 0 && !silenced && !w.fly) {
        S.blink.cd = 5 + r.range(0, 1.5);
        let c = (w.y | 0) * this.cols + (w.x | 0), n = 0;
        const blv = w.def.sk.blink || 1;
        const steps = 2 + (r.next() < 0.5 ? 1 : 0) + (blv > 1 ? Math.floor(blv / 2) : 0);
        for (let k = 0; k < steps; k++) { const nx = this.field.nxt[c]; if (nx < 0 || this.map.type[nx] === 3 || this.map.type[nx] === 4) break; c = nx; n++; }
        if (n > 0) {
          this.fx.push({ type: 'blink', kind: 'out', x: w.x, y: w.y, t: 0, ttl: 0.5 });
          w.x = (c % this.cols) + 0.5; w.y = ((c / this.cols) | 0) + 0.5; w.tx = -1;
          this.fx.push({ type: 'blink', kind: 'in', x: w.x, y: w.y, t: 0, ttl: 0.5 });
        }
      }
    }
    if (S.invisible) {
      const s = S.invisible; s.cd -= dt;
      if (s.on > 0) { s.on -= dt; if (s.on <= 0) w.invis = false; }
      else if (s.cd <= 0 && !silenced) { s.on = 2 + 0.5 * Math.min(4, w.def.sk.invisible || 1); s.cd = 9 + r.range(0, 2); w.invis = true; }
      if (silenced && w.invis) { w.invis = false; s.on = 0; }
    }
    if (S.shield) {
      S.shield.cd -= dt;
      if (S.shield.cd <= 0 && !silenced) { const sl = Math.min(4, w.def.sk.shield || 1); w.shield = w.maxhp * (0.08 + 0.05 * sl); w.shieldT = 5; S.shield.cd = 10 - sl; this.fx.push({ type: 'ring', kind: 'shield', x: w.x, y: w.y, t: 0, ttl: 0.6, color: '#7fd3ff' }); }
    }
    if (S.summon) {
      S.summon.cd -= dt;
      if (S.summon.cd <= 0 && !silenced && w.sm < 6 && this.wolves.length < 160) {
        S.summon.cd = 9;
        const smn = 1 + Math.ceil(Math.min(4, w.def.sk.summon || 1) / 2);
        for (let k = 0; k < smn; k++) {
          const c = this.spawnWolf(w.def.sm, { wave: w.wave, x: w.x + (k - 0.5) * 0.3, y: w.y, level: w.wave ? w.wave.level : 10, noReward: true, wt: 0, child: true, speedMul: 1 });
          if (c) { c.tx = -1; c.lastx = w.lastx; c.lasty = w.lasty; c.noReward = true; }
        }
        w.sm += 2;
        this.fx.push({ type: 'ring', kind: 'summon', x: w.x, y: w.y, t: 0, ttl: 0.7, color: '#b78bff' });
      }
    }
    if (S.divide && !w.child) {
      S.divide.cd -= dt;
      if (S.divide.cd <= 0 && !silenced && this.wolves.length < 160) {
        S.divide.cd = 12;
        w.slows.length = 0; w.poisons.length = 0; w.burnT = 0;
        for (let k = 0; k < 2; k++) {
          const c = this.spawnWolf(w.id, { wave: w.wave, x: w.x, y: w.y, level: w.wave ? w.wave.level : 10, hp: Math.max(1, w.hp * 0.5), noReward: true, wt: 0, child: true });
          if (c) { c.lastx = w.lastx; c.lasty = w.lasty; c.lane = (k ? 0.25 : -0.25); c.sk = {}; }
        }
        this.fx.push({ type: 'blink', kind: 'mirror', x: w.x, y: w.y, t: 0, ttl: 0.5 });
      }
    }
    if (S.cloud) {
      S.cloud.cd -= dt;
      if (S.cloud.cd <= 0 && !silenced) {
        S.cloud.cd = 7;
        const cl = Math.min(4, w.def.sk.cloud || 1);
        this.fx.push({ type: 'boom', kind: 'cloud', x: w.x, y: w.y, r: 1.8, t: 0, ttl: 0.9, color: '#7a7a9a' });
        for (const b of this.buildings) if (b.kind === 'tower' && Math.hypot(b.x + 0.5 - w.x, b.y + 0.5 - w.y) <= 1.9) b.disT = Math.max(b.disT, 1 + 0.5 * cl);
      }
    }
    if (S.heal) {
      S.heal.cd -= dt;
      if (S.heal.cd <= 0 && !silenced) {
        S.heal.cd = 5;
        const hl = 0.04 + 0.03 * Math.min(4, w.def.sk.heal || 1);
        for (const u of this.wolves) if (u.alive && u.team === w.team && Math.hypot(u.x - w.x, u.y - w.y) <= 2.2) { u.hp = Math.min(u.maxhp, u.hp + u.maxhp * hl); }
        this.fx.push({ type: 'ring', kind: 'heal', x: w.x, y: w.y, t: 0, ttl: 0.7, color: '#7dffb0' });
      }
    }
  };

  /* ---------- 死亡 / 漏怪 ---------- */
  P.killWolf = function (w, tower) {
    if (!w.alive) return;
    if (w.def.sk.revive && !w.revived) {
      w.revived = true; w.hp = w.maxhp * Math.min(1, 0.6 + 0.1 * Math.min(4, w.def.sk.revive || 1)); w.slows.length = 0; w.poisons.length = 0; w.burnT = 0; w.stunT = 0.6;
      this.fx.push({ type: 'ring', kind: 'revive', x: w.x, y: w.y, t: 0, ttl: 0.8, color: '#7dff7d' });
      return;
    }
    w.alive = false;
    if (w.curse) { const c = w.curse; w.curse = null; if (c.hits > 0) this.fx.push({ type: 'curse', x: w.x, y: w.y, t: 0, ttl: 0.45 }); for (const u of this.wolves) if (u.alive && Math.hypot(u.x - w.x, u.y - w.y) <= 1.6) { u.silT = Math.max(u.silT, 2); } }
    const wv = w.wave;
    if (wv) { wv.alive--; wv.killed++; }
    this.stats.kills++;
    if (tower) tower.kills = (tower.kills || 0) + 1;
    // 奖励
    if (wv && !w.noReward && w.wt > 0) {
      const share = w.wt / wv.weightSum;
      let sil = wv.budget * this.silverPerPop * share * this.boost.silver;
      if (wv.lure) sil *= 0.5;
      sil = Math.max(1, Math.round(sil));
      this.silver += sil; this.stats.earned += sil;
      const ex = wv.budget * this.expPerPop * share * this.boost.exp * (wv.lure ? 0.6 : 1);
      this.expGained += ex;
      this.fx.push({ type: 'coin', x: w.x, y: w.y, t: 0, ttl: 0.8, n: sil });
    }
    // 死亡动画（原作狼模型自带倒地帧）：把狼的外观快照塞进特效里，渲染器用图集的 _dead 行播放；只影响画面
    this.fx.push({ type: 'die', x: w.x, y: w.y, t: 0, ttl: w.boss ? 1.3 : 0.95, size: w.size, fly: w.fly,
                   def: w.def, dir: w.dir, wdir: w.wdir, boss: w.boss, elite: w.elite, invis: w.invis, lane: w.lane || 0 });
    if (w.def.sk.burst) {
      this.fx.push({ type: 'boom', kind: 'burst', x: w.x, y: w.y, r: 1.3, t: 0, ttl: 0.7, color: '#ff8a3d' });
      for (const b of this.buildings) if (b.kind === 'tower' && Math.hypot(b.x + 0.5 - w.x, b.y + 0.5 - w.y) <= 1.5) b.disT = Math.max(b.disT, 2.5);
    }
    if (w.def.rb && w.def.rb.length) {
      const ids = w.def.rb;
      const base = Math.max(1, w.maxhp * 0.15);
      ids.forEach((rid, k) => {
        const c = this.spawnWolf(rid, { wave: w.wave, x: w.x + (k - ids.length / 2) * 0.12, y: w.y, level: wv ? wv.level : 10, noReward: false, wt: 0, child: true });
        if (c) { c.lastx = w.lastx; c.lasty = w.lasty; c.fly = !!c.def.fly; c.noReward = true; }
      });
    }
    if (w.boss || w.elite || w.random) {
      const kind = w.random ? 'random' : (wv && wv.kind === 'final' && w.boss ? 'final' : (w.boss ? 'boss' : 'elite'));
      this.stats.bossKills += w.boss ? 1 : 0;
      this.addLoot(this.rollLoot(kind, w), w.x, w.y);
      this.emit('bossDie', w);
    }
    this.emit('kill', w);
  };

  P.leakWolf = function (w) {
    if (!w.alive) return;
    w.alive = false;
    const wv = w.wave;
    this.stats.leaks++;
    let pv = w.popv != null ? w.popv : (w.boss ? Math.max(4, (wv ? wv.budget : 10) * 0.3) : (w.elite ? 3 : w.def.pop));
    if (w.child) pv = 0;
    if (wv) { wv.alive--; wv.leakPop += pv; if (w.boss) wv.bossLeaked = true; }
    const cost = w.boss ? 6 : (w.elite ? 2 : (w.child ? 0 : 1));
    this.lives -= cost;
    this.fx.push({ type: 'leak', x: w.x, y: w.y, t: 0, ttl: 0.6 });
    this.emit('leak', w);
    if (this.lives <= 0 && this.mode !== 'arena') { this.lives = 0; this.defeat(); }
    if (this.mode === 'arena') this.lives = this.maxLives;
  };

  /* ---------- 建筑功能：陷阱 ---------- */
  P.updateTrap = function (b, dt) {
    if (b.cd > 0) { b.cd -= dt; return; }
    for (const w of this.wolves) {
      if (!w.alive || w.fly) continue;
      if (Math.abs(w.x - (b.x + 0.5)) < 0.55 && Math.abs(w.y - (b.y + 0.5)) < 0.55) {
        if (b.tid === 'clamp') { this.stun(w, 2); b.cd = 8; this.fx.push({ type: 'ring', kind: 'clamp', x: w.x, y: w.y, t: 0, ttl: 0.5, color: '#e8e8e8' }); }
        else {
          b.cd = 6; this.fx.push({ type: 'boom', kind: 'mine', x: b.x + 0.5, y: b.y + 0.5, r: 1.0, t: 0, ttl: 0.6, color: '#ff7a2a' });
          for (const u of this.wolves) if (u.alive && !u.fly && Math.hypot(u.x - b.x - 0.5, u.y - b.y - 0.5) <= 1.0) {
            this.damage(u, Math.max(30, u.maxhp * 0.05) + this.waveLevel(this.progress) * 40, { dot: true });
            u.slows.length = 0;
          }
        }
        break;
      }
    }
  };

  /* ---------- 炸弹墙 ---------- */
  P.updateBomb = function (b, dt) {
    const bm = b.bomb; if (!bm) return;
    if (bm.arm > 0) { bm.arm -= dt; return; }
    const cx = b.x + 0.5, cy = b.y + 0.5, tr = SV.BOMB.trig;
    for (const w of this.wolves) {
      if (!w.alive || w.fly) continue;
      if (Math.hypot(w.x - cx, w.y - cy) <= tr) { this.detonate(b); return; }
    }
  };
  P.detonate = function (b) {
    if (!b || !b.bomb || this.over) return false;
    const K = SV.BOMB, cx = b.x + 0.5, cy = b.y + 0.5;
    b.bomb = null; this.bombsOn--; this.bombUsed++;
    this.fx.push({ type: 'boom', kind: 'bomb', x: cx, y: cy, r: K.r, t: 0, ttl: 0.75, color: '#ffb02a' });
    this.fx.push({ type: 'ring', kind: 'bomb', x: cx, y: cy, t: 0, ttl: 0.45, color: '#fff2b0' });
    const lvl = this.waveLevel(this.progress);
    let hits = 0, kills = 0;
    for (const u of this.wolves.slice()) {
      if (!u.alive || u.fly || Math.hypot(u.x - cx, u.y - cy) > K.r) continue;
      const pct = u.boss ? K.bossPct : u.elite ? K.elitePct : K.pct;
      const amt = Math.max(60, u.maxhp * pct) + lvl * 60;
      this.damage(u, amt, { dot: true });
      if (u.alive) this.stun(u, K.stun * (u.boss ? 0.4 : 1)); else kills++;
      hits++;
    }
    this.stats.bombHits = (this.stats.bombHits || 0) + hits;
    this.stats.bombKills = (this.stats.bombKills || 0) + kills;
    this.emit('bomb', { b, hits, kills });
    return true;
  };

  /* ---------- 地形危险 ---------- */
  P.updateHazards = function (dt) {
    for (const hz of this.map.hazards) {
      hz.t -= dt; if (hz.flash > 0) hz.flash -= dt;
      if (hz.t > 0) continue;
      hz.t += hz.period; hz.flash = 0.6;
      if (!hz.adj) {
        hz.adj = new Set();
        for (const c of hz.cells) {
          const cx = c % this.cols, cy = (c / this.cols) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const x = cx + dx, y = cy + dy; if (this.map.inb(x, y)) hz.adj.add(y * this.cols + x);
          }
        }
      }
      for (const w of this.wolves) {
        if (!w.alive || w.fly) continue;
        const c = (w.y | 0) * this.cols + (w.x | 0);
        if (!hz.adj.has(c)) continue;
        if (hz.kind === 'volcano') this.damage(w, Math.min(hz.big ? 10000 : 5000, w.maxhp * (hz.big ? 0.04 : 0.02)) * (1 - (w.def.res.fire || 0)), { dot: true });
        else if (hz.kind === 'reactor') this.addSlow(w, 0.5, 2);
        else if (hz.kind === 'nuclear') { if ((w.def.res.light || 0) < 1) this.damage(w, 1000, { dot: true }); }
      }
      for (const b of this.buildings) {
        if (b.kind !== 'tower' || !hz.adj.has(b.i)) continue;
        if (hz.kind === 'volcano') b.disT = Math.max(b.disT, hz.big ? 6 : 4);
        else if (hz.kind === 'reactor') { b.spdMulT = 0.5; b.spdT = 6; }
        else if (hz.kind === 'nuclear') { b.spdMulT = 2; b.spdT = 4; }
      }
    }
  };

  /* ---------- 主循环 ---------- */
  P.updateArena = function (dt) {
    this.arenaT = (this.arenaT || 0) + dt;
    const q = this.arenaQueue;
    while (q && q.length && q[0].t <= this.arenaT) {
      const e = q.shift();
      const w = this.spawnWolf(e.id, { def: e.def, hp: e.hp, spawn: e.spawn, team: 'arena', wt: 0, noReward: true, popv: 1 });
      if (w) { w.team = 'arena'; this.arenaSpawned = (this.arenaSpawned || 0) + 1; w.arenaSlot = e.slot; }
    }
    if ((!q || !q.length) && this.wolves.length === 0 && this.arenaSpawned > 0) {
      this.over = true; this.win = this.stats.leaks > 0;
      this.emit(this.win ? 'victory' : 'defeat', this.getResult());
    }
    if (this.arenaT > 240 && !this.over) { this.over = true; this.win = this.stats.leaks > 0; this.emit(this.win ? 'victory' : 'defeat', this.getResult()); }
  };

  P.update = function (dt) {
    if (this.over || this.paused) return;
    this.t += dt; this.frame++;
    if (this.mode === 'arena') this.updateArena(dt);
    if (this.started) {
      this.updateWaves(dt);
      if (this.map.hasHazard) this.updateHazards(dt);
      for (let i = 0; i < this.wolves.length; i++) { const w = this.wolves[i]; if (w.alive) this.updateWolf(w, dt); }
      // 新生成的子怪也会被遍历到（数组增长）
      for (const b of this.buildings) {
        if (b.kind === 'tower') this.updateTower(b, dt);
        else if (b.kind === 'trap') this.updateTrap(b, dt);
        else if (b.bomb) this.updateBomb(b, dt);
        if (b.recoil > 0) b.recoil -= dt;
      }
      this.updateProjs(dt);
      if (this.wolves.some(w => !w.alive)) this.wolves = this.wolves.filter(w => w.alive);
    }
    // 视觉
    const fx = this.fx;
    for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t >= fx[i].ttl) fx.splice(i, 1); }
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.t += dt; if (f.t >= f.ttl) this.floats.splice(i, 1); }
    if (this.focusId && !this.wolves.some(w => w.uid === this.focusId)) this.focusId = 0;
  };

  /* ---------- 便捷：当前波信息 ---------- */
  P.upcoming = function () {
    // 预览下一波（不消耗随机数，仅估计）
    const M = this.W;
    const ids = {};
    const nb = this.nextBossKind();
    let info = { boss: nb ? nb.kind : null, ids };
    for (const p of M.prop) ids[p[1]] = 1;
    return info;
  };

})(typeof window !== 'undefined' ? window : globalThis);
