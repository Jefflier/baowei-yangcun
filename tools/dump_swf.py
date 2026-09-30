"""Dump every named symbol of a SWF to SVG plus an HTML gallery (inventory pass).

usage: python tools/dump_swf.py gameUI_material.swf [out_dir] [--frames N] [--min-bytes N]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    swf = sys.argv[1]
    if not swf.endswith('.swf'):
        swf += '.swf'
    path = swf if os.path.isabs(swf) else os.path.join(ROOT, 'tdsheep_swf', swf)
    name = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(ROOT, 'tools', '_preview', 'dump_' + name)
    for i, a in enumerate(sys.argv):
        if a == '--out':
            out = sys.argv[i + 1]
    frames = int(sys.argv[sys.argv.index('--frames') + 1]) if '--frames' in sys.argv else 1
    os.makedirs(out, exist_ok=True)

    d = Doc(path)
    tiles, skipped = [], 0
    for cid, sym in sorted(d.sym.items()):
        n = d.nframes(cid)
        for fr in range(min(n, frames)):
            svg = d.svg(cid, fr)
            if not svg or len(svg) < 400:
                skipped += 1
                continue
            fn = '%s%s.svg' % (sym.replace('.', '_'), '' if n == 1 else '_f%02d' % fr)
            with open(os.path.join(out, fn), 'w', encoding='utf-8') as fh:
                fh.write(svg)
            tiles.append((fn, sym, fr, n, len(svg)))

    html = ['<!doctype html><meta charset="utf-8"><body style="margin:0;background:#e8dcb8;'
            'font:11px sans-serif;display:flex;flex-wrap:wrap;gap:6px;padding:8px">']
    for fn, sym, fr, n, sz in tiles:
        html.append('<div style="background:#fff;padding:4px;text-align:center;width:150px">'
                    '<img src="%s" style="max-width:142px;max-height:142px"><br>%s%s</div>'
                    % (fn, sym, '' if n == 1 else ' f%d' % fr))
    html.append('</body>')
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(''.join(html))
    print('%s: %d tiles (skipped %d empty), -> %s' % (name, len(tiles), skipped, out))


if __name__ == '__main__':
    main()
