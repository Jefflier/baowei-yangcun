/* ============================================================
 * 保卫羊村·怀旧服  —  核心工具 & 地图模型
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV = global.SV || {};
  const D = global.SVD;
  SV.D = D;

  /* ---------- 随机数 ---------- */
  function RNG(seed) { this.s = (seed >>> 0) || 123456789; }
  RNG.prototype.next = function () {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  SV.RNG = RNG;
  SV.rand = new RNG((Date.now() ^ 0x9e3779b9) >>> 0);

  /* ---------- 小工具 ---------- */
  SV.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  SV.lerp = (a, b, t) => a + (b - a) * t;
  SV.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  SV.fmt = function (n) {
    n = Math.floor(n);
    const neg = n < 0; if (neg) n = -n;
    let s;
    if (n >= 1e8) s = (n / 1e8).toFixed(n >= 1e9 ? 1 : 2).replace(/\.?0+$/, '') + '亿';
    else if (n >= 1e4) s = (n / 1e4).toFixed(n >= 1e5 ? 1 : 2).replace(/\.?0+$/, '') + '万';
    else s = String(n);
    return (neg ? '-' : '') + s;
  };
  SV.fmtFull = n => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  SV.fmtTime = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
  };
  SV.hash2 = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  /* ---------- 常量 ---------- */
  SV.GEM_TIERS = ['碎片', '晶体', '宝石', '精华', '强化'];
  SV.GEM_COLORS = D.gems;                       // hong lv huang zi lan hei
  SV.TOWER_ORDER = ['sentry', 'scatter', 'cannon', 'pulse', 'inlay'];
  SV.TOWER_ICON = { sentry: '🏹', scatter: '💥', cannon: '💣', pulse: '🌀', inlay: '💎' };
  SV.SPEED_MULT = 2;                            // 攻速倍率（与论坛工具"默认2"对齐）
  SV.CELL_SPEED = 1 / 36;                       // 数据移速 → 格/秒
  /* 原作的格子不是正方形：实机录像里墙/塔的间距实测 x≈65、y≈50（原作素材坐标），
     与 gameUI_landform.swf 的 FloorGridAllow（69×53.6）同比例。渲染按这个比例摆格子，
     原作地图底图里烘好的羊村/出怪台才能和格子对上。 */
  SV.CELL_W = 65; SV.CELL_H = 50; SV.CELL_AR = SV.CELL_H / SV.CELL_W;
  SV.WAVE_LABEL = { '0.8': '小菜一碟', '0.9': '轻而易举', '1': '势均力敌', '1.1': '有惊无险', '1.2': '稍有难度', '1.3': '困难重重' };

  /* ---------- 地图分组/主题 ---------- */
  const THEME_BY_NAME = {
    '巴罗村': 'grass', '比丘村': 'grass', '卡西村': 'grass', '呼噜噜村': 'river', '安蒂亚村': 'desert', '菲洛克村': 'canyon',
    '凯奇镇': 'grass', '艾伊尔村': 'ruins', '拉帕斯村': 'desert', '沃夫沼泽': 'swamp', '麦恩矿山': 'mine',
    '埃特纳村': 'volcano', '雷尼尔村': 'volcano', '拉卡维村': 'volcano', '坦克尔村': 'canyon', '莫诺雷村': 'snow',
    '奥兹玛村': 'snow', '西利村': 'snow', '塔特村': 'snow', '苏兰德城': 'snow', '赤火地带': 'volcano', '烈焰熔炉': 'volcano',
    '银蛇之巅': 'snow', '特洛伊岛': 'beach', '钓鱼岛': 'beach', '齿轮工厂': 'factory', '虎克工厂': 'factory',
    '斯蒂尔镇': 'factory', '拉瓦锡镇': 'factory', '佛里特镇': 'factory', '斯贝斯镇': 'factory', '泰威尔镇': 'factory',
    '泰勒斯镇': 'factory', '克勒蒙村': 'factory', '鲁姆车间': 'factory', '弗兰克镇': 'factory', '生命森林': 'forest',
    '防线': 'town', '香树镇': 'forest', '远古冰川': 'snow', '缠怨谷': 'volcano', '金沙桥': 'desert', '楼兰城': 'desert',
    '梨花冰场': 'snow', '凌绽雪原': 'snow', '枫威瀑布': 'river'
  };
  SV.CHAPTER_NAMES = { 1: '第一大陆 · 青青草原', 2: '第二大陆 · 烈焰雪域', 3: '第三大陆 · 机械工业', 4: '第四大陆 · 防线要塞' };

  /* ---------- 狼定义 ---------- */
  SV.wolfDef = function (id) {
    const w = D.wolves[id];
    if (!w) return null;
    if (!w._d) {
      w._d = true;
      w.id = id;
      w.speed = w.spd * SV.CELL_SPEED;
      w.res = w.res || {};
      w.sk = w.sk || {};
      w.fixed = (w.b === 0 && w.c === 0);
      w.boss = w.fixed || w.pop >= 99;
      w.size = SV.clamp(Math.sqrt((w.w * w.h) / (600 * 750)), 0.55, 1.9);
      if (/自爆/.test(w.n)) w.sk.burst = 1;
      if (/护士|奶妈/.test(w.n)) w.sk.heal = 1;
    }
    return w;
  };
  SV.wolfHP = function (id, L, diff) {
    const w = SV.wolfDef(id);
    return Math.max(1, Math.floor((w.a + L * (w.b + L * w.c)) * diff));
  };

  /* ---------- 地图模型 ---------- */
  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  SV.DIRS8 = DIRS8;
  const BELT = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

  function MapModel(idx) {
    const def = D.maps[idx];
    this.idx = idx; this.def = def; this.name = def.n;
    this.cols = def.c; this.rows = def.r;
    this.theme = THEME_BY_NAME[def.n] || 'grass';
    const n = this.cols * this.rows;
    this.type = new Uint8Array(n);
    this.feat = new Array(n).fill(null);
    this.belt = new Array(n).fill(null);
    this.teleId = new Int8Array(n);
    this.spawns = []; this.goals = [];
    this.springs = new Set(def.spring || []);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c;
      const t = +def.g[r][c];
      this.type[i] = t;
      const key = r + '_' + c;
      if (def.feat[key]) this.feat[i] = def.feat[key];
      if (def.belt[key]) this.belt[i] = BELT[def.belt[key]];
      if (def.tele[key] != null) this.teleId[i] = def.tele[key];
      if (t === 2) this.spawns.push(i);
      if (t === 3) this.goals.push(i);
    }
    // 出口/入口方位提示（用于绘制箭头）
    this.labels = {};
    for (const k in def.lab) { const [r, c] = k.split('_').map(Number); this.labels[r * this.cols + c] = def.lab[k]; }
    // 传送门
    this.teleIn = {}; this.teleOut = {};
    for (let i = 0; i < n; i++) {
      if (this.type[i] === 4) (this.teleIn[this.teleId[i]] = this.teleIn[this.teleId[i]] || []).push(i);
      if (this.type[i] === 5) (this.teleOut[this.teleId[i]] = this.teleOut[this.teleId[i]] || []).push(i);
    }
    // 连通片：火山 / 反应炉 / 核电厂
    this.hazards = [];
    const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const f = this.feat[i];
      if (!f || seen[i]) continue;
      let kind = null;
      if (f === '火山') kind = 'volcano'; else if (f === '反应炉') kind = 'reactor'; else if (f === '核电厂') kind = 'nuclear';
      if (!kind) continue;
      const cells = []; const st = [i]; seen[i] = 1;
      while (st.length) {
        const u = st.pop(); cells.push(u);
        const ux = u % this.cols, uy = (u / this.cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = ux + dx, y = uy + dy;
          if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) continue;
          const j = y * this.cols + x;
          if (!seen[j] && this.feat[j] === f) { seen[j] = 1; st.push(j); }
        }
      }
      const big = cells.length >= 6;
      this.hazards.push({
        kind, cells, big,
        period: kind === 'volcano' ? (big ? 10 : 7) : kind === 'reactor' ? 10 : 4,
        t: 2 + (this.hazards.length % 5) * 0.7, flash: 0
      });
    }
    this.hasHazard = this.hazards.length > 0;
  }
  MapModel.prototype.idxOf = function (x, y) { return y * this.cols + x; };
  MapModel.prototype.inb = function (x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; };
  // 格子本身是否可走（不含建筑）
  MapModel.prototype.walkableBase = function (i) {
    const t = this.type[i]; return t === 1 || t === 2 || t === 3 || t === 4 || t === 5 || t === 7;
  };
  MapModel.prototype.buildableBase = function (i) {
    const t = this.type[i]; return t === 1 || t === 6;
  };
  SV.MapModel = MapModel;

  /* ---------- 寻路（Dijkstra 流场）---------- */
  // occ: 数组，非 null 且 blocking 的格子不可走
  SV.computeField = function (map, blockedFn) {
    const n = map.cols * map.rows, cols = map.cols, rows = map.rows;
    const dist = new Float32Array(n).fill(Infinity);
    const nxt = new Int16Array(n).fill(-1);
    const walk = new Uint8Array(n);
    for (let i = 0; i < n; i++) walk[i] = map.walkableBase(i) && !blockedFn(i) ? 1 : 0;
    // 简易 Dijkstra（小图，用数组当优先队列）
    const open = [];
    for (const g of map.goals) { dist[g] = 0; open.push(g); }
    const inq = new Uint8Array(n);
    for (const g of map.goals) inq[g] = 1;
    while (open.length) {
      // 取最小
      let bi = 0, bd = dist[open[0]];
      for (let k = 1; k < open.length; k++) { const dd = dist[open[k]]; if (dd < bd) { bd = dd; bi = k; } }
      const u = open[bi]; open[bi] = open[open.length - 1]; open.pop(); inq[u] = 0;
      const ux = u % cols, uy = (u / cols) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS8[k][0], dy = DIRS8[k][1];
        const x = ux + dx, y = uy + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const v = y * cols + x;
        if (!walk[v]) continue;
        if (dx !== 0 && dy !== 0) { // 不允许穿墙角
          if (!walk[uy * cols + x] || !walk[y * cols + ux]) continue;
        }
        const nd = bd + (dx !== 0 && dy !== 0 ? 1.4142 : 1);
        if (nd < dist[v] - 1e-6) { dist[v] = nd; if (!inq[v]) { inq[v] = 1; open.push(v); } }
      }
      // 传送：u 是出口 → 松弛同 id 的入口
      if (map.type[u] === 5) {
        const ins = map.teleIn[map.teleId[u]] || [];
        for (const v of ins) { const nd = bd + 1; if (walk[v] && nd < dist[v] - 1e-6) { dist[v] = nd; if (!inq[v]) { inq[v] = 1; open.push(v); } } }
      }
    }
    // 生成下一跳
    for (let u = 0; u < n; u++) {
      if (!walk[u] || dist[u] === Infinity || dist[u] === 0) continue;
      if (map.type[u] === 4) { // 传送入口：下一跳为最近的出口
        const outs = map.teleOut[map.teleId[u]] || [];
        let best = -1, bd2 = Infinity;
        for (const o of outs) if (walk[o] && dist[o] < bd2) { bd2 = dist[o]; best = o; }
        if (best >= 0 && bd2 + 1 <= dist[u] + 1e-3) { nxt[u] = best; continue; }
      }
      const ux = u % cols, uy = (u / cols) | 0;
      let best = -1, bs = Infinity;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS8[k][0], dy = DIRS8[k][1];
        const x = ux + dx, y = uy + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const v = y * cols + x;
        if (!walk[v]) continue;
        if (dx !== 0 && dy !== 0 && (!walk[uy * cols + x] || !walk[y * cols + ux])) continue;
        const s = dist[v] + (dx !== 0 && dy !== 0 ? 1.4142 : 1);
        if (s < bs - 1e-6) { bs = s; best = v; }
      }
      nxt[u] = best;
    }
    return { dist, nxt, walk };
  };

  /* ---------- 存档辅助 ---------- */
  SV.store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
