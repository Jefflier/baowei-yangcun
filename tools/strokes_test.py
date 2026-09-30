"""Render only the strokes of one wolf frame (to inspect suspicious line styles).

usage: python tools/strokes_test.py bdl [frame]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc


def esc(t):
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    wid = sys.argv[1] if len(sys.argv) > 1 else 'bdl'
    frame = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    d = Doc(os.path.join(ROOT, 'tdsheep_swf', 'monster', wid + '.swf'))
    chooser = [sid for sid, s in d.sprites.items()
               if s['nframes'] == 4 and {'d', 'l', 'u', 'r'} <= set(s['labels'])][0]
    cid = [o['id'] for o in d.sprites[chooser]['frames'][0] if o.get('id')][0]
    fl = d.flat(cid, frame)
    vb = fl['vb']
    body = []
    for p in fl['p']:
        if not p.get('s'):
            continue
        c = p['s']['c']
        green = tuple(c[:3]) == (0, 255, 0)
        col = '#00ff00' if green else '#888888'
        w = p['s']['w'] * (3 if green else 1)
        body.append('<path d="%s" transform="matrix(%s)" fill="none" stroke="%s" stroke-width="%.2f"/>'
                    % (esc(p['d']), ' '.join('%.4f' % v for v in p['t']), col, w))
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="%s %s %s %s">'
           '<rect x="%s" y="%s" width="%s" height="%s" fill="#ffffff"/>%s</svg>'
           % (int(vb[2] * 3), int(vb[3] * 3), vb[0], vb[1], vb[2], vb[3],
              vb[0], vb[1], vb[2], vb[3], ''.join(body)))
    out = os.path.join(ROOT, 'tools', '_preview')
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'strokes_%s.svg' % wid), 'w', encoding='utf-8') as fh:
        fh.write(svg)
    print('wrote strokes_%s.svg (green = pure #00ff00 line styles, thickened 3x)' % wid)


if __name__ == '__main__':
    main()
