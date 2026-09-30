"""Hunt for the wolf models we have not found yet.

The client picks a monster SWF by the server-side `res` string, and those strings are the
same pinyin abbreviations used as keys in js/data.js. The first pass matched most of them
verbatim; the rest need spelling variants. This script

  1. lists every wolf key in js/data.js,
  2. builds a wide candidate set per key (prefix/suffix/case/underscore variants, the
     `2` / `X` suffixes seen in the files we did find, and a pinyin-initial fallback
     derived from the Chinese name),
  3. HEAD-probes them on the original static server,
  4. reports which keys are still unmatched and writes everything to
     tools/_meta/wolf_res_more.json

usage: python tools/probe_wolf_more.py [--offline]
"""
import concurrent.futures as cf
import json
import os
import re
import sys
import urllib.request

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, 'tools', '_meta')

# 常见字 → 拼音首字母（用于拼出候选 id；客户端里有的用全拼、有的用首字母，两种都试）
PY = {
    '冰': 'b', '毒': 'd', '狼': 'l', '火': 'h', '爆': 'b', '炸': 'z', '暴': 'b', '走': 'z',
    '大': 'd', '小': 'x', '白': 'b', '黑': 'h', '红': 'h', '黄': 'h', '绿': 'l', '蓝': 'l',
    '紫': 'z', '金': 'j', '银': 'y', '铁': 't', '钢': 'g', '石': 's', '岩': 'y', '沙': 's',
    '雪': 'x', '霜': 's', '寒': 'h', '雷': 'l', '电': 'd', '风': 'f', '雨': 'y', '云': 'y',
    '飞': 'f', '天': 't', '地': 'd', '海': 'h', '山': 's', '林': 'l', '森': 's', '树': 's',
    '花': 'h', '草': 'c', '藤': 't', '木': 'm', '机': 'j', '甲': 'j', '械': 'x', '炮': 'p',
    '枪': 'q', '箭': 'j', '刀': 'd', '剑': 'j', '盾': 'd', '忍': 'r', '者': 'z', '影': 'y',
    '暗': 'a', '光': 'g', '圣': 's', '神': 's', '魔': 'm', '法': 'f', '术': 's', '巫': 'w',
    '医': 'y', '护': 'h', '士': 's', '骑': 'q', '兵': 'b', '将': 'j', '军': 'j', '王': 'w',
    '皇': 'h', '帝': 'd', '首': 's', '领': 'l', '头': 't', '目': 'm', '老': 'l', '幼': 'y',
    '幼': 'y', '小': 'x', '盗': 'd', '墓': 'm', '贼': 'z', '山': 's', '贼': 'z', '海': 'h',
    '盗': 'd', '土': 't', '猪': 'z', '牛': 'n', '羊': 'y', '熊': 'x', '虎': 'h', '豹': 'b',
    '猫': 'm', '狗': 'g', '鼠': 's', '兔': 't', '龙': 'l', '蛇': 's', '猴': 'h', '象': 'x',
    '蝙': 'b', '蝠': 'f', '蜘': 'z', '蛛': 'z', '蜂': 'f', '蚁': 'y', '虫': 'c', '鲸': 'j',
    '鲨': 's', '章': 'z', '鱼': 'y', '鸟': 'n', '鹰': 'y', '鸦': 'y', '鹤': 'h', '鸦': 'y',
    '幽': 'y', '灵': 'l', '魂': 'h', '尸': 's', '骷': 'k', '髅': 'l', '僵': 'j',
    '导': 'd', '师': 's', '德': 'd', '鲁': 'l', '伊': 'y', '牧': 'm',
    '丑': 'c', '公': 'g', '主': 'z', '女': 'n', '奶': 'n', '妈': 'm', '生': 's', '弹': 'd',
}

ALPHA = 'abcdefghijklmnopqrstuvwxyz'


def wolf_entries():
    src = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
    start = src.index('{', src.index('window.SVD'))
    return json.loads(src[start:src.rindex('}') + 1])['wolves']


def norm(name):
    """Normalise an id for fuzzy comparison: lowercase letters only, drop the D_/H_ prefix,
    drop a trailing digit or X marker."""
    s = re.sub(r'[^a-z]', '', name.lower())
    s = re.sub(r'^(d|h)(?=[a-z]{2,})', '', s)
    s = re.sub(r'(\d+|x)$', '', s)
    return s


def candidates(key, cn):
    out = set()
    bases = {key, key.lower(), key.upper(),
             re.sub(r'^[DH]_', '', key), re.sub(r'^[DH](?=[a-z])', '', key.lower())}
    for b in list(bases):
        for suf in ('', 'l', '2', 'X', 'x', 'l2', '1', '3'):
            out.add(b + suf)
        # 客户端里不少 id 是「词根 + 单字母」或「单字母 + 词根」（例如 byl1 / dengshenl1）
        for ch in ALPHA:
            out.add(b + ch)
            out.add(ch + b)
        # 词根尾部可能多/少一个 l
        if b.endswith('l'):
            out.add(b[:-1])
            out.add(b[:-1] + 'n')
        else:
            out.add(b + 'l')
            out.add(b + 'n')
    # 中文名首字母
    if cn:
        initials = ''.join(PY.get(ch, '') for ch in cn if ch.strip())
        if initials:
            out.add(initials)
            out.add(initials + 'l')
            if initials.endswith('l'):
                out.add(initials + '2')
    return {c for c in out if c}


def head(name):
    req = urllib.request.Request(BASE + name, method='HEAD')
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return name, r.status, int(r.headers.get('Content-Length') or 0)
    except Exception as e:  # noqa: BLE001
        return name, getattr(e, 'code', 'err'), 0


def main():
    entries = wolf_entries()
    have = set(os.path.splitext(f)[0].lower()
               for f in os.listdir(os.path.join(ROOT, 'tdsheep_swf', 'monster')))
    have_norm = {norm(h) for h in have}

    missing = {k: v for k, v in entries.items() if norm(k) not in have_norm}
    print('data.js wolves %d   swf downloaded %d   still missing %d' % (len(entries), len(have), len(missing)))

    lookup = {}
    for k, v in missing.items():
        for c in candidates(k, v.get('n', '')):
            lookup.setdefault('gameUI/dynamic/%s.swf' % c, []).append(k)
    print('probing %d candidate files ...' % len(lookup))

    if '--offline' in sys.argv:
        print('(offline mode, nothing probed)')
        return
    with cf.ThreadPoolExecutor(16) as ex:
        res = list(ex.map(head, sorted(lookup)))
    hits = [(n, s) for n, s, size in res if s == 200]
    print('found %d new models' % len(hits))
    solved = {}
    for name, size in hits:
        for k in lookup[name]:
            solved.setdefault(k, []).append([name, size])
        print('  %-46s %7d  <- %s' % (name, size, ','.join(lookup[name])))

    os.makedirs(META, exist_ok=True)
    with open(os.path.join(META, 'wolf_res_more.json'), 'w', encoding='utf-8') as fh:
        json.dump({'base': BASE, 'found': [[n, s] for n, s in hits], 'solved': solved,
                   'still_missing': sorted(set(missing) - set(solved))}, fh,
                  ensure_ascii=False, indent=1)
    rest = sorted(set(missing) - set(solved))
    print('still missing %d keys:' % len(rest))
    for k in rest:
        print('   %-16s %s' % (k, entries[k].get('n')))


if __name__ == '__main__':
    main()
