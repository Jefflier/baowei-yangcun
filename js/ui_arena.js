/* ============================================================
 * 训练营（狼队养成）& 竞技场（自动对战）
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D, G = SV.Game, UI = SV.UI, h = UI.h, Audio = SV.Audio, P = UI.Panels;
  const Arena = UI.Arena = { active: false };
  const click = () => Audio.play('click');

  /* ================= 训练营 ================= */
  P.camp = function () {
    const s = G.save; let sel = s.wolves.team[0] || 'al_B'; let m;
    const draw = () => {
      const left = h('div', { class: 'col', style: { width: '260px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' } });
      SV.CARDS.forEach(c => {
        const rec = G.wolfOwned(c.id), sh = s.wolves.shards[c.id] || 0, def = SV.wolfDef(c.id);
        const inTeam = s.wolves.team.includes(c.id);
        left.appendChild(h('div', { class: 'card row ' + (sel === c.id ? 'sel ' : '') + (rec ? '' : 'dis'), style: { cursor: 'pointer', padding: '4px 8px' }, onclick: () => { click(); sel = c.id; draw(); } },
          UI.wolfImg(c.id, 46), h('div', { class: 'grow' }, h('b', { text: def.n }), h('div', { class: 'small muted', text: rec ? 'Lv.' + rec.lv + (inTeam ? '  ★上场' : '') : '碎片 ' + sh + '/' + G.SHARDS_NEED })), c.fly ? h('span', { class: 'tag b', text: '空' }) : null));
      });
      const c = SV.CARD[sel], def = SV.wolfDef(sel), rec = G.wolfOwned(sel);
      const right = h('div', { style: { width: '560px' } });
      if (!rec) {
        const sh = s.wolves.shards[sel] || 0;
        right.append(h('div', { class: 'card center', style: { padding: '20px' } }, UI.wolfImg(sel, 96), h('h3', { text: def.n + '（未获得）' }), h('div', { class: 'small', text: c.desc }), h('div', { class: 'small muted', style: { margin: '6px 0' }, text: '获取途径：' + c.get }), h('div', { class: 'bar', style: { width: '260px', margin: '6px auto' } }, h('i', { style: { width: Math.min(100, sh / G.SHARDS_NEED * 100) + '%' } }), h('span', { text: '狼卡碎片 ' + sh + '/' + G.SHARDS_NEED }))));
      } else {
        const st = G.wolfStats(sel, rec);
        const inTeam = s.wolves.team.includes(sel);
        const need = G.wolfExpNeed(rec.lv);
        right.append(h('div', { class: 'card' },
          h('div', { class: 'row' }, UI.wolfImg(sel, 80), h('div', { class: 'grow' }, h('b', { style: { fontSize: '20px' }, text: def.n }), c.fly ? h('span', { class: 'tag b', style: { marginLeft: '6px' }, text: '飞行' }) : null, h('div', { class: 'small muted', text: c.desc }),
            h('div', { class: 'bar exp', style: { marginTop: '4px' } }, h('i', { style: { width: (rec.lv >= G.WOLF_MAX ? 100 : rec.exp / need * 100) + '%' } }), h('span', { text: 'Lv.' + rec.lv + (rec.lv >= G.WOLF_MAX ? ' MAX' : '  ' + rec.exp + '/' + need) }))),
            h('button', { class: 'btn ' + (inTeam ? 'red' : 'green'), text: inTeam ? '下场' : '上场', onclick: () => { click(); const t = s.wolves.team; if (inTeam) { if (t.length <= 1) { UI.toast('至少保留一只狼', 'err'); return; } t.splice(t.indexOf(sel), 1); } else { if (t.length >= 3) { UI.toast('最多 3 只狼上场', 'err'); return; } t.push(sel); } G.persist(true); draw(); } })),
          h('div', { class: 'row', style: { marginTop: '8px', gap: '20px' } }, h('div', { class: 'stat grow' }, h('span', { text: '生命' }), h('b', { text: SV.fmt(st.hp) })), h('div', { class: 'stat grow' }, h('span', { text: '战斗力' }), h('b', { text: SV.fmt(st.power) })), h('div', { class: 'stat grow' }, h('span', { text: '移速' }), h('b', { text: st.def.speed.toFixed(2) }))),
          h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm orange', text: '🥩 训练 🪙' + SV.fmt(400 + rec.lv * 120) + ' (+经验)', onclick: () => { const cost = 400 + rec.lv * 120; if (s.silver < cost) { UI.toast('银币不足', 'err'); return; } s.silver -= cost; const up = G.addWolfExp(sel, 30 + rec.lv * 6); Audio.play(up ? 'level' : 'click'); G.persist(true); UI.refreshRes(); draw(); } }))));
        // 技能槽
        right.append(h('div', { class: 'small bold', style: { margin: '10px 0 4px' }, text: '技能槽（自带技能：' + (Object.keys(c.nat).map(k => SV.WSKILLS[k].n).join('、') || '无') + '）' }));
        const slots = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3,1fr)' } });
        for (let i = 0; i < G.SLOTS; i++) {
          const cur = rec.sk[i];
          slots.appendChild(h('div', { class: 'card center' }, cur ? [h('div', { style: { fontSize: '28px' }, text: SV.WSKILLS[cur.id].ic }), h('b', { text: SV.SKILL_TIERS[cur.lv - 1] + SV.WSKILLS[cur.id].n }), h('div', { class: 'small muted', text: SV.WSKILLS[cur.id].d })] : [h('div', { style: { fontSize: '28px', opacity: 0.35 }, text: '＋' }), h('div', { class: 'small muted', text: '空槽位' })],
            h('button', { class: 'btn xs blue', style: { marginTop: '4px' }, text: cur ? '更换/升级' : '学习', onclick: () => { click(); pickSkill(i); } }), cur ? h('button', { class: 'btn xs gray', style: { marginLeft: '3px' }, text: '遗忘', onclick: () => { G.forgetSkill(sel, i); UI.refreshRes(); draw(); } }) : null));
        }
        right.append(slots);
      }
      m.setBody(h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '14px' } }, left, right));
      function pickSkill(slot) {
        const cur = rec.sk[slot];
        const box = h('div', { style: { width: '640px' } });
        Object.keys(SV.WSKILLS).forEach(k => {
          const S = SV.WSKILLS[k];
          const row = h('div', { class: 'card row', style: { marginBottom: '4px' } }, h('div', { style: { fontSize: '26px', width: '36px' }, text: S.ic }), h('div', { class: 'grow' }, h('b', { text: S.n }), h('div', { class: 'small muted', text: S.d })),
            ...[1, 2, 3, 4].map(lv => { const cost = G.skillCost(k, lv) - (cur && cur.id === k ? G.skillCost(k, cur.lv) : 0); const same = cur && cur.id === k && cur.lv >= lv; return h('button', { class: 'btn xs ' + (same ? 'gray' : s.silver >= cost ? 'green' : 'gray'), text: SV.SKILL_TIERS[lv - 1] + (same ? '' : ' 🪙' + SV.fmt(cost)), onclick: () => { if (same) return; if (G.learnSkill(sel, slot, k, lv)) { Audio.play('upgrade'); mm.close(); UI.refreshRes(); draw(); } else UI.toast('银币不足', 'err'); } }); }));
          box.appendChild(row);
        });
        const mm = UI.modal({ title: '选择技能 · 槽位 ' + (slot + 1), body: box, width: 700 });
      }
    };
    m = UI.modal({ title: '⛺ 狼队训练营 · 队伍战斗力 ' + SV.fmt(G.teamPower()), body: h('div'), width: 900, onClose: () => { G.persist(true); UI.refreshRes(); } });
    draw();
    m._refreshTitle = () => m.setTitle('⛺ 狼队训练营 · 队伍战斗力 ' + SV.fmt(G.teamPower()));
  };

  /* ================= 竞技场大厅 ================= */
  Arena.open = function () {
    const s = G.save; const maxFights = 5;
    let m;
    const draw = () => {
      const opps = SV.ArenaLogic.opponents();
      const team = s.wolves.team;
      const my = G.teamPower();
      const teamRow = h('div', { class: 'row card', style: { marginBottom: '10px', gap: '10px' } },
        h('div', { class: 'bold', text: '我的狼队' }),
        ...team.map(id => h('div', { class: 'row', style: { gap: '4px' } }, UI.wolfImg(id, 44), h('div', { class: 'small' }, h('b', { text: SV.wolfDef(id).n }), h('div', { class: 'muted', text: 'Lv.' + G.wolfOwned(id).lv })))),
        h('div', { class: 'grow' }), h('div', { class: 'small' }, '战斗力 ', h('b', { style: { color: '#b06a12', fontSize: '18px' }, text: SV.fmt(my) })),
        h('button', { class: 'btn sm blue', text: '⛺ 训练营', onclick: () => { click(); P.camp(); } }));
      const stat = h('div', { class: 'row', style: { marginBottom: '8px', gap: '20px' } }, h('span', { class: 'chip', text: '🏅 积分 ' + s.arena.score }), h('span', { class: 'chip', text: '胜 ' + s.arena.wins + ' / 负 ' + s.arena.losses }), h('span', { class: 'chip', text: '🔥 连胜 ' + s.arena.streak }), h('span', { class: 'chip', text: '今日挑战 ' + s.arena.fights + '/' + maxFights }), h('button', { class: 'btn xs gray', text: '🔄 刷新对手 🪙' + SV.fmt(1000 + s.level * 100), onclick: () => { const c = 1000 + s.level * 100; if (s.silver < c) { UI.toast('银币不足', 'err'); return; } s.silver -= c; SV.ArenaLogic.gen(); UI.refreshRes(); draw(); } }));
      const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' } });
      opps.forEach(o => {
        const out = SV.ArenaLogic.reward(o, true);
        const diff = o.power / Math.max(1, my);
        grid.appendChild(h('div', { class: 'card center ' + (o.done ? 'dis' : '') },
          h('div', { style: { position: 'relative', height: '90px', borderRadius: '8px', overflow: 'hidden', border: '3px solid #8a5a2c', marginBottom: '4px' } }, (function () { const cv = h('canvas', { width: 220, height: 180, style: { width: '100%', height: '100%' } }); cv.getContext('2d').drawImage(UI.Menu.thumb(o.map, 90), 0, 0, 220, 180); return cv; })(), h('div', { style: { position: 'absolute', left: 0, bottom: 0, right: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: '12px', fontWeight: 800 }, text: D.maps[o.map].n })),
          h('b', { text: o.name }), h('div', { class: 'small muted', text: 'Lv.' + o.level }),
          h('div', { class: 'small' }, '防线战斗力 ', h('b', { style: { color: o.target <= 0.3 ? '#c0392b' : o.target <= 0.55 ? '#b06a12' : '#3f8a26' }, text: SV.fmt(o.power) })),
          h('div', { class: 'small muted', text: '难度：' + ['轻松 😀', '较容易', '势均力敌 ⚔', '很难 💀'][o.tier != null ? o.tier : 2] + (o.maxed ? '（你太强了）' : '') }),
          h('div', { class: 'row', style: { justifyContent: 'center', gap: '2px', margin: '4px 0' } }, h('span', { class: 'chip', style: { fontSize: '11px' }, text: '🪙' + SV.fmt(out.silver) }), h('span', { class: 'chip', style: { fontSize: '11px' }, text: '经验 ' + out.exp })),
          h('button', { class: 'btn sm ' + (o.done ? 'gray' : 'red'), text: o.done ? '✔ 已击败' : '⚔ 挑战', onclick: () => { if (o.done) return; if (s.arena.fights >= maxFights) { UI.toast('今天的挑战次数用完了', 'err'); return; } click(); m.close(); Arena.fight(o); } })));
      });
      m.setBody(h('div', { style: { width: '900px' } }, teamRow, stat, grid, h('div', { class: 'small muted', style: { marginTop: '8px', lineHeight: 1.6 }, text: '竞技场规则：你的狼队依次冲击对手的防线，自动战斗；只要有一只狼成功「偷家」冲进羊村就算获胜。对手防线的强度取决于其战斗力。多带空中狼、隐身与护盾技能更容易偷家。' })));
    };
    m = UI.modal({ title: '⚔ 竞技场', body: h('div'), width: 960, onClose: () => { G.persist(true); UI.refreshRes(); } });
    draw();
  };

  /* ================= 战斗 ================= */
  Arena.fight = function (opp) {
    const s = G.save;
    const team = s.wolves.team.filter(id => G.wolfOwned(id));
    if (!team.length) { UI.toast('请先在训练营选择上场的狼', 'err'); return; }
    const B = SV.ArenaLogic.setup(opp, team);
    B.onEvent = (n, d) => {
      if (n === 'shoot') { const t = d.st.type; Audio.play(d.st.kind === 'chain' ? 'zap' : t === 'cannon' ? 'shootCannon' : t === 'pulse' ? 'shootPulse' : t === 'scatter' ? 'shootScatter' : 'shootSentry'); }
      if (n === 'kill') Audio.play('die');
      if (n === 'leak') { Audio.play('leak'); UI.banner('偷家成功！', '', ''); Arena.flash = 0.4; }
      if (n === 'victory' || n === 'defeat') Arena.onEnd(B, opp, team);
    };
    Arena.B = B; Arena.opp = opp; Arena.team = team; Arena.active = true; Arena.speed = 2; Arena.acc = 0; Arena.ended = false;
    const R = UI.renderer; R.setView({ x: 0, y: 56, w: 980, h: 664 }); R.setBattle(B);
    const root = UI.clear(document.getElementById('scr-battle'));
    const wolfBars = team.map((id, i) => ({ id, el: h('div', { class: 'card', style: { padding: '4px 8px', marginBottom: '6px' } }, h('div', { class: 'row' }, UI.wolfImg(id, 40), h('div', { class: 'grow' }, h('b', { text: SV.wolfDef(id).n + ' Lv.' + G.wolfOwned(id).lv }), h('div', { class: 'bar red' }, h('i', { style: { width: '100%' } }))))) }));
    Arena.bars = wolfBars;
    const spdBtns = [1, 2, 4].map(v => h('button', { class: 'btn sm spd ' + (v === Arena.speed ? 'on' : ''), text: v + 'x', onclick: () => { click(); Arena.speed = v; spdBtns.forEach((b, j) => b.classList.toggle('on', [1, 2, 4][j] === v)); } }));
    root.append(
      h('div', { class: 'btop' }, h('button', { class: 'btn sm red', text: '⬅ 放弃', onclick: () => { click(); Arena.quit(); } }), h('div', { class: 'bmap' }, '竞技场 · 挑战 ' + opp.name), h('div', { class: 'spacer' }), ...spdBtns, h('button', { class: 'btn sm orange', text: '⏭ 跳过', onclick: () => { click(); Arena.skip(); } })),
      h('div', { class: 'bside' }, h('div', { style: { padding: '10px' } }, h('h4', { style: { margin: '0 0 6px' }, text: '我的狼队' }), ...wolfBars.map(b => b.el), h('div', { class: 'hr' }), h('div', { class: 'small', style: { lineHeight: 1.7 } }, '对手防线战斗力：', h('b', { text: SV.fmt(opp.power) }), h('br'), '地图：' + D.maps[opp.map].n, h('br'), '防线塔数：' + B.buildings.filter(b => b.kind === 'tower').length, h('br'), h('span', { class: 'muted', text: '只要有一只狼冲进羊村就算获胜！' })))));
    UI.show('battle');
    Audio.playBgm('arena');
    UI.hooks.battleFrame = Arena.frame;
  };

  Arena.frame = function (dt) {
    const B = Arena.B; if (!B) return;
    const R = UI.renderer;
    if (!B.over) {
      Arena.acc += dt * Arena.speed; let n = 0;
      while (Arena.acc >= 1 / 60 && n < 12) { B.update(1 / 60); Arena.acc -= 1 / 60; n++; }
      if (n === 12) Arena.acc = 0;
      Audio.scanFx(B.fx);
    }
    // 血条
    Arena.bars.forEach((b, i) => {
      const w = B.wolves.find(x => x.arenaSlot === i), bar = b.el.querySelector('.bar > i');
      if (w) { bar.style.width = Math.max(0, w.hp / w.maxhp * 100) + '%'; b.el.style.opacity = 1; }
      else if (B.arenaSpawned > i) { bar.style.width = '0%'; b.el.style.opacity = 0.5; }
    });
    R.draw(UI.t, { showPath: false });
    if (Arena.flash > 0) { Arena.flash -= dt; const c = R.ctx; c.setTransform(R.scale, 0, 0, R.scale, 0, 0); c.fillStyle = 'rgba(255,220,80,' + Math.min(0.25, Arena.flash) + ')'; c.fillRect(0, 56, 980, 664); }
  };

  Arena.skip = function () {
    const B = Arena.B; if (!B || B.over) return;
    let n = 0; while (!B.over && n++ < 30000) B.update(1 / 60);
  };
  Arena.quit = function () {
    const B = Arena.B;
    Arena.active = false; Arena.B = null;
    UI.hooks.battleFrame = UI.Battle.frameHook;
    UI.Menu.toHub();
  };

  Arena.onEnd = function (B, opp, team) {
    if (Arena.ended) return; Arena.ended = true;
    const s = G.save, win = B.stats.leaks > 0;
    const out = SV.ArenaLogic.reward(opp, win, B);
    setTimeout(() => {
      Audio.play(win ? 'win' : 'lose'); Audio.stopBgm();
      // 结算
      s.arena.fights++;
      if (win) { s.arena.wins++; s.arena.streak++; s.arena.score += 25 + Math.min(20, s.arena.streak * 2); opp.done = true; s.stats.arenaWins++; }
      else { s.arena.losses++; s.arena.streak = 0; s.arena.score = Math.max(0, s.arena.score - 10); }
      G.addSilver(out.silver); const up = G.addExp(out.exp); G.addPoints(out.points);
      let wolfUp = 0; team.forEach(id => wolfUp += G.addWolfExp(id, out.wolfExp));
      G.taskProgress('arena', 1);
      const cardReward = out.cards[out.pick]; G.giveLoot(cardReward);
      G.checkAch(); G.persist(true);
      const revealed = [false, false, false];
      const cardsEl = h('div', { class: 'row', style: { justifyContent: 'center', gap: '12px', margin: '10px 0' } });
      const drawCards = () => {
        UI.clear(cardsEl);
        [0, 1, 2].forEach(i => {
          const isReal = i === out.pick;
          cardsEl.appendChild(h('div', { class: 'card center', style: { width: '150px', height: '110px', cursor: revealed.some(x => x) ? 'default' : 'pointer', background: revealed[i] ? '#fff8d8' : 'linear-gradient(#ffb84a,#ff8a2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px', transition: 'transform .3s', transform: revealed[i] ? 'scale(1.05)' : '' }, onclick: () => {
            if (revealed.some(x => x)) return; Audio.play('chest'); revealed[i] = true;
            // 真实奖励放在被点击的卡上；其余显示随机“可惜”卡
            if (i !== out.pick) { const t = out.cards[i]; out.cards[i] = cardReward; out.cards[out.pick] = t; }
            revealed.forEach((_, j) => revealed[j] = true); drawCards();
          } }, revealed[i] ? [UI.lootChip(out.cards[i]), h('div', { class: 'small muted', text: i === out.pick || true ? (out.cards[i] === cardReward ? '✔ 已获得' : '（没抽到）') : '' })] : [h('div', { style: { fontSize: '38px' }, text: '🎁' }), h('b', { style: { color: '#fff', textShadow: '0 2px 0 #7a3f0a' }, text: '翻牌' })]));
        });
      };
      drawCards();
      const mm = UI.modal({
        title: win ? '🏆 偷家成功！' : '💀 挑战失败', width: 640, noClose: true, body: h('div', { class: 'result' },
          h('div', { class: 'big ' + (win ? '' : 'lose'), text: win ? '大获全胜！' : '功亏一篑' }),
          h('div', { class: 'rline' }, h('span', { text: '银币' }), h('b', { text: '+' + SV.fmt(out.silver) })), h('div', { class: 'rline' }, h('span', { text: '村长经验' }), h('b', { text: '+' + out.exp + (up ? '（升级！）' : '') })),
          out.points ? h('div', { class: 'rline' }, h('span', { text: '积分' }), h('b', { text: '+' + out.points })) : null,
          h('div', { class: 'rline' }, h('span', { text: '狼队经验（每只）' }), h('b', { text: '+' + out.wolfExp + (wolfUp ? '（有狼升级！）' : '') })),
          h('div', { class: 'small bold center', style: { marginTop: '8px' }, text: '点击翻牌领取奖励（奖励在结算时已决定，任选一张即可）' }), cardsEl),
        footer: h('div', { class: 'row', style: { justifyContent: 'center', gap: '12px' } }, h('button', { class: 'btn green', text: '返回', onclick: () => { click(); mm.close(); Arena.active = false; Arena.B = null; UI.hooks.battleFrame = UI.Battle.frameHook; UI.Menu.toHub(); setTimeout(() => Arena.open(), 60); } }))
      });
    }, win ? 900 : 500);
  };
})(typeof window !== 'undefined' ? window : globalThis);
