/* ============================================================
 * 功能系统：每日登录 / 任务 / 成就 / 矿山 / 好友(苦工·敲狼) / 商店
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D, G = SV.Game;

  /* ================= 每日重置 ================= */
  const TASK_DEFS = [
    { id: 'kill', name: '消灭狼群', unit: '只', need: L => 80 + L * 6, rw: L => [{ type: 'silver', n: 800 + L * 120 }, { type: 'exp', n: 40 + L * 6 }] },
    { id: 'clear', name: '通关任意地图', unit: '次', need: () => 1, rw: L => [{ type: 'points', n: 2 }, { type: 'gem', c: 1, t: 1, n: 2 }] },
    { id: 'build', name: '建造防御塔', unit: '座', need: L => 15 + Math.floor(L / 3), rw: L => [{ type: 'silver', n: 600 + L * 80 }] },
    { id: 'fuse', name: '合成宝石', unit: '次', need: () => 1, rw: () => [{ type: 'gem', c: 3, t: 1, n: 3 }] },
    { id: 'mine', name: '完成一次挖矿', unit: '次', need: () => 1, rw: () => [{ type: 'item', id: 'lollipop', n: 1 }, { type: 'points', n: 1 }] },
    { id: 'arena', name: '参加竞技场', unit: '场', need: () => 2, rw: L => [{ type: 'points', n: 2 }, { type: 'silver', n: 1200 + L * 100 }] },
    { id: 'whack', name: '敲打间谍狼', unit: '只', need: () => 10, rw: L => [{ type: 'silver', n: 1000 + L * 90 }, { type: 'gem', c: 2, t: 1, n: 2 }] }
  ];
  G.TASK_DEFS = TASK_DEFS;

  G._dailyReset = function () {
    const s = G.save, day = G.today();
    if (s.daily.day !== day) {
      s.daily = { day, tasks: TASK_DEFS.map(t => ({ id: t.id, prog: 0, claimed: false })) };
      s.arena.day = day; s.arena.fights = 0;
      s.friends.whack = { day, n: 0 };
      s.mineSpeed = { day, n: 0 };
      s.friends.visited = {};
    }
  };
  G._taskProgress = function (id, n) {
    if (!n) return;
    const s = G.save; G.dailyReset();
    const t = s.daily.tasks.find(x => x.id === id); if (!t) return;
    const def = TASK_DEFS.find(x => x.id === id);
    t.prog = Math.min(def.need(s.level), t.prog + n);
  };
  G.taskInfo = function (t) {
    const def = TASK_DEFS.find(x => x.id === t.id), L = G.save.level;
    return { def, need: def.need(L), rewards: def.rw(L) };
  };
  G.claimTask = function (t) {
    const inf = G.taskInfo(t);
    if (t.claimed || t.prog < inf.need) return false;
    t.claimed = true; for (const r of inf.rewards) G.giveLoot(r);
    G.persist(); return inf.rewards;
  };

  /* 救济金：银币见底时每天最多领 3 次 */
  G.reliefLeft = function () { const r = G.save.relief || (G.save.relief = { day: '', n: 0 }); if (r.day !== G.today()) { r.day = G.today(); r.n = 0; } return 3 - r.n; };
  G.reliefNeeded = () => G.save.silver < 1500;
  G.claimRelief = function () {
    if (!G.reliefNeeded() || G.reliefLeft() <= 0) return false;
    G.save.relief.n++; G.addSilver(2500 + G.save.level * 60); G.persist(true); return true;
  };

  /* 每日登录 */
  G.LOGIN_REWARDS = [
    L => [{ type: 'silver', n: 2000 + L * 100 }],
    () => [{ type: 'gem', c: 1, t: 1, n: 3 }, { type: 'gem', c: 4, t: 1, n: 3 }],
    () => [{ type: 'item', id: 'lollipop', n: 2 }],
    () => [{ type: 'points', n: 3 }],
    () => [{ type: 'gem', c: 3, t: 2, n: 2 }, { type: 'gem', c: 2, t: 2, n: 1 }],
    L => [{ type: 'silver', n: 6000 + L * 300 }, { type: 'points', n: 2 }],
    () => [{ type: 'gem', c: 5, t: 3, n: 1 }, { type: 'gem', c: 0, t: 3, n: 1 }, { type: 'item', id: 'straw', lv: 1, n: 1 }]
  ];
  G.loginPending = function () { return G.save.daily2.last !== G.today(); };
  G.claimLogin = function () {
    const s = G.save;
    if (!G.loginPending()) return null;
    const d = new Date(); const y = new Date(d.getTime() - 86400000);
    const yday = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    s.daily2.streak = (s.daily2.last === yday ? s.daily2.streak : 0) + 1;
    s.daily2.last = G.today();
    const idx = (s.daily2.streak - 1) % 7;
    const rw = G.LOGIN_REWARDS[idx](s.level);
    rw.forEach(r => G.giveLoot(r));
    G.persist(); return { idx, rw, streak: s.daily2.streak };
  };

  /* ================= 成就 ================= */
  const A = [];
  const add = (id, name, desc, get, goals, rw) => goals.forEach((g, i) => A.push({ id: id + '_' + i, group: id, name: name + ['·初级', '·中级', '·高级', '·传奇'][i], desc: desc.replace('{n}', SV.fmtFull(g)), get, goal: g, rw: rw(i) }));
  add('kill', '灭狼', '累计消灭 {n} 只狼', s => s.stats.kills, [100, 2000, 30000, 300000], i => [{ type: 'silver', n: [1000, 5000, 30000, 200000][i] }, { type: 'points', n: [1, 2, 4, 8][i] }]);
  add('clear', '通关', '累计通关 {n} 次地图', s => s.stats.clears, [1, 10, 40, 150], i => [{ type: 'gem', c: i + 1 > 5 ? 0 : i + 1, t: Math.min(4, i + 1), n: 2 }, { type: 'points', n: [1, 3, 6, 12][i] }]);
  add('map', '探索', '通关不同的地图 {n} 张', s => Object.keys(s.maps).filter(k => s.maps[k].clears > 0).length, [3, 12, 30, 45], i => [{ type: 'points', n: [2, 4, 8, 15][i] }, { type: 'item', id: 'lollipop', n: 2 }]);
  add('boss', '屠龙', '击败 {n} 只 Boss', s => s.stats.bosses, [5, 50, 300, 2000], i => [{ type: 'gem', c: 5, t: Math.min(4, i + 1), n: 1 }, { type: 'points', n: [1, 3, 6, 10][i] }]);
  add('level', '成长', '村长等级达到 {n}', s => s.level, [10, 30, 60, 100], i => [{ type: 'silver', n: [3000, 20000, 100000, 500000][i] }, { type: 'points', n: [2, 5, 10, 20][i] }]);
  add('nm', '噩梦', '噩梦模式最高坚持到第 {n} 波', s => s.stats.nmBest, [10, 30, 70, 110], i => [{ type: 'gem', c: 0, t: Math.min(4, i + 2), n: 1 }, { type: 'item', id: 'lollipop', n: 3 }]);
  add('fuse', '炼金', '合成宝石 {n} 次', s => s.stats.fuse, [3, 30, 150, 600], i => [{ type: 'points', n: [1, 2, 4, 8][i] }, { type: 'gem', c: 4, t: Math.min(4, i + 1), n: 1 }]);
  add('tower', '建筑师', '累计建造 {n} 座塔', s => s.stats.towers, [50, 500, 5000, 30000], i => [{ type: 'silver', n: [2000, 10000, 60000, 300000][i] }]);
  add('lv', '满级塔', '拥有等级达到 {n} 的塔', s => s.stats.maxTowerLv, [20, 50, 80, 100], i => [{ type: 'points', n: [1, 3, 5, 10][i] }, { type: 'gem', c: 2, t: Math.min(4, i + 1), n: 1 }]);
  add('arena', '角斗士', '竞技场获胜 {n} 场', s => s.stats.arenaWins, [1, 10, 50, 200], i => [{ type: 'points', n: [1, 3, 6, 12][i] }, { type: 'wolfShard', id: 'daomu3', n: [2, 4, 6, 10][i] }]);
  add('perfect', '完美防守', '零漏狼通关 {n} 次', s => s.stats.perfect, [1, 8, 30, 100], i => [{ type: 'gem', c: 1, t: Math.min(4, i + 1), n: 2 }, { type: 'points', n: [1, 2, 4, 8][i] }]);
  add('mine', '矿工', '完成挖矿 {n} 次', s => s.stats.mineRuns, [1, 10, 40, 150], i => [{ type: 'silver', n: [1500, 6000, 25000, 100000][i] }]);
  add('whack', '敲狼达人', '敲打间谍狼 {n} 次', s => s.stats.whacks, [30, 300, 2000, 10000], i => [{ type: 'silver', n: [1500, 8000, 40000, 200000][i] }, { type: 'points', n: [1, 2, 4, 8][i] }]);
  add('rich', '大富翁', '累计赚取银币 {n}', s => s.stats.silverEarned, [50000, 1000000, 30000000, 1000000000], i => [{ type: 'points', n: [2, 5, 10, 20][i] }, { type: 'item', id: 'straw', lv: Math.min(3, i + 1), n: 1 }]);
  G.ACH = A;
  G._checkAch = function () {
    const s = G.save;
    for (const a of A) {
      const rec = s.ach[a.id] = s.ach[a.id] || { done: false, claimed: false };
      if (!rec.done && a.get(s) >= a.goal) { rec.done = true; G.emit('achieved', a); }
    }
  };
  G.claimAch = function (a) {
    const rec = G.save.ach[a.id];
    if (!rec || !rec.done || rec.claimed) return false;
    rec.claimed = true; a.rw.forEach(r => G.giveLoot(r)); G.persist(); return a.rw;
  };
  G.achPending = function () { return A.filter(a => { const r = G.save.ach[a.id]; return r && r.done && !r.claimed; }).length; };
  G.taskPending = function () { return G.save.daily.tasks.filter(t => !t.claimed && t.prog >= G.taskInfo(t).need).length; };

  /* ================= 好友 / 苦工 / 敲狼 ================= */
  G.FRIENDS = [
    { id: 'f1', n: '咩咩村长', lv: 12, str: 28 }, { id: 'f2', n: '慢羊羊', lv: 45, str: 96 }, { id: 'f3', n: '暖羊羊', lv: 30, str: 60 },
    { id: 'f4', n: '沸羊羊', lv: 38, str: 210 }, { id: 'f5', n: '美羊羊', lv: 33, str: 72 }, { id: 'f6', n: '懒羊羊', lv: 8, str: 15 },
    { id: 'f7', n: '小肥羊', lv: 60, str: 410 }, { id: 'f8', n: '红太羊', lv: 52, str: 320 }, { id: 'f9', n: '黑毛羊', lv: 21, str: 44 }, { id: 'f10', n: '羊村小卖部', lv: 75, str: 520 }
  ];
  G.hiredStrength = function () {
    const h = G.save.friends.hired, now = Date.now(); let t = 0;
    for (const id in h) { if (h[id] > now) { const f = G.FRIENDS.find(x => x.id === id); if (f) t += f.str; } else delete h[id]; }
    return t;
  };
  G.hireCost = f => f.str * 40;
  G.hire = function (f) {
    const cost = G.hireCost(f); if (G.save.silver < cost) return false;
    const h = G.save.friends.hired; if (h[f.id] && h[f.id] > Date.now()) return false;
    G.save.silver -= cost; h[f.id] = Date.now() + 24 * 3600e3; G.persist(); return true;
  };
  G.whackLeft = () => Math.max(0, 60 - G.save.friends.whack.n);
  G.whackReward = function (f) { return Math.floor(150 + f.lv * 28 + G.save.level * 12); };

  /* ================= 矿山 ================= */
  G.mineStrength = () => 20 + G.save.level * 3 + G.hiredStrength();
  G.MINE_OPTS = [{ h: 1, n: '1 小时', k: 0.5 }, { h: 4, n: '4 小时', k: 1.4 }, { h: 12, n: '12 小时', k: 3 }];
  G.mineStart = function (h) {
    const s = G.save; if (s.mine) return false;
    s.mine = { t0: Date.now(), dur: h * 3600e3, str: G.mineStrength(), h, cut: 0 }; G.persist(); return true;
  };
  G.mineLeft = function () { const m = G.save.mine; if (!m) return 0; return Math.max(0, m.t0 + m.dur - m.cut - Date.now()); };
  G.mineSpeedUp = function () {
    const s = G.save, m = s.mine; if (!m) return false;
    if (s.mineSpeed.n >= 6) return false;
    s.mineSpeed.n++; m.cut += m.dur * 0.1; G.persist(); return true;
  };
  G.mineFinishNow = function () {
    const m = G.save.mine; if (!m) return false;
    const left = G.mineLeft(); const cost = Math.ceil(left / 3600e3 * 2);
    if (G.save.points < cost) return false;
    G.save.points -= cost; m.cut += left + 1; return true;
  };
  G.mineCollect = function () {
    const s = G.save, m = s.mine; if (!m || G.mineLeft() > 0) return null;
    const rng = SV.rand, str = m.str, out = [];
    const opt = G.MINE_OPTS.find(o => o.h === m.h) || G.MINE_OPTS[1];
    const n = Math.max(2, Math.round((3 + m.h * 1.6) * (0.85 + rng.next() * 0.3)));
    const nearBlackStr = [50, 200, 500].some(v => Math.abs(str - v) < v * 0.35 + 25) || str >= 500;
    for (let i = 0; i < n; i++) {
      let c = rng.int(0, 5);
      if (nearBlackStr && rng.next() < 0.22) c = 5;
      let cap = SV.clamp(1 + Math.floor(str / 110), 1, 4);
      let t = 1; for (let k = 1; k < cap; k++) if (rng.next() < 0.55) t++; else break;
      if (str > 600 && rng.next() < Math.min(0.85, (str - 600) / 700)) t = 1;
      out.push({ type: 'gem', c, t, n: 1 });
    }
    if (rng.next() < 0.3) out.push({ type: 'item', id: 'lollipop', n: 1 });
    if (rng.next() < 0.35 * opt.k) out.push({ type: 'points', n: 1 });
    // 合并
    const merged = [];
    for (const l of out) { const f = merged.find(x => x.type === l.type && x.c === l.c && x.t === l.t && x.id === l.id); if (f) f.n += l.n; else merged.push(Object.assign({}, l)); }
    merged.forEach(l => G.giveLoot(l));
    s.mine = null; s.stats.mineRuns++; G.taskProgress('mine', 1); G.checkAch(); G.persist();
    return merged;
  };

  /* ================= 兑换码 ================= */
  // 返回 { ok, name, loots } 或 { ok:false, err }；同一个码每个存档只能兑换一次
  G.redeem = function (input) {
    const s = G.save, r = SV.Codes.parse(input);
    if (!r.ok) return r;
    if (r.expire) {
      const d = new Date(), today = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      if (today > +r.expire) return { ok: false, err: '这个兑换码已过期（' + r.expire + '）' };
    }
    if (s.redeemed[r.id]) return { ok: false, err: '这个兑换码已经兑换过了' };
    s.redeemed[r.id] = Date.now();
    r.loots.forEach(l => G.giveLoot(l));
    s.stats.codes = (s.stats.codes || 0) + 1;
    G.persist(true);
    return r;
  };

  /* ================= 商店 ================= */
  G.SHOP = [
    { id: 'shard', name: '宝石碎片', desc: '随机颜色的宝石碎片 ×3', price: { silver: 1500 }, give: () => { const out = []; for (let i = 0; i < 3; i++) out.push({ type: 'gem', c: SV.rand.int(0, 5), t: 1, n: 1 }); return out; } },
    { id: 'shardpick', name: '指定碎片包', desc: '选择颜色的碎片 ×3', price: { silver: 2400 }, pick: true, give: c => [{ type: 'gem', c, t: 1, n: 3 }] },
    { id: 'crystal', name: '宝石晶体', desc: '随机颜色的晶体 ×1', price: { points: 4 }, give: () => [{ type: 'gem', c: SV.rand.int(0, 5), t: 2, n: 1 }] },
    { id: 'gem3', name: '宝石', desc: '随机颜色的宝石 ×1', price: { points: 12 }, give: () => [{ type: 'gem', c: SV.rand.int(0, 5), t: 3, n: 1 }] },
    { id: 'essence', name: '宝石精华', desc: '随机颜色的精华 ×1', price: { points: 36 }, give: () => [{ type: 'gem', c: SV.rand.int(0, 5), t: 4, n: 1 }] },
    { id: 'straw1', name: '初级稻草羊', desc: '下一局银币收益 ×1.5', price: { points: 15 }, give: () => [{ type: 'item', id: 'straw', lv: 1, n: 1 }] },
    { id: 'straw2', name: '中级稻草羊', desc: '下一局银币收益 ×2', price: { points: 45 }, give: () => [{ type: 'item', id: 'straw', lv: 2, n: 1 }] },
    { id: 'straw3', name: '高级稻草羊', desc: '下一局银币收益 ×3', price: { points: 120 }, give: () => [{ type: 'item', id: 'straw', lv: 3, n: 1 }] },
    { id: 'phono1', name: '初级留声机', desc: '经验 ×1.5，掉落 ×1.3', price: { points: 15 }, give: () => [{ type: 'item', id: 'phono', lv: 1, n: 1 }] },
    { id: 'phono2', name: '中级留声机', desc: '经验 ×2，掉落 ×1.6', price: { points: 45 }, give: () => [{ type: 'item', id: 'phono', lv: 2, n: 1 }] },
    { id: 'phono3', name: '高级留声机', desc: '经验 ×3，掉落 ×2', price: { points: 120 }, give: () => [{ type: 'item', id: 'phono', lv: 3, n: 1 }] },
    { id: 'lolli', name: '棒棒糖 ×3', desc: '噩梦模式入场券', price: { points: 6 }, give: () => [{ type: 'item', id: 'lollipop', n: 3 }] },
    { id: 'bomb3', name: '炸弹 ×3', desc: '装在墙上，狼一靠近就炸（范围伤害 + 眩晕）', price: { silver: 3000 }, give: () => [{ type: 'item', id: 'bomb', n: 3 }] },
    { id: 'bomb10', name: '炸弹 ×10', desc: '炸弹墙的补给箱', price: { points: 8 }, give: () => [{ type: 'item', id: 'bomb', n: 10 }] },
    { id: 'silver', name: '银币袋', desc: '20,000 银币', price: { points: 10 }, give: () => [{ type: 'silver', n: 20000 }] },
    { id: 'card_daomu3', name: '狼卡：盗墓老三', desc: '战斗力极高的狼卡（竞技场）', price: { points: 145 }, once: true, give: () => [{ type: 'wolfShard', id: 'daomu3', n: 10 }] },
    { id: 'card_fzswr', name: '狼卡：飞贼沙维尔', desc: '会飞的偷家好手', price: { points: 210 }, once: true, give: () => [{ type: 'wolfShard', id: 'fzswr', n: 10 }] },
    { id: 'card_yangpi', name: '狼卡：羊皮狼', desc: '披着羊皮的狼，肉盾', price: { points: 90 }, once: true, give: () => [{ type: 'wolfShard', id: 'yangpil_A', n: 10 }] }
  ];
  G.canBuy = function (it) {
    const s = G.save;
    if (it.price.silver && s.silver < it.price.silver) return false;
    if (it.price.points && s.points < it.price.points) return false;
    if (it.once && s.wolves.owned[it.give()[0].id]) return false;
    return true;
  };
  G.buy = function (it, arg) {
    const s = G.save; if (!G.canBuy(it)) return null;
    if (it.price.silver) s.silver -= it.price.silver;
    if (it.price.points) s.points -= it.price.points;
    const rw = it.give(arg); rw.forEach(r => G.giveLoot(r));
    G.persist(); return rw;
  };
})(typeof window !== 'undefined' ? window : globalThis);
