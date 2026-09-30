"""Crop a region of an image and upscale it (nearest/ bicubic) for close-up review.

usage: python tools/crop_zoom.py in.png out.png x y w h [scale]
"""
import sys

from PIL import Image


def main():
    src, dst = sys.argv[1], sys.argv[2]
    x, y, w, h = (int(v) for v in sys.argv[3:7])
    scale = float(sys.argv[7]) if len(sys.argv) > 7 else 4.0
    im = Image.open(src).convert('RGB').crop((x, y, x + w, y + h))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(dst)
    print('wrote %s %s' % (dst, im.size))


if __name__ == '__main__':
    main()
