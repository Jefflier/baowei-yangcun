"""把 tools/_video/_wcrops/match.json 汇总成「每只狼 vs B站实拍」的逐只核对表。

输入：
  tools/_video/_wcrops/index.json   抠图清单（来自 tools/video_wolf_grab.py）
  tools/_video/_wcrops/match.json   每张抠图的模型排名（来自 tools/wolf_video_match.py）
输出：
  tools/_video/_report/species.json     每只狼的实拍证据（哪一分P、分数、朝向）
  tools/_video/_report/sheet_NN.png     逐只核对图（左：我们的模型；右：视频里抠出来的）
  tools/wolf_video_check.html           给人在浏览器里翻的核对台

用法：python tools/wolf_video_report.py [--min-score 0.78] [--per-species 6]
"""
import argparse, json, os, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wolf_coverage import alias_of          # noqa: E402  保持与 js 端同一套别名规则
from wolf_video_match import PART_MAP, load_maps   # noqa: E402

VIDEO = os.path.join(ROOT, 'tools', '_video')
CROPS = os.path.join(VIDEO, '_wcrops')
REPORT = os.path.join(VIDEO, '_report')
WOLF_DIR = os.path.join(ROOT, 'assets', 'wolf')
CELL = 96
FONT = 'C:/Windows/Fonts/msyh.ttc'
FONTB = 'C:/Windows/Fonts/msyhbd.ttc'


def sheets():
    return {f[:-4] for f in os.listdir(WOLF_DIR)
            if f.endswith('.png') and not f.endswith('_dead.png')}


def model_of(wid, avail):
    if wid in avail:
        return wid, False
    for c in alias_of(wid):
        if c in avail:
            return c, True
    return None, False


def model_cell(mid, frame=2, dir_index=0):
    """从 assets/wolf/<mid>.png 里取一帧，切成方形贴图。"""
    im = Image.open(os.path.join(WOLF_DIR, mid + '.png')).convert('RGBA')
    return im.crop((frame * CELL, dir_index * CELL, (frame + 1) * CELL,
                    (dir_index + 1) * CELL))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--min-score', type=float, default=0.78)
    ap.add_argument('--per-species', type=int, default=6)
    ap.add_argument('--rows-per-sheet', type=int, default=34)
    args = ap.parse_args()

    maps, wolfdefs = load_maps()
    avail = sheets()
    idx = {r['file']: r for r in json.load(open(os.path.join(CROPS, 'index.json'), encoding='utf-8'))}
    match = json.load(open(os.path.join(CROPS, 'match.json'), encoding='utf-8'))

    ev = {}          # 狼 id -> [记录]
    offroster = []   # 花名册对不上、但榜外狼分数很高的（引狼 / 随机 BOSS / 认错）
    for rec in match:
        if not rec['rank']:
            continue
        top = rec['rank'][0]
        roster = rec['roster']
        onlist = [r for r in rec['rank'] if r['onRoster']]
        pick = onlist[0] if onlist else None
        if pick is None or (top['score'] - pick['score'] > 0.06 and not top['onRoster']
                            and top['score'] > args.min_score):
            if top['score'] >= args.min_score:
                offroster.append({'file': rec['file'], 'part': rec['part'],
                                  'map': rec['map'], 'mapName': rec['mapName'],
                                  'id': top['id'], 'score': top['score']})
            continue
        if pick['score'] < args.min_score:
            continue
        ev.setdefault(pick['id'], []).append({
            'file': rec['file'], 'part': rec['part'], 'map': rec['map'],
            'mapName': rec['mapName'], 'score': pick['score'],
            'dir': pick['dir'], 'frame': pick['frame'],
        })

    order = sorted(ev, key=lambda w: (-len(ev[w]), w))
    os.makedirs(REPORT, exist_ok=True)
    out = {}
    for wid in order:
        rows = sorted(ev[wid], key=lambda r: -r['score'])[:args.per_species]
        mid, aliased = model_of(wid, avail)
        out[wid] = {'name': wolfdefs[wid]['n'], 'model': mid, 'aliased': aliased,
                    'n': len(ev[wid]), 'shots': rows}
    json.dump({'species': out, 'offroster': offroster,
               'maps': {str(k): v for k, v in maps.items()}},
              open(os.path.join(REPORT, 'species.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('有实拍证据的狼 %d 只；榜外命中 %d 条' % (len(out), len(offroster)))
    print('没在视频里找到实拍的狼：%s'
          % '、'.join(sorted(w for w in wolfdefs if w not in out)))

    # ---- 拼逐只核对图 ----
    f_name = ImageFont.truetype(FONT, 15)
    f_small = ImageFont.truetype(FONT, 12)
    f_head = ImageFont.truetype(FONTB, 20)
    cellw, cellh = CELL, CELL + 22
    shot_cols = args.per_species
    rows_per = args.rows_per_sheet
    pages = [order[i:i + rows_per] for i in range(0, len(order), rows_per)]
    for pi, page in enumerate(pages):
        W = 2 * cellw + 250 + shot_cols * cellw
        H = 34 + len(page) * cellh
        sheet = Image.new('RGB', (W, H), (26, 34, 24))
        d = ImageDraw.Draw(sheet)
        d.text((8, 6), '逐只核对 · 第 %d/%d 页（左两格＝我们的模型 assets/wolf，右 %d 格＝B站实拍抠图）'
               % (pi + 1, len(pages), shot_cols), font=f_head, fill=(230, 240, 210))
        for ri, wid in enumerate(page):
            y = 34 + ri * cellh
            name = wolfdefs[wid]['n']
            mid = out[wid]['model']
            d.rectangle([0, y, W, y + cellh - 1], fill=(38, 48, 34) if ri % 2 else (32, 42, 30))
            d.text((8, y + 6), wid, font=f_name, fill=(240, 240, 220))
            d.text((8, y + 26), name, font=f_name, fill=(255, 226, 140))
            tag = ('模型 %s（借用）' % mid) if out[wid]['aliased'] else ('模型 %s' % mid)
            d.text((8, y + 46), tag if mid else '⚠ 没有原作模型', font=f_small,
                   fill=(210, 210, 190) if mid else (255, 120, 120))
            d.text((8, y + 64), '实拍 %d 处' % out[wid]['n'], font=f_small, fill=(180, 200, 170))
            x = 250
            if mid:
                sheet.paste(model_cell(mid, 2, 0), (x, y), model_cell(mid, 2, 0))
                sheet.paste(model_cell(mid, 2, 3), (x + CELL, y), model_cell(mid, 2, 3))
                d.text((x + 2, y + CELL + 2), 'd/正面', font=f_small, fill=(200, 210, 190))
                d.text((x + CELL + 2, y + CELL + 2), 'r/侧面', font=f_small, fill=(200, 210, 190))
            x += 2 * CELL
            for ci, s in enumerate(out[wid]['shots']):
                c = Image.open(os.path.join(CROPS, s['file'])).convert('RGB')
                sheet.paste(c, (x + ci * CELL, y))
                d.text((x + ci * CELL + 2, y + CELL + 2),
                       'p%02d %s %.2f' % (s['part'], s['mapName'], s['score']),
                       font=f_small, fill=(190, 210, 180))
        sheet.save(os.path.join(REPORT, 'sheet_%02d.png' % pi))
        print('sheet_%02d.png %d 只' % (pi, len(page)))


if __name__ == '__main__':
    main()
