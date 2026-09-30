// 2 分钟实机演示：全自动操作 + 录制
import fs from 'node:fs';
import { Recorder } from './recorder.mjs';
import { sleep } from './cdp.mjs';

const OUT = process.env.OUT || 'E:/game/video/_work/rec_demo';
const R = new Recorder({ outDir: OUT, profile: 'E:/game/video/_work/profile_demo', url: 'http://127.0.0.1:8765/index.html', quality: 90 });
R.durations = JSON.parse(fs.readFileSync('E:/game/video/tts_demo/durations.json', 'utf8'));
R.texts = JSON.parse(fs.readFileSync('E:/game/video/narration_demo.json', 'utf8'));
await R.open();
const d = R.d, p = R.p;
const $ = code => p.eval(code);

// ---------- 工具 ----------
const cellXY = (cx, cy) => $(`(()=>{const R=SVDEBUG.UI.renderer,r=R.cv.getBoundingClientRect();return [r.left+(R.ox+(${cx}+.5)*R.cs)/R.W*r.width, r.top+(R.oy+(${cy}+.5)*R.ch)/R.H*r.height, R.cs*r.width/R.W, R.ch*r.height/R.H]})()`);
async function clickCell(cx, cy, opts) { const [x, y] = await cellXY(cx, cy); await d.click(x, y, opts); }
async function ringCells(x0, y0, x1, y1, pad = 4) {
  const [ax, ay, cw, ch] = await cellXY(x0, y0), [bx, by] = await cellXY(x1, y1);
  await d.ring(ax - cw / 2 - pad, ay - ch / 2 - pad, bx - ax + cw + pad * 2, by - ay + ch + pad * 2);
}
// 按住鼠标沿一行拖过去连续造墙（先记下起点格，避免第一次移动又对起点格重复放置而弹出「格子已被占用」）
async function dragCells(x0, y0, x1, y1, ms = 700) {
  const [ax, ay] = await cellXY(x0, y0), [bx, by] = await cellXY(x1, y1);
  await d.moveTo(ax, ay, 450); await sleep(80);
  await d.down(); await sleep(50);
  await $(`SVDEBUG.UI.Battle.lastPaint=${y0 * 100 + x0}`);
  await d.moveTo(bx, by, ms, true);
  await sleep(80); await d.up(); await sleep(120);
}
async function wheelPane(dy) { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 1130, y: 420, deltaX: 0, deltaY: dy }); await sleep(380); }
const wolfPos = uid => $(`(()=>{const R=SVDEBUG.UI.renderer,B=SVDEBUG.UI.Battle.B,r=R.cv.getBoundingClientRect();
  const c=B.wolves.find(w=>w.uid===${uid}&&w.alive); if(!c) return null;
  const wx=R.ox+c.x*R.cs, wy=R.oy+(c.y+0.05)*R.ch-(c.fly?R.cs*0.4:0)-R.cs*0.28;
  return {x:r.left+wx/R.W*r.width,y:r.top+wy/R.H*r.height,name:c.def.n}})()`);
const st = () => $(`(()=>{const B=SVDEBUG.UI.Battle.B;return {silver:Math.round(B.silver),lives:B.lives,prog:Math.round(B.progress),wave:B.waveNo,alive:B.wolves.filter(w=>w.alive).length,speed:SVDEBUG.UI.Battle.speed,bombs:B.bombAvail(),towers:B.buildings.filter(b=>b.kind==='tower').length}})()`);
const log = async tag => console.log('   ', tag, JSON.stringify(await st()));
// 出错不中断整段录制
const safe = (name, fn) => async () => { try { await fn(); } catch (e) { console.log('!! 步骤失败', name, e.message); } };
const hoverSel = async (sel, ms = 480) => { const r = await d.rectOf(sel); if (r) await d.moveTo(r.cx, r.cy, ms); return r; };

await R.startAudio();
await R.startVideo();
await R.wait(1.2);                                   // 标题画面（有动画）停留一下

// ================= 开局 =================
await R.say('d01', safe('d01', async () => { await d.clickText('开始游戏'); await sleep(500); }));
await R.say('d02', safe('d02', async () => {
  await sleep(350);
  await d.type('羊村卫士', 110);
  await sleep(250);
  await d.clickText('出发');
}));
await R.say('d03', safe('d03', async () => {
  await sleep(1100);
  await d.clickText('领取奖励'); await sleep(650);
  await d.clickText('好的');
}));

// ================= 大厅 =================
await $(`(()=>{const G=SVDEBUG.G; G.save.maps[0]={clears:1,best:40,nm:0,wins:1,tries:1,bestTime:210}; G.save.tutorial.done=true;})()`);   // 第一关视为已通关、教程已看过
await R.say('d04', safe('d04', async () => {
  for (const id of ['mine', 'shop', 'work', 'arena', 'lib']) { await hoverSel(`.hotspot[data-id=${id}]`, 520); await sleep(600); }
}));
await R.say('d04b', safe('d04b', async () => {
  await d.clickSel('.hotspot[data-id=work]', { ms: 500 }); await sleep(2200);
  await d.clickSel('#modal-root .x', { ms: 500 });
}));

// ================= 世界地图 =================
await R.say('d05', safe('d05', async () => {
  await $(`(()=>{const s=document.createElement('style');s.id='hidestart';s.textContent='.startbtn{visibility:hidden!important}';document.head.appendChild(s)})()`);   // 建造阶段先藏起「开始迎战」，免得挡住棋盘
  await d.clickSel('.hotspot[data-id=gate]', { ms: 600 }); await sleep(900);
  for (const t of ['第二大陆', '第三大陆', '第四大陆', '第一大陆']) { await d.clickText(t, { scope: '#scr-world .chtab', ms: 320, pause: 30 }).catch(() => {}); await sleep(200); }
  await d.clickText('比丘村', { scope: '.mapnode', ms: 600 }); await sleep(600);
  await d.clickText('出征', { scope: '#scr-world .btn', ms: 500 });
}));

// ================= 战斗 =================
R.capPos = { left: 292, top: 112, maxWidth: 500, font: 24 };
await R.say('b01', safe('b01', async () => {
  await sleep(500);
  await ringCells(0, 0, 0, 0); await cellXY(0, 0).then(([x, y]) => d.moveTo(x + 30, y + 30, 500));
  await sleep(1300);
  await d.clearRings();
  await ringCells(6, 7, 6, 7); await cellXY(6, 7).then(([x, y]) => d.moveTo(x, y, 800));
  await sleep(800); await d.clearRings();
}));
await R.say('b02', safe('b02', async () => {
  await wheelPane(520);
  await d.clickText('墙 (Q)', { scope: '.bpane .card', ms: 600 });
  await dragCells(2, 4, 4, 4, 720);
  await dragCells(1, 6, 2, 6, 520);
  await clickCell(0, 4, { ms: 420 });
  await wheelPane(-900);
}));
await R.say('b04', safe('b04', async () => {
  await d.clickSel('.tcard[data-tp=sentry]', { ms: 600 });
  await d.ringSel('.tcard[data-tp=sentry]'); await sleep(1100); await d.clearRings();
}));
await R.say('b05', safe('b05', async () => {
  await d.ringSel('.lvctl'); await sleep(450);
  await d.clickText('10', { scope: '.bpane .btn.xs', ms: 500 });
  await sleep(450); await d.clearRings();
  await clickCell(3, 6, { ms: 600 });
}));
await R.say('b05b', safe('b05b', async () => {
  await d.clickSel('.tcard[data-tp=scatter]', { ms: 450 });
  await d.clickText('5', { scope: '.bpane .btn.xs', ms: 350 });
  await clickCell(4, 6, { ms: 500 });
  await d.clickSel('.tcard[data-tp=cannon]', { ms: 450 });
  await clickCell(1, 4, { ms: 500 });
  await d.clickSel('.tcard[data-tp=pulse]', { ms: 450 });
  await clickCell(2, 8, { ms: 500 });
}));
await log('after towers');
await R.say('b06', safe('b06', async () => {
  await d.clickSel('.tcard[data-tp=sentry]', { ms: 450 });
  await d.ringSel('.gempick');
  const gps = await $(`[...document.querySelectorAll('.gempick .gp')].map(e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})`);
  for (let i = 1; i <= 6; i++) { await d.moveTo(gps[i][0], gps[i][1], 240); await sleep(150); }     // 红绿黄紫蓝黑
  await d.click(gps[5][0], gps[5][1], { ms: 300 });                                                   // 蓝宝石
  await sleep(300);
  const tiers = await $(`[...document.querySelectorAll('.tiers .tr')].map(e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})`);
  if (tiers[2]) await d.click(tiers[2][0], tiers[2][1], { ms: 400 });
  await d.clearRings(); await d.ringSel('.effects'); await sleep(1200); await d.clearRings();
  await clickCell(5, 6, { ms: 650 });
  await d.key('Escape');                                                                              // 退出建造模式（否则鼠标上一直挂着塔的预览圈）
}));
await log('after gem');
await R.say('b03', safe('b03', async () => {
  await d.key('p'); await sleep(300);
  await ringCells(0, 3, 5, 7, 2); await cellXY(3, 5).then(([x, y]) => d.moveTo(x, y, 700));
  await sleep(1500); await d.clearRings();
}));
await R.say('b07', safe('b07', async () => {
  await $(`document.getElementById('hidestart').remove()`);
  for (let k = 0; k < 3; k++) {
    await d.clickSel('.startbtn', { ms: k ? 300 : 700 });
    await sleep(450);
    if (await $(`SVDEBUG.UI.Battle.B.started`)) break;
    const top = await $(`(()=>{const e=document.elementFromPoint(${d.x},${d.y});return e?e.tagName+'.'+e.className+'#'+e.id:null})()`);
    console.log('   开战点击未生效，重试', k + 1, 'top element =', top);
  }
}));
await log('battle started');
await R.say('b08', safe('b08', async () => {
  await d.key('Escape');
  await sleep(500);
  let uid = null;
  for (let i = 0; i < 60 && !uid; i++) { uid = await $(`(()=>{const B=SVDEBUG.UI.Battle.B;const a=B.wolves.filter(w=>w.alive&&w.y>1.0).sort((x,y)=>y.maxhp-x.maxhp);return a[0]?a[0].uid:null})()`); if (!uid) await sleep(250); }
  if (!uid) { console.log('   (没找到狼)'); return; }
  const w0 = await wolfPos(uid); console.log('   focus wolf:', w0 && w0.name);
  await d.key('p');                                                    // 关掉路线
  if (w0) await d.moveTo(w0.x, w0.y, 500);
  for (let i = 0; i < 18; i++) { const n = await wolfPos(uid); if (!n) break; await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: n.x, y: n.y, button: 'none' }); d.x = n.x; d.y = n.y; await sleep(110); }
  const n = await wolfPos(uid); if (n) { d.x = n.x; d.y = n.y; await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: n.x, y: n.y, button: 'none' }); await d.down(); await sleep(60); await d.up(); }
  await sleep(1500);
}));
await log('after hover');
// 选中某座塔并点升级按钮（银币不够就跳过）
async function upgradeAt(cx, cy, label = '+10', ms = 500) {
  await clickCell(cx, cy, { ms });
  await sleep(350);
  const ok = await $(`(()=>{const b=[...document.querySelectorAll('.bpane .btn')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)})&&!e.className.includes('gray'));return !!b})()`);
  if (ok) { await d.clickText(label, { scope: '.bpane .btn', ms: 350 }); await sleep(250); }
  return ok;
}
await R.say('b09', safe('b09', async () => {
  await $(`(()=>{const BU=SVDEBUG.UI.Battle; BU.focus=0; BU.B.focusId=0;})()`);
  await d.clickText('2x', { scope: '.ctl .spd', ms: 500 });
  await clickCell(1, 4, { ms: 600 });
  await sleep(450);
  await d.ringSel('.bpane'); await sleep(500); await d.clearRings();
  await d.clickText('+5', { scope: '.bpane .btn', ms: 450 }).catch(() => {});
  await sleep(500);
  await d.clickText('+10', { scope: '.bpane .btn', ms: 300 }).catch(() => {});
  await upgradeAt(3, 6, '+10', 450);
  await upgradeAt(4, 6, '+10', 400);
}));
await log('after upgrade');
await R.say('b10', safe('b10', async () => {
  await d.key('b'); await sleep(200);
  await clickCell(3, 4, { ms: 650 });
  await ringCells(3, 4, 3, 4); await sleep(1300); await d.clearRings();
  await d.key('Escape');
}));
await log('after bomb');
const callNext = () => d.clickText('立即召唤下一波', { scope: '#scr-battle button', ms: 500 }).catch(() => {});
await R.say('b11', safe('b11', async () => {
  await d.clickText('4x', { scope: '.ctl .spd', ms: 600 });
  await d.ringSel('.bprog'); await sleep(500);
  await callNext(); await sleep(500); await d.clearRings();
  await upgradeAt(1, 4, '+10', 500);
  await callNext(); await sleep(600);
  await upgradeAt(5, 6, '+10', 500);
}));
await log('after speed');
// 等 BOSS 登场卡出现（最多 12 秒；期间隔一阵召唤下一波加快进度，银币多了就顺手升级）
const towerCells = [[1, 4], [3, 6], [4, 6], [5, 6], [2, 8]];
let upi = 0;
for (let i = 0; i < 48; i++) {
  if (await $(`!!document.querySelector('.bosscard')`)) break;
  if (i > 0 && i % 8 === 0) await callNext();
  if (i > 0 && i % 6 === 3 && (await st()).silver > 1500) { const [cx, cy] = towerCells[upi++ % towerCells.length]; await upgradeAt(cx, cy, '+10', 400); }
  await sleep(250);
}
await log('boss?');
R.autoCap = false;
await R.say('b12', safe('b12', async () => { await d.cap(''); await sleep(2600); }));
R.autoCap = true;
R.capPos = null;
await R.say('e01', safe('e01', async () => {
  await d.cap('');
  await d.endCard('保卫羊村 · 怀旧服', '纯前端 HTML5 塔防 · 双击 index.html 即玩');
  await sleep(1500);
}), { gap: 1.2 });
await log('end');

const meta = await R.finish();
await R.stopAudio(OUT + '/game_audio.webm');
console.log('frames', meta.frames.length, 'fps', meta.fps.toFixed(1), 'dur', (meta.endTs - meta.frames[0]).toFixed(1), 's', 'audio offset', ((meta.audioT0 / 1000) - meta.frames[0]).toFixed(3));
R.close();
process.exit(0);
