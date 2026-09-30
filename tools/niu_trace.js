/* 牛来攻城 —— 单关逐波追踪（node tools/niu_trace.js 关卡号 [种子]）：打印 AI 的布阵和每波漏牛/击杀 */
'use strict';
const { AI, unlockedUpTo } = require('./niu_sim.js');
const NL = global.NL, D = NL.D;
const id = +(process.argv[2] || 1), seed = +(process.argv[3] || 1000);
const L = id === 99 ? D.endless : D.levels.find(l => l.id === id);
const g = new NL.Game(L, { seed, unlocked: unlockedUpTo(id) }), ai = new AI(g);
const show = () => {
  let s = '';
  for (let y = 0; y < g.rows; y++) {
    for (let x = 0; x < g.cols; x++) { const i = y * g.cols + x, b = g.occ[i]; s += b ? (b.kind === 'tower' ? b.type[0] + b.lv : b.kind === 'wall' ? '##' : '??') : (g.chr[i] === '.' ? '· ' : g.chr[i] + ' '); }
    s += '\n';
  }
  console.log(s);
};
ai.tick(); ai.tick(); show(); g.callWave();
let acc = 0, lastK = 1, lk = 0, kk = 0, evs = {};
while (!g.over && g.t < 3600) {
  g.update(1 / 30); acc += 1 / 30; if (acc >= 1) { acc = 0; ai.tick(); }
  for (const e of g.drain()) { if (e.type === 'destroy') evs['塌' + e.b.kind] = (evs['塌' + e.b.kind] || 0) + 1; if (e.type === 'sell') evs['卖' + e.b.kind] = (evs['卖' + e.b.kind] || 0) + 1; }
  if (g.k !== lastK) { const w = g.genWave(lastK); console.log('wave', lastK, w.groups.map(x => D.cows[x.id].n + '×' + x.n).join(' '), 'hp×' + w.hpMul.toFixed(2), '| leaks', g.stats.leaks - lk, 'kills', g.stats.kills - kk, 'gold', g.gold, 'towers', g.blds.filter(b => b.kind === 'tower').map(b => b.type[0] + b.lv).join(''), 'len', g.pathLen(g.fN).toFixed(0), JSON.stringify(evs)); evs = {}; lk = g.stats.leaks; kk = g.stats.kills; lastK = g.k; }
}
show(); console.log('win', g.win, 'hp', g.hp, 'stars', g.stars(), 'dmg', Math.round(g.stats.dmg));
