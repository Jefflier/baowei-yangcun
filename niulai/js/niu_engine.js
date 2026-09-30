/* ============================================================
 * 牛来攻城 —— 战斗引擎（不碰 DOM，可以在 node 里跑无头模拟）
 *
 * 和保卫羊村最大的不同：路可以堵死。寻路沿用羊村 core.js 的 Dijkstra 流场，
 * 但给建筑加了「通行代价」= 撞开它要花的时间换算成格数：
 *   代价 = 3 + 剩余耐久 / 参考破坏力（普通牛 7、撞城牛 30）→ 木栅≈20 格、石墙≈67 格、铁壁≈174 格
 * 所以牛会在「绕远路」和「撞墙」之间自己权衡：墙越结实越愿意绕，墙被撞薄了就一拥而上。
 * 撞城牛用单独一张流场（参考破坏力高），会直奔最薄的那堵墙。
 *
 * 坐标：格为单位，格 (c, r) 的中心是 (c + 0.5, r + 0.5)。
 * ============================================================ */
(function (root) {
  'use strict';
  const NL = root.NL = root.NL || {};
  const D = NL.D;

  /* ---------- 随机数（与 core.js 的 SV.RNG 同一算法，引擎自带一份以便无头运行） ---------- */
  function RNG(seed) { this.s = (seed >>> 0) || 1; }
  RNG.prototype.next = function () {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  RNG.prototype.pick = function (a) { return a[Math.floor(this.next() * a.length)]; };
  NL.RNG = RNG;

  /* ---------- 二叉堆（Dijkstra 用） ---------- */
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v, top = v[0];
    const lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i, mk = lk;
        if (l < n && k[l] < mk) { m = l; mk = k[l]; }
        if (r < n && k[r] < mk) { m = r; mk = k[r]; }
        if (m === i) break;
        k[i] = k[m]; v[i] = v[m]; i = m;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  };

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const T_GRASS = 0, T_BLOCK = 1, T_WATER = 2, T_ROAD = 3, T_SPAWN = 4, T_GOAL = 5;
  const TER = { '.': T_GRASS, ',': T_GRASS, '*': T_GRASS, T: T_BLOCK, R: T_BLOCK, M: T_BLOCK, '~': T_WATER, '=': T_ROAD, S: T_SPAWN, G: T_GOAL };
  NL.T = { GRASS: T_GRASS, BLOCK: T_BLOCK, WATER: T_WATER, ROAD: T_ROAD, SPAWN: T_SPAWN, GOAL: T_GOAL };
  const BREAK_REF = 7, BREAK_REF_SIEGE = 30, BREAK_BASE = 3;
  const RAM_DIST = 0.62;                       // 撞墙时离墙中心的距离

  /* ============================================================ */
  function Game(L, opts) {
    opts = opts || {};
    this.L = L; this.opts = opts;
    this.cols = D.COLS; this.rows = D.ROWS; const n = this.n = this.cols * this.rows;
    this.seed = (opts.seed != null ? opts.seed : (Math.random() * 4294967296)) >>> 0;
    this.rng = new RNG(this.seed ^ 0x51ed);
    this.ter = new Uint8Array(n); this.chr = new Array(n); this.walk = new Uint8Array(n);
    this.goals = []; const spawns = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c, ch = L.map[r][c];
      const t = TER[ch] != null ? TER[ch] : T_GRASS;
      this.ter[i] = t; this.chr[i] = ch;
      this.walk[i] = (t === T_GRASS || t === T_ROAD || t === T_SPAWN || t === T_GOAL) ? 1 : 0;
      if (t === T_SPAWN) spawns.push(i);
      if (t === T_GOAL) this.goals.push(i);
    }
    // 入口按上下相连分组：同一组是一个「牛群入口」
    this.spawnGroups = [];
    const seen = new Set();
    for (const s of spawns) {
      if (seen.has(s)) continue;
      const g = [], st = [s]; seen.add(s);
      while (st.length) {
        const u = st.pop(); g.push(u);
        for (const d of [-this.cols, this.cols, -1, 1]) {
          const v = u + d; if (v < 0 || v >= n || seen.has(v) || this.ter[v] !== T_SPAWN) continue;
          if ((d === 1 || d === -1) && ((v / this.cols) | 0) !== ((u / this.cols) | 0)) continue;
          seen.add(v); st.push(v);
        }
      }
      g.sort((a, b) => a - b);
      this.spawnGroups.push(g);
    }
    let gx = 0, gy = 0;
    for (const g of this.goals) { gx += g % this.cols + 0.5; gy += ((g / this.cols) | 0) + 0.5; }
    this.gate = { x: gx / this.goals.length + 0.9, y: gy / this.goals.length };

    this.occ = new Array(n).fill(null);
    this.blds = []; this.cows = []; this.proj = []; this.fx = []; this.rollers = []; this.ev = []; this.calmers = [];
    this.uid = 1; this.t = 0; this.sayWall = this.sayTrip = -99;
    this.gold = L.gold; this.maxHp = D.CITY_HP; this.hp = this.maxHp;
    this.k = 0; this.N = L.waves; this.endless = !!L.endless;
    this.spawnQ = []; this.nextT = -1; this.waveCache = {};
    this.skillCd = { gunmu: 0, freeze: 0, repair: 0 };
    this.unlocked = opts.unlocked || null;       // null = 全部可用（无头模拟）
    this.focus = 0;
    this.over = false; this.win = false;
    this.stats = { kills: 0, leaks: 0, built: 0, spent: 0, earned: 0, destroyed: 0, dmg: 0, bossKills: 0, calls: 0 };
    this.dirty = true; this.hpDirty = 0;
    this.refresh();
  }
  NL.Game = Game;
  const P = Game.prototype;

  P.emit = function (type, o) { o = o || {}; o.type = type; this.ev.push(o); if (this.ev.length > 400) this.ev.splice(0, 200); };
  P.inb = function (x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; };
  P.idx = function (x, y) { return y * this.cols + x; };
  P.isUnlocked = function (id) { return !this.unlocked || this.unlocked.has(id); };

  /* ---------- 流场 ---------- */
  P.breakCost = function (b, siege) { return BREAK_BASE + Math.max(0, b.hp) / (siege ? BREAK_REF_SIEGE : BREAK_REF); };
  P.openCell = function (i) { const b = this.occ[i]; return this.walk[i] && !(b && b.block); };
  P.computeField = function (siege, occOverride) {
    const n = this.n, cols = this.cols, rows = this.rows, occ = occOverride || this.occ;
    const dist = new Float64Array(n).fill(Infinity), nxt = new Int16Array(n).fill(-1), pen = new Float64Array(n);
    const open = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const b = occ[i], blk = b && b.block;
      pen[i] = blk ? this.breakCost(b, siege) : 0;
      open[i] = this.walk[i] && !blk ? 1 : 0;
    }
    const heap = new Heap();
    for (const g of this.goals) { dist[g] = 0; heap.push(0, g); }
    while (heap.k.length) {
      const d0 = heap.k[0], u = heap.pop();
      if (d0 > dist[u]) continue;
      const ux = u % cols, uy = (u / cols) | 0, du = d0 + pen[u];
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1], x = ux + dx, y = uy + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const v = y * cols + x;
        if (!this.walk[v]) continue;
        if (dx && dy && (!open[uy * cols + x] || !open[y * cols + ux])) continue;   // 不许斜穿墙角
        const nd = du + (dx && dy ? 1.4142 : 1);
        if (nd < dist[v] - 1e-6) { dist[v] = nd; heap.push(nd, v); }
      }
    }
    for (let v = 0; v < n; v++) {
      if (!this.walk[v] || dist[v] === 0 || dist[v] === Infinity) continue;
      const vx = v % cols, vy = (v / cols) | 0;
      let best = -1, bs = Infinity;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1], x = vx + dx, y = vy + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const u = y * cols + x;
        if (!this.walk[u] || dist[u] === Infinity) continue;
        if (dx && dy && (!open[vy * cols + x] || !open[y * cols + vx])) continue;
        const s = dist[u] + pen[u] + (dx && dy ? 1.4142 : 1);
        if (s < bs - 1e-6) { bs = s; best = u; }
      }
      nxt[v] = best;
    }
    return { dist, nxt, pen };
  };
  P.refresh = function () {
    this.fN = this.computeField(false);
    this.fS = this.computeField(true);
    this.dirty = false; this.hpDirty = 0;
  };
  // 从某格沿流场走到城门：返回经过的格子和途中要撞开的建筑
  P.pathFrom = function (cell, siege, field, occ) {
    const F = field || (siege ? this.fS : this.fN), out = [], breach = [];
    occ = occ || this.occ;
    let c = cell, guard = 0;
    while (c >= 0 && guard++ < this.n) {
      out.push(c);
      if (this.ter[c] === T_GOAL) break;
      c = F.nxt[c];
      if (c >= 0 && occ[c] && occ[c].block) breach.push(c);
    }
    return { cells: out, breach };
  };
  // 假设在 i 放一个耐久为 hp 的挡路建筑，流场会变成什么样（建造预览用）
  P.previewOcc = function (cells, hp) {
    const occ = this.occ.slice();
    for (const i of [].concat(cells)) occ[i] = { block: true, hp: hp, ghost: true };
    return occ;
  };
  P.previewField = function (cells, hp, siege, occ) {
    return this.computeField(!!siege, occ || this.previewOcc(cells, hp));
  };
  P.pathLen = function (F) {
    let sum = 0, m = 0;
    for (const g of this.spawnGroups) { const d = F.dist[g[(g.length / 2) | 0]]; if (isFinite(d)) { sum += d; m++; } }
    return m ? sum / m : 0;
  };

  /* ---------- 建造 ---------- */
  P.costOf = function (kind, spec) {
    if (kind === 'tower') return D.towers[spec.type].cost[0];
    if (kind === 'wall') return D.walls[0].cost;
    if (kind === 'hay') return D.hay.cost;
    if (kind === 'statue') return D.statues[spec.sid].cost;
    return Infinity;
  };
  P.countStatue = function (sid) { let k = 0; for (const b of this.blds) if (b.kind === 'statue' && b.sid === sid) k++; return k; };
  P.cowNear = function (i) {
    const x = i % this.cols + 0.5, y = ((i / this.cols) | 0) + 0.5;
    for (const c of this.cows) {
      if (!c.alive || c.fly) continue;
      if (c.tc === i) return true;
      if (Math.abs(c.x - x) < 0.72 && Math.abs(c.y - y) < 0.72) return true;
    }
    return false;
  };
  P.canPlace = function (kind, x, y, spec) {
    spec = spec || {};
    if (this.over) return { ok: false, msg: '战斗已结束' };
    if (!this.inb(x, y)) return { ok: false, msg: '超出地图' };
    const i = this.idx(x, y), t = this.ter[i];
    const unlockId = kind === 'tower' ? spec.type : kind === 'statue' ? spec.sid : kind;
    if (!this.isUnlocked(unlockId)) return { ok: false, msg: '还没解锁' };
    if (kind === 'hay') { if (t !== T_GRASS && t !== T_ROAD) return { ok: false, msg: '草垛要放在草地或大路上' }; }
    else if (t !== T_GRASS) return { ok: false, msg: t === T_ROAD ? '大路和桥上只能放草垛' : '这里不能建造' };
    if (this.occ[i]) return { ok: false, msg: '这里已经有建筑了' };
    if (kind === 'statue') { const S = D.statues[spec.sid]; if (this.countStatue(spec.sid) >= S.limit) return { ok: false, msg: S.n + '最多 ' + S.limit + ' 座' }; }
    const cost = this.costOf(kind, spec);
    if (this.gold < cost) return { ok: false, msg: '金币不够（需要 ' + cost + '）', cost, poor: true };
    if (kind !== 'hay' && this.cowNear(i)) return { ok: false, msg: '牛正在这里，等它走开', cost };
    return { ok: true, cost };
  };
  P.place = function (kind, x, y, spec) {
    spec = spec || {};
    const chk = this.canPlace(kind, x, y, spec);
    if (!chk.ok) return chk;
    const i = this.idx(x, y);
    const b = { id: this.uid++, kind, x, y, i, lv: 1, block: kind !== 'hay', paid: chk.cost, born: this.t, hit: 0 };
    if (kind === 'tower') {
      const T = D.towers[spec.type];
      Object.assign(b, { type: spec.type, maxHp: T.hp[0], cd: 0.2, mode: 'first', dis: 0, kills: 0, dmgDealt: 0, aura: { spd: 1, rng: 1 }, ang: 0, fireT: 0 });
    } else if (kind === 'wall') b.maxHp = D.walls[0].hp;
    else if (kind === 'statue') { b.sid = spec.sid; b.maxHp = D.statues[spec.sid].hp; }
    else if (kind === 'hay') { b.bites = D.hay.bites; b.maxHp = 1; }
    b.hp = b.maxHp;
    this.occ[i] = b; this.blds.push(b);
    this.gold -= chk.cost; this.stats.spent += chk.cost; this.stats.built++;
    if (b.block) this.dirty = true;
    this.recalcAura();
    this.emit('build', { b });
    return { ok: true, b };
  };
  P.maxLv = function (b) { return b.kind === 'tower' ? 5 : b.kind === 'wall' ? D.walls.length : 1; };
  P.upCost = function (b) {
    if (b.lv >= this.maxLv(b)) return 0;
    if (b.kind === 'tower') return D.towers[b.type].cost[b.lv];
    if (b.kind === 'wall') return D.walls[b.lv].cost;
    return 0;
  };
  P.upgrade = function (b) {
    if (!b || this.over || this.occ[b.i] !== b) return { ok: false, msg: '' };
    const cost = this.upCost(b);
    if (!cost) return { ok: false, msg: '已经满级了' };
    if (this.gold < cost) return { ok: false, msg: '金币不够（需要 ' + cost + '）', poor: true };
    this.gold -= cost; this.stats.spent += cost; b.paid += cost; b.lv++;
    const nm = b.kind === 'tower' ? D.towers[b.type].hp[b.lv - 1] : D.walls[b.lv - 1].hp;
    b.hp += nm - b.maxHp; b.maxHp = nm;
    if (b.block) this.dirty = true;
    this.emit('upgrade', { b });
    return { ok: true };
  };
  P.refund = function (b) {
    const full = this.k === 0 || this.t - b.born < 3;
    return Math.floor(b.paid * (full ? 1 : D.SELL_RATE));
  };
  P.sell = function (b) {
    if (!b || this.occ[b.i] !== b) return { ok: false };
    const m = this.refund(b);
    this.gold += m;
    this.removeB(b);
    this.emit('sell', { b, gold: m });
    return { ok: true, gold: m };
  };
  P.repairCost = function (b) {
    if (b.kind === 'hay' || b.hp >= b.maxHp) return 0;
    return Math.max(1, Math.ceil((1 - b.hp / b.maxHp) * b.paid * 0.4));
  };
  P.repair = function (b) {
    const c = this.repairCost(b);
    if (!c) return { ok: false, msg: '不需要修' };
    if (this.gold < c) return { ok: false, msg: '金币不够（需要 ' + c + '）', poor: true };
    this.gold -= c; this.stats.spent += c; b.hp = b.maxHp; if (!this.hpDirty) this.hpDirty = 1e-6;
    this.emit('repair', { b });
    return { ok: true };
  };
  P.cycleMode = function (b) {
    if (!b || b.kind !== 'tower') return;
    const o = D.MODE_ORDER; b.mode = o[(o.indexOf(b.mode) + 1) % o.length];
  };
  P.removeB = function (b) {
    if (this.occ[b.i] === b) this.occ[b.i] = null;
    const k = this.blds.indexOf(b); if (k >= 0) this.blds.splice(k, 1);
    b.dead = true;
    if (b.block) this.dirty = true;
    this.recalcAura();
  };
  P.recalcAura = function () {
    const sts = this.blds.filter(b => b.kind === 'statue');
    for (const b of this.blds) {
      if (b.kind !== 'tower') continue;
      b.aura.spd = 1; b.aura.rng = 1;
      for (const s of sts) {
        const S = D.statues[s.sid];
        if (Math.hypot(s.x - b.x, s.y - b.y) > S.r + 1e-6) continue;
        if (S.spd) b.aura.spd = 1 + S.spd;
        if (S.rng) b.aura.rng = 1 + S.rng;
      }
    }
    this.calmers = sts.filter(s => s.sid === 'niulang');
  };
  P.hurtB = function (b, d, src) {
    if (b.dead || d <= 0) return;
    b.hp -= d; b.hit = 0.15; if (!this.hpDirty) this.hpDirty = 1e-6;
    if (b.hp <= 0) {
      b.hp = 0;
      this.stats.destroyed++;
      this.fx.push({ k: 'rubble', x: b.x + 0.5, y: b.y + 0.5, t: 0, T: 0.8, what: b.kind });
      // 《牛来》：「牛来撞树上了，那哭的不应该是树吗？」
      if (b.kind === 'wall' && src && src.def && this.t - this.sayWall > 12) { this.sayWall = this.t; this.fx.push({ k: 'say', x: b.x + 0.5, y: b.y + 0.5, txt: '撞墙上了，哭的不应该是墙吗？', t: 0, T: 2.8 }); }
      this.removeB(b);
      this.emit('destroy', { b });
    }
  };

  /* ---------- 波次 ---------- */
  P.hpMul = function (k) { const L = this.L, j = k - 1; return L.hp * (1 + L.hpk * j + L.hpk2 * j * j); };
  P.genWave = function (k) {
    if (this.waveCache[k]) return this.waveCache[k];
    const L = this.L, rng = new RNG((this.seed * 31 + k * 2654435761) >>> 0);
    const avail = L.cows.filter(e => e[1] <= k).map(e => e[0]);
    const fresh = L.cows.filter(e => e[1] === k && k > 1).map(e => e[0]);
    let pts = L.pts * Math.pow(L.growth, k - 1);
    const groups = [];
    const bosses = [];
    if (L.boss && L.boss[k]) bosses.push(L.boss[k]);
    if (L.bossEvery) for (const id in L.bossEvery) if (k % L.bossEvery[id] === 0) bosses.push(id);
    if (bosses.length) pts *= 0.55;                                   // BOSS 波的小弟少一点
    const nG = fresh.length ? 2 : (k >= 3 && rng.next() < 0.45 ? 2 : 1) + (k >= 12 && rng.next() < 0.3 ? 1 : 0);
    const chosen = [];
    for (const f of fresh) chosen.push(f);
    while (chosen.length < nG) {
      // 越新解锁的牛权重越高
      const w = avail.map((id, j) => 1 + j * 0.6), tot = w.reduce((a, b) => a + b, 0);
      let r = rng.next() * tot, pick = avail[0];
      for (let j = 0; j < avail.length; j++) { r -= w[j]; if (r <= 0) { pick = avail[j]; break; } }
      if (chosen.indexOf(pick) >= 0 && avail.length > chosen.length) continue;
      chosen.push(pick);
    }
    let delay = 0;
    const share = chosen.map((id, j) => (fresh.length && j === 0 ? 0.55 : 1));
    const stot = share.reduce((a, b) => a + b, 0);
    let spill = 0;
    chosen.forEach((id, j) => {
      const C = D.cows[id];
      const want = Math.round(pts * share[j] / stot / C.pts);
      const n = Math.max(fresh.indexOf(id) >= 0 ? 3 : 2, Math.min(C.max || 36, want));
      if (want > n) spill += (want - n) * C.pts;
      const gap = Math.max(0.42, Math.min(1.5, 0.95 / C.spd)) * (C.fly ? 1.3 : 1);
      const spawn = this.spawnGroups.length > 1 && rng.next() < 0.35 ? -1 : rng.int(0, this.spawnGroups.length - 1);
      groups.push({ id, n, gap, delay, spawn });
      delay += n * gap * (rng.next() < 0.5 ? 0.45 : 0.8) + 1.2;
    });
    if (spill >= 2) {
      const id = avail.indexOf('calf') >= 0 && rng.next() < 0.5 ? 'calf' : 'huang', C = D.cows[id];
      const n = Math.min(36, Math.round(spill / C.pts));
      groups.push({ id, n, gap: Math.max(0.42, 0.95 / C.spd), delay: delay * 0.5, spawn: rng.int(0, this.spawnGroups.length - 1) });
    }
    for (const b of bosses) { groups.push({ id: b, n: 1, gap: 1, delay: delay + 1.5, spawn: rng.int(0, this.spawnGroups.length - 1), boss: true }); delay += 3; }
    const w = { k, groups, hpMul: this.hpMul(k), boss: bosses.length ? bosses[bosses.length - 1] : null };
    this.waveCache[k] = w;
    return w;
  };
  P.canCall = function () { return !this.over && (this.k === 0 || (this.nextT > 0 && this.k < this.N)); };
  P.callWave = function () {
    if (!this.canCall()) return { ok: false };
    let bonus = 0;
    if (this.k > 0 && this.nextT > 0) { bonus = Math.floor(this.nextT * 1.5); this.gold += bonus; this.stats.earned += bonus; this.stats.calls++; }
    this.launch();
    return { ok: true, bonus };
  };
  P.launch = function () {
    this.k++;
    const w = this.genWave(this.k);
    let last = 0;
    for (const g of w.groups) for (let j = 0; j < g.n; j++) {
      const at = this.t + g.delay + j * g.gap;
      const sp = g.spawn < 0 ? j % this.spawnGroups.length : g.spawn;
      this.spawnQ.push({ at, id: g.id, hpMul: w.hpMul, spawn: sp, k: this.k });
      if (at > last) last = at;
    }
    this.spawnQ.sort((a, b) => a.at - b.at);
    this.spawnEnd = last;
    this.nextT = -1;
    const tax = 10 + this.k * 3;
    this.gold += tax; this.stats.earned += tax;
    this.emit('wave', { k: this.k, boss: w.boss, tax });
  };

  /* ---------- 牛 ---------- */
  P.spawnCow = function (id, hpMul, group, k, at) {
    const C = D.cows[id], rng = this.rng;
    let cell, x, y;
    if (at) { cell = at.cell; x = at.x + rng.range(-0.25, 0.25); y = at.y + rng.range(-0.25, 0.25); }
    else { const g = this.spawnGroups[group % this.spawnGroups.length]; cell = rng.pick(g); x = cell % this.cols + 0.5 - 0.35; y = ((cell / this.cols) | 0) + 0.5; }
    // BOSS 的血量跟波次缩放得慢一些（^0.65），不然最后一波的牛魔王会有四五万血
    const hp = Math.max(1, Math.round(C.hp * (C.boss ? Math.pow(hpMul, 0.65) : hpMul)));
    const c = {
      uid: this.uid++, id, def: C, x, y, cell, tc: -1, hp, maxHp: hp, alive: true, fly: !!C.fly, boss: !!C.boss,
      spd: C.spd, siege: C.siege * (1 + 0.05 * (k - 1)), bounty: Math.round(C.gold * (1 + 0.05 * (k - 1))), k,
      dir: 1, walk: rng.next() * 10, moving: false, flash: 0, stun: 0, eat: 0, slowT: 0, slowMul: 1,
      burnT: 0, burnDps: 0, poiT: 0, poiDps: 0, chargeT: 0, frozen: 0, calm: false, enraged: false, ram: 0,
      jx: rng.range(-0.16, 0.16), jy: rng.range(-0.14, 0.14), born: this.t, sk: {}
    };
    if (C.sk) for (const s in C.sk) c.sk[s] = (C.sk[s].cd || 0) * rng.range(0.5, 1);
    if (c.fly) { c.gx = this.gate.x; c.gy = this.gate.y + rng.range(-1.2, 1.2); }
    this.cows.push(c);
    if (C.boss) this.emit('boss', { c });
    return c;
  };
  P.hurt = function (c, dmg, type, o) {
    if (!c.alive || dmg <= 0) return 0;
    o = o || {};
    const C = c.def;
    const m = C.res && C.res[type] != null ? C.res[type] : 1;
    if (m <= 0) { if (!o.dot) this.fx.push({ k: 'immune', x: c.x, y: c.y, t: 0, T: 0.6 }); return 0; }
    let d = dmg * m;
    if (type === 'phys' && C.armor && !o.pierce) d = Math.max(d * 0.2, d - C.armor);
    c.hp -= d; this.stats.dmg += d;
    if (!o.dot) c.flash = 0.07;
    if (o.src) o.src.dmgDealt += d;
    if (c.hp <= 0) this.kill(c, o.src);
    return d;
  };
  P.kill = function (c, src) {
    c.alive = false; c.hp = 0;
    this.gold += c.bounty; this.stats.earned += c.bounty; this.stats.kills++;
    if (c.boss) this.stats.bossKills++;
    if (src) src.kills++;
    if (this.focus === c.uid) this.focus = 0;
    this.fx.push({ k: 'die', id: c.id, x: c.x + c.jx, y: c.y + c.jy, dir: c.dir, fly: c.fly, t: 0, T: c.boss ? 1.6 : 0.9, gold: c.bounty, boss: c.boss });
    const B = c.def.sk && c.def.sk.burst;
    if (B) {
      this.fx.push({ k: 'boom', x: c.x, y: c.y, r: B.r, t: 0, T: 0.5, fire: true });
      const dmg = B.dmg * (1 + 0.05 * (c.k - 1));
      for (const b of this.blds.slice()) if (b.block && Math.hypot(b.x + 0.5 - c.x, b.y + 0.5 - c.y) <= B.r) this.hurtB(b, dmg, c);
      this.emit('burst', { c });
    }
    this.emit('kill', { c });
  };
  P.leak = function (c) {
    c.alive = false; c.leaked = true;
    this.hp = Math.max(0, this.hp - c.def.pow);
    this.stats.leaks++;
    this.fx.push({ k: 'gate', x: c.x, y: c.y, t: 0, T: 0.6, pow: c.def.pow });
    this.emit('leak', { c });
    if (this.hp <= 0 && !this.over) { this.over = true; this.win = false; this.emit('lose', {}); }
  };
  P.cowSkills = function (c, dt) {
    const S = c.def.sk; if (!S) return;
    if (S.heal) {
      if ((c.sk.heal -= dt) <= 0) {
        c.sk.heal = S.heal.cd;
        let any = false, stood = false;
        for (const o of this.cows) {
          if (!o.alive || o === c) continue;
          if (Math.hypot(o.x - c.x, o.y - c.y) > S.heal.r) continue;
          if (o.def.sk && o.def.sk.trip && !o.stood) { o.stood = true; if (!stood) { stood = true; this.fx.push({ k: 'say', x: o.x, y: o.y, txt: '站起来了！', t: 0, T: 1.6 }); } }
          if (o.hp >= o.maxHp) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * S.heal.pct * (o.boss ? 0.2 : 1)); any = true;
          this.fx.push({ k: 'heal', x: o.x, y: o.y, t: 0, T: 0.7 });
        }
        if (any) { this.fx.push({ k: 'ring', c: '#7dff9a', x: c.x, y: c.y, r: S.heal.r, t: 0, T: 0.6 }); this.emit('heal', { c }); }
      }
    }
    if (S.trip) {                  // 牛来：被石头绊倒（站起来之后就不摔了）
      if (c.trip > 0) c.trip -= dt;
      else if ((c.sk.trip -= dt) <= 0) {
        c.sk.trip = S.trip.cd;
        if (c.moving && !c.stood && c.ram <= 0 && this.rng.next() < S.trip.p) {
          c.trip = S.trip.t; c.stun = Math.max(c.stun, S.trip.t);
          if (this.t - this.sayTrip > 3) { this.sayTrip = this.t; this.fx.push({ k: 'say', x: c.x, y: c.y, txt: '被石头绊倒了', t: 0, T: 1.3 }); }
          this.emit('trip', { c });
        }
      }
    }
    if (S.charge) {
      if (c.chargeT > 0) c.chargeT -= dt;
      else if ((c.sk.charge -= dt) <= 0 && c.moving) { c.sk.charge = S.charge.cd; c.chargeT = S.charge.t; c.chargeHit = false; this.emit('charge', { c }); }
    }
    if (S.ring) {
      if ((c.sk.ring -= dt) <= 0) {
        let best = null, bs = -1;
        for (const b of this.blds) {
          if (b.kind !== 'tower' || b.dis > 0) continue;
          const d = Math.hypot(b.x + 0.5 - c.x, b.y + 0.5 - c.y); if (d > S.ring.r) continue;
          const s = b.lv * 10 - d; if (s > bs) { bs = s; best = b; }
        }
        if (best) {
          best.dis = S.ring.t; best.disK = 'ring'; c.sk.ring = S.ring.cd;
          this.fx.push({ k: 'ringThrow', x: c.x, y: c.y, x2: best.x + 0.5, y2: best.y + 0.5, t: 0, T: 0.5 });
          this.emit('ring', { c, b: best });
        } else c.sk.ring = 1;
      }
    }
    if (S.stomp) {
      if ((c.sk.stomp -= dt) <= 0) {
        c.sk.stomp = S.stomp.cd;
        for (const b of this.blds.slice()) {
          const d = Math.hypot(b.x + 0.5 - c.x, b.y + 0.5 - c.y);
          if (b.kind === 'tower' && d <= S.stomp.r) { b.dis = Math.max(b.dis, S.stomp.t); b.disK = 'stun'; }
          if (b.block && d <= 1.45) this.hurtB(b, S.stomp.dmg, c);
        }
        this.fx.push({ k: 'quake', x: c.x, y: c.y, r: S.stomp.r, t: 0, T: 0.7 });
        this.emit('stomp', { c });
      }
    }
    if (S.summon) {
      if ((c.sk.summon -= dt) <= 0) {
        c.sk.summon = S.summon.cd;
        const at = { cell: c.cell, x: c.x, y: c.y };
        for (let j = 0; j < 3; j++) this.spawnCow('calf', c.maxHp / c.def.hp * 0.55, 0, c.k, at);
        this.spawnCow('douniu', c.maxHp / c.def.hp * 0.45, 0, c.k, at);
        this.fx.push({ k: 'ring', c: '#ff5a3a', x: c.x, y: c.y, r: 1.4, t: 0, T: 0.7 });
        this.emit('summon', { c });
      }
    }
    if (S.enrage && !c.enraged && c.hp < c.maxHp * S.enrage) { c.enraged = true; this.fx.push({ k: 'ring', c: '#ff2a2a', x: c.x, y: c.y, r: 1.8, t: 0, T: 0.9 }); this.emit('enrage', { c }); }
  };
  P.updCow = function (c, dt) {
    const C = c.def;
    if (c.flash > 0) c.flash -= dt;
    if (c.burnT > 0) { c.burnT -= dt; this.hurt(c, c.burnDps * dt, 'fire', { dot: true, src: c.burnSrc }); if (!c.alive) return; }
    if (c.poiT > 0) { c.poiT -= dt; this.hurt(c, c.poiDps * dt, 'poison', { dot: true, src: c.poiSrc }); if (!c.alive) return; }
    if (c.slowT > 0) { c.slowT -= dt; if (c.slowT <= 0) c.slowMul = 1; }
    if (c.frozen > 0) c.frozen -= dt;
    this.cowSkills(c, dt);
    if (c.stun > 0) { c.stun -= dt; c.moving = false; return; }
    if (c.eat > 0) { c.eat -= dt; c.moving = false; return; }
    let calm = 0;
    if (!c.fly && this.calmers.length) for (const s of this.calmers) if (Math.hypot(s.x + 0.5 - c.x, s.y + 0.5 - c.y) <= D.statues.niulang.r) { calm = c.boss ? 0.5 : 1; break; }
    c.calm = calm > 0;
    let spd = c.spd * c.slowMul * (1 - D.statues.niulang.calm * calm);
    if (c.chargeT > 0) spd *= C.sk.charge.mul;
    if (c.enraged) spd *= 1.5;
    if (c.fly) {
      const dx = c.gx - c.x, dy = c.gy - c.y, d = Math.hypot(dx, dy), st = spd * dt;
      c.dir = dx >= 0 ? 1 : -1; c.moving = true; c.walk += st;
      if (d <= st) { this.leak(c); return; }
      c.x += dx / d * st; c.y += dy / d * st;
      return;
    }
    const F = C.siegeAI ? this.fS : this.fN;
    if (c.tc >= 0 && c.ram > 0 && F.nxt[c.cell] !== c.tc && F.nxt[c.cell] >= 0) c.tc = F.nxt[c.cell];   // 撞到一半有了更好的路
    if (c.tc < 0) {
      if (this.ter[c.cell] === T_GOAL) { this.leak(c); return; }
      const nx = F.nxt[c.cell];
      if (nx < 0) { c.moving = false; return; }
      c.tc = nx;
    }
    const tx = c.tc % this.cols + 0.5, ty = ((c.tc / this.cols) | 0) + 0.5;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    if (dx > 0.02) c.dir = 1; else if (dx < -0.02) c.dir = -1;
    const b = this.occ[c.tc];
    if (b && b.block) {
      if (d <= RAM_DIST + 1e-3) {
        c.moving = false; c.ram += dt;
        let dmg = c.siege * dt * (1 - D.statues.niulang.calmSiege * calm) * (c.enraged ? 1.5 : 1);
        if (c.chargeT > 0 && !c.chargeHit) { dmg += c.siege * C.sk.charge.ram; c.chargeHit = true; this.fx.push({ k: 'bump', x: (c.x + tx) / 2, y: (c.y + ty) / 2, t: 0, T: 0.4, big: true }); }
        if ((c.bumpT = (c.bumpT || 0) - dt) <= 0) { c.bumpT = 0.55; this.fx.push({ k: 'bump', x: (c.x * 0.4 + tx * 0.6), y: (c.y * 0.4 + ty * 0.6), t: 0, T: 0.35 }); this.emit('ram', { c, b }); }
        this.hurtB(b, dmg, c);
        return;
      }
      const st = Math.min(spd * dt, d - RAM_DIST);
      c.x += dx / d * st; c.y += dy / d * st; c.walk += st; c.moving = true;
      return;
    }
    c.ram = 0;
    const st = spd * dt;
    c.moving = true;
    if (st >= d) {
      c.x = tx; c.y = ty; c.cell = c.tc; c.tc = -1; c.walk += d;
      const h = this.occ[c.cell];
      if (h && h.kind === 'hay' && !c.boss && c.ateHay !== h.id) {
        c.eat = D.hay.eat; c.ateHay = h.id; h.bites--;
        this.fx.push({ k: 'munch', x: c.x, y: c.y, t: 0, T: D.hay.eat });
        this.emit('eat', { c });
        if (h.bites <= 0) this.removeB(h);
      }
    } else { c.x += dx / d * st; c.y += dy / d * st; c.walk += st; }
  };
  // 离城门还有多远（塔选「最前」用）
  P.progress = function (c) {
    if (c.fly) return Math.hypot(c.gx - c.x, c.gy - c.y);
    const F = c.def.siegeAI ? this.fS : this.fN;
    if (c.tc >= 0) { const d = F.dist[c.tc]; return (isFinite(d) ? d : 999) + Math.hypot(c.tc % this.cols + 0.5 - c.x, ((c.tc / this.cols) | 0) + 0.5 - c.y); }
    const d = F.dist[c.cell]; return isFinite(d) ? d : 999;
  };

  /* ---------- 塔 ---------- */
  P.targets = function (b, R, ground, n) {
    const cx = b.x + 0.5, cy = b.y + 0.5, list = [];
    let focus = null;
    for (const c of this.cows) {
      if (!c.alive || (ground && c.fly)) continue;
      const d = Math.hypot(c.x - cx, c.y - cy); if (d > R) continue;
      if (c.uid === this.focus) focus = c;
      list.push({ c, d });
    }
    if (!list.length) return list;
    const m = b.mode;
    let key;
    if (m === 'strong') key = e => -e.c.hp;
    else if (m === 'weak') key = e => e.c.hp;
    else if (m === 'close') key = e => e.d;
    else key = e => this.progress(e.c);
    for (const e of list) e.s = e.c === focus ? -1e9 : key(e);
    list.sort((a, b2) => a.s - b2.s);
    return list.slice(0, n || 1).map(e => e.c);
  };
  P.updTower = function (b, dt) {
    if (b.fireT > 0) b.fireT -= dt;
    if (b.hit > 0) b.hit -= dt;
    if (b.dis > 0) { b.dis -= dt; return; }
    b.cd -= dt * b.aura.spd;
    if (b.cd > 0) return;
    const T = D.towers[b.type], li = b.lv - 1, R = T.rng[li] * b.aura.rng;
    const tg = this.targets(b, R, T.ground, T.multi || 1);
    if (!tg.length) { b.cd = 0; return; }
    b.cd = T.cd[li];
    b.fireT = 0.18;
    const ox = b.x + 0.5, oy = b.y + 0.5, dmg = T.dmg[li];
    b.ang = Math.atan2(tg[0].y - oy, tg[0].x - ox);
    const base = { src: b, x: ox, y: oy, z: 0.9, t: 0, type: T.type, tower: b.type, lv: b.lv };
    switch (T.proj) {
      case 'arrow':
        this.proj.push(Object.assign({}, base, { k: 'arrow', tgt: tg[0], spd: 10, dmg })); break;
      case 'bolt':
        for (const c of tg) this.proj.push(Object.assign({}, base, { k: 'bolt', tgt: c, spd: 9, dmg: dmg * (c.fly ? T.airMul : 1) }));
        break;
      case 'shell': {
        const c = tg[0], d = Math.hypot(c.x - ox, c.y - oy);
        const T0 = 0.45 + d * 0.09;
        // 预判：按牛当前朝向和速度往前估一点
        let px = c.x, py = c.y;
        if (c.moving && c.tc >= 0) { const tx = c.tc % this.cols + 0.5, ty = ((c.tc / this.cols) | 0) + 0.5, dd = Math.hypot(tx - c.x, ty - c.y) || 1, lead = Math.min(dd, c.spd * c.slowMul * T0 * 0.8); px += (tx - c.x) / dd * lead; py += (ty - c.y) / dd * lead; }
        this.proj.push(Object.assign({}, base, { k: 'shell', sx: ox, sy: oy, tx: px, ty: py, T: T0, dmg, r: T.splash[li], z: 1.1 }));
        break;
      }
      case 'ice':
        this.proj.push(Object.assign({}, base, { k: 'ice', tgt: tg[0], spd: 7.5, dmg, r: T.splash[li], slow: T.slow[li] })); break;
      case 'fire':
        this.proj.push(Object.assign({}, base, { k: 'fire', tgt: tg[0], spd: 8, dmg, burn: T.burn[li] })); break;
      case 'poison':
        this.proj.push(Object.assign({}, base, { k: 'poison', tgt: tg[0], spd: 6.5, dmg, pdps: T.pdps[li], ppct: T.ppct[li] })); break;
      case 'beam': {
        const c = tg[0], ang = Math.atan2(c.y - oy, c.x - ox), L = R * 1.08;
        const ux = Math.cos(ang), uy = Math.sin(ang), hits = [];
        for (const o of this.cows) {
          if (!o.alive) continue;
          const px = o.x - ox, py = o.y - oy, s = px * ux + py * uy;
          if (s < 0 || s > L) continue;
          if (Math.abs(px * uy - py * ux) > 0.45) continue;
          hits.push({ o, s });
        }
        hits.sort((a, b2) => a.s - b2.s);
        for (const h of hits.slice(0, 10)) this.hurt(h.o, dmg, 'phys', { src: b, pierce: true });
        this.fx.push({ k: 'beam', x: ox, y: oy, x2: ox + ux * L, y2: oy + uy * L, t: 0, T: 0.35 });
        break;
      }
      case 'chain': {
        const pts = [{ x: ox, y: oy, z: 1.05 }], hit = new Set();
        let cur = tg[0], d = dmg;
        for (let j = 0; j < T.jumps[li] && cur; j++) {
          hit.add(cur.uid); pts.push({ x: cur.x + cur.jx, y: cur.y + cur.jy, z: cur.fly ? 0.9 : 0.3 });
          this.hurt(cur, d, 'elec', { src: b });
          d *= 0.82;
          let nb = null, nd = 1.8;
          for (const o of this.cows) { if (!o.alive || hit.has(o.uid)) continue; const dd = Math.hypot(o.x - cur.x, o.y - cur.y); if (dd < nd) { nd = dd; nb = o; } }
          cur = nb;
        }
        this.fx.push({ k: 'chain', pts, t: 0, T: 0.28 });
        break;
      }
    }
    this.emit('shoot', { b });
  };
  P.splash = function (x, y, r, dmg, type, src, ground, fn) {
    for (const c of this.cows) {
      if (!c.alive || (ground && c.fly)) continue;
      if (Math.hypot(c.x - x, c.y - y) > r) continue;
      this.hurt(c, dmg, type, { src });
      if (fn && c.alive) fn(c);
    }
  };
  P.impact = function (p, c) {
    const src = p.src;
    switch (p.k) {
      case 'arrow': case 'bolt':
        if (c) this.hurt(c, p.dmg, 'phys', { src });
        this.fx.push({ k: 'hit', x: p.x, y: p.y, z: p.z, t: 0, T: 0.2, c: p.k === 'arrow' ? '#fff3b0' : '#ffd36b' });
        break;
      case 'shell':
        this.splash(p.x, p.y, p.r, p.dmg, 'phys', src, true);
        this.fx.push({ k: 'boom', x: p.x, y: p.y, r: p.r, t: 0, T: 0.45 });
        this.emit('boom', {});
        break;
      case 'ice':
        this.splash(p.x, p.y, p.r, p.dmg, 'ice', src, false, o => {
          const m = 1 - p.slow * (1 - (o.def.slowRes || 0));
          if (m <= o.slowMul || o.slowT <= 0) o.slowMul = m;       // 强的减速覆盖弱的
          o.slowT = 2;
        });
        this.fx.push({ k: 'frost', x: p.x, y: p.y, z: p.z, r: p.r, t: 0, T: 0.4 });
        break;
      case 'fire':
        if (c) {
          this.hurt(c, p.dmg, 'fire', { src });
          if (c.alive && !(c.def.res && c.def.res.fire === 0)) { if (p.burn >= c.burnDps || c.burnT < 0.5) { c.burnDps = p.burn; c.burnSrc = src; } c.burnT = 3; }
        }
        this.fx.push({ k: 'hit', x: p.x, y: p.y, z: p.z, t: 0, T: 0.3, c: '#ff8a2a', big: true });
        break;
      case 'poison':
        if (c) {
          this.hurt(c, p.dmg, 'poison', { src });
          if (c.alive) {
            const dps = p.pdps + c.maxHp * p.ppct * (c.boss ? 1 / 3 : 1);
            if (dps >= c.poiDps || c.poiT < 0.5) { c.poiDps = dps; c.poiSrc = src; }
            c.poiT = 4;
          }
        }
        this.fx.push({ k: 'hit', x: p.x, y: p.y, z: p.z, t: 0, T: 0.35, c: '#8dff4a', big: true });
        break;
    }
  };
  P.updProj = function (p, dt) {
    p.t += dt;
    if (p.k === 'shell') {
      const k = Math.min(1, p.t / p.T);
      p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
      p.z = 1.1 * (1 - k) + 0.1 * k + Math.sin(k * Math.PI) * 1.4;
      if (k >= 1) { this.impact(p, null); return false; }
      return true;
    }
    const c = p.tgt;
    if (c && c.alive) { p.lx = c.x + c.jx; p.ly = c.y + c.jy; p.lz = c.fly ? 0.95 : 0.35; }
    if (p.lx == null) return false;
    const dx = p.lx - p.x, dy = p.ly - p.y, d = Math.hypot(dx, dy), st = p.spd * dt;
    p.ang = Math.atan2(dy, dx);
    if (d <= st) { p.x = p.lx; p.y = p.ly; p.z = p.lz; this.impact(p, c && c.alive ? c : null); return false; }
    p.x += dx / d * st; p.y += dy / d * st;
    p.z += (p.lz - p.z) * Math.min(1, st / Math.max(d, 0.01));
    return true;
  };

  /* ---------- 城主技能 ---------- */
  P.skillReady = function (id) { return this.isUnlocked(id) && this.skillCd[id] <= 0 && !this.over; };
  P.useSkill = function (id, arg) {
    if (!this.isUnlocked(id)) return { ok: false, msg: '还没解锁' };
    if (this.skillCd[id] > 0) return { ok: false, msg: '冷却中' };
    if (this.over) return { ok: false };
    const S = D.skills[id], k = Math.max(1, this.k);
    if (id === 'gunmu') {
      const row = Math.max(0, Math.min(this.rows - 1, arg | 0));
      this.rollers.push({ row, x: this.cols + 0.8, spd: 7.5, hit: new Set(), dmg: 70 + 22 * k, t: 0 });
    } else if (id === 'freeze') {
      for (const c of this.cows) if (c.alive) { const t = c.boss ? 1 : 2.5; c.stun = Math.max(c.stun, t); c.frozen = t; }
      this.fx.push({ k: 'freezeAll', t: 0, T: 1.2 });
    } else if (id === 'repair') {
      for (const b of this.blds) if (b.kind !== 'hay') { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.5); this.fx.push({ k: 'heal', x: b.x + 0.5, y: b.y + 0.5, t: 0, T: 0.8, b: true }); }
      this.hp = Math.min(this.maxHp, this.hp + 1); if (!this.hpDirty) this.hpDirty = 1e-6;
    } else return { ok: false };
    this.skillCd[id] = S.cd;
    this.emit('skill', { id });
    return { ok: true };
  };
  P.updRoller = function (r, dt) {
    r.x -= r.spd * dt; r.t += dt;
    for (const c of this.cows) {
      if (!c.alive || c.fly || r.hit.has(c.uid)) continue;
      if (Math.abs(c.y - (r.row + 0.5)) > 0.75) continue;
      if (c.x < r.x - 0.45 || c.x > r.x + 0.6) continue;
      r.hit.add(c.uid);
      this.hurt(c, r.dmg, 'phys', { pierce: true });
      if (c.alive) c.stun = Math.max(c.stun, 1);
      this.fx.push({ k: 'bump', x: c.x, y: c.y, t: 0, T: 0.35 });
    }
    return r.x > -1.5;
  };

  /* ---------- 主循环 ---------- */
  P.update = function (dt) {
    if (this.over) { this.t += dt; this.updFx(dt); return; }
    this.t += dt;
    for (const s in this.skillCd) if (this.skillCd[s] > 0) this.skillCd[s] = Math.max(0, this.skillCd[s] - dt);
    // 出牛
    while (this.spawnQ.length && this.spawnQ[0].at <= this.t) {
      const q = this.spawnQ.shift();
      this.spawnCow(q.id, q.hpMul, q.spawn, q.k);
    }
    // 下一波倒计时
    if (this.k > 0 && this.k < this.N) {
      if (this.nextT < 0 && !this.spawnQ.length) this.nextT = this.L.gap || (this.k < 3 ? 22 : 18);
      if (this.nextT > 0) { this.nextT -= dt; if (this.nextT <= 0) { this.nextT = -1; this.launch(); } }
    }
    // 流场
    if (this.hpDirty) this.hpDirty += dt;
    if (this.dirty || this.hpDirty > 0.3) this.refresh();
    // 牛
    for (const c of this.cows) if (c.alive) this.updCow(c, dt);
    // 塔
    for (const b of this.blds) if (b.kind === 'tower') this.updTower(b, dt);
    else if (b.hit > 0) b.hit -= dt;
    // 弹道 / 滚木
    this.proj = this.proj.filter(p => this.updProj(p, dt));
    this.rollers = this.rollers.filter(r => this.updRoller(r, dt));
    this.updFx(dt);
    // 清理
    this.cows = this.cows.filter(c => c.alive);
    // 胜负
    if (!this.over && this.k >= this.N && !this.spawnQ.length && !this.cows.some(c => c.alive)) {
      this.over = true; this.win = true;
      this.emit('win', { stars: this.stars() });
    }
  };
  P.updFx = function (dt) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.T);
  };
  P.stars = function () {
    if (!this.win) return 0;
    const r = this.hp / this.maxHp;
    return r >= 0.9 ? 3 : r >= 0.5 ? 2 : 1;
  };
  P.aliveCount = function () { let n = 0; for (const c of this.cows) if (c.alive) n++; return n; };
  P.drain = function () { const e = this.ev; this.ev = []; return e; };
})(typeof window !== 'undefined' ? window : globalThis);
