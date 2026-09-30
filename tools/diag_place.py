"""Show where a shape/sprite sits in the display tree (depth chain + clip flags).

usage: python tools/diag_place.py bdl 21
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    wid = sys.argv[1]
    target = int(sys.argv[2])
    d = Doc(os.path.join(ROOT, 'tdsheep_swf', 'monster', wid + '.swf'))
    root = d.sym and max(d.sym)          # 顶层符号一般是最大 id
    seen = set()

    def walk(cid, chain, depth=0):
        if depth > 8 or cid in seen:
            return
        seen.add(cid)
        if cid == target:
            print('found shape %d via:' % target)
            for c in chain:
                print('   ', c)
            return
        if cid not in d.sprites:
            return
        st = d.states(cid)
        if not st:
            return
        for dep in sorted(st[0]):
            o = st[0][dep]
            walk(o['id'], chain + ['sprite %s depth %s -> %s%s' %
                                   (cid, dep, o['id'], ' CLIP' if o.get('clip') else '')], depth + 1)

    walk(root, [])
    # 也直接扫所有动画精灵
    print('--- every placement of %d ---' % target)
    for sid, sp in d.sprites.items():
        for fi, fr in enumerate(sp['frames']):
            for o in fr:
                if o.get('id') == target:
                    print('sprite %s frame %d depth %s clip=%s' % (sid, fi, o.get('depth'), o.get('clip')))


if __name__ == '__main__':
    main()
