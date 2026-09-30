// 封面：cover/cover.html → 1920×1200(16:10)、1146×717(B站推荐尺寸)、1920×1080(16:9)
import fs from 'node:fs';
import { launchChrome, Page, sleep } from './cdp.mjs';
import { run } from './assemble.mjs';
const OUT = 'E:/game/video/cover';
const TMP = 'E:/game/video/_work_cover';
const proc = await launchChrome({ userDir: TMP, port: 9880, width: 1920, height: 1200 });
const p = await Page.connect(9880);
await p.send('Page.enable'); await p.send('Runtime.enable');
const url = 'file:///E:/game/video/cover/cover.html';
for (const [name, w, h] of [['cover_16x10', 1920, 1200], ['cover_16x9', 1920, 1080]]) {
  await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await p.send('Page.navigate', { url });
  await sleep(1500);
  await p.eval(`document.fonts.ready.then(()=>1)`);
  await p.shot(`${OUT}/${name}.png`);
  console.log('saved', name);
}
p.close(); proc.kill();
run(['-y', '-i', `${OUT}/cover_16x10.png`, '-vf', 'scale=1146:717:flags=lanczos', '-frames:v', '1', `${OUT}/cover_bilibili_1146x717.png`], { quiet: true });
await sleep(800);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
console.log('done'); process.exit(0);
