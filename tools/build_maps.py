"""Rasterise the original map backgrounds (gameUI/dynamic/m*.swf) into assets/map/*.png.

Two clean-ups on top of the raw SWF render:

1. **抠掉舞台底色.** 每个地块符号外面都衬着一圈统一色的「舞台底」（m1 是淡灰绿、m15 是灰…），
   它在棋盘外会露出一条难看的边，所以从画面四周泛洪把这块同色的底整片设成透明。
2. **标定场地.** 从中央区域取众数色，找这块颜色最大的连通域当作「场地」，取它的外接矩形。
   运行时按这个矩形把原画缩放到棋盘大小，于是原画自带的树石环正好落在棋盘外面一圈。

场地矩形写成 assets/map/fields.js（file:// 下拿不到本地 JSON，只能靠 <script>），
同时输出 tools/_preview/maps_field.png 便于肉眼核对；个别图不准可以在 FIELD_FIX 里手改。

usage: python tools/build_maps.py [--force]
"""
import glob
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', '_preview', 'maps')
OUT = os.path.join(ROOT, 'assets', 'map')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

# 自动标定不理想时在这里手工指定 [x, y, w, h]（原图像素）。
# 三张雪原/火山图的原画里场地是「好几块互不相连的台地」，自动找最大连通域会只圈到其中一块，
# 于是装饰物会跑进棋盘里，这里按原画手工圈出主台地。
FIELD_FIX = {
    'm7':  [115, 115, 1090, 870],     # 火山：岩浆只在外圈，中间整块是场地
    'm10': [375, 195, 510, 590],      # 雪原：中间那块大台地
    'm11': [470, 180, 650, 630],      # 冰原：中右那块大台地
}


def strip_stage(png, tol=26):
    """把贴着画面外沿的一整片同色「舞台底」变透明，返回新的 RGBA 图。"""
    im = Image.open(png).convert('RGBA')
    a = np.array(im).astype(np.int16)
    h, w = a.shape[:2]
    alpha = a[:, :, 3]
    edge = np.zeros((h, w), dtype=bool)
    edge[0:3, :] = edge[-3:, :] = True
    edge[:, 0:3] = edge[:, -3:] = True
    cand = a[:, :, :3][edge & (alpha >= 200)]
    if len(cand) < 20:
        return im, 0
    bg = np.median(cand, axis=0)
    close = (alpha >= 200) & (np.abs(a[:, :, :3] - bg).max(axis=2) <= tol)
    # 从四边泛洪，只吃与边缘相连的那一片
    keep = np.zeros((h, w), dtype=bool)
    stack = [(y, x) for y in (0, 1, 2, h - 3, h - 2, h - 1) for x in range(w)] + \
            [(y, x) for x in (0, 1, 2, w - 3, w - 2, w - 1) for y in range(h)]
    for y, x in stack:
        keep[y, x] = close[y, x]
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not keep[ny, nx]:
                keep[ny, nx] = True
                stack.append((ny, nx))
    a[:, :, 3] = np.where(keep, 0, alpha)
    return Image.fromarray(a.astype(np.uint8)), int(keep.sum())


def field_bbox(im, scale=4):
    """场地外接矩形：中央众数色里最大的那块连通域。"""
    w0, h0 = im.size
    w, h = max(8, w0 // scale), max(8, h0 // scale)
    small = np.array(im.resize((w, h), Image.NEAREST)).astype(np.int16)
    m = 0.1
    box = small[int(h * m):int(h * (1 - m)), int(w * m):int(w * (1 - m))]
    opaque = box[:, :, 3] > 128
    if opaque.sum() < 10:
        return [0, 0, w0, h0]
    cols, counts = np.unique(box[:, :, :3][opaque].reshape(-1, 3), axis=0, return_counts=True)
    med = cols[counts.argmax()].astype(np.int16)
    mask = (np.abs(small[:, :, :3] - med).max(axis=2) <= 30) & (small[:, :, 3] > 128)

    seen = np.zeros_like(mask)
    best = None
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            n = 0
            minx = maxx = x0
            miny = maxy = y0
            while stack:
                y, x = stack.pop()
                n += 1
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if best is None or n > best[0]:
                best = (n, minx, miny, maxx, maxy)
    if not best or best[0] < (w * h) * 0.03:
        return [0, 0, w0, h0]
    _, x0, y0, x1, y1 = best
    return [x0 * scale, y0 * scale, (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale]


def svg_size(path):
    head = open(path, encoding='utf-8').read(600)
    w = float(re.search(r'width="([\d.]+)"', head).group(1))
    h = float(re.search(r'height="([\d.]+)"', head).group(1))
    return int(w), int(h)


def field_color(im, rect):
    """场地矩形内的代表色，用来给棋盘瓦片上色（本作的方块才和原画接得上）。"""
    x, y, w, h = rect
    m = 0.25
    box = np.array(im.convert('RGBA'))[y + int(h * m):y + int(h * (1 - m)),
                                       x + int(w * m):x + int(w * (1 - m))]
    px = box[:, :, :3][box[:, :, 3] > 200].reshape(-1, 3)
    if not len(px):
        return '#efdc8f'
    cols, counts = np.unique(px, axis=0, return_counts=True)
    c = cols[counts.argmax()]
    return '#%02x%02x%02x' % (c[0], c[1], c[2])


def main():
    force = '--force' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    fields = {}
    for svg in sorted(glob.glob(os.path.join(SRC, '*_full.svg'))):
        mid = os.path.basename(svg).split('_')[0]
        png = os.path.join(OUT, mid + '.png')
        w, h = svg_size(svg)
        if force or not os.path.exists(png):
            cmd = [CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--in-process-gpu',
                   '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1',
                   '--default-background-color=00000000', '--virtual-time-budget=30000',
                   '--user-data-dir=' + os.path.join(os.environ.get('TEMP', '/tmp'), 'mapbuild'),
                   '--window-size=%d,%d' % (w, h), '--screenshot=' + png,
                   'file:///' + svg.replace('\\', '/')]
            subprocess.run(cmd, capture_output=True, check=False)
        if not os.path.exists(png):
            print('%-4s FAILED' % mid)
            continue
        im = Image.open(png).convert('RGBA')
        if im.size != (w, h):
            print('%-4s size %s (wanted %dx%d)' % (mid, im.size, w, h))
            continue
        raw = im.copy()
        im, cut = strip_stage(png)
        opaque = int((np.array(raw)[:, :, 3] > 200).sum())
        if opaque and cut > opaque * 0.33:      # 边缘色其实就是画面本身（沙滩/雪原），别抠
            im, cut = raw, 0
        field = field_bbox(im)
        if mid in FIELD_FIX:
            field = FIELD_FIX[mid]
        color = field_color(im, field)
        im.quantize(colors=255, method=Image.FASTOCTREE).save(png, optimize=True)
        fields[mid] = {'rect': field, 'color': color}
        manifest[mid] = {'art': [im.width, im.height], 'field': field,
                         'kb': round(os.path.getsize(png) / 1024)}
        print('%-4s %4dx%-4d field %-24s cut %6dpx %4d KB'
              % (mid, im.width, im.height, field, cut, manifest[mid]['kb']))
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=1)
    if fields:
        lines = ['/* 原作地图底图上「场地」的外接矩形（原图像素坐标）与场地代表色，',
                 ' * tools/build_maps.py 标定。渲染时把这块矩形缩放到棋盘，',
                 ' * 原画自带的树石环就正好落在棋盘外面，瓦片也用场地的颜色。 */',
                 'window.SVA_MAP_FIELDS = {']
        for mid in sorted(fields, key=lambda s: (len(s), s)):
            r = fields[mid]['rect']
            lines.append("  %s: {rect: [%s], color: '%s'},"
                         % (mid, ', '.join(str(v) for v in r), fields[mid]['color']))
        lines.append('};')
        with open(os.path.join(OUT, 'fields.js'), 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(lines) + '\n')
        sheet(fields)
    print('total %.1f MB' % (sum(v['kb'] for v in manifest.values()) / 1024))


def sheet(fields, cell=300):
    """把每张底图和标定出来的场地框拼成一张对照图，方便肉眼核对。"""
    from PIL import ImageDraw
    mids = sorted(fields, key=lambda s: (len(s), s))
    cols = 4
    rows = (len(mids) + cols - 1) // cols
    cv = Image.new('RGB', (cols * cell, rows * (cell + 18)), (232, 220, 184))
    dr = ImageDraw.Draw(cv)
    for k, mid in enumerate(mids):
        full = Image.open(os.path.join(OUT, mid + '.png')).convert('RGBA')
        im = full
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg.convert('RGB')
        im.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
        x = (k % cols) * cell + (cell - im.width) // 2
        y = (k // cols) * (cell + 18) + (cell - im.height) // 2
        cv.paste(im, (x, y))
        sx = im.width / full.width
        sy = im.height / full.height
        fx, fy, fw, fh = fields[mid]['rect']
        dr.rectangle([x + fx * sx, y + fy * sy, x + (fx + fw) * sx, y + (fy + fh) * sy],
                     outline=(255, 0, 0), width=3)
        dr.text((k % cols * cell + 6, (k // cols) * (cell + 18) + cell + 2), mid, fill=(0, 0, 0))
    cv.save(os.path.join(ROOT, 'tools', '_preview', 'maps_field.png'))
    print('sheet -> tools/_preview/maps_field.png')


if __name__ == '__main__':
    main()
