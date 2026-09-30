/* ============================================================
 * 元游戏：存档 / 等级 / 地图解锁 / 库存 / 战斗生命周期
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D;
  const KEY = 'sv_nostalgia_save_v1';
  const G = SV.Game = { save: null, battle: null, inBattle: false, listeners: {} };

  G.on = function (ev, fn) { (G.listeners[ev] = G.listeners[ev] || []).push(fn); };
  G.emit = function (ev, d) { (G.listeners[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } }); };

  /* ---------- 常量 ---------- */
  G.MAX_LEVEL = 100;
  G.DIFF = [{ n: '休闲', hp: 0.55, d: '狼更脆，适合放松挂机' }, { n: '普通', hp: 0.8, d: '推荐：有挑战但公平' }, { n: '硬核', hp: 1.0, d: '还原怀旧服原始强度' }];
  G.expNeed = L => Math.floor(30 * Math.pow(L, 1.5));
  SV.mapExpPerPop = idx => 1.0 + 0.3 * idx;

  const emptyGems = () => [0, 1, 2, 3, 4, 5].map(() => [0, 0, 0, 0, 0]);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  G.today = today;

  /* ---------- 地图解锁表 ---------- */
  const PRE = {};
  for (let i = 1; i < D.maps.length; i++) PRE[i] = [i - 1];
  Object.assign(PRE, {
    3: [2], 4: [2], 5: [4], 6: [3], 7: [6], 9: [7], 10: [9], 8: [10],
    24: [1], 25: [22], 19: [18], 37: [36], 38: [36], 39: [18], 40: [22], 41: [36], 42: [41], 43: [42], 44: [43], 45: [44]
  });
  PRE[0] = [];
  // 自然等级估算 → 需求等级
  const CAMPAIGN = D.maps.map((m, i) => i).sort((a, b) => D.maps[a].no - D.maps[b].no);
  const LVREQ = {};
  (function () {
    let cum = 0;
    for (const idx of CAMPAIGN) {
      const nat = Math.pow(cum / 12, 0.4) || 1;
      LVREQ[idx] = Math.max(1, Math.floor(nat * 0.62));
      const m = D.maps[idx];
      cum += (m.inf ? 2400 : m.w.sc) * SV.mapExpPerPop(idx);
    }
    Object.assign(LVREQ, { 0: 1, 1: 1, 2: 2, 3: 4, 4: 5, 24: 3, 40: 45, 41: 48, 37: 58, 38: 58 });
  })();
  G.mapReq = idx => ({ pre: PRE[idx] || [], lv: LVREQ[idx] || 1 });
  G.campaignOrder = CAMPAIGN;

  /* ---------- 存档 ---------- */
  G.defaults = function (name) {
    const gems = emptyGems();
    for (let c = 0; c < 6; c++) { gems[c][0] = 3; gems[c][1] = 1; }
    gems[4][2] = 1; gems[2][2] = 1;
    return {
      v: 1, name: name || '村长', created: Date.now(), lastSeen: Date.now(),
      level: 1, exp: 0, silver: 5000, points: 0, lollipop: 3, gems,
      items: { straw: [0, 0, 0], phono: [0, 0, 0], bomb: 3 },
      redeemed: {},
      maps: {}, mine: null, mineSpeed: { day: '', n: 0 },
      wolves: { owned: { al_B: { lv: 1, exp: 0, sk: [] } }, team: ['al_B'], shards: {} },
      arena: { wins: 0, losses: 0, day: '', fights: 0, opp: null, streak: 0, score: 1000 },
      friends: { hired: {}, whack: { day: '', n: 0 }, visited: {} },
      daily: { day: '', tasks: [] }, daily2: { last: '', streak: 0 },
      ach: {}, stats: { kills: 0, bosses: 0, clears: 0, towers: 0, silverEarned: 0, leaks: 0, fuse: 0, arenaWins: 0, mineRuns: 0, whacks: 0, nmBest: 0, maxTowerLv: 0, play: 0, sold: 0, gemsUsed: 0, upgrades: 0, retreat: 0, wins: 0, perfect: 0, lureKills: 0 },
      seen: {}, layouts: {},
      settings: { sfx: 0.6, bgm: 0.3, dmg: true, grid: false, path: false, speed: 1, autoWave: true, shake: true, tips: true, diff: 1, talk: true },
      tutorial: { done: false }
    };
  };
  G.load = function () {
    let s = SV.store.get(KEY, null);
    const d = G.defaults();
    if (s && s.v) {
      // 合并缺失字段
      const merge = (a, b) => { for (const k in b) { if (a[k] === undefined) a[k] = b[k]; else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); } };
      merge(s, d);
      G.save = s;
    } else { G.save = d; }
    G.save.lastSeen = Date.now();
    G.dailyReset();
    return G.save;
  };
  G.persist = function (force) {
    if (G.inBattle && !force) return;
    if (!G.save) return;
    G.save.lastSeen = Date.now();
    SV.store.set(KEY, G.save);
  };
  G.reset = function () { SV.store.del(KEY); G.save = G.defaults(); G.dailyReset(); G.persist(true); };
  G.exportCode = function () { try { return btoa(unescape(encodeURIComponent(JSON.stringify(G.save)))); } catch (e) { return ''; } };
  G.importCode = function (code) {
    try { const s = JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if (!s || !s.v) return false; SV.store.set(KEY, s); G.load(); return true; } catch (e) { return false; }
  };

  /* ---------- 货币 & 经验 ---------- */
  G.addSilver = function (n) { G.save.silver = Math.max(0, Math.floor(G.save.silver + n)); if (n > 0) G.save.stats.silverEarned += n; };
  G.addPoints = function (n) { G.save.points = Math.max(0, G.save.points + n); };
  G.addExp = function (n) {
    const s = G.save; let up = 0;
    if (s.level >= G.MAX_LEVEL) return 0;
    s.exp += n;
    while (s.level < G.MAX_LEVEL && s.exp >= G.expNeed(s.level)) { s.exp -= G.expNeed(s.level); s.level++; up++; }
    if (s.level >= G.MAX_LEVEL) s.exp = 0;
    if (up) { G.emit('levelup', s.level); SV.Audio.play('level'); }
    return up;
  };
  G.addGem = function (c, t, n) { G.save.gems[c][t - 1] += (n == null ? 1 : n); };
  G.gemCount = (c, t) => G.save.gems[c][t - 1];
  G.gemTotal = function () { let n = 0; for (const r of G.save.gems) for (const v of r) n += v; return n; };
  G.fuse = function (c, t) {
    const g = G.save.gems;
    if (t >= 5 || g[c][t - 1] < 3) return false;
    g[c][t - 1] -= 3; g[c][t] += 1; G.save.stats.fuse++; G.checkAch(); G.taskProgress('fuse', 1); return true;
  };
  G.fuseAll = function (c, t) { let n = 0; while (G.fuse(c, t)) n++; return n; };
  G.gemName = (c, t) => SV.GEM_COLORS[c].n + '宝石·' + SV.GEM_TIERS[t - 1];

  G.giveLoot = function (l, quiet) {
    if (l.type === 'gem') G.addGem(l.c, l.t, l.n || 1);
    else if (l.type === 'points') G.addPoints(l.n);
    else if (l.type === 'silver') G.addSilver(l.n);
    else if (l.type === 'item') {
      if (l.id === 'lollipop') G.save.lollipop += l.n;
      else if (l.id === 'bomb') G.save.items.bomb = (G.save.items.bomb || 0) + l.n;
      else if (l.id === 'straw') G.save.items.straw[l.lv - 1] += l.n;
      else if (l.id === 'phono') G.save.items.phono[l.lv - 1] += l.n;
    } else if (l.type === 'bag') { G.addGem(5, 5, 1); }
    else if (l.type === 'exp') G.addExp(l.n);
    else if (l.type === 'wolfShard') { G.save.wolves.shards[l.id] = (G.save.wolves.shards[l.id] || 0) + l.n; }
  };
  G.lootText = function (l) {
    if (l.type === 'gem') return SV.GEM_COLORS[l.c].n + '宝石·' + SV.GEM_TIERS[l.t - 1] + ' ×' + (l.n || 1);
    if (l.type === 'points') return '积分 ×' + l.n;
    if (l.type === 'silver') return '银币 ×' + SV.fmt(l.n);
    if (l.type === 'bag') return '大宝袋：强化黑宝石 ×1';
    if (l.type === 'exp') return '经验 ×' + l.n;
    if (l.type === 'wolfShard') return (D.wolves[l.id] ? D.wolves[l.id].n : l.id) + ' 狼卡碎片 ×' + l.n;
    if (l.type === 'item') return ({ lollipop: '棒棒糖', straw: '稻草羊', phono: '留声机', bomb: '炸弹' }[l.id]) + (l.lv ? ['·初级', '·中级', '·高级'][l.lv - 1] : '') + ' ×' + l.n;
    return '?';
  };

  /* ---------- 地图状态 ---------- */
  G.mapRec = idx => G.save.maps[idx] || null;
  G.mapCleared = idx => !!(G.save.maps[idx] && G.save.maps[idx].clears > 0);
  G.mapState = function (idx) {
    const r = G.mapReq(idx), s = G.save;
    const miss = r.pre.filter(p => !G.mapCleared(p));
    if (s.level < r.lv) return { unlocked: false, why: '需要等级 ' + r.lv };
    if (miss.length) return { unlocked: false, why: '需先通关：' + miss.map(i => D.maps[i].n).join('、') };
    return { unlocked: true };
  };

  /* ---------- 加成 ---------- */
  G.STRAW = [1.5, 2, 3]; G.PHONO_EXP = [1.5, 2, 3]; G.PHONO_DROP = [1.3, 1.6, 2];
  G.STRAW_N = ['初级稻草羊', '中级稻草羊', '高级稻草羊']; G.PHONO_N = ['初级留声机', '中级留声机', '高级留声机'];

  /* ---------- 战斗生命周期 ---------- */
  G.towerCap = function () { return 999; };

  G.startBattle = function (idx, mode, opts) {
    opts = opts || {};
    const s = G.save;
    const boost = { silver: 1, exp: 1, drop: 1 };
    const used = {};
    if (opts.straw) { const lv = opts.straw; if (s.items.straw[lv - 1] > 0) { s.items.straw[lv - 1]--; boost.silver = G.STRAW[lv - 1]; used.straw = lv; } }
    if (opts.phono) { const lv = opts.phono; if (s.items.phono[lv - 1] > 0) { s.items.phono[lv - 1]--; boost.exp = G.PHONO_EXP[lv - 1]; boost.drop = G.PHONO_DROP[lv - 1]; used.phono = lv; } }
    boost.silver *= 1 + s.level * 0.002;
    const gems = s.gems;                       // 直接引用，战斗内实时增减
    let silver = s.silver;
    if (mode === 'nightmare') {
      // 噩梦：独立资金 & 每色精华宝石各一颗（战斗后收回）
      silver = 6000 + idx * 1500;
    }
    G.snapshot = JSON.stringify({ gems: s.gems, silver: s.silver, items: s.items, lollipop: s.lollipop });
    const dm = G.DIFF[s.settings.diff != null ? s.settings.diff : 1];
    const B = new SV.Battle({
      mapIdx: idx, mode: mode || 'normal', silver, gemStock: gems, boost, playerLevel: s.level, towerCap: G.towerCap(),
      hpScale: SV.hpScaleFor(idx) * dm.hp, dmgMul: 1 + Math.min(0.4, s.level * 0.004),
      autoWave: s.settings.autoWave, lives: mode === 'nightmare' ? 20 : 30, bombs: s.items.bomb || 0,
      onEvent: (name, data) => G.onBattleEvent(name, data)
    });
    B.expPerPop = SV.mapExpPerPop(idx) * (mode === 'nightmare' ? 0.7 : 1);
    B.showDamage = s.settings.dmg;
    B.used = used;
    B.nightmareGift = null;
    if (mode === 'nightmare') {
      // 自带 6 色精华各一
      for (let c = 0; c < 6; c++) gems[c][3]++;
      B.nightmareGift = true;
    }
    G.battle = B; G.inBattle = true;
    G.battleStartAt = Date.now();
    return B;
  };

  G.onBattleEvent = function (name, data) {
    const B = G.battle;
    if (name === 'build') { G.save.stats.towers += (data.kind === 'tower' ? 1 : 0); G.taskProgress('build', data.kind === 'tower' ? 1 : 0); if (data.kind === 'tower') G.save.stats.maxTowerLv = Math.max(G.save.stats.maxTowerLv, data.lv); }
    if (name === 'kill') { G.save.stats.kills++; G.taskProgress('kill', 1); if (!G.save.seen[data.id]) G.save.seen[data.id] = 1; if (data.boss) { G.save.stats.bosses++; } }
    if (name === 'spawn') { if (!G.save.seen[data.id]) { G.save.seen[data.id] = 1; } }
    if (name === 'upgrade') { G.save.stats.upgrades++; G.save.stats.maxTowerLv = Math.max(G.save.stats.maxTowerLv, data.lv); }
    if (name === 'sell') G.save.stats.sold++;
    if (name === 'gem') G.save.stats.gemsUsed++;
    G.emit('battle:' + name, data);
  };

  /* 战斗结束：结算 */
  G.finishBattle = function (B, opts) {
    opts = opts || {};
    const s = G.save, res = B.getResult();
    const out = { res, silverBefore: s.silver, lootList: [], levelUps: 0, firstClear: false, bonus: 0, expGain: 0, exp: 0 };
    B.dismantle();                                             // 宝石全部回收
    G.settleBombs(B);                                          // 只扣已引爆的炸弹
    G.saveLayout(B);
    if (B.mode === 'nightmare') {
      // 噩梦：回收自带精华宝石（已在 dismantle 中回到库存），扣除赠送的
      for (let c = 0; c < 6; c++) s.gems[c][3] = Math.max(0, s.gems[c][3] - 1);
      const w = B.nmWave;
      const rec = s.maps[B.mapIdx] = s.maps[B.mapIdx] || { clears: 0, best: 0, nm: 0, wins: 0, tries: 0, bestTime: 0 };
      const newBest = w > (rec.nm || 0);
      rec.nm = Math.max(rec.nm || 0, w);
      s.stats.nmBest = Math.max(s.stats.nmBest, w);
      // 噩梦宝箱：每 10 波一个
      const chests = Math.floor(w / 10) + (B.win ? 2 : 0);
      const gemsOut = [];
      for (let k = 0; k < chests; k++) {
        const t = SV.clamp(1 + Math.floor(B.rng.next() * (1 + B.mapIdx / 14)) + (k >= 5 ? 1 : 0), 1, 5);
        const c = B.rng.int(0, 5);
        gemsOut.push({ type: 'gem', c, t, n: 1 + (B.rng.next() < 0.3 ? 1 : 0) });
      }
      if (w >= 30) gemsOut.push({ type: 'points', n: Math.floor(w / 10) });
      if (B.win) gemsOut.push({ type: 'gem', c: 5, t: Math.min(5, 3 + (B.mapIdx > 25 ? 1 : 0)), n: 1 });
      for (const l of gemsOut) G.giveLoot(l);
      out.lootList = gemsOut;
      out.exp = Math.floor(B.expGained);
      out.levelUps = G.addExp(out.exp);
      out.silver = Math.floor((D.maps[B.mapIdx].inf ? 500000 : D.maps[B.mapIdx].inc) * 0.2 * Math.min(1, w / 110));
      G.addSilver(out.silver);
      s.silver = Math.max(0, s.silver);
      out.newBest = newBest;
    } else {
      // 银币：战斗内的资金直接是最终值
      s.silver = Math.max(0, Math.floor(B.silver));
      const rec = s.maps[B.mapIdx] = s.maps[B.mapIdx] || { clears: 0, best: 0, nm: 0, wins: 0, tries: 0, bestTime: 0 };
      rec.tries++;
      rec.best = Math.max(rec.best || 0, Math.floor(B.progress));
      s.stats.silverEarned += Math.floor(B.stats.earned);
      s.stats.leaks += B.stats.leaks;
      if (B.win) {
        out.firstClear = rec.clears === 0;
        rec.clears++; rec.wins++; s.stats.clears++; s.stats.wins++;
        if (B.stats.leaks === 0) s.stats.perfect++;
        rec.bestTime = rec.bestTime ? Math.min(rec.bestTime, Math.floor(B.t)) : Math.floor(B.t);
        rec.minCost = rec.minCost ? Math.min(rec.minCost, Math.floor(B.spentTower)) : Math.floor(B.spentTower);
        const m = D.maps[B.mapIdx];
        const bonus = Math.floor((m.inf ? 0 : m.inc) * 0.18);
        out.bonus = bonus; G.addSilver(bonus);
        // 通关奖励
        const rewards = [];
        const tier = SV.clamp(1 + Math.floor(B.mapIdx / 11), 1, 5);
        if (out.firstClear) {
          rewards.push({ type: 'silver', n: 1200 + Math.min(B.mapIdx, 30) * 500 });
          rewards.push({ type: 'points', n: 2 + Math.floor(B.mapIdx / 5) });
          rewards.push({ type: 'gem', c: B.rng.int(0, 5), t: tier, n: 2 });
          rewards.push({ type: 'gem', c: B.rng.int(0, 5), t: Math.max(1, tier - 1), n: 3 });
          if (B.mapIdx === 1) rewards.push({ type: 'item', id: 'phono', lv: 1, n: 1 });
          if (B.mapIdx === 3) rewards.push({ type: 'item', id: 'straw', lv: 1, n: 1 });
          if (B.mapIdx === 43) { rewards.push({ type: 'item', id: 'phono', lv: 1, n: 1 }); rewards.push({ type: 'item', id: 'straw', lv: 1, n: 1 }); }
          if (B.mapIdx === 44) { for (let l = 1; l <= 3; l++) { rewards.push({ type: 'item', id: 'phono', lv: l, n: 1 }); rewards.push({ type: 'item', id: 'straw', lv: l, n: 1 }); } }
          if (B.mapIdx % 4 === 0) rewards.push({ type: 'item', id: 'lollipop', n: 2 });
          const cards = { 5: 'tufeil', 9: 'renzhel', 14: 'hushil', 20: 'jiangshil', 27: 'tanhuangl', 34: 'xuel_B' };
          if (cards[B.mapIdx]) rewards.push({ type: 'wolfShard', id: cards[B.mapIdx], n: 8 });
        } else {
          if (B.rng.next() < 0.35) rewards.push({ type: 'gem', c: B.rng.int(0, 5), t: Math.max(1, tier - 1), n: 1 });
          if (B.rng.next() < 0.25) rewards.push({ type: 'points', n: 1 });
        }
        for (const l of rewards) G.giveLoot(l);
        out.lootList = rewards;
        G.taskProgress('clear', 1);
      }
      // 掉落（随机boss等）
      for (const l of B.loot) G.giveLoot(l);
      out.dropList = B.loot.slice();
      out.exp = Math.floor(B.expGained * (B.win ? 1.15 : 1));
      out.levelUps = G.addExp(out.exp);
    }
    // 收尾
    G.inBattle = false; G.battle = null;
    G.save.stats.play += Math.floor((Date.now() - G.battleStartAt) / 1000);
    G.checkAch();
    G.persist(true);
    G.emit('battleEnd', out);
    return out;
  };

  /* 直接退出（不结算，恢复战前状态）*/
  G.settleBombs = function (B) {
    const s = G.save; if (!B || !B.bombUsed) return;
    s.items.bomb = Math.max(0, (s.items.bomb || 0) - B.bombUsed);
    s.stats.bombs = (s.stats.bombs || 0) + B.bombUsed;
    s.stats.bombKills = (s.stats.bombKills || 0) + (B.stats.bombKills || 0);
    B.bombUsed = 0;                                           // 防止重复结算
  };
  G.abortBattle = function () {
    if (!G.battle) return;
    const B = G.battle;
    B.dismantle(); G.settleBombs(B);
    G.inBattle = false; G.battle = null;
    G.persist(true);
  };

  /* ---------- 布阵存档 ---------- */
  G.layoutList = function (B) {
    const list = [];
    for (const b of B.buildings) {
      if (b.kind === 'tower') list.push({ k: 't', t: b.type, lv: b.lv, g: b.gem ? [b.gem.c, b.gem.t] : null, x: b.x, y: b.y, m: b.mode });
      else if (b.kind === 'wall') list.push({ k: 'w', x: b.x, y: b.y });
      else if (b.kind === 'statue') list.push({ k: 's', id: b.sid, x: b.x, y: b.y });
      else if (b.kind === 'trap') list.push({ k: 'p', id: b.tid, x: b.x, y: b.y });
    }
    return list;
  };
  G.saveLayout = function (B) {
    const list = G.layoutList(B);
    if (list.length) G.save.layouts[B.mapIdx] = { list, at: Date.now(), cost: Math.floor(B.spentTower), win: !!B.win };
  };
  G.applyLayoutList = function (B, items) {
    let n = 0, fail = 0, lastMsg = '';
    const order = { w: 0, s: 1, p: 2, t: 3 };
    items = items.slice().sort((a, b) => order[a.k] - order[b.k]);
    for (const it of items) {
      let r;
      if (it.k === 't') {
        const gem = it.g && B.gemAvail({ c: it.g[0], t: it.g[1] }) ? { c: it.g[0], t: it.g[1] } : null;
        r = B.build('tower', it.x, it.y, { type: it.t, lv: it.lv, gem });
        if (r.ok && it.m) r.b.mode = it.m;
      } else if (it.k === 'w') r = B.build('wall', it.x, it.y);
      else if (it.k === 's') r = B.build('statue', it.x, it.y, { sid: it.id });
      else r = B.build('trap', it.x, it.y, { tid: it.id });
      if (r.ok) n++; else { fail++; lastMsg = r.msg; }
    }
    return { n, fail, msg: lastMsg };
  };
  G.loadLayout = function (B) {
    const L = G.save.layouts[B.mapIdx]; if (!L) return { n: 0, fail: 0 };
    return G.applyLayoutList(B, L.list);
  };
  G.layoutCode = function (B) { try { return 'YC1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ m: B.mapIdx, l: G.layoutList(B) })))); } catch (e) { return ''; } };
  G.parseLayoutCode = function (code) {
    try { code = code.trim(); if (code.indexOf('YC1:') === 0) code = code.slice(4); const o = JSON.parse(decodeURIComponent(escape(atob(code)))); if (o && typeof o.m === 'number' && Array.isArray(o.l)) return o; } catch (e) { }
    return null;
  };

  /* ---------- 每日重置 / 任务 / 成就 占位（在 features.js 中实现）---------- */
  G.dailyReset = function () { if (G._dailyReset) G._dailyReset(); };
  G.taskProgress = function (id, n) { if (G._taskProgress) G._taskProgress(id, n); };
  G.checkAch = function () { if (G._checkAch) G._checkAch(); };
})(typeof window !== 'undefined' ? window : globalThis);
