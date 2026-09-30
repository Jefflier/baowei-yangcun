// 录制器：CDP screencast 抓帧（1920×1080 @ ≤60fps）+ 页面内旁路录游戏音频 + 旁白时间轴
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome, Page, sleep } from './cdp.mjs';
import { Driver } from './driver.mjs';

export class Recorder {
  constructor({ outDir, port = 9555, width = 1280, height = 720, dsf = 1.5, url, profile, quality = 90 }) {
    Object.assign(this, { outDir, port, width, height, dsf, url, profile, quality });
    this.frames = []; this.narr = []; this.events = []; this.pendingWrites = 0; this.recording = false;
  }
  async open() {
    fs.rmSync(this.outDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.outDir, 'frames'), { recursive: true });
    fs.rmSync(this.profile, { recursive: true, force: true });
    this.proc = await launchChrome({ userDir: this.profile, width: this.width, height: this.height, port: this.port });
    this.p = await Page.connect(this.port);
    const p = this.p;
    await p.send('Page.enable'); await p.send('Runtime.enable');
    await p.send('Emulation.setDeviceMetricsOverride', { width: this.width, height: this.height, deviceScaleFactor: this.dsf, mobile: false });
    p.on('Runtime.exceptionThrown', e => console.log('[page EXC]', e.exceptionDetails.exception?.description?.slice(0, 300) || e.exceptionDetails.text));
    p.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') console.log('[page ERR]', e.args.map(a => a.value || a.description).join(' ').slice(0, 300)); });
    await p.send('Page.navigate', { url: this.url });
    for (let i = 0; i < 80; i++) { try { if (await p.eval(`!!(window.SVDEBUG && document.getElementById('loading').classList.contains('hide'))`)) break; } catch {} await sleep(150); }
    await sleep(600);
    this.d = new Driver(p);
    await this.d.init();
    return this;
  }
  // 音频旁路：把 SV.Audio.master 再接到 MediaStreamDestination 录成 webm/opus
  async startAudio() {
    return await this.p.eval(`(async()=>{
      const A=SV.Audio; A.init(); if(A.ctx.state!=='running') await A.ctx.resume();
      const dest=A.ctx.createMediaStreamDestination(); A.master.connect(dest);
      window.__aud={chunks:[],t0:0};
      const rec=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:192000});
      rec.ondataavailable=e=>{ if(e.data.size) window.__aud.chunks.push(e.data); };
      rec.onstart=()=>{ window.__aud.t0=Date.now(); };
      window.__aud.rec=rec; rec.start(500);
      return A.ctx.state;
    })()`);
  }
  async stopAudio(file) {
    const b64 = await this.p.eval(`(async()=>{
      const rec=window.__aud.rec; await new Promise(r=>{rec.onstop=r; rec.stop();});
      const blob=new Blob(window.__aud.chunks,{type:'audio/webm'});
      return await new Promise(res=>{const fr=new FileReader(); fr.onload=()=>res(fr.result.split(',')[1]); fr.readAsDataURL(blob);});
    })()`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    this.audioT0 = await this.p.eval('window.__aud.t0');
  }
  async startVideo() {
    const p = this.p;
    p.on('Page.screencastFrame', e => {
      if (!this.recording) { p.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {}); return; }
      const i = this.frames.length, ts = e.metadata.timestamp;
      this.frames.push(ts);
      this.pendingWrites++;
      fs.writeFile(path.join(this.outDir, 'frames', `f${String(i).padStart(6, '0')}.jpg`), Buffer.from(e.data, 'base64'), () => { this.pendingWrites--; });
      p.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
    });
    this.recording = true;
    await p.send('Page.startScreencast', { format: 'jpeg', quality: this.quality, maxWidth: Math.round(this.width * this.dsf), maxHeight: Math.round(this.height * this.dsf), everyNthFrame: 1 });
    this.t0 = Date.now();
  }
  now() { return (Date.now() - this.t0) / 1000; }
  // 旁白：记录起点，动作与语音并行，两者都完成才继续
  async say(id, actions, { gap = 0.25 } = {}) {
    const dur = this.durations ? this.durations[id] : 0;
    if (this.durations && dur == null) throw new Error('无旁白时长: ' + id);
    const start = this.now();
    this.narr.push({ id, start });
    const text = this.texts && this.texts[id];
    if (text && this.autoCap !== false) await this.d.cap(text.replace(/([一二三]招，[^。，]{0,4})/, '<b>$1</b>'), this.capPos || null);
    console.log(`[${start.toFixed(1)}s] ${id}${dur ? ' (' + dur.toFixed(1) + 's)' : ''}`);
    const act = actions ? Promise.resolve(actions()) : Promise.resolve();
    await act;
    const left = start + (dur || 0) + gap - this.now();
    if (left > 0) await sleep(left * 1000);
  }
  async wait(sec) { await sleep(sec * 1000); }
  async finish(file = 'meta.json') {
    const endTs = Date.now() / 1000;
    await sleep(400);
    this.recording = false;
    await this.p.send('Page.stopScreencast').catch(() => {});
    while (this.pendingWrites > 0) await sleep(50);
    const audioT0 = await this.p.eval('window.__aud ? window.__aud.t0 : 0').catch(() => 0);
    const meta = { t0: this.t0 / 1000, frames: this.frames, endTs, narr: this.narr, audioT0, events: this.events, fps: this.frames.length / (endTs - this.frames[0]) };
    fs.writeFileSync(path.join(this.outDir, file), JSON.stringify(meta));
    return meta;
  }
  close() { try { this.p.close(); } catch {} try { this.proc.kill(); } catch {} }
}
