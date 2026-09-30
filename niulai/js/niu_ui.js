/* ============================================================
 * 牛来攻城 —— 界面：标题 / 选关 / 战斗 HUD / 建造栏 / 选中面板 / 弹窗 / 输入 / 主循环
 * ============================================================ */
(function (root) {
  'use strict';
  const NL = root.NL, D = NL.D, Art = NL.Art, V = NL.VIEW;
  const SV = root.SV || {};
  const UI = NL.UI = { t: 0, screen: null, k: 1 };
  const STEP = 1 / 60;

  /* ---------- DOM 助手 ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(x => add(el, x));
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  const $ = s => document.querySelector(s);
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  UI.h = h;
  const fmt = n => (SV.fmt ? SV.fmt(n) : String(Math.floor(n)));

  /* ---------- 存档 ---------- */
  const SAVE_KEY = 'niulai_save_v1';
  const store = SV.store || {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  UI.save = Object.assign({ stars: {}, best: 0, seen: {}, sfx: 0.6, bgm: 0.35, tut: 0, art: 'su' }, store.get(SAVE_KEY, {}) || {});
  Art.setStyle(UI.save.art === 'poster' ? 'poster' : 'su');
  UI.persist = () => store.set(SAVE_KEY, UI.save);
  UI.maxCleared = () => { let m = 0; for (const L of D.levels) if (UI.save.stars[L.id] > 0) m = Math.max(m, L.id); return m; };
  UI.levelOpen = L => L.endless ? UI.maxCleared() >= D.ENDLESS_UNLOCK : (L.id === 1 || UI.save.stars[L.id - 1] > 0);
  UI.unlockedFor = function (L) {
    const upto = L.endless ? Math.max(D.ENDLESS_UNLOCK, Math.min(10, UI.maxCleared() + 1)) : L.id;
    const s = new Set();
    for (const l of D.levels) if (l.id <= upto) for (const u of l.unlock) s.add(u);
    return s;
  };

  /* ---------- 音频（保卫羊村的 SV.Audio：原作 mp3 + 程序化兜底）+ 手搓的「哞」 ---------- */
  const A = SV.Audio || null;
  UI.sfx = function (n) { if (A && A.ctx) A.play(n); };
  UI.bgm = function (n, seed) { if (A) A.playBgm(n, seed); };
  let lastMoo = 0;
  UI.moo = function (pitch, len, vol) {
    if (!A || !A.ctx || A.sfxVol <= 0) return;
    const now = performance.now(); if (now - lastMoo < 260) return; lastMoo = now;
    const c = A.ctx, t = c.currentTime, f0 = 118 * (pitch || 1), L = len || 0.7;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    o1.frequency.setValueAtTime(f0 * 0.9, t); o1.frequency.linearRampToValueAtTime(f0 * 1.08, t + L * 0.3); o1.frequency.linearRampToValueAtTime(f0 * 0.78, t + L);
    o2.frequency.setValueAtTime(f0 * 0.45, t); o2.frequency.linearRampToValueAtTime(f0 * 0.39, t + L);
    lfo.frequency.value = 6; lg.gain.value = 4; lfo.connect(lg); lg.connect(o1.frequency);
    bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(820, t + L * 0.35); bp.frequency.linearRampToValueAtTime(460, t + L);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * (vol || 1), t + 0.08); g.gain.setValueAtTime(0.2 * (vol || 1), t + L * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
    const g2 = c.createGain(); g2.gain.value = 0.35;
    o1.connect(bp); o2.connect(g2); g2.connect(bp); bp.connect(g); g.connect(A.sfxGain);
    for (const o of [o1, o2, lfo]) { o.start(t); o.stop(t + L + 0.05); }
  };
  function audioInit() {
    if (!A) return;
    const first = !A.ctx;
    A.init();
    if (first && A.ctx) { A.setVol(UI.save.sfx, UI.save.bgm); A.resumeWanted(); }
  }

  /* ---------- 舞台缩放 ---------- */
  UI.fit = function () {
    const st = $('#stage');
    const k = Math.min(innerWidth / 1280, innerHeight / 720);
    st.style.transform = 'translate(' + (-640 * k) + 'px,' + (-360 * k) + 'px) scale(' + k + ')';
    UI.k = k;
    if (UI.R) UI.R.resize(k);
  };
  UI.toStage = function (e) {
    const r = UI.R.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * 1280 / r.width, y: (e.clientY - r.top) * 720 / r.height };
  };

  /* ---------- 提示 / 弹窗 ---------- */
  let lastToast = '', lastToastT = 0;
  UI.toast = function (msg, cls) {
    const now = performance.now();
    if (msg === lastToast && now - lastToastT < 1200) return;
    lastToast = msg; lastToastT = now;
    const el = h('div', { class: 'toast ' + (cls || ''), text: msg });
    const r = $('#toast-root'); r.appendChild(el);
    while (r.children.length > 4) r.removeChild(r.firstChild);
    setTimeout(() => el.remove(), 2700);
  };
  UI.banner = function (title, sub, img) {
    const el = h('div', { class: 'banner' }, img ? h('img', { src: img }) : null, h('div', { class: 't', text: title }), sub ? h('div', { class: 's', text: sub }) : null);
    $('#modal-root').appendChild(el);
    setTimeout(() => el.remove(), 2700);
  };
  UI.modal = function (content, opts) {
    opts = opts || {};
    const box = h('div', { class: 'modal panel' }, content);
    const mask = h('div', { class: 'mask' }, box);
    if (opts.dismiss) mask.addEventListener('pointerdown', e => { if (e.target === mask) UI.closeModal(mask); });
    $('#modal-root').appendChild(mask);
    UI.modals.push(mask);
    return mask;
  };
  UI.modals = [];
  UI.closeModal = function (m) {
    m = m || UI.modals[UI.modals.length - 1];
    if (!m) return;
    m.remove(); UI.modals = UI.modals.filter(x => x !== m);
  };
  UI.closeAll = function () { while (UI.modals.length) UI.closeModal(); };

  /* ---------- 屏幕切换 ---------- */
  UI.show = function (name) {
    UI.screen = name;
    for (const s of document.querySelectorAll('.scr')) s.classList.toggle('on', s.id === 'scr-' + name);
  };

  /* ============================================================
   * 标题
   * ============================================================ */
  UI.herd = [];
  function makeHerd() {
    const ids = ['huang', 'huang', 'calf', 'naiu', 'douniu', 'shuiniu', 'maoniu', 'zhuang', 'feitian', 'tiejia', 'huoniu', 'calf', 'huang', 'qingniu', 'mowang'];
    UI.herd = ids.map((id, i) => ({ id, x: i * 97 + Math.random() * 60, y: D.cows[id].fly ? 480 + Math.random() * 30 : 520 + ((i * 37) % 170), v: 0.9 + Math.random() * 0.5, s: id === 'mowang' ? 0.8 : 0.9 + Math.random() * 0.25 })).sort((a, b) => a.y - b.y);
  }
  UI.toTitle = function () {
    UI.closeAll(); UI.B = null;
    const s = clear($('#scr-title'));
    const endlessOpen = UI.levelOpen(D.endless);
    s.appendChild(h('div', { class: 'logo' }, h('h1', { text: '牛来攻城' }), h('div', { class: 'sub', text: '保卫羊村 · 番外篇' })));
    s.appendChild(h('div', { class: 'menu' },
      h('button', { class: 'btn xl', onclick: () => { UI.sfx('click'); UI.toMap(); } }, '⚔ 开始守城'),
      h('button', { class: 'btn lg purple' + (endlessOpen ? '' : ' dis'), style: { background: 'linear-gradient(#b99aff,#8a5ad8)' }, onclick: () => { if (!endlessOpen) return UI.toast('通关第 ' + D.ENDLESS_UNLOCK + ' 关解锁无尽模式'); UI.sfx('click'); UI.levelIntro(D.endless); } }, '♾ 无尽牧场' + (UI.save.best ? '（最高 ' + UI.save.best + ' 波）' : '')),
      h('div', { class: 'row' },
        h('button', { class: 'btn blue', onclick: () => { UI.sfx('click'); UI.bestiary(); } }, '📖 牛群图鉴'),
        h('button', { class: 'btn green', onclick: () => { UI.sfx('click'); UI.help(); } }, '❓ 玩法'),
        h('button', { class: 'btn gray', onclick: () => { UI.sfx('click'); UI.settings(); } }, '⚙ 设置'))
    ));
    // 致敬《牛来》：海报是精致的 Q 版，正片是方块建模
    s.appendChild(h('div', { class: 'poster' },
      h('div', { class: 'pic' }, h('img', { class: 'kid', src: Art.cowIcon('calf', 120, 'poster') }), h('img', { class: 'mom', src: Art.cowIcon('naiu', 120, 'poster') })),
      h('div', { class: 'pt', text: '牛 来 攻 城' }),
      h('div', { class: 'pc', text: '* 海报仅供参考，以正片为准' })));
    s.appendChild(h('div', { class: 'foot' }, '基于《保卫羊村·怀旧服》单机复刻的引擎制作 · 塔、墙、雕像、羊与音效为原作素材 · 牛的建模致敬动画电影《牛来》（设置里可以换回 Q 版海报牛）· 非商业粉丝作品 · ',
      h('a', { href: document.querySelector('script[src]') ? '../index.html' : '保卫羊村怀旧服.html', style: { color: '#2a5a10' }, text: '回到《保卫羊村》' })));
    UI.show('title');
    UI.bgm('calm');
  };

  /* ============================================================
   * 选关
   * ============================================================ */
  UI.toMap = function () {
    UI.closeAll(); UI.B = null;
    const s = clear($('#scr-map'));
    const box = h('div', { class: 'mapbox panel' });
    const total = D.levels.reduce((a, L) => a + (UI.save.stars[L.id] || 0), 0);
    box.appendChild(h('h2', null, h('button', { class: 'btn sm gray', onclick: () => { UI.sfx('click'); UI.toTitle(); } }, '← 返回'), '选择战场', h('span', { class: 'grow' }), h('span', { class: 'small bold', text: '★ ' + total + ' / ' + D.levels.length * 3 })));
    const grid = h('div', { class: 'levels' });
    for (const L of D.levels) {
      const open = UI.levelOpen(L), st = UI.save.stars[L.id] || 0;
      const star = [0, 1, 2].map(i => h('span', { class: i < st ? '' : 'off', text: '★' }));
      const top = L.boss ? L.boss[Math.max(...Object.keys(L.boss).map(Number))] : L.cows[L.cows.length - 1][0];
      grid.appendChild(h('div', { class: 'lv theme-' + L.theme + (open ? '' : ' lock'), onclick: () => { if (!open) return UI.toast('先通过上一关'); UI.sfx('click'); UI.levelIntro(L); } },
        h('img', { class: 'cowpic', src: Art.cowIcon(top, 110) }),
        h('div', { class: 'no', text: L.id }), h('div', { class: 'nm', text: L.n }),
        h('div', { class: 'info', html: L.waves + ' 波 · ' + (D.THEMES[L.theme].n) + (L.boss ? '<br>BOSS：' + [...new Set(Object.values(L.boss))].map(b => D.cows[b].n).join('、') : '') }),
        h('div', { class: 'stars' }, star)));
    }
    const eo = UI.levelOpen(D.endless);
    grid.appendChild(h('div', { class: 'lv endless' + (eo ? '' : ' lock'), onclick: () => { if (!eo) return UI.toast('通关第 ' + D.ENDLESS_UNLOCK + ' 关解锁'); UI.sfx('click'); UI.levelIntro(D.endless); } },
      h('div', { class: 'nm', text: '♾ 无尽牧场' }), h('div', { class: 'info', text: '牛群无穷无尽，每 10 波青牛精、每 25 波牛魔王。最高纪录：' + (UI.save.best || 0) + ' 波' })));
    box.appendChild(grid);
    s.appendChild(box);
    UI.show('map');
    UI.bgm('calm');
  };

  function unlockChip(u) {
    let img, name;
    if (D.towers[u]) { img = Art.towerIcon(u, 1, 64); name = D.towers[u].n; }
    else if (u === 'wall') { img = Art.buildIcon('wall', 64); name = '城墙'; }
    else if (u === 'hay') { img = Art.buildIcon('hay', 64); name = '草垛'; }
    else if (D.statues[u]) { img = Art.buildIcon(u, 64); name = D.statues[u].n; }
    else if (D.skills[u]) return h('div', { class: 'u' }, h('div', { style: { fontSize: '42px', lineHeight: '64px' }, text: D.skills[u].icon }), '技能·' + D.skills[u].n);
    return h('div', { class: 'u' }, h('img', { src: img }), name);
  }
  UI.levelIntro = function (L, fromResult) {
    const cows = L.cows.map(e => e[0]).concat(L.boss ? Object.values(L.boss) : []).concat(L.bossEvery ? Object.keys(L.bossEvery) : []);
    const uniq = [...new Set(cows)];
    const m = UI.modal([
      h('h2', { text: (L.endless ? '' : '第 ' + L.id + ' 关 · ') + L.n }),
      h('p', { class: 'center', text: L.intro }),
      L.unlock.length ? [h('div', { class: 'center bold', text: '— 新到手 —' }), h('div', { class: 'unlocks' }, L.unlock.map(unlockChip))] : null,
      h('div', { class: 'center bold', text: '— 来犯的牛 —' }),
      h('div', { class: 'unlocks' }, uniq.map(id => h('div', { class: 'u' }, h('img', { src: Art.cowIcon(id, 64) }), D.cows[id].n))),
      h('div', { class: 'acts' },
        h('button', { class: 'btn gray', onclick: () => { UI.closeModal(m); if (fromResult) UI.toMap(); } }, '再想想'),
        h('button', { class: 'btn lg green', onclick: () => { UI.closeModal(m); UI.startLevel(L); } }, '进入战场'))
    ], { dismiss: !fromResult });
  };

  /* ============================================================
   * 战斗
   * ============================================================ */
  UI.startLevel = function (L) {
    UI.closeAll();
    const g = new NL.Game(L, { unlocked: UI.unlockedFor(L) });
    const B = UI.B = {
      L, g, mode: null, hover: null, hoverB: null, sel: null, selCow: null, skill: null, speed: 1, paused: false,
      showPath: true, showGrid: false, preview: null, ghostOk: false, shake: 0, gateHit: 0, flashRed: 0,
      acc: 0, lastUid: 0, drag: false, pvKey: '', hudSig: '', selSig: '', tutStep: 0, tutT: 0, ended: false,
      hasSiege: L.cows.some(e => D.cows[e[0]].siegeAI)
    };
    buildBattleDom(B);
    UI.show('battle');
    UI.bgm('battle', L.id);
    if (L.id === 1 && !UI.save.tut) tutorial(0);
    else tip('布置好防线后，点右上角「开战」。白色虚线是牛的路线。', 5);
  };

  function buildBattleDom(B) {
    const s = clear($('#scr-battle'));
    const L = B.L, g = B.g;
    // 顶栏
    const top = h('div', { id: 'hud-top' },
      h('div', { class: 'lvname', text: (L.endless ? '' : '第' + L.id + '关 · ') + L.n }),
      h('div', { class: 'wave', id: 'h-wave' }),
      h('div', { class: 'gap' }),
      h('div', { class: 'res gold', title: '金币' }, '💰', h('span', { class: 'v', id: 'h-gold' })),
      h('div', { class: 'res hp', id: 'h-hpbox', title: '羊城城防' }, '🏯', h('span', { class: 'v', id: 'h-hp' }), h('div', { class: 'bar' }, h('i', { id: 'h-hpbar' }))),
      h('div', { class: 'gap' }),
      h('button', { class: 'btn', id: 'btn-wave', onclick: () => callWave() }),
      h('button', { class: 'btn sm blue', id: 'btn-speed', title: '加速 (F)', onclick: () => cycleSpeed() }, '1×'),
      h('button', { class: 'btn sm', id: 'btn-pause', title: '暂停 (空格)', onclick: () => togglePause() }, '⏸'),
      h('button', { class: 'btn sm gray', title: '菜单 (Esc)', onclick: () => pauseMenu() }, '☰'));
    s.appendChild(top);
    s.appendChild(h('div', { id: 'wave-peek' }));
    // 建造栏 + 技能栏
    const bar = h('div', { id: 'build-bar' });
    B.items = [];
    const U = g.unlocked;
    const addItem = (it) => {
      const el = h('div', { class: 'bb' + (L.unlock.includes(it.uid) ? ' new' : '') },
        h('kbd', { text: it.key }), h('img', { src: it.icon }), h('div', { class: 'nm', text: it.name }), h('div', { class: 'cost', text: it.cost }));
      el.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); setMode(B.mode && B.mode.uid === it.uid ? null : it); });
      el.addEventListener('pointerenter', () => bbTip(it, el));
      el.addEventListener('pointerleave', () => bbTip(null));
      it.el = el; B.items.push(it); bar.appendChild(el);
    };
    for (const t of D.TOWER_ORDER) if (U.has(t)) { const T = D.towers[t]; addItem({ uid: t, kind: 'tower', type: t, key: T.hot, name: T.n, cost: T.cost[0], icon: Art.towerIcon(t, 1, 56) }); }
    bar.appendChild(h('div', { class: 'sep' }));
    if (U.has('wall')) addItem({ uid: 'wall', kind: 'wall', key: 'Q', name: '木栅栏', cost: D.walls[0].cost, icon: Art.buildIcon('wall', 56) });
    if (U.has('hay')) addItem({ uid: 'hay', kind: 'hay', key: 'W', name: '草垛', cost: D.hay.cost, icon: Art.buildIcon('hay', 56) });
    for (const sid of D.STATUE_ORDER) if (U.has(sid)) { const S0 = D.statues[sid]; addItem({ uid: sid, kind: 'statue', sid, key: S0.hot, name: S0.n, cost: S0.cost, icon: Art.buildIcon(sid, 56) }); }
    const skills = h('div', { id: 'skill-bar' });
    B.skEls = {};
    for (const id of D.SKILL_ORDER) {
      const S0 = D.skills[id], on = U.has(id);
      const el = h('div', { class: 'sk' + (on ? '' : ' lock'), title: on ? S0.desc : '后续关卡解锁' },
        h('kbd', { text: S0.hot }), h('div', { class: 'ic', text: S0.icon }), h('div', { class: 'nm', text: on ? S0.n : '未解锁' }), h('div', { class: 'cdm', style: { display: 'none' } }));
      el.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); useSkill(id); });
      el.addEventListener('pointerenter', () => on && bbTip({ skill: id }, el));
      el.addEventListener('pointerleave', () => bbTip(null));
      B.skEls[id] = el; skills.appendChild(el);
    }
    s.appendChild(h('div', { id: 'hud-bot' }, bar, skills));
    s.appendChild(h('div', { id: 'sel-panel', class: 'panel' }));
    s.appendChild(h('div', { id: 'tip' }));
    s.appendChild(h('div', { id: 'bb-tip', class: 'panel' }));
    updateHud(true);
  }
  function bbTip(it, el) {
    const tp = $('#bb-tip'); if (!tp) return;
    if (!it) { tp.classList.remove('on'); return; }
    clear(tp);
    if (it.skill) { const S0 = D.skills[it.skill]; tp.appendChild(h('h4', { text: S0.icon + ' ' + S0.n + '（冷却 ' + S0.cd + ' 秒）' })); tp.appendChild(h('div', { text: S0.desc })); }
    else if (it.kind === 'tower') {
      const T = D.towers[it.type];
      tp.appendChild(h('h4', { text: T.n + ' · ' + T.cost[0] + ' 金币' }));
      tp.appendChild(h('div', { text: T.desc }));
      tp.appendChild(h('div', { class: 'muted', style: { marginTop: '4px' }, text: '伤害 ' + T.dmg[0] + (T.multi ? '×' + T.multi : '') + ' · 间隔 ' + T.cd[0] + 's · 射程 ' + T.rng[0] + ' 格 · 耐久 ' + T.hp[0] + (T.ground ? ' · 只打地面' : '') }));
    } else if (it.kind === 'wall') {
      tp.appendChild(h('h4', { text: '城墙 · ' + D.walls[0].cost + ' 金币' }));
      tp.appendChild(h('div', { text: '挡路、拉长牛的路线。可以按住拖动连续造。牛也能撞墙：木栅 ' + D.walls[0].hp + ' → 石墙 ' + D.walls[1].hp + ' → 铁壁 ' + D.walls[2].hp + ' 耐久，墙越结实，牛越愿意绕路。' }));
    } else if (it.kind === 'hay') { tp.appendChild(h('h4', { text: '草垛 · ' + D.hay.cost + ' 金币' })); tp.appendChild(h('div', { text: D.hay.desc })); }
    else if (it.kind === 'statue') { const S0 = D.statues[it.sid]; tp.appendChild(h('h4', { text: S0.n + ' · ' + S0.cost + ' 金币' })); tp.appendChild(h('div', { text: S0.desc })); }
    const r = el.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect();
    const left = Math.max(6, Math.min(1280 - 270, (r.left - sr.left) / UI.k - 90));
    tp.style.left = left + 'px';
    tp.classList.add('on');
  }
  let tipTimer = 0;
  function tip(msg, sec) {
    const el = $('#tip'); if (!el) return;
    if (!msg) { el.classList.remove('on'); return; }
    el.textContent = msg; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(tipTimer);
    if (sec) tipTimer = setTimeout(() => el.classList.remove('on'), sec * 1000);
  }
  const TUT = [
    '① 点下方的「哨塔」（或按 1），再点草地把它建起来。',
    '② 选「木栅栏」（按 Q），按住鼠标拖动造一排墙，把牛的路线（白色虚线）拉长、绕进塔的射程里。',
    '③ 小心红色的「撞」：路线绕得太远、墙又太薄时，牛会直接撞墙！点墙可以升级成石墙。准备好就点右上角「开战」。',
    '④ 打倒牛有金币拿。点一头牛能让附近的塔集火它；空格暂停，F 加速。守住羊城！'
  ];
  function tutorial(step) {
    const B = UI.B; if (!B) return;
    B.tutStep = step;
    if (step >= TUT.length) { tip(null); UI.save.tut = 1; UI.persist(); return; }
    tip(TUT[step], step === 3 ? 9 : 0);
    if (step === 3) setTimeout(() => { if (UI.B === B) tutorial(4); }, 9000);
  }
  function tutCheck(B) {
    if (B.L.id !== 1 || UI.save.tut || B.tutStep >= 4) return;
    const g = B.g;
    if (B.tutStep === 0 && g.blds.some(b => b.kind === 'tower')) tutorial(1);
    else if (B.tutStep === 1 && g.blds.filter(b => b.kind === 'wall').length >= 4) tutorial(2);
    else if (B.tutStep === 2 && g.k >= 1) tutorial(3);
  }

  /* ---------- 模式 / 操作 ---------- */
  function setMode(it) {
    const B = UI.B; if (!B) return;
    B.mode = it; B.skill = null; B.preview = null; B.pvKey = '';
    if (it) { B.sel = null; B.selCow = null; }
    for (const x of B.items) x.el.classList.toggle('on', x === it);
    for (const id in B.skEls) B.skEls[id].classList.remove('on');
    updatePreview();
    UI.sfx('click');
  }
  UI.setMode = setMode;
  function specOf(it) { return it.kind === 'tower' ? { type: it.type } : it.kind === 'statue' ? { sid: it.sid } : {}; }
  function hpOf(it) { return it.kind === 'tower' ? D.towers[it.type].hp[0] : it.kind === 'wall' ? D.walls[0].hp : it.kind === 'statue' ? D.statues[it.sid].hp : 0; }
  function updatePreview() {
    const B = UI.B; if (!B) return;
    const g = B.g, m = B.mode, hv = B.hover;
    if (!m || !hv || !g.inb(hv.x, hv.y)) { B.preview = null; B.ghostOk = false; return; }
    const chk = g.canPlace(m.kind, hv.x, hv.y, specOf(m));
    B.ghostOk = chk.ok;
    const i = g.idx(hv.x, hv.y);
    if (m.kind === 'hay' || g.ter[i] !== NL.T.GRASS || g.occ[i]) { B.preview = null; return; }
    const key = i + '|' + m.uid + '|' + chk.ok;
    if (B.pvKey === key && B.pvField === g.fN) return;
    B.pvKey = key; B.pvField = g.fN;
    const occ = g.previewOcc([i], hpOf(m));
    const fN = g.computeField(false, occ), fS = B.hasSiege ? g.computeField(true, occ) : g.fS;
    B.preview = Object.assign(NL.paths(g, fN, fS, occ), { ok: chk.ok });
  }
  function tryPlace(x, y, quiet) {
    const B = UI.B, g = B.g, m = B.mode;
    const r = g.place(m.kind, x, y, specOf(m));
    if (!r.ok) { if (!quiet && r.msg) { UI.toast(r.msg, 'bad'); UI.sfx('error'); } return false; }
    B.pvKey = '';
    return true;
  }
  function callWave() {
    const B = UI.B; if (!B) return;
    audioInit();
    const r = B.g.callWave();
    if (r.ok && r.bonus) UI.toast('提前迎战！奖励 ' + r.bonus + ' 金币', 'good');
  }
  function cycleSpeed() { const B = UI.B; if (!B) return; B.speed = B.speed === 1 ? 2 : B.speed === 2 ? 3 : 1; $('#btn-speed').textContent = B.speed + '×'; }
  function togglePause() { const B = UI.B; if (!B || B.ended) return; B.paused = !B.paused; $('#btn-pause').textContent = B.paused ? '▶' : '⏸'; if (B.paused) UI.toast('已暂停（空格继续）'); }
  function useSkill(id) {
    const B = UI.B; if (!B) return;
    const g = B.g;
    if (!g.isUnlocked(id)) return UI.toast('这个技能后面的关卡才解锁');
    if (g.skillCd[id] > 0) return UI.toast(D.skills[id].n + '还在冷却（' + Math.ceil(g.skillCd[id]) + ' 秒）');
    if (id === 'gunmu') {
      if (B.skill === 'gunmu') { B.skill = null; B.skEls.gunmu.classList.remove('on'); return; }
      setMode(null); B.skill = 'gunmu'; B.skEls.gunmu.classList.add('on');
      tip('点地图上的某一行，把滚木从城头推下去！（右键取消）', 3);
      return;
    }
    const r = g.useSkill(id);
    if (!r.ok && r.msg) UI.toast(r.msg);
  }
  function selectB(b) {
    const B = UI.B; B.sel = b; B.selCow = null; B.selSig = '';
    if (b) UI.sfx('click');
  }
  function doUpgrade(b) { const g = UI.B.g; const r = g.upgrade(b); if (!r.ok && r.msg) { UI.toast(r.msg, 'bad'); UI.sfx('error'); } UI.B.selSig = ''; }
  function doSell(b) { const g = UI.B.g; const r = g.sell(b); if (r.ok) { UI.toast('出售 +' + r.gold + ' 金币'); UI.B.sel = null; } }
  function doRepair(b) { const g = UI.B.g; const r = g.repair(b); if (!r.ok && r.msg) { UI.toast(r.msg, 'bad'); } UI.B.selSig = ''; }

  /* ---------- 输入 ---------- */
  function cellAt(p) {
    const x = Math.floor((p.x - V.OX) / V.CW), y = Math.floor((p.y - V.OY) / V.CH);
    return { x, y };
  }
  function cowAt(p) {
    const B = UI.B, g = B.g; let best = null, bd = 30;
    for (const c of g.cows) {
      if (!c.alive) continue;
      const q = UI.R.cowPos(c, g.t), sz = D.cows[c.id].size;
      const d = Math.hypot(q.X - p.x, (q.Y - V.CH * 0.45 * sz) - p.y) - sz * 8;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function bindInput() {
    const cv = UI.R.cv;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointermove', e => {
      const B = UI.B; if (!B || UI.screen !== 'battle') return;
      const p = UI.toStage(e), c = cellAt(p);
      const changed = !B.hover || B.hover.x !== c.x || B.hover.y !== c.y;
      B.hover = B.g.inb(c.x, c.y) ? c : null;
      B.hoverB = B.hover ? B.g.occ[B.g.idx(c.x, c.y)] : null;
      if (changed) {
        if (B.drag && B.mode && (B.mode.kind === 'wall' || B.mode.kind === 'hay') && B.hover && (e.buttons & 1)) tryPlace(c.x, c.y, true);
        updatePreview();
      }
      cv.style.cursor = B.mode || B.skill ? 'crosshair' : (B.hoverB || cowAt(p)) ? 'pointer' : 'default';
    });
    cv.addEventListener('pointerdown', e => {
      audioInit();
      const B = UI.B; if (!B || UI.screen !== 'battle' || B.ended) return;
      e.preventDefault();
      const p = UI.toStage(e), c = cellAt(p), g = B.g;
      if (e.button === 2) { cancel(); return; }
      if (B.skill === 'gunmu') {
        if (g.inb(c.x, c.y)) { const r = g.useSkill('gunmu', c.y); if (r.ok) { B.skill = null; B.skEls.gunmu.classList.remove('on'); } }
        return;
      }
      if (B.mode) {
        if (!g.inb(c.x, c.y)) return;
        const ok = tryPlace(c.x, c.y, false);
        if (ok) {
          if (B.mode.kind === 'wall' || B.mode.kind === 'hay') { B.drag = true; try { cv.setPointerCapture(e.pointerId); } catch (er) { } }
          else if (!e.shiftKey) setMode(null);
        }
        return;
      }
      const cow = cowAt(p);
      if (cow) {
        g.focus = g.focus === cow.uid ? 0 : cow.uid;
        B.selCow = cow; B.sel = null; B.selSig = '';
        UI.sfx('click');
        return;
      }
      if (g.inb(c.x, c.y) && g.occ[g.idx(c.x, c.y)]) { selectB(g.occ[g.idx(c.x, c.y)]); return; }
      selectB(null); B.selCow = null;
    });
    const up = () => { if (UI.B) UI.B.drag = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (UI.B) { UI.B.hover = null; UI.B.preview = null; } });

    addEventListener('keydown', e => {
      audioInit();
      if (UI.screen !== 'battle' || !UI.B) { if (e.key === 'Escape' && UI.modals.length) UI.closeModal(); return; }
      const B = UI.B, g = B.g, k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (UI.modals.length) { if (e.key === 'Escape' && !B.ended) { UI.closeModal(); B.paused = false; $('#btn-pause').textContent = '⏸'; } return; }
      if (e.code === 'Space') { e.preventDefault(); togglePause(); return; }
      if (e.key === 'Escape') { if (B.mode || B.skill || B.sel || B.selCow) cancel(); else pauseMenu(); return; }
      if (e.key === 'Tab') { e.preventDefault(); if (B.sel && B.sel.kind === 'tower') { g.cycleMode(B.sel); B.selSig = ''; } return; }
      if (e.key === 'Delete' || e.key === 'Backspace' || k === 'X') { if (B.sel) doSell(B.sel); return; }
      if (k === 'U') { if (B.sel) doUpgrade(B.sel); return; }
      if (k === 'G') { if (B.sel) doRepair(B.sel); return; }
      if (k === 'F') { cycleSpeed(); return; }
      if (k === 'N') { callWave(); return; }
      if (k === 'P') { B.showPath = !B.showPath; UI.toast(B.showPath ? '显示牛的路线' : '隐藏牛的路线'); return; }
      for (const id of D.SKILL_ORDER) if (D.skills[id].hot === k) { useSkill(id); return; }
      const it = B.items.find(x => x.key === k);
      if (it) setMode(B.mode === it ? null : it);
    });
  }
  function cancel() {
    const B = UI.B; if (!B) return;
    if (B.skill) { B.skill = null; for (const id in B.skEls) B.skEls[id].classList.remove('on'); return; }
    if (B.mode) { setMode(null); return; }
    B.sel = null; B.selCow = null;
  }

  /* ---------- HUD ---------- */
  function updateHud(force) {
    const B = UI.B; if (!B) return;
    const g = B.g;
    const sig = [g.gold, g.hp, g.k, Math.ceil(g.nextT), g.spawnQ.length > 0, g.over, B.speed].join('|');
    if (sig !== B.hudSig || force) {
      B.hudSig = sig;
      $('#h-gold').textContent = fmt(g.gold);
      $('#h-hp').textContent = g.hp + '/' + g.maxHp;
      $('#h-hpbar').style.width = (100 * g.hp / g.maxHp) + '%';
      $('#h-hpbox').classList.toggle('low', g.hp / g.maxHp < 0.35);
      $('#h-wave').textContent = g.endless ? '第 ' + g.k + ' 波' : '波次 ' + g.k + ' / ' + g.N;
      const bw = $('#btn-wave');
      bw.classList.remove('go', 'green', 'red', 'gray', 'dis');
      if (g.k === 0) { bw.textContent = '⚔ 开战！'; bw.classList.add('go', 'red'); }
      else if (g.nextT > 0 && g.k < g.N) { const bonus = Math.floor(g.nextT * 1.5); bw.textContent = '下一波 ' + Math.ceil(g.nextT) + 's（提前 +' + bonus + '）'; bw.classList.add('green'); }
      else if (g.k >= g.N) { bw.textContent = g.over ? '战斗结束' : '最后一波！'; bw.classList.add('gray', 'dis'); }
      else { bw.textContent = '牛群进攻中…'; bw.classList.add('gray', 'dis'); }
      // 建造栏：买得起 / 上限
      for (const it of B.items) {
        it.el.classList.toggle('poor', g.gold < it.cost);
        it.el.classList.toggle('limit', it.kind === 'statue' && g.countStatue(it.sid) >= D.statues[it.sid].limit);
      }
      // 下一波预览
      const pk = $('#wave-peek');
      if (g.k < g.N) {
        const w = g.genWave(g.k + 1), cnt = {};
        for (const gr of w.groups) cnt[gr.id] = (cnt[gr.id] || 0) + gr.n;
        clear(pk);
        pk.appendChild(h('span', { text: g.k === 0 ? '第 1 波：' : '下一波：' }));
        for (const id in cnt) pk.appendChild(h('span', { class: D.cows[id].boss ? 'boss' : '' }, h('img', { src: Art.cowIcon(id, 40) }), '×' + cnt[id]));
        pk.style.display = '';
      } else pk.style.display = 'none';
    }
    for (const id in B.skEls) {
      const el = B.skEls[id], cd = g.skillCd[id], m = el.querySelector('.cdm');
      if (!g.isUnlocked(id)) continue;
      if (cd > 0) { m.style.display = ''; m.textContent = Math.ceil(cd); } else m.style.display = 'none';
    }
    updateSel();
  }
  function statRow(label, cur, nxt) { return [h('span', { text: label }), h('span', null, h('b', { text: cur }), nxt != null ? h('span', { class: 'up', text: ' → ' + nxt }) : null)]; }
  function updateSel() {
    const B = UI.B, g = B.g, el = $('#sel-panel');
    const b = B.sel && !B.sel.dead ? B.sel : null;
    const cow = B.selCow && B.selCow.alive ? B.selCow : null;
    if (B.sel && B.sel.dead) B.sel = null;
    if (!b && !cow) { if (el.classList.contains('on')) el.classList.remove('on'); B.selSig = ''; return; }
    let sig;
    if (b) sig = ['b', b.id, b.lv, Math.round(b.hp / b.maxHp * 20), g.gold >= g.upCost(b), g.gold >= g.repairCost(b), b.mode, b.kills, b.bites, g.refund(b)].join('|');
    else sig = ['c', cow.uid, Math.round(cow.hp / cow.maxHp * 30), g.focus === cow.uid].join('|');
    // 位置跟着目标走
    let X, Y;
    if (b) { X = V.OX + (b.x + 0.5) * V.CW; Y = V.OY + (b.y + 0.5) * V.CH; }
    else { const q = UI.R.cowPos(cow, g.t); X = q.X; Y = q.Y; }
    el.style.left = (X < 760 ? X + 40 : X - 300) + 'px';
    el.style.top = Math.max(56, Math.min(588 - (el.offsetHeight || 200), Y - 110)) + 'px';
    if (sig === B.selSig && el.classList.contains('on')) return;
    B.selSig = sig;
    clear(el);
    el.appendChild(h('span', { class: 'x', text: '✕', onclick: () => { B.sel = null; B.selCow = null; } }));
    if (cow) {
      const C = D.cows[cow.id];
      el.appendChild(h('h3', null, h('img', { src: Art.cowIcon(cow.id, 36), style: { width: '36px', height: '36px' } }), C.n, C.boss ? h('span', { class: 'tag r', text: 'BOSS' }) : null));
      el.appendChild(h('div', { class: 'bar red' }, h('i', { style: { width: (100 * cow.hp / cow.maxHp) + '%' } })));
      const st = h('div', { class: 'st' });
      add(st, statRow('生命', Math.ceil(cow.hp) + ' / ' + cow.maxHp));
      add(st, statRow('撞墙', Math.round(cow.siege) + '/秒'));
      add(st, statRow('破城', '-' + C.pow + ' 城防'));
      add(st, statRow('赏金', cow.bounty));
      el.appendChild(st);
      el.appendChild(h('div', { class: 'desc', text: C.desc }));
      el.appendChild(h('div', { class: 'btns' }, h('button', { class: 'btn sm ' + (g.focus === cow.uid ? 'gray' : 'red'), style: { gridColumn: 'span 2' }, onclick: () => { g.focus = g.focus === cow.uid ? 0 : cow.uid; B.selSig = ''; } }, g.focus === cow.uid ? '取消集火' : '🎯 集火它')));
    } else if (b.kind === 'tower') {
      const T = D.towers[b.type], li = b.lv - 1, mx = b.lv >= 5, n = mx ? null : li + 1;
      el.appendChild(h('h3', null, T.n, h('span', { class: 'tag y', text: 'Lv.' + b.lv + ' ' + D.TIER_NAME[li] })));
      el.appendChild(h('div', { class: 'bar' + (b.hp / b.maxHp < 0.35 ? ' red' : '') }, h('i', { style: { width: (100 * b.hp / b.maxHp) + '%' } })));
      const st = h('div', { class: 'st' });
      add(st, statRow('伤害', T.dmg[li] + (T.multi ? ' ×' + T.multi : ''), n != null ? T.dmg[n] : null));
      add(st, statRow('间隔', (T.cd[li] / b.aura.spd).toFixed(2) + 's', n != null ? (T.cd[n] / b.aura.spd).toFixed(2) + 's' : null));
      add(st, statRow('射程', (T.rng[li] * b.aura.rng).toFixed(1), n != null ? (T.rng[n] * b.aura.rng).toFixed(1) : null));
      if (T.slow) add(st, statRow('减速', Math.round(T.slow[li] * 100) + '%', n != null ? Math.round(T.slow[n] * 100) + '%' : null));
      if (T.burn) add(st, statRow('灼烧', T.burn[li] + '/秒', n != null ? T.burn[n] + '/秒' : null));
      if (T.jumps) add(st, statRow('弹射', T.jumps[li] + ' 次', n != null ? T.jumps[n] + ' 次' : null));
      if (T.pdps) add(st, statRow('中毒', T.pdps[li] + '+' + (T.ppct[li] * 100).toFixed(1) + '%', n != null ? T.pdps[n] + '+' + (T.ppct[n] * 100).toFixed(1) + '%' : null));
      if (T.splash) add(st, statRow('溅射', T.splash[li] + ' 格'));
      add(st, statRow('战绩', b.kills + ' 杀 · ' + fmt(b.dmgDealt) + ' 伤害'));
      el.appendChild(st);
      if (b.aura.spd > 1 || b.aura.rng > 1) el.appendChild(h('div', { class: 'desc', text: (b.aura.spd > 1 ? '盘龙柱加持：攻速 +25%  ' : '') + (b.aura.rng > 1 ? '织女加持：射程 +20%' : '') }));
      const up = g.upCost(b), rp = g.repairCost(b);
      el.appendChild(h('div', { class: 'btns' },
        h('button', { class: 'btn sm green' + (mx || g.gold < up ? ' dis' : ''), onclick: () => doUpgrade(b) }, mx ? '已满级' : '升级 ' + up + ' ', mx ? null : h('kbd', { text: 'U' })),
        h('button', { class: 'btn sm blue', onclick: () => { g.cycleMode(b); B.selSig = ''; } }, '目标：' + D.MODES[b.mode]),
        h('button', { class: 'btn sm' + (!rp || g.gold < rp ? ' dis' : ''), onclick: () => doRepair(b) }, rp ? '修理 ' + rp : '完好', rp ? h('kbd', { text: 'G' }) : null),
        h('button', { class: 'btn sm red', onclick: () => doSell(b) }, '出售 +' + g.refund(b))));
    } else {
      let title, desc;
      if (b.kind === 'wall') { title = D.walls[b.lv - 1].n; desc = '牛眼里撞开它 ≈ 多走 ' + Math.round(g.breakCost(b, false)) + ' 格路' + (B.hasSiege ? '（撞城牛 ≈ ' + Math.round(g.breakCost(b, true)) + ' 格）' : '') + '。墙越结实，牛越愿意绕路。'; }
      else if (b.kind === 'statue') { title = D.statues[b.sid].n; desc = D.statues[b.sid].desc; }
      else { title = '草垛'; desc = '还能吃 ' + b.bites + ' 口。' + D.hay.desc; }
      el.appendChild(h('h3', null, title, b.kind === 'wall' ? h('span', { class: 'tag', text: 'Lv.' + b.lv }) : null));
      if (b.kind !== 'hay') { el.appendChild(h('div', { class: 'bar' + (b.hp / b.maxHp < 0.35 ? ' red' : '') }, h('i', { style: { width: (100 * b.hp / b.maxHp) + '%' } }))); el.appendChild(h('div', { class: 'small bold', text: '耐久 ' + Math.ceil(b.hp) + ' / ' + b.maxHp })); }
      el.appendChild(h('div', { class: 'desc', text: desc }));
      const up = g.upCost(b), rp = g.repairCost(b), btns = h('div', { class: 'btns' });
      if (b.kind === 'wall') btns.appendChild(h('button', { class: 'btn sm green' + (!up || g.gold < up ? ' dis' : ''), onclick: () => doUpgrade(b) }, up ? '升级' + D.walls[b.lv].n + ' ' + up : '已满级'));
      if (b.kind !== 'hay') btns.appendChild(h('button', { class: 'btn sm' + (!rp || g.gold < rp ? ' dis' : ''), onclick: () => doRepair(b) }, rp ? '修理 ' + rp : '完好'));
      btns.appendChild(h('button', { class: 'btn sm red', onclick: () => doSell(b) }, '出售 +' + g.refund(b)));
      el.appendChild(btns);
    }
    el.classList.add('on');
  }

  /* ---------- 引擎事件 → 声音 / 画面反馈 ---------- */
  const SHOOT = { sentry: 'shootSentry', scatter: 'shootScatter', cannon: 'shootCannon', pulse: 'shootPulse', frost: 'shootGem', fire: 'shootGem', poison: 'shootGem', thunder: 'zap' };
  function onEvents(B, evs) {
    const g = B.g;
    for (const e of evs) {
      switch (e.type) {
        case 'build': UI.sfx('build'); break;
        case 'upgrade': case 'repair': UI.sfx('upgrade'); break;
        case 'sell': UI.sfx('sell'); break;
        case 'shoot': UI.sfx(SHOOT[e.b.type]); break;
        case 'boom': case 'burst': UI.sfx('boom'); break;
        case 'kill':
          UI.sfx('coin'); seen(e.c.id);
          if (e.c.boss) { UI.moo(0.55, 1.4, 1.3); UI.banner(D.cows[e.c.id].n + ' 被打倒了！', '赏金 +' + e.c.bounty); if (!g.cows.some(c => c.alive && c.boss)) UI.bgm('battle', B.L.id); }
          else if (Math.random() < 0.18) UI.moo(0.9 + Math.random() * 0.5 / D.cows[e.c.id].size, 0.55, 0.7);
          break;
        case 'leak':
          UI.sfx('leak'); seen(e.c.id); B.gateHit = 1; B.flashRed = Math.min(1, B.flashRed + 0.6); B.shake = Math.max(B.shake, 0.35);
          if (g.hp > 0 && g.hp <= 5) UI.toast('羊城快守不住了！', 'bad');
          break;
        case 'destroy':
          UI.sfx('boom'); B.shake = Math.max(B.shake, 0.3);
          if (e.b.kind === 'tower') UI.toast(D.towers[e.b.type].n + '被牛撞塌了！', 'bad');
          if (B.sel === e.b) B.sel = null;
          break;
        case 'ram': if (Math.random() < 0.5) UI.sfx('hit'); break;
        case 'wave':
          UI.sfx('wave');
          if (e.k === 1 && B.tutStep === 0 && (B.L.id !== 1 || UI.save.tut)) tip(null);
          if (e.boss) { UI.bgm('boss'); }
          UI.toast((g.endless ? '第 ' + e.k + ' 波' : '第 ' + e.k + ' / ' + g.N + ' 波') + ' 来了！城中税收 +' + e.tax);
          break;
        case 'boss': {
          const C = D.cows[e.c.id];
          UI.sfx('boss'); UI.moo(0.5, 1.6, 1.4); B.shake = 0.5;
          UI.banner(C.n + ' 来了！', '「' + C.quote + '」', Art.cowIcon(e.c.id, 120));
          break;
        }
        case 'heal': UI.sfx('gem'); break;
        case 'ring': UI.sfx('magicHit'); UI.toast('青牛精用金刚琢收走了' + D.towers[e.b.type].n + '的法力！', 'bad'); break;
        case 'stomp': UI.sfx('boom'); B.shake = 0.7; break;
        case 'summon': UI.moo(0.7, 0.9); break;
        case 'enrage': UI.sfx('boss'); UI.banner('牛魔王 狂暴了！', '移速和撞墙伤害大增'); break;
        case 'charge': if (Math.random() < 0.3) UI.moo(1.2, 0.4, 0.6); break;
        case 'skill':
          if (e.id === 'gunmu') { UI.sfx('whack'); B.shake = 0.4; }
          else if (e.id === 'freeze') UI.sfx('cold');
          else UI.sfx('upgrade');
          break;
        case 'win': onEnd(B, true); break;
        case 'lose': onEnd(B, false); break;
      }
    }
    // 图鉴：见过的牛；第一次见到的牛弹个提示
    for (const c of g.cows) {
      if (c.uid <= B.lastUid) continue;
      B.lastUid = Math.max(B.lastUid, c.uid);
      if (!UI.save.seen[c.id]) {
        UI.save.seen[c.id] = 1; UI.persist();
        if (!c.boss && B.L.id > 1) UI.banner('新牛出没：' + D.cows[c.id].n, D.cows[c.id].desc, Art.cowIcon(c.id, 120));
      }
    }
  }
  function seen(id) { if (!UI.save.seen[id]) { UI.save.seen[id] = 1; UI.persist(); } }
  function onEnd(B, win) {
    if (B.ended) return;
    B.ended = true;
    setMode(null); B.sel = null; B.selCow = null;
    tip(null); clear($('#toast-root'));
    const g = B.g, L = B.L;
    if (A) A.stopBgm();
    UI.sfx(win ? 'win' : 'lose');
    let newBest = false;
    if (win && !L.endless) {
      const st = g.stars();
      if (st > (UI.save.stars[L.id] || 0)) UI.save.stars[L.id] = st;
    }
    if (L.endless) { const kk = Math.max(0, g.k - 1); if (kk > (UI.save.best || 0)) { UI.save.best = kk; newBest = true; } }
    UI.persist();
    setTimeout(() => { if (UI.B === B) resultModal(B, win, newBest); }, win ? 1400 : 1100);
  }
  function resultModal(B, win, newBest) {
    const g = B.g, L = B.L, st = g.stars();
    const next = D.levels.find(l => l.id === L.id + 1);
    const stats = h('div', { class: 'stats' },
      h('div', null, h('b', { text: g.stats.kills }), '击倒'),
      h('div', null, h('b', { text: g.stats.leaks }), '冲进城门'),
      h('div', null, h('b', { text: g.stats.destroyed }), '建筑被撞塌'),
      h('div', null, h('b', { text: SV.fmtTime ? SV.fmtTime(g.t) : Math.round(g.t) + 's' }), '用时'));
    let body;
    if (L.endless) body = [h('h2', { text: '牧场失守' }), h('p', { class: 'center', html: '你守住了 <b style="font-size:28px;color:#c0401a">' + Math.max(0, g.k - 1) + '</b> 波' + (newBest ? '　🎉 新纪录！' : '（最高 ' + (UI.save.best || 0) + ' 波）') }), stats];
    else if (win) body = [h('h2', { text: '守住了！羊城安然无恙' }), h('div', { class: 'bigstars' }, [0, 1, 2].map(i => h('span', { class: i < st ? '' : 'off', text: '★' }))), h('p', { class: 'center muted', text: st >= 3 ? '城防几乎无损，完美！' : st === 2 ? '城防剩一半以上。再稳一点就能三星。' : '惊险过关！城防剩不到一半。' }), stats];
    else body = [h('h2', { text: '城破了……' }), h('p', { class: 'center', text: '牛群冲进了羊城，把菜园子啃得一干二净。多造墙把路绕长，撞城牛来之前把关键的墙升级成石墙！' }), stats];
    const m = UI.modal([body, h('div', { class: 'acts' },
      h('button', { class: 'btn gray', onclick: () => { UI.closeModal(m); UI.toMap(); } }, '返回选关'),
      h('button', { class: 'btn blue', onclick: () => { UI.closeModal(m); UI.startLevel(L); } }, win ? '再玩一次' : '再试一次'),
      win && next ? h('button', { class: 'btn lg green', onclick: () => { UI.closeModal(m); UI.levelIntro(next, true); } }, '下一关 →') : null)]);
  }

  /* ---------- 菜单弹窗 ---------- */
  function pauseMenu() {
    const B = UI.B; if (!B || B.ended) return;
    B.paused = true; $('#btn-pause').textContent = '▶';
    const resume = () => { UI.closeModal(m); B.paused = false; $('#btn-pause').textContent = '⏸'; };
    const m = UI.modal([h('h2', { text: '暂停' }), h('div', { class: 'col', style: { alignItems: 'stretch', minWidth: '260px' } },
      h('button', { class: 'btn lg green', onclick: resume }, '继续'),
      h('button', { class: 'btn blue', onclick: () => { UI.closeModal(m); UI.startLevel(B.L); } }, '重新开始'),
      h('button', { class: 'btn', onclick: () => UI.help() }, '玩法说明'),
      h('button', { class: 'btn', onclick: () => UI.settings() }, '设置'),
      h('button', { class: 'btn gray', onclick: () => { UI.closeModal(m); UI.toMap(); } }, '返回选关'))]);
  }
  UI.settings = function () {
    const mk = (label, key, fn) => h('label', { class: 'slider' }, label, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: UI.save[key], oninput: e => { UI.save[key] = +e.target.value; fn(); UI.persist(); } }));
    const m = UI.modal([h('h2', { text: '设置' }),
      mk('音效', 'sfx', () => { if (A) A.setVol(UI.save.sfx, null); UI.sfx('coin'); }),
      mk('音乐', 'bgm', () => { if (A) A.setVol(null, UI.save.bgm); }),
      h('div', { class: 'artsel' }, h('b', { text: '牛的建模' }),
        ...[['su', '正片（致敬《牛来》）'], ['poster', '海报（Q 版）']].map(([k, label]) => h('button', {
          class: 'btn sm ' + (Art.style === k ? 'green' : 'gray'),
          onclick: () => { UI.save.art = k; UI.persist(); Art.setStyle(k); UI.closeModal(m); UI.settings(); }
        }, label))),
      h('p', { class: 'small muted', text: '音效与战斗音乐来自《保卫羊村》原作；牛叫是 Web Audio 现合成的。' }),
      h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => { if (confirm('确定清空所有进度？')) { UI.save = { stars: {}, best: 0, seen: {}, sfx: UI.save.sfx, bgm: UI.save.bgm, tut: 0, art: UI.save.art }; UI.persist(); UI.closeAll(); UI.toTitle(); } } }, '清空进度'), h('button', { class: 'btn green', onclick: () => UI.closeModal(m) }, '好的'))], { dismiss: true });
  };
  UI.help = function () {
    const m = UI.modal([h('h2', { text: '玩法' }),
      h('p', { html: '牛群从左边的<b>牛群入口</b>出发，沿最短路线冲向右边的<b>羊城城门</b>。每冲进去一头，城防就掉（大牛掉得更多），城防归零就输了。' }),
      h('p', { html: '<b>造墙把路绕长</b>，让塔多打几下。和保卫羊村不同的是——<b>路可以堵死，但牛会撞墙！</b>牛会自己算账：绕远路和撞开一堵墙哪个更快。墙越结实（木栅→石墙→铁壁），它们越愿意绕路；墙被撞薄了，整群牛都会冲过去。' }),
      h('p', { html: '白色虚线是牛现在的路线，红色「撞」表示它们打算撞开的建筑；有撞城牛的关卡还会画一条橙色的攻城路线——撞城牛专挑最薄的墙撞。塔也会被撞塌！' }),
      h('p', { html: '<b>操作</b>：<kbd>1</kbd>~<kbd>8</kbd> 塔　<kbd>Q</kbd> 城墙（按住拖动）　<kbd>W</kbd> 草垛　<kbd>E</kbd><kbd>R</kbd><kbd>T</kbd> 盘龙柱/织女/牛郎　<kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 城主技能<br>' +
        '点塔后 <kbd>U</kbd> 升级　<kbd>G</kbd> 修理　<kbd>X</kbd>/<kbd>Del</kbd> 出售　<kbd>Tab</kbd> 目标优先级　点一头牛让塔<b>集火</b><br>' +
        '<kbd>空格</kbd> 暂停　<kbd>F</kbd> 加速　<kbd>N</kbd> 提前叫下一波（有奖励）　<kbd>P</kbd> 显示/隐藏路线　右键/<kbd>Esc</kbd> 取消　按住 <kbd>Shift</kbd> 连续造塔' }),
      h('div', { class: 'acts' }, h('button', { class: 'btn green', onclick: () => UI.closeModal(m) }, '明白了'))], { dismiss: true });
  };
  UI.bestiary = function () {
    const cards = h('div', { class: 'cards' });
    for (const id of D.COW_ORDER) {
      const C = D.cows[id], seen = UI.save.seen[id];
      const tags = [];
      if (C.fly) tags.push('飞行'); if (C.boss) tags.push('BOSS'); if (C.armor) tags.push('护甲 ' + C.armor); if (C.siegeAI) tags.push('攻城');
      if (C.res) for (const k in C.res) tags.push({ fire: '火', ice: '冰', elec: '雷', poison: '毒', phys: '物理' }[k] + (C.res[k] === 0 ? '免疫' : C.res[k] < 1 ? '抗性' : '弱点'));
      if (C.slowRes) tags.push('抗减速');
      cards.appendChild(h('div', { class: 'card' + (seen ? '' : ' unseen') },
        h('img', { src: Art.cowIcon(id, 90) }), h('h4', { text: seen ? C.n : '？？？' }),
        seen ? h('div', { class: 'q', text: '「' + C.quote + '」' }) : null,
        h('div', { class: 'd', text: seen ? C.desc : '还没在战场上见过。' }),
        seen ? h('div', { class: 'small muted', style: { marginTop: '4px' }, text: '生命 ' + C.hp + ' · 移速 ' + C.spd + ' · 撞墙 ' + C.siege + '/秒 · 破城 ' + C.pow + (tags.length ? ' · ' + tags.join(' · ') : '') }) : null));
    }
    const m = UI.modal([h('h2', { text: '牛群图鉴' }), cards, h('div', { class: 'acts' }, h('button', { class: 'btn green', onclick: () => UI.closeModal(m) }, '关闭'))], { dismiss: true });
  };

  /* ============================================================
   * 主循环
   * ============================================================ */
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    UI.t += dt;
    const B = UI.B;
    try {
      if (UI.screen === 'battle' && B) {
        const g = B.g;
        if (!B.paused && !UI.modals.length) {
          B.acc += dt * B.speed;
          let n = 0;
          while (B.acc >= STEP && n < 12) { g.update(STEP); B.acc -= STEP; n++; }
          if (n >= 12) B.acc = 0;
        } else if (B.ended) g.update(dt);
        onEvents(B, g.drain());
        tutCheck(B);
        B.shake = Math.max(0, B.shake - dt * 1.6); B.gateHit = Math.max(0, B.gateHit - dt * 2.2); B.flashRed = Math.max(0, B.flashRed - dt * 2.5);
        if (B.mode && B.pvField !== g.fN) updatePreview();
        UI.R.draw({ g, t: g.t, mode: B.mode, hover: B.hover, hoverB: B.hoverB, sel: B.sel, skill: B.skill, showPath: B.showPath, showGrid: B.showGrid,
          preview: B.preview, ghostOk: B.ghostOk, shake: B.shake, gateHit: B.gateHit, flashRed: B.flashRed });
        updateHud();
      } else UI.R.drawTitle(UI.t, UI.herd);
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }

  UI.boot = function () {
    UI.R = new NL.Render($('#cv'));
    UI.fit();
    addEventListener('resize', UI.fit);
    makeHerd();
    bindInput();
    document.addEventListener('pointerdown', audioInit, { once: false });
    // 切到别的标签页时自动暂停
    document.addEventListener('visibilitychange', () => {
      const B = UI.B;
      if (document.hidden && B && UI.screen === 'battle' && !B.paused && !B.ended && B.g.k > 0) togglePause();
    });
    if (A) A.setVol(UI.save.sfx, UI.save.bgm);
    UI.toTitle();
    requestAnimationFrame(frame);
  };
})(typeof window !== 'undefined' ? window : globalThis);
