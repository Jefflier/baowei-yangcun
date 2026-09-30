/* ============================================================
 * AI：自动布阵 / 挂机助手 / 平衡模拟
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D;
  const AI = SV.AI = {};

  /* 当前所有地面出怪路径上的格子（顺序） */
  AI.pathCells = function (B) {
    const seen = new Set(), list = [];
    for (const s of B.map.spawns) {
      let c = s, guard = 0;
      while (c >= 0 && guard++ < 400) {
        if (!seen.has(c)) { seen.add(c); list.push(c); }
        c = B.field.nxt[c];
      }
    }
    return list;
  };

  /* 飞行狼的直线航线采样点（格坐标） */
  AI.airPoints = function (B) {
    const pts = [];
    for (const s of B.map.spawns) {
      const sx = (s % B.cols) + 0.5, sy = ((s / B.cols) | 0) + 0.5;
      let bg = -1, bd = Infinity;
      for (const g of B.map.goals) { const gx = (g % B.cols) + 0.5, gy = ((g / B.cols) | 0) + 0.5, d = Math.hypot(gx - sx, gy - sy); if (d < bd) { bd = d; bg = g; } }
      if (bg < 0) continue;
      const gx = (bg % B.cols) + 0.5, gy = ((bg / B.cols) | 0) + 0.5, n = Math.max(2, Math.ceil(bd * 2));
      for (let k = 0; k <= n; k++) pts.push([sx + (gx - sx) * k / n, sy + (gy - sy) * k / n]);
    }
    return pts;
  };
  AI.hasAir = function (B) {
    const W = B.W; const ids = new Set(); W.prop.forEach(p => ids.add(p[1])); W.boss.forEach(b => ids.add(b)); W.rb.forEach(r => ids.add(r[1])); W.fb.forEach(f => ids.add(f));
    for (const id of ids) if (SV.wolfDef(id).fly) return true;
    return false;
  };

  /* 给每个可建格子按对(地面路径 + 空中航线)的覆盖度打分 */
  AI.rankCells = function (B, range) {
    const cols = B.cols, path = AI.pathCells(B);
    const onPath = new Set(path);
    const px = path.map(c => (c % cols) + 0.5), py = path.map(c => ((c / cols) | 0) + 0.5);
    const air = AI.hasAir(B) ? AI.airPoints(B) : [];
    const out = [];
    for (let i = 0; i < B.occ.length; i++) {
      if (B.occ[i] || !B.map.buildableBase(i)) continue;
      if (B.map.type[i] === 1 && onPath.has(i)) continue;        // 不占道（避免改路）
      const cx = (i % cols) + 0.5, cy = ((i / cols) | 0) + 0.5;
      let sc = 0, sa = 0;
      for (let k = 0; k < px.length; k++) if (Math.hypot(px[k] - cx, py[k] - cy) <= range) sc++;
      for (let k = 0; k < air.length; k++) if (Math.hypot(air[k][0] - cx, air[k][1] - cy) <= range * 1.15) sa++;
      const total = sc + sa * 0.7;
      if (total > 0) out.push({ i, x: i % cols, y: (i / cols) | 0, score: total, ground: sc, air: sa });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  /* 单个塔的性价比（dps/银币）—— 用于升级决策 */
  AI.dpsOf = function (B, b) {
    const st = B.towerStats(b);
    if (st.idle) return 0;
    let mult = 1;
    if (st.kind === 'shell') mult = 1.6;
    if (st.kind === 'beam') mult = 2.5;
    if (st.kind === 'flash') mult = 2.5;
    if (st.kind === 'chain') mult = 1.8;
    if (st.targets > 1 && st.targets < 90) mult *= 1.5;
    const crit = st.crit ? 1 + st.crit.p * (st.crit.m - 1) : 1;
    return st.dmg / st.interval * mult * crit + (st.poison ? st.poison.dps * 0.6 : 0);
  };

  /* 挂机助手：把银币花在最有效的地方。返回是否有动作 */
  AI.step = function (B, opts) {
    opts = opts || {};
    const reserve = opts.reserve != null ? opts.reserve : 0;
    let acted = false;
    if (AI._B !== B) { AI._B = B; AI._rank = null; }
    const towers = B.buildings.filter(b => b.kind === 'tower');
    const free = B.occ.reduce((n, o, i) => n + (!o && B.map.buildableBase(i) ? 1 : 0), 0) + towers.length;
    const target = opts.maxTowers || SV.clamp(Math.floor(free * 0.3), 6, 26);
    for (let iter = 0; iter < 8; iter++) {
      const sp = B.silver - reserve;
      if (sp < 100) break;
      if (towers.length < target) {
        if (!AI._rank || AI._rankKey !== B.buildings.length + '_' + B.mapIdx) { AI._rank = AI.rankCells(B, 1.6); AI._rankKey = B.buildings.length + '_' + B.mapIdx; }
        if (!AI._rank.length) { AI._rank = null; if (!towers.length) break; }
        else {
          const cell = AI._rank[0];
          const type = pickType(B, towers, cell);
          const per = Math.max(B.towerCost(type, 3), sp / Math.max(2, (target - towers.length) * 0.8 + 1));
          if (B.towerCost(type, 1) > sp) break;
          let lv = 1; while (lv < B.towerMax(type) && B.towerCost(type, lv + 1) <= per) lv++;
          const r = B.build('tower', cell.x, cell.y, { type, lv });
          if (r.ok) { towers.push(r.b); AI._rank = null; acted = true; if (opts.gems) autoGem(B, r.b); continue; }
          AI._rank.shift(); continue;
        }
      }
      // 升级：等级最低的塔优先（均衡发展）
      let pick = null, best = Infinity;
      for (const b of towers) {
        if (b.lv >= B.towerMax(b.type)) continue;
        const v = b.lv + (b.type === 'cannon' ? -3 : 0);
        if (v < best) { best = v; pick = b; }
      }
      if (!pick) break;
      const r = B.upgradeAffordable(pick, pick.lv + Math.max(1, Math.ceil(pick.lv * 0.25)));
      if (r.ok) acted = true; else break;
    }
    return acted;
  };


  /* 自动绕路：贪心地在最短路上放墙，使路径尽量变长（保证不堵死）*/
  AI.autoMaze = function (B, limit, opts) {
    opts = opts || {};
    limit = limit || 40;
    const spawns = B.map.spawns;
    const total = f => { let t = 0; for (const s of spawns) { if (!isFinite(f.dist[s])) return -1; t += f.dist[s]; } return t; };
    let placed = 0;
    const reserve = opts.reserve != null ? opts.reserve : 0;
    for (let it = 0; it < limit; it++) {
      if (B.silver - reserve < SV.WALL_COST) break;
      const base = total(B.field);
      const path = AI.pathCells(B);
      let best = null, bestGain = 0.3;
      for (const i of path) {
        if (B.map.type[i] !== 1 || B.occ[i]) continue;
        // 不要紧贴出怪口/羊村口，防止怪出不来
        const x = i % B.cols, y = (i / B.cols) | 0;
        let near = false;
        for (const g of B.map.goals.concat(spawns)) { if (Math.abs((g % B.cols) - x) + Math.abs(((g / B.cols) | 0) - y) <= 1) near = true; }
        if (near) continue;
        if (B.wolfOnCell(x, y)) continue;
        B.occ[i] = { block: true, kind: 'wall' };
        const f = SV.computeField(B.map, k => { const o = B.occ[k]; return o && o.block; });
        B.occ[i] = null;
        const t = total(f);
        if (t < 0) continue;
        const gain = t - base;
        // 偏好离羊村近的位置（把怪逼进死胡同），同增益取靠近羊村的一侧
        const gd = f.dist[spawns[0]];
        if (gain > bestGain + 1e-6 || (Math.abs(gain - bestGain) < 1e-6 && best && B.field.dist[i] < B.field.dist[best.i])) { bestGain = gain; best = { i, x, y }; }
      }
      if (!best) break;
      const r = B.build('wall', best.x, best.y);
      if (!r.ok) break;
      placed++;
    }
    AI._rank = null;
    return placed;
  };

  function pickType(B, towers, cell) {
    const cnt = { sentry: 0, cannon: 0, scatter: 0 };
    for (const t of towers) if (cnt[t.type] != null) cnt[t.type]++;
    const air = AI.hasAir(B);
    if (air && cell && cell.air > cell.ground * 0.7 && cnt.scatter < Math.max(2, towers.length * 0.45)) return 'scatter';
    if (air && cnt.scatter < Math.max(1, towers.length / 5) && towers.length >= 3) return 'scatter';
    if (cnt.cannon < towers.length / 3 && towers.length >= 3 && B.mapIdx > 1) return 'cannon';
    return 'sentry';
  }
  function autoGem(B, b) {
    // 给塔镶嵌合适的宝石（若库存有）
    const st = B.gemStock; if (!st) return;
    const pref = b.type === 'sentry' ? [3, 2, 1, 4] : b.type === 'cannon' ? [1, 2, 4] : [5, 1, 3];
    for (const c of pref) for (let t = 5; t >= 1; t--) if (st[c][t - 1] > 0) { B.setGem(b, { c, t }); return; }
  }
  AI.autoGem = autoGem;

  /* ---------- 平衡模拟 ---------- */
  SV.simulate = function (idx, o) {
    o = o || {};
    const stock = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
    if (o.gems) for (let c = 0; c < 6; c++) stock[c][o.gems - 1] = 20;
    const B = new SV.Battle({ mapIdx: idx, seed: o.seed || 1, silver: o.silver != null ? o.silver : 3000, gemStock: stock, playerLevel: o.level || 1 });
    if (o.maze !== false) SV.AI.autoMaze(B, o.mazeWalls || 60);
    B.startBattle();
    const dt = 1 / 20;
    let elapsed = 0, lastAct = 0, maxT = o.maxT || 4000;
    const log = [];
    while (!B.over && elapsed < maxT) {
      B.update(dt); elapsed += dt;
      if (elapsed - lastAct >= 0.8) {
        lastAct = elapsed;
        AI.step(B, { reserve: 0, gems: !!o.gems, newLv: o.newLv || 6, maxTowers: o.maxTowers });
      }
      if (o.verbose && Math.floor(elapsed) % 60 === 0 && log.length < Math.floor(elapsed / 60)) {
        log.push(`t=${Math.floor(elapsed)} wave=${B.waveNo} prog=${B.progress.toFixed(0)}/${B.scoreMax} silver=${Math.floor(B.silver)} lives=${B.lives} towers=${B.buildings.filter(b => b.kind === 'tower').length} wolves=${B.wolves.length}`);
      }
    }
    if (o.verbose) console.log(log.join('\n'));
    const res = B.getResult();
    return { name: B.map.name, win: B.win, over: B.over, t: Math.floor(elapsed), waves: B.waveNo, prog: Math.floor(B.progress), max: B.scoreMax, silver: Math.floor(B.silver), spent: Math.floor(B.spentTower), lives: B.lives, leaks: B.stats.leaks, kills: B.stats.kills, towers: B.buildings.filter(b => b.kind === 'tower').length, exp: Math.floor(B.expGained), loot: B.loot.length, earned: res.earned };
  };
})(typeof window !== 'undefined' ? window : globalThis);
