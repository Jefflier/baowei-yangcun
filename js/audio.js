/* ============================================================
 * 音频：原作音效 / 战斗音乐（assets/audio/sounds.js）+ Web Audio 程序化音效兜底
 *   - 事件 → 原作 mp3 的对应表见下面的 SMAP；没有对应或还没解码好的，退回程序化版本
 *   - 大厅 / 世界地图的音乐原作客户端里没有（只有 6 首 fight 曲），仍是程序化的轻量 BGM
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV;
  const A = SV.Audio = { ctx: null, master: null, sfxGain: null, bgmGain: null, sfxVol: 0.6, bgmVol: 0.35, last: {}, bgm: null };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
    try {
      A.ctx = new AC();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.9; A.master.connect(A.ctx.destination);
      A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = A.sfxVol; A.sfxGain.connect(A.master);
      A.bgmGain = A.ctx.createGain(); A.bgmGain.gain.value = A.bgmVol; A.bgmGain.connect(A.master);
      A.noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 0.5, A.ctx.sampleRate);
      const d = A.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.loadOriginal();
    } catch (e) { A.ctx = null; }
  };
  A.setVol = function (sfx, bgm) {
    if (sfx != null) { A.sfxVol = sfx; if (A.sfxGain) A.sfxGain.gain.value = sfx; }
    if (bgm != null) { A.bgmVol = bgm; if (A.bgmGain) A.bgmGain.gain.value = bgm; }
  };

  function tone(type, f0, f1, dur, vol, delay, dest) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || A.sfxGain); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, fromF, toF, delay, type) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (delay || 0);
    const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(fromF, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, toF), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.sfxGain); s.start(t); s.stop(t + dur + 0.05);
  }
  // 节流：同类音效最小间隔
  function gate(name, gap) {
    const now = performance.now();
    if (A.last[name] && now - A.last[name] < gap) return false;
    A.last[name] = now; return true;
  }

  const S = {
    click() { tone('triangle', 620, 880, 0.07, 0.25); },
    hover() { tone('sine', 900, 900, 0.03, 0.05); },
    error() { tone('square', 220, 140, 0.16, 0.22); },
    build() { tone('square', 300, 520, 0.09, 0.22); noise(0.08, 0.25, 1200, 300); tone('triangle', 660, 990, 0.12, 0.18, 0.06); },
    sell() { tone('triangle', 660, 440, 0.12, 0.2); tone('triangle', 520, 330, 0.14, 0.18, 0.08); },
    upgrade() { tone('triangle', 520, 780, 0.1, 0.22); tone('triangle', 780, 1170, 0.14, 0.22, 0.09); },
    gem() { tone('sine', 1200, 1800, 0.15, 0.2); tone('sine', 1800, 2400, 0.2, 0.14, 0.08); },
    coin() { if (!gate('coin', 60)) return; tone('square', 1300, 1700, 0.06, 0.08); tone('square', 1700, 2100, 0.09, 0.06, 0.05); },
    shootSentry() { if (!gate('s1', 45)) return; tone('triangle', 900, 500, 0.06, 0.09); },
    shootScatter() { if (!gate('s2', 60)) return; noise(0.07, 0.12, 3000, 900, 0, 'bandpass'); },
    shootCannon() { if (!gate('s3', 80)) return; noise(0.22, 0.4, 900, 90); tone('sine', 140, 50, 0.22, 0.35); },
    shootPulse() { if (!gate('s4', 80)) return; tone('sine', 400, 1300, 0.22, 0.14); tone('triangle', 200, 900, 0.22, 0.08); },
    shootGem() { if (!gate('s5', 70)) return; tone('sine', 1100, 1500, 0.1, 0.1); },
    zap() { if (!gate('zap', 70)) return; noise(0.1, 0.14, 6000, 1500, 0, 'highpass'); tone('sawtooth', 1200, 300, 0.09, 0.07); },
    flash() { if (!gate('flash', 80)) return; tone('sine', 1500, 600, 0.25, 0.12); },
    boom() { if (!gate('boom', 70)) return; noise(0.3, 0.32, 700, 70); tone('sine', 110, 45, 0.28, 0.3); },
    hit() { if (!gate('hit', 40)) return; tone('square', 240, 140, 0.04, 0.05); },
    die() { if (!gate('die', 35)) return; tone('triangle', 500, 200, 0.14, 0.13); },
    leak() { tone('sawtooth', 300, 120, 0.3, 0.25); tone('square', 200, 90, 0.35, 0.2, 0.08); },
    wave() { tone('sawtooth', 220, 330, 0.25, 0.22); tone('sawtooth', 330, 440, 0.3, 0.22, 0.2); tone('sawtooth', 440, 440, 0.35, 0.2, 0.42); },
    boss() { tone('sawtooth', 110, 70, 0.9, 0.34); tone('square', 82, 55, 0.9, 0.22, 0.05); noise(0.6, 0.25, 500, 80, 0.1); tone('sawtooth', 220, 110, 0.6, 0.2, 0.5); },
    pass() { S.win(); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.22, 0.25, i * 0.13)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.98, 0.3, 0.2, i * 0.22)); },
    level() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.12, 0.15, i * 0.08)); },
    portal() { if (!gate('portal', 120)) return; tone('sine', 300, 900, 0.25, 0.1); },
    blink() { if (!gate('blink', 100)) return; tone('sine', 1500, 400, 0.18, 0.09); },
    stun() { tone('square', 800, 700, 0.06, 0.06); },
    chest() { [700, 900, 1200].forEach((f, i) => tone('triangle', f, f * 1.2, 0.12, 0.18, i * 0.07)); },
    whack() { tone('square', 200, 80, 0.12, 0.3); noise(0.1, 0.25, 800, 200); }
  };
  A.play = function (name) { if (!A.ctx || A.sfxVol <= 0) return; try { if (!playSample(name)) S[name] && S[name](); } catch (e) { } };

  /* ---------- 原作音效 ----------
   * assets/audio/sounds.js：35 个原版 mp3（tools/export_sounds.py 导出，已按响度归一化：音效峰值 -3 dBFS）。
   * 文件名来自客户端 GlobalString 的 SOUND_* / MUSIC_* 常量；「哪个事件放哪个声音」写在原作 AS 里、没抠出来，
   * 下面这张表是按文件名和听感对的（推断）。s 原作文件名  v 混音音量  g 同类最小间隔(ms)  r 播放速率
   * 关掉：window.SVA_SOUND_ORIGINAL = false（全部回到程序化音效）。 */
  const SND = global.SVA_SOUND || null;
  const SMAP = {
    build: { s: 'build', v: 0.5 }, sell: { s: 'gold', v: 0.5, r: 0.8 }, upgrade: { s: 'buildUp', v: 0.5 }, gem: { s: 'gem', v: 0.5 },
    coin: { s: 'gold', v: 0.25, g: 60 }, chest: { s: 'reward', v: 0.55 },
    shootSentry: { s: 'smallFire', v: 0.16, g: 70 }, shootScatter: { s: 'smallFire', v: 0.16, g: 80, r: 1.25 },
    shootCannon: { s: 'bigFire', v: 0.5, g: 90 }, shootPulse: { s: 'magicFire', v: 0.3, g: 90 }, shootGem: { s: 'magicFire', v: 0.22, g: 80, r: 1.2 },
    zap: { s: 'lightning', v: 0.3, g: 90 }, flash: { s: 'allAttack', v: 0.4, g: 120 },
    boom: { s: 'blast', v: 0.6, g: 80 }, hit: { s: 'smallHit', v: 0.2, g: 50 }, die: { s: 'wolfDie', v: 0.35, g: 110 },
    leak: { s: 'sheep', v: 0.7 }, wave: { s: 'wolfComing', v: 0.6 }, boss: { s: 'wolfComing', v: 0.8, r: 0.7 },
    win: { s: 'win', v: 0.7 }, lose: { s: 'fail', v: 0.7 }, pass: { s: 'passMap', v: 0.7 },
    portal: { s: 'teleport', v: 0.3, g: 120 }, blink: { s: 'teleport', v: 0.3, g: 120 }, whack: { s: 'bigHit', v: 0.6 },
    // 下面这些只由战斗特效触发（A.scanFx），程序化版本里没有
    magicHit: { s: 'magicHit', v: 0.25, g: 80 }, bigHit: { s: 'bigHit', v: 0.3, g: 100 },
    burn: { s: 'burn', v: 0.22, g: 200 }, cold: { s: 'cold', v: 0.22, g: 200 }, poison: { s: 'poison', v: 0.22, g: 200 },
    clamp: { s: 'clamp', v: 0.6, g: 100 }
  };
  A.buf = {}; A.voices = 0;
  A.loadOriginal = function () {
    if (!SND || !A.ctx || A._loading) return; A._loading = true;
    const dec = (k, name) => {
      const bin = atob(SND[k][name].b), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Promise((ok, no) => A.ctx.decodeAudioData(u.buffer, ok, no)).then(b => { A.buf[name] = b; }, () => { });
    };
    const jobs = []; for (const k of ['sfx', 'bgm']) for (const n in SND[k]) jobs.push(dec(k, n));
    Promise.all(jobs).then(() => {
      A.origReady = true;
      // 解码完成前已经开了程序化战斗乐：换成原作的
      const cur = A.bgm;
      if (cur && !cur.sample && PLAN[cur.name]) { const nm = cur.name, sd = cur.seed; A.stopBgm(); A.playBgm(nm, sd); }
    });
  };
  function playSample(name) {
    const m = SMAP[name], b = SND && m && A.buf[m.s];
    if (!b || global.SVA_SOUND_ORIGINAL === false) return false;
    if (m.g && !gate(name, m.g)) return true;
    if (A.voices >= 20) return true;
    const c = A.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; src.playbackRate.value = (m.r || 1) * (1 + (Math.random() - 0.5) * 0.06);
    g.gain.value = SND.sfx[m.s].g * m.v;
    src.connect(g); g.connect(A.sfxGain);
    A.voices++; src.onended = () => { A.voices--; };
    src.start();
    return true;
  }

  /* 战斗特效 → 音效。引擎只管往 B.fx 里推特效（不碰音频），UI 每帧把新出现的扫一遍。
   * 出手声（shoot）、击杀、漏怪、炸弹这些引擎有事件的，不在这里重复放。 */
  const FXSND = {
    hit(f) {
      if (f.curse) return 'magicHit';
      if (f.crit) return 'bigHit';
      if (f.tower === 'cannon') return null;                       // 炮弹落地由 boom 放 blast，不再给每只被溅到的狼放一次
      if (f.tower === 'pulse') return 'magicHit';
      if (f.tower === 'inlay') return { hong: 'burn', lan: 'cold', lv: 'poison' }[f.cname] || 'magicHit';
      return 'hit';
    },
    boom(f) { return f.kind === 'shell' || f.kind === 'mine' || f.kind === 'burst' ? 'boom' : null; },
    ring(f) { return { clamp: 'clamp', shield: 'magicHit', heal: 'gem', revive: 'magicHit', summon: 'portal' }[f.kind] || null; },
    blink() { return 'blink'; },
    tele() { return 'portal'; },
    curse() { return 'magicHit'; }
  };
  A.scanFx = function (fx) {
    if (!A.ctx || A.sfxVol <= 0 || !fx) return;
    for (let i = 0; i < fx.length; i++) {
      const f = fx[i]; if (f.snd) continue; f.snd = 1;
      const fn = FXSND[f.type], nm = fn && fn(f);
      if (nm) A.play(nm);
    }
  };

  /* ---------- 背景音乐 ---------- */
  const SCALES = {
    calm: { bpm: 84, root: 261.63, sc: [0, 2, 4, 7, 9, 12, 14, 16], bass: [0, -5, -3, -7], wave: 'triangle' },
    battle: { bpm: 122, root: 220, sc: [0, 3, 5, 7, 10, 12, 15, 17], bass: [0, 0, -2, -5], wave: 'square' },
    boss: { bpm: 140, root: 196, sc: [0, 1, 3, 6, 7, 10, 12, 13], bass: [0, 0, 1, -2], wave: 'sawtooth' },
    arena: { bpm: 132, root: 246.94, sc: [0, 2, 4, 7, 9, 12, 14, 16], bass: [0, -3, -5, -7], wave: 'square' }
  };
  /* 战斗音乐：原作只有 6 首 fight 曲（8~14 秒的循环），大厅 / 地图的音乐客户端里没有。
   * 哪首配哪种场合原作没留记录，这里按响度分：普通战斗轮播 001/004/005/010（跟着关卡号起头，循环够久了淡入淡出换下一首），
   * BOSS 用 011，竞技场用 012（这两首最满最响）。 */
  const PLAN = {
    battle: seed => { const L = ['fight001', 'fight004', 'fight005', 'fight010'], k = ((seed | 0) % 4 + 4) % 4; return L.slice(k).concat(L.slice(0, k)); },
    boss: () => ['fight011'],
    arena: () => ['fight012']
  };
  function bgmStart(id, fade) {
    const c = A.ctx, b = A.buf[id]; if (!b) return null;
    const src = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
    src.buffer = b; src.loop = true;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(SND.bgm[id].g, t + fade);
    src.connect(g); g.connect(A.bgmGain); src.start(t);
    return { src, g, id };
  }
  function bgmFade(tr, fade) {
    if (!tr) return; const t = A.ctx.currentTime;
    try { tr.g.gain.cancelScheduledValues(t); tr.g.gain.setValueAtTime(tr.g.gain.value, t); tr.g.gain.linearRampToValueAtTime(0.0001, t + fade); tr.src.stop(t + fade + 0.05); } catch (e) { }
  }
  function playSampleBgm(name, seed) {
    if (!SND || !A.origReady || global.SVA_SOUND_ORIGINAL === false || !PLAN[name]) return false;
    const list = PLAN[name](seed).filter(id => A.buf[id]); if (!list.length) return false;
    const st = { name, seed, sample: true, list, i: 0, cur: bgmStart(list[0], 0.6), timer: null };
    A.bgm = st;
    if (list.length > 1) {
      const dwell = id => Math.ceil(45 / SND.bgm[id].d) * SND.bgm[id].d * 1000;   // 至少 45 秒、整数个循环
      const next = () => {
        if (A.bgm !== st) return;
        st.i = (st.i + 1) % list.length;
        const nt = bgmStart(list[st.i], 1.5); bgmFade(st.cur, 1.5); st.cur = nt;
        st.timer = setTimeout(next, dwell(list[st.i]));
      };
      st.timer = setTimeout(next, dwell(list[0]));
    }
    return true;
  }
  A.playBgm = function (name, seed) {
    if (!A.ctx) { A._want = name; A._wantSeed = seed; return; }
    if (A.bgm && A.bgm.name === name) return;
    A.stopBgm();
    if (playSampleBgm(name, seed)) return;
    const S0 = SCALES[name] || SCALES.calm;
    const st = { name, seed, step: 0, timer: null, next: A.ctx.currentTime + 0.1, rnd: 1 + Math.floor(Math.random() * 1000) };
    A.bgm = st;
    const beat = 60 / S0.bpm / 2;
    const rng = () => { st.rnd = (st.rnd * 1664525 + 1013904223) >>> 0; return st.rnd / 4294967296; };
    const pat = [];
    for (let i = 0; i < 32; i++) pat.push(rng() < 0.7 ? Math.floor(rng() * S0.sc.length) : -1);
    const sched = () => {
      if (A.bgm !== st) return;
      while (st.next < A.ctx.currentTime + 0.3) {
        const s = st.step % 32, bar = Math.floor(s / 8) % 4;
        const nt = pat[s];
        if (nt >= 0) {
          const f = S0.root * Math.pow(2, S0.sc[nt] / 12) * (name === 'calm' ? 1 : 1);
          bt('lead', S0.wave, f, beat * 0.9, name === 'calm' ? 0.06 : 0.05, st.next);
        }
        if (s % 2 === 0) {
          const bf = S0.root / 2 * Math.pow(2, S0.bass[bar] / 12);
          bt('bass', 'triangle', bf, beat * 1.8, 0.09, st.next);
        }
        if (name !== 'calm' && s % 4 === 0) { const c = A.ctx, t = st.next; const sN = c.createBufferSource(); sN.buffer = A.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = c.createGain(); g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); sN.connect(f); f.connect(g); g.connect(A.bgmGain); sN.start(t); sN.stop(t + 0.06); }
        if (name === 'battle' || name === 'boss' || name === 'arena') { if (s % 8 === 0) { const c = A.ctx, t = st.next; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(A.bgmGain); o.start(t); o.stop(t + 0.2); } }
        st.next += beat; st.step++;
      }
    };
    st.timer = setInterval(sched, 120);
    sched();
  };
  function bt(kind, type, f, dur, vol, t) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.bgmGain); o.start(t); o.stop(t + dur + 0.05);
  }
  A.stopBgm = function () {
    const st = A.bgm; if (!st) return;
    clearInterval(st.timer); clearTimeout(st.timer);
    if (st.sample) bgmFade(st.cur, 0.4);
    A.bgm = null;
  };
  A.resumeWanted = function () { if (A._want) { const w = A._want, sd = A._wantSeed; A._want = null; A.playBgm(w, sd); } };
})(typeof window !== 'undefined' ? window : globalThis);
