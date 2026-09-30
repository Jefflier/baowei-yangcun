"""Export the original SWF vector art into two usable forms.

For each symbol it writes:
  assets/svg/<lib>/<name>[_fNN].svg   - real SVG, for eyeballing / other engines
  assets/art/<lib>.js                 - flat primitives a canvas can replay with Path2D
  assets/art/manifest.json            - index of what was exported

usage: python tools/export_assets.py [lib ...]      (default: every library)
"""
import colorsys
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWF_DIR = os.path.join(ROOT, 'tdsheep_swf')
SVG_DIR = os.path.join(ROOT, 'assets', 'svg')
ART_DIR = os.path.join(ROOT, 'assets', 'art')

TOWERS = ['shaota', 'sandanta', 'paota', 'bodongta', 'xiangqianta']
BUILDINGS = ['panlong', 'niulang', 'zhinv', 'qiang', 'denglou', 'wushi', 'yiji', 'levelBubble']

# 界面素材：只取「静态第一帧」就够了（面板底板、按钮、货币图标），
# 动辄几百个符号，全量导出会让 bundle 暴涨，所以按名字挑。
UI_MATERIAL = [
    # 货币 / 资源图标
    'UI_icon_coin', 'UI_icon_coinNull', 'UI_icon_coinQ', 'UI_icon_gold',
    'UI_icon_integral', 'UI_icon_exp', 'UI_icon_dreamGold', 'UI_icon_bg',
    # 按钮
    'UI_btn_build', 'UI_btn_close', 'UI_btn_shop', 'UI_btn_refining',
    'UI_btn_task_more', 'UI_btn_tools', 'UI_btn_change', 'UI_btn_worldMap',
    'UI_btn_goHome', 'UI_btn_audio', 'UI_btn_audio_close', 'UI_btn_music',
    'UI_btn_music_close', 'UI_btn_speedup', 'UI_btn_speedup_close',
    'UI_btn_scaleMax', 'UI_btn_scaleMin', 'UI_btn_free', 'UI_btn_log',
    'UI_btn_catch', 'UI_btn_steal', 'UI_btn_slave',
]

# 道具图标：入梦棒棒糖、钥匙、宝箱、炸弹筒、捕兽夹、地刺、镐子、沙漏…
UI_ITEM = [
    'rmbbt',                                                 # 入梦棒棒糖（噩梦入场券）
    'za_jinyaoshi', 'za_yinyaoshi', 'za_tongyaoshi',         # 金/银/铜钥匙
    'baoxiang21', 'baoxiang111', 'baoxiang_scdg',            # 宝箱
    'baozhatong1', 'baozhatong2', 'baozhatong3',             # 爆炸筒（炸弹）
    'bushoujia1', 'bushoujia2', 'bushoujia3',                # 捕兽夹
    'dicicao1', 'dicicao2', 'dicicao3',                      # 地刺
    'tiegao', 'gem_hammer', 'gem_opener',                    # 铁镐 / 宝石锤 / 开孔器
    'sl1', 'sl2', 'sl3', 'sl4',                              # 沙漏（挖矿时长）
    'za_xingchen', 'za_jinggang', 'hong1', 'hong2', 'hong3', 'hong4', 'hong5',
    'lqxfj', 'tuzhi', 'za_baozha', 'za_le', 'mc',
]

# 战斗特效：整包 2.5 MB，单文件版会膨胀，所以只导出 js/art_fx_original.js 用到的符号。
# 想多接一个，把名字加进来再跑 `python tools/export_assets.py effect`；用途对照见 docs/ART_PIPELINE.md §10。
EFFECTS = [
    # 命中 / 爆炸（effect0T0 与 bullet0T0 成对：010 星火、020 炸开、030 火团、040 冲击环、140 乌鸦羽毛）
    'effect010', 'effect020', 'effect030', 'effect040', 'effect140',
    'effect204',                                             # 炸弹墙：蘑菇云（201~204 是同一个爆炸的四档大小，只要最大档）
    'effect220',                                             # 捕兽夹合拢
    'effect310',                                             # 地雷：火团
    'effectCrit', 'allAttack', 'allAttackAOE', 'effectLinks',  # 暴击 / 黄宝石全屏闪光 / 紫宝石连锁电光
    'effectCuss', 'effectCussBreak',                         # 诅咒挨打 / 诅咒引爆
    # 狼身上的状态（叠在原作狼模型上，程序化狼也用）
    'statusBurn', 'statusPoison', 'statusCold', 'statusMCold_SLOWF', 'statusVertigo',
    'statusIntimidate', 'statusSilence', 'statusCuss', 'statusShield',
    # 狼的技能
    'effectSummon', 'effectBlinkIn', 'effectBlinkOut', 'effectCloud', 'effectCure', 'effectCureOne',
    'effectMirror', 'effectRelive', 'effectRun', 'effectSuicide', 'effectBoss', 'teleport',
    'signSummon', 'signCloud', 'signCure', 'signShield',
    # 地形 / 界面
    'effectHedian', 'pathBurn', 'arrowhead',
]

# 镶嵌塔（xiangqianta）的塔身里原画烘了一颗红宝石（sprite 103 / shape 102，五档都有）。
# 游戏里镶嵌塔应该是「空」的，镶哪种宝石就显示哪种颜色，所以导出时：
#   1. 塔身不画这颗宝石（skip）→ 空底座
#   2. 单独导出「宝石层」xiangqianta_gem：把这颗原画宝石按 6 种宝石色改色，帧号 = 档位 * 6 + 宝石色序号
#      （色序与 SV.GEM_COLORS 一致：hong lv huang zi lan hei），坐标系和塔身同一个原点，用同样的比例叠上去就对齐
INLAY_RUBY = 103
INLAY_TARGET = {           # 宝石色序 → (目标色相 °, 明度偏移, 饱和度倍率)；红色是原画本色
    0: (None, 0.0, 1.0),
    1: (135, 0.0, 0.95),   # 绿
    2: (50, 0.13, 1.0),    # 黄：同样明度的黄会发暗发褐，抬一点
    3: (268, 0.0, 0.95),   # 紫
    4: (214, 0.02, 1.0),   # 蓝
    5: ('hei', 0.0, 1.0),  # 黑：去色压暗，保留高光
}
RUBY_HUE = 355.0


def recolor_rgba(c, target):
    """把原画红宝石的一个颜色换成目标宝石色（保持明暗层次，高光留亮）。"""
    hue, dl, ds = target
    if hue is None:
        return list(c)
    r, g, b, a = c
    h, l, sat = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
    if hue == 'hei':
        if l >= 0.8:                               # 高光：亮灰
            nl, ns = 0.78, 0.04
        else:                                      # 本体：深灰，保留明暗
            nl, ns = max(0.06, l * 0.42), 0.06
        nr, ng, nb = colorsys.hls_to_rgb(0.62, nl, ns)
    else:
        if l >= 0.8:                               # 高光：目标色相的浅色
            nh, nl, ns = hue / 360.0, l, min(sat, 0.55)
        else:
            nh = ((h * 360.0 - RUBY_HUE + hue) % 360.0) / 360.0
            nl, ns = min(0.95, max(0.05, l + dl)), min(1.0, sat * ds)
        nr, ng, nb = colorsys.hls_to_rgb(nh, nl, ns)
    return [int(round(nr * 255)), int(round(ng * 255)), int(round(nb * 255)), a]


def recolor_flat(fl, target):
    out = json.loads(json.dumps(fl))
    for p in out['p']:
        f = p.get('f')
        if f and f.get('k') == 'solid':
            f['c'] = recolor_rgba(f['c'], target)
        elif f:                                    # 渐变：逐个色标改色
            for st in f.get('stops', []):
                st[1] = recolor_rgba(st[1], target)
        s = p.get('s')
        if s:
            s['c'] = recolor_rgba(s['c'], target)
    return out


# mode: all = every named symbol, names/prefix = a subset
CONFIG = [
    dict(lib='sheep',    swf='gameUI_sheep.swf',    mode='all',    frames='all', max_frames=8),
    dict(lib='tower',    swf='gameUI_tower.swf',    mode='names',  names=TOWERS, frames='1-5'),
    dict(lib='building', swf='gameUI_tower.swf',    mode='names',  names=BUILDINGS, frames='1'),
    dict(lib='obstacle', swf='gameUI_tower.swf',    mode='prefix', prefix='zhangai_', frames='0-1'),
    dict(lib='landform', swf='gameUI_landform.swf', mode='all',    frames='all', max_frames=8),
    dict(lib='effect',   swf='gameUI_effect.swf',   mode='names',  names=EFFECTS, frames='all', max_frames=10),
    dict(lib='skill',    swf='gameUI_skill.swf',    mode='all',    frames='0'),
    dict(lib='bullet',   swf='gameUI_bullet.swf',   mode='all',    frames='all', max_frames=8),
    dict(lib='item',     swf='gameUI_item.swf',     mode='names',  names=UI_ITEM, frames='0', max_frames=1),
    dict(lib='material', swf='gameUI_material.swf', mode='names',  names=UI_MATERIAL, frames='0', max_frames=1),
    # 狼身上的道具/挂件：间谍狼（好友小屋敲间谍狼用）、火把、气球、锤子、瞄准线、血条。
    # spyWolf 有 161 帧（0~59 是桶、60~117 是钻出来、118+ 是死），这里只挑代表帧，
    # 全量会把 bundle 撑到 6 MB。导出后 frames 的下标含义见 docs/ART_PIPELINE.md §11。
    dict(lib='wolfui',   swf='gameUI_wolf.swf',     mode='names',
         names=['spyWolf', 'torch', 'balloon', 'hammer', 'BloodSlot', 'aiming'],
         frames='0,60,100,140'),
]


def frame_list(spec, total):
    if spec == 'all':
        return list(range(total))
    if ',' in spec:                       # 逗号列表：只要某几帧（长动画里通常只有几帧有用）
        return [int(s) for s in spec.split(',') if s.strip().isdigit() and int(s) < total]
    if '-' in spec:
        a, b = spec.split('-')
        return [f for f in range(int(a), int(b) + 1) if f < total]
    # 单帧符号没有「第 0 帧是建造占位」这回事，直接用它本身
    if total == 1:
        return [0]
    return [int(spec)] if int(spec) < total else []


def safe(name):
    return name.replace('.', '_').replace('/', '_')


def unwrap(doc, cid):
    """Many exported symbols are a 1-frame wrapper around one animated sprite.

    Return (id_to_render, frame_count): the wrapper's single child when that child
    carries the real timeline (tower tiers, building levels), otherwise the symbol itself.
    """
    seen = set()
    while cid in doc.sprites and doc.nframes(cid) == 1 and cid not in seen:
        seen.add(cid)
        ops = doc.sprites[cid]['frames'][0] if doc.sprites[cid]['frames'] else []
        kids = [o['id'] for o in ops if o.get('id') in doc.sprites]
        if len(ops) != 1 or len(kids) != 1:
            break
        if doc.nframes(kids[0]) <= doc.nframes(cid):
            break
        cid = kids[0]
    return cid, doc.nframes(cid)


def export_lib(cfg):
    swf = os.path.join(SWF_DIR, cfg['swf'])
    doc = Doc(swf)
    svg_out = os.path.join(SVG_DIR, cfg['lib'])
    os.makedirs(svg_out, exist_ok=True)
    art = {}
    total_bytes = 0
    for cid, name in sorted(doc.sym.items()):
        if cfg['mode'] == 'names' and name not in cfg['names']:
            continue
        if cfg['mode'] == 'prefix' and not name.startswith(cfg['prefix']):
            continue
        if name.startswith('tower_fla') or name.startswith('privatePkg'):
            continue
        rid, nframes = unwrap(doc, cid)
        frames = frame_list(cfg['frames'], nframes)[:cfg.get('max_frames', 999)]
        entry = {'frames': []}
        inlay = cfg['lib'] == 'tower' and name == 'xiangqianta'
        gem_layer = {'frames': []} if inlay else None
        for fr in frames:
            fl = doc.flat(rid, fr, skip=[INLAY_RUBY] if inlay else None)
            if fl is None:
                continue
            entry['frames'].append(fl)
            if inlay:
                ruby = doc.flat(rid, fr, only=[INLAY_RUBY])
                gem_layer['ruby'] = gem_layer.get('ruby', []) + [ruby]
            svg = doc.svg(rid, fr)
            if svg:
                fn = '%s%s.svg' % (safe(name), '' if len(frames) == 1 else '_f%02d' % fr)
                with open(os.path.join(svg_out, fn), 'w', encoding='utf-8') as fh:
                    fh.write(svg)
        if entry['frames']:
            art[name] = entry
        if gem_layer and gem_layer.get('ruby'):
            # 帧号 = 档位 * 6 + 宝石色序
            for tier, ruby in enumerate(gem_layer['ruby']):
                for ci in range(6):
                    gem_layer['frames'].append(recolor_flat(ruby, INLAY_TARGET[ci]))
            art['xiangqianta_gem'] = {'frames': gem_layer['frames']}
    os.makedirs(ART_DIR, exist_ok=True)
    payload = json.dumps(art, separators=(',', ':'))
    body = ('// generated by tools/export_assets.py from %s - original vector art (c) the game authors\n'
            'window.SVA_ART = window.SVA_ART || {};\n'
            'window.SVA_ART[%s] = %s;\n' % (cfg['swf'], json.dumps(cfg['lib']), payload))
    with open(os.path.join(ART_DIR, '%s.js' % cfg['lib']), 'w', encoding='utf-8') as fh:
        fh.write(body)
    total_bytes = len(body)
    print('%-9s %-24s symbols=%-4d frames=%-4d js=%6.1f KB'
          % (cfg['lib'], cfg['swf'], len(art),
             sum(len(v['frames']) for v in art.values()), total_bytes / 1024))
    return {'lib': cfg['lib'], 'swf': cfg['swf'],
            'symbols': {k: len(v['frames']) for k, v in art.items()},
            'bytes': total_bytes}


def main():
    want = sys.argv[1:]
    t0 = time.time()
    manifest = []
    for cfg in CONFIG:
        if want and cfg['lib'] not in want:
            continue
        manifest.append(export_lib(cfg))
    out = os.path.join(ART_DIR, 'manifest.json')
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump({'source': 'tdsheep_swf (original client)', 'libraries': manifest}, fh,
                  ensure_ascii=False, indent=1)
    print('wrote %s in %.1fs' % (out, time.time() - t0))


if __name__ == '__main__':
    main()
