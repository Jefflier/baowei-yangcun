"""Export the map scenery sheets (gameUI/dynamic/m*.swf) and build a gallery.

usage: python tools/dump_maps.py
"""
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', '_preview', 'maps')


def main():
    os.makedirs(OUT, exist_ok=True)
    bases = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'tdsheep_swf', 'monster', 'm*.swf'))):
        base = os.path.splitext(os.path.basename(f))[0]
        if not base[1:].isdigit():
            continue
        d = Doc(f)
        cid = max(d.sym)
        svg = d.svg(cid, 0, pad=0)
        if not svg:
            continue
        with open(os.path.join(OUT, base + '_full.svg'), 'w', encoding='utf-8') as fh:
            fh.write(svg)
        bases.append(base)
    html = ['<!doctype html><meta charset="utf-8"><body style="margin:0;background:#e8dcb8;'
            'font:12px sans-serif;display:flex;flex-wrap:wrap;gap:8px;padding:8px">']
    for base in bases:
        html.append('<div style="background:#fff;padding:4px;text-align:center">'
                    '<img src="%s_full.svg" style="width:340px"><div>%s</div></div>' % (base, base))
    html.append('</body>')
    with open(os.path.join(OUT, 'index2.html'), 'w', encoding='utf-8') as fh:
        fh.write(''.join(html))
    print('maps:', ' '.join(bases))


if __name__ == '__main__':
    main()
