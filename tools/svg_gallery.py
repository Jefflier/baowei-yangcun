"""Render one frame of several wolves to SVG and build a gallery page (for eyeballing).

usage: python tools/svg_gallery.py bdl hudunl zblw ...   [--frame 0] [--dir 0] [--out dir]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    frame = int(sys.argv[sys.argv.index('--frame') + 1]) if '--frame' in sys.argv else 0
    dsel = int(sys.argv[sys.argv.index('--dir') + 1]) if '--dir' in sys.argv else 0
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else \
        os.path.join(ROOT, 'tools', '_preview', 'multi')
    os.makedirs(out, exist_ok=True)
    tiles = []
    for wid in args:
        path = os.path.join(ROOT, 'tdsheep_swf', 'monster', wid + '.swf')
        if not os.path.exists(path):
            print('skip', wid)
            continue
        d = Doc(path)
        chooser = [sid for sid, s in d.sprites.items()
                   if s['nframes'] == 4 and {'d', 'l', 'u', 'r'} <= set(s['labels'])]
        if not chooser:
            print('no chooser', wid)
            continue
        kids = [o['id'] for o in d.sprites[chooser[0]]['frames'][dsel] if o.get('id')]
        svg = d.svg(kids[-1], frame)
        if not svg:
            continue
        with open(os.path.join(out, wid + '.svg'), 'w', encoding='utf-8') as fh:
            fh.write(svg)
        tiles.append(wid)
    html = ('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#3a7d44;'
            'display:flex;flex-wrap:wrap;gap:6px;padding:6px;font:14px sans-serif;color:#fff">')
    for wid in tiles:
        html += '<div><img src="%s.svg" width="210"><div>%s</div></div>' % (wid, wid)
    html += '</body>'
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('wrote %d tiles to %s' % (len(tiles), out))


if __name__ == '__main__':
    main()
