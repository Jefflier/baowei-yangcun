"""Render one animation frame twice (even-odd vs non-zero fill rule) side by side.

usage: python tools/fill_test.py <wolf-id> [frame]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', '_preview', 'filltest')


def main():
    wid = sys.argv[1] if len(sys.argv) > 1 else 'bdl'
    frame = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    d = Doc(os.path.join(ROOT, 'tdsheep_swf', 'monster', wid + '.swf'))
    chooser = [sid for sid, s in d.sprites.items()
               if s['nframes'] == 4 and {'d', 'l', 'u', 'r'} <= set(s['labels'])][0]
    cid = [o['id'] for o in d.sprites[chooser]['frames'][0] if o.get('id')][0]
    svg = d.svg(cid, frame)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'a.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg)
    with open(os.path.join(OUT, 'b.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg.replace('fill-rule="evenodd"', 'fill-rule="nonzero"'))
    html = ('<!doctype html><meta charset="utf-8">'
            '<body style="margin:0;background:#3a7d44;display:flex;gap:10px;padding:10px;'
            'font:16px sans-serif;color:#fff">'
            '<div><img src="a.svg" width="320"><div>evenodd</div></div>'
            '<div><img src="b.svg" width="320"><div>nonzero</div></div>'
            '</body>')
    with open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
