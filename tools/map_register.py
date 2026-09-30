"""Per-level registration of the original battle map art  ->  assets/map/register.js

The original client lays every level out on a grid of **65 x 50** art pixels (not square!, see docs/ART_PIPELINE.md §9.4)
and bakes the sheep village, the wolf spawn platform, trees and rocks into a big background picture (gameUI/dynamic/m*.swf).
To draw a level faithfully we only need to know: *which art*, and *where the top-left corner of the grid sits in that art*.

How the table below was made (all of it checked by eye against the B-site recording, see tools/map_match_frames.py):
  1. SIFT-match every recorded frame against every art  ->  which art each part of the video shows and the similarity
     transform art -> frame (tools/_work/frame_art.json).  Frames showing a "loading" spinner can belong to the *next*
     level, so an assignment only counts when the towers/walls in the same frame also sit on the grid (step 3).
  2. Origin guess: the baked village (or gate / igloo / farm) must lie under the level's goal cells, and the spawn
     platform under its spawn cells; sanity-checked with a ground-colour IoU fit.
  3. Overlay the grid on the video frame through the SIFT transform (tools/_work/reg_frame.py) and check that the
     player's walls/towers land in cells and goal/spawn land on the baked village/platform.

usage:  python tools/map_register.py          # writes assets/map/register.js (+ mfx1/mfx2 png if missing)
"""
import json
import os
import shutil

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_DIR = os.path.join(ROOT, 'assets', 'map')

# level (1-based, as in data.js order)  ->  (art id, grid top-left x, y in art pixels, note)
REG = {
    1:  ('m1',   116, 220, '巴罗村   verified on p01'),
    2:  ('m2',   330,  70, '比丘村   verified on p02'),
    5:  ('m3',   180,  98, '安蒂亚村 fenced yurt village bbox centre = goal 3x3 centre'),
    6:  ('m5',   187, 140, '菲洛克村 p07: m5 + a canyon the game draws itself (cols 6-7); the statue platform baked into m5 belongs to level 8 -> patched out',
          [{'rect': [335, 280, 400, 290], 'fill': '#dca336'}]),
    8:  ('m5',   122, 190, '艾伊尔村 p08'),
    9:  ('m6',   262,  80, '拉帕斯村 p09 (two farms = two goals)'),
    12: ('m7',   219, 193, '埃特纳村 p12 (hut = goal 3x3, rock platform = spawns)'),
    19: ('m10',  233, 199, '塔特村   the three ice holes = the three type-6 tower slots (2,8)(3,11)(5,10)'),
    31: ('m15',  110, 266, '斯贝斯镇 the six red-X crates = the six 爆炸箱 cells (2/5/8, 4/10)  [exact]'),
    33: ('m16',  109, 269, '泰勒斯镇 the black grates = the 有洞的钢网桥 cells  [exact]'),
    38: ('mfx2', 222, 235, '防线     p42 (goal = gap between the two horned gates)'),
    40: ('m17',  181, 150, '远古冰川 the two plank bridges = the 桥 cells (2,6-8)(11,9-11)  [exact]'),
    43: ('m6',   262,  80, '楼兰城   p39 (same layout as level 9)'),
    45: ('m11', None, None, '凌绽雪原 p41 shows a m11-like art but the layout does not line up: art only, no registration'),
}


def edge_colour(im):
    """Colour to fill beyond the art: median of opaque pixels in the outer band."""
    a = np.array(im.convert('RGBA'))
    h, w = a.shape[:2]
    m = np.zeros((h, w), bool)
    b = max(6, int(min(h, w) * 0.05))
    m[:b, :] = m[-b:, :] = True
    m[:, :b] = m[:, -b:] = True
    px = a[m & (a[:, :, 3] > 200)][:, :3]
    if not len(px):
        return '#2a3a1a'
    c = np.median(px, axis=0).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def ensure_mfx():
    for mid in ('mfx1', 'mfx2'):
        dst = os.path.join(MAP_DIR, mid + '.png')
        src = os.path.join(ROOT, 'tools', '_work', mid + '_raw.png')
        if not os.path.exists(dst) and os.path.exists(src):
            im = Image.open(src).convert('RGBA')
            im.quantize(colors=255, method=Image.FASTOCTREE).save(dst, optimize=True)
            print('built', dst, os.path.getsize(dst) // 1024, 'KB')


def main():
    ensure_mfx()
    edges = {}
    sizes = {}
    out = ['/* 原作战斗底图逐关标定（tools/map_register.py 生成，勿手改）。',
           ' * 键 = 关卡序号（0 起，与 data.js 的 maps 下标一致）；art = assets/map/<art>.png；',
           ' * x,y = 棋盘（65×50 长方形格）左上角在原图里的像素位置；edge = 图外填充色。 */',
           'window.SVA_MAP_REG = {']
    for lv in sorted(REG):
        art, x, y, note = REG[lv][:4]
        patch = REG[lv][4] if len(REG[lv]) > 4 else None
        p = os.path.join(MAP_DIR, art + '.png')
        if not os.path.exists(p):
            print('!! missing art', art, 'for level', lv)
            continue
        if art not in edges:
            edges[art] = edge_colour(Image.open(p))
        extra = (', patch: ' + json.dumps(patch)) if patch else ''
        if art not in sizes:
            im = Image.open(p).convert('RGBA')
            al = np.array(im)[:, :, 3] > 200
            # usable art = rows/columns that are mostly opaque (the stage colour around the art was cut out, and a few
            # stray slivers remain at the edges, so a plain bounding box would be too generous)
            cc, rc = al.sum(axis=0), al.sum(axis=1)
            xs = np.where(cc > 0.25 * cc.max())[0]
            ys = np.where(rc > 0.25 * rc.max())[0]
            sizes[art] = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        bx0, by0, bx1, by1 = sizes[art]
        if x is None:
            out.append("  %d: {art: '%s'},   // L%d %s" % (lv - 1, art, lv, note))
            continue
        out.append("  %d: {art: '%s', x: %d, y: %d, bx: %d, by: %d, bx1: %d, by1: %d, edge: '%s'%s},   // L%d %s" % (lv - 1, art, x, y, bx0, by0, bx1, by1, edges[art], extra, lv, note))
    out.append('};')
    with open(os.path.join(MAP_DIR, 'register.js'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out) + '\n')
    print('wrote register.js with %d levels' % len(REG))


if __name__ == '__main__':
    main()
