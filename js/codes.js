/* ============================================================
 * 兑换码：内置口令 + 可离线生成的校验码（无外部依赖，tools/codegen.html 也复用它）
 *
 * 生成码格式：SV-XXXXX-XXXXX-…-CCCCCCC
 *   中间是奖励文本的 Base32，最后 7 位是带盐的 FNV-1a 校验。
 * 奖励文本用 ; 分隔的片段：
 *   s银币  p积分  l棒棒糖  b炸弹  e经验  g颜色.阶.数量(颜色0-5,阶1-5)
 *   a稻草羊等级.数量  h留声机等级.数量  w狼ID.碎片数  n随机串(区分同奖励的码)  d有效期YYYYMMDD
 * 注意：这是单机游戏，校验盐写在源码里，只防手滑输错，不防有心人伪造。
 * ============================================================ */
(function (global) {
  'use strict';
  const SV = global.SV = global.SV || {};
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';        // 去掉易混淆的 I O 0 1
  const SALT = 'YANGCUN|HUAIJIU|2026';

  function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function checksum(payload) {
    let n = fnv(SALT + payload) * 32 + (fnv(payload + SALT) & 31);      // ≈37 位
    let s = '';
    for (let i = 0; i < 7; i++) { s = ALPHA[n % 32] + s; n = Math.floor(n / 32); }
    return s;
  }
  function b32enc(str) {
    const bytes = unescape(encodeURIComponent(str)).split('').map(c => c.charCodeAt(0));
    let bits = 0, val = 0, out = '';
    for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; }
    if (bits > 0) out += ALPHA[(val << (5 - bits)) & 31];
    return out;
  }
  function b32dec(s) {
    let bits = 0, val = 0; const bytes = [];
    for (const ch of s) {
      const k = ALPHA.indexOf(ch); if (k < 0) return null;
      val = (val << 5) | k; bits += 5;
      if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; }
    }
    try { return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes))); } catch (e) { return null; }
  }

  /* 奖励列表 <-> 文本（与 G.giveLoot 使用同一种 loot 结构） */
  function lootsToText(list, opts) {
    opts = opts || {};
    const seg = [];
    for (const l of list) {
      if (l.type === 'silver') seg.push('s' + l.n);
      else if (l.type === 'points') seg.push('p' + l.n);
      else if (l.type === 'exp') seg.push('e' + l.n);
      else if (l.type === 'gem') seg.push('g' + l.c + '.' + l.t + '.' + (l.n || 1));
      else if (l.type === 'wolfShard') seg.push('w' + l.id + '.' + l.n);
      else if (l.type === 'item') {
        if (l.id === 'lollipop') seg.push('l' + l.n);
        else if (l.id === 'bomb') seg.push('b' + l.n);
        else if (l.id === 'straw') seg.push('a' + l.lv + '.' + l.n);
        else if (l.id === 'phono') seg.push('h' + l.lv + '.' + l.n);
      }
    }
    if (opts.expire) seg.push('d' + opts.expire);
    seg.push('n' + (opts.nonce || Math.random().toString(36).slice(2, 7)));
    return seg.join(';');
  }
  function textToLoots(text) {
    const loots = []; let expire = null;
    for (const p of text.split(';')) {
      if (!p) continue;
      const k = p[0], v = p.slice(1), a = v.split('.');
      const num = x => { const n = +x; return isFinite(n) && n > 0 && n <= 1e9 ? Math.floor(n) : 0; };
      if (k === 's' && num(v)) loots.push({ type: 'silver', n: num(v) });
      else if (k === 'p' && num(v)) loots.push({ type: 'points', n: num(v) });
      else if (k === 'e' && num(v)) loots.push({ type: 'exp', n: num(v) });
      else if (k === 'l' && num(v)) loots.push({ type: 'item', id: 'lollipop', n: num(v) });
      else if (k === 'b' && num(v)) loots.push({ type: 'item', id: 'bomb', n: num(v) });
      else if (k === 'g' && a.length === 3 && +a[0] >= 0 && +a[0] <= 5 && +a[1] >= 1 && +a[1] <= 5 && num(a[2])) loots.push({ type: 'gem', c: +a[0], t: +a[1], n: num(a[2]) });
      else if ((k === 'a' || k === 'h') && a.length === 2 && +a[0] >= 1 && +a[0] <= 3 && num(a[1])) loots.push({ type: 'item', id: k === 'a' ? 'straw' : 'phono', lv: +a[0], n: num(a[1]) });
      else if (k === 'w' && a.length === 2 && /^[A-Za-z0-9_]+$/.test(a[0]) && num(a[1])) loots.push({ type: 'wolfShard', id: a[0], n: num(a[1]) });
      else if (k === 'd' && /^\d{8}$/.test(v)) expire = v;
      else if (k === 'n') { /* 随机串，仅用于区分 */ }
      else return null;
    }
    return { loots, expire };
  }

  const Codes = SV.Codes = {
    /* 生成一个兑换码。list: loot 数组；opts: {expire:'20261231', nonce:'abc'} */
    make(list, opts) {
      const text = lootsToText(list, opts);
      const body = b32enc(text).match(/.{1,5}/g).join('-');
      return 'SV-' + body + '-' + checksum(text);
    },
    /* 内置口令：不区分大小写，每个存档限领一次 */
    builtin: {
      HUAIJIU: { name: '怀旧服开服福利', loots: [{ type: 'silver', n: 20000 }, { type: 'item', id: 'lollipop', n: 2 }, { type: 'item', id: 'bomb', n: 3 }, { type: 'gem', c: 1, t: 2, n: 2 }] },
      YANGCUN666: { name: '羊村六六六', loots: [{ type: 'points', n: 6 }, { type: 'item', id: 'bomb', n: 5 }, { type: 'silver', n: 6666 }] },
      BAOZHA: { name: '炸弹补给', loots: [{ type: 'item', id: 'bomb', n: 10 }] },
      XINSHOU: { name: '新手礼包', loots: [{ type: 'silver', n: 8000 }, { type: 'gem', c: 0, t: 1, n: 3 }, { type: 'gem', c: 3, t: 1, n: 3 }, { type: 'item', id: 'straw', lv: 1, n: 1 }] },
      BAOSHI: { name: '宝石大放送', loots: [{ type: 'gem', c: 2, t: 2, n: 2 }, { type: 'gem', c: 4, t: 2, n: 2 }, { type: 'gem', c: 5, t: 1, n: 3 }] }
    },
    /* 解析输入：返回 { ok, id, name, loots, expire } 或 { ok:false, err } */
    parse(input) {
      let raw = String(input || '').trim().toUpperCase().replace(/[\s　]+/g, '').replace(/[—–－_]/g, '-');
      if (!raw) return { ok: false, err: '请输入兑换码' };
      const bi = Codes.builtin[raw];
      if (bi) return { ok: true, id: 'B:' + raw, name: bi.name, loots: bi.loots.map(x => Object.assign({}, x)), expire: null };
      if (!/^SV-/.test(raw)) return { ok: false, err: '兑换码不存在' };
      const parts = raw.split('-');
      if (parts.length < 3) return { ok: false, err: '兑换码格式不对' };
      const cs = parts.pop(); parts.shift();
      const text = b32dec(parts.join(''));
      if (text == null || checksum(text) !== cs) return { ok: false, err: '兑换码无效（可能输错了字符）' };
      const r = textToLoots(text);
      if (!r || !r.loots.length) return { ok: false, err: '兑换码内容无效' };
      return { ok: true, id: 'G:' + cs, name: '礼包码', loots: r.loots, expire: r.expire };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
