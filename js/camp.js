/* ============================================================
 * 狼队训练营 & 竞技场（逻辑）
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D, G = SV.Game;

  /* ---------- 狼卡 ---------- */
  SV.CARDS = [
    { id: 'al_B', base: 90, spdK: 1.0, nat: {}, desc: '初始狼卡：会一点魔法的阿呆。', get: '初始赠送' },
    { id: 'tufeil', base: 140, spdK: 1.05, nat: { armor: 1 }, desc: '土匪出身，皮糙肉厚。', get: '通关菲洛克村 / 商店' },
    { id: 'renzhel', base: 170, spdK: 1.1, nat: { divide: 1 }, desc: '忍者：分身干扰火力，免疫闪电。', get: '通关拉帕斯村', immune: { light: 1 } },
    { id: 'hushil', base: 150, spdK: 0.95, nat: { heal: 1 }, fly: true, desc: '空中护士：群疗队友，偷家能手。', get: '通关拉卡维村' },
    { id: 'jiangshil', base: 200, spdK: 0.7, nat: { revive: 1 }, desc: '僵尸：死后满血站起来。', get: '通关赤火地带' },
    { id: 'tanhuangl', base: 170, spdK: 1.0, nat: { blink: 1 }, desc: '弹簧狼：闪烁向前。', get: '通关虎克工厂' },
    { id: 'daomu3', base: 260, spdK: 1.1, nat: { sprint: 2 }, desc: '盗墓老三：战斗力极高，狂奔突击。', get: '商店 145 积分 / 竞技场' },
    { id: 'fzswr', base: 300, spdK: 1.0, nat: { shield: 1 }, fly: true, desc: '飞贼沙维尔：空中贵族，偷家王。', get: '商店 210 积分' },
    { id: 'xuel_B', base: 230, spdK: 1.2, nat: { sprint: 1 }, desc: '雪狼：0 氪最强狼卡之一。', get: '通关生命森林之前的隐藏奖励' },
    { id: 'yangpil_A', base: 240, spdK: 1.05, nat: { armor: 2 }, desc: '羊皮狼：披着羊皮的重装肉盾。', get: '商店 90 积分' },
    { id: 'daomu6', base: 250, spdK: 0.95, nat: {}, fly: true, desc: '天空萝莉：空狼中的萝莉，容易偷家。', get: '竞技场翻牌' },
    { id: 'liyuqil', base: 130, spdK: 0.9, nat: {}, fly: true, desc: '鲤鱼旗狼：可爱的飞行狼。', get: '竞技场翻牌' }
  ];
  const CARD = {}; SV.CARDS.forEach(c => CARD[c.id] = c);
  SV.CARD = CARD;
  G.SHARDS_NEED = 10;

  /* ---------- 技能 ---------- */
  SV.WSKILLS = {
    sprint: { n: '狂奔', ic: '💨', d: '周期性冲刺加速' },
    shield: { n: '护盾', ic: '🛡', d: '周期性获得吸收伤害的护盾' },
    invisible: { n: '隐身', ic: '👻', d: '周期性隐身，多数塔无法锁定（光/波动可见）' },
    revive: { n: '重生', ic: '💚', d: '死亡后带血复活一次' },
    heal: { n: '群疗', ic: '💗', d: '治疗周围的队友' },
    blink: { n: '闪烁', ic: '✨', d: '瞬移向前跳过一段路' },
    summon: { n: '召唤', ic: '📯', d: '召唤小狼分担火力' },
    divide: { n: '分身', ic: '👥', d: '制造分身，分摊火力' },
    cloud: { n: '乌云', ic: '🌩', d: '瘫痪周围的塔' },
    armor: { n: '钢皮', ic: '🧱', d: '减免受到的直接伤害' },
    burst: { n: '自爆', ic: '💣', d: '死亡时炸晕周围的塔' }
  };
  SV.SKILL_TIERS = ['初级', '中级', '高级', '超级'];
  G.skillCost = (sk, lv) => Math.floor(1500 * lv * lv * (sk === 'cloud' || sk === 'summon' ? 1.6 : 1));
  G.SLOTS = 3;

  /* ---------- 狼卡成长 ---------- */
  G.wolfExpNeed = lv => Math.floor(60 * Math.pow(lv, 1.5));
  G.WOLF_MAX = 50;
  G.wolfOwned = id => G.save.wolves.owned[id] || null;
  G.wolfStats = function (id, rec) {
    rec = rec || G.wolfOwned(id) || { lv: 1, sk: [] };
    const card = CARD[id], base = SV.wolfDef(id);
    const lv = rec.lv;
    const sk = Object.assign({}, card.nat);
    for (const s of rec.sk || []) if (s) sk[s.id] = Math.max(sk[s.id] || 0, s.lv);
    const hp = Math.floor(card.base * (40 + 45 * lv) * (1 + 0.02 * lv));
    const def = Object.assign({}, base, { sk: Object.assign({}, base.sk, sk), res: Object.assign({}, base.res, card.immune || {}), speed: base.speed * (card.spdK || 1), boss: false, fixed: false });
    if (card.fly) def.fly = 1;
    let power = hp * 0.12;
    for (const k in sk) power += 260 * sk[k] * sk[k] + 400;
    power *= (card.fly ? 1.25 : 1);
    return { hp, def, power: Math.floor(power), sk, lv };
  };
  G.teamPower = function () {
    const s = G.save, ps = s.wolves.team.map(id => G.wolfOwned(id) && G.wolfStats(id).power).filter(Boolean).sort((a, b) => b - a);
    let t = 0; ps.forEach((p, i) => t += p * (i === 0 ? 1 : i === 1 ? 0.6 : 0.4));
    return Math.floor(t);
  };
  G.addWolfExp = function (id, n) {
    const rec = G.wolfOwned(id); if (!rec) return 0; let up = 0;
    if (rec.lv >= G.WOLF_MAX) return 0;
    rec.exp += n;
    while (rec.lv < G.WOLF_MAX && rec.exp >= G.wolfExpNeed(rec.lv)) { rec.exp -= G.wolfExpNeed(rec.lv); rec.lv++; up++; }
    return up;
  };
  G.tryUnlockWolves = function () {
    const w = G.save.wolves;
    for (const id in w.shards) if (w.shards[id] >= G.SHARDS_NEED && !w.owned[id] && CARD[id]) { w.owned[id] = { lv: 1, exp: 0, sk: [] }; w.shards[id] -= G.SHARDS_NEED; G.emit('wolfUnlocked', id); }
  };
  const _give = G.giveLoot;
  G.giveLoot = function (l, q) { _give(l, q); if (l.type === 'wolfShard') G.tryUnlockWolves(); };
  G.learnSkill = function (id, slot, skill, lv) {
    const rec = G.wolfOwned(id); if (!rec) return false;
    const cur = rec.sk[slot];
    const cost = G.skillCost(skill, lv) - (cur && cur.id === skill ? G.skillCost(skill, cur.lv) : 0);
    if (G.save.silver < cost) return false;
    G.save.silver -= cost; rec.sk[slot] = { id: skill, lv }; G.persist(); return true;
  };
  G.forgetSkill = function (id, slot) { const rec = G.wolfOwned(id); if (!rec) return; const cur = rec.sk[slot]; if (cur) { G.save.silver += Math.floor(G.skillCost(cur.id, cur.lv) * 0.5); rec.sk[slot] = null; G.persist(); } };
  G.setTeam = function (ids) { G.save.wolves.team = ids.slice(0, 3); G.persist(); };

  /* ---------- 竞技场 ---------- */
  const A = SV.ArenaLogic = {};
  A.mapPool = function () {
    if (A._pool) return A._pool;
    return A._pool = D.maps.map((m, i) => i).filter(i => {
      const m = new SV.MapModel(i);
      return i <= 30 && m.hazards.length === 0 && Object.keys(m.teleIn).length === 0 && m.spawns.length >= 1 && m.spawns.length <= 2 && m.goals.length === 1 && m.cols * m.rows >= 60 && !m.belt.some(Boolean);
    });
  };
  const NAMES = ['咩咩', '沸沸', '懒懒', '暖暖', '美美', '慢慢', '红红', '灰灰', '小小', '大大', '呆呆', '萌萌'];
  const NAMES2 = ['村长', '守卫', '牧羊人', '猎手', '工匠', '大师', '战神', '塔王'];
  A.teamSig = function () { return G.save.wolves.team.filter(id => G.wolfOwned(id)).join('|'); };
  A.defPower = S => Math.round(S / 9);
  /* 用 S 银币在指定地图上建防线并让狼队冲一次（60Hz 定步长，与界面一致 => 结果可复现）*/
  A.simulate = function (mapIdx, S, teamIds, seed) {
    const B = A.setup({ map: mapIdx, S, power: A.defPower(S), seed }, teamIds);
    let c = 0; while (!B.over && c++ < 14400) B.update(1 / 60);
    return B;
  };
  A.wins = (mapIdx, S, teamIds, seed) => !!A.simulate(mapIdx, S, teamIds, seed).win;
  A.HI = 1.2e7;
  /* 找到"狼队刚好还能赢"的最大防线强度 S*（对该对手的固定种子）*/
  A.findLimit = function (mapIdx, teamIds, seed) {
    if (A.wins(mapIdx, A.HI, teamIds, seed)) return A.HI;
    let lo = 1200, hi = A.HI;                                   // lo 视为赢，hi 视为输
    if (!A.wins(mapIdx, lo, teamIds, seed)) return lo;
    for (let it = 0; it < 14; it++) {
      const mid = Math.sqrt(lo * hi);
      if (A.wins(mapIdx, mid, teamIds, seed)) lo = mid; else hi = mid;
      if (hi / lo < 1.06) break;
    }
    return lo;
  };
  A.FACTORS = [0.4, 0.7, 1.0, 1.5];
  A.gen = function () {
    const s = G.save, rng = new SV.RNG(Date.now() & 0xffffff);
    const team = s.wolves.team.filter(id => G.wolfOwned(id));
    const pool = A.mapPool().slice();
    const opp = [];
    for (let i = 0; i < 4; i++) {
      const map = pool.splice(rng.int(0, pool.length - 1), 1)[0];
      const seed = rng.int(1, 1e9);
      const Sstar = A.findLimit(map, team, seed);
      let S = Math.min(A.HI * 1.5, Sstar * A.FACTORS[i]);
      // 前三个保证可以赢（若不能则下调）
      if (i < 3) { let g = 0; while (g++ < 6 && !A.wins(map, S, team, seed)) S *= 0.75; }
      opp.push({ id: i, name: rng.pick(NAMES) + rng.pick(NAMES2), S, power: A.defPower(S), level: Math.max(1, Math.floor(s.level * (0.7 + i * 0.2) + rng.int(-2, 3))), map, seed, tier: i, target: [0.95, 0.75, 0.5, 0.2][i], done: false, maxed: Sstar >= A.HI });
    }
    s.arena.opp = opp; s.arena.oppDay = G.today(); s.arena.oppSig = A.teamSig();
    return opp;
  };
  A.opponents = function () {
    const s = G.save;
    if (!s.arena.opp || s.arena.oppDay !== G.today() || s.arena.oppSig !== A.teamSig()) A.gen();
    return s.arena.opp;
  };
  /* 为对手生成防线：S 为可用银币。塔位固定（贪心集合覆盖），S 只决定启用几座、每座几级，因此难度随 S 平滑单调 */
  A.pickSpots = function (B, hasAirWolf, n) {
    const cols = B.cols, path = SV.AI.pathCells(B);
    const onPath = new Set(path);
    const px = path.map(c => (c % cols) + 0.5), py = path.map(c => ((c / cols) | 0) + 0.5);
    const wt = new Float32Array(px.length).fill(1);
    const air = hasAirWolf ? SV.AI.airPoints(B) : [];
    const aw = new Float32Array(air.length).fill(1);
    const cand = [];
    for (let i = 0; i < B.occ.length; i++) {
      if (B.occ[i] || !B.map.buildableBase(i)) continue;
      if (B.map.type[i] === 1 && onPath.has(i)) continue;
      cand.push(i);
    }
    const R = 1.7, out = [];
    for (let k = 0; k < n && cand.length; k++) {
      let bi = -1, bs = 0, bg = 0, ba = 0;
      for (let ci = 0; ci < cand.length; ci++) {
        const i = cand[ci], cx = (i % cols) + 0.5, cy = ((i / cols) | 0) + 0.5;
        let sg = 0, sa = 0;
        for (let q = 0; q < px.length; q++) if (Math.hypot(px[q] - cx, py[q] - cy) <= R) sg += wt[q];
        for (let q = 0; q < air.length; q++) if (Math.hypot(air[q][0] - cx, air[q][1] - cy) <= R * 1.15) sa += aw[q];
        const sc = sg + sa * 0.8;
        if (sc > bs) { bs = sc; bi = ci; bg = sg; ba = sa; }
      }
      if (bi < 0) break;
      const i = cand.splice(bi, 1)[0], cx = (i % cols) + 0.5, cy = ((i / cols) | 0) + 0.5;
      for (let q = 0; q < px.length; q++) if (Math.hypot(px[q] - cx, py[q] - cy) <= R) wt[q] *= 0.55;
      for (let q = 0; q < air.length; q++) if (Math.hypot(air[q][0] - cx, air[q][1] - cy) <= R * 1.15) aw[q] *= 0.55;
      out.push({ i, x: i % cols, y: (i / cols) | 0, air: ba, ground: bg });
    }
    return out;
  };
  A.buildDefense = function (B, S, seed, teamHasAir) {
    const rng = new SV.RNG(seed);
    B.silver = 1e12;
    SV.AI._B = null; SV.AI._rank = null;
    SV.AI.autoMaze(B, 24);
    const spots = A.pickSpots(B, teamHasAir, 40);
    const nUse = SV.clamp(Math.round(3 + S / 3000), 3, spots.length);
    const per = S / nUse;
    const tier = SV.clamp(1 + Math.floor(S / 90000), 1, 5);
    const pref = { sentry: [2, 1, 3, 4], scatter: [5, 1], cannon: [1, 5, 4], inlay: [0, 3, 2, 4] };
    let cnt = { sentry: 0, cannon: 0, scatter: 0, inlay: 0 };
    for (let k = 0; k < nUse; k++) {
      const sp = spots[k];
      let type = 'sentry';
      if (per >= 110000 && k % 3 !== 2) type = 'inlay';                    // 预算充足：镶嵌塔（高伤害上限）
      else if (teamHasAir && sp.air > sp.ground * 0.7 && cnt.scatter < nUse * 0.5) type = 'scatter';
      else if (k % 4 === 3 && B.mapIdx > 1) type = 'cannon';
      cnt[type]++;
      let lv = 1; const max = B.towerMax(type);
      while (lv < max && B.towerCost(type, lv + 1) <= per) lv++;
      const r = B.build('tower', sp.x, sp.y, { type, lv });
      if (r.ok) {
        const list = pref[type]; const cc = list[(cnt[type] - 1) % list.length];
        r.b.gem = { c: cc, t: SV.clamp(tier - (rng.next() < 0.3 ? 1 : 0), 1, 5) };
        r.b._sig = null;
      }
    }
    B.silver = 0;
  };
  A.setup = function (opp, teamIds) {
    const S = opp.S != null ? opp.S : 3000 + opp.power * 9;
    const B = new SV.Battle({ mapIdx: opp.map, mode: 'arena', seed: opp.seed, silver: 0, gemStock: null, lives: 99, autoWave: false });
    B.showDamage = G.save && G.save.settings.dmg;
    B.hpScale = 1;
    A.buildDefense(B, S, opp.seed, teamIds.some(id => G.wolfStats(id).def.fly));
    B.started = true; B.nextWave = null;
    B.arenaQueue = []; B.arenaSpawned = 0;
    let t = 0.5;
    teamIds.forEach((id, i) => {
      const st = G.wolfStats(id);
      B.arenaQueue.push({ t, id, def: st.def, hp: st.hp, spawn: i, slot: i });
      t += 2.8;
    });
    B.arenaTotal = teamIds.length;
    B.recalcAuras();
    return B;
  };
  A.reward = function (opp, win, B) {
    const s = G.save;
    const k = Math.max(1, opp.power / 100);
    const diffK = 0.6 + (1 - (opp.target != null ? opp.target : 0.5)) * 1.2;      // 越难奖励越高
    const out = { silver: Math.floor((600 + Math.sqrt(k) * 600 + s.level * 90) * diffK), exp: Math.floor((60 + s.level * 8 + Math.sqrt(k) * 40) * diffK), points: win ? 1 + (opp.id >= 2 ? 1 : 0) : 0, wolfExp: Math.floor((40 + s.level * 3 + Math.sqrt(k) * 15) * diffK), cards: [] };
    if (!win) { out.silver = Math.floor(out.silver * 0.4); out.exp = Math.floor(out.exp * 0.6); out.wolfExp = Math.floor(out.wolfExp * 0.7); }
    // 三张翻牌（结算时已决定）
    const rng = SV.rand;
    const pool = [];
    pool.push({ type: 'silver', n: Math.floor(out.silver * 0.8) });
    pool.push({ type: 'gem', c: rng.int(0, 5), t: Math.min(4, 1 + Math.floor(s.level / 25)), n: 1 + (rng.chance(0.3) ? 1 : 0) });
    pool.push({ type: 'points', n: 1 + rng.int(0, 2) });
    pool.push({ type: 'item', id: 'lollipop', n: 1 });
    pool.push({ type: 'wolfShard', id: rng.pick(['daomu6', 'liyuqil', 'daomu3', 'tufeil']), n: rng.int(1, 3) });
    pool.push({ type: 'gem', c: rng.int(0, 5), t: 1, n: 3 });
    out.cards = [rng.pick(pool), rng.pick(pool), rng.pick(pool)];
    out.pick = rng.int(0, 2);
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
