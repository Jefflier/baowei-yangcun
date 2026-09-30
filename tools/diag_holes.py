"""Report primitives whose subpaths have mixed winding (which render as holes).

usage: python tools/diag_holes.py bdl [frame]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def subpaths(d):
    """Split an SVG path string into subpaths of point lists."""
    out = [[]]
    i = 0
    toks = d.replace('M', ' M ').replace('L', ' L ').replace('Q', ' Q ').replace('Z', ' Z ').split()
    while i < len(toks):
        t = toks[i]
        if t == 'M':
            if out[-1]:
                out.append([])
            out[-1].append((float(toks[i + 1]), float(toks[i + 2])))
            i += 3
        elif t == 'L':
            out[-1].append((float(toks[i + 1]), float(toks[i + 2])))
            i += 3
        elif t == 'Q':
            out[-1].append((float(toks[i + 3]), float(toks[i + 4])))
            i += 5
        elif t == 'Z':
            i += 1
        else:
            i += 1
    return [s for s in out if len(s) > 2]


def area(poly):
    a = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        a += x0 * y1 - x1 * y0
    return a / 2


def main():
    wid = sys.argv[1] if len(sys.argv) > 1 else 'bdl'
    frame = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    d = Doc(os.path.join(ROOT, 'tdsheep_swf', 'monster', wid + '.swf'))
    chooser = [sid for sid, s in d.sprites.items()
               if s['nframes'] == 4 and {'d', 'l', 'u', 'r'} <= set(s['labels'])][0]
    cid = [o['id'] for o in d.sprites[chooser]['frames'][0] if o.get('id')][0]
    fl = d.flat(cid, frame)
    mixed = 0
    for i, p in enumerate(fl['p']):
        if not p.get('f'):
            continue
        sp = subpaths(p['d'])
        if len(sp) < 2:
            continue
        areas = [area(s) for s in sp]
        if min(areas) < 0 < max(areas):
            mixed += 1
            print('prim %2d fill=%s subs=%d areas=%s' %
                  (i, p['f']['c'] if p['f']['k'] == 'solid' else p['f']['k'],
                   len(sp), ['%.0f' % a for a in areas]))
    print('%s frame %d: %d prims, %d with mixed winding' % (wid, frame, len(fl['p']), mixed))


if __name__ == '__main__':
    main()
