/* 引擎 + 存档逻辑自检（无依赖，Node 直接跑）：node tools/selftest.js
 * 不开浏览器，只加载 js/ 下的纯逻辑文件，检查结算守恒和几处修过的 bug，再把 46 张图各推演一段。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const mem = {};
const ctx = {
  console, Math, Date, JSON, btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } }
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['data', 'core', 'battle', 'combat', 'ai', 'codes', 'game', 'features', 'camp'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
const SV = ctx.SV, G = SV.Game;
SV.Audio = { play() {} };

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const clone = o => JSON.parse(JSON.stringify(o));
const addGems = (acc, list) => { for (const l of list || []) { if (l.type === 'gem') acc[l.c][l.t - 1] += l.n || 1; else if (l.type === 'bag') acc[5][4]++; } };
const freeCells = B => { const out = []; for (let y = 0; y < B.rows; y++) for (let x = 0; x < B.cols; x++) if (B.cellFree(x, y) && B.map.type[y * B.cols + x] === 1) out.push([x, y]); return out; };

G.load();
const fill = () => { for (let c = 0; c < 6; c++) for (let t = 0; t < 5; t++) G.save.gems[c][t] = 4; };

// 1. 结算后宝石守恒：战前库存 + 战利品 = 战后库存（塔上镶的、噩梦赠送的都要算清）
for (const mode of ['normal', 'nightmare']) {
  G.save.level = 60; fill();
  const before = clone(G.save.gems);
  const B = G.startBattle(3, mode, {});
  B.silver = 5e6;
  freeCells(B).slice(0, 6).forEach(([x, y], k) => B.build('tower', x, y, { type: ['sentry', 'pulse', 'inlay'][k % 3], lv: 30, gem: { c: k % 6, t: 1 + k % 5 } }));
  B.startBattle();
  for (let k = 0; k < 20 * 300 && !B.over; k++) { B.update(1 / 20); if (k % 20 === 0) SV.AI.step(B, {}); }
  if (!B.over) B.retreat();
  const out = G.finishBattle(B), want = clone(before);
  addGems(want, out.lootList); addGems(want, out.dropList);
  check(JSON.stringify(want) === JSON.stringify(G.save.gems), mode + '：结算后宝石守恒');
}
fill();
const g0 = JSON.stringify(G.save.gems);
G.startBattle(3, 'nightmare', {}); G.abortBattle();
check(g0 === JSON.stringify(G.save.gems), '噩梦中途退出：收回赠送的精华');

// 2. 存档导出 / 导入（浏览器禁用存储时也要生效）
G.save.name = '自检村长';
const code = G.exportCode();
G.save.name = 'x';
check(G.importCode(code) && G.save.name === '自检村长', '存档导出导入往返');
const ls = ctx.localStorage;
ctx.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
G.save.name = 'y';
check(G.importCode(code) && G.save.name === '自检村长', '禁用 localStorage 时导入');
ctx.localStorage = ls;

// 3. 首通狼卡奖励的地图与狼卡「获取方式」一致
const cards = Function('return ' + fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8').match(/const cards = (\{[^}]+\})/)[1])();
for (const k in cards) {
  const get = SV.CARD[cards[k]].get, name = SV.D.maps[k].n;
  check(get.includes(name) || get.includes('之前'), '狼卡 ' + cards[k] + '：第 ' + k + ' 关「' + name + '」 ↔ ' + get);
}

// 4. 减速叠加与施加顺序无关；波动塔黑宝石的连击能触发
const B0 = new SV.Battle({ mapIdx: 0, seed: 1 });
const sv = s => B0.slowValue({ slows: s.map(v => ({ v, t: 1 })) });
check(Math.abs(sv([0.2, 0.3]) - sv([0.3, 0.2])) < 1e-9, '减速叠加与顺序无关');
let combo = 0;
for (let seed = 1; seed <= 60; seed++) {
  const B = new SV.Battle({ mapIdx: 0, seed }); B.silver = 1e7;
  const [x, y] = freeCells(B)[0], b = B.build('tower', x, y, { type: 'pulse', lv: 50, gem: { c: 5, t: 5 } }).b, st = B.towerStats(b);
  const w = B.spawnWolf(Object.keys(SV.D.wolves)[0], { x: x + 1.5, y: y + 0.5, hp: 1e9 }), hp = w.hp;
  B.fireBeam(b, st, w);
  if (hp - w.hp > st.dmg * 1.5) combo++;
}
check(combo > 0, '波动塔黑宝石连击（' + combo + '/60 次触发）');

// 5. 46 张图各推演 3 分钟：不抛异常
let crashed = 0;
for (let i = 0; i < SV.D.maps.length; i++) {
  try { SV.simulate(i, { silver: 20000, level: 30, gems: 3, maxT: 180, newLv: 20 }); }
  catch (e) { crashed++; console.log('FAIL 第 ' + i + ' 关：' + e.stack.split('\n').slice(0, 2).join(' | ')); }
}
check(!crashed, SV.D.maps.length + ' 张图推演无异常');

console.log(fails ? '\n' + fails + ' 项失败' : '\n全部通过');
process.exit(fails ? 1 : 0);
