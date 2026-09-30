// 介绍片渲染：intro.html 按时间 t 确定性渲染，逐帧 CDP 截图 → 60fps
// 用法: node render_intro.mjs [--test t1,t2,...]   （--test 只截几张检查版式）
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome, Page, sleep } from './cdp.mjs';
import { encodeSeq } from './assemble.mjs';

const OUT = 'E:/game/video/_work/intro_frames';
const FPS = 60;
const range = process.argv.includes('--range') ? process.argv[process.argv.indexOf('--range') + 1].split(',').map(Number) : null;
const test = process.argv.includes('--test') ? process.argv[process.argv.indexOf('--test') + 1].split(',').map(Number) : null;
const proc = await launchChrome({ userDir: 'E:/game/video/_work/profile_intro', port: 9777, width: 1920, height: 1080 });
const p = await Page.connect(9777);
await p.send('Page.enable'); await p.send('Runtime.enable');
await p.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
p.on('Runtime.exceptionThrown', e => console.log('[EXC]', e.exceptionDetails.exception?.description?.slice(0, 300) || e.exceptionDetails.text));
await p.send('Page.navigate', { url: 'http://127.0.0.1:8765/video/intro/intro.html' });
await sleep(1200);
const cfg = {
  dur: JSON.parse(fs.readFileSync('E:/game/video/tts_intro/durations.json', 'utf8')),
  texts: JSON.parse(fs.readFileSync('E:/game/video/narration_intro.json', 'utf8')),
  nums: JSON.parse(fs.readFileSync('E:/game/video/intro/numbers.json', 'utf8')),
  code: JSON.parse(fs.readFileSync('E:/game/video/intro/code_stats.json', 'utf8')),
};
const plan = await p.eval(`window.setup(${JSON.stringify(cfg)})`);
console.log('total', plan.total.toFixed(2), 's', JSON.stringify(plan.scenes.map(s => [s[0], +s[1].toFixed(2), +s[2].toFixed(2)])));
fs.mkdirSync('E:/game/video/_work', { recursive: true });
fs.writeFileSync('E:/game/video/_work/intro_plan.json', JSON.stringify(plan));

if (test) {
  fs.mkdirSync('E:/game/video/_work/intro_test', { recursive: true });
  for (const t of test) { await p.eval(`renderAt(${t})`); await p.shot(`E:/game/video/_work/intro_test/t${String(t).replace('.', '_')}.png`); }
  console.log('test frames done');
} else {
  if (!range) { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
  const N = Math.ceil(plan.total * FPS);
  const f0 = range ? Math.floor(range[0] * FPS) : 0, f1 = range ? Math.min(N, Math.ceil(range[1] * FPS)) : N;
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await p.eval(`renderAt(${(f / FPS).toFixed(5)})`);
    const r = await p.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
    fs.writeFileSync(path.join(OUT, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64'));
    if (f % 300 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log('rendered', N, 'frames');
}
p.close(); proc.kill(); process.exit(0);
