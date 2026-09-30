"""把视频里抠出来的狼（tools/_video/_wcrops）跟 assets/wolf/*.png 的模型逐一比对。

候选集来自**关卡花名册**：视频第 N P 是玩家自己的一周目顺序（不是关卡号顺序），
每 P 的地图名写在右上角那条飘带上，读出名字就能查到这张图该出哪些狼（js/data.js），
于是每个抠图只要在这 3~12 只里挑，比全库 113 只乱猜准得多。另外再按颜色粗筛 8 只
「榜外狼」一起参选，用来发现引狼/随机 BOSS 这种没写进花名册的情况。

输出 tools/_video/_wcrops/match.json：每个抠图的最佳模型 / 分数 / 朝向 / 帧号；

用法：python tools/wolf_video_match.py [--limit N] [--topk 12]
"""
import argparse, json, os, re, sys, time

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO = os.path.join(ROOT, 'tools', '_video')
WOLF_DIR = os.path.join(ROOT, 'assets', 'wolf')
CELL = 96
DIRS = ['d', 'l', 'u', 'r']

# B 站 BV1CusDeKEN8《全地图通关合集》分P → 关卡号（第 1 关 = 巴罗村）。
# 分P顺序是 UP 主自己的通关顺序，飘带上的村名逐P读出来的。
# （上一轮把 p10 当成「大厅画面」是错的：帧里右上角写着「沃夫沼泽」，就是第 10 关。）
PART_MAP = {
    1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 6, 8: 8, 9: 9, 10: 10, 11: 11,
    12: 12, 13: 16, 14: 17, 15: 18, 16: 13, 17: 14, 18: 15, 19: 19, 20: 25,
    21: 21, 22: 22, 23: 23, 24: 24, 25: 26, 26: 27, 27: 28, 28: 29, 29: 30,
    30: 32, 31: 31, 32: 33, 33: 35, 34: 34, 35: 36, 36: 37, 37: 46, 38: 42,
    39: 43, 40: 44, 41: 45, 42: 38, 43: 39, 44: 41, 45: 40,
}


def load_maps():
    s = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
    j = json.loads(s[s.index('{'):s.rindex('}') + 1])
    maps = {}
    for i, m in enumerate(j['maps']):
        ids = set()
        for _fr, wid in m['w']['prop']:
            ids.add(wid)
        for wid in m['w'].get('boss', []):
            ids.add(wid)
        for e in m['w'].get('rb', []):
            ids.add(e[1])
        for wid in m['w'].get('fb', []):
            ids.add(wid)
        maps[i + 1] = {'name': m['n'], 'ids': sorted(ids)}
    return maps, j['wolves']


def part_of(filename):
    m = re.search(r'_(p\d+)_t\d+', filename)
    return int(m.group(1)[1:]) if m else 0


def load_index_ids():
    s = open(os.path.join(WOLF_DIR, 'index.js'), encoding='utf-8').read()
    return re.findall(r'"([A-Za-z0-9_]+)"', s)


def model_tiles(mid, frames_per_dir=3):
    """→ [(dir, frame, 特征), ...]"""
    path = os.path.join(WOLF_DIR, mid + '.png')
    if not os.path.exists(path):
        return []
    rgba = np.asarray(Image.open(path).convert('RGBA'))
    rows, cols, _ = rgba.shape
    cols //= CELL
    rows //= CELL
    out = []
    for ri in range(min(rows, 4)):
        d = DIRS[ri]
        want = sorted(set([0, cols // 2, cols - 1]) if frames_per_dir == 3 else [0])
        for fr in want:
            cell = rgba[ri * CELL:(ri + 1) * CELL, fr * CELL:(fr + 1) * CELL]
            rgb = cell[:, :, :3].copy()
            a = cell[:, :, 3]
            # 半透明边缘会带上原画外圈的杂色，硬切一下
            mask = (a > 140).astype(np.uint8)
            if mask.sum() < 200:
                continue
            f = feats(rgb, mask)
            if f:
                out.append((d, fr, f))
    return out


def grabcut_mask(rgb):
    """抠出框里的狼（狼在框的中下部，顶部那条是血条，底部常压着下一只狼的头）。"""
    h, w = rgb.shape[:2]
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    mask[:int(h * 0.08), :] = cv2.GC_BGD            # 血条
    mask[int(h * 0.90):, :] = cv2.GC_BGD            # 下面的邻居
    mask[int(h * 0.12):int(h * 0.80), int(w * 0.18):int(w * 0.82)] = cv2.GC_PR_FGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mask, None, bgd, fgd, 2,
                    cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return np.zeros((h, w), np.uint8)
    m = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    # 去掉顶部残余（血条/树）与最底部（邻居）：只保留最大连通域
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n <= 1:
        return m
    k = 1 + int(np.argmax(stats[1:, 4]))
    keep = (lab == k).astype(np.uint8)
    return keep


def shape_grid(mask, n=10):
    g = cv2.resize(mask.astype(np.float32), (n, n), interpolation=cv2.INTER_AREA)
    g = g / max(1e-6, g.max())
    return g


def feats(rgb, mask):
    """前景的颜色直方图 + 剪影网格 + 平均色。"""
    ys, xs = np.nonzero(mask)
    if len(ys) < 120:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub = rgb[y0:y1, x0:x1]
    msk = mask[y0:y1, x0:x1]
    return {
        'hist': color_hist(sub, msk, bins=4),
        'shape': shape_grid(msk).ravel(),
        'mean': sub[msk > 0].mean(0),
        'ar': (x1 - x0) / max(1.0, (y1 - y0)),
        'box': (x0, y0, x1, y1),
    }


def feat_score(a, b):
    hi = float(np.minimum(a['hist'], b['hist']).sum())
    sa, sb = a['shape'] - a['shape'].mean(), b['shape'] - b['shape'].mean()
    d = np.linalg.norm(sa) * np.linalg.norm(sb)
    sc = float((sa * sb).sum() / d) if d > 1e-6 else 0.0
    sc = (sc + 1) / 2
    cm = 1.0 - min(1.0, np.abs(a['mean'] - b['mean']).sum() / 340.0)
    ar = 1.0 - min(1.0, abs(np.log((a['ar'] + 1e-3) / (b['ar'] + 1e-3))) / 0.7)
    return 0.45 * hi + 0.33 * sc + 0.14 * cm + 0.08 * ar


def tile_rgb(mid, frames_per_dir=3):
    """→ [(dir, frame, rgb96, mask96)]，精排（带掩膜的归一化互相关）用。"""
    path = os.path.join(WOLF_DIR, mid + '.png')
    if not os.path.exists(path):
        return []
    rgba = np.asarray(Image.open(path).convert('RGBA'))
    rows = rgba.shape[0] // CELL
    cols = rgba.shape[1] // CELL
    out = []
    for ri in range(min(rows, 4)):
        want = sorted(set([0, cols // 2, cols - 1]) if frames_per_dir == 3 else [0])
        for fr in want:
            cell = rgba[ri * CELL:(ri + 1) * CELL, fr * CELL:(fr + 1) * CELL]
            m = (cell[:, :, 3] > 140).astype(np.uint8)
            if m.sum() < 200:
                continue
            out.append((DIRS[ri], fr, cell[:, :, :3].copy(), m))
    return out


def refine(crop_rgb, mid, frames_per_dir=3, size=96, scales=(0.86, 0.95, 1.05, 1.15),
           shift=3, step=2):
    """带掩膜的零均值归一化互相关（ZNCC）在几个尺度/小位移上搜一遍。

    注意别用 cv2.matchTemplate 的 TM_CCORR_NORMED —— 那个不做去均值，
    亮而"省事"的模板（比如雪狼）对深色狼也能刷出 0.93 的高分，完全没法区分。
    """
    img = cv2.resize(crop_rgb, (size, size), interpolation=cv2.INTER_AREA).astype(np.float32)
    best, bd, bf = -1.0, 'd', 0
    for (d, fr, rgb, m) in tile_rgb(mid, frames_per_dir):
        for s in scales:
            n = int(round(size * s))
            if n < 24 or n > size:
                continue
            src = cv2.resize(rgb, (n, n), interpolation=cv2.INTER_AREA).astype(np.float32)
            msk = cv2.resize(m * 255, (n, n), interpolation=cv2.INTER_NEAREST) > 100
            if msk.sum() < 120:
                continue
            t = src[msk]
            t = (t - t.mean(0)) / (t.std(0) + 1e-6)
            cy, cx = (size - n) // 2, (size - n) // 2
            for dy in range(-shift, shift + 1, step):
                for dx in range(-shift, shift + 1, step):
                    y0, x0 = cy + dy, cx + dx
                    if y0 < 0 or x0 < 0 or y0 + n > size or x0 + n > size:
                        continue
                    v = img[y0:y0 + n, x0:x0 + n][msk]
                    v = (v - v.mean(0)) / (v.std(0) + 1e-6)
                    sc = float((v * t).mean())
                    if sc > best:
                        best, bd, bf = sc, d, fr
    return best, bd, bf


def color_hist(rgb, mask=None, bins=4):
    """4×4×4 的 RGB 直方图（归一化），当粗筛特征用。"""
    v = (rgb.astype(np.float32) / 256.0 * bins).astype(np.int32)
    v = np.clip(v, 0, bins - 1)
    idx = v[..., 0] * bins * bins + v[..., 1] * bins + v[..., 2]
    if mask is not None:
        idx = idx[mask > 0]
    h = np.bincount(idx.ravel(), minlength=bins ** 3).astype(np.float32)
    s = h.sum()
    return h / s if s else h


def prefilter(crop_rgb, model_hists, top=24):
    """按颜色直方图交集粗排，返回前 top 个模型 id。"""
    img = cv2.resize(crop_rgb, (40, 40), interpolation=cv2.INTER_AREA)
    # 狼大致在框的中下部，取中间那块的直方图，别让四周草地/树占满
    c = img[6:38, 4:36]
    h = color_hist(c)
    scored = []
    for mid, hs in model_hists:
        scored.append((float(np.minimum(h, hs).sum()), mid))
    scored.sort(reverse=True)
    return [m for _, m in scored[:top]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(VIDEO, '_wcrops', 'match.json'))
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--topk', type=int, default=12)
    ap.add_argument('--coarse-top', type=int, default=8)
    ap.add_argument('--prefilter', type=int, default=26)
    ap.add_argument('--refine-top', type=int, default=5)
    ap.add_argument('--off-roster', type=int, default=6,
                    help='除花名册外，再按颜色粗筛几只「榜外狼」一起参选')
    args = ap.parse_args()

    maps, wolfdefs = load_maps()
    ids = load_index_ids()
    t0 = time.time()
    tiles = {}
    hists = []
    for mid in ids:
        tiles[mid] = model_tiles(mid)
        tl = tiles[mid]
        if tl:
            # 模型直方图 = 所有朝向/帧的前景像素平均
            acc = []
            for (d, fr, f) in tl:
                acc.append(f['hist'])
            hists.append((mid, np.mean(acc, axis=0)))
    print('models=%d tiles=%d (%.1fs)' % (len(tiles), sum(len(v) for v in tiles.values()), time.time() - t0))

    # 以 index.json 为准（目录里可能还留着上一轮的旧抠图）
    crops = [r['file'] for r in json.load(open(os.path.join(VIDEO, '_wcrops', 'index.json'),
                                               encoding='utf-8'))]
    if args.limit:
        crops = crops[:args.limit]
    out = []
    t0 = time.time()
    for k, name in enumerate(crops):
        crop = np.asarray(Image.open(os.path.join(VIDEO, '_wcrops', name)).convert('RGB'))
        part = part_of(name)
        mid_map = PART_MAP.get(part, 0)
        roster = maps.get(mid_map, {}).get('ids', []) if mid_map else []
        roster_cand = [i for i in roster if i in tiles and tiles[i]]
        extra = prefilter(crop, hists, top=args.prefilter)
        cand = list(dict.fromkeys(roster_cand + extra[:args.prefilter]))
        # 抠图特征（grabcut 只做一次，所有候选共用）
        cmask = grabcut_mask(crop)
        cf = feats(crop, cmask)
        if cf is None:
            out.append({'file': name, 'part': part, 'map': mid_map,
                        'mapName': maps.get(mid_map, {}).get('name', ''),
                        'roster': roster, 'rank': [], 'best': []})
            continue
        scored = {}
        for mid in cand:
            best = max((feat_score(cf, f) for (_d, _fr, f) in tiles[mid]), default=None)
            if best is None:
                continue
            # 顺便记下最像的朝向/帧
            top_tile = max(tiles[mid], key=lambda t: feat_score(cf, t[2]))
            scored[mid] = (best, top_tile[0], top_tile[1])
        # 精排：颜色/剪影挑出的前几名回到像素级再比一遍（带掩膜的归一化互相关）
        pre = sorted(scored.items(), key=lambda kv: -kv[1][0])[:args.refine_top]
        for mid, _ in pre:
            v, d, fr = refine(crop, mid)
            if v > scored[mid][0]:
                scored[mid] = (v, d, fr)
        rank = sorted(scored.items(), key=lambda kv: -kv[1][0])[:args.topk]
        out.append({
            'file': name,
            'part': part,
            'map': mid_map,
            'mapName': maps.get(mid_map, {}).get('name', ''),
            'roster': roster,
            'rank': [{'id': mid, 'score': round(v[0], 4), 'dir': v[1], 'frame': v[2],
                      'onRoster': int(mid in roster)}
                     for mid, v in rank],
        })
        if (k + 1) % 200 == 0:
            print('  %d/%d  %.1fs' % (k + 1, len(crops), time.time() - t0))
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('done %d crops in %.1fs -> %s' % (len(crops), time.time() - t0, args.out))


if __name__ == '__main__':
    main()
