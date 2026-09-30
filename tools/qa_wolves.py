"""Sanity-check the built wolf sheets: transparent corners, sensible coverage, right size.

usage: python tools/qa_wolves.py [--sheet out.png]
"""
import glob
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WOLF = os.path.join(ROOT, 'assets', 'wolf')


def main():
    man = json.load(open(os.path.join(WOLF, 'manifest.json'), encoding='utf-8'))
    cell = man['cell']
    bad, total = [], 0
    for wid in sorted(man['wolves']):
        p = os.path.join(WOLF, '%s.png' % wid)
        if not os.path.exists(p):
            bad.append((wid, 'missing'))
            continue
        im = Image.open(p).convert('RGBA')
        w = man['wolves'][wid]
        if im.size != (w['cols'] * cell, 4 * cell):
            bad.append((wid, 'size %s' % (im.size,)))
            continue
        if im.getpixel((0, 0))[3] != 0:
            bad.append((wid, 'opaque corner'))
            continue
        alpha = im.getchannel('A')
        opaque = sum(1 for v in alpha.getdata() if v > 8) / (im.width * im.height)
        if not (0.04 < opaque < 0.75):
            bad.append((wid, 'coverage %.2f' % opaque))
        total += 1
    print('checked %d wolves, %d suspicious' % (total, len(bad)))
    for wid, why in bad[:20]:
        print('  %-14s %s' % (wid, why))

    if '--sheet' in sys.argv:
        out = sys.argv[sys.argv.index('--sheet') + 1]
        ids = sorted(man['wolves'])[:24]
        cols, rows = 6, 4
        sheet = Image.new('RGBA', (cols * cell * 2, rows * cell * 2), (92, 158, 92, 255))
        for i, wid in enumerate(ids):
            im = Image.open(os.path.join(WOLF, '%s.png' % wid)).convert('RGBA')
            frame = im.crop((8 * cell, 0, 9 * cell, cell)).resize((cell * 2, cell * 2), Image.LANCZOS)
            sheet.alpha_composite(frame, ((i % cols) * cell * 2, (i // cols) * cell * 2))
        sheet.convert('RGB').save(out)
        print('wrote', out)


if __name__ == '__main__':
    main()
