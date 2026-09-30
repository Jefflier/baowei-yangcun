"""Build a labelled contact sheet from a folder of images (for quick visual review).

usage: python tools/montage.py in_dir out.png [cols] [cell]
"""
import os
import sys

from PIL import Image, ImageDraw


def main():
    indir, out = sys.argv[1], sys.argv[2]
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
    cell = int(sys.argv[4]) if len(sys.argv) > 4 else 220
    files = sorted(f for f in os.listdir(indir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')))
    if not files:
        print('no images')
        return
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * (cell + 14)), (232, 220, 184))
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(files):
        try:
            im = Image.open(os.path.join(indir, name)).convert('RGBA')
        except Exception:  # noqa: BLE001
            continue
        im.thumbnail((cell - 8, cell - 8))
        bg = Image.new('RGBA', (cell - 8, cell - 8), (255, 255, 255, 255))
        bg.paste(im, ((bg.width - im.width) // 2, (bg.height - im.height) // 2), im)
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        sheet.paste(bg.convert('RGB'), (x + 4, y + 4))
        draw.text((x + 6, y + cell - 6), name[:34], fill=(20, 20, 20))
    sheet.save(out)
    print('wrote %s  (%d images, %s)' % (out, len(files), sheet.size))


if __name__ == '__main__':
    main()
