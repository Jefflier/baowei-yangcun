// 极简 Chrome DevTools Protocol 客户端（Node 22 自带 WebSocket，零依赖）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launchChrome({ port = 9333, width = 1280, height = 720, userDir, extra = [] } = {}) {
  fs.mkdirSync(userDir, { recursive: true });
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion',
    '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--allow-file-access-from-files',
    ...extra, 'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore', detached: false });
  // 等调试端口起来
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) break; } catch {}
    await sleep(150);
  }
  return proc;
}

export class Page {
  static async connect(port = 9333) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const t = list.find(x => x.type === 'page');
    const p = new Page(t.webSocketDebuggerUrl);
    await p.ready;
    return p;
  }
  constructor(url) {
    this.id = 0; this.cb = new Map(); this.handlers = new Map();
    this.ws = new WebSocket(url);
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.cb.has(m.id)) { const { res, rej } = this.cb.get(m.id); this.cb.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) { (this.handlers.get(m.method) || []).forEach(f => f(m.params)); }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.cb.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(ev, fn) { if (!this.handlers.has(ev)) this.handlers.set(ev, []); this.handlers.get(ev).push(fn); }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async shot(file, opts = {}) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', ...opts });
    if (file) fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return r.data;
  }
  close() { try { this.ws.close(); } catch {} }
}
