"""Print an ASCII silhouette + key colour shares of a sprite crop (for hand-modelling).

usage: python tools/silhouette.py crop.png [cols]
"""
import sys

from PIL import Image


def main():
    path = sys.argv[1]
    cols = int(sys.argv[2]) if len(sys.argv) > 2 else 46
    im = Image.open(path).convert('RGB')
    w, h = im.size
    rows = max(6, int(cols * h / w * 0.5))
    px = im.load()

    def lum(p):
        return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

    dark, mid, light, white = 0, 0, 0, 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            l = lum(p)
            if l < 70:
                dark += 1
            elif l < 130:
                mid += 1
            elif l < 190:
                light += 1
            else:
                white += 1
    total = w * h
    print('size %dx%d   dark %.0f%%  mid %.0f%%  light %.0f%%  bright %.0f%%'
          % (w, h, 100 * dark / total, 100 * mid / total, 100 * light / total, 100 * white / total))

    # 背景是暖色（黄绿），狼是冷色（蓝灰）——用冷暖差做掩码
    mask_rows = []
    for ry in range(rows):
        line = ''
        for rx in range(cols):
            x0, x1 = int(rx * w / cols), int((rx + 1) * w / cols)
            y0, y1 = int(ry * h / rows), int((ry + 1) * h / rows)
            n = cold = 0
            for y in range(y0, y1, max(1, (y1 - y0) // 4)):
                for x in range(x0, x1, max(1, (x1 - x0) // 4)):
                    p = px[x, y]
                    n += 1
                    if p[2] >= p[0] + 6:          # 蓝 >= 红 → 狼
                        cold += 1
            f = cold / max(1, n)
            line += '#' if f > 0.7 else ('+' if f > 0.4 else ('.' if f > 0.15 else ' '))
        mask_rows.append(line)
    print('\n'.join(mask_rows))

    # 各冷色像素的平均色，帮助取调色板
    acc, n = [0, 0, 0], 0
    buckets = {'深': [], '中': [], '浅': []}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[2] >= p[0] + 6:
                l = lum(p)
                key = '深' if l < 75 else ('中' if l < 120 else '浅')
                buckets[key].append(p)
    for k, v in buckets.items():
        if v:
            r = sum(c[0] for c in v) // len(v)
            g = sum(c[1] for c in v) // len(v)
            b = sum(c[2] for c in v) // len(v)
            print('%s色 %5d px  rgb(%d,%d,%d)  #%02x%02x%02x' % (k, len(v), r, g, b, r, g, b))


if __name__ == '__main__':
    main()
