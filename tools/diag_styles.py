"""Dump the parsed fill/line style tables and the run structure of a shape.

usage: python tools/diag_styles.py bdl [shapeId]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    wid = sys.argv[1] if len(sys.argv) > 1 else 'bdl'
    d = Doc(os.path.join(ROOT, 'tdsheep_swf', 'monster', wid + '.swf'))
    want = int(sys.argv[2]) if len(sys.argv) > 2 else None
    for sid, sh in sorted(d.shapes.items()):
        if want and sid != want:
            continue
        lines = [(i + 1, ls['c'] if ls else None, ls['w'] if ls else None, ls.get('t') if ls else None)
                 for i, ls in enumerate(sh['lines'])]
        fills = [(i + 1, fs.get('t'), fs.get('c')) for i, fs in enumerate(sh['fills'])]
        interesting = any(c and tuple(c[:3]) == (0, 255, 0) for _i, c, _w, _t in lines) or \
                      any(c and tuple(c[:3]) == (0, 255, 0) for _i, _t, c in fills)
        if not interesting and not want:
            continue
        print('shape %s  nfill=%s nline=%s  runs=%d' % (sid, getattr(sh, 'get', lambda k, d=None: None)('nfill'),
                                                        sh.get('nline'), len(sh.get('runs', []))))
        print('  lines:', lines)
        print('  fills:', fills)
        for j, run in enumerate(sh.get('runs', [])):
            print('   run %2d f0=%s f1=%s ln=%s fbase=%s lbase=%s cmds=%d' %
                  (j, run.get('f0'), run.get('f1'), run.get('ln'), run.get('fbase'),
                   run.get('lbase'), len(run.get('cmds', []))))


if __name__ == '__main__':
    main()
