// 介绍片素材：用一个「展示存档」截取各界面与多种地形的战斗画面（1920×1080 PNG）+ 统计数字
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome, Page, sleep } from './cdp.mjs';

const OUT = 'E:/game/video/intro/img';
fs.mkdirSync(OUT, { recursive: true });
const proc = await launchChrome({ userDir: 'E:/game/video/_work/profile_stills', port: 9666, width: 1280, height: 720 });
const p = await Page.connect(9666);
await p.send('Page.enable'); await p.send('Runtime.enable');
await p.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
p.on('Runtime.exceptionThrown', e => console.log('[EXC]', e.exceptionDetails.exception?.description?.slice(0, 200)));
await p.send('Page.navigate', { url: 'http://127.0.0.1:8765/index.html' });
for (let i = 0; i < 80; i++) { try { if (await p.eval(`!!(window.SVDEBUG && document.getElementById('loading').classList.contains('hide'))`)) break; } catch {} await sleep(150); }
await sleep(800);
const $ = c => p.eval(c);
const shot = async name => { await p.shot(path.join(OUT, name + '.png')); console.log('  shot', name); };
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log('!! ' + name + ': ' + e.message); } };

// ---------- 展示存档 ----------
const nums = await $(`(()=>{
  const G=SVDEBUG.G, D=SV.D, s=G.save;
  s.name='羊村卫士'; s.level=45; s.exp=0; s.silver=2000000; s.points=888; s.lollipop=30;
  for(let c=0;c<6;c++) for(let t=0;t<5;t++) s.gems[c][t]=[30,18,10,6,3][t];
  s.items.bomb=20; s.items.straw=[5,3,1]; s.items.phono=[5,3,1];
  D.maps.forEach((m,i)=>{ s.maps[i]={clears:2,best:(m.w&&m.w.sc)||1000,nm:30+(i*7)%60,wins:2,tries:3,bestTime:300,minCost:20000+i*1500}; });
  const ids=Object.keys(D.wolves); ids.forEach(id=>s.seen[id]=1);
  SV.CARDS.forEach((c,k)=>{ s.wolves.owned[c.id]={lv:8+k*3,exp:0,sk:[]}; }); s.wolves.team=['daomu3','fzswr','xuel_B','yangpil_A','tufeil'];
  s.daily2.last=G.today(); s.daily2.streak=3;
  s.tutorial.done=true; G.persist(true);
  return {maps:D.maps.length, wolves:ids.length, chapters:[...new Set(D.maps.map(m=>m.ch))].length};
})()`);
console.log('nums', nums);
const closeAll = () => $(`(()=>{const UI=SVDEBUG.UI; UI.closeAllModals&&UI.closeAllModals(); document.getElementById('toast-root').innerHTML=''; document.getElementById('banner-root').innerHTML='';})()`);

// ---------- 标题 / 大厅 / 世界地图 ----------
await step('title', async () => { await $(`SVDEBUG.UI.Menu.toTitle()`); await sleep(1200); await shot('title'); });
await step('hub', async () => { await $(`SVDEBUG.UI.Menu.toHub()`); await sleep(1200); await closeAll(); await sleep(500); await shot('hub'); });
for (const [ch, idx] of [[1, 3], [2, 15], [3, 30], [4, 39]]) {
  await step('world' + ch, async () => { await $(`(()=>{const UI=SVDEBUG.UI; UI.worldCh=${ch}; UI.Menu.selMap=${idx}; UI.Menu.toWorld(${ch});})()`); await sleep(1300); await closeAll(); await shot('world' + ch); });
}
await step('nightmare', async () => { await $(`SVDEBUG.UI.Menu.toWorld(1)`); await sleep(600); await $(`SVDEBUG.UI.Menu.nightmare(1)`); await sleep(700); await shot('p_nightmare'); await closeAll(); });

// ---------- 面板 ----------
const panels = [['gems', 'UI.Panels.gems()'], ['shop', 'UI.Panels.shop()'], ['mine', 'UI.Panels.mine()'], ['tasks', 'UI.Panels.tasks()'], ['friends', 'UI.Panels.friends()'],
  ['codex', 'UI.Panels.codex()'], ['camp', 'UI.Panels.camp()'], ['arena', 'UI.Arena.open()'], ['redeem', 'UI.Panels.redeem()'], ['help', 'UI.Panels.help()']];
await $(`SVDEBUG.UI.Menu.toHub()`); await sleep(900); await closeAll();
for (const [n, code] of panels) {
  await step('panel ' + n, async () => { await $(`(()=>{const UI=SVDEBUG.UI; UI.closeAllModals(); ${code}; })()`); await sleep(1100); await shot('p_' + n); await closeAll(); await sleep(200); });
}

// ---------- 战斗画面 ----------
// 演示用蛇形阵：与 2 分钟实机演示相同的布阵
const layoutDemo = `(()=>{const B=SVDEBUG.UI.Battle.B; const W=(x,y)=>B.build('wall',x,y,{}); const T=(x,y,type,lv,gem)=>B.build('tower',x,y,{type,lv,gem:gem||null});
  W(2,4);W(3,4);W(4,4);W(1,6);W(2,6);W(0,4); T(3,6,'sentry',10); T(4,6,'scatter',5); T(1,4,'cannon',5); T(2,8,'pulse',5); T(5,6,'sentry',5,{c:4,t:3}); return B.field.dist[B.map.spawns[0]];})()`;
await step('maze', async () => {
  await $(`(()=>{const UI=SVDEBUG.UI, BU=UI.Battle; const st=document.createElement('style'); st.id='hidestart'; st.textContent='.startbtn{visibility:hidden!important}'; document.head.appendChild(st); BU.enter(1,'normal',{}); BU.B.paused=false; BU.B.autoWave=false; BU.showPath=true; BU.showGrid=false; document.getElementById('toast-root').innerHTML='';})()`);
  await sleep(900);
  const before = await $(`SVDEBUG.UI.Battle.B.field.dist[SVDEBUG.UI.Battle.B.map.spawns[0]]`);
  await shot('maze_before');
  const after = await $(layoutDemo);
  await sleep(700);
  await shot('maze_after');
  nums.pathBefore = before; nums.pathAfter = after;
  console.log('  path', before, '->', after);
});

const battleMaps = [[1, 'forest'], [8, 'desert'], [7, 'ruins'], [11, 'volcano'], [18, 'snow'], [30, 'factory'], [37, 'town'], [39, 'glacier'], [42, 'lostcity'], [44, 'snowfield'], [4, 'canyon']];
for (const [idx, tag] of battleMaps) {
  await step('battle ' + tag, async () => {
    await $(`document.getElementById('hidestart') && document.getElementById('hidestart').remove()`);
    await $(`(()=>{const UI=SVDEBUG.UI, BU=UI.Battle; UI.closeAllModals(); BU.enter(${idx},'normal',{}); const B=BU.B; B.silver=1e9; try{ SV.AI.autoMaze(B,60);}catch(e){} for(let k=0;k<40;k++){ if(!SV.AI.step(B,{gems:true,maxTowers:13})) break; } BU.start(); BU.setSpeed(1); BU.showPath=false; BU.showGrid=false; })()`);
    // 推演：前几秒后拉一批「引狼」，等到狼多、火力全开再截图
    let best = 0;
    for (let round = 0; round < 60; round++) {
      await $(`(()=>{const B=SVDEBUG.UI.Battle.B; B.silver=Math.max(B.silver,1e9); for(let i=0;i<120;i++) B.update(1/60); if(${round}==3){ for(let k=0;k<6;k++) B.lure(); } if(${round}%8==7) SV.AI.step(B,{gems:true,maxTowers:13}); })()`);
      const alive = await $(`SVDEBUG.UI.Battle.B.wolves.filter(w=>w.alive).length`);
      if ((round > 6 && alive >= 14) || round >= 50) { best = alive; break; }
    }
    await $(`document.getElementById('toast-root').innerHTML=''; document.getElementById('banner-root').innerHTML=''; document.querySelectorAll('.bosscard').forEach(e=>e.remove()); SVDEBUG.UI.Battle.refreshAll()`);
    await sleep(350);
    await shot('battle_' + tag);
    console.log('  alive', best);
  });
}

fs.writeFileSync('E:/game/video/intro/numbers.json', JSON.stringify(nums, null, 1));
// 代码规模（不含带 “ (1)” 的副本）
const root = 'E:/game';
const count = f => fs.readFileSync(f, 'utf8').split('\n').length;
const jsDir = path.join(root, 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && !/ \(\d+\)\.js$/.test(f));
const lines = {}; let total = 0;
for (const f of jsFiles) { lines[f] = count(path.join(jsDir, f)); total += lines[f]; }
fs.writeFileSync('E:/game/video/intro/code_stats.json', JSON.stringify({ files: lines, total, jsCount: jsFiles.length }, null, 1));
console.log('js files', jsFiles.length, 'total lines', total);
p.close(); proc.kill(); process.exit(0);
