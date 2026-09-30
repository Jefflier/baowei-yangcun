"""把视频抠图按「分P / 关卡」拼成核对卡片，方便逐只肉眼过一遍。

每张卡片：
  · 标题：pNN 地图名（第几关）
  · 左：该关花名册（js/data.js 里会出的狼）+ 我们的模型小图
  · 右：这一分P 抠出来的狼（同一只重复出现的先按颜色/剪影去重）
  · 每格下面挂一行自动比对的建议（tools/wolf_video_match.py 的 top1），只当参考

用法：python tools/wolf_video_cards.py [--per-part 28]
"""
import argparse, json, os, re, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wolf_coverage import alias_of                      # noqa: E402
from wolf_video_match import PART_MAP, load_maps        # noqa: E402

VIDEO = os.path.join(ROOT, 'tools', '_video')
CROPS = os.path.join(VIDEO, '_wcrops')
REPORT = os.path.join(VIDEO, '_report')
WOLF_DIR = os.path.join(ROOT, 'assets', 'wolf')
CELL = 96
FONT = 'C:/Windows/Fonts/msyh.ttc'
FONTB = 'C:/Windows/Fonts/msyhbd.ttc'


def model_of(wid, avail):
    if wid in avail:
        return wid, False
    for c in alias_of(wid):
        if c in avail:
            return c, True
    return None, False


def thumb(mid, px=72, dir_index=0, frame=2):
    im = Image.open(os.path.join(WOLF_DIR, mid + '.png')).convert('RGBA')
    cell = im.crop((frame * CELL, dir_index * CELL, (frame + 1) * CELL, (dir_index + 1) * CELL))
    return cell.resize((px, px), Image.LANCZOS)


def sig(path):
    a = np.asarray(Image.open(os.path.join(CROPS, path)).convert('RGB')
                   .resize((16, 16), Image.LANCZOS)).astype(np.float32)
    c = a[4:14, 3:13]
    h = np.histogramdd(c.reshape(-1, 3), bins=(4, 4, 4), range=((0, 256),) * 3)[0].ravel()
    h = h / max(1.0, h.sum())
    return h


def dedupe(files, scores, thresh=0.93):
    """同色同形的重复帧留一张（分数高的优先）。"""
    keep = []
    sigs = [sig(f) for f in files]
    for i, f in enumerate(files):
        dup = False
        for j in keep:
            inter = float(np.minimum(sigs[i], sigs[j]).sum())
            if inter > thresh:
                dup = True
                break
        if not dup:
            keep.append(i)
    return keep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--per-part', type=int, default=24)
    ap.add_argument('--sheet-h', type=int, default=1560)
    args = ap.parse_args()

    maps, wolfdefs = load_maps()
    avail = {f[:-4] for f in os.listdir(WOLF_DIR)
             if f.endswith('.png') and not f.endswith('_dead.png')}
    match = {r['file']: r for r in json.load(open(os.path.join(CROPS, 'match.json'), encoding='utf-8'))}
    files = [r['file'] for r in json.load(open(os.path.join(CROPS, 'index.json'), encoding='utf-8'))]

    by_part = {}
    for f in files:
        m = re.search(r'_(p\d+)_t(\d+)', f)
        if not m:
            continue
        by_part.setdefault(int(m.group(1)[1:]), []).append((int(m.group(2)), f))

    f_t = ImageFont.truetype(FONTB, 19)
    f_n = ImageFont.truetype(FONT, 13)
    f_s = ImageFont.truetype(FONT, 11)
    os.makedirs(REPORT, exist_ok=True)

    cards = []
    summary = []
    for part in sorted(by_part):
        rows = sorted(by_part[part])
        mid_map = PART_MAP.get(part, 0)
        if not mid_map:
            continue
        mp = maps[mid_map]
        roster = mp['ids']
        # 按帧顺序排（同一只狼在不同帧会重复，去重后保留分数最高的那张）
        order = sorted(rows, key=lambda t: (-(match.get(t[1], {}).get('rank') or [{'score': 0}])[0]['score'],))
        picked = dedupe([f for _t, f in order], None, 0.93)[:args.per_part]
        shots = [order[i][1] for i in picked]
        summary.append((part, mid_map, mp['name'], len(rows), len(shots), roster))

        per_row = max(1, min(args.per_part, (1900 - 300) // CELL))
        grid_rows = max(1, (len(shots) + per_row - 1) // per_row)
        roster_h = max(1, (len(roster) + 3) // 4) * 92
        card_h = 30 + max(roster_h, grid_rows * (CELL + 16) + 16)
        card = Image.new('RGB', (1900, card_h), (30, 40, 28))
        d = ImageDraw.Draw(card)
        d.rectangle([0, 0, 1900, 26], fill=(58, 74, 44))
        d.text((8, 3), 'p%02d  %s（第 %d 关）  实拍抠图 %d 张 → 去重 %d 张'
               % (part, mp['name'], mid_map, len(rows), len(shots)), font=f_t, fill=(240, 245, 225))
        # 左：花名册
        x0, y0 = 6, 32
        for i, wid in enumerate(roster):
            cx = x0 + (i % 4) * 72
            cy = y0 + (i // 4) * 92
            mid, al = model_of(wid, avail)
            if mid:
                card.paste(thumb(mid, 60), (cx, cy + 2), thumb(mid, 60))
            else:
                d.rectangle([cx, cy + 2, cx + 60, cy + 62], outline=(200, 60, 60))
                d.text((cx + 4, cy + 28), '缺', font=f_n, fill=(255, 120, 120))
            d.text((cx, cy + 64), wid[:9], font=f_s, fill=(225, 235, 210))
            d.text((cx, cy + 76), wolfdefs[wid]['n'][:6], font=f_s, fill=(255, 220, 130))
        # 右：实拍
        x0 = 300
        for i, f in enumerate(shots):
            cx = x0 + (i % per_row) * CELL
            cy = y0 + (i // per_row) * (CELL + 16)
            card.paste(Image.open(os.path.join(CROPS, f)).convert('RGB'), (cx, cy))
            rk = (match.get(f, {}).get('rank') or [])
            lab = ('%s %.2f%s' % (rk[0]['id'], rk[0]['score'], '' if rk[0]['onRoster'] else '*')
                   if rk else '—')
            d.rectangle([cx, cy + CELL, cx + CELL, cy + CELL + 14], fill=(20, 26, 18))
            d.text((cx + 1, cy + CELL + 1), lab, font=f_s, fill=(170, 200, 160))
        cards.append(card)

    # 按高度装箱成若干张 sheet
    sheets, cur, h = [], [], 0
    for c in cards:
        if h + c.size[1] > args.sheet_h and cur:
            sheets.append(cur); cur, h = [], 0
        cur.append(c); h += c.size[1] + 4
    if cur:
        sheets.append(cur)
    for si, group in enumerate(sheets):
        W = max(c.size[0] for c in group)
        H = sum(c.size[1] + 4 for c in group)
        sh = Image.new('RGB', (W, H), (18, 24, 16))
        y = 0
        for c in group:
            sh.paste(c, (0, y)); y += c.size[1] + 4
        sh.save(os.path.join(REPORT, 'parts_%02d.png' % si))
    print('cards=%d sheets=%d' % (len(cards), len(sheets)))
    for part, mid_map, name, n, k, roster in summary:
        print('p%02d 第%-2d关 %-6s 抠图%3d 去重%3d  花名册 %d 只' % (part, mid_map, name, n, k, len(roster)))


if __name__ == '__main__':
    main()
