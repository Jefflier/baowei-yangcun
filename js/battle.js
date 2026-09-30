/* ============================================================
 * 战斗引擎 A：建造 / 经济 / 波次 / 掉落
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D;

  SV.TOWER_RANGE = { sentry: 1.5, scatter: 1.95, cannon: 3.5, pulse: 1.8, inlay: 1.75 };
  SV.STATUES = {
    panlong: { n: '盘龙柱', cost: 10000, limit: 2, fx: '十字两格内的塔 +15% 攻速', spd: 0.15 },
    niulang: { n: '牛郎雕像', cost: 17777, limit: 1, fx: '十字两格内的塔 +20% 攻击力', dmg: 0.20 },
    zhinu: { n: '织女雕像', cost: 17777, limit: 1, fx: '十字两格内的塔 +20% 射程', rng: 0.20 },
    lantern: { n: '元宵灯楼', cost: 15, limit: 9, fx: '装饰，无特殊效果' }
  };
  SV.TRAPS = {
    clamp: { n: '捕兽夹', cost: 600, fx: '夹住经过的陆狼 2 秒（冷却 8 秒）' },
    mine: { n: '地雷', cost: 300, fx: '踩中爆炸，造成火焰伤害（冷却 6 秒，会驱散减速）' }
  };
  // 炸弹墙：把炸弹装在墙上，地面狼靠近时自动引爆（也可手动引爆）；没引爆的炸弹战后返还
  SV.BOMB = {
    n: '炸弹', limit: 6, r: 1.7, trig: 1.5, arm: 0.6, stun: 1.0, pct: 0.16, elitePct: 0.09, bossPct: 0.05,
    fx: '装在墙上。地面狼靠近时自动引爆：范围伤害 + 短暂眩晕，无视抗性。每局最多同时装 6 枚，没炸的会返还。'
  };
  SV.WALL_COST = 10;
  // 前期地图适当降低狼血量（本作无永久养成，靠这个平滑新手曲线）
  SV.hpScaleFor = function (idx) { return Math.max(0.42, Math.min(1, 0.42 + 0.058 * idx)); };
  SV.SELL_RATE = 0.8;
  SV.MOVE_FEE = 0.02;

  /* 难度权重 */
  const DIFF_TABLE = [[0.8, 0.10], [0.9, 0.16], [1.0, 0.34], [1.1, 0.2], [1.2, 0.12], [1.3, 0.08]];

  function Battle(opts) {
    opts = opts || {};
    this.opts = opts;
    this.mode = opts.mode || 'normal';                 // normal | nightmare | arena
    this.mapIdx = opts.mapIdx | 0;
    this.map = new SV.MapModel(this.mapIdx);
    this.def = this.map.def;
    this.W = this.def.w;
    this.rng = new SV.RNG(opts.seed || (Math.random() * 4294967296) >>> 0);
    this.cols = this.map.cols; this.rows = this.map.rows;
    this.occ = new Array(this.cols * this.rows).fill(null);
    this.buildings = []; this.wolves = []; this.projs = []; this.fx = []; this.floats = [];
    this.uid = 1;
    this.t = 0; this.frame = 0;
    this.onEvent = opts.onEvent || function () { };
    this.silver = opts.silver != null ? opts.silver : 2000;
    this.startSilver = this.silver;
    this.gemStock = opts.gemStock || null;             // null = 无限
    this.boost = Object.assign({ silver: 1, exp: 1, drop: 1 }, opts.boost || {});
    this.playerLevel = opts.playerLevel || 1;
    this.speedMult = opts.speedMult != null ? opts.speedMult : SV.SPEED_MULT;
    this.hpScale = opts.hpScale != null ? opts.hpScale : SV.hpScaleFor(this.mapIdx);
    this.dmgMul = opts.dmgMul || 1;
    this.towerCap = opts.towerCap || 999;
    this.autoWave = opts.autoWave !== false;
    this.bombStock = this.mode === 'arena' ? 0 : (opts.bombs | 0);   // 背包里的炸弹数
    this.bombsOn = 0; this.bombUsed = 0;                            // 已装 / 已引爆

    // 进度 & 生命
    this.progress = 0;
    this.scoreMax = this.W.sc;
    this.infinite = !!this.def.inf;
    this.maxLives = opts.lives || (this.mode === 'nightmare' ? 30 : 30);
    this.lives = this.maxLives;
    this.waveNo = 0;
    this.waves = [];                                   // 活动波
    this.started = false;
    this.nextTimer = 0;
    this.finalStarted = false;
    this.bossIdx = 0;
    this.rbCountdown = this.W.rb && this.W.rb.length ? this.rng.int(15, 40) : 9999;
    this.lures = 20;
    this.over = false; this.win = false;
    this.paused = false;

    // 经济换算
    const inc = this.infinite ? 4000000 : this.def.inc;
    this.silverPerPop = Math.max(0.5, inc / Math.max(1, this.scoreMax)) * (this.infinite ? 0.4 : 1.0);
    this.expPerPop = (0.5 + this.mapIdx * 0.22) * (this.infinite ? 0.3 : 1);
    this.lapDone = false; this.laps = 0;

    // 统计
    this.stats = { kills: 0, leaks: 0, spent: 0, earned: 0, towersBuilt: 0, dmg: 0, bossKills: 0, maxWolves: 0, waveClears: 0 };
    this.loot = [];                                    // 本局掉落
    this.expGained = 0; this.pointsGained = 0;
    this.spentTower = 0;                               // 面板造价（不含墙/雕像）
    this.lastDiff = 1;
    this.focusId = 0;
    this.hazardMul = 1;

    // 噩梦
    if (this.mode === 'nightmare') {
      this.nmWave = 0; this.scoreMax = 110; this.infinite = false;
    }
    this.field = null;
    this.nextWave = null;
    this.refreshField();
    this.recalcAuras();
    if (this.mode !== 'arena') this.nextWave = this.buildWave({});
  }
  SV.Battle = Battle;
  const P = Battle.prototype;

  P.emit = function (name, data) { try { this.onEvent(name, data); } catch (e) { console.error(e); } };

  /* ---------- 流场 ---------- */
  P.refreshField = function () {
    const occ = this.occ;
    this.field = SV.computeField(this.map, i => { const o = occ[i]; return o && o.block; });
    for (const w of this.wolves) if (!w.fly) { w.tx = -1; }
  };
  P.pathOK = function () {
    const f = this.field;
    for (const s of this.map.spawns) if (!isFinite(f.dist[s])) return false;
    for (const w of this.wolves) {
      if (w.fly || !w.alive) continue;
      const c = (w.y | 0) * this.cols + (w.x | 0);
      if (!isFinite(f.dist[c])) return false;
      if (w.tx >= 0) { const c2 = (w.ty | 0) * this.cols + (w.tx | 0); if (!isFinite(f.dist[c2])) return false; }
    }
    return true;
  };

  /* ---------- 建造 ---------- */
  P.towerCost = function (type, lv) { const t = D.towers[type]; return t.cost[SV.clamp(lv, 1, t.max) - 1]; };
  P.towerMax = function (type) { return Math.min(D.towers[type].max, this.towerCap); };

  P.cellFree = function (x, y) {
    if (!this.map.inb(x, y)) return false;
    const i = y * this.cols + x;
    return this.map.buildableBase(i) && !this.occ[i];
  };
  P.wolfOnCell = function (x, y) {
    for (const w of this.wolves) {
      if (w.fly || !w.alive) continue;
      if ((w.x | 0) === x && (w.y | 0) === y) return true;
      if (w.tx >= 0 && (w.tx | 0) === x && (w.ty | 0) === y) return true;
    }
    return false;
  };
  P.countStatue = function (sid) { let n = 0; for (const b of this.buildings) if (b.kind === 'statue' && b.sid === sid) n++; return n; };

  P.canAfford = function (cost) { return this.silver >= cost; };
  P.spend = function (n) { this.silver -= n; this.stats.spent += n; };

  P.gemAvail = function (gem) {
    if (!gem) return true;
    if (!this.gemStock) return true;
    return (this.gemStock[gem.c] && this.gemStock[gem.c][gem.t - 1] > 0);
  };
  P.takeGem = function (gem) { if (gem && this.gemStock) this.gemStock[gem.c][gem.t - 1]--; };
  P.giveGem = function (gem) { if (gem && this.gemStock) this.gemStock[gem.c][gem.t - 1]++; };

  /* spec: {type,lv,gem} / {sid} / {tid} */
  P.build = function (kind, x, y, spec) {
    spec = spec || {};
    if (this.over) return { ok: false, msg: '战斗已结束' };
    if (!this.map.inb(x, y)) return { ok: false, msg: '超出地图' };
    const i = y * this.cols + x;
    if (!this.map.buildableBase(i)) return { ok: false, msg: '这里不能建造' };
    if (this.occ[i]) return { ok: false, msg: '格子已被占用' };
    let cost = 0, b = { id: this.uid++, kind, x, y, i, block: true, born: this.t };
    if (kind === 'tower') {
      const T = D.towers[spec.type]; if (!T) return { ok: false, msg: '未知塔' };
      const lv = SV.clamp(spec.lv || 1, 1, this.towerMax(spec.type));
      cost = this.towerCost(spec.type, lv);
      Object.assign(b, { type: spec.type, lv, gem: null, cd: 0.3, mode: 'first', kills: 0, dmgDealt: 0, flash: 0, aura: { dmg: 1, spd: 1, rng: 1 }, disT: 0, spdT: 0, spdMulT: 1, aim: 0, paid: cost });
      if (spec.gem) {
        if (!this.gemAvail(spec.gem)) return { ok: false, msg: '没有这颗宝石' };
        b.gem = { c: spec.gem.c, t: spec.gem.t };
      }
    } else if (kind === 'wall') {
      cost = SV.WALL_COST; b.paid = cost;
    } else if (kind === 'statue') {
      const S = SV.STATUES[spec.sid]; if (!S) return { ok: false, msg: '未知雕像' };
      if (this.countStatue(spec.sid) >= S.limit) return { ok: false, msg: S.n + '最多建造 ' + S.limit + ' 个' };
      cost = S.cost; b.sid = spec.sid; b.paid = cost;
    } else if (kind === 'trap') {
      const T = SV.TRAPS[spec.tid]; if (!T) return { ok: false, msg: '未知机关' };
      cost = T.cost; b.tid = spec.tid; b.block = false; b.cd = 0; b.paid = cost;
    } else return { ok: false, msg: '未知建筑' };
    if (!this.canAfford(cost)) return { ok: false, msg: '银币不足（需要 ' + SV.fmt(cost) + '）' };
    if (this.map.type[i] === 1 && b.block && this.wolfOnCell(x, y)) return { ok: false, msg: '狼正站在这里' };
    if (this.mode === 'arena') { /* 不限 */ }
    // 阻路检测
    this.occ[i] = b;
    if (b.block && this.map.type[i] === 1) {
      const old = this.field;
      this.field = SV.computeField(this.map, k => { const o = this.occ[k]; return o && o.block; });
      if (!this.pathOK()) { this.occ[i] = null; this.field = old; return { ok: false, msg: '不能完全堵死狼的去路！' }; }
      for (const w of this.wolves) if (!w.fly) w.tx = -1;
    }
    this.spend(cost);
    if (b.gem) this.takeGem(b.gem);
    this.buildings.push(b);
    if (kind === 'tower') { this.spentTower += cost; this.stats.towersBuilt++; }
    this.recalcAuras();
    this.emit('build', b);
    return { ok: true, b };
  };

  P.buildingAt = function (x, y) { return this.map.inb(x, y) ? this.occ[y * this.cols + x] : null; };

  P.sellValue = function (b) { return Math.floor(b.paid * (b.kind === 'wall' ? 1 : SV.SELL_RATE)); };

  P.sell = function (b) {
    if (!b || this.over || this.mode === 'arena') return false;
    if (this.mode === 'nightmare') return false;
    const idx = this.buildings.indexOf(b); if (idx < 0) return false;
    if (b.bomb) this.removeBomb(b);
    const val = this.sellValue(b);
    this.silver += val;
    if (b.kind === 'tower') this.spentTower -= b.paid;
    if (b.gem) this.giveGem(b.gem);
    this.buildings.splice(idx, 1);
    this.occ[b.i] = null;
    if (b.block && this.map.type[b.i] === 1) this.refreshField();
    this.recalcAuras();
    this.emit('sell', b);
    return true;
  };

  /* ---------- 炸弹墙 ---------- */
  P.bombAvail = function () { return Math.max(0, this.bombStock - this.bombUsed - this.bombsOn); };
  P.addBomb = function (b) {
    if (!b || this.over) return { ok: false, msg: '' };
    if (this.mode === 'arena') return { ok: false, msg: '竞技场里不能使用炸弹' };
    if (b.kind !== 'wall') return { ok: false, msg: '炸弹只能装在墙上' };
    if (b.bomb) return { ok: false, msg: '这堵墙已经装了炸弹' };
    if (this.bombAvail() < 1) return { ok: false, msg: '炸弹不足（可在商店购买）' };
    if (this.bombsOn >= SV.BOMB.limit) return { ok: false, msg: '同时最多装 ' + SV.BOMB.limit + ' 枚炸弹' };
    b.bomb = { arm: SV.BOMB.arm };
    this.bombsOn++;
    this.emit('bombAdd', b);
    return { ok: true };
  };
  P.removeBomb = function (b) {
    if (!b || !b.bomb) return false;
    b.bomb = null; this.bombsOn--;
    this.emit('bombRemove', b);
    return true;
  };

  P.upgrade = function (b, toLv) {
    if (!b || b.kind !== 'tower') return { ok: false, msg: '' };
    const max = this.towerMax(b.type);
    toLv = SV.clamp(toLv, b.lv, max);
    if (toLv <= b.lv) return { ok: false, msg: b.lv >= max ? '已达等级上限' : '' };
    const cost = this.towerCost(b.type, toLv) - this.towerCost(b.type, b.lv);
    if (!this.canAfford(cost)) return { ok: false, msg: '银币不足（需要 ' + SV.fmt(cost) + '）' };
    this.spend(cost); b.paid += cost; this.spentTower += cost; b.lv = toLv; b.flash = 0.5;
    this.emit('upgrade', b);
    return { ok: true, cost };
  };
  // 一键升到能负担的最高等级（上限 maxTo）
  P.upgradeAffordable = function (b, maxTo) {
    const cap = Math.min(maxTo || 999, this.towerMax(b.type));
    let lv = b.lv;
    while (lv < cap && this.towerCost(b.type, lv + 1) - this.towerCost(b.type, b.lv) <= this.silver) lv++;
    return this.upgrade(b, lv);
  };

  P.setGem = function (b, gem) {
    if (!b || b.kind !== 'tower') return { ok: false, msg: '' };
    if (gem && !this.gemAvail(gem)) return { ok: false, msg: '背包里没有这颗宝石' };
    if (b.gem) this.giveGem(b.gem);
    b.gem = gem ? { c: gem.c, t: gem.t } : null;
    if (gem) this.takeGem(gem);
    b.flash = 0.5;
    this.emit('gem', b);
    return { ok: true };
  };

  P.moveTower = function (b, nx, ny) {
    if (!b || this.over) return { ok: false, msg: '' };
    if (!this.cellFree(nx, ny)) return { ok: false, msg: '目标格不可用' };
    const fee = b.kind === 'tower' ? Math.floor(b.paid * SV.MOVE_FEE) : 0;
    if (!this.canAfford(fee)) return { ok: false, msg: '银币不足（搬迁费 ' + SV.fmt(fee) + '）' };
    if (this.map.type[nx + ny * this.cols] === 1 && b.block && this.wolfOnCell(nx, ny)) return { ok: false, msg: '狼正站在这里' };
    const oi = b.i, ni = ny * this.cols + nx;
    this.occ[oi] = null; this.occ[ni] = b;
    const ox = b.x, oy = b.y, oi2 = b.i;
    b.x = nx; b.y = ny; b.i = ni;
    if (b.block) {
      const old = this.field;
      this.field = SV.computeField(this.map, k => { const o = this.occ[k]; return o && o.block; });
      if (!this.pathOK()) { this.occ[ni] = null; this.occ[oi] = b; b.x = ox; b.y = oy; b.i = oi2; this.field = old; return { ok: false, msg: '不能完全堵死狼的去路！' }; }
      for (const w of this.wolves) if (!w.fly) w.tx = -1;
    }
    this.spend(fee);
    this.recalcAuras();
    this.emit('move', b);
    return { ok: true };
  };

  /* ---------- 雕像光环 ---------- */
  P.auraAt = function (x, y) {
    const a = { dmg: 1, spd: 1, rng: 1 };
    let panlong = false;
    for (const s of this.buildings) {
      if (s.kind !== 'statue' || s.sid === 'lantern') continue;
      const dx = Math.abs(s.x - x), dy = Math.abs(s.y - y);
      if (!((dx === 0 && dy <= 2) || (dy === 0 && dx <= 2)) || (dx === 0 && dy === 0)) continue;
      const S = SV.STATUES[s.sid];
      if (S.spd) { if (!panlong) { a.spd += S.spd; panlong = true; } }
      if (S.dmg) a.dmg += S.dmg;
      if (S.rng) a.rng += S.rng;
    }
    return a;
  };
  P.recalcAuras = function () {
    for (const t of this.buildings) if (t.kind === 'tower') t.aura = this.auraAt(t.x, t.y);
  };

  /* ---------- 波次 ---------- */
  P.waveLevel = function (prog) { return Math.sqrt(this.W.hA + this.W.hB * prog); };

  P.rollDiff = function () {
    let r = this.rng.next(), acc = 0;
    let arr = DIFF_TABLE;
    if (this.waveNo <= 2) arr = DIFF_TABLE.slice(0, 3).map(x => [x[0], x[1]]);
    let tot = 0; for (const a of arr) tot += a[1];
    r *= tot;
    for (const a of arr) { acc += a[1]; if (r <= acc) return a[0]; }
    return 1;
  };

  P.pickProp = function () {
    const prop = this.W.prop; const r = this.rng.next();
    for (const p of prop) if (r <= p[0]) return p[1];
    return prop[prop.length - 1][1];
  };

  P.waveBudget = function () {
    const M = this.W;
    if (this.mode === 'nightmare') {
      const n = this.nmWave;
      return Math.round(M.pop * SV.clamp(0.5 + n * 0.012, 0.5, 1.5));
    }
    const ref = this.infinite ? 2400 : this.scoreMax;
    let k = SV.clamp(0.35 + 0.65 * (this.progress / (ref * 0.5)), 0.35, 1);
    if (this.infinite) k = 1 + Math.min(1.5, this.progress / 6000);
    return Math.max(2, Math.round(M.pop * k));
  };

  P.nextBossKind = function () {
    const M = this.W;
    if (this.mode === 'nightmare') return null;
    if (!this.infinite && this.progress >= this.scoreMax && M.fb.length && !this.finalStarted) return { kind: 'final' };
    if (this.rbCountdown <= 0 && M.rb.length) return { kind: 'random' };
    const nb = M.boss.length;
    if (nb && !this.infinite && this.bossIdx < nb) {
      const mark = (this.bossIdx + 1) / (nb + 1) * this.scoreMax;
      if (this.progress >= mark) return { kind: 'boss', id: M.boss[this.bossIdx] };
    } else if (nb && this.infinite) {
      // 每圈 2400 进度被均分成 nb+1 个区间，进入第 k 区间(1..nb)时来一个 boss
      const zone = Math.floor(this.progress / (2400 / (nb + 1) + 1e-9) + 1e-9), k = zone % (nb + 1);
      if (k >= 1 && zone > (this.lastBossZone || 0)) return { kind: 'boss', id: M.boss[k - 1], zone };
    }
    return null;
  };

  /* 生成一波（返回波对象；不立即出怪）*/
  P.buildWave = function (opts) {
    opts = opts || {};
    const M = this.W;
    const wv = {
      no: opts.lure ? 0 : this.waveNo + 1, id: this.uid++, plan: [], t: 0, budget: 0, kind: 'normal', diff: 1, alive: 0, spawned: 0,
      leakPop: 0, killed: 0, lure: !!opts.lure, done: false, weightSum: 0, level: 1, bossNames: []
    };
    let B = this.waveBudget();
    wv.budget = B;
    const diff = opts.diff || this.rollDiff();
    wv.diff = diff; this.lastDiff = diff;
    wv.level = this.waveLevel(this.mode === 'nightmare' ? this.nmWave * 12 + 20 : this.progress);
    const list = [];                                    // {id, boss, elite}
    let bossInfo = null;
    if (this.mode === 'nightmare') {
      if (this.nmWave > 0 && this.nmWave % 10 === 0) bossInfo = { kind: 'boss' };
    } else if (!opts.lure) bossInfo = this.nextBossKind();
    let escortB = B;
    if (bossInfo) {
      wv.kind = bossInfo.kind;
      if (bossInfo.kind === 'final') {
        this.finalStarted = true;
        for (const id of M.fb) list.push({ id, boss: true });
      } else if (bossInfo.kind === 'random') {
        const r = this.rng.next(); let pick = M.rb[M.rb.length - 1];
        for (const e of M.rb) if (r <= e[0]) { pick = e; break; }
        list.push({ id: pick[1], boss: true, diffMul: parseFloat(pick[2]) || 1, random: true });
        this.rbCountdown = this.rng.int(15, 40);
      } else if (this.mode === 'nightmare') {
        const bossPool = this.bossPool();
        const bid = this.rng.pick(bossPool);
        list.push({ id: bid, boss: true });
        list.push({ id: this.rng.pick(bossPool), boss: true });
      } else {
        const def = SV.wolfDef(bossInfo.id);
        if (bossInfo.zone != null) this.lastBossZone = bossInfo.zone; else this.bossIdx++;
        if (def.fixed) list.push({ id: bossInfo.id, boss: true });
        else { const n = 1 + Math.min(3, Math.floor(B / 12)); for (let k = 0; k < n; k++) list.push({ id: bossInfo.id, elite: true }); }
      }
      escortB = Math.round(B * 0.55);
    }
    let used = 0, guard = 0;
    while (used < escortB && guard++ < 400) {
      const id = this.mode === 'nightmare' ? this.pickNightmareWolf() : this.pickProp();
      list.push({ id }); used += SV.wolfDef(id).pop;
    }
    // 排序：先小怪后 boss
    const norm = list.filter(e => !e.boss), bosses = list.filter(e => e.boss);
    // 生成时间轴
    let tt = 0;
    const spawns = this.map.spawns;
    const groups = norm.length;
    for (let k = 0; k < norm.length; k++) {
      const e = norm[k]; const d = SV.wolfDef(e.id);
      const gap = e.elite ? 1.4 : (d.fly ? 0.7 : 0.55) * (1 + (0.5 / Math.max(0.4, d.speed / 0.6)) * 0.2);
      wv.plan.push({ t: tt, id: e.id, elite: e.elite, spawn: k % spawns.length });
      tt += gap * (1 + this.rng.next() * 0.5);
    }
    let bt = bosses.length ? Math.max(1.0, tt * 0.35) : 0;
    for (const e of bosses) {
      wv.plan.push({ t: bt, id: e.id, boss: true, diffMul: e.diffMul || 1, random: e.random, spawn: this.rng.int(0, spawns.length - 1) });
      bt += 2.2;
    }
    wv.plan.sort((a, b) => a.t - b.t);
    // 奖励权重
    let ws = 0;
    for (const e of wv.plan) { const d = SV.wolfDef(e.id); e.wt = e.boss ? 0 : (e.elite ? 3 : d.pop); ws += e.wt; }
    const nb = wv.plan.filter(e => e.boss).length;
    const bossShare = nb ? Math.max(ws * 0.6, B * 0.35) / nb : 0;
    for (const e of wv.plan) if (e.boss) { e.wt = bossShare; ws += bossShare; }
    wv.weightSum = ws;
    wv.count = wv.plan.length;
    wv.bossNames = wv.plan.filter(e => e.boss || e.elite).map(e => SV.wolfDef(e.id).n + (e.elite ? '·精英' : '')).filter((v, i, a) => a.indexOf(v) === i);
    wv.comp = {};
    for (const e of wv.plan) { const k = e.id + (e.elite ? '*' : '') + (e.boss ? '!' : ''); wv.comp[k] = (wv.comp[k] || 0) + 1; }
    return wv;
  };
  P.activateWave = function (wv) {
    if (!wv.lure) { this.waveNo++; wv.no = this.waveNo; this.rbCountdown--; }
    wv.level = this.waveLevel(this.mode === 'nightmare' ? this.nmWave * 12 + 20 : this.progress);
    this.lastDiff = wv.diff;
    this.waves.push(wv);
    this.emit('waveStart', wv);
    if (wv.kind !== 'normal' && !wv.lure) this.emit('bossWarning', wv);
    return wv;
  };
  /* 预备下一波（供预览） */
  P.prepareNext = function () {
    const keepP = this.progress;
    const active = this.waves.filter(w => !w.lure);
    // 用"预计进度"来决定 boss 节点
    if (active.length) this.progress += active[0].budget;
    if (!this.infinite && this.progress > this.scoreMax) this.progress = this.scoreMax;
    if (this.mode === 'nightmare') this.nmWave++;
    this.nextWave = this.buildWave({});
    this.nextWave.estProgress = this.progress;
    if (this.mode === 'nightmare') this.nmWave--;
    this.progress = keepP;
  };

  P.bossPool = function () {
    const M = this.W; const pool = [];
    for (const b of M.boss) if (SV.wolfDef(b).fixed) pool.push(b);
    for (const r of M.rb) pool.push(r[1]);
    for (const f of M.fb) pool.push(f);
    return pool.length ? pool : ['dqcyl'];
  };
  P.pickNightmareWolf = function () {
    // 噩梦：所有狼随机出现（取本图前后几张图的常见狼）
    if (!this._nmPool) {
      const set = new Set();
      const lo = Math.max(0, this.mapIdx - 3), hi = Math.min(D.maps.length - 1, this.mapIdx + 3);
      for (let i = lo; i <= hi; i++) for (const p of D.maps[i].w.prop) set.add(p[1]);
      this._nmPool = Array.from(set);
    }
    return this.rng.pick(this._nmPool);
  };

  /* 玩家操作 */
  P.startBattle = function () {
    if (this.started) return;
    this.started = true;
    this.callWave();
  };
  P.callWave = function () {
    if (this.over) return null;
    let wv = this.nextWave;
    if (wv) {
      // 预备波的合法性检查：最终 boss 必须真的达到进度
      const bad = (wv.kind === 'final' && !(this.progress >= this.scoreMax)) || (wv.kind !== 'final' && !this.infinite && this.mode !== 'nightmare' && this.progress >= this.scoreMax && this.W.fb.length && !this.finalStarted);
      if (bad) { if (wv.kind === 'final') this.finalStarted = false; wv = null; }
    }
    if (this.mode === 'nightmare') this.nmWave++;
    if (!wv) wv = this.buildWave({});
    this.nextWave = null;
    this.activateWave(wv);
    this.nextTimer = 0;
    this.prepareNext();
    return wv;
  };
  P.lure = function () {
    if (this.over || !this.started || this.lures <= 0 || this.mode !== 'normal') return false;
    this.lures--;
    this.activateWave(this.buildWave({ lure: true }));
    return true;
  };

  /* 波管理：出怪、结算 */
  P.updateWaves = function (dt) {
    for (const wv of this.waves) {
      if (wv.done) continue;
      wv.t += dt;
      while (wv.plan.length && wv.plan[0].t <= wv.t) {
        const e = wv.plan.shift();
        this.spawnWolf(e.id, { wave: wv, elite: e.elite, boss: e.boss, spawn: e.spawn, wt: e.wt, diffMul: e.diffMul, random: e.random });
      }
      if (!wv.plan.length && wv.alive <= 0 && !wv.done) this.finishWave(wv);
    }
    this.waves = this.waves.filter(w => !w.done);
    if (this.started && !this.over) {
      const primary = this.waves.filter(w => !w.lure);
      if (primary.length === 0) {
        if (this.autoWave) {
          this.nextTimer += dt;
          if (this.nextTimer >= (this.mode === 'nightmare' ? 3 : 4.5)) this.callWave();
        }
      }
    }
  };

  P.finishWave = function (wv) {
    wv.done = true;
    if (wv.lure) { this.emit('waveEnd', wv); return; }
    this.stats.waveClears++;
    const gain = Math.max(0, wv.budget - wv.leakPop * 2);
    if (this.mode !== 'nightmare') {
      this.progress = Math.max(0, this.progress + (wv.leakPop > 0 ? wv.budget - wv.leakPop * 2 : wv.budget));
      if (!this.infinite && this.progress > this.scoreMax) this.progress = this.scoreMax;
      if (this.infinite) {                                   // 无限图：每完成一圈(2400进度)获得"调任文书"奖励，首圈视为通关
        const lap = Math.floor(this.progress / 2400);
        while (this.laps < lap && this.laps < 6) {
          this.laps++;
          this.addLoot([{ type: 'points', n: 3 }, { type: 'gem', c: this.rng.int(0, 5), t: 4, n: 1 }], 0, 0);
          this.emit('lap', { lap: this.laps });
        }
        if (lap >= 1 && !this.lapDone) { this.lapDone = true; this.win = true; }
      }
    }
    // 回复生命
    if (this.lives < this.maxLives) this.lives = Math.min(this.maxLives, this.lives + 1);
    this.emit('waveEnd', wv);
    if (wv.kind === 'final' && !wv.bossLeaked && this.mode !== 'nightmare') { this.victory(); return; }
    if (wv.kind === 'final') { this.finalStarted = false; }
    if (this.mode === 'nightmare' && this.nmWave >= 110) this.victory();
  };

  P.victory = function () {
    if (this.over) return;
    this.over = true; this.win = true;
    this.emit('victory', this.getResult());
  };
  P.defeat = function () {
    if (this.over) return;
    this.over = true; this.win = !!this.lapDone;
    this.emit(this.win ? 'victory' : 'defeat', this.getResult());
  };
  P.retreat = function () {
    if (this.over) return;
    this.over = true; this.win = !!this.lapDone; this.retreated = true;
    this.emit(this.win ? 'victory' : 'defeat', this.getResult());
  };

  /* 战利品 */
  P.rollLoot = function (kind, wolf) {
    const out = [];
    const rng = this.rng;
    const tier = this.mapIdx;                              // 越靠后的图掉落越好
    const gemT = () => {
      let t = 1;
      const bias = Math.min(3.2, tier / 12);
      for (let k = 0; k < 4; k++) if (rng.next() < 0.12 + bias * 0.08) t++; else break;
      return Math.min(5, t);
    };
    const dm = this.boost.drop;
    const gem = (n, forceHei) => {
      const c = forceHei ? 5 : rng.int(0, 5);
      const t = gemT();
      out.push({ type: 'gem', c, t, n: n || 1 });
    };
    if (kind === 'random') {
      out.push({ type: 'points', n: Math.max(1, Math.round((1 + rng.int(0, 2) + tier / 14) * dm)) });
      if (rng.chance(0.75 * dm)) gem(1);
      if (rng.chance(0.25 * dm)) gem(1, true);
      if (tier >= 20 && rng.chance(0.15 * dm)) out.push({ type: 'bag' });
      if (rng.chance(0.08 * dm)) out.push({ type: 'item', id: 'lollipop', n: 1 });
    } else if (kind === 'final') {
      out.push({ type: 'points', n: 2 + Math.floor(tier / 6) });
      gem(1); gem(1); if (rng.chance(0.5)) gem(1, true);
    } else if (kind === 'boss') {
      if (rng.chance(0.6 * dm)) gem(1);
      if (rng.chance(0.35 * dm)) out.push({ type: 'points', n: 1 });
    } else if (kind === 'elite') {
      if (rng.chance(0.16 * dm)) gem(1);
    }
    return out;
  };
  P.addLoot = function (arr, x, y) {
    for (const l of arr) {
      this.loot.push(l);
      if (l.type === 'points') this.pointsGained += l.n;
      this.emit('loot', { loot: l, x, y });
    }
  };

  P.getResult = function () {
    return {
      win: this.win, retreated: !!this.retreated, mode: this.mode, mapIdx: this.mapIdx,
      progress: this.progress, scoreMax: this.scoreMax, waves: this.waveNo, kills: this.stats.kills, leaks: this.stats.leaks,
      silverNet: Math.floor(this.silver - this.startSilver + this.spentTowerRefund()),
      silverLeft: Math.floor(this.silver), spentTower: this.spentTower, earned: Math.floor(this.stats.earned), spent: this.stats.spent,
      exp: Math.floor(this.expGained), points: this.pointsGained, loot: this.loot.slice(), nmWave: this.nmWave || 0,
      bossKills: this.stats.bossKills, time: this.t
    };
  };
  P.spentTowerRefund = function () { return 0; };

  /* 战斗结束时：回收宝石到库存 */
  P.dismantle = function () {
    for (const b of this.buildings) if (b.kind === 'tower' && b.gem) { this.giveGem(b.gem); b.gem = null; }
  };

})(typeof window !== 'undefined' ? window : globalThis);
