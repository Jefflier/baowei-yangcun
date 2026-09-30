"""Quantise the generated wolf sprite sheets (palette + alpha) to shrink them ~5x.

usage: python tools/optimize_wolf_png.py [colors]
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WOLF = os.path.join(ROOT, 'assets', 'wolf')


def main():
    colors = int(sys.argv[1]) if len(sys.argv) > 1 else 255
    files = sorted(glob.glob(os.path.join(WOLF, '*.png')))
    before = sum(os.path.getsize(f) for f in files)
    for f in files:
        im = Image.open(f).convert('RGBA')
        im.quantize(colors=colors, method=Image.FASTOCTREE).save(f, optimize=True)
    after = sum(os.path.getsize(f) for f in files)
    print('optimised %d files: %.1f MB -> %.1f MB (%.0f%%)'
          % (len(files), before / 1048576, after / 1048576, 100 * after / max(before, 1)))


if __name__ == '__main__':
    main()
