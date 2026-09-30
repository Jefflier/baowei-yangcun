"""从 B 站实机视频抽帧里把狼抠出来 —— 用「狼头顶那根绿色血条」当锚点。

原作每只狼头顶都挂一根亮绿血条（绿底 + 深色描边），颜色比树叶/草地更纯、更饱和，
所以先按颜色找血条，再按血条的位置推出狼的包围盒。产物是等大的正方形小图，
交给 tools/wolf_video_match.py 跟 assets/wolf/*.png 做近邻匹配。

用法：
    python tools/video_wolf_grab.py                 # 扫 tools/_video/ref_all + ref_open
    python tools/video_wolf_grab.py --limit 8       # 只看前 8 张帧（调试）
    python tools/video_wolf_grab.py --sheet         # 顺手拼一张总览图
"""
import argparse, glob, json, os

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO = os.path.join(ROOT, 'tools', '_video')


def bar_mask(a):
    """血条掩膜（a: HxWx3 int16 RGB）。

    实测血条是很**纯**的绿（R≈28 G≈197 B≈26），树叶虽然也绿但红/蓝分量高得多
    （R≈231 G≈207 B≈140），所以把「红蓝分量必须很低」卡死就能把树剔掉。
    """
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (g >= 158) & (g - r >= 88) & (g - b >= 88) & (r < 92) & (b < 92)


def find_bars(path):
    """返回 (image, [(cx, y_bottom, w, h), ...])"""
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    H, W = a.shape[:2]
    m = bar_mask(a)
    # 排除界面：顶部标题条、底部按钮面板、右下角狼卡、右上角小地图
    m[:int(H * 0.055), :] = False
    m[int(H * 0.745):, :] = False
    m[:, int(W * 0.855):] = False
    lab, n = ndimage.label(m, structure=np.ones((3, 3), int))
    boxes = []
    for sl in ndimage.find_objects(lab):
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        if not (16 <= w <= 95 and 2 <= h <= 10):
            continue
        if w < 3.2 * h:
            continue
        if m[sl].mean() < 0.5:
            continue
        boxes.append([xs.start, ys.start, xs.stop, ys.stop])
    # 同一根血条有时会被描边切成两段：把 x 相邻、y 重叠的合成一根
    boxes.sort(key=lambda b: (b[1], b[0]))
    merged = []
    for b in boxes:
        hit = None
        for o in merged:
            if b[0] - o[2] <= 4 and b[2] - o[0] >= -4 and not (b[3] <= o[1] or b[1] >= o[3]):
                hit = o
                break
        if hit:
            hit[0] = min(hit[0], b[0]); hit[1] = min(hit[1], b[1])
            hit[2] = max(hit[2], b[2]); hit[3] = max(hit[3], b[3])
        else:
            merged.append(list(b))
    out = []
    for x0, y0, x1, y1 in merged:
        w = x1 - x0
        if w < 16:
            continue
        out.append(((x0 + x1) / 2.0, y1, float(w), float(y1 - y0)))
    return im, out


def crop_of(im, cx, ybot, bw, bh, size=96):
    """按血条推狼的包围盒：先用血条定位一个宽松的搜索框，再用 GrabCut 把狼抠出来，
    按抠出的连通域重新收紧成正方形（这样狼的大小/位置都被归一化，
    抠出来的图可以直接跟 assets/wolf 的 96px 单元格比）。
    """
    side = max(bw * 2.6, 64.0)
    top = ybot - bh - 0.35 * bw
    box = (int(round(cx - side / 2)), int(round(top)),
           int(round(cx + side / 2)), int(round(top + side)))
    W, H = im.size
    pad = Image.new('RGB', (box[2] - box[0], box[3] - box[1]), (106, 143, 58))
    sx0, sy0 = max(0, box[0]), max(0, box[1])
    sx1, sy1 = min(W, box[2]), min(H, box[3])
    if sx1 > sx0 and sy1 > sy0:
        pad.paste(im.crop((sx0, sy0, sx1, sy1)), (sx0 - box[0], sy0 - box[1]))
    rgb = np.asarray(pad)
    h, w = rgb.shape[:2]
    m = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    m[:max(2, int(bh + 0.25 * bw)), :] = cv2.GC_BGD          # 血条那一带
    m[-max(2, int(0.06 * h)):, :] = cv2.GC_BGD               # 下边常是邻居的头顶
    # 狼头就在血条正下方，种一小块确定前景
    hy = int(bh + 0.28 * bw)
    hh = max(6, int(0.42 * bw))
    hw = max(6, int(0.45 * bw))
    cx0, cy0 = int(w / 2 - hw / 2), max(0, hy)
    m[cy0:cy0 + hh, cx0:cx0 + hw] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), m, None, bgd, fgd, 3,
                    cv2.GC_INIT_WITH_MASK)
        fg = ((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)).astype(np.uint8)
    except cv2.error:
        fg = np.zeros((h, w), np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        k = 1 + int(np.argmax(stats[1:, 4]))
        x, y, bw2, bh2 = stats[k, 0], stats[k, 1], stats[k, 2], stats[k, 3]
        # 抠出来的那一块（必须是狼，不能太小）
        if bw2 * bh2 > 0.02 * w * h:
            s = max(bw2, bh2) * 1.25
            ccx, ccy = x + bw2 / 2.0, y + bh2 / 2.0
            # 这里的坐标还是「pad」局部系，要加回 box 左上角才是原图坐标
            box2 = (box[0] + int(round(ccx - s / 2)), box[1] + int(round(ccy - s / 2)),
                    box[0] + int(round(ccx + s / 2)), box[1] + int(round(ccy + s / 2)))
            pad2 = Image.new('RGB', (box2[2] - box2[0], box2[3] - box2[1]), (106, 143, 58))
            ax0, ay0 = max(0, box2[0]), max(0, box2[1])
            ax1, ay1 = min(W, box2[2]), min(H, box2[3])
            if ax1 > ax0 and ay1 > ay0:
                pad2.paste(im.crop((ax0, ay0, ax1, ay1)), (ax0 - box2[0], ay0 - box2[1]))
            return pad2.resize((size, size), Image.LANCZOS)
    return pad.resize((size, size), Image.LANCZOS)


def parts_of(path):
    base = os.path.basename(path)
    p = base.split('_')[0]
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--glob', default='ref_all/*.png,ref_open/*.png')
    ap.add_argument('--out', default=os.path.join(VIDEO, '_wcrops'))
    ap.add_argument('--size', type=int, default=112)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--sheet-out', default=os.path.join(VIDEO, '_wcrops_sheet.png'))
    args = ap.parse_args()

    files = []
    for pat in args.glob.split(','):
        files += sorted(glob.glob(os.path.join(VIDEO, pat)))
    if args.limit:
        files = files[:args.limit]

    os.makedirs(args.out, exist_ok=True)
    index, thumbs = [], []
    for path in files:
        rel = os.path.relpath(path, VIDEO).replace('\\', '/')
        im, bars = find_bars(path)
        for i, (cx, ybot, bw, bh) in enumerate(bars):
            crop = crop_of(im, cx, ybot, bw, bh, args.size)
            name = '%s__%02d.png' % (os.path.splitext(rel.replace('/', '_'))[0], i)
            crop.save(os.path.join(args.out, name))
            arr = np.asarray(crop).astype(np.float32)
            index.append({'file': name, 'src': rel, 'x': cx, 'y': ybot, 'bw': bw,
                          'mean': [round(float(v), 1) for v in arr.reshape(-1, 3).mean(0)]})
            thumbs.append((rel, crop))
    with open(os.path.join(args.out, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print('frames=%d crops=%d' % (len(files), len(index)))

    if args.sheet and thumbs:
        cell, cols = args.size, 16
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cell, rows * (cell + 14)), (24, 32, 20))
        d = ImageDraw.Draw(sheet)
        for k, (rel, crop) in enumerate(thumbs):
            x, y = (k % cols) * cell, (k // cols) * (cell + 14)
            sheet.paste(crop, (x, y))
            d.text((x + 2, y + cell + 1), rel.split('/')[-1][:22], fill=(200, 230, 180))
        sheet.save(args.sheet_out)
        print('sheet ->', args.sheet_out)


if __name__ == '__main__':
    main()
