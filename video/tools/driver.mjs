// 「真人操作」驱动：平滑鼠标轨迹 + 页面内假光标/点击涟漪 + 字幕/高亮圈
import fs from 'node:fs';
import { sleep } from './cdp.mjs';

const OVERLAY_JS = fs.readFileSync(new URL('./overlay.js', import.meta.url), 'utf8');

const ease =t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class Driver {
  constructor(page) { this.p = page; this.x = 640; this.y = 360; }
  async init() { await this.p.eval(OVERLAY_JS); await this.p.eval(`__ov.curXY(${this.x},${this.y})`); }
  // 平滑移动（略带弧度）
  async moveTo(x, y, ms = 650, straight = false) {
    const x0 = this.x, y0 = this.y, dx = x - x0, dy = y - y0, dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    if (!straight) ms = Math.max(140, Math.min(ms, 120 + dist * 1.1));
    const nx = -dy / dist, ny = dx / dist, bend = straight ? 0 : Math.min(60, dist * 0.08) * (Math.random() < .5 ? 1 : -1);
    const t0 = Date.now();
    for (;;) {
      const k = Math.min(1, (Date.now() - t0) / ms), e = ease(k), b = Math.sin(Math.PI * e) * bend;
      const cx = x0 + dx * e + nx * b, cy = y0 + dy * e + ny * b;
      await this.p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy, button: 'none' });
      if (k >= 1) break;
      await sleep(8);
    }
    this.x = x; this.y = y;
  }
  // 按住左键沿直线拖过去（连续造墙）
  async drag(x0, y0, x1, y1, ms = 900) {
    await this.moveTo(x0, y0, 450); await sleep(80);
    await this.down(); await sleep(60);
    await this.moveTo(x1, y1, ms, true);
    await sleep(80); await this.up(); await sleep(120);
  }
  async down(button = 'left') { await this.p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: this.x, y: this.y, button, buttons: button === 'left' ? 1 : 2, clickCount: 1 }); }
  async up(button = 'left') { await this.p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: this.x, y: this.y, button, buttons: 0, clickCount: 1 }); }
  async click(x, y, { ms = 650, pause = 90, button = 'left' } = {}) {
    if (x != null) await this.moveTo(x, y, ms);
    await sleep(pause);
    await this.down(button); await sleep(60); await this.up(button);
    await sleep(pause);
  }
  // DOM 元素中心（CSS 像素）
  async rectOf(sel) {
    return await this.p.eval(`(() => { const e = typeof ${JSON.stringify(sel)} === 'string' ? document.querySelector(${JSON.stringify(sel)}) : null; if(!e) return null; const r = e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}; })()`);
  }
  async clickSel(sel, opts = {}) {
    const r = await this.rectOf(sel);
    if (!r) throw new Error('找不到元素: ' + sel);
    await this.click(r.cx, r.cy, opts);
  }
  // 按文字找按钮/元素
  async rectByText(text, scope = 'button, .btn, .tcard, .chtab, .t, .mapnode, .hotspot, div') {
    return await this.p.eval(`(() => { const t=${JSON.stringify(text)}; const els=[...document.querySelectorAll(${JSON.stringify(scope)})].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(e.textContent||'').includes(t)&&e.offsetParent!==null}); els.sort((a,b)=>(a.textContent.length-b.textContent.length)); const e=els[0]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}; })()`);
  }
  async clickText(text, opts = {}) {
    const r = await this.rectByText(text, opts.scope);
    if (!r) throw new Error('找不到文字: ' + text);
    await this.click(r.cx, r.cy, opts);
  }
  async key(k, { hold = 60 } = {}) {
    const map = { ' ': ['Space', 32], Enter: ['Enter', 13], Escape: ['Escape', 27] };
    const [code, vk] = map[k] || [(/^[a-z]$/i.test(k) ? 'Key' + k.toUpperCase() : /^\d$/.test(k) ? 'Digit' + k : k), k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0];
    const text = k.length === 1 ? k : (k === 'Enter' ? '\r' : undefined);
    await this.p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text });
    await sleep(hold);
    await this.p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
  }
  async type(text, gap = 90) {
    for (const ch of text) { await this.p.send('Input.insertText', { text: ch }); await sleep(gap); }
  }
  // 覆盖层
  cap(html, pos) { return this.p.eval(`__ov.cap(${JSON.stringify(html || '')}, ${JSON.stringify(pos || null)})`); }
  endCard(t, s) { return this.p.eval(`__ov.endCard(${JSON.stringify(t)}, ${JSON.stringify(s)})`); }
  tag(t) { return this.p.eval(`__ov.tag(${JSON.stringify(t || '')})`); }
  ring(x, y, w, h) { return this.p.eval(`__ov.ring(${x},${y},${w},${h}) && 1`); }
  clearRings() { return this.p.eval(`__ov.clearRings()`); }
  async ringSel(sel, pad = 6) { const r = await this.rectOf(sel); if (r) await this.ring(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2); return r; }
}
