(() => {
  if (window.__ov) return;
  const css = document.createElement('style');
  css.textContent = `
  #ov-cur{position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(2px 3px 3px rgba(0,0,0,.55))}
  .ov-rip{position:fixed;z-index:2147483646;pointer-events:none;border:4px solid #fff;border-radius:50%;width:26px;height:26px;margin:-13px 0 0 -13px;opacity:.95;box-shadow:0 0 12px 2px rgba(255,220,80,.9);animation:ovrip .55s ease-out forwards}
  @keyframes ovrip{to{transform:scale(3.4);opacity:0}}
  #ov-cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(20px);z-index:2147483645;pointer-events:none;max-width:1120px;
    font:800 32px/1.35 "Microsoft YaHei","Noto Sans SC",sans-serif;color:#fff;text-align:center;padding:10px 30px 12px;border-radius:18px;
    background:linear-gradient(180deg,rgba(35,22,10,.86),rgba(20,12,4,.9));border:3px solid #ffd23f;box-shadow:0 6px 22px rgba(0,0,0,.5);
    text-shadow:0 2px 0 #000;opacity:0;transition:opacity .35s,transform .35s;white-space:pre-line}
  #ov-cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
  #ov-cap b{color:#ffd23f}
  #ov-tag{position:fixed;left:26px;top:70px;z-index:2147483645;pointer-events:none;font:900 26px "Microsoft YaHei",sans-serif;color:#3a1f00;
    background:linear-gradient(180deg,#ffe36a,#ffb92a);padding:6px 20px;border-radius:14px;border:3px solid #7a4a10;box-shadow:0 4px 12px rgba(0,0,0,.45);
    opacity:0;transform:translateX(-30px);transition:opacity .3s,transform .3s}
  #ov-tag.on{opacity:1;transform:none}
  .ov-ring{position:fixed;z-index:2147483644;pointer-events:none;border:5px solid #ffd23f;border-radius:16px;box-shadow:0 0 0 3px rgba(0,0,0,.45),0 0 22px 6px rgba(255,210,63,.85);
    animation:ovpulse 1s ease-in-out infinite;opacity:0;transition:opacity .25s}
  .ov-ring.on{opacity:1}
  @keyframes ovpulse{50%{box-shadow:0 0 0 3px rgba(0,0,0,.45),0 0 34px 12px rgba(255,210,63,.95);transform:scale(1.03)}}
  `;
  document.head.appendChild(css);
  const cur = document.createElement('div'); cur.id = 'ov-cur';
  cur.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><path d="M4 2 L4 26 L10 20.5 L14.5 30 L19 28 L14.6 18.8 L23 18.5 Z" fill="#fff" stroke="#222" stroke-width="2" stroke-linejoin="round"/></svg>';
  const cap = document.createElement('div'); cap.id = 'ov-cap';
  const tag = document.createElement('div'); tag.id = 'ov-tag';
  document.body.append(cur, cap, tag);
  const move = e => { cur.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; };
  document.addEventListener('mousemove', move, true);
  document.addEventListener('mousedown', e => {
    const r = document.createElement('div'); r.className = 'ov-rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r); setTimeout(() => r.remove(), 700);
  }, true);
  let capTimer = 0;
  window.__ov = {
    cap(html, pos) {
      clearTimeout(capTimer); if (!html) { cap.classList.remove('on'); return; }
      cap.removeAttribute('style');
      if (pos) { cap.style.cssText = 'left:' + pos.left + 'px;top:' + pos.top + 'px;bottom:auto;max-width:' + (pos.maxWidth || 560) + 'px;font-size:' + (pos.font || 26) + 'px;padding:8px 20px 10px;transform:none;text-align:left'; }
      cap.innerHTML = html; cap.classList.add('on');
    },
    endCard(title, sub) {
      const e = document.createElement('div'); e.id = 'ov-end';
      e.style.cssText = 'position:fixed;inset:0;z-index:2147483640;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(15,30,8,.74),rgba(5,10,2,.95));opacity:0;transition:opacity .8s;font-family:"Microsoft YaHei",sans-serif;text-align:center;pointer-events:none';
      e.innerHTML = '<div style="font-size:92px;font-weight:900;color:#ffd23f;text-shadow:0 5px 0 #7a3f00,0 0 30px rgba(255,180,0,.6);letter-spacing:8px">' + title + '</div><div style="margin-top:22px;font-size:38px;font-weight:800;color:#fff;text-shadow:0 3px 0 #000">' + sub + '</div>';
      document.body.appendChild(e); requestAnimationFrame(() => requestAnimationFrame(() => e.style.opacity = 1));
    },
    tag(t) { if (!t) { tag.classList.remove('on'); return; } tag.textContent = t; tag.classList.add('on'); },
    rings: [],
    ring(x, y, w, h) { const r = document.createElement('div'); r.className = 'ov-ring'; r.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px'; document.body.appendChild(r); requestAnimationFrame(() => r.classList.add('on')); this.rings.push(r); return r; },
    clearRings() { this.rings.forEach(r => { r.classList.remove('on'); setTimeout(() => r.remove(), 300); }); this.rings = []; },
    curXY(x, y) { cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
  };
})()
