"""Fix the wolf sprite sheets in place: knock out the (opaque) white page background and
quantise the palette, without re-running Chrome.

The background is only removed where it is connected to the image border, so white parts
inside the art (eyes, belly, wool) survive.

usage: python tools/key_wolf_bg.py [colors]
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WOLF = os.path.join(ROOT, 'assets', 'wolf')


def border_reachable(mask):
    """Return the subset of `mask` connected to the image border (numpy flood fill)."""
    reach = np.zeros_like(mask)
    reach[0, :] = mask[0, :]
    reach[-1, :] = mask[-1, :]
    reach[:, 0] |= mask[:, 0]
    reach[:, -1] |= mask[:, -1]
    while True:
        grow = reach.copy()
        grow[1:, :] |= reach[:-1, :]
        grow[:-1, :] |= reach[1:, :]
        grow[:, 1:] |= reach[:, :-1]
        grow[:, :-1] |= reach[:, 1:]
        grow &= mask
        if grow.sum() == reach.sum():
            return reach
        reach = grow


def main():
    colors = int(sys.argv[1]) if len(sys.argv) > 1 else 255
    files = sorted(glob.glob(os.path.join(WOLF, '*.png')))
    before = sum(os.path.getsize(f) for f in files)
    keyed = 0
    for f in files:
        im = Image.open(f).convert('RGBA')
        a = np.array(im)
        if a[0, 0, 3] != 0:                       # 还没抠底
            bg = a[0, 0, :3].astype(np.int16)
            diff = np.abs(a[:, :, :3].astype(np.int16) - bg).max(axis=2)
            near = diff <= 14
            reach = border_reachable(near)
            a[reach, 3] = 0
            keyed += 1
        out = Image.fromarray(a, 'RGBA').quantize(colors=colors, method=Image.FASTOCTREE)
        out.save(f, optimize=True)
    after = sum(os.path.getsize(f) for f in files)
    print('keyed %d/%d sheets; total %.1f MB -> %.1f MB'
          % (keyed, len(files), before / 1048576, after / 1048576))


if __name__ == '__main__':
    main()
