# -*- coding: utf-8 -*-
"""从录制的帧序列按时间抽帧拼联系表。用法: python sheet.py rec_dir t0 t1 step out.png [cols] [w]"""
import sys, json, bisect
from PIL import Image, ImageDraw
rec, t0, t1, step, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
cols = int(sys.argv[6]) if len(sys.argv) > 6 else 4
W = int(sys.argv[7]) if len(sys.argv) > 7 else 480
H = W * 9 // 16
m = json.load(open(rec + '/meta.json'))
ts = m['frames']; base = ts[0]
times = []
t = t0
while t <= t1 + 1e-6:
    times.append(t); t += step
rows = (len(times) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, H * rows), (20, 20, 20))
for k, t in enumerate(times):
    i = max(0, min(len(ts) - 1, bisect.bisect_right([x - base for x in ts], t) - 1))
    im = Image.open(f'{rec}/frames/f{i:06d}.jpg').convert('RGB').resize((W, H), Image.LANCZOS)
    ImageDraw.Draw(im).rectangle((0, 0, 78, 16), fill=(0, 0, 0))
    ImageDraw.Draw(im).text((4, 2), f't={t:.1f}s', fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * W, (k // cols) * H))
sheet.save(out)
print('saved', out, len(times), 'frames')
