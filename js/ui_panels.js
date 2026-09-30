/* ============================================================
 * 功能面板：说明 / 设置 / 签到 / 宝石工坊 / 商店 / 矿山 / 任务成就 / 好友 / 图鉴
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV, D = SV.D, G = SV.Game, UI = SV.UI, h = UI.h, Audio = SV.Audio;
  const P = UI.Panels = {};
  const refreshHub = () => { const cur = UI.screen; if (cur === 'hub') { UI.refreshRes(); UI.Menu.toHubQuick && UI.Menu.toHubQuick(); } };
  const click = () => Audio.play('click');
  const tabsView = function (defs, initial, render) {
    // defs: [[key,label,dot]]
    const box = h('div');
    const bar = h('div', { class: 'tabs' });
    const body = h('div');
    let cur = initial || defs[0][0];
    const draw = () => {
      UI.clear(bar);
      defs.forEach(([k, n, dot]) => { const d = typeof dot === 'function' ? dot() : dot; bar.appendChild(h('div', { class: 't ' + (k === cur ? 'on' : ''), onclick: () => { click(); cur = k; draw(); } }, n, d ? h('span', { class: 'dot', text: d }) : null)); });
      UI.clear(body); UI._append(body, render(cur, draw));
    };
    box.append(bar, body); draw();
    box.redraw = draw;
    return box;
  };

  /* ================= 玩法说明 ================= */
  P.help = function () {
    const sec = (t, ...c) => h('div', { class: 'card', style: { marginBottom: '8px' } }, h('h4', { text: t }), ...c);
    const p = t => h('div', { class: 'small', style: { lineHeight: 1.7 }, html: t });
    const body = h('div', { style: { width: '880px' } },
      sec('🐑 游戏目标', p('狼群从<b>出怪口（洞穴）</b>出发，沿最短路线冲向<b>羊村</b>。你要用<b>墙</b>把路线拉长、用<b>塔</b>消灭它们。每消灭一波，<b>进度</b>增加；进度满了并击败<b>最终 BOSS</b> 就通关。狼进村会扣「羊村生命」并<b>倒扣进度</b>，生命归零则失败。')),
      sec('🧱 造墙迷宫', p('狼总会走最短路，但<b>不能把路完全堵死</b>。用墙把直路改成蛇形、阶梯形，狼就要绕更多路，塔能多打好几下。<b>阶梯状</b>斜上斜下的绕路比直来直往更能利用塔的圆形射程；狼能<b>多次</b>进入射程的位置就是好塔位。')),
      sec('🏹 五种塔', p('<b>哨塔</b>：便宜、单体、性价比之王。<b>散弹塔</b>：同时打 3 个目标，<b>对空双倍</b>，黑宝石散弹是对空单体之王。<b>炮塔</b>：仅对地，射程极远，范围溅射，毒炮/黑炮是陆狼主力。<b>波动塔</b>：贯穿直线上最多 10 个目标，可打隐身，很贵。<b>镶嵌塔</b>：无宝石不攻击，镶嵌后：红=高伤+燃烧、绿=剧毒、黄=光爆（打隐身/飞行）、紫=连锁闪电、蓝=强力减速、黑=诅咒+沉默。<br>塔可以<b>直接建成高等级</b>（造价随等级增长）；等级达到上限 80% 时等级牌变金色。')),
      sec('💎 六色宝石 × 五种品质', p('碎片 → 晶体 → 宝石 → 精华 → 强化。3 个同色同阶可在<b>宝石工坊</b>合成上一阶。<br><span style="color:#d33">红</span>：怕火的狼克星；燃烧与冰冻互相抵消。 <span style="color:#3a3">绿</span>：中毒，取最高值不叠加。 <span style="color:#c9a000">黄</span>：暴击/眩晕，黄镶嵌=光塔。 <span style="color:#84c">紫</span>：闪电、射程 +，免疫电的狼（忍者、武生）无视它。 <span style="color:#38d">蓝</span>：减速，冰镶嵌 30 级左右性价比最高。 <span style="color:#444">黑</span>：连击/诅咒/对空/超远炮。<br>战斗结束时宝石会自动回收。')),
      sec('🪙 银币与造价', p('银币是全局资源：建塔花银币，杀狼得银币。通关地图会奖励一笔银币。<b>辅助建筑（墙、雕像、机关）不计入面板造价</b>。「面板造价」越低，说明你的布阵越精妙。可以出售塔（退款 80%）、搬迁塔（手续费 2%）。<br>提示：前线波动塔和镶嵌塔很贵，前期用哨塔+炮塔更划算；<b>卖光波动塔换输出阵</b>是常见套路。')),
      sec('🎯 手操与技巧', p('· 点击一只狼可让所有射程内的塔<b>集火</b>它（对付分身、闪烁、隐身的狼很有用）。<br>· 每个塔可设置目标优先级：最前/最近/最强/最弱/空中。<br>· 「引狼」可额外引来一批狼刷银币和经验（每图 20 次）。<br>· 护士狼的<b>群疗</b>：用黑散弹集火秒掉一只，否则互相治疗永远打不死。<br>· 弹簧狼会<b>闪烁</b>：用黑镶嵌在闪烁前后 1 秒内命中来<b>沉默</b>它。<br>· 忍者狼免疫闪电，需要炮塔；神偷狼飞行+隐身，需要黄镶嵌光塔。')),
      sec('💣 炸弹墙', p('炸弹是消耗品（商店、兑换码、任务可得）。战斗中按 <span class="kbd">B</span> 或在建造栏选「炸弹」，再点一堵<b>墙</b>装上；也可以点墙后在右侧面板安装。地面狼靠近炸弹墙会<b>自动引爆</b>：范围伤害（按狼最大生命的百分比，BOSS 较低）+ 短暂眩晕，无视抗性。每局最多同时装 6 枚，<b>没炸的会返还</b>，只有引爆的才消耗。适合放在拐角、聚怪点，专门收拾残血和高抗性的狼。竞技场里不能用炸弹。')),
      sec('🎁 兑换码', p('大厅右上角的 🎁（或设置里）输入兑换码，可领银币、炸弹、宝石等。同一个码每个存档限领一次。')),
      sec('🌙 噩梦模式', p('通关的地图可以挑战噩梦（消耗 1 根棒棒糖）：最多 110 波，狼随机混合，每 10 波一个 BOSS，可随时造墙造塔改道遛狼，但<b>不能出售</b>。养<b>毒波动</b>做主力，再加火镶嵌，60 波后补散弹防空。每过一轮 BOSS 得噩梦宝箱，结束时开出宝石。')),
      sec('⌨ 快捷键', p('<span class="kbd">1-5</span> 选塔 <span class="kbd">Q</span> 墙 <span class="kbd">B</span> 炸弹 <span class="kbd">空格</span> 暂停 <span class="kbd">F</span> 切换倍速 <span class="kbd">P</span> 路线 <span class="kbd">G</span> 网格 <span class="kbd">U</span> 升级选中塔 <span class="kbd">S/Del</span> 出售 <span class="kbd">M</span> 搬迁 <span class="kbd">Esc/右键</span> 取消 <span class="kbd">Ctrl+点塔</span> 快速升级 <span class="kbd">Shift+建造</span> 连续建造')));
    UI.modal({ title: '📖 玩法说明', body, width: 940, height: 680 });
  };

  /* ================= 设置 ================= */
  P.settings = function () {
    const s = G.save.settings;
    const slider = (label, key, cb) => h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'bold', style: { width: '80px' }, text: label }), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], class: 'grow', oninput: e => { s[key] = +e.target.value; Audio.setVol(s.sfx, s.bgm); if (cb) cb(); }, onchange: () => { Audio.play('click'); G.persist(true); } }));
    const tog = (label, key) => h('label', { class: 'row', style: { margin: '6px 0', cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: s[key] ? true : null, onchange: e => { s[key] = e.target.checked; G.persist(true); } }), h('span', { class: 'bold', text: label }));
    const code = h('textarea', { class: 'code', placeholder: '导出的存档代码 / 在此粘贴以导入' });
    const nameInp = h('input', { type: 'text', maxlength: 8, value: G.save.name, style: { padding: '4px 10px', borderRadius: '10px', border: '3px solid #b57d3f', fontFamily: 'inherit', fontWeight: 800, width: '140px' } });
    const body = h('div', { style: { width: '520px' } },
      h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'bold', style: { width: '80px' }, text: '村长名' }), nameInp, h('button', { class: 'btn xs green', text: '保存', onclick: () => { G.save.name = (nameInp.value || '村长').slice(0, 8); G.persist(true); UI.toast('已改名：' + G.save.name, 'good'); } })),
      slider('音效', 'sfx'), slider('音乐', 'bgm'),
      h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'bold', style: { width: '80px' }, text: '难度' }), ...G.DIFF.map((d, i) => h('button', { class: 'btn sm ' + ((s.diff != null ? s.diff : 1) === i ? 'orange' : 'gray'), title: d.d, text: d.n, onclick: e => { s.diff = i; G.persist(true); e.target.parentElement.querySelectorAll('.btn').forEach((b, j) => { b.className = 'btn sm ' + (j === i ? 'orange' : 'gray'); }); } })), h('span', { class: 'small muted', text: '（下一局生效）' })),
      tog('显示伤害数字', 'dmg'), tog('显示狼的台词气泡', 'talk'), tog('默认显示网格', 'grid'), tog('默认显示走狼路线', 'path'), tog('自动开怪（下一波自动到来）', 'autoWave'), tog('显示教学提示', 'tips'),
      h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'bold', style: { width: '80px' }, text: '兑换码' }), h('button', { class: 'btn sm orange', text: '🎁 输入兑换码', onclick: () => { click(); P.redeem(); } })),
      h('div', { class: 'hr' }),
      h('div', { class: 'bold', text: '存档管理' }), code,
      h('div', { class: 'row', style: { marginTop: '6px' } },
        h('button', { class: 'btn sm blue', text: '导出存档', onclick: () => { click(); code.value = G.exportCode(); code.select(); UI.toast('已生成存档代码，请复制保存'); } }),
        h('button', { class: 'btn sm green', text: '导入存档', onclick: () => { click(); if (G.importCode(code.value)) { UI.toast('导入成功！', 'good'); UI.closeAllModals(); UI.Menu.toTitle(); } else UI.toast('存档代码无效', 'err'); } }),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn sm red', text: '清空存档', onclick: () => UI.confirm('确定清空所有进度重新开始吗？此操作不可恢复！', () => { G.reset(); UI.closeAllModals(); UI.Menu.toTitle(); }, { danger: true, yes: '清空' }) })),
      h('div', { class: 'hr' }),
      h('div', { class: 'small muted', style: { lineHeight: 1.6 }, html: '数据与机制参考：<a href="https://www.tdsheepvillage.com/" target="_blank" rel="noopener">保卫羊村怀旧论坛</a>、羊村百科全书 V1.82、玩家社区攻略。<br>代码为原创；塔、羊、狼、地图等美术，以及音效和战斗音乐取自原作客户端（缺失时用 Canvas / Web Audio 程序化兜底）。本作为非商业的粉丝复刻，与原作运营方无关。' }));
    UI.modal({ title: '⚙ 设置', body, onClose: () => G.persist(true) });
  };

  /* ================= 兑换码 ================= */
  P.redeem = function () {
    const inp = h('input', { type: 'text', placeholder: '输入兑换码，例如 HUAIJIU', maxlength: 120, style: { width: '100%', padding: '8px 12px', borderRadius: '10px', border: '3px solid #b57d3f', fontFamily: 'inherit', fontWeight: 800, fontSize: '16px', textTransform: 'uppercase' } });
    const out = h('div', { style: { marginTop: '10px', minHeight: '60px' } });
    const doit = () => {
      const r = G.redeem(inp.value);
      UI.clear(out);
      if (!r.ok) { Audio.play('error'); out.appendChild(h('div', { class: 'center bold', style: { color: '#c0392b' }, text: '✖ ' + r.err })); return; }
      Audio.play('chest'); inp.value = '';
      out.appendChild(h('div', { class: 'center bold', style: { color: '#3f8a26', marginBottom: '6px' }, text: '✔ 兑换成功：' + r.name }));
      out.appendChild(h('div', { class: 'lootrow' }, r.loots.map(UI.lootChip)));
      UI.refreshRes();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doit(); });
    const n = Object.keys(G.save.redeemed || {}).length;
    UI.modal({
      title: '🎁 兑换码', width: 480,
      body: h('div', null, inp, out, h('div', { class: 'small muted', style: { marginTop: '10px', lineHeight: 1.6 }, text: '口令不区分大小写，也可以输入 SV- 开头的礼包码。每个兑换码在同一个存档里只能兑换一次（已兑换 ' + n + ' 个）。' })),
      footer: h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn green lg', text: '兑换', onclick: doit }))
    });
    setTimeout(() => inp.focus(), 60);
  };

  /* ================= 每日签到 ================= */
  P.login = function () {
    if (!G.loginPending()) return;
    // 大厅原画异步到位后会重绘大厅；不要因此叠出第二张同一天的签到弹窗。
    // 用 UI 的弹窗栈判断而非定时器，关闭后仍可正常再次打开。
    if (UI.modals && UI.modals.some(m => m.head && m.head.querySelector('h3') && m.head.querySelector('h3').textContent === '📅 每日签到')) return;
    const s = G.save;
    const nextIdx = (s.daily2.streak) % 7;
    const cells = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(7, 1fr)', width: '780px' } });
    for (let i = 0; i < 7; i++) {
      const rw = G.LOGIN_REWARDS[i](s.level);
      cells.appendChild(h('div', { class: 'card center ' + (i === nextIdx ? 'sel' : ''), style: { padding: '6px 4px' } }, h('div', { class: 'bold', text: '第 ' + (i + 1) + ' 天' }), h('div', { style: { minHeight: '90px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center' } }, rw.map(r => h('div', { class: 'small', style: { fontWeight: 800 } }, UI.lootChip(r))))));
    }
    const m = UI.modal({ title: '📅 每日签到', body: h('div', null, h('div', { class: 'center', style: { marginBottom: '8px', fontSize: '15px' }, text: '连续签到 ' + s.daily2.streak + ' 天，今天是第 ' + (nextIdx + 1) + ' 天！' }), cells), width: 830, footer: h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn green lg', text: '领取奖励', onclick: () => { const r = G.claimLogin(); Audio.play('chest'); m.close(); if (r) UI.alert('签到成功', h('div', { class: 'lootrow' }, r.rw.map(UI.lootChip))); UI.refreshRes(); } })) });
  };

  /* ================= 宝石工坊 ================= */
  P.gems = function () {
    const s = G.save;
    let m;
    const render = (tab, redraw) => {
      if (tab === 'bag') {
        const grid = h('div', { class: 'gemgrid' }, h('div'), ...SV.GEM_TIERS.map(t => h('b', { class: 'center', text: t })));
        for (let c = 0; c < 6; c++) {
          grid.appendChild(h('div', { class: 'row bold' }, UI.gemImg(c, 3, 30), SV.GEM_COLORS[c].n));
          for (let t = 1; t <= 5; t++) {
            const n = s.gems[c][t - 1];
            const can = n >= 3 && t < 5;
            grid.appendChild(h('div', { class: 'gemcell ' + (n === 0 ? 'zero ' : '') + (can ? 'can' : ''), title: can ? '点击合成（3 → 1）；Shift+点击 全部合成' : '', onclick: (e) => { if (!can) { if (t < 5) UI.toast('需要 3 个才能合成', 'err'); return; } const k = e.shiftKey ? G.fuseAll(c, t) : (G.fuse(c, t) ? 1 : 0); if (k) { Audio.play('gem'); UI.toast('合成成功 ×' + k + '：' + SV.GEM_COLORS[c].n + SV.GEM_TIERS[t], 'good'); G.persist(true); redraw(); UI.refreshRes(); } } },
              UI.gemImg(c, t, 40), h('b', { text: n }), can ? h('span', { class: 'tag g', text: '可合成' }) : null));
          }
        }
        return h('div', { style: { width: '760px' } }, h('div', { class: 'small muted', style: { marginBottom: '8px' }, text: '3 个同色同阶宝石可合成为上一阶（100% 成功）。点击有绿框的格子合成，按住 Shift 全部合成。宝石来源：通关奖励、Boss 掉落、挖矿、噩梦宝箱、商店、竞技场。' }), grid,
          h('div', { class: 'row', style: { marginTop: '10px', justifyContent: 'center' } }, h('button', { class: 'btn orange', text: '✨ 一键合成所有可合成', onclick: () => { let k = 0; for (let c = 0; c < 6; c++) for (let t = 1; t <= 4; t++) k += G.fuseAll(c, t); if (k) { Audio.play('gem'); UI.toast('共合成 ' + k + ' 次', 'good'); G.persist(true); redraw(); UI.refreshRes(); } else UI.toast('没有可合成的宝石', 'err'); } })));
      }
      // 宝石说明
      const box = h('div', { style: { width: '760px' } });
      const desc = [
        ['红宝石', '“小起子”。哨/散：附带燃烧；炮/波：几率令狼胆怯后退；镶嵌：极高的基础攻击 + 燃烧。燃烧与冰减速互相抵消，多用于一图、怕火的 BOSS、噩梦。'],
        ['绿宝石', '主力宝石。哨/散/波：中毒（4 秒），炮：中毒（2 秒），镶嵌：12 秒长毒。毒不叠加取最高，覆盖全图即可；毒炮和毒波动是主力输出。'],
        ['黄宝石', '哨/散：暴击（最高 20% 几率 3 倍）；炮/波：几率眩晕 2 秒，可打断施法；镶嵌=光塔：范围光爆，打全部目标（含隐身与飞行），不会 miss。'],
        ['紫宝石', '哨/散：射程 +10%~50% 并变为闪电攻击（不会 miss，免疫电的狼无视）；炮/波：几率击退；镶嵌：连锁闪电，最高弹射 5 次。'],
        ['蓝宝石', '减速。哨/散/炮上数值低且不随等级成长；波动与镶嵌上随等级提高，冰镶嵌 60 级强化可减速 79%。叠加曲线近似对数，宁可把宝石合起来放冰镶嵌。'],
        ['黑宝石', '哨/波：7.5% 几率连击；散：降低攻频、同时齐射多发（对空单体之王）；炮：射程 +15%~75%、溅射更高、无法打近处；镶嵌：诅咒 5 秒后爆发并沉默周围狼。']
      ];
      const LG = (global.SVA_LORE && global.SVA_LORE.gems) || {};
      desc.forEach((d, i) => { const lg = LG[SV.GEM_COLORS[i].n];
        box.appendChild(h('div', { class: 'card row', style: { marginBottom: '6px', alignItems: 'flex-start' } }, h('div', { class: 'col', style: { alignItems: 'center', width: '90px' } }, UI.gemImg(i, 4, 44), h('b', { text: d[0] })),
          h('div', { class: 'grow' }, h('div', { class: 'small', style: { lineHeight: 1.65 }, text: d[1] }),
            lg ? h('div', { class: 'small lore-o', text: '原作：' + lg.n.join(' → ') + '（蕴含' + lg.e + '能量）' }) : null))); });
      return box;
    };
    m = UI.modal({ title: '💎 宝石工坊', body: tabsView([['bag', '背包与合成'], ['info', '宝石说明']], 'bag', render), width: 830, onClose: () => { G.persist(true); UI.refreshRes(); } });
  };

  /* ================= 商店 ================= */
  P.shop = function () {
    const s = G.save; let m;
    // 商店条目的图标：宝石/羊/留声机/棒棒糖/银币/炸弹各走各的，最后才当狼卡
    const shopIcon = (it) => {
      if (it.id.startsWith('shard') || it.id === 'crystal' || it.id === 'gem3' || it.id === 'essence')
        return UI.gemImg(it.pick ? 1 : 3, it.id === 'crystal' ? 2 : it.id === 'gem3' ? 3 : it.id === 'essence' ? 4 : 1, 40);
      if (it.id.startsWith('straw')) return h('div', { style: { fontSize: '34px' }, text: '🐑' });
      if (it.id.startsWith('phono')) return h('div', { style: { fontSize: '34px' }, text: '📻' });
      if (it.id === 'lolli') return UI.candyImg();
      if (it.id === 'silver') return UI.coinImg();
      if (it.id.startsWith('bomb')) return UI.bombImg ? UI.bombImg(40) : UI.gemImg(5, 1, 40);
      return UI.wolfImg(it.give()[0].id, 44);
    };
    const draw = () => {
      const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 1fr)', width: '860px' } });
      for (const it of G.SHOP) {
        const owned = it.once && s.wolves.owned[it.give()[0].id];
        const can = G.canBuy(it) && !owned;
        let pick = 0;
        const priceTxt = (it.price.silver ? '🪙 ' + SV.fmtFull(it.price.silver) : '') + (it.price.points ? '积分 ' + it.price.points : '');
        const card = h('div', { class: 'card ' + (can ? '' : 'dis') },
          h('div', { class: 'row' }, h('div', { style: { width: '44px' } }, shopIcon(it)),
            h('div', null, h('b', { text: it.name }), h('div', { class: 'small muted', text: it.desc }))),
          it.pick ? h('div', { class: 'row', style: { marginTop: '4px', gap: '2px' } }, [0, 1, 2, 3, 4, 5].map(c => h('div', { class: 'gp', id: 'p' + c, style: { width: '30px', height: '30px', borderColor: c === 0 ? 'var(--orange)' : '' }, onclick: e => { pick = c; card.querySelectorAll('.gp').forEach((x, i) => x.style.borderColor = i === c ? 'var(--orange)' : ''); } }, UI.gemImg(c, 1, 22)))) : null,
          h('div', { class: 'row', style: { marginTop: '6px' } }, h('b', { style: { color: '#b06a12' }, text: owned ? '已拥有' : priceTxt }), h('div', { class: 'grow' }), h('button', { class: 'btn sm ' + (can ? 'green' : 'gray'), text: owned ? '已拥有' : '购买', onclick: () => { if (!can) { UI.toast(owned ? '已拥有' : '货币不足', 'err'); return; } const rw = G.buy(it, pick); if (rw) { Audio.play('chest'); UI.toast('购买成功：' + rw.map(G.lootText).join('、'), 'good'); UI.refreshRes(); draw(); } } })));
        grid.appendChild(card);
      }
      m.setBody(h('div', null, h('div', { class: 'row', style: { marginBottom: '8px', gap: '14px' } }, h('div', { class: 'res', style: { color: '#5a3a1a', background: '#fff5d0' } }, UI.coinImg(), h('span', { text: SV.fmtFull(s.silver) })), h('div', { class: 'res', style: { color: '#5a3a1a', background: '#fff5d0' } }, UI.ptImg(), h('span', { text: s.points })), h('div', { class: 'small muted', text: '积分来源：Boss 掉落、首次通关、竞技场、噩梦宝箱、任务与成就' })), grid));
    };
    m = UI.modal({ title: '🏪 羊村商店', body: h('div'), width: 920, onClose: () => { G.persist(true); UI.refreshRes(); } });
    draw();
  };

  /* ================= 矿山 ================= */
  P.mine = function () {
    const s = G.save; let m, timer;
    const draw = () => {
      const strength = G.mineStrength();
      const info = h('div', { class: 'card row', style: { marginBottom: '8px' } }, h('div', { style: { fontSize: '40px' }, text: '⛏' }),
        h('div', null, h('b', { text: '矿工总力量：' + strength }), h('div', { class: 'small muted', text: '基础 ' + (20 + s.level * 3) + ' + 苦工 ' + G.hiredStrength() + '。力量越高，出高品质宝石概率越大；建议 400~500，超过 600 容易挖出碎片；总力量约 50 / 200 / 500 附近更易出黑宝石。' })));
      let content;
      if (!s.mine) {
        const opts = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
        G.MINE_OPTS.forEach(o => opts.appendChild(h('div', { class: 'card center' }, h('h4', { text: o.n }), h('div', { class: 'small muted', text: '预计 ' + Math.round((3 + o.h * 1.6) * 0.85) + '~' + Math.round((3 + o.h * 1.6) * 1.15) + ' 颗宝石' }), h('div', { style: { fontSize: '30px' }, text: '⛏' }), h('button', { class: 'btn green', text: '开始挖矿', onclick: () => { if (G.mineStart(o.h)) { Audio.play('build'); draw(); } } }))));
        content = h('div', null, opts, h('div', { class: 'small muted', style: { marginTop: '8px' }, text: '提示：前期宝石的主要来源之一。挖 3 次 4 小时通常比 1 次 12 小时更划算；可以离线挖矿，下次上线领取。' }));
      } else {
        const left = G.mineLeft(), total = s.mine.dur;
        const bar = h('i'), txt = h('span'), sub = h('div', { class: 'small muted' });
        const upd = () => {
          const l = G.mineLeft(); const pct = Math.min(100, (1 - l / total) * 100);
          bar.style.width = pct + '%'; txt.textContent = l > 0 ? '剩余 ' + SV.fmtTime(l / 1000) : '挖矿完成！';
          sub.textContent = '力量 ' + s.mine.str + ' · 好友加速 ' + s.mineSpeed.n + '/6 次';
        };
        upd();
        timer = setInterval(() => { if (!document.body.contains(m.el)) { clearInterval(timer); return; } upd(); if (G.mineLeft() <= 0) { clearInterval(timer); draw(); } }, 500);
        const done = left <= 0;
        content = h('div', { class: 'card center' }, h('h4', { text: '正在挖矿：' + s.mine.h + ' 小时' }),
          h('div', { style: { fontSize: '54px', lineHeight: '60px' } }, done ? UI.gemImg(3, 4, 52) : UI.resIcon('tiegao', 54, () => h('span', { text: '⛏' }))),
          h('div', { class: 'bar', style: { height: '22px', margin: '6px 0' } }, bar, h('span', { style: { fontSize: '13px', lineHeight: '18px' } }, txt)), sub,
          h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } },
            done ? h('button', { class: 'btn green lg', text: '🎁 收取宝石', onclick: () => { const r = G.mineCollect(); if (r) { Audio.play('chest'); clearInterval(timer); UI.alert('挖矿收获', h('div', { class: 'lootrow' }, r.map(UI.lootChip))); draw(); UI.refreshRes(); } } }) : [
              h('button', { class: 'btn blue', text: '👥 请好友加速 (-10%)', onclick: () => { if (G.mineSpeedUp()) { Audio.play('gem'); draw(); } else UI.toast('今天的加速次数用完了', 'err'); } }),
              h('button', { class: 'btn orange', text: '⚡ 立即完成 (积分 ' + Math.ceil(left / 3600e3 * 2) + ')', onclick: () => { if (G.mineFinishNow()) { Audio.play('gem'); draw(); UI.refreshRes(); } else UI.toast('积分不足', 'err'); } })]));
      }
      const laborers = h('div', { class: 'small muted', style: { marginTop: '10px', lineHeight: 1.6 } }, G.hiredStrength() ? '当前受雇苦工：' + G.FRIENDS.filter(f => (s.friends.hired[f.id] || 0) > Date.now()).map(f => f.n + '(+' + f.str + ')').join('、') : '还没有苦工。去「好友」小屋雇佣高力量的好友来帮你挖矿吧！');
      m.setBody(h('div', { style: { width: '700px' } }, info, content, laborers));
    };
    m = UI.modal({ title: '⛏ 羊村矿山', body: h('div'), width: 760, onClose: () => { clearInterval(timer); G.persist(true); UI.refreshRes(); } });
    draw();
  };

  /* ================= 任务 & 成就 ================= */
  P.tasks = function () {
    const s = G.save; G.dailyReset();
    const render = (tab, redraw) => {
      if (tab === 'daily') {
        const list = h('div', { class: 'col', style: { width: '720px' } });
        s.daily.tasks.forEach(t => {
          const inf = G.taskInfo(t), done = t.prog >= inf.need;
          list.appendChild(h('div', { class: 'card row', style: { opacity: t.claimed ? 0.55 : 1 } },
            h('div', { style: { fontSize: '30px', width: '40px', textAlign: 'center' }, text: { kill: '🐺', clear: '🏆', build: '🔨', fuse: '💎', mine: '⛏', arena: '⚔', whack: '🔨' }[t.id] }),
            h('div', { class: 'grow' }, h('b', { text: inf.def.name + '（' + Math.min(t.prog, inf.need) + '/' + inf.need + inf.def.unit + '）' }), h('div', { class: 'bar', style: { marginTop: '3px' } }, h('i', { style: { width: Math.min(100, t.prog / inf.need * 100) + '%' } }))),
            h('div', { class: 'row', style: { gap: '3px' } }, inf.rewards.map(UI.lootChip)),
            h('button', { class: 'btn sm ' + (t.claimed ? 'gray' : done ? 'green' : 'gray'), text: t.claimed ? '已领取' : done ? '领取' : '未完成', onclick: () => { const r = G.claimTask(t); if (r) { Audio.play('chest'); UI.refreshRes(); redraw(); } } })));
        });
        return h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px' }, text: '每日任务每天 0 点刷新。' }), list);
      }
      const list = h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', width: '860px' } });
      const groups = {};
      G.ACH.forEach(a => { (groups[a.group] = groups[a.group] || []).push(a); });
      // 每组显示当前进行中的一条
      Object.keys(groups).forEach(g => {
        const arr = groups[g];
        let cur = arr.find(a => { const r = s.ach[a.id]; return !r || !r.claimed; }) || arr[arr.length - 1];
        const rec = s.ach[cur.id] || {}; const v = Math.min(cur.goal, cur.get(s));
        const claimable = rec.done && !rec.claimed;
        list.appendChild(h('div', { class: 'card row' },
          h('div', { style: { fontSize: '28px' }, text: rec.claimed && cur === arr[arr.length - 1] ? '🏅' : '🏆' }),
          h('div', { class: 'grow' }, h('b', { text: cur.name }), h('div', { class: 'small muted', text: cur.desc }), h('div', { class: 'bar', style: { marginTop: '3px' } }, h('i', { style: { width: (v / cur.goal * 100) + '%' } }), h('span', { text: SV.fmt(v) + '/' + SV.fmt(cur.goal) }))),
          h('div', { class: 'col', style: { gap: '2px', alignItems: 'flex-end' } }, h('div', { class: 'row', style: { gap: '2px' } }, cur.rw.map(UI.lootChip)), h('button', { class: 'btn xs ' + (claimable ? 'green' : 'gray'), text: rec.claimed ? '已领取' : claimable ? '领取' : '进行中', onclick: () => { const r = G.claimAch(cur); if (r) { Audio.play('chest'); UI.refreshRes(); redraw(); } } }))));
      });
      return list;
    };
    UI.modal({ title: '📋 布告栏', body: tabsView([['daily', '每日任务', () => G.taskPending() || ''], ['ach', '成就', () => G.achPending() || '']], 'daily', render), width: 920, onClose: () => { G.persist(true); if (UI.screen === 'hub') UI.Menu.toHub(); } });
  };

  /* ================= 好友 / 苦工 / 敲狼 ================= */
  P.friends = function () {
    const s = G.save; let m;
    const draw = () => {
      const list = h('div', { class: 'col', style: { width: '780px' } });
      G.FRIENDS.forEach(f => {
        const hired = (s.friends.hired[f.id] || 0) > Date.now();
        const left = hired ? s.friends.hired[f.id] - Date.now() : 0;
        list.appendChild(h('div', { class: 'card row' },
          h('canvas', { width: 60, height: 60, style: { width: '46px', height: '46px', background: '#e9f6d4', borderRadius: '50%', border: '3px solid #8a5a2c' }, ref: c => { } }),
          h('div', { class: 'grow' }, h('b', { text: f.n }), h('span', { class: 'tag', style: { marginLeft: '6px' }, text: 'Lv.' + f.lv }), h('div', { class: 'small muted', text: '力量 ' + f.str + (hired ? ' · 受雇中 剩余 ' + SV.fmtTime(left / 1000) : '') })),
          h('button', { class: 'btn sm ' + (hired ? 'gray' : 'blue'), text: hired ? '已雇佣' : '雇佣苦工 🪙' + SV.fmt(G.hireCost(f)), onclick: () => { if (hired) return; if (G.hire(f)) { Audio.play('coin'); UI.toast('已雇佣 ' + f.n + '，矿山力量 +' + f.str, 'good'); UI.refreshRes(); draw(); } else UI.toast('银币不足', 'err'); } }),
          h('button', { class: 'btn sm orange', text: '🔨 拜访敲狼', onclick: () => { click(); P.whack(f, draw); } })));
      });
      // 头像绘制
      list.querySelectorAll('canvas').forEach((cv, i) => { const cx = cv.getContext('2d'); SV.Art.drawSheep(cx, 30, 54, 54, 0, { bell: i % 2 === 0 }); });
      m.setBody(h('div', null, h('div', { class: 'card row', style: { marginBottom: '8px' } }, h('div', { style: { fontSize: '34px' }, text: '🏡' }), h('div', { class: 'small', style: { lineHeight: 1.6 }, html: '拜访好友时会遇到偷偷摸摸的<b>间谍狼</b>，敲打它们可以获得银币（每天最多 60 只，今天剩余 ' + G.whackLeft() + ' 只）。高等级好友的间谍狼给得更多。也可以雇佣高力量好友当<b>苦工</b>，提升矿山出货品质。' })), list));
    };
    m = UI.modal({ title: '🏡 好友小屋', body: h('div'), width: 840, onClose: () => { G.persist(true); UI.refreshRes(); if (UI.screen === 'hub') UI.Menu.toHub(); } });
    draw();
  };

  // 敲狼小游戏
  P.whack = function (f, done) {
    if (G.whackLeft() <= 0) { UI.toast('今天的间谍狼已经敲完了，明天再来！', 'err'); return; }
    let score = 0, hits = 0, misses = 0, time = 25, cur = -1, curT = 0, over = false, timer, tick;
    const cells = [];
    const scoreEl = h('b', { text: '0' }), timeEl = h('b', { text: '25' });
    const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 130px)', gap: '10px', justifyContent: 'center' } });
    // 用原作 gameUI_wolf.swf 的间谍狼：下标 0 是木桶（伪装），1 是钻出来的狼
    const spyOut = (SV.Art.propURL && SV.Art.propURL('spyWolf', 120, 120, 1)) || SV.Art.wolfIconURL('xiaohuil', 56);
    for (let i = 0; i < 9; i++) {
      const hole = h('div', { style: { width: '130px', height: '110px', position: 'relative', cursor: 'crosshair', background: 'radial-gradient(ellipse at 50% 80%, #2a1a0c 0 45%, #6b4626 46% 60%, transparent 61%)', overflow: 'hidden' } });
      const wolf = h('div', { style: { position: 'absolute', left: '15px', bottom: '-70px', width: '100px', height: '90px', transition: 'bottom .09s', pointerEvents: 'none' } }, h('img', { src: spyOut, style: { width: '100%', height: '100%' } }));
      hole.appendChild(wolf);
      hole.addEventListener('mousedown', () => {
        if (over) return;
        if (cur === i && wolf.dataset.up === '1') {
          const gain = G.whackReward(f); score += gain; hits++; scoreEl.textContent = SV.fmtFull(score); wolf.dataset.up = '0'; wolf.style.bottom = '-70px'; cur = -1; Audio.play('whack');
          G.save.friends.whack.n++; G.save.stats.whacks++; G.taskProgress('whack', 1);
          const pop = h('div', { style: { position: 'absolute', left: '30px', top: '20px', color: '#ffe27a', fontWeight: 900, fontSize: '22px', textShadow: '0 2px 0 #000', animation: 'banner 0.8s forwards', pointerEvents: 'none' }, text: '+' + gain }); hole.appendChild(pop); setTimeout(() => pop.remove(), 800);
          if (G.whackLeft() <= 0) end();
        } else { misses++; }
      });
      cells.push({ hole, wolf }); grid.appendChild(hole);
    }
    const m = UI.modal({ title: '🔨 拜访 ' + f.n + ' —— 敲间谍狼！', width: 520, noBackdropClose: true, body: h('div', { class: 'center' }, h('div', { class: 'row', style: { justifyContent: 'center', gap: '30px', fontSize: '18px', marginBottom: '8px' } }, h('span', null, '⏱ ', timeEl, ' 秒'), h('span', null, '🪙 ', scoreEl)), grid, h('div', { class: 'small muted', style: { marginTop: '8px' }, text: '点击冒头的间谍狼！' })), onClose: () => { over = true; clearInterval(timer); clearInterval(tick); G.addSilver(score); G.checkAch(); G.persist(true); UI.refreshRes(); if (done) done(); } });
    function pop() {
      if (over) return;
      if (cur >= 0) { cells[cur].wolf.style.bottom = '-70px'; cells[cur].wolf.dataset.up = '0'; }
      cur = Math.floor(Math.random() * 9); const c = cells[cur];
      c.wolf.style.bottom = '-6px'; c.wolf.dataset.up = '1';
      curT = 0.55 + Math.random() * 0.5;
    }
    tick = setInterval(() => { if (over) return; curT -= 0.1; if (curT <= 0) pop(); }, 100);
    timer = setInterval(() => { time--; timeEl.textContent = time; if (time <= 0) end(); }, 1000);
    function end() {
      if (over) return; over = true; clearInterval(timer); clearInterval(tick);
      UI.toast('时间到！敲中 ' + hits + ' 只，获得 🪙' + SV.fmtFull(score), 'good');
    }
    pop();
  };

  /* ================= 图鉴 ================= */
  P.codex = function () {
    const s = G.save;
    // 原作客户端配置里的设定文案（assets/data/lore.js，tools/export_lore.py 导出）：狼的图鉴描述 + 战斗台词、塔的原作介绍
    const LORE = global.SVA_LORE || { wolves: {}, towers: {} };
    const loreView = lo => h('div', { class: 'lore' },
      h('div', { class: 'lore-d', text: '📖 ' + lo.d }),
      lo.q.length ? h('div', { class: 'lore-q' }, lo.q.map(q => h('span', { class: 'quote', text: '“' + q + '”' }))) : null);
    const TIPS = [
      '防线前期尽量全造波动塔叠战力，后期再改输出阵……那是原作的养成玩法；本作里波动塔太贵，建议哨塔+炮塔。',
      '阶梯状的绕路阵型比直来直往更能利用塔的圆形射程。',
      '塔位好坏：狼能多次进入射程的位置是好塔位；在优势塔位放一个高级塔，比分散放很多低级塔更省钱。',
      '毒只取最高值不叠加，覆盖率比数量重要；毒炮的毒仅 2 秒但伤害高，不怕分身清状态。',
      '弹簧狼闪烁前后 1 秒内命中黑镶嵌可沉默它 2 秒，趁机集火。',
      '护士狼群疗会互相治疗，务必集火秒掉一只；黑散弹对空单体最强。',
      '忍者狼免疫闪电，用炮塔；神偷狼（飞行+隐身）要用黄镶嵌光塔。',
      '冰镶嵌 20~40 级就够用，再往上升性价比迅速下降。',
      '辅助建筑不计入面板造价；雕像放在火力集中处最赚。',
      '随机 Boss 每 15~40 波出现一次，是积分与宝石的主要来源。'
    ];
    const render = (tab, redraw) => {
      if (tab === 'tower') {
        const box = h('div', { class: 'col', style: { width: '860px' } });
        for (const tp of SV.TOWER_ORDER) {
          const T = D.towers[tp];
          box.appendChild(h('div', { class: 'card row', style: { alignItems: 'flex-start' } }, h('img', { src: SV.Art.towerIconURL(tp, tp === 'inlay' ? { c: 3, t: 4 } : null, 60), style: { width: '70px', height: '70px' } }),
            h('div', { class: 'grow' }, h('b', { style: { fontSize: '17px' }, text: UI.Battle.TNAME[tp] }), h('div', { class: 'small', text: ({ sentry: '造价最低、性价比最高的单体输出塔。射程小，适合拐角与前中期。', scatter: '射程较大，同时攻击 3 个目标，且带追踪不会 miss；对空造成双倍伤害，是专业防空塔。', cannon: '攻速慢、射程极大、仅能攻击地面，落地有范围溅射；对群主力。', pulse: '攻速慢但单发极高，贯穿直线上多个目标，能主动攻击隐身狼；价格昂贵。', inlay: '无宝石不攻击。上限高，红/黄/紫做输出，冰/黑做辅助。' })[tp] }),
              LORE.towers[tp] ? h('div', { class: 'small lore-o', text: '原作介绍：' + LORE.towers[tp] }) : null,
              h('div', { class: 'small muted', text: '等级上限 ' + T.max + ' · 攻速 ' + (T.rate / 10).toFixed(1) + ' 次/秒 · Lv1 造价 ' + T.cost[0] + ' · 满级造价 ' + SV.fmt(T.cost[T.max - 1]) }))));
        }
        return box;
      }
      if (tab === 'wolf') {
        const wrap = h('div', { style: { width: '900px' } });
        const detail = h('div', { class: 'card', style: { marginBottom: '8px', minHeight: '84px' }, html: '<span class="muted">点击下方的狼查看详情（击败过的狼才会解锁）</span>' });
        const grid = h('div', { class: 'roster', style: { gap: '4px' } });
        const ids = Object.keys(D.wolves).sort((a, b) => D.wolves[a].pop - D.wolves[b].pop || D.wolves[a].a - D.wolves[b].a);
        let seenN = 0;
        ids.forEach(id => {
          const def = SV.wolfDef(id), seen = s.seen[id]; if (seen) seenN++;
          grid.appendChild(h('div', { class: 'wi ' + (def.boss ? 'boss ' : '') + (seen ? '' : 'unk'), style: { width: '58px', height: '58px', cursor: 'pointer' }, title: seen ? def.n : '？？？', onclick: () => {
            click(); if (!seen) { UI.clear(detail); detail.appendChild(h('span', { class: 'muted', text: '尚未遭遇这种狼……去战斗中击败它吧！' })); return; }
            const RN = { fire: '火', frost: '冰', poison: '毒', light: '电/光', crit: '暴击', beat: '击退', vertigo: '眩晕', silence: '沉默' }, SK = { fly: '飞行', sprint: '狂奔', blink: '闪烁', invisible: '隐身', shield: '护盾', summon: '召唤', revive: '重生', reborn: '转生', divide: '分身', heal: '群疗', burst: '自爆' };
            const resistIcon = { fire: 'resistFire', frost: 'resistFrost', poison: 'resistPoison', light: 'resistLight', crit: 'resistCrit', beat: 'resistBeat', vertigo: 'resistVertigo' };
            const tags = [];
            for (const k in def.res) { const v = def.res[k], text = RN[k] + (v >= 1 ? '免疫' : v > 0 ? '抗' + Math.round(v * 100) + '%' : '怕' + Math.round(-v * 100) + '%'); tags.push(UI.skillTag ? UI.skillTag(resistIcon[k], text, v >= 1 ? 'imm' : v > 0 ? 'good' : 'bad') : h('span', { class: 'res-tag ' + (v >= 1 ? 'imm' : v > 0 ? 'good' : 'bad'), text })); }
            const SK_ICON = { fly: 'fly', sprint: 'sprint', blink: 'blink', invisible: 'invisible', shield: 'shield', summon: 'summon', revive: 'revive', reborn: 'reborn', divide: 'divide', heal: 'massTreatment', burst: 'burst' };
            for (const k in def.sk) if (SK[k]) tags.push(UI.skillTag ? UI.skillTag(SK_ICON[k], SK[k]) : h('span', { class: 'res-tag sk', text: SK[k] }));
            const hpAt = L => def.fixed ? SV.fmt(def.a) : SV.fmt(SV.wolfHP(id, L, 1));
            UI.clear(detail); detail.append(h('div', { class: 'row', style: { alignItems: 'flex-start' } }, UI.wolfImg(id, 76), h('div', { class: 'grow' }, h('b', { style: { fontSize: '18px' }, text: def.n }), def.boss ? h('span', { class: 'tag r', style: { marginLeft: '6px' }, text: 'BOSS' }) : null, h('div', { class: 'small', text: '移速 ' + def.speed.toFixed(2) + ' 格/秒 · 人口 ' + (def.boss ? '—' : def.pop) + (def.fly ? ' · ✈ 飞行' : '') }), h('div', { class: 'small', text: def.fixed ? '固定生命 ' + SV.fmt(def.a) : '生命(狼等级 5/20/50/100)：' + [5, 20, 50, 100].map(hpAt).join(' / ') }), h('div', null, tags), LORE.wolves[def.n] ? loreView(LORE.wolves[def.n]) : null)));
          } }, UI.wolfImg(id, 54)));
        });
        wrap.append(h('div', { class: 'small muted', style: { marginBottom: '4px' }, text: '已发现 ' + seenN + ' / ' + ids.length + ' 种狼' }), detail, grid);
        return wrap;
      }
      if (tab === 'map') {
        const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(4, 1fr)', width: '900px' } });
        D.maps.forEach((m, i) => { const st = G.mapState(i), rec = G.mapRec(i); grid.appendChild(h('div', { class: 'card ' + (st.unlocked ? '' : 'dis'), style: { padding: '4px 8px' } }, h('b', { text: m.no + '. ' + m.n }), h('div', { class: 'small muted', text: G.mapCleared(i) ? '⭐ 通关 ×' + rec.clears + (rec.nm ? ' · 噩梦 ' + rec.nm + '波' : '') : st.unlocked ? '未通关' : '🔒 ' + st.why }))); });
        return grid;
      }
      if (tab === 'stat') {
        const st = s.stats, fmtPlay = sec => { const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60); return (hh ? hh + ' 小时 ' : '') + mm + ' 分钟'; };
        const rows = [
          ['村长', s.name + '  Lv.' + s.level], ['累计击杀', SV.fmtFull(st.kills)], ['击败 BOSS', SV.fmtFull(st.bosses)], ['通关次数', st.clears + '（零漏狼 ' + st.perfect + ' 次）'],
          ['通关地图数', Object.keys(s.maps).filter(k => s.maps[k].clears > 0).length + ' / ' + D.maps.length], ['累计漏狼', SV.fmtFull(st.leaks)], ['累计建塔', SV.fmtFull(st.towers)],
          ['塔最高等级', st.maxTowerLv], ['累计赚取银币', SV.fmt(st.silverEarned)], ['宝石合成', st.fuse + ' 次'], ['噩梦最高波数', st.nmBest + ' / 110'],
          ['竞技场', s.arena.wins + ' 胜 ' + s.arena.losses + ' 负（积分 ' + s.arena.score + '）'], ['挖矿次数', st.mineRuns], ['敲打间谍狼', st.whacks + ' 只'], ['已发现的狼', Object.keys(s.seen).length + ' / ' + Object.keys(D.wolves).length],
          ['炸弹墙', (st.bombs || 0) + ' 枚引爆 · 炸倒 ' + (st.bombKills || 0) + ' 只'], ['已兑换礼包码', (st.codes || 0) + ' 个'],
          ['游戏时长', fmtPlay(st.play)], ['创建时间', new Date(s.created).toLocaleDateString()]
        ];
        return h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', width: '760px' } }, rows.map(r => h('div', { class: 'card row' }, h('span', { class: 'muted grow', text: r[0] }), h('b', { text: String(r[1]) }))));
      }
      return h('div', { class: 'col', style: { width: '820px' } }, TIPS.map((t, i) => h('div', { class: 'card', style: { fontSize: '15px' } }, h('b', { style: { color: '#b06a12' }, text: (i + 1) + '. ' }), t)));
    };
    UI.modal({ title: '📚 羊村百科', body: tabsView([['tower', '防御塔'], ['wolf', '狼图鉴'], ['map', '地图'], ['stat', '战绩'], ['tips', '攻略心得']], 'wolf', render), width: 960 });
  };
})(typeof window !== 'undefined' ? window : globalThis);
