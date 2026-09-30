/* 牛来攻城 —— 无头平衡模拟（node tools/niu_sim.js [关卡号…] [--runs N] [--verbose]）
 * 用一个朴素的 AI 玩家（贪心造墙绕路 + 按覆盖路径格数摆塔 + 修墙升级）把每一关跑一遍，
 * 输出胜负、星级、漏牛、被撞塌的建筑数等，用来调数值和回归检查引擎。 */
'use strict';
global.window = global;
require('../niulai/js/niu_data.js');
require('../niulai/js/niu_engine.js');
const NL = global.NL, D = NL.D;

const args = process.argv.slice(2);
const runs = args.includes('--runs') ? +args[args.indexOf('--runs') + 1] : 2;
const verbose = args.includes('--verbose');
const onlyIds = args.filter(a => /^\d+$/.test(a) && args[args.indexOf(a) - 1] !== '--runs').map(Number);

function unlockedUpTo(id) {
  const s = new Set();
  for (const L of D.levels) { if (L.id > id) break; for (const u of L.unlock) s.add(u); }
  if (id === 99) for (const L of D.levels.slice(0, D.ENDLESS_UNLOCK)) for (const u of L.unlock) s.add(u);
  return s;
}

// AI：目标函数 J = Σ(路线上每一格被多少塔的火力覆盖)。
//   造墙：只接受让 J 变大的墙（路线变长且还在塔的射程里）——候选是蛇形屏障（x=4/8/12/16，上下交替留口）的下一格，
//         以及路线上/路线边的单格；牛不许因此改成撞墙。
//   造塔：挑覆盖当前路线最多的格子。
function AI(g) {
  this.g = g; this.rot = 0;
  const L = g.L, U = g.unlocked;
  this.hasFly = L.cows.some(e => D.cows[e[0]].fly);
  this.types = ['sentry', 'frost', 'cannon', 'sentry', 'thunder', 'fire', 'scatter', 'poison', 'pulse', 'cannon', 'sentry'].filter(t => U.has(t));
  if (!this.hasFly && U.has('cannon')) this.types = this.types.filter(t => t !== 'scatter');
  if (this.hasFly && U.has('scatter')) this.types.splice(1, 0, 'scatter');
  this.lines = [];
  [4, 8, 12, 16].forEach((x, j) => {
    const gapBottom = j % 2 === 0, cells = [];
    for (let y = 0; y < g.rows; y++) {
      if (gapBottom && y >= g.rows - 1) continue;
      if (!gapBottom && y <= 0) continue;
      cells.push(g.idx(x, y));
    }
    if (gapBottom) cells.sort((a, b) => a - b); else cells.sort((a, b) => b - a);
    this.lines.push(cells);
  });
}
AI.prototype.pathW = function (F, occ, loose) {
  const g = this.g, w = new Map();
  for (const sg of g.spawnGroups) for (const s of [sg[0], sg[sg.length - 1]]) {
    const p = g.pathFrom(s, false, F, occ);
    if (p.breach.length && !loose) return null;
    for (const c of p.cells) w.set(c, (w.get(c) || 0) + 1);
  }
  // 有飞天牛的关卡：把入口→城门的直线航线也算进覆盖（人会看着蓝色航线摆散弹塔）
  if (this.hasFly) for (const sg of g.spawnGroups) {
    const s = sg[(sg.length / 2) | 0], x0 = s % g.cols, y0 = (s / g.cols) | 0, x1 = g.gate.x - 0.5, y1 = g.gate.y - 0.5;
    for (let k = 0; k <= 12; k++) { const x = Math.round(x0 + (x1 - x0) * k / 12), y = Math.round(y0 + (y1 - y0) * k / 12); if (g.inb(x, y)) { const c = g.idx(x, y); w.set(c, (w.get(c) || 0) + 0.5); } }
  }
  return w;
};
AI.prototype.pathCells = function () { return this.pathW(null, null, true); };
AI.prototype.coverage = function (i, R, w) {
  const g = this.g, x = i % g.cols, y = (i / g.cols) | 0; let s = 0;
  for (const [c, k] of w) if (Math.hypot(c % g.cols - x, ((c / g.cols) | 0) - y) <= R) s += k;
  return s;
};
AI.prototype.J = function (w) {
  let s = 0;
  for (const b of this.g.blds) if (b.kind === 'tower') { const T = D.towers[b.type]; s += this.coverage(b.i, T.rng[b.lv - 1], w) * (T.dmg[b.lv - 1] / T.cd[b.lv - 1]); }
  return s;
};
AI.prototype.safe = function (cells, hp) {
  const g = this.g, occ = g.previewOcc(cells, hp), F = g.computeField(false, occ);
  return !!this.pathW(F, occ);
};
AI.prototype.tryWall = function () {
  const g = this.g, w0 = this.pathCells(), J0 = this.J(w0);
  const cand = new Set();
  for (const line of this.lines) { let k = 0; for (const c of line) { if (g.occ[c] || g.ter[c] !== NL.T.GRASS) continue; cand.add(c); if (++k >= 2) break; } }
  for (const [c] of w0) {
    const x0 = c % g.cols, y0 = (c / g.cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.inb(x0 + dx, y0 + dy)) cand.add(g.idx(x0 + dx, y0 + dy));
  }
  let best = -1, bj = J0 * 1.01 + 1;
  for (const c of cand) {
    if (!g.canPlace('wall', c % g.cols, (c / g.cols) | 0).ok) continue;
    const occ = g.previewOcc([c], D.walls[0].hp), w = this.pathW(g.computeField(false, occ), occ);
    if (!w) continue;
    const j = this.J(w);
    if (j > bj) { bj = j; best = c; }
  }
  if (best < 0) return false;
  return g.place('wall', best % g.cols, (best / g.cols) | 0).ok;
};
AI.prototype.bestTowerCell = function (type) {
  const g = this.g, w = this.pathCells(), R = D.towers[type].rng[0];
  let best = -1, bs = 0;
  for (let i = 0; i < g.n; i++) {
    if (w.has(i) || !g.canPlace('tower', i % g.cols, (i / g.cols) | 0, { type }).ok) continue;
    const s = this.coverage(i, R, w);
    if (s > bs) { bs = s; best = i; }
  }
  if (best >= 0 && !this.safe([best], D.towers[type].hp[0])) return { i: -1, s: 0 };
  return { i: best, s: bs };
};
AI.prototype.tick = function () {
  const g = this.g;
  for (const b of g.blds) if (b.kind !== 'hay' && b.hp < b.maxHp * 0.55 && g.repairCost(b) <= g.gold * 0.5) g.repair(b);
  for (const b of g.blds) if (b.kind === 'wall' && b.lv === 1 && b.hp < b.maxHp * 0.8 && g.gold > 60) g.upgrade(b);
  let guard = 0;
  while (guard++ < 40 && g.gold >= 10) {
    const towers = g.blds.filter(b => b.kind === 'tower');
    const walls = g.blds.filter(b => b.kind === 'wall').length;
    const type = this.types[this.rot % this.types.length], cost = D.towers[type].cost[0];
    const wantWall = walls * 10 < (g.stats.spent + g.gold) * 0.25 && towers.length >= 2;
    if (wantWall && this.tryWall()) continue;
    let up = null, us = 0;
    for (const b of towers) if (b.lv < 5) { const s = (b.dmgDealt + 50) / b.paid; if (s > us) { us = s; up = b; } }
    if (g.gold >= cost) {
      const nt = this.bestTowerCell(type);
      if (nt.i >= 0 && (nt.s >= 5 || towers.length < 3)) { g.place('tower', nt.i % g.cols, (nt.i / g.cols) | 0, { type }); this.rot++; continue; }
    }
    if (up && g.gold >= g.upCost(up)) { g.upgrade(up); continue; }
    break;
  }
  // 辅助：草垛放在火力最密的路线格上；牛郎像 / 盘龙柱 / 织女像挑收益最大的空地
  if (g.gold > 150) {
    const w = this.pathCells();
    if (g.isUnlocked('hay') && g.blds.filter(b => b.kind === 'hay').length < 3) {
      let best = -1, bs = 0;
      for (const [c] of w) { if (g.occ[c] || !g.canPlace('hay', c % g.cols, (c / g.cols) | 0).ok) continue; let s = 0; for (const b of g.blds) if (b.kind === 'tower' && Math.hypot(b.x - c % g.cols, b.y - ((c / g.cols) | 0)) <= D.towers[b.type].rng[b.lv - 1]) s++; if (s > bs) { bs = s; best = c; } }
      if (best >= 0 && bs >= 3) g.place('hay', best % g.cols, (best / g.cols) | 0);
    }
    for (const sid of ['niulang', 'panlong', 'zhinv']) {
      if (!g.isUnlocked(sid) || g.countStatue(sid) >= D.statues[sid].limit || g.gold < D.statues[sid].cost + 100) continue;
      const S0 = D.statues[sid];
      let best = -1, bs = 0;
      for (let i = 0; i < g.n; i++) {
        if (w.has(i) || !g.canPlace('statue', i % g.cols, (i / g.cols) | 0, { sid }).ok) continue;
        const x = i % g.cols, y = (i / g.cols) | 0; let s = 0;
        if (sid === 'niulang') { for (const [c, k] of w) if (Math.hypot(c % g.cols - x, ((c / g.cols) | 0) - y) <= S0.r) s += k; }
        else for (const b of g.blds) if (b.kind === 'tower' && Math.hypot(b.x - x, b.y - y) <= S0.r) s += b.lv * 2;
        if (s > bs) { bs = s; best = i; }
      }
      if (best >= 0 && bs >= 6 && this.safe([best], S0.hp)) g.place('statue', best % g.cols, (best / g.cols) | 0, { sid });
    }
  }
  if (g.skillReady('gunmu')) {
    const rows = new Array(g.rows).fill(0);
    for (const c of g.cows) if (c.alive && !c.fly) rows[Math.min(g.rows - 1, c.y | 0)]++;
    let r = 0; for (let j = 1; j < g.rows; j++) if (rows[j] > rows[r]) r = j;
    if (rows[r] >= 4) g.useSkill('gunmu', r);
  }
  if (g.skillReady('freeze') && g.cows.filter(c => c.alive && c.x > g.cols - 5).length >= 5) g.useSkill('freeze');
  if (g.skillReady('repair') && g.blds.some(b => b.hp < b.maxHp * 0.4)) g.useSkill('repair');
};

function run(L, seed) {
  const g = new NL.Game(L, { seed, unlocked: unlockedUpTo(L.id) });
  const ai = new AI(g);
  ai.tick(); ai.tick();
  g.callWave();
  const dt = 1 / 30;
  let acc = 0, maxAlive = 0, guard = 0;
  const cap = L.endless ? 60 : Infinity;
  while (!g.over && guard++ < 30 * 60 * 90) {
    g.update(dt); acc += dt;
    if (acc >= 1) { acc = 0; ai.tick(); }
    maxAlive = Math.max(maxAlive, g.aliveCount());
    g.drain();
    if (g.k > cap) break;
  }
  return { win: g.win, stars: g.stars(), k: g.k, hp: g.hp, leaks: g.stats.leaks, kills: g.stats.kills, destroyed: g.stats.destroyed,
    gold: g.gold, towers: g.blds.filter(b => b.kind === 'tower').length, walls: g.blds.filter(b => b.kind === 'wall').length,
    maxAlive, t: Math.round(g.t), lvSum: g.blds.filter(b => b.kind === 'tower').reduce((a, b) => a + b.lv, 0), g };
}

module.exports = { run, AI, unlockedUpTo };
if (require.main === module) main();
function main() {
  const levels = D.levels.concat([D.endless]).filter(L => !onlyIds.length || onlyIds.includes(L.id));
  for (const L of levels) {
    const rs = [];
    for (let r = 0; r < runs; r++) rs.push(run(L, 1000 + r * 77));
    const line = rs.map(r => (r.win ? 'WIN' + r.stars + '★' : 'lose@' + r.k) + ' hp' + r.hp + ' leak' + r.leaks + ' kill' + r.kills + ' brk' + r.destroyed +
      ' T' + r.towers + '(Σlv' + r.lvSum + ') W' + r.walls + ' $' + r.gold + ' max' + r.maxAlive + ' ' + r.t + 's').join(' | ');
    console.log(String(L.id).padStart(2), L.n.padEnd(5, '　'), line);
    if (verbose) {
      const g = rs[0].g;
      for (let k = 1; k <= Math.min(g.k, 25); k++) { const w = g.genWave(k); console.log('   wave', k, 'hp×' + w.hpMul.toFixed(2), w.groups.map(x => D.cows[x.id].n + '×' + x.n).join(' ')); }
    }
  }
}
