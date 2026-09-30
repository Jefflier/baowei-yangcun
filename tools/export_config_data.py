# -*- coding: utf-8 -*-
"""把原作客户端的配置 XML 解析成结构化 JSON（游戏设定 / 名称字典 / 文案表）。

输入都在 `tdsheep_swf/`：

  xmlFile_config.xml      名称与文案字典。**注意：镜像站上这份是被裁过的**
                          （文件头写着 `<!--xpath#//@s-->`，只留了 `s="..."` 文案属性，
                          数值属性在镜像端就被剥掉了），所以它是「名称表」而非「数值表」。
                          标签前缀：wolfs_（763 条狼名，含变体）、camp_wolfs_（232 条驯化营台词）、
                          tame_（192）、skill_（198）、card_（240）、gem_（60）、building_（20）、
                          umaps_/dmaps_（地图名）、barrier_、ploy_、snarp_、wolf_hard_ness_ …
  xmlFile_string_cn.xml   界面文案 id → 字符串（957 条）
  xmlFile_guide.xml       新手引导（分步骤，带高亮圈坐标）
  xmlFile_dream.xml       噩梦模式引导
  xmlFile_initXML.xml     启动清单：客户端固定加载哪些 SWF / XML

输出到 `tdsheep_swf/data/`：

  config_names.json   按前缀分组 + 原始数组
  strings_cn.json     界面文案
  guide.json          引导步骤
  summary.json        数量统计（文档里引用）

用法：python tools/export_config_data.py
"""
import json
import os
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tdsheep_swf')
DST = os.path.join(SRC, 'data')


def read_xml(name):
    path = os.path.join(SRC, name)
    return ET.parse(path).getroot()


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)


def config_names():
    root = read_xml('xmlFile_config.xml')
    raw = [(el.tag, el.get('s')) for el in root]
    groups = defaultdict(list)
    for tag, val in raw:
        # 形如 wolfs_1 / camp_wolfs_12 / return_msg_config_3：前缀 = 最后一个数字字段之前的部分
        m = re.match(r'^(.+?)_(\d+)$', tag)
        key, idx = (m.group(1), m.group(2)) if m else (tag, '')
        groups[key].append([idx, val])
    return raw, dict(groups)


def strings_cn():
    root = read_xml('xmlFile_string_cn.xml')
    out = {}
    for el in root:
        val = el.get('str')
        if el.tag.startswith('id') and val is not None:
            out[el.tag[2:]] = val
    return out


def guide(name):
    """引导 XML：`<groupA><id1><step1 t=1 x=.. y=.. s=文案id/>…`
    dream.xml 是两层（`<task1><id0 t=.. xx=.. s=..></task1>`），也一并兼容。
    返回 [{group, id, steps:[{tag, attrs}]}]，保留坐标。"""
    root = read_xml(name)
    out = []
    for group in root:
        for step_group in group:
            kids = list(step_group)
            steps = [{'step': st.tag, **dict(st.attrib)} for st in kids]
            if not kids:                                       # 叶子节点本身就是一步
                steps = [{'step': step_group.tag, **dict(step_group.attrib)}]
            out.append({'group': group.tag, 'id': step_group.tag, 'steps': steps})
    return out


def init_xml():
    root = read_xml('xmlFile_initXML.xml')
    out = []
    for holder in root:
        for el in holder:
            out.append({'kind': holder.tag, 'tag': el.tag, **el.attrib})
    return out


def main():
    raw, groups = config_names()
    strings = strings_cn()
    gd = guide('xmlFile_guide.xml')
    dr = guide('xmlFile_dream.xml')
    init = init_xml()

    dump(os.path.join(DST, 'config_names.json'),
         {'source': 'tdsheep_swf/xmlFile_config.xml',
          'note': '镜像站版本只保留了 s="文案" 属性，数值属性已被剥离',
          'count': len(raw),
          'groups': groups,
          'raw': [{'tag': t, 's': v} for t, v in raw]})
    dump(os.path.join(DST, 'strings_cn.json'), strings)
    dump(os.path.join(DST, 'guide.json'), gd)
    dump(os.path.join(DST, 'dream.json'), dr)
    dump(os.path.join(DST, 'init_manifest.json'), init)

    counts = Counter(re.sub(r'_\d+$', '', t) for t, _ in raw)
    summary = {
        'config_entries': len(raw),
        'config_groups': {k: len(v) for k, v in sorted(groups.items(), key=lambda kv: -len(kv[1]))},
        'strings_cn': len(strings),
        'guide_steps': sum(len(g['steps']) for g in gd),
        'dream_steps': sum(len(g['steps']) for g in dr),
        'init_entries': len(init),
        'top_prefixes': counts.most_common(30),
    }
    dump(os.path.join(DST, 'summary.json'), summary)
    for k, v in summary.items():
        print(k, '=', v if not isinstance(v, dict) else json.dumps(v, ensure_ascii=False)[:400])
    print('输出目录', os.path.relpath(DST, ROOT))


if __name__ == '__main__':
    main()
