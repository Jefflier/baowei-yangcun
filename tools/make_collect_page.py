# -*- coding: utf-8 -*-
"""生成本轮「原作素材收集」的可视化页面 tools/collect_check.html。

把这几份东西拼到一起：
  tdsheep_swf/extra/           从镜像站补抓的静态图（背景/按钮/分享弹窗素材…）
  tdsheep_swf/gameSound_*.mp3  原作音效与战斗音乐（名字来自客户端 GlobalString 常量表）
  tdsheep_swf/data/*.json      xmlFile_*.xml 解析出来的设定/名称字典
  tdsheep_swf/community/       社区整理的数据（data.js 数值 + 47 张地图布局图）

用法：python tools/make_collect_page.py
"""
import glob
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWF = os.path.join(ROOT, 'tdsheep_swf')
OUT = os.path.join(ROOT, 'tools', 'collect_check.html')


def rel(path):
    return '../' + os.path.relpath(path, ROOT).replace('\\', '/')


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def js_object(path, marker):
    """把 `window.XXX = {...};` 抠成 python dict。"""
    src = open(path, encoding='utf-8').read()
    i = src.index('{', src.index(marker))
    return json.loads(src[i:src.rindex('}') + 1])


# ------------------------------------------------------------------ 数据准备

def audio_rows():
    manifest = load_json(os.path.join(SWF, 'extra', 'mirror_manifest.json'), {})
    src = {os.path.basename(i.get('local', '')): i.get('url', '')
           for i in manifest.get('found', [])}
    rows = []
    for p in sorted(glob.glob(os.path.join(SWF, 'gameSound_*.mp3'))):
        name = os.path.basename(p)[len('gameSound_'):-len('.mp3')]
        rows.append({'name': name, 'path': rel(p),
                     'kb': round(os.path.getsize(p) / 1024, 1),
                     'src': src.get(os.path.basename(p), ''),
                     'kind': 'music' if name.startswith('fight') else 'sfx'})
    return rows


IMG_EXT = ('.png', '.jpg', '.jpeg', '.gif')


def image_rows():
    manifest = load_json(os.path.join(SWF, 'extra', 'mirror_manifest.json'), {})
    url_by_local = {}
    for item in manifest.get('found', []):
        url_by_local[os.path.basename(item.get('local', ''))] = item.get('url', '')
    rows = []
    for f in sorted(os.listdir(os.path.join(SWF, 'extra'))):
        if not f.lower().endswith(IMG_EXT):
            continue
        p = os.path.join(SWF, 'extra', f)
        rows.append({'file': f, 'path': rel(p), 'src': url_by_local.get(f, ''),
                     'kb': round(os.path.getsize(p) / 1024, 1)})
    return rows


def map_rows():
    out = []
    for p in sorted(glob.glob(os.path.join(SWF, 'community', 'maps', '*.png'))):
        m = re.search(r'map_(\d+)', os.path.basename(p))
        out.append({'no': int(m.group(1)) if m else -1,
                    'path': rel(p), 'kb': round(os.path.getsize(p) / 1024)})
    return out


def wolf_codex(names):
    """把 wolfs_* 的扁平列表按「名称行」切成每只狼一块。"""
    cfg = load_json(os.path.join(SWF, 'data', 'config_names.json'), {})
    entries = [(k, v) for k, v in cfg.get('groups', {}).get('wolfs', [])]
    # 原作有些狼名跟本作/社区资料里的写法不一样（困狼↔困囧狼、火・炎・焱↔火•狼焱…），
    # 这些是逐个核对出来的补充名，不然它们会被并进上一只狼的台词里。
    names = set(names) | {
        '困囧狼', '“年兽”', '笨•狼灯', '火•炎•焱', '暴怒狼', '梦幻小精灵',
        '恶魔狼', '圣诞小狼王', '圣诞灰狼', '驯鹿宝宝狼', '圣诞老狼王', '超级年兽',
    }
    blocks, cur = [], None
    for idx, val in entries:
        if val in names:
            cur = {'name': val, 'idx': idx, 'lines': []}
            blocks.append(cur)
        elif cur is not None:
            cur['lines'].append(val)
        else:
            blocks.append({'name': '（开头未归类的条目）', 'idx': idx, 'lines': [val]})
    # 合并相邻的同名同 idx 异常块
    merged = []
    for b in blocks:
        if merged and merged[-1]['name'] == b['name'] and b['name'].startswith('（'):
            merged[-1]['lines'] += b['lines']
        else:
            merged.append(b)
    return merged


def esc(s):
    return html.escape(str(s), quote=True)


# ------------------------------------------------------------------ 页面

CSS = """
body{margin:0;background:#14161a;color:#e6e8ec;font:14px/1.6 "Segoe UI",system-ui,"Microsoft YaHei",sans-serif}
header{padding:22px 26px;background:linear-gradient(120deg,#1d2733,#2a2036);border-bottom:1px solid #333}
h1{margin:0 0 6px;font-size:20px}
header .sub{color:#9aa4b2;font-size:13px}
.cards{display:flex;flex-wrap:wrap;gap:10px;padding:16px 26px}
.card{background:#1c1f26;border:1px solid #2c313a;border-radius:8px;padding:12px 16px;min-width:150px}
.card b{display:block;font-size:22px;color:#ffd166}
.card span{color:#9aa4b2;font-size:12px}
section{padding:8px 26px 26px}
h2{font-size:16px;margin:22px 0 4px;border-left:3px solid #ffd166;padding-left:8px}
h2 small{color:#8b93a1;font-weight:400;font-size:12px;margin-left:8px}
p.note{color:#9aa4b2;font-size:13px;margin:6px 0 12px}
.grid{display:grid;gap:12px}
.grid.audio{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.grid.img{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
.grid.maps{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.item{background:#1c1f26;border:1px solid #2c313a;border-radius:8px;padding:8px}
.item img{width:100%;height:130px;object-fit:contain;background:#0f1114;border-radius:4px}
.item .cap{font-size:12px;color:#a8b0bd;word-break:break-all;margin-top:6px}
.item audio{width:100%;height:32px}
.tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:10px;background:#2b3138;color:#9aa4b2;margin-right:4px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border-bottom:1px solid #262b33;padding:5px 8px;text-align:left;vertical-align:top}
th{color:#9aa4b2;font-weight:500;position:sticky;top:0;background:#1a1d23}
details{background:#1c1f26;border:1px solid #2c313a;border-radius:8px;margin:6px 0;padding:8px 12px}
summary{cursor:pointer}
.scroll{max-height:460px;overflow:auto;border:1px solid #262b33;border-radius:6px}
code{background:#22262e;padding:1px 5px;border-radius:4px;color:#ffd166}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.two{grid-template-columns:1fr}}
"""


def main():
    cfg = load_json(os.path.join(SWF, 'data', 'config_names.json'), {})
    summary = load_json(os.path.join(SWF, 'data', 'summary.json'), {})
    strings = load_json(os.path.join(SWF, 'data', 'strings_cn.json'), {})
    guide = load_json(os.path.join(SWF, 'data', 'guide.json'), [])
    audio = audio_rows()
    images = image_rows()
    maps = map_rows()

    our = js_object(os.path.join(ROOT, 'js', 'data.js'), 'window.SVD')
    comm = js_object(os.path.join(SWF, 'community', 'data.js'), 'window.YC_DATA')
    names = {w.get('n') for w in our['wolves'].values() if w.get('n')}
    names |= {w.get('name') for w in comm.get('wolfs', {}).values() if w.get('name')}
    names.discard(None)
    codex = wolf_codex(names)

    groups = cfg.get('groups', {})
    group_rows = ''.join(
        '<tr><td><code>%s_</code></td><td>%d</td><td>%s</td></tr>'
        % (esc(k), len(v), esc(' / '.join(x[1] for x in v[:3])[:120]))
        for k, v in sorted(groups.items(), key=lambda kv: -len(kv[1])))

    umaps = groups.get('umaps', [])
    dmaps = groups.get('dmaps', [])
    hard = [[k, v] for k, v in groups.get('wolf', []) if k.startswith('hard_ness')]
    building = groups.get('building', [])
    gem = groups.get('gem', [])
    skill = groups.get('skill', [])

    sfx = [a for a in audio if a['kind'] == 'sfx']
    music = [a for a in audio if a['kind'] == 'music']

    def audio_html(rows):
        return ''.join(
            '<div class="item"><div class="cap"><b>%s</b> <span class="tag">%s KB</span>'
            '%s</div>'
            '<audio controls preload="none" src="%s"></audio></div>'
            % (esc(a['name']), a['kb'],
               '<span class="tag">gameSound/%s.mp3</span>' % esc(a['name']),
               esc(a['path'])) for a in rows)

    img_html = ''.join(
        '<div class="item"><img loading="lazy" src="%s" alt="%s">'
        '<div class="cap">%s<br><span class="tag">%s KB</span>%s</div></div>'
        % (esc(i['path']), esc(i['file']), esc(i['file']), i['kb'],
           '<br><span style="color:#6f7887">%s</span>' % esc(i['src']) if i['src'] else '')
        for i in images)

    map_html = ''.join(
        '<div class="item"><img loading="lazy" src="%s" alt="map_%02d">'
        '<div class="cap">map_%02d.png <span class="tag">%s KB</span></div></div>'
        % (esc(m['path']), m['no'], m['no'], m['kb']) for m in maps)

    codex_html = ''.join(
        '<details><summary>%s <span class="tag">wolfs_%s</span> <span class="tag">%d 条</span></summary>%s</details>'
        % (esc(b['name']), esc(b['idx']), len(b['lines']),
           ''.join('<div style="color:#c3cad6;padding:2px 6px">%s</div>' % esc(l)
                   for l in b['lines']) or '<div style="color:#6f7887">（无台词）</div>')
        for b in codex)

    strings_html = ''.join('<tr><td><code>%s</code></td><td>%s</td></tr>' % (esc(k), esc(v))
                           for k, v in list(strings.items())[:400])

    page = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>保卫羊村 · 原作素材收集台</title><style>%s</style></head><body>
<header>
  <h1>保卫羊村 · 原作素材收集台</h1>
  <div class="sub">本轮补抓：镜像站静态图 / <b>原作音效与音乐</b> / 客户端配置解析 / 社区数值与 47 张地图布局 &nbsp;·&nbsp;
  来源见文末</div>
</header>
<div class="cards">
  <div class="card"><b>%d</b><span>原作音频 mp3</span></div>
  <div class="card"><b>%d</b><span>原站静态图</span></div>
  <div class="card"><b>%d</b><span>配置条目（名称/文案）</span></div>
  <div class="card"><b>%d</b><span>界面文案 id</span></div>
  <div class="card"><b>%d</b><span>社区地图布局图</span></div>
  <div class="card"><b>%d</b><span>狼图鉴分块</span></div>
</div>

<section>
<h2>1. 原作音频<small>文件名来自客户端 MainClass.swf 里 GlobalString 类的 SOUND_* / MUSIC_* 常量</small></h2>
<p class="note">镜像站 <code>gameSound/</code> 目录仍在，按常量表逐个探测，命中 %d 个。
这三个名字服务端确实没有：<code>crit</code> / <code>beatBack</code> / <code>button</code>（404）。</p>
<h3 style="font-size:14px;color:#9aa4b2;margin:12px 0 6px">音效 %d</h3>
<div class="grid audio">%s</div>
<h3 style="font-size:14px;color:#9aa4b2;margin:16px 0 6px">战斗音乐 %d</h3>
<div class="grid audio">%s</div>
</section>

<section>
<h2>2. 原站静态图<small>static/images/ 下的背景、标题字、导航条、分享弹窗素材</small></h2>
<p class="note">除 SWF 之外，原站 <code>static/images/</code> 还留着官网用的图片。本轮补了标题字 logo、首次安装宣传图
（<code>first_install.jpg</code>，可直接当标题画面底图）、5 组按钮 gif、底部横条、分享微博弹窗素材等。</p>
<div class="grid img">%s</div>
</section>

<section>
<h2>3. 游戏设定（客户端配置解析）</h2>
<p class="note">原作客户端 <code>xmlFile/*.xml</code> 的解析结果写在 <code>tdsheep_swf/data/</code>。
<b>要注意</b>：镜像站上的 <code>config.xml</code> 是<b>被裁过的</b>（文件头写着 <code>&lt;!--xpath#//@s--&gt;</code>），
只剩 <code>s="文案"</code> 属性，数值属性在镜像端就被剥掉了 —— 所以它是「名称/文案字典」，不是「数值表」。
数值在服务端下发，本站拿不到；社区整理的数值在下一节。</p>
<div class="two">
<div>
<h3 style="font-size:14px;color:#9aa4b2">配置分组（共 %d 条）</h3>
<div class="scroll"><table><thead><tr><th>前缀</th><th>条数</th><th>示例</th></tr></thead>
<tbody>%s</tbody></table></div>
</div>
<div>
<h3 style="font-size:14px;color:#9aa4b2">地图名（umaps_ %d / dmaps_ %d）</h3>
<div class="scroll"><table><thead><tr><th>#</th><th>umaps（主图）</th><th>dmaps（噩梦）</th></tr></thead><tbody>
%s</tbody></table></div>
<h3 style="font-size:14px;color:#9aa4b2;margin-top:12px">难度档（wolf_hard_ness_）</h3>
<div>%s</div>
</div>
</div>

<h3 style="font-size:14px;color:#9aa4b2;margin-top:18px">狼图鉴文案（wolfs_1 … wolfs_%s）</h3>
<p class="note">这 763 条是「名字 + 图鉴描述 + 战斗台词」的扁平列表，脚本按已知狼名切块，共 %d 块。</p>
%s

<div class="two" style="margin-top:18px">
<div>
<h3 style="font-size:14px;color:#9aa4b2">建筑说明（building_ %d）</h3>
<table><tbody>%s</tbody></table>
</div>
<div>
<h3 style="font-size:14px;color:#9aa4b2">宝石说明（gem_ %d）</h3>
<div class="scroll"><table><tbody>%s</tbody></table></div>
</div>
</div>

<h3 style="font-size:14px;color:#9aa4b2;margin-top:18px">界面文案 sample（string_cn.xml，前 400 条 / 共 %d）</h3>
<div class="scroll"><table><thead><tr><th>id</th><th>文案</th></tr></thead><tbody>%s</tbody></table></div>
<p class="note">新手引导另有 %d 个步骤（含高亮圈坐标），存在 <code>tdsheep_swf/data/guide.json</code>。</p>
</section>

<section>
<h2>4. 数值与地图布局（社区整理）</h2>
<p class="note">社区工具 <code>AC-ake/tdsheepvillage-lineup</code> 把《保卫羊村百科全书V1.82.xlsx》与
《保卫羊村全地图布局参考 2026.7.pdf》整理成了 <code>data.js</code>（塔造价曲线、狼参数、宝石系数、地图网格）
和 47 张地图布局图，已存到 <code>tdsheep_swf/community/</code>。
本作的 <code>js/data.js</code> 与它同源：狼 %d 条、地图 %d 张。</p>
<div class="grid maps">%s</div>
</section>

<section>
<h2>5. 已知差距</h2>
<ul style="color:#c3cad6;font-size:13px">
  <li><b>数值配置拿不到原文件</b>：镜像站的 <code>config.xml</code> 只保留文案；原 Qzone CDN
      （<code>app16488.imgcache.qzoneapp.com</code>）已下线，Internet Archive 上也几乎没有存档
      （CDX 只查到 3 条记录）。社区整理的 <code>data.js</code> 是目前最全的数值来源。</li>
  <li><b>大厅/世界地图的季节变体</b>没找到：镜像站上只有 TheStronghold / TheWorld 及其驯化营、竞技场版本。</li>
  <li><b>加载广告</b>：客户端主包里内嵌引用了 <code>loadingAD_001.swf</code>，但镜像站上没有这个文件；
      <code>gameUI/loading.swf</code> 只是加载条 UI（里面的 <code>loadingAD_mc</code> 是占位）。</li>
  <li><b>音乐只有 6 首战斗曲</b>：客户端常量表里只有 MUSIC_FIGHT_001…006，大厅/地图音乐的名字不在客户端里。</li>
  <li><b>论坛翻过了</b>：<code>www.tdsheepvillage.com</code> 与 <code>www.kingdowin.com</code> 是同一个 Discuz 的两块域名，
      只有交友/求助/攻略/挂机脚本帖，没有《百科全书》附件、也没有带数值的配置表
      （用 <code>tools/forum_scan.py</code> 扫的，正文缓存在 <code>tools/_refs/forum/</code>）。</li>
</ul>
</section>

<section>
<h2>6. 来源</h2>
<ul style="color:#c3cad6;font-size:13px">
  <li>镜像站 <code>https://tdsheep.tdsheepvillage.com/static/images/swf/</code>（SWF / XML / gameSound 音频）</li>
  <li>同一站点的 <code>static/images/</code>（官网图片素材）</li>
  <li>GitHub <code>AC-ake/tdsheepvillage-lineup</code>（数值 data.js、47 张地图布局、提取脚本）</li>
  <li>怀旧论坛 <code>www.tdsheepvillage.com</code> / <code>www.kingdowin.com</code>（同一 Discuz 两块域名，玩家攻略与机制问答）</li>
  <li>复现命令：<code>python tools/probe_mirror.py</code> → <code>fetch_community_data.py</code> →
      <code>export_config_data.py</code> → <code>make_collect_page.py</code></li>
</ul>
</section>
</body></html>""" % (
        CSS,
        len(audio), len(images), summary.get('config_entries', 0),
        summary.get('strings_cn', 0), len(maps), len(codex),
        len(audio), len(sfx), audio_html(sfx), len(music), audio_html(music),
        img_html,
        summary.get('config_entries', 0), group_rows,
        len(umaps), len(dmaps),
        ''.join('<tr><td>%s</td><td>%s</td><td>%s</td></tr>'
                % (esc(u[0]), esc(u[1]),
                   esc(dmaps[int(u[0]) - 1][1]) if int(u[0]) - 1 < len(dmaps) else '')
                for u in umaps),
        ''.join('<span class="tag">%s</span>' % esc(v) for _k, v in hard),
        esc(groups.get('wolfs', [[None, '']])[-1][0]),
        len(codex), codex_html,
        len(building), ''.join('<tr><td><b>%s</b></td><td style="color:#9aa4b2">%s</td></tr>'
                               % (esc(building[i][1]), esc(building[i + 1][1]))
                               for i in range(0, len(building) - 1, 2)),
        len(gem), ''.join('<tr><td>%s</td><td>%s</td></tr>' % (esc(k), esc(v)) for k, v in gem),
        len(strings), strings_html,
        sum(len(g['steps']) for g in guide),
        len(our['wolves']), len(our['maps']), map_html,
    )
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write(page)
    print('写入 %s（%.1f KB）' % (OUT, os.path.getsize(OUT) / 1024))
    print('音频 %d、静态图 %d、狼图鉴块 %d、地图 %d' % (len(audio), len(images), len(codex), len(maps)))


if __name__ == '__main__':
    main()
