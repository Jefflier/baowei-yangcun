# -*- coding: utf-8 -*-
"""把 tdsheep_swf/extra/ 里抓到的原站静态图拼成一张带标签的图册，方便一眼看全。

用法：python tools/extra_sheet.py [输出路径]
默认输出 tools/_preview/extra_sheet.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tdsheep_swf', 'extra')
EXTS = ('.png', '.jpg', '.jpeg', '.gif')
CELL = 220
COLS = 6
PAD = 8
LABEL = 16
BG = (24, 26, 30)
FG = (230, 232, 236)
WARN = (255, 170, 60)
FONT_CANDIDATES = [
    r'C:\Windows\Fonts\msyh.ttc',
    r'C:\Windows\Fonts\simhei.ttf',
    r'C:\Windows\Fonts\simsun.ttc',
]


def font(size=13):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:                                  # noqa: BLE001
                pass
    return ImageFont.load_default()


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        ROOT, 'tools', '_preview', 'extra_sheet.png')
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(EXTS))
    rows = (len(files) + COLS - 1) // COLS
    w = COLS * (CELL + PAD) + PAD
    h = rows * (CELL + LABEL + PAD) + PAD
    sheet = Image.new('RGB', (w, h), BG)
    d = ImageDraw.Draw(sheet)
    fnt = font()
    for i, name in enumerate(files):
        c, r = i % COLS, i // COLS
        x = PAD + c * (CELL + PAD)
        y = PAD + r * (CELL + LABEL + PAD)
        try:
            im = Image.open(os.path.join(SRC, name)).convert('RGBA')
        except Exception as e:                                 # noqa: BLE001
            d.text((x, y), '%s 读取失败 %s' % (name, e), fill=WARN, font=fnt)
            continue
        im.thumbnail((CELL, CELL), Image.LANCZOS)
        box = Image.new('RGB', (CELL, CELL), (46, 48, 54))
        bx = ImageDraw.Draw(box)
        for gy in range(0, CELL, 12):
            for gx in range(0, CELL, 12):
                if (gx // 12 + gy // 12) % 2:
                    bx.rectangle([gx, gy, gx + 11, gy + 11], fill=(56, 58, 64))
        box.paste(im, ((CELL - im.width) // 2, (CELL - im.height) // 2), im)
        sheet.paste(box, (x, y))
        d.text((x + 2, y + CELL + 2),
               '%s  %dx%d' % (name, im.width, im.height), fill=FG, font=fnt)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    print('图册 %d 张 -> %s (%dx%d)' % (len(files), out, w, h))


if __name__ == '__main__':
    main()
