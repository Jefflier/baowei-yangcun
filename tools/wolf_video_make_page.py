"""把「狼 vs B站实拍」的核对结果拼成一个可以翻的网页。

输入（都是前几个脚本的产物）：
  tools/_video/_wcrops/index.json / match.json   抠图与自动比对
  tools/_video/_report/species.json              逐只汇总
  tools/_video/_report/parts_*.png               按分P的核对卡片
  tools/_video/_report/sheet_*.png               按狼种的「模型 vs 实拍」对照
输出：
  tools/wolf_video_check.html

用法：python tools/wolf_video_cards.py && python tools/wolf_video_report.py && python tools/wolf_video_make_page.py
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wolf_video_match import PART_MAP, load_maps      # noqa: E402
from wolf_coverage import alias_of                     # noqa: E402

VIDEO = os.path.join(ROOT, 'tools', '_video')
REPORT = os.path.join(VIDEO, '_report')
WOLF_DIR = os.path.join(ROOT, 'assets', 'wolf')
OUT = os.path.join(ROOT, 'tools', 'wolf_video_check.html')


def rel(p):
    return os.path.relpath(p, os.path.dirname(OUT)).replace('\\', '/')


def main():
    maps, wolfdefs = load_maps()
    avail = {f[:-4] for f in os.listdir(WOLF_DIR)
             if f.endswith('.png') and not f.endswith('_dead.png')}
    data = json.load(open(os.path.join(REPORT, 'species.json'), encoding='utf-8'))
    species, offroster = data['species'], data['offroster']
    idx = json.load(open(os.path.join(VIDEO, '_wcrops', 'index.json'), encoding='utf-8'))

    covered = sorted({PART_MAP[p] for p in PART_MAP if PART_MAP[p]})
    union = set()
    for m in covered:
        union |= set(maps[m]['ids'])
    missing = []
    for w in sorted(union):
        if w in avail:
            continue
        if not next((c for c in alias_of(w) if c in avail), None):
            missing.append((w, wolfdefs[w]['n'], [m for m in covered if w in maps[m]['ids']]))

    per_part = {}
    for r in idx:
        p = int(r['src'].split('_p')[1].split('_')[0])
        per_part[p] = per_part.get(p, 0) + 1

    rows = []
    for wid, v in sorted(species.items(), key=lambda kv: -kv[1]['n']):
        shots = ', '.join('p%02d %s %.2f' % (s['part'], s['mapName'], s['score'])
                           for s in v['shots'][:3])
        rows.append('<tr><td><b>%s</b></td><td>%s</td><td>%s</td><td>%d</td><td class="s">%s</td></tr>'
                    % (v['name'], wid, (v['model'] or '—') + ('（借用）' if v['aliased'] else ''),
                       v['n'], shots))

    tpl = """<!doctype html><meta charset="utf-8"><title>狼 · 与 B站实拍逐只核对</title>
<style>
 body{margin:0;background:#151a13;color:#dfe8d4;font:14px/1.6 "Microsoft YaHei",sans-serif}
 .wrap{max-width:1980px;margin:0 auto;padding:18px}
 h1{font-size:22px;margin:6px 0 2px} h2{font-size:17px;margin:22px 0 8px;color:#ffe08a}
 .note{color:#9fb08c;font-size:13px;margin:4px 0 14px}
 table{border-collapse:collapse;width:100%;font-size:13px}
 th,td{border:1px solid #2c3626;padding:3px 7px;text-align:left;vertical-align:top}
 th{background:#232c1d;color:#ffe08a} tr:nth-child(even){background:#1b2217}
 .s{color:#a9bd93;font-size:12px}
 img{display:block;max-width:100%;margin:8px 0;border:1px solid #2c3626}
 code{background:#232c1d;padding:1px 4px;border-radius:3px}
 a{color:#9fd0ff}
</style>
<div class="wrap">
<h1>狼模型 · 与 B 站实机视频逐只核对</h1>
<div class="note">底片来自 B 站 <b>BV1CusDeKEN8《童年QQ空间神作保卫羊村全地图通关合集》</b>（45 分P，148 分钟）。
分P 顺序是 UP 主自己的通关顺序，不是关卡号顺序；每 P 右上角飘带写着村名，据此对到本作的 46 张图。</div>

<h2>1. 覆盖情况</h2>
<table>
<tr><th>项</th><th>数字</th><th>说明</th></tr>
<tr><td>视频分P</td><td>45</td><td>45 P 各一张图（p10 是第 10 关沃夫沼泽，上一轮误认成大厅）</td></tr>
<tr><td>视频覆盖的地图</td><td>@nmap@ / 46</td><td>只缺 第20关 苏兰德城（无限进度图）</td></tr>
<tr><td>视频里出现过的狼种</td><td>@nwolf@ / 132</td><td>按各图的狼表取并集</td></tr>
<tr><td>其中有原作模型的</td><td>@nok@ / @nwolf@</td><td>模型来自原站 gameUI/dynamic/&lt;id&gt;.swf</td></tr>
<tr><td>没有原作模型、退回程序化绘制</td><td>@nmiss@</td><td>@miss@</td></tr>
<tr><td>视频里没出现过的狼种</td><td>@nrest@</td><td>@rest@</td></tr>
<tr><td>抠出来的实拍狼</td><td>@ncrop@ 张</td><td>血条定位 + GrabCut 收紧，分布在 @npart@ 个分P</td></tr>
</table>

<h2>2. 逐只对照（左：我们的模型 d/正面、r/侧面；右：视频里抠出来的同一只）</h2>
<div class="note">自动比对只是**建议**（模糊的一帧里两只同族狼本来就难分），最终以肉眼看图为准。
带 <code>*</code> 的是花名册外的候选。</div>
@sheets@

<h2>3. 自动匹配的汇总表</h2>
<div class="note">「实拍处数」＝花名册内匹配分 ≥0.75 的抠图数量；分数越低越可能是认错或帧里被塔挡住。</div>
<table><tr><th>狼</th><th>id</th><th>模型</th><th>实拍处数</th><th>最像的几帧</th></tr>
@rows@
</table>

<h2>4. 按分P 的原始核对卡片</h2>
<div class="note">左边是该关花名册（会出现的狼 + 我们的模型），右边是这一 P 抠出来的实拍。一眼能看出的对不上就在这儿。</div>
@cards@
</div>
"""
    miss_txt = '、'.join('%s（%s，第 %s 关）' % (n, w, ','.join(map(str, ms))) for w, n, ms in missing) or '无'
    rest = sorted(set(wolfdefs) - union)
    rest_txt = '、'.join('%s(%s)' % (wolfdefs[w]['n'], w) for w in rest)
    sheets = '\n'.join('<img src="%s">' % rel(p)
                       for p in sorted(glob.glob(os.path.join(REPORT, 'sheet_*.png'))))
    cards = '\n'.join('<img src="%s">' % rel(p)
                      for p in sorted(glob.glob(os.path.join(REPORT, 'parts_*.png'))))
    html = tpl
    for k, v in (('nmap', len(covered)), ('nwolf', len(union)), ('nok', len(union) - len(missing)),
                 ('nmiss', len(missing)), ('miss', miss_txt), ('nrest', len(rest)),
                 ('rest', rest_txt), ('ncrop', len(idx)), ('npart', len(per_part)),
                 ('sheets', sheets), ('cards', cards), ('rows', '\n'.join(rows))):
        html = html.replace('@%s@' % k, str(v))
    # 让页面上的路径都相对本文件
    open(OUT, 'w', encoding='utf-8').write(html)
    print('->', OUT, len(html), 'bytes')
    if offroster:
        print('榜外命中（引狼/随机BOSS/认错）：%d 条' % len(offroster))


if __name__ == '__main__':
    main()
