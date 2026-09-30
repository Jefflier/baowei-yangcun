/* ============================================================
 * 菜单界面：标题 / 大厅 / 世界地图
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D, G = SV.Game, UI = SV.UI, h = UI.h, Audio = SV.Audio;
  const Menu = UI.Menu = { selMap: null };

  /* ---------- 标题 ---------- */
  Menu.toTitle = function () {
    const root = UI.clear(document.getElementById('scr-title'));
    const has = !!SV.store.get('sv_nostalgia_save_v1', null);
    const s = G.save;
    const bt = (txt, cls, fn) => h('button', { class: 'btn ' + cls, text: txt, onclick: () => { Audio.init(); Audio.play('click'); fn(); } });
    root.appendChild(h('div', { class: 'logo' }, h('h1', { text: '保卫羊村' }), h('div', { class: 'sub', text: '怀 旧 服' })));
    root.appendChild(h('div', { class: 'menu' },
      bt(has ? '▶ 继续游戏' : '▶ 开始游戏', 'xl green', () => { if (!has) Menu.newPlayer(); else { Menu.toHub(); } }),
      h('div', { class: 'row' },
        has ? bt('🆕 新存档', 'lg red', () => UI.confirm('开始新存档会清空现有进度，确定吗？', () => { G.reset(); Menu.newPlayer(); }, { danger: true, yes: '清空并重开' })) : null,
        bt('📖 玩法说明', 'lg blue', () => UI.Panels.help()),
        bt('⚙ 设置', 'lg gray', () => UI.Panels.settings())),
      // 番外篇《牛来攻城》：源码目录里在 niulai/，单文件版里是同目录的 牛来攻城.html（单文件版的脚本都内联了，没有 src）
      bt('🐂 番外 · 牛来攻城', 'lg', () => { location.href = document.querySelector('script[src]') ? 'niulai/index.html' : '牛来攻城.html'; })));
  root.appendChild(h('div', { class: 'foot', html: '灵感与资料来源：<a href="https://www.tdsheepvillage.com/forum.php?mod=forumdisplay&fid=2" target="_blank" rel="noopener">保卫羊村怀旧论坛</a> · 羊村百科全书 · 玩家社区攻略  |  粉丝自制的单机复刻：代码原创，美术、音效与战斗音乐取自原作客户端，详见 docs/ART_PIPELINE.md' }));
    UI.show('title');
  };

  Menu.newPlayer = function () {
    const inp = h('input', { type: 'text', maxlength: 8, value: '村长', style: { fontSize: '22px', padding: '8px 14px', borderRadius: '12px', border: '3px solid #8a5a2c', width: '100%', textAlign: 'center', fontFamily: 'inherit', fontWeight: 800 } });
    const m = UI.modal({
      title: '欢迎来到羊村！', width: 460, noClose: true,
      body: h('div', { class: 'center', style: { lineHeight: 1.7 } }, h('div', { style: { fontSize: '17px', marginBottom: '10px' }, html: '狼群又来袭击羊村了！<br>给你的村长起个名字吧：' }), inp),
      footer: h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn green lg', text: '出发！', onclick: () => { G.save.name = (inp.value || '村长').slice(0, 8); G.persist(true); m.close(); Audio.play('click'); Menu.toHub(true); } }))
    });
    setTimeout(() => inp.select(), 100);
  };

  /* ---------- 大厅 ---------- */
  const HOT = [
    { id: 'mine', n: '矿山', x: 45, y: 232, w: 230, h: 150, fn: () => UI.Panels.mine() },
    { id: 'arena', n: '竞技场', x: 1010, y: 200, w: 260, h: 150, fn: () => UI.Arena.open(), lv: 8 },
    { id: 'shop', n: '商店', x: 355, y: 330, w: 150, h: 140, fn: () => UI.Panels.shop() },
    { id: 'work', n: '宝石工坊', x: 590, y: 240, w: 140, h: 190, fn: () => UI.Panels.gems() },
    { id: 'camp', n: '训练营', x: 110, y: 435, w: 200, h: 150, fn: () => UI.Panels.camp(), lv: 5 },
    { id: 'gate', n: '出征！', x: 815, y: 360, w: 290, h: 190, fn: () => Menu.toWorld(), big: true },
    { id: 'board', n: '布告栏', x: 470, y: 545, w: 100, h: 100, fn: () => UI.Panels.tasks() },
    { id: 'inn', n: '好友', x: 725, y: 550, w: 130, h: 100, fn: () => UI.Panels.friends() },
    { id: 'lib', n: '图鉴', x: 1125, y: 350, w: 130, h: 250, fn: () => UI.Panels.codex() }
  ];
  Menu.toHub = function (first) {
    const root = UI.clear(document.getElementById('scr-hub'));
    const s = G.save;
    root.appendChild(UI.resBar({
      back: () => Menu.toTitle(),
      extra: h('div', { class: 'row' },
        h('button', { class: 'btn sm orange', text: '🎁', title: '兑换码', onclick: () => { Audio.play('click'); UI.Panels.redeem(); } }),
        h('button', { class: 'btn sm blue', text: '❓', title: '玩法说明', onclick: () => { Audio.play('click'); UI.Panels.help(); } }),
        h('button', { class: 'btn sm green', text: '⛶', title: '全屏', onclick: () => { Audio.play('click'); UI.toggleFullscreen(); } }),
        h('button', { class: 'btn sm gray', text: '⚙', title: '设置', onclick: () => { Audio.play('click'); UI.Panels.settings(); } }))
    }));
    // 有原作羊村插画时用插画上的坐标（见 js/art_scene_pack.js），否则用程序化场景的坐标。
    // 但点击行为一律按 id 从 HOT 里取，两边数据不一致也不会点不动。
    const spots = (SV.Scene.hubHotspots || HOT).map(hs => {
      const base = HOT.find(o => o.id === hs.id) || {};
      const m = Object.assign({}, base, hs);
      if (typeof m.fn !== 'function') m.fn = base.fn;
      return m;
    });
    for (const hs of spots) {
      const locked = hs.lv && s.level < hs.lv;
      const badge = Menu.badge(hs.id);
      const plate = h('div', { class: 'plate', style: { position: 'absolute', left: '50%', bottom: hs.big ? '-6px' : '-14px', transform: 'translateX(-50%)', fontSize: (hs.fs || (hs.big ? 26 : 20)) + 'px', padding: hs.big ? '4px 26px' : '' } }, hs.n + (locked ? ' 🔒' : ''), badge ? h('span', { class: 'dot', text: badge }) : null);
      const el = h('div', { class: 'hotspot', style: { left: hs.x + 'px', top: hs.y + 'px', width: hs.w + 'px', height: hs.h + 'px' }, onmouseenter: () => Audio.play('hover'), onclick: () => { Audio.init(); if (locked) { UI.toast(hs.n + ' 需要村长等级 ' + hs.lv, 'err'); return; } Audio.play('click'); try { if (typeof hs.fn === 'function') hs.fn(); else UI.toast(hs.n + ' 暂时打不开（缺少处理函数）', 'err'); } catch (e) { console.error('[hub]', hs.id, e); UI.toast(hs.n + ' 打开失败：' + e.message, 'err'); } } }, h('div', { class: 'glow' }), plate);
      el.dataset.id = hs.id;
      root.appendChild(el);
    }
    root.appendChild(h('div', { style: { position: 'absolute', left: '14px', bottom: '10px', color: '#fff', fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,.8)' }, text: '点击建筑进入相应功能 · 从右侧大门「出征」前往羊羊大陆' }));
    UI.show('hub');
    if (G.loginPending()) setTimeout(() => UI.Panels.login(), 350);
    else if (first) UI.toast('点击右侧大门「出征」开始第一场战斗！', 'good');
    G.persist(true);
  };
  Menu.badge = function (id) {
    if (id === 'board') { const n = G.taskPending() + G.achPending(); return n || null; }
    if (id === 'mine') return G.save.mine && G.mineLeft() <= 0 ? '!' : null;
    if (id === 'inn') return G.whackLeft() > 0 ? '敲' : null;
    if (id === 'arena') { const s = G.save; return s.level >= 8 && s.arena.fights < 5 ? 5 - s.arena.fights : null; }
    return null;
  };

  /* ---------- 世界地图 ---------- */
  UI.worldCh = UI.worldCh || 1;
  const thumbs = {};
  Menu.thumb = function (idx, size) {
    const key = idx + '_' + size;
    if (thumbs[key]) return thumbs[key];
    const map = new SV.MapModel(idx);
    const AR = SV.CELL_AR || 1;      // 原作格子是 65×50 的长方形
    const cs = Math.max(6, Math.floor(size * 2 / (Math.max(map.cols, map.rows * AR) + 2)));
    const bg = SV.Art.buildBackground(map, cs, 1, 1, Math.round(cs * AR));
    const cv = SV.Art.mkCanvas(size * 2, size * 2), cx = cv.getContext('2d');
    const sc = Math.max(size * 2 / bg.W, size * 2 / bg.H);
    cx.drawImage(bg.canvas, (size * 2 - bg.W * sc) / 2, (size * 2 - bg.H * sc) / 2, bg.W * sc, bg.H * sc);
    thumbs[key] = cv;
    return cv;
  };
  const chapterMaps = ch => D.maps.map((m, i) => i).filter(i => D.maps[i].ch === ch);
  Menu.layout = function (ch) {
    const list = chapterMaps(ch);
    const per = list.length > 12 ? 5 : 4;
    const rows = Math.ceil(list.length / per);
    const x0 = 120, x1 = 830, y0 = 210, y1 = 620;
    const pos = {};
    list.forEach((idx, k) => {
      const r = Math.floor(k / per), c0 = k % per;
      const c = r % 2 ? per - 1 - c0 : c0;
      const xs = per > 1 ? (x1 - x0) / (per - 1) : 0, ys = rows > 1 ? (y1 - y0) / (rows - 1) : 0;
      pos[idx] = { x: x0 + c * xs + (r % 2 ? 0 : 0), y: y0 + r * ys + ((c % 2) ? 18 : -10) };
    });
    return { list, pos };
  };
  Menu.toWorld = function (ch) {
    const s = G.save;
    if (ch) UI.worldCh = ch;
    else if (Menu.selMap != null) UI.worldCh = D.maps[Menu.selMap].ch;
    const root = UI.clear(document.getElementById('scr-world'));
    root.appendChild(UI.resBar({ back: () => Menu.toHub(), extra: null }));
    const cur = UI.worldCh;
    const tabs = h('div', { class: 'chtabs' });
    [1, 2, 3, 4].forEach(c => {
      const first = chapterMaps(c)[0];
      const locked = c > 1 && !G.mapState(first).unlocked && !chapterMaps(c).some(i => G.mapState(i).unlocked);
      tabs.appendChild(h('div', { class: 'chtab ' + (c === cur ? 'on ' : '') + (locked ? 'locked' : ''), text: SV.CHAPTER_NAMES[c] + (locked ? ' 🔒' : ''), onclick: () => { Audio.play('click'); UI.worldCh = c; Menu.selMap = null; Menu.toWorld(c); } }));
    });
    root.appendChild(tabs);
    // 节点
    const { list, pos } = Menu.layout(cur);
    root.classList.toggle('compact', !!(global.SVAScenePack && SVAScenePack.compactNodes && SVAScenePack.compactNodes(cur)));
    Menu.pos = pos;
    for (const idx of list) {
      const st = G.mapState(idx), rec = G.mapRec(idx), cleared = G.mapCleared(idx);
      const m = D.maps[idx], p = pos[idx];
      const disc = h('div', { class: 'disc' });
      const cv = h('canvas', { width: 148, height: 148 }); cv.getContext('2d').drawImage(Menu.thumb(idx, 74), 0, 0, 148, 148);
      disc.appendChild(cv);
      const next = st.unlocked && !cleared;
      const node = h('div', { class: 'mapnode ' + (cleared ? 'cleared ' : '') + (st.unlocked ? '' : 'locked ') + (next ? 'cur ' : '') + (Menu.selMap === idx ? 'selected' : ''), style: { left: p.x + 'px', top: p.y + 'px' }, onmouseenter: () => Audio.play('hover'), onclick: () => { Audio.play('click'); Menu.selMap = idx; Menu.toWorld(cur); } },
        h('div', { class: 'no', text: m.no }), disc,
        st.unlocked ? (cleared ? h('div', { class: 'badge', text: rec && rec.nm >= 110 ? '👑' : '⭐' }) : null) : h('div', { class: 'badge', text: '🔒' }),
        h('div', { class: 'nm', text: m.n }));
      root.appendChild(node);
    }
    // 信息面板
    if (Menu.selMap == null || D.maps[Menu.selMap].ch !== cur) {
      // 默认选中：第一个未通关的可进图
      const cand = list.find(i => G.mapState(i).unlocked && !G.mapCleared(i)) || list[0];
      Menu.selMap = cand;
    }
    root.appendChild(Menu.infoPanel(Menu.selMap));
    UI.show('world');
    // show() 不清除内容
  };

  // 画路径（在 Scene 中读取）
  SV.Scene.drawWorldPath = function (ctx) {
    const pos = Menu.pos; if (!pos) return;
    const { list } = Menu.layout(UI.worldCh);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    list.forEach((idx, k) => { const p = pos[idx]; if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(80,50,20,.55)'; ctx.stroke();
    ctx.lineWidth = 18; ctx.strokeStyle = '#f0dc9c'; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(138,90,44,.8)'; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  };

  Menu.infoPanel = function (idx) {
    const m = D.maps[idx], st = G.mapState(idx), rec = G.mapRec(idx), s = G.save;
    const panel = h('div', { class: 'mapinfo panel' });
    panel.appendChild(h('h2', null, m.n, ' ', h('span', { class: 'tag ' + (G.mapCleared(idx) ? 'g' : st.unlocked ? 'o' : 'r'), text: G.mapCleared(idx) ? '已通关 ×' + rec.clears : st.unlocked ? '可挑战' : '未解锁' })));
    const pv = h('canvas', { class: 'pv', width: 300, height: 190 });
    const pc = pv.getContext('2d');
    const map = new SV.MapModel(idx);
    const AR = SV.CELL_AR || 1;
    const cs = Math.max(8, Math.floor(Math.min(600 / (map.cols + 2), 380 / ((map.rows + 2) * AR))));
    const bg = SV.Art.buildBackground(map, cs, 1, 1, Math.round(cs * AR));
    pv.width = 600; pv.height = 380;
    const sc = Math.min(600 / bg.W, 380 / bg.H);
    pc.fillStyle = '#7ab532'; pc.fillRect(0, 0, 600, 380); pc.drawImage(bg.canvas, (600 - bg.W * sc) / 2, (380 - bg.H * sc) / 2, bg.W * sc, bg.H * sc);
    panel.appendChild(pv);
    const kv = (a, b) => h('div', { class: 'stat' }, h('span', { text: a }), h('b', { text: b }));
    const req = G.mapReq(idx);
    panel.appendChild(h('div', { style: { marginTop: '6px' } },
      kv('章节', SV.CHAPTER_NAMES[m.ch].split(' · ')[0] + ' · 第 ' + m.no + ' 图'),
      kv('网格 / 出口 / 入口', map.cols + '×' + map.rows + ' / ' + map.spawns.length + ' / ' + map.goals.length),
      kv('通关目标', m.inf ? '无限进度' : '进度 ' + m.w.sc + '（最终BOSS ' + (m.w.fb.length ? m.w.fb.map(f => SV.wolfDef(f).n).filter((v, i, a) => a.indexOf(v) === i).join('、') : '无') + '）'),
      kv('参考收入', m.inf ? '无限' : SV.fmt(m.inc)),
      kv('所需等级', 'Lv.' + req.lv),
      rec ? kv('最高进度 / 噩梦', Math.floor(rec.best || 0) + ' / ' + (rec.nm || 0) + ' 波') : null,
      rec && rec.minCost ? kv('最低通关造价', SV.fmt(rec.minCost)) : null));
    // 怪物
    const ids = new Set(); m.w.prop.forEach(p => ids.add(p[1])); m.w.boss.forEach(b => ids.add(b)); m.w.rb.forEach(r => ids.add(r[1])); m.w.fb.forEach(f => ids.add(f));
    const ro = h('div', { class: 'roster', style: { marginTop: '4px' } });
    ids.forEach(id => { const def = SV.wolfDef(id); ro.appendChild(h('div', { class: 'wi ' + (def.boss ? 'boss ' : '') + (s.seen[id] ? '' : 'unk'), title: s.seen[id] ? def.n : '？？？（击败后解锁）' }, UI.wolfImg(id, 38))); });
    panel.appendChild(ro);
    if (!st.unlocked) {
      panel.appendChild(h('div', { class: 'center bold', style: { color: '#b52a1c', margin: '8px 0 4px' }, text: '🔒 ' + st.why }));
    } else {
      // 加成道具
      const it = s.items;
      const sel = Menu.boost = Menu.boost || { straw: 0, phono: 0 };
      const mk = (kind, names) => {
        const wrap = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '3px', marginTop: '4px' } }, h('span', { class: 'small bold', text: kind === 'straw' ? '🐑 稻草羊' : '📻 留声机' }));
        [0, 1, 2, 3].forEach(lv => {
          const cnt = lv ? it[kind][lv - 1] : 0;
          if (lv && cnt <= 0) return;
          wrap.appendChild(h('button', { class: 'btn xs ' + (sel[kind] === lv ? 'orange' : 'gray'), text: lv ? names[lv - 1].replace('级', '') + '×' + cnt : '不用', onclick: () => { Audio.play('click'); sel[kind] = lv; Menu.toWorld(UI.worldCh); } }));
        });
        return wrap;
      };
      if (it.straw.some(x => x > 0)) panel.appendChild(mk('straw', G.STRAW_N));
      if (it.phono.some(x => x > 0)) panel.appendChild(mk('phono', G.PHONO_N));
      const btns = h('div', { class: 'row', style: { marginTop: '10px', gap: '8px' } },
        h('button', { class: 'btn green lg grow', text: '⚔ 出征', onclick: () => { Audio.play('click'); Menu.launch(idx, 'normal', { straw: sel.straw, phono: sel.phono }); } }));
      if (G.mapCleared(idx)) btns.appendChild(h('button', { class: 'btn purple grow', title: '噩梦：坚持最多 110 波，每 10 波一个宝箱（消耗 1 根棒棒糖）', text: '🌙 噩梦 🍭' + s.lollipop, onclick: () => { Audio.play('click'); Menu.nightmare(idx); } }));
      panel.appendChild(btns);
      if (s.layouts[idx]) panel.appendChild(h('div', { class: 'small muted center', style: { marginTop: '4px' }, text: '📋 已保存上次布阵（进入后可一键载入）' }));
    }
    return panel;
  };

  Menu.nightmare = function (idx) {
    const s = G.save;
    const body = h('div', { style: { lineHeight: 1.7, fontSize: '15px' } },
      h('div', { html: '<b>噩梦模式规则</b>' }),
      h('div', { class: 'small' }, '· 在已通关的地图上，独立于正常模式，最多坚持 110 波；' + '\n· 狼种类不再局限于本图，随机混合出现，每 10 波出现 BOSS；'.replace(/\n/g, '')),
      h('div', { class: 'small' }, '· 每打过一轮 BOSS 获得「噩梦宝箱」，结束时开出宝石与积分；'),
      h('div', { class: 'small' }, '· 战斗中可随时造墙造塔改变狼的路线，但塔不能出售；'),
      h('div', { class: 'small' }, '· 自带 6 色精华宝石各一颗（战后收回），起始银币独立计算；'),
      h('div', { class: 'small' }, '· 推荐：毒波动 + 火/冰镶嵌，后期补散弹防空。'),
      h('div', { class: 'bold', style: { marginTop: '8px', color: '#b06a12' }, text: '入场消耗：🍭 棒棒糖 ×1（当前 ' + s.lollipop + '）' }));
    const m = UI.modal({
      title: '🌙 ' + D.maps[idx].n + ' · 噩梦', width: 520, body,
      footer: h('div', { class: 'row', style: { justifyContent: 'center', gap: '12px' } },
        h('button', { class: 'btn gray', text: '取消', onclick: () => { Audio.play('click'); m.close(); } }),
        h('button', { class: 'btn purple lg', text: '进入噩梦', onclick: () => { if (s.lollipop < 1) { UI.toast('棒棒糖不足', 'err'); return; } s.lollipop--; G.persist(true); Audio.play('click'); m.close(); Menu.launch(idx, 'nightmare', {}); } }))
    });
  };

  Menu.launch = function (idx, mode, opts) {
    const st = G.mapState(idx);
    if (!st.unlocked) { UI.toast(st.why, 'err'); return; }
    if (G.inBattle) G.abortBattle();
    UI.closeAllModals();
    UI.Battle.enter(idx, mode || 'normal', opts || {});
    Menu.selMap = idx;
  };

  UI.hooks['show:world'] = function () { /* 场景由 frame 绘制 */ };
  // 世界背景路径由 frame 之后附加绘制
  UI.hooks.frame = function () {
    if (UI.screen === 'world') { const R = UI.renderer; R.ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0); SV.Scene.drawWorldPath(R.ctx); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
