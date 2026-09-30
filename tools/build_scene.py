"""Rasterise the original lobby / world-map scenery into assets/scene/*.png.

Two sources:
  * gameUI_dynamic_TheWorld.swf      -> TheWorld_fun_0..3 (the 4 continent parchment maps)
  * gameUI_dynamic_TheStronghold.swf -> TheStronghold   (the sheep village hub)

For every world map we also locate the yellow "level flag" markers so the game can place its
level nodes exactly where the original art has them.

usage: python tools/build_scene.py [--force]
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWF = os.path.join(ROOT, 'tdsheep_swf')
OUT = os.path.join(ROOT, 'assets', 'scene')
WORK = os.path.join(ROOT, 'tools', '_preview', 'scene')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

JOBS = [
    ('world1', 'gameUI_dynamic_TheWorld.swf', 'TheWorld_fun_0'),
    ('world2', 'gameUI_dynamic_TheWorld.swf', 'TheWorld_fun_1'),
    ('world3', 'gameUI_dynamic_TheWorld.swf', 'TheWorld_fun_2'),
    ('world4', 'gameUI_dynamic_TheWorld.swf', 'TheWorld_fun_3'),
    ('village', 'gameUI_dynamic_TheStronghold.swf', 'TheStronghold'),
]


def svg_size(path):
    head = open(path, encoding='utf-8').read(600)
    w = float(re.search(r'width="([\d.]+)"', head).group(1))
    h = float(re.search(r'height="([\d.]+)"', head).group(1))
    return int(round(w)), int(round(h))


def render(svg, png, w, h):
    profile = os.path.join(os.environ.get('TEMP', '/tmp'), 'scene_' + os.path.basename(png))
    cmd = [CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--in-process-gpu',
           '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1',
           '--default-background-color=00000000', '--virtual-time-budget=30000',
           '--user-data-dir=' + profile, '--window-size=%d,%d' % (w, h),
           '--screenshot=' + png, 'file:///' + svg.replace('\\', '/')]
    subprocess.run(cmd, capture_output=True, check=False)


def flag_positions(im):
    """Centroids of the yellow level-flag markers, in canonical SVG coordinates.

    The flags are drawn black-on-yellow, so the giveaway colour is a saturated yellow that
    nothing else on the parchment uses. Connected components of that mask give the markers.
    """
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    mask = (al > 200) & (r > 215) & (g > 175) & (g < 235) & (b < 90)
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            xs = ys = n = 0
            minx = maxx = x0
            miny = maxy = y0
            while stack:
                y, x = stack.pop()
                xs += x
                ys += y
                n += 1
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            if n < 90 or (maxx - minx) < 8 or (maxy - miny) < 8:
                continue
            out.append([xs / n, ys / n])
    out.sort(key=lambda p: (round(p[1] / 60), p[0]))
    # 按行分组后蛇形排序（一行正序、下一行倒序）：关卡 1..N 连起来不会来回横跳
    bands = []
    for p in out:
        band = round(p[1] / 60)
        if not bands or bands[-1][0] != band:
            bands.append((band, []))
        bands[-1][1].append(p)
    snake = []
    for i, (_, row) in enumerate(bands):
        snake.extend(row if i % 2 == 0 else list(reversed(row)))
    return snake


def main():
    force = '--force' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    flags_all = {}
    for key, swf, symbol in JOBS:
        png = os.path.join(OUT, key + '.png')
        svg_path = os.path.join(WORK, key + '.svg')
        d = Doc(os.path.join(SWF, swf))
        cid = None
        for c, name in d.sym.items():
            if name == symbol:
                cid = c
        if cid is None:
            print('%-8s MISSING symbol %s' % (key, symbol))
            continue
        svg = d.svg(cid, 0, pad=0)
        with open(svg_path, 'w', encoding='utf-8') as fh:
            fh.write(svg)
        w, h = svg_size(svg_path)
        if force or not os.path.exists(png):
            render(svg_path, png, w, h)
        im = Image.open(png).convert('RGBA')
        if im.size != (w, h):
            full = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            full.paste(im, (0, 0))
            im = full
        notes = ''
        if key.startswith('world'):
            flags = flag_positions(im)
            flags_all[key] = [[round(x, 1), round(y, 1)] for x, y in flags]
            with open(os.path.join(OUT, key + '.json'), 'w', encoding='utf-8') as fh:
                json.dump({'art': [im.width, im.height],
                           'flags': [[round(x, 1), round(y, 1)] for x, y in flags]}, fh)
            notes = ' flags=%d' % len(flags)
        im.save(png, optimize=True)
        print('%-8s %4dx%-4d %5d KB%s' % (key, im.width, im.height,
                                          os.path.getsize(png) // 1024, notes))
    # 关卡旗标坐标写成 JS（file:// 下 XHR/fetch 拿不到本地 JSON，只能靠 <script>）
    if flags_all:
        lines = ['/* 原作世界地图上的关卡旗标坐标（CSS 像素，相对 assets/scene/worldN.png）。',
                 ' * 由 tools/build_scene.py 从 gameUI_dynamic_TheWorld.swf 自动标定，已按行蛇形排序。',
                 ' * 每个第 N 章对应 worldN（旗标数量 = 该章关卡数）。 */',
                 'window.SVA_SCENE_FLAGS = {']
        for key, flags in sorted(flags_all.items()):
            ch = key[len('world'):]
            lines.append('  %s: [%s],' % (ch, ', '.join('[%g, %g]' % (x, y) for x, y in flags)))
        lines.append('};')
        with open(os.path.join(OUT, 'flags.js'), 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(lines) + '\n')
        print('flags.js: ' + ' '.join('%s=%d' % (k, len(v)) for k, v in sorted(flags_all.items())))


if __name__ == '__main__':
    main()
