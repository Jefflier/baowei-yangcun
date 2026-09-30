/* 狼的台词气泡。
 *
 * 原作战斗里狼会冒气泡说话（录像里大灰狼头顶的「这天气，适合吃羊」），台词就是客户端配置 wolfs_* 里
 * 名字 / 描述之后的那一串（assets/data/lore.js 的 SVA_LORE.wolves[名字].q）。
 *
 * 原作里「哪一条在什么场合说」没有留说明，这里只按几只狼的排列规律做了推断（见 range()）：
 *   前半段 = 出场 / 闲聊；中段 = 挨打；倒数第二条 = 死亡；最后一条 = 偷到羊。
 *   小灰狼：「我跑的很快哦」「我也有牙哦」「皮薄不是我的错」「哎呦疼啦」「唔...」「呜555...」「我先开动啦」
 *   大灰狼：…「好痛，别打啦~」「我的羊肉火锅...」「不甘心呐」「渍渍~小羊我来啦」
 * 对得上的居多，但不保证每只狼都对（比如法师狼的最后一条其实是召唤台词）。
 *
 * 只做画面，不进引擎、不用引擎的随机数。设置里「显示狼的台词」可关（G.save.settings.talk），
 * 或者 window.SVA_ORIGINAL_ART = {talk:false}。
 */
(function (global) {
  'use strict';
  const SV = global.SV; if (!SV) return;
  const T = SV.WolfTalk = { list: [], next: 3, on: true };
  const MAX_LIVE = 4;                       // 同屏最多几个气泡，多了就乱了

  const quotes = def => { const L = global.SVA_LORE && global.SVA_LORE.wolves; const e = L && def && L[def.n]; return e && e.q && e.q.length ? e.q : null; };

  /* 各场合可以用第几条（闭区间）。n = 这只狼一共有几条台词 */
  function range(kind, n) {
    if (kind === 'idle' || kind === 'spawn') return n <= 2 ? [0, n - 1] : [0, Math.ceil(n / 2) - 1];
    if (kind === 'hit') return n >= 3 ? [Math.floor(n / 3), Math.min(n - 1, Math.floor(2 * n / 3))] : null;
    if (kind === 'die') return n >= 3 ? [n - 2, n - 2] : null;
    if (kind === 'leak') return n >= 3 ? [n - 1, n - 1] : null;
    return null;
  }
  function pick(def, kind) {
    const q = quotes(def); if (!q) return null;
    const r = range(kind, q.length); if (!r) return null;
    return q[r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1))];
  }

  T.enabled = function () {
    const G = SV.Game, cfg = global.SVA_ORIGINAL_ART;
    return T.on && !(cfg && cfg.talk === false) && !(G && G.save && G.save.settings && G.save.settings.talk === false);
  };
  T.reset = function () { T.list.length = 0; T.next = 3; };

  /* w：活着的狼（气泡跟着走）或者刚死的狼（气泡留在原地）。chance：说话的概率 */
  T.say = function (w, kind, chance) {
    if (!T.enabled() || !w || !w.def) return;
    if (Math.random() > (chance == null ? 1 : chance)) return;
    if (T.list.length >= MAX_LIVE + (w.boss ? 1 : 0)) return;
    if (T.list.some(b => b.wid === w.uid)) return;                 // 一只狼同时只说一句
    const text = pick(w.def, kind); if (!text) return;
    T.list.push({ wid: w.uid, w: w.alive ? w : null, x: w.x, y: w.y, lane: w.lane || 0, size: w.size || 1, fly: !!w.fly, boss: !!w.boss,
                  text, age: 0, ttl: kind === 'die' || kind === 'leak' ? 1.6 : 2.4 });
  };

  /* 每帧（真实时间 dt）：气泡计时、挨打台词、隔一会儿随机闲聊 */
  T.tick = function (B, dt) {
    if (!B) return;
    for (let i = T.list.length - 1; i >= 0; i--) { const b = T.list[i]; b.age += dt; if (b.age >= b.ttl) T.list.splice(i, 1); }
    if (!T.enabled() || B.over || B.mode === 'arena') return;
    // 血量跌破 70% / 30% 各有机会喊一句
    for (const w of B.wolves) {
      if (!w.alive || !w.maxhp) continue;
      const r = w.hp / w.maxhp, tier = w._talkTier || 0;
      if (tier < 1 && r < 0.7) { w._talkTier = 1; T.say(w, 'hit', 0.5); }
      else if (tier < 2 && r < 0.3) { w._talkTier = 2; T.say(w, 'hit', 0.5); }
    }
    T.next -= dt;
    if (T.next <= 0) {
      T.next = 4 + Math.random() * 5;
      const live = B.wolves.filter(w => w.alive && !w.stuck && w.x > 0 && w.y > 0 && w.x < B.cols && w.y < B.rows);
      if (live.length) T.say(live[Math.floor(Math.random() * live.length)], 'idle', 0.8);
    }
  };

  function wrap(text, per) {
    const out = []; let s = String(text).trim();
    while (s.length > per) {
      let cut = per;
      for (let i = per; i > per - 4 && i > 2; i--) if (/[，。！？、,.!?~…]/.test(s[i - 1])) { cut = i; break; }
      out.push(s.slice(0, cut)); s = s.slice(cut);
    }
    if (s) out.push(s);
    return out.slice(0, 3);
  }

  /* 画在狼头顶：白底圆角气泡 + 小尾巴，站着的东西按原比例画（R.upright） */
  T.draw = function (ctx, R) {
    if (!T.list.length || !T.enabled()) return;
    const cs = R.cs, v = R.view || { x: 0, w: R.W };
    const fs = Math.max(11, Math.round(cs * 0.2));
    for (const b of T.list) {
      const w = b.w && b.w.alive ? b.w : null;
      const x = w ? w.x : b.x, y = w ? w.y : b.y, lane = w ? (w.lane || 0) : b.lane;
      const px = R.ox + x * cs, py = R.oy + (y + 0.3 + lane * 0.6) * cs;
      const lift = b.fly ? cs * 0.42 : 0;
      const top = py - cs * 0.9 * b.size * 0.95 - lift - cs * 0.06;
      const k = b.age / b.ttl;
      const pop = Math.min(1, b.age / 0.14), fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      R.upright(ctx, py, () => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.font = (b.boss ? 'bold ' : '') + fs + 'px "Microsoft YaHei",sans-serif';
        const lines = wrap(b.text, 9);
        const tw = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
        const pad = fs * 0.55, bw = tw + pad * 2, bh = lines.length * fs * 1.25 + pad * 1.2, tail = fs * 0.6;
        const cx = Math.max(v.x + bw / 2 + 4, Math.min(v.x + v.w - bw / 2 - 4, px));      // 别顶出战场
        const by = top - tail - bh;
        ctx.translate(cx, top); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop); ctx.translate(-cx, -top);
        const bx = cx - bw / 2, r = fs * 0.55;
        ctx.beginPath();
        ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        const tx = Math.max(bx + r + tail, Math.min(bx + bw - r - tail, px));
        ctx.lineTo(tx + tail * 0.6, by + bh); ctx.lineTo(px > tx ? Math.min(px, tx + tail * 0.9) : tx, by + bh + tail); ctx.lineTo(tx - tail * 0.6, by + bh);
        ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by); ctx.closePath();
        ctx.fillStyle = '#fffdf3'; ctx.fill();
        ctx.lineWidth = Math.max(1.5, fs * 0.13); ctx.strokeStyle = b.boss ? '#a5321f' : '#6b4a2c'; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.fillStyle = b.boss ? '#8a1f10' : '#3a2a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        lines.forEach((l, i) => ctx.fillText(l, cx, by + pad * 0.6 + fs * 0.62 + i * fs * 1.25));
        ctx.restore();
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
