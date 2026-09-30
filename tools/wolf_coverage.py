"""Report which wolves in js/data.js have an original model (assets/wolf/<id>.png).

The client names a monster model after the server-side `res` string. Some encyclopedia keys
are variants that reuse a base model, so js/art_wolf_origin.js falls back through:

    D_glykl → glykl          （去掉 D_/H_ 前缀）
    sdys_A  → sdys           （去掉 _A/_B/_Z 后缀）
    yll_B2  → yll
    bylX    → byl

This script applies the same rules and prints coverage, so we know how many wolves still
fall back to the hand-drawn model. It is also what tools/build_wolves.ps1 -Only wants.

usage: python tools/wolf_coverage.py            # report
       python tools/wolf_coverage.py --missing  # just the ids with no model (comma list)
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WOLF_DIR = os.path.join(ROOT, 'assets', 'wolf')


def alias_of(wid):
    """Keep in sync with aliasOf() in js/art_wolf_origin.js."""
    EXTRA = {'bylX': ['byl2'], 'liyuqil': ['xiaoliyuqil'], 'lyql': ['xiaoliyuqil']}
    cand = [wid, re.sub(r'^[DH]_?', '', wid),
            re.sub(r'_[A-Za-z]\d?$', '', wid), re.sub(r'X$', '', wid)] + EXTRA.get(wid, [])
    out = []
    for v in cand:
        if v and v not in out:
            out.append(v)
        lv = v.lower()
        if lv != v and lv not in out:
            out.append(lv)
    return out


def sheets():
    return {f[:-4] for f in os.listdir(WOLF_DIR)
            if f.endswith('.png') and not f.endswith('_dead.png')}


def main():
    src = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
    D = json.loads(src[src.index('{', src.index('window.SVD')):src.rindex('}') + 1])
    avail = sheets()
    direct, aliased, missing = [], [], []
    for wid in sorted(D['wolves']):
        if wid in avail:
            direct.append(wid)
        else:
            hit = next((c for c in alias_of(wid) if c in avail), None)
            (aliased if hit else missing).append((wid, hit) if hit else wid)
    if '--missing' in sys.argv:
        print(','.join(missing))
        return
    print('data.js 狼 %d　原作图集 %d 张' % (len(D['wolves']), len(avail)))
    print('  直接命中 %d' % len(direct))
    print('  复用基础模型 %d' % len(aliased))
    for wid, hit in aliased:
        print('     %-14s -> %s' % (wid, hit))
    print('  没有模型（退回程序化绘制）%d' % len(missing))
    for wid in missing:
        print('     %-14s %s' % (wid, D['wolves'][wid]['n']))
    used = {w for w in avail if w in D['wolves']} | {c for _w, c in aliased}
    print('  图集里没被任何狼用到的 %d 张：%s'
          % (len(avail - used), '、'.join(sorted(avail - used)[:12])))


if __name__ == '__main__':
    main()
