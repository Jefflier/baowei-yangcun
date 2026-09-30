import { launchChrome, Page, sleep } from './cdp.mjs';
const proc = await launchChrome({ userDir: 'E:/game/video/_work/profile_title', port: 9668, width: 1280, height: 720 });
const p = await Page.connect(9668);
await p.send('Page.enable'); await p.send('Runtime.enable');
await p.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
await p.send('Page.navigate', { url: 'http://127.0.0.1:8765/index.html' });
for (let i = 0; i < 80; i++) { try { if (await p.eval(`!!(window.SVDEBUG && document.getElementById('loading').classList.contains('hide'))`)) break; } catch {} await sleep(150); }
await sleep(1500);
await p.eval(`(()=>{const s=document.createElement('style');s.textContent='#scr-title .menu,#scr-title .foot{display:none!important}';document.head.appendChild(s);})()`);
await sleep(600);
await p.shot('E:/game/video/intro/img/title.png');
console.log('ok'); p.close(); proc.kill(); process.exit(0);
