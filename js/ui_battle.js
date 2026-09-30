/* ============================================================
 * 战斗界面
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D, G = SV.Game, UI = SV.UI, h = UI.h, Audio = SV.Audio;
  const BU = UI.Battle = { B: null };
  const TNAME = { sentry: '哨塔', scatter: '散弹塔', cannon: '炮塔', pulse: '波动塔', inlay: '镶嵌塔' };
  const TDESC = {
    sentry: '造价最低、性价比最高的单体输出塔', scatter: '同时攻击 3 个目标，对空双倍伤害',
    cannon: '仅对地，射程极远，范围溅射', pulse: '贯穿一条直线上最多 10 个目标，可攻击隐身', inlay: '本身无攻击，镶嵌宝石后发挥各色宝石威力'
  };
  const MODES = [['first', '最前'], ['near', '最近'], ['strong', '最强'], ['weak', '最弱'], ['air', '空中']];
  BU.TNAME = TNAME;

  /* ---------- 宝石效果说明 ---------- */
  SV.gemText = function (type, c, t) {
    if (c == null) return '无宝石：纯物理伤害，不受属性抗性影响。';
    const fake = { type, lv: 30, gem: { c, t }, id: 0, aura: { dmg: 1, spd: 1, rng: 1 }, kind: 'tower' };
    const B = BU.B || { speedMult: SV.SPEED_MULT, towerStats: SV.Battle.prototype.towerStats };
    const st = SV.Battle.prototype.towerStats.call({ speedMult: SV.SPEED_MULT }, fake);
    const L = [];
    const p = x => Math.round(x * 100) + '%';
    if (st.crit) L.push('暴击 ' + p(st.crit.p) + '，伤害 ×' + st.crit.m.toFixed(1));
    if (st.poison) L.push('中毒：每秒 ' + Math.round(st.poison.dps / Math.max(1, st.dmg) * 100) + '% 攻击力，持续 ' + st.poison.dur + ' 秒（不叠加，取最高）');
    if (st.burn) L.push('燃烧：持续灼烧（与冰冻互相抵消）');
    if (st.slow) L.push('减速 ' + p(st.slow.v) + (type === 'inlay' ? '（随镶嵌塔等级提升）' : type === 'pulse' ? '（随等级提升）' : '') + '，持续 ' + st.slow.dur + ' 秒');
    if (st.stun) L.push(p(st.stun.p) + ' 几率眩晕 ' + st.stun.dur + ' 秒，可打断施法');
    if (st.knock) L.push(p(st.knock.p) + ' 几率击退');
    if (st.fear) L.push(p(st.fear.p) + ' 几率使狼胆怯后退');
    if (st.combo) L.push('7.5% 几率连击 ' + st.combo.n + ' 次');
    if (st.curse) L.push('诅咒：5 秒后结算（命中次数×诅咒能量），并沉默周围狼 2 秒');
    if (st.lightning && st.kind === 'bolt') L.push('闪电攻击：瞬间命中不会 miss，射程 +' + Math.round((st.range / SV.TOWER_RANGE[type] - 1) * 100) + '%；免疫电的狼无视');
    if (st.kind === 'chain') L.push('连锁闪电：弹射 ' + st.chain.n + ' 次，每次伤害递减 ' + p(st.chain.decay));
    if (st.kind === 'flash') L.push('光爆：一次攻击范围内所有目标（含飞行、隐身），不会 miss');
    if (type === 'scatter' && c === 5) L.push('降低攻速，同一目标齐射 ' + st.shots + ' 发 —— 对空单体之王');
    if (type === 'cannon' && c === 5) L.push('射程 ×' + (st.range / SV.TOWER_RANGE.cannon).toFixed(2) + '，无法攻击近处，溅射 ' + p(st.splashRate));
    return L.join('\n') || '——';
  };

  /* ---------- 初始化战斗界面 ---------- */
  BU.enter = function (mapIdx, mode, opts) {
    const s = G.save;
    const B = G.startBattle(mapIdx, mode, opts);
    BU.B = B;
    BU.mode = mode || 'normal';
    BU.sel = null; BU.place = null; BU.hover = null; BU.focus = 0; BU.tab = 'build'; BU.speed = s.settings.speed || 1; BU.acc = 0;
    BU.spec = { type: 'sentry', lv: 1, gem: null }; BU.pick = { c: -1, t: 1 };
    BU.moving = null; BU.auto = false; BU.autoT = 0; BU.over = false; BU.ended = false; BU.finished = false;
    BU.showPath = s.settings.path; BU.showGrid = s.settings.grid;
    BU.mouseDown = false; BU.lastPaint = -1;
    BU.hoverWolf = null;
    const R = UI.renderer;
    R.setView({ x: 0, y: 56, w: 980, h: 664 });
    R.setBattle(B);
    BU.build();
    UI.hooks.battleFrame = BU.frameHook;
    UI.show('battle');
    if (SV.WolfTalk) SV.WolfTalk.reset();
    Audio.playBgm('battle', mapIdx);
    BU.refreshAll();
    // 新手引导
    if (!s.tutorial.done && mapIdx === 0 && mode !== 'nightmare') BU.tutorial(0);
    B.onEvent = (n, d) => { G.onBattleEvent(n, d); BU.onEvent(n, d); };
  };

  /* ---------- DOM ---------- */
  BU.build = function () {
    const B = BU.B, root = UI.clear(document.getElementById('scr-battle'));
    const nm = BU.mode === 'nightmare';
    BU.el = {};
    const E = BU.el;
    const btn = (txt, title, fn, cls) => h('button', { class: 'btn sm ib ' + (cls || ''), title, text: txt, onclick: () => { Audio.play('click'); fn(); } });
    E.silver = h('span', { text: '0' }); E.lives = h('span', { text: '0' }); E.wave = h('span', { text: '' });
    E.progBar = h('i'); E.progTxt = h('span');
    E.diff = h('span', { class: 'tag' });
    E.spd = [1, 2, 4].map(v => h('button', { class: 'btn sm spd ' + (v === BU.speed ? 'on' : ''), style: { padding: '2px 8px' }, text: v + 'x', onclick: () => { Audio.play('click'); BU.setSpeed(v); } }));
    E.pauseBtn = btn('⏸', '暂停 (空格)', () => BU.togglePause());
    E.autoWave = btn('⏩', '自动开怪', () => { B.autoWave = !B.autoWave; G.save.settings.autoWave = B.autoWave; BU.refreshTop(); }, '');
    E.autoAI = btn('🤖', '挂机助手：自动造塔升级', () => BU.toggleAuto(), '');
    E.pathBtn = btn('🐾', '显示走狼路线 (P)', () => { BU.showPath = !BU.showPath; BU.refreshTop(); });
    E.gridBtn = btn('▦', '显示网格 (G)', () => { BU.showGrid = !BU.showGrid; BU.refreshTop(); });
    E.fsBtn = btn('⛶', '全屏 (Enter键 在开战前用于开始)', () => UI.toggleFullscreen());
    E.sndBtn = btn('🔊', '音效开关', () => { const s = G.save.settings; if (s.sfx > 0) { BU._sfx = s.sfx; s.sfx = 0; s.bgm = 0; } else { s.sfx = BU._sfx || 0.6; s.bgm = 0.3; } Audio.setVol(s.sfx, s.bgm); BU.refreshTop(); });
    const top = h('div', { class: 'btop' },
      h('button', { class: 'btn sm red', text: '🏳 撤退', onclick: () => { Audio.play('click'); BU.retreat(); } }),
      h('div', { class: 'bmap' }, B.map.name + (nm ? ' · 噩梦' : ''), ' ', E.diff),
      h('div', { class: 'bprog' }, h('div', { class: 'bar' }, E.progBar, E.progTxt)),
      h('div', { class: 'res', style: { height: '30px', fontSize: '15px' } }, UI.coinImg(), E.silver),
      h('div', { class: 'res', style: { height: '30px', fontSize: '15px' }, title: '羊村生命：狼漏进村会扣除，归零则失败' }, '❤', E.lives),
      h('div', { class: 'ctl' }, E.pauseBtn, ...E.spd, E.autoWave, E.autoAI, E.pathBtn, E.gridBtn, E.sndBtn, E.fsBtn));
    // 侧栏
    E.side = h('div', { class: 'bside' });
    E.tabs = h('div', { class: 'tabs' });
    ['build:建造', 'info:详情', 'wave:波次'].forEach(x => { const [k, n] = x.split(':'); const t = h('div', { class: 't', text: n, onclick: () => { Audio.play('click'); BU.setTab(k); } }); t.dataset.k = k; E.tabs.appendChild(t); });
    E.pane = h('div', { class: 'bpane scroll' });
    E.side.appendChild(E.tabs); E.side.appendChild(E.pane);
    // 波次条
    E.wavebar = h('div', { class: 'wavebar' });
    E.start = h('button', { class: 'btn xl green startbtn', text: '⚔ 开始迎战！', onclick: () => { Audio.play('click'); BU.start(); } });
    E.call = h('button', { class: 'btn sm blue', style: { position: 'absolute', left: '8px', bottom: '40px', zIndex: 3 }, text: '⏭ 立即召唤下一波', onclick: () => { Audio.play('click'); if (!B.over && B.started) { B.callWave(); } } });
    E.lure = h('button', { class: 'btn sm purple', style: { position: 'absolute', left: '190px', bottom: '40px', zIndex: 3 }, text: '🐺 引狼', title: '额外引来一批狼（不影响进度，银币经验减半）', onclick: () => { Audio.play('click'); if (!B.lure()) UI.toast('引狼次数已用完', 'err'); BU.refreshTop(); } });
    E.layout = h('button', { class: 'btn sm gray', style: { position: 'absolute', left: '8px', bottom: '40px', zIndex: 3 }, text: '📋 载入上次布阵', onclick: () => { Audio.play('click'); BU.loadLayout(); } });
    E.hint = h('div', { class: 'hintbar', text: '' });
    E.tip = h('div', { style: { position: 'absolute', display: 'none', zIndex: 8, pointerEvents: 'none', padding: '6px 10px', borderRadius: '10px', background: 'rgba(30,18,8,.92)', color: '#ffe9b5', fontSize: '12px', lineHeight: 1.5, maxWidth: '240px', border: '2px solid #ffd23f', whiteSpace: 'pre-line' } });
    root.append(top, E.side, E.wavebar, E.start, E.call, E.lure, E.layout, E.hint, E.tip);
    BU.bindCanvas();
    BU.renderPane();
  };

  BU.bindCanvas = function () {
    const cv = document.getElementById('cv'), R = UI.renderer;
    if (BU._bound) return; BU._bound = true;
    const pos = e => { const p = R.clientToLogical(e.clientX, e.clientY); return p; };
    cv.addEventListener('mousemove', e => { if (UI.screen !== 'battle') return; BU.onMove(pos(e), e); });
    cv.addEventListener('mousedown', e => { if (UI.screen !== 'battle') return; e.preventDefault(); if (e.button === 0) { BU.mouseDown = true; BU.onClick(pos(e), e); } else if (e.button === 2) { BU.cancel(); } });
    addEventListener('mouseup', () => { BU.mouseDown = false; BU.lastPaint = -1; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mouseleave', () => { BU.hover = null; BU.hoverWolf = null; if (BU.el && BU.el.tip) BU.el.tip.style.display = 'none'; });
    addEventListener('keydown', e => { if (UI.screen !== 'battle' || UI.modals.length) return; if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; BU.onKey(e); });
  };

  BU.setTab = function (k) { BU.tab = k; BU.renderPane(); };
  BU.setSpeed = function (v) { BU.speed = v; G.save.settings.speed = v; BU.el.spd.forEach((b, i) => b.classList.toggle('on', [1, 2, 4][i] === v)); };
  BU.togglePause = function () { const B = BU.B; B.paused = !B.paused; BU.refreshTop(); };
  BU.toggleAuto = function () { BU.auto = !BU.auto; UI.toast(BU.auto ? '🤖 挂机助手已开启：自动造塔与升级' : '挂机助手已关闭'); BU.refreshTop(); };

  BU.start = function () {
    const B = BU.B; if (B.started) return;
    B.startBattle(); BU.refreshTop(); BU.renderWaveBar();
    BU.tutorialAdvance('started');
  };

  BU.retreat = function () {
    const B = BU.B; if (B.over) return;
    const won = false;
    UI.confirm(BU.mode === 'nightmare' ? '结束本次噩梦？\n将根据已坚持的波数结算宝箱奖励。' : (B.infinite ? '结束本局并结算？\n击杀所得银币、经验与掉落都会保留' + (B.lapDone ? '，并计为通关。' : '。完成第一圈（进度 2400）才算通关。') : '确认撤退？\n本局不会获得通关奖励，但击杀所得银币与经验保留，已建造的塔将被拆除（宝石回收）。'), () => {
      B.retreat();
    }, { yes: '撤退', danger: true, title: '撤退' });
  };

  BU.cancel = function () {
    if (BU.moving) { BU.moving = null; BU.hint('已取消搬迁'); return; }
    if (BU.place) { BU.place = null; BU.renderPane(); return; }
    if (BU.sel) { BU.sel = null; BU.renderPane(); return; }
  };

  BU.hint = function (t) { BU.el.hint.textContent = t; };

  /* ---------- 输入 ---------- */
  BU.ghostValid = function () {
    const B = BU.B, p = BU.place, hv = BU.hover; if (!p || !hv || !hv.ok) return false;
    if (p.kind === 'bomb') { const wb = B.buildingAt(hv.x, hv.y); return !!(wb && wb.kind === 'wall' && !wb.bomb && B.bombAvail() > 0); }
    if (!B.cellFree(hv.x, hv.y)) return false;
    return true;
  };
  BU.onMove = function (p, e) {
    const R = UI.renderer, B = BU.B;
    const c = R.toCell(p.x, p.y);
    BU.hover = c;
    BU.hoverB = c.ok ? B.buildingAt(c.x, c.y) : null;
    BU.hoverWolf = R.wolfAt(p.x, p.y);
    const tip = BU.el.tip;
    if (BU.hoverWolf && !BU.place) {
      const w = BU.hoverWolf, def = w.def;
      const rs = []; for (const k in def.res) { const v = def.res[k]; rs.push(({ fire: '火', frost: '冰', poison: '毒', light: '电/光', crit: '暴击', beat: '击退', vertigo: '眩晕' }[k]) + (v >= 1 ? '免疫' : v > 0 ? '抗' + Math.round(v * 100) + '%' : '怕' + Math.round(-v * 100) + '%')); }
      tip.textContent = def.n + (w.boss ? ' [BOSS]' : w.elite ? ' [精英]' : '') + '\n生命 ' + SV.fmt(w.hp) + ' / ' + SV.fmt(w.maxhp) + (w.fly ? '\n✈ 飞行' : '') + (rs.length ? '\n' + rs.join(' ') : '') + '\n点击集火';
      tip.style.display = 'block';
      const sx = Math.min(1040, p.x + 16), sy = Math.max(64, p.y - 20);
      tip.style.left = sx + 'px'; tip.style.top = sy + 'px';
    } else tip.style.display = 'none';
    if (BU.mouseDown && BU.place && BU.place.kind === 'wall' && c.ok) {
      const key = c.y * 100 + c.x;
      if (key !== BU.lastPaint) { BU.lastPaint = key; BU.tryPlace(c); }
    }
  };

  BU.onClick = function (p, e) {
    const R = UI.renderer, B = BU.B; if (B.over) return;
    const c = R.toCell(p.x, p.y);
    BU.hover = c;
    if (BU.moving) { if (c.ok) { const r = B.moveTower(BU.moving, c.x, c.y); if (r.ok) { Audio.play('build'); BU.sel = BU.moving; BU.moving = null; BU.renderPane(); } else UI.toast(r.msg, 'err'); } return; }
    if (BU.place) {
      if (!c.ok) return;
      const exist = B.buildingAt(c.x, c.y);
      if (exist && BU.place.kind === 'bomb') { BU.tryPlace(c, e); return; }
      if (exist) { BU.sel = exist; BU.place = null; BU.setTab('info'); return; }
      BU.tryPlace(c, e);
      return;
    }
    // 选狼（集火）
    const w = R.wolfAt(p.x, p.y);
    if (w) { BU.focus = BU.focus === w.uid ? 0 : w.uid; B.focusId = BU.focus; BU.hint(BU.focus ? '已锁定集火：' + w.def.n + '（再次点击取消）' : ''); if (BU.focus) { BU.sel = null; BU.setTab('info'); } return; }
    if (c.ok) {
      const b = B.buildingAt(c.x, c.y);
      if (b) {
        if (e && e.ctrlKey && b.kind === 'tower') { const r = B.upgrade(b, b.lv + 1); if (r.ok) Audio.play('upgrade'); else if (r.msg) UI.toast(r.msg, 'err'); BU.renderPane(); return; }
        BU.sel = b; BU.setTab('info'); Audio.play('click'); return;
      }
    }
    if (BU.sel || BU.focus) { BU.sel = null; BU.focus = 0; B.focusId = 0; BU.renderPane(); }
  };

  BU.tryPlace = function (c, e) {
    const B = BU.B, p = BU.place; if (!p) return;
    let r;
    if (p.kind === 'bomb') {
      const wb = B.buildingAt(c.x, c.y);
      r = wb ? B.addBomb(wb) : { ok: false, msg: '炸弹要装在墙上：先点一堵墙' };
      if (r.ok) { Audio.play('build'); BU.refreshTop(); BU.renderPaneLight(); if (B.bombAvail() < 1) { BU.place = null; BU.hint('炸弹已用完'); BU.renderPane(); } }
      else if (r.msg) UI.toast(r.msg, 'err');
      return;
    }
    if (p.kind === 'tower') {
      let gem = BU.spec.gem;
      if (gem && !B.gemAvail(gem)) gem = null;
      r = B.build('tower', c.x, c.y, { type: p.type, lv: BU.spec.lv, gem });
    } else if (p.kind === 'wall') r = B.build('wall', c.x, c.y);
    else if (p.kind === 'statue') r = B.build('statue', c.x, c.y, { sid: p.sid });
    else if (p.kind === 'trap') r = B.build('trap', c.x, c.y, { tid: p.tid });
    if (r.ok) {
      Audio.play('build');
      BU.tutorialAdvance('built');
      if (p.kind === 'tower' && !(e && e.shiftKey)) { /* 保留 ghost 连续建造 */ }
      BU.refreshTop();
      if (p.kind === 'tower' && !B.canAfford(B.towerCost(p.type, BU.spec.lv))) { BU.hint('银币不足，已暂停连续建造'); }
      BU.renderPaneLight();
    } else { UI.toast(r.msg, 'err'); }
  };

  BU.onKey = function (e) {
    const B = BU.B, k = e.key;
    if ((k === ' ' || k === 'Enter') && document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    const towers = ['sentry', 'scatter', 'cannon', 'pulse', 'inlay'];
    if (k >= '1' && k <= '5') { BU.pickTower(towers[+k - 1]); e.preventDefault(); }
    else if (k === 'q' || k === 'Q') { BU.pickAux({ kind: 'wall' }); }
    else if (k === 'b' || k === 'B') { if (B.mode === 'arena') return; if (B.bombAvail() < 1) UI.toast('没有炸弹了（商店可以买）', 'err'); else BU.pickAux({ kind: 'bomb' }); }
    else if (k === ' ') { BU.togglePause(); e.preventDefault(); }
    else if (k === 'Escape') { BU.cancel(); }
    else if (k === 'p' || k === 'P') { BU.showPath = !BU.showPath; BU.refreshTop(); }
    else if (k === 'g' || k === 'G') { BU.showGrid = !BU.showGrid; BU.refreshTop(); }
    else if (k === 'f' || k === 'F') { BU.setSpeed(BU.speed === 1 ? 2 : BU.speed === 2 ? 4 : 1); }
    else if ((k === 'u' || k === 'U') && BU.sel && BU.sel.kind === 'tower') { const r = B.upgrade(BU.sel, BU.sel.lv + 1); if (r.ok) Audio.play('upgrade'); else if (r.msg) UI.toast(r.msg, 'err'); BU.renderPane(); }
    else if ((k === 'Delete' || k === 's' || k === 'S') && BU.sel) { BU.sellSel(); }
    else if ((k === 'm' || k === 'M') && BU.sel && BU.sel.kind === 'tower') { BU.moving = BU.sel; BU.hint('点击目标格子搬迁（右键取消）'); }
    else if (k === 'Enter' && !B.started) BU.start();
    else if (k === '=' || k === '+') { BU.spec.lv = Math.min(B.towerMax(BU.spec.type), BU.spec.lv + 1); BU.renderPane(); }
    else if (k === '-') { BU.spec.lv = Math.max(1, BU.spec.lv - 1); BU.renderPane(); }
    else if (k === 'ArrowUp' && BU.sel) BU.sel.mode = 'first';
  };

  BU.sellSel = function () {
    const B = BU.B, b = BU.sel; if (!b) return;
    if (B.mode === 'nightmare') { UI.toast('噩梦模式中不能出售', 'err'); return; }
    if (B.sell(b)) { Audio.play('sell'); BU.sel = null; BU.renderPane(); BU.refreshTop(); }
  };

  BU.pickTower = function (type) {
    const B = BU.B;
    BU.spec.type = type; BU.spec.lv = Math.min(BU.spec.lv, B.towerMax(type));
    BU.place = { kind: 'tower', type };
    BU.sel = null; BU.moving = null;
    if (BU.tab !== 'build') BU.tab = 'build';
    BU.renderPane(); BU.tutorialAdvance('picked');
  };
  BU.pickAux = function (p) { BU.place = p; BU.sel = null; BU.moving = null; BU.tab = 'build'; BU.renderPane(); };

  BU.loadLayout = function () {
    const r = G.loadLayout(BU.B);
    if (!r.n && !r.fail) UI.toast('还没有保存过这张图的布阵', 'err');
    else { UI.toast('已载入 ' + r.n + ' 件建筑' + (r.fail ? '，' + r.fail + ' 件失败：' + r.msg : ''), r.fail ? 'err' : 'good'); Audio.play('build'); }
    BU.refreshTop(); BU.renderPane();
  };

  /* ---------- 侧栏渲染 ---------- */
  BU.renderPaneLight = function () { BU.refreshAffordable(); };
  BU.renderPane = function () {
    const B = BU.B, E = BU.el;
    const keepScroll = E.pane.scrollTop, sameTab = BU._lastTab === BU.tab; BU._lastTab = BU.tab;
    const pane = UI.clear(E.pane);
    E.tabs.querySelectorAll('.t').forEach(t => t.classList.toggle('on', t.dataset.k === BU.tab));
    if (BU.tab === 'build') BU.paneBuild(pane);
    else if (BU.tab === 'info') BU.paneInfo(pane);
    else BU.paneWave(pane);
    if (sameTab) pane.scrollTop = keepScroll;
  };

  BU.costOf = () => BU.B.towerCost(BU.spec.type, BU.spec.lv);

  BU.paneBuild = function (pane) {
    const B = BU.B, spec = BU.spec;
    const towers = ['sentry', 'scatter', 'cannon', 'pulse', 'inlay'];
    towers.forEach((tp, i) => {
      const cost = B.towerCost(tp, tp === spec.type ? spec.lv : Math.min(spec.lv, B.towerMax(tp)));
      const sel = BU.place && BU.place.kind === 'tower' && BU.place.type === tp;
      const card = h('div', { class: 'tcard ' + (sel ? 'sel ' : '') + (B.silver < cost ? 'dis' : ''), onclick: () => { Audio.play('click'); BU.pickTower(tp); } },
        h('span', { class: 'hk', text: i + 1 }),
        h('img', { src: SV.Art.towerIconURL(tp, tp === spec.type ? spec.gem : null, 30) }),
        h('div', null, h('div', { class: 'nm', text: TNAME[tp] }), h('div', { class: 'ds', text: TDESC[tp] })),
        h('div', { class: 'pr', text: '🪙' + SV.fmt(cost) }));
      card.dataset.tp = tp;
      pane.appendChild(card);
    });
    // 等级
    const max = B.towerMax(spec.type);
    const num = h('input', { class: 'num', type: 'number', min: 1, max: max, value: spec.lv, onchange: e => { spec.lv = SV.clamp(parseInt(e.target.value) || 1, 1, max); BU.renderPane(); } });
    const range = h('input', { type: 'range', min: 1, max: max, value: spec.lv, oninput: e => { spec.lv = +e.target.value; num.value = spec.lv; BU.refreshAffordable(); BU.updateBuildCost(); }, onchange: () => BU.renderPane() });
    pane.appendChild(h('div', { class: 'small bold', style: { marginTop: '4px' }, text: '建造等级：直接建成 Lv.' + spec.lv + '（上限 ' + max + '）' }));
    pane.appendChild(h('div', { class: 'lvctl' }, h('button', { class: 'btn xs', text: '−', onclick: () => { spec.lv = Math.max(1, spec.lv - 1); BU.renderPane(); } }), range, num, h('button', { class: 'btn xs', text: '+', onclick: () => { spec.lv = Math.min(max, spec.lv + 1); BU.renderPane(); } })));
    pane.appendChild(h('div', { class: 'row', style: { gap: '3px', marginBottom: '4px' } },
      ...[1, 5, 10, 20, 40, 'MAX'].map(v => h('button', { class: 'btn xs', text: v === 'MAX' ? '可负担' : v, onclick: () => { Audio.play('click'); if (v === 'MAX') { let lv = 1; while (lv < max && B.towerCost(spec.type, lv + 1) <= B.silver) lv++; spec.lv = lv; } else spec.lv = Math.min(max, v); BU.renderPane(); } }))));
    BU.buildCostEl = h('div', { class: 'small muted', text: '当前造价：🪙 ' + SV.fmtFull(BU.costOf()) });
    pane.appendChild(BU.buildCostEl);
    // 宝石
    pane.appendChild(h('div', { class: 'hr' }));
    pane.appendChild(h('div', { class: 'small bold', text: '镶嵌宝石（战斗后自动回收）' }));
    BU.gemPicker(pane, spec.gem, (gem) => { spec.gem = gem; BU.renderPane(); }, spec.type);
    // 辅助建筑
    pane.appendChild(h('div', { class: 'hr' }));
    pane.appendChild(h('div', { class: 'small bold', text: '辅助建筑（不计入面板造价）' }));
    const aux = h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr' } });
    const items = [
      { kind: 'wall', n: '墙 (Q)', c: SV.WALL_COST, d: '拦路改道' },
      ...Object.keys(SV.STATUES).map(k => ({ kind: 'statue', sid: k, n: SV.STATUES[k].n, c: SV.STATUES[k].cost, d: SV.STATUES[k].fx })),
      ...Object.keys(SV.TRAPS).map(k => ({ kind: 'trap', tid: k, n: SV.TRAPS[k].n, c: SV.TRAPS[k].cost, d: SV.TRAPS[k].fx }))
    ];
    if (B.mode !== 'arena') items.push({ kind: 'bomb', n: '炸弹 (B)', c: 0, stock: B.bombAvail(), d: SV.BOMB.fx });
    for (const it of items) {
      const sel = BU.place && BU.place.kind === it.kind && (BU.place.sid || BU.place.tid || '') === (it.sid || it.tid || '');
      // 炸弹 / 机关优先用原作道具图标，其余（墙、雕像）本来就是原版矢量
      const fallbackIc = () => SV.Art.iconURL('aux_' + it.kind + (it.sid || it.tid || ''), 40, 40, (cx, w, hh) => { if (it.kind === 'wall') SV.Art.drawWall(cx, 36, 20, 24); else if (it.kind === 'bomb') { SV.Art.drawWall(cx, 36, 20, 24); SV.Art.drawBomb(cx, 36, 20, 24, false, 0); } else if (it.kind === 'statue') SV.Art.drawStatue(cx, it.sid, 34, 20, 26, 0.3); else SV.Art.drawTrap(cx, it.tid, 36, 20, 22, true); });
      const orig = SV.Art.itemURL || (() => null);
      const ic = it.kind === 'bomb' ? (orig('baozhatong1', 40, 40) || fallbackIc())
               : it.kind === 'trap' ? (orig(it.tid === 'clamp' ? 'bushoujia1' : 'za_le', 40, 40) || fallbackIc())
               : fallbackIc();
      const dis = it.kind === 'bomb' ? it.stock < 1 : B.silver < it.c;
      aux.appendChild(h('div', { class: 'card ' + (sel ? 'sel' : '') + (dis ? ' dis' : ''), style: { padding: '4px 6px', cursor: 'pointer', display: 'flex', gap: '4px', alignItems: 'center' }, title: it.d, onclick: () => { Audio.play('click'); if (it.kind === 'bomb' && it.stock < 1) { UI.toast('没有炸弹了（商店可以买）', 'err'); return; } BU.pickAux(it.kind === 'wall' ? { kind: 'wall' } : it.kind === 'bomb' ? { kind: 'bomb' } : it.kind === 'statue' ? { kind: 'statue', sid: it.sid } : { kind: 'trap', tid: it.tid }); } },
        h('img', { src: ic, style: { width: '34px', height: '34px' } }), h('div', null, h('div', { class: 'bold small', text: it.n }), h('div', { class: 'small muted', text: it.kind === 'bomb' ? '库存 ' + it.stock + ' · 装在墙上' : '🪙' + SV.fmt(it.c) }))));
    }
    pane.appendChild(aux);
    pane.appendChild(h('div', { class: 'hr' }));
    pane.appendChild(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } },
      h('button', { class: 'btn sm blue', title: '自动放置墙壁，把狼的路线拉得尽量长（不会堵死）', text: '🧱 智能绕路', onclick: () => BU.autoMaze() }),
      h('button', { class: 'btn sm gray', text: '📤 分享布阵', onclick: () => BU.shareLayout() }),
      h('button', { class: 'btn sm gray', text: '📥 导入布阵', onclick: () => BU.importLayout() })));
    if (!B.started) pane.appendChild(h('div', { class: 'small muted', style: { marginTop: '6px' }, text: '提示：在地图上拖动可连续造墙；Shift 可连续建塔；右键取消。' }));
  };

  BU.autoMaze = function () {
    const B = BU.B; if (B.over) return;
    const before = B.field.dist[B.map.spawns[0]];
    const n = SV.AI.autoMaze(B, 60);
    if (!n) { UI.toast('这里已经没有可以继续绕路的位置了', 'err'); return; }
    Audio.play('build'); UI.toast('已放置 ' + n + ' 段墙，路线 ' + before.toFixed(1) + ' → ' + B.field.dist[B.map.spawns[0]].toFixed(1) + ' 格', 'good');
    BU.refreshTop(); BU.tutorialAdvance('built');
  };
  BU.shareLayout = function () {
    const B = BU.B; const code = G.layoutCode(B);
    if (!B.buildings.length) { UI.toast('还没有布阵可以分享', 'err'); return; }
    const ta = h('textarea', { class: 'code', readonly: true }); ta.value = code;
    const m = UI.modal({ title: '📤 布阵分享码', width: 520, body: h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' }, text: '把下面的代码发给朋友，他在「' + B.map.name + '」里点「导入布阵」即可复刻你的阵型（宝石按对方库存尽量镶嵌）。' }), ta), footer: h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn green', text: '复制', onclick: () => { ta.select(); try { document.execCommand('copy'); UI.toast('已复制', 'good'); } catch (e) { } } })) });
    setTimeout(() => ta.select(), 50);
  };
  BU.importLayout = function () {
    const B = BU.B; if (B.started) { UI.toast('请在开战前导入布阵', 'err'); return; }
    const ta = h('textarea', { class: 'code', placeholder: '在此粘贴布阵分享码 YC1:...' });
    const m = UI.modal({ title: '📥 导入布阵', width: 520, body: ta, footer: h('div', { class: 'row', style: { justifyContent: 'center', gap: '10px' } }, h('button', { class: 'btn gray', text: '取消', onclick: () => m.close() }), h('button', { class: 'btn green', text: '导入', onclick: () => {
      const o = G.parseLayoutCode(ta.value); if (!o) { UI.toast('分享码无效', 'err'); return; }
      if (o.m !== B.mapIdx) { UI.toast('这份布阵属于「' + (D.maps[o.m] ? D.maps[o.m].n : '?') + '」，与当前地图不符', 'err'); return; }
      const r = G.applyLayoutList(B, o.l); m.close(); UI.toast('已导入 ' + r.n + ' 件建筑' + (r.fail ? '，' + r.fail + ' 件失败（' + r.msg + '）' : ''), r.fail ? 'err' : 'good'); BU.refreshTop(); BU.renderPane();
    } })) });
  };
  BU.updateBuildCost = function () { if (BU.buildCostEl) BU.buildCostEl.textContent = '当前造价：🪙 ' + SV.fmtFull(BU.costOf()); };

  /* 宝石选择器：onPick(gem|null) */
  BU.gemPicker = function (parent, cur, onPick, type, opts) {
    const B = BU.B;
    const stock = B.gemStock;
    const st = BU.pick;
    if (cur) { st.c = cur.c; st.t = cur.t; }
    const colors = h('div', { class: 'gempick' });
    colors.appendChild(h('div', { class: 'gp none ' + (!cur ? 'sel' : ''), text: '无', onclick: () => { Audio.play('click'); st.c = -1; onPick(null); } }));
    for (let c = 0; c < 6; c++) {
      let total = 0; if (stock) for (let t = 0; t < 5; t++) total += stock[c][t];
      const el = h('div', { class: 'gp ' + (st.c === c ? 'sel' : '') + (total === 0 ? ' dis' : ''), title: SV.GEM_COLORS[c].n + '宝石', onclick: () => { Audio.play('click'); st.c = c; if (stock && stock[c][st.t - 1] === 0) { for (let t = 1; t <= 5; t++) if (stock[c][t - 1] > 0) { st.t = t; break; } } if (stock && stock[c][st.t - 1] > 0) onPick({ c, t: st.t }); else { onPick(null); st.c = c; BU.renderPane(); } } },
        UI.gemImg(c, st.c === c ? st.t : 3, 26), h('span', { text: total }));
      colors.appendChild(el);
    }
    parent.appendChild(colors);
    if (st.c >= 0) {
      const tiers = h('div', { class: 'tiers' });
      for (let t = 1; t <= 5; t++) {
        const cnt = stock ? stock[st.c][t - 1] : 99;
        tiers.appendChild(h('div', { class: 'tr ' + (st.t === t && cur ? 'sel' : ''), style: { opacity: cnt > 0 ? 1 : 0.35 }, title: SV.GEM_TIERS[t - 1], onclick: () => { Audio.play('click'); st.t = t; if (cnt > 0) onPick({ c: st.c, t }); else { UI.toast('没有这个品质的' + SV.GEM_COLORS[st.c].n + '宝石', 'err'); } } },
          SV.GEM_TIERS[t - 1], h('br'), '×' + cnt));
      }
      parent.appendChild(tiers);
      parent.appendChild(h('div', { class: 'effects', text: SV.gemText(type, cur ? cur.c : st.c, cur ? cur.t : st.t) }));
    } else parent.appendChild(h('div', { class: 'effects', text: SV.gemText(type, null) }));
  };

  BU.paneInfo = function (pane) {
    const B = BU.B;
    // 集火狼
    const fw = B.wolves.find(w => w.uid === BU.focus);
    if (fw) BU.wolfPanel(pane, fw);
    const b = BU.sel;
    if (!b) { if (!fw) pane.appendChild(h('div', { class: 'muted center', style: { marginTop: '40px', lineHeight: 1.8 }, html: '点击地图上的建筑查看详情<br>点击狼可锁定集火<br><br><span class="small">Ctrl+点击塔：快速升 1 级</span>' })); return; }
    if (b.kind === 'tower') BU.towerPanel(pane, b);
    else {
      const name = b.kind === 'wall' ? '墙' : b.kind === 'statue' ? SV.STATUES[b.sid].n : SV.TRAPS[b.tid].n;
      const fx = b.kind === 'wall' ? '拦路改道，不计入面板造价。' : b.kind === 'statue' ? SV.STATUES[b.sid].fx : SV.TRAPS[b.tid].fx;
      pane.appendChild(h('div', { class: 'card' }, h('h4', { text: name }), h('div', { class: 'small', text: fx })));
      if (b.kind === 'wall' && B.mode !== 'arena') {
        const bc = h('div', { class: 'card', style: { marginTop: '6px' } }, h('div', { class: 'bold small', text: '💣 炸弹墙　库存 ' + B.bombAvail() + '　已装 ' + B.bombsOn + '/' + SV.BOMB.limit }));
        if (b.bomb) {
          bc.appendChild(h('div', { class: 'small muted', text: b.bomb.arm > 0 ? '正在上膛……' : '已上膛：地面狼靠近就会引爆。' }));
          bc.appendChild(h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } },
            h('button', { class: 'btn sm orange grow', text: '💥 引爆', onclick: () => { if (B.detonate(b)) { Audio.play('boom'); BU.refreshTop(); BU.renderPane(); } } }),
            h('button', { class: 'btn sm gray grow', text: '拆除', onclick: () => { B.removeBomb(b); Audio.play('sell'); BU.renderPane(); } })));
        } else {
          bc.appendChild(h('div', { class: 'small muted', text: SV.BOMB.fx }));
          bc.appendChild(h('button', { class: 'btn sm orange', style: { marginTop: '4px', width: '100%' }, text: '安装炸弹', onclick: () => { const r = B.addBomb(b); if (r.ok) { Audio.play('build'); BU.renderPane(); } else UI.toast(r.msg, 'err'); } }));
        }
        pane.appendChild(bc);
      }
      pane.appendChild(h('button', { class: 'btn red', style: { marginTop: '8px', width: '100%' }, text: '出售 🪙' + SV.fmt(B.sellValue(b)), onclick: () => BU.sellSel() }));
    }
  };

  /* 抗性 / 技能标签（原作技能图标 + 中文，缺图退回文字）。狼信息面板和 BOSS 介绍卡共用 */
  BU.wolfTags = function (def) {
    const rs = [];
    const RN = { fire: '火', frost: '冰', poison: '毒', light: '电/光', crit: '暴击', beat: '击退', vertigo: '眩晕' };
    const resistIcon = { fire: 'resistFire', frost: 'resistFrost', poison: 'resistPoison', light: 'resistLight', crit: 'resistCrit', beat: 'resistBeat', vertigo: 'resistVertigo' };
    for (const k in def.res) { if (!RN[k]) continue; const v = def.res[k], text = RN[k] + (v >= 1 ? '免疫' : v > 0 ? '抗' + Math.round(v * 100) + '%' : '怕' + Math.round(-v * 100) + '%'); rs.push(UI.skillTag ? UI.skillTag(resistIcon[k], text, v >= 1 ? 'imm' : v > 0 ? 'good' : 'bad') : h('span', { class: 'res-tag ' + (v >= 1 ? 'imm' : v > 0 ? 'good' : 'bad'), text })); }
    const SK = { fly: ['飞行', 'fly'], sprint: ['狂奔', 'sprint'], blink: ['闪烁', 'blink'], invisible: ['隐身', 'invisible'], shield: ['护盾', 'shield'], summon: ['召唤', 'summon'], revive: ['重生', 'revive'], reborn: ['转生', 'reborn'], divide: ['分身', 'divide'], heal: ['群疗', 'massTreatment'], burst: ['自爆', 'burst'] };
    for (const k in def.sk) if (SK[k]) rs.push(UI.skillTag ? UI.skillTag(SK[k][1], SK[k][0]) : h('span', { class: 'res-tag sk', text: SK[k][0] }));
    return rs;
  };

  /* BOSS 出场介绍卡：原作 BOSS 波开打前会弹出「BOSS」面板（大头像 + 名字 + 描述 + 技能图标）。
     描述和台词来自原作配置（assets/data/lore.js）。不暂停战斗，8 秒后自己收起，点 ✕ 也能关。 */
  BU.bossCard = function (wv) {
    const root = document.getElementById('scr-battle'); if (!root || !wv) return;
    if (BU.bossEl) { clearTimeout(BU.bossTimer); BU.bossEl.remove(); BU.bossEl = null; }
    const LORE = (global.SVA_LORE && global.SVA_LORE.wolves) || {}, ids = [], seen = {};
    for (const e of (wv.plan || [])) if (e.boss && !seen[e.id]) { seen[e.id] = 1; ids.push(e.id); }
    if (!ids.length) return;
    const cards = ids.slice(0, 3).map(id => {
      const def = SV.wolfDef(id), lo = LORE[def.n];
      return h('div', { class: 'bosscard-one' },
        h('div', { class: 'bc-ribbon', text: 'BOSS' }),
        h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '10px' } }, UI.wolfImg(id, 84),
          h('div', { class: 'grow' }, h('b', { style: { fontSize: '18px' }, text: def.n }),
            lo ? h('div', { class: 'small', style: { lineHeight: 1.5, marginTop: '2px' }, text: lo.d }) : null)),
        h('div', { class: 'bc-tags' }, BU.wolfTags(def)),
        lo && lo.q.length ? h('div', { class: 'small lore-o', text: '“' + lo.q[0] + '”' }) : null);
    });
    const close = () => { clearTimeout(BU.bossTimer); if (BU.bossEl) { BU.bossEl.remove(); BU.bossEl = null; } };
    const el = h('div', { class: 'bosscard' }, h('div', { class: 'bc-x', text: '✕', onclick: close }), ...cards);
    root.appendChild(el); BU.bossEl = el; BU.bossTimer = setTimeout(close, 8000);
  };

  BU.wolfPanel = function (pane, w) {
    const def = w.def;
    const rs = BU.wolfTags(def);
    pane.appendChild(h('div', { class: 'wolfpanel' },
      h('div', { class: 'row' }, UI.wolfImg(def.id, 50), h('div', null, h('b', { text: def.n + (w.boss ? ' 【BOSS】' : w.elite ? ' 【精英】' : '') }), h('div', { class: 'small', text: '生命 ' + SV.fmt(w.hp) + ' / ' + SV.fmt(w.maxhp) }), h('div', { class: 'small', text: '移速 ' + (BU.B.wolfSpeed(w) * 1).toFixed(2) + ' 格/秒' }))),
      h('div', { style: { marginTop: '4px' } }, rs), h('div', { class: 'small muted', text: '所有射程内的塔将优先攻击它（手操）。' }),
      h('button', { class: 'btn xs gray', style: { marginTop: '4px' }, text: '取消集火', onclick: () => { BU.focus = 0; BU.B.focusId = 0; BU.renderPane(); } })));
  };

  BU.towerPanel = function (pane, b) {
    const B = BU.B, st = B.towerStats(b), T = D.towers[b.type], max = B.towerMax(b.type);
    const gemTxt = b.gem ? SV.GEM_COLORS[b.gem.c].n + SV.GEM_TIERS[b.gem.t - 1] : '未镶嵌';
    const dps = SV.AI.dpsOf(B, b);
    pane.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' }, h('img', { src: SV.Art.towerIconURL(b.type, b.gem, b.lv), style: { width: '54px', height: '54px' } }),
        h('div', null, h('b', { style: { fontSize: '17px' }, text: TNAME[b.type] }), h('div', null, h('span', { class: 'tag ' + (b.lv >= max ? 'r' : b.lv >= max * 0.8 ? 'y' : 'o'), text: 'Lv.' + b.lv + ' / ' + max }), ' ', h('span', { class: 'tag p', text: gemTxt })))),
      h('div', { class: 'stat' }, h('span', { text: '单发伤害' }), h('b', { text: SV.fmt(st.dmg) })),
      h('div', { class: 'stat' }, h('span', { text: '攻击速度' }), h('b', { text: (1 / st.interval).toFixed(2) + ' 次/秒' })),
      h('div', { class: 'stat' }, h('span', { text: '射程' }), h('b', { text: st.range.toFixed(1) + ' 格' })),
      h('div', { class: 'stat' }, h('span', { text: '估算 DPS' }), h('b', { text: SV.fmt(dps) })),
      h('div', { class: 'stat' }, h('span', { text: '击杀 / 累计伤害' }), h('b', { text: b.kills + ' / ' + SV.fmt(b.dmgDealt || 0) })),
      b.aura && (b.aura.dmg > 1 || b.aura.spd > 1 || b.aura.rng > 1) ? h('div', { class: 'small', style: { color: '#3f8a26', fontWeight: 800 }, text: '雕像加成：' + (b.aura.dmg > 1 ? '攻击+' + Math.round((b.aura.dmg - 1) * 100) + '% ' : '') + (b.aura.spd > 1 ? '攻速+' + Math.round((b.aura.spd - 1) * 100) + '% ' : '') + (b.aura.rng > 1 ? '射程+' + Math.round((b.aura.rng - 1) * 100) + '%' : '') }) : null,
      h('div', { class: 'effects', text: st.idle ? '尚未镶嵌宝石，无法攻击！请选择下方宝石。' : (b.gem ? SV.gemText(b.type, b.gem.c, b.gem.t) : SV.gemText(b.type, null)) })));
    // 升级
    if (b.lv < max) {
      const nx = (n) => { const to = Math.min(max, b.lv + n); return B.towerCost(b.type, to) - B.towerCost(b.type, b.lv); };
      const row = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px', margin: '6px 0' } });
      [1, 5, 10, 25].forEach(n => { if (b.lv + n > max && n > 1) return; const cost = nx(n); row.appendChild(h('button', { class: 'btn sm ' + (B.silver >= cost ? 'green' : 'gray'), text: '+' + n + ' 🪙' + SV.fmt(cost), onclick: () => { const r = B.upgrade(b, b.lv + n); if (r.ok) { Audio.play('upgrade'); BU.tutorialAdvance('upgraded'); } else UI.toast(r.msg, 'err'); BU.renderPane(); BU.refreshTop(); } })); });
      row.appendChild(h('button', { class: 'btn sm orange', text: '升至最高', onclick: () => { const r = B.upgradeAffordable(b, max); if (r.ok) Audio.play('upgrade'); else UI.toast(r.msg || '银币不足', 'err'); BU.renderPane(); BU.refreshTop(); } }));
      pane.appendChild(row);
    } else pane.appendChild(h('div', { class: 'small bold center', style: { color: '#b52a1c', margin: '6px 0' }, text: '★ 已满级 ★' }));
    // 宝石
    pane.appendChild(h('div', { class: 'small bold', text: '更换宝石' }));
    BU.gemPicker(pane, b.gem, (gem) => { const r = B.setGem(b, gem); if (!r.ok) UI.toast(r.msg, 'err'); else { Audio.play('gem'); } BU.renderPane(); }, b.type);
    // 目标模式
    pane.appendChild(h('div', { class: 'small bold', style: { marginTop: '6px' }, text: '攻击目标优先级' }));
    pane.appendChild(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '3px' } }, ...MODES.map(([k, n]) => h('button', { class: 'btn xs ' + (b.mode === k ? 'green' : 'gray'), text: n, onclick: () => { b.mode = k; BU.renderPane(); } }))));
    const fee = Math.floor(b.paid * SV.MOVE_FEE);
    pane.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn sm blue grow', text: '搬迁 🪙' + SV.fmt(fee) + ' (M)', onclick: () => { BU.moving = b; BU.hint('点击目标空格搬迁（右键取消）'); } }),
      h('button', { class: 'btn sm red grow', text: '出售 🪙' + SV.fmt(B.sellValue(b)), onclick: () => BU.sellSel() })));
  };

  BU.paneWave = function (pane) {
    const B = BU.B, M = B.W;
    const wv = B.nextWave;
    pane.appendChild(h('div', { class: 'card' }, h('h4', { text: '地图：' + B.map.name }),
      h('div', { class: 'stat' }, h('span', { text: '出怪口 / 羊村入口' }), h('b', { text: B.map.spawns.length + ' / ' + B.map.goals.length })),
      h('div', { class: 'stat' }, h('span', { text: '进度目标' }), h('b', { text: B.infinite ? '无限' : B.scoreMax })),
      h('div', { class: 'stat' }, h('span', { text: '单波人口上限' }), h('b', { text: M.pop })),
      h('div', { class: 'stat' }, h('span', { text: '狼等级公式' }), h('b', { text: '√(' + M.hA + '+' + M.hB + '×进度)' })),
      h('div', { class: 'stat' }, h('span', { text: '参考收入' }), h('b', { text: B.infinite ? '无限' : SV.fmt(B.def.inc) })),
      h('div', { class: 'stat' }, h('span', { text: '随机 Boss 倒计时' }), h('b', { text: M.rb.length ? '约 ' + Math.max(0, B.rbCountdown) + ' 波' : '无' }))));
    pane.appendChild(h('div', { class: 'small bold', style: { margin: '8px 0 4px' }, text: '本图出没的狼（点击查看）' }));
    const ids = new Set(); M.prop.forEach(p => ids.add(p[1])); M.boss.forEach(b => ids.add(b)); M.rb.forEach(r => ids.add(r[1])); M.fb.forEach(f => ids.add(f));
    const ro = h('div', { class: 'roster' });
    ids.forEach(id => { const def = SV.wolfDef(id); const seen = G.save.seen[id]; ro.appendChild(h('div', { class: 'wi ' + (def.boss ? 'boss ' : '') + (seen ? '' : 'unk'), title: seen ? def.n : '？？？', onclick: () => { if (seen) UI.toast(def.n + '：' + (def.fly ? '飞行 ' : '') + '移速 ' + def.speed.toFixed(2) + ' 格/秒', ''); } }, UI.wolfImg(id, 40))); });
    pane.appendChild(ro);
    if (wv) {
      pane.appendChild(h('div', { class: 'small bold', style: { margin: '8px 0 4px' }, text: '下一波预览（' + (wv.kind === 'final' ? '最终BOSS' : wv.kind === 'boss' ? 'BOSS波' : wv.kind === 'random' ? '随机BOSS' : '普通波') + '）' }));
      pane.appendChild(h('div', { class: 'small' }, '难度：', h('span', { class: 'tag ' + (wv.diff >= 1.2 ? 'r' : wv.diff >= 1.1 ? 'o' : 'g'), text: SV.WAVE_LABEL[String(wv.diff)] + ' ×' + wv.diff }), '  狼等级 ≈ ', h('b', { text: B.waveLevel(B.progress + (B.waves[0] ? B.waves[0].budget : 0)).toFixed(1) })));
    }
  };

  BU.renderWaveBar = function () {
    const B = BU.B, E = BU.el, bar = UI.clear(E.wavebar);
    const wv = B.nextWave;
    if (!wv || B.over) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const label = wv.kind === 'final' ? '⚠ 最终BOSS' : wv.kind === 'boss' ? '⚠ BOSS' : wv.kind === 'random' ? '⚠ 随机BOSS' : '';
    E.cd = h('div', { class: 'small', style: { color: '#ffe9b5' } });
    bar.appendChild(h('div', { class: 'wtitle' }, h('div', { text: '下一波 #' + wv.no }), E.cd, h('div', { style: { color: wv.diff >= 1.2 ? '#ff8a7a' : wv.diff >= 1.1 ? '#ffc86a' : '#a5e66c' }, text: (SV.WAVE_LABEL[String(wv.diff)] || '') + ' ×' + wv.diff }), label ? h('div', { style: { color: '#ff6a5a' }, text: label }) : null));
    const keys = Object.keys(wv.comp).sort((a, b) => (b.includes('!') ? 1 : 0) - (a.includes('!') ? 1 : 0));
    for (const k of keys) {
      const id = k.replace(/[*!]/g, ''), boss = k.includes('!'), elite = k.includes('*');
      const def = SV.wolfDef(id);
      bar.appendChild(h('div', { class: 'wbi ' + (boss ? 'boss' : ''), title: def.n + (boss ? '（BOSS）' : elite ? '（精英）' : '') + (def.fly ? ' ✈' : '') }, UI.wolfImg(id, 38), h('b', { text: '×' + wv.comp[k] })));
    }
  };

  /* ---------- 刷新 ---------- */
  BU.refreshAffordable = function () {
    const B = BU.B; if (!BU.el.pane) return;
    BU.el.pane.querySelectorAll('.tcard').forEach(c => { const tp = c.dataset.tp; if (!tp) return; const cost = B.towerCost(tp, tp === BU.spec.type ? BU.spec.lv : Math.min(BU.spec.lv, B.towerMax(tp))); c.classList.toggle('dis', B.silver < cost); const pr = c.querySelector('.pr'); if (pr) pr.textContent = '🪙' + SV.fmt(cost); });
  };
  BU.refreshTop = function () {
    const B = BU.B, E = BU.el; if (!E || !E.silver) return;
    E.silver.textContent = SV.fmtFull(B.silver);
    E.lives.textContent = B.lives + '/' + B.maxLives;
    const nm = B.mode === 'nightmare';
    const pct = nm ? Math.min(100, B.nmWave / 110 * 100) : (B.infinite ? (B.progress % 2400) / 24 : Math.min(100, B.progress / B.scoreMax * 100));
    E.progBar.style.width = pct + '%';
    E.progTxt.textContent = nm ? '噩梦 第 ' + B.nmWave + ' / 110 波' : (B.infinite ? '进度 ' + Math.floor(B.progress) + '（无限）' : '进度 ' + Math.floor(B.progress) + ' / ' + B.scoreMax) + '  · 第 ' + B.waveNo + ' 波';
    E.diff.textContent = (SV.WAVE_LABEL[String(B.lastDiff)] || '') + ' ×' + B.lastDiff;
    E.diff.className = 'tag ' + (B.lastDiff >= 1.2 ? 'r' : B.lastDiff >= 1.1 ? 'o' : 'g');
    E.pauseBtn.textContent = B.paused ? '▶' : '⏸'; E.pauseBtn.classList.toggle('on', B.paused);
    E.autoWave.classList.toggle('on', B.autoWave); E.autoAI.classList.toggle('on', BU.auto);
    E.pathBtn.classList.toggle('on', BU.showPath); E.gridBtn.classList.toggle('on', BU.showGrid);
    E.sndBtn.textContent = G.save.settings.sfx > 0 ? '🔊' : '🔇';
    E.start.style.display = B.started ? 'none' : '';
    if (E.cd) {
      const primary = B.waves.filter(w => !w.lure).length;
      E.cd.textContent = !B.started ? '准备中…' : (primary ? '进行中' : (B.autoWave ? Math.max(0, Math.ceil((B.mode === 'nightmare' ? 3 : 4.5) - B.nextTimer)) + ' 秒后' : '等待召唤'));
    }
    E.call.style.display = B.started && !B.over ? '' : 'none';
    E.lure.style.display = B.started && !B.over && B.mode === 'normal' ? '' : 'none';
    E.lure.textContent = '🐺 引狼 (' + B.lures + ')';
    E.layout.style.display = !B.started && G.save.layouts[B.mapIdx] ? '' : 'none';
    E.hint.style.display = E.hint.textContent ? '' : 'none';
    BU.refreshAffordable();
  };
  BU.refreshAll = function () { BU.refreshTop(); BU.renderWaveBar(); BU.renderPane(); };

  /* ---------- 事件 ---------- */
  BU.onEvent = function (name, d) {
    const B = BU.B;
    switch (name) {
      case 'shoot': {
        const st = d.st; const t = st.type;
        if (st.kind === 'chain' || st.lightning) Audio.play('zap');
        else if (st.kind === 'flash') Audio.play('flash');
        else if (t === 'sentry') Audio.play('shootSentry'); else if (t === 'scatter') Audio.play('shootScatter'); else if (t === 'cannon') Audio.play('shootCannon'); else if (t === 'pulse') Audio.play('shootPulse'); else Audio.play('shootGem');
        break;
      }
      case 'spawn': if (SV.WolfTalk && BU.speed < 4) SV.WolfTalk.say(d, 'spawn', d.boss ? 1 : 0.22); break;
      case 'kill': Audio.play('die'); if (B.frame % 3 === 0) Audio.play('coin'); if (SV.WolfTalk && BU.speed < 4) SV.WolfTalk.say(d, 'die', 0.25); break;
      case 'leak': Audio.play('leak'); BU.flash = 0.35; BU.refreshTop(); if (SV.WolfTalk && BU.speed < 4) SV.WolfTalk.say(d, 'leak', 0.6); break;
      case 'bomb': Audio.play('boom'); if (d.kills) UI.toast('💥 炸弹炸倒了 ' + d.kills + ' 只狼！', 'good'); BU.renderPaneLight(); break;
      case 'waveStart':
        if (!d.lure && d.kind === 'normal') { Audio.play('wave'); UI.banner('第 ' + d.no + ' 波', (SV.WAVE_LABEL[String(d.diff)] || '') + ' · 狼等级 ' + d.level.toFixed(1)); }
        else UI.toast('🐺 引来一批狼！');
        BU.renderWaveBar(); BU.refreshTop(); BU.tutorialAdvance('wave'); break;
      case 'waveEnd': BU.refreshTop(); BU.renderWaveBar(); if (BU.tab === 'wave') BU.renderPane(); break;
      case 'bossWarning': Audio.play('boss'); Audio.playBgm('boss'); BU.bossCard(d); UI.banner(d.kind === 'final' ? '⚠ 最终BOSS来袭 ⚠' : d.kind === 'random' ? '⚠ 随机BOSS ⚠' : '⚠ BOSS来袭 ⚠', '第 ' + d.no + ' 波 · ' + d.bossNames.join(' · ') + ' · ' + (SV.WAVE_LABEL[String(d.diff)] || ''), 'boss'); break;
      case 'bossDie': Audio.play('boom'); Audio.playBgm('battle', B.mapIdx); break;
      case 'lap': UI.banner('🏁 完成第 ' + d.lap + ' 圈！', '获得调任文书奖励', ''); break;
      case 'loot': Audio.play('chest'); UI.toast('获得：' + G.lootText(d.loot), 'good'); break;
      case 'victory': case 'defeat': BU.onEnd(d); break;
    }
  };

  BU.onEnd = function (res) {
    if (BU.finished) return; BU.finished = true;
    if (BU.tutEl) { BU.tutEl.remove(); BU.tutEl = null; }
    if (BU.bossEl) { clearTimeout(BU.bossTimer); BU.bossEl.remove(); BU.bossEl = null; }
    const B = BU.B;
    setTimeout(() => { BU.showResult(B); }, res.win ? 1200 : 800);
    Audio.play(res.win ? (B.mode === 'normal' ? 'pass' : 'win') : 'lose'); Audio.stopBgm();
    UI.banner(res.win ? '🎉 守护成功！' : (B.retreated ? '已撤退' : '羊村沦陷……'), '', '');
  };

  /* ---------- 结算 ---------- */
  BU.showResult = function (B) {
    if (BU.ended) return; BU.ended = true;
    const wasLvl = G.save.level;
    const out = G.finishBattle(B);
    const res = out.res, nm = B.mode === 'nightmare';
    const line = (a, b) => h('div', { class: 'rline' }, h('span', { text: a }), h('b', { text: b }));
    const rows = [];
    if (nm) {
      rows.push(line('坚持波数', res.nmWave + ' / 110' + (out.newBest ? '  🏆 新纪录！' : '')));
      rows.push(line('击杀', res.kills)); rows.push(line('经验', '+' + out.exp)); rows.push(line('银币奖励', '+' + SV.fmt(out.silver || 0)));
    } else {
      rows.push(line('进度', Math.floor(res.progress) + ' / ' + (B.infinite ? '∞' : res.scoreMax)));
      rows.push(line('波数 / 击杀 / 漏狼', res.waves + ' / ' + res.kills + ' / ' + res.leaks));
      rows.push(line('面板造价（塔）', SV.fmt(res.spentTower)));
      rows.push(line('银币变化', (G.save.silver - out.silverBefore >= 0 ? '+' : '') + SV.fmt(G.save.silver - out.silverBefore) + (out.bonus ? '（含通关奖励 ' + SV.fmt(out.bonus) + '）' : '')));
      rows.push(line('经验', '+' + out.exp + (B.boost.exp > 1 ? '（留声机×' + B.boost.exp + '）' : '')));
      rows.push(line('用时', SV.fmtTime(res.time)));
    }
    const all = (out.lootList || []).concat(out.dropList || []);
    const merged = [];
    for (const l of all) { const f = merged.find(x => x.type === l.type && x.c === l.c && x.t === l.t && x.id === l.id && x.lv === l.lv); if (f) f.n = (f.n || 1) + (l.n || 1); else merged.push(Object.assign({}, l, { n: l.n || 1 })); }
    const win = res.win || (nm && res.nmWave >= 30);
    const title = nm ? '噩梦结算' : (res.win ? '守护成功' : (res.retreated ? '撤退' : '羊村沦陷'));
    const footer = h('div', { class: 'row', style: { justifyContent: 'center', gap: '12px' } },
      h('button', { class: 'btn gray', text: '🗺 返回大陆', onclick: () => { Audio.play('click'); m.close(); UI.Menu.toWorld(); } }),
      h('button', { class: 'btn blue', text: '🔁 再来一次', onclick: () => { Audio.play('click'); m.close(); UI.Menu.launch(B.mapIdx, B.mode); } }),
      res.win && !nm && G.mapState(B.mapIdx + 1).unlocked && D.maps[B.mapIdx + 1] && B.mapIdx + 1 !== 24 ? h('button', { class: 'btn green', text: '下一关 ➜', onclick: () => { Audio.play('click'); m.close(); UI.Menu.launch(B.mapIdx + 1, 'normal'); } }) : null);
    const m = UI.modal({
      title, width: 640, noClose: true, body: h('div', { class: 'result' },
        h('div', { class: 'big ' + (win ? '' : 'lose'), text: nm ? '第 ' + res.nmWave + ' 波' : (res.win ? '大获全胜！' : (res.retreated ? '战术撤退' : '再接再厉')) }),
        h('div', null, rows),
        out.levelUps ? h('div', { class: 'center bold', style: { color: '#b06a12', fontSize: '20px', margin: '8px 0' }, text: '🎊 村长升级！Lv.' + wasLvl + ' → Lv.' + G.save.level }) : null,
        merged.length ? h('div', { class: 'small bold center', text: '获得战利品' }) : null,
        h('div', { class: 'lootrow' }, merged.map(l => UI.lootChip(l)))), footer
    });
    if (res.win) UI.banner('🎉', '', '');
    Audio.playBgm('calm');
  };

  /* ---------- 主帧 ---------- */
  UI.hooks.battleFrame = function (dt, now) {
    const B = BU.B; if (!B) return;
    const R = UI.renderer;
    const step = 1 / 60;
    if (!B.over && !B.paused) {
      BU.acc += dt * BU.speed;
      let n = 0;
      while (BU.acc >= step && n < 10) { B.update(step); BU.acc -= step; n++; }
      if (n === 10) BU.acc = 0;
      Audio.scanFx(B.fx);
      if (SV.WolfTalk) SV.WolfTalk.tick(B, dt);
      if (BU.auto && B.started) { BU.autoT += dt; if (BU.autoT > 1.1) { BU.autoT = 0; if (SV.AI.step(B, { gems: true, newLv: 5 })) { BU.renderPaneLight(); } } }
    } else if (B.over) { B.update(0); }
    // HUD
    BU._hudT = (BU._hudT || 0) + dt;
    if (BU._hudT > 0.12) { BU._hudT = 0; BU.refreshTop(); if (BU.tab === 'info' && BU.sel && !BU._noRefresh && B.frame % 8 === 0) { /* 静态即可 */ } }
    // 画面
    let ghost = null;
    if (BU.place && !BU.moving) ghost = BU.place.kind === 'tower' ? { kind: 'tower', type: BU.place.type, lv: BU.spec.lv, gem: BU.spec.gem && B.gemAvail(BU.spec.gem) ? BU.spec.gem : null } : BU.place;
    const ui = { hover: BU.hover, ghost, ghostValid: ghost ? BU.ghostValid() && (!ghost.kind || true) : false, selected: BU.sel || BU.moving, hoverB: BU.hoverB, focus: BU.focus, showPath: BU.showPath, showGrid: BU.showGrid };
    R.draw(UI.t, ui);
    if (BU.flash > 0) { BU.flash -= dt; const c = R.ctx; c.setTransform(R.scale, 0, 0, R.scale, 0, 0); c.fillStyle = 'rgba(255,60,40,' + Math.min(0.28, BU.flash) + ')'; c.fillRect(0, 56, 980, 664); }
    if (B.paused && !B.over) { const c = R.ctx; c.setTransform(R.scale, 0, 0, R.scale, 0, 0); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 56, 980, 664); c.fillStyle = '#fff'; c.font = 'bold 60px "Microsoft YaHei"'; c.textAlign = 'center'; c.fillText('⏸ 暂停', 490, 400); }
    // 自动结束
    if (B.over && !BU.finished) BU.onEnd(B.getResult());
  };

  BU.frameHook = UI.hooks.battleFrame;

  /* ---------- 新手引导 ---------- */
  const TUT = [
    { at: 'start', text: '欢迎来到羊村，村长！\n狼从左边的洞穴出来，要冲进右边的羊村。\n先点击右侧的【哨塔】，再点击地图上的空地建造，拦下它们！', pos: { left: 600, top: 90 }, arrow: 'r', wait: 'built' },
    { at: 'built', text: '很好！塔可以直接建成高等级，等级越高越强、也越贵。\n再多造几座，然后点击中间的【开始迎战】！', pos: { left: 300, top: 400 }, arrow: 't', wait: 'wave' },
    { at: 'wave', text: '狼来了！它们沿最短路走。\n用右侧的【墙】或「智能绕路」让狼多绕路，就能多挨几炮！\n点击塔可以升级、镶嵌宝石。', pos: { left: 600, top: 300 }, arrow: 'r', wait: 'done' }
  ];
  BU.tutorial = function (i) {
    BU.tut = i; BU.showTut();
  };
  BU.showTut = function () {
    if (BU.tutEl) { BU.tutEl.remove(); BU.tutEl = null; }
    const s = G.save; if (s.tutorial.done) return;
    const step = TUT[BU.tut]; if (!step) return;
    const root = document.getElementById('scr-battle');
    const el = h('div', { class: 'tut panel arr-' + step.arrow, style: { left: step.pos.left + 'px', top: step.pos.top + 'px', whiteSpace: 'pre-line', fontWeight: 700, fontSize: '15px', lineHeight: 1.55, zIndex: 9 } },
      step.text, h('div', { class: 'row', style: { marginTop: '8px', justifyContent: 'flex-end' } }, h('button', { class: 'btn xs gray', text: '不再提示', onclick: () => { s.tutorial.done = true; G.persist(); el.remove(); BU.tutEl = null; } })));
    root.appendChild(el); BU.tutEl = el;
  };
  BU.tutorialAdvance = function (ev) {
    if (G.save.tutorial.done || BU.tut == null) return;
    const step = TUT[BU.tut]; if (!step) return;
    if (step.wait === ev) { BU.tut++; if (TUT[BU.tut]) BU.showTut(); else { if (BU.tutEl) BU.tutEl.remove(); BU.tutEl = null; G.save.tutorial.done = true; } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
