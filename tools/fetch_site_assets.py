"""把原站（https://tdsheep.tdsheepvillage.com/static/images/swf/）上的 SWF 素材尽量抓全。

清单来源：
  1. 线上的 xmlFile/initXML.xml —— 客户端启动时固定加载的那批（gameUI/*.swf、MainClass.swf…）；
  2. js/data.js —— 132 种狼的 id，加上地图配置里引用到的 sm / rb / prop / boss / fb；
  3. 地图地块 gameUI/dynamic/m<N>.swf 与防线图 gameUI/dynamic/mfx*.swf。

落盘约定（跟仓库里已有的一致）：
  gameUI/wolf.swf            → tdsheep_swf/gameUI_wolf.swf        （路径里的 / 换成 _）
  gameUI/dynamic/bdl.swf     → tdsheep_swf/monster/bdl.swf        （狼单独放 monster/）
  xmlFile/config.xml         → tdsheep_swf/xmlFile_config.xml

用法：
  python tools/fetch_site_assets.py --probe              # 只看哪些还在（不写盘）
  python tools/fetch_site_assets.py                      # 下载缺的
  python tools/fetch_site_assets.py --force              # 全部重下
"""
import concurrent.futures as cf
import json
import os
import re
import sys
import urllib.error
import urllib.request

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWF_DIR = os.path.join(ROOT, 'tdsheep_swf')
MON_DIR = os.path.join(SWF_DIR, 'monster')
UA = 'Mozilla/5.0 (compatible; tdsheep-asset-archiver/1.0)'

MAP_TILE_MAX = 30          # 地块就 m1..m18，留点余量


def get(path, timeout=30):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def head(path, timeout=20):
    req = urllib.request.Request(BASE + path, method='HEAD', headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, int(r.headers.get('Content-Length') or 0)
    except urllib.error.HTTPError as e:
        return e.code, 0
    except Exception:                                         # noqa: BLE001
        return 0, 0


def local_path(path):
    """远端路径 → 本地路径（保持仓库里的扁平命名）。"""
    base = os.path.basename(path)
    # gameUI/dynamic/ 下的东西早先都被当成「狼」抓进 tdsheep_swf/monster/ 了，
    # 已经在那儿的就沿用老位置（地图地块 m1..m18 也一样），避免同一份文件存两份。
    if path.startswith('gameUI/dynamic/'):
        old = os.path.join(MON_DIR, base)
        if os.path.exists(old) or not os.path.exists(os.path.join(SWF_DIR, ('gameUI_dynamic_' + base))):
            return old
    return os.path.join(SWF_DIR, path.replace('/', '_'))


def init_list():
    """线上 initXML：客户端一定会加载的那批。"""
    out = []
    try:
        _st, raw = get('xmlFile/initXML.xml')
        txt = raw.decode('utf-8', 'replace')
    except Exception as e:                                    # noqa: BLE001
        print('!! 拿不到线上 initXML（%s），改用本地那份' % e)
        txt = open(os.path.join(SWF_DIR, 'xmlFile_initXML.xml'), encoding='utf-8').read()
    for m in re.finditer(r'<swf\b[^>]*\bsrc\s*=\s*"([^"]+)"', txt):
        out.append(m.group(1))
    for m in re.finditer(r'<xml\b[^>]*\bsrc\s*=\s*"([^"]+)"', txt):
        out.append('xmlFile/' + m.group(1))
    return out


def data_ids():
    """data.js 里所有可能对应 SWF 文件名的 id。"""
    src = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
    start = src.index('{', src.index('window.SVD'))
    D = json.loads(src[start:src.rindex('}') + 1])
    ids = set(D['wolves'].keys())
    for w in D['wolves'].values():
        if w.get('sm'):
            ids.add(w['sm'])
        for r in (w.get('rb') or []):
            ids.add(r[1] if isinstance(r, (list, tuple)) and len(r) > 1 else r)
    for mp in D['maps']:
        w = mp.get('w') or {}
        for p in (w.get('prop') or []):
            ids.add(p[1])
        for k in ('boss', 'fb'):
            for x in (w.get(k) or []):
                ids.add(x)
        for r in (w.get('rb') or []):
            ids.add(r[1] if isinstance(r, (list, tuple)) and len(r) > 1 else r)
    return sorted(ids)


def candidates():
    """(远端路径, 说明) 候选表，去重后返回。"""
    cand = {}

    def add(path, why):
        cand.setdefault(path, why)

    for p in init_list():
        add(p, 'initXML')
    # 地图地块 / 防线图
    for i in range(1, MAP_TILE_MAX + 1):
        add('gameUI/dynamic/m%d.swf' % i, 'map tile')
    for extra in ('mfx', 'mfx1', 'mfx2'):
        add('gameUI/dynamic/%s.swf' % extra, 'map tile')
    # 狼：id 及其大小写/下划线变体
    for wid in data_ids():
        # 服务端的 res 名常比资料里的键短一截（yll_B / yll_B2 的模型其实叫 yll，
        # sdys_A 的模型就是 sdys），所以把「去掉 _X 后缀」的写法也当候选。
        stems = {wid}
        if re.search(r'_[A-Za-z]\d?$', wid):
            stems.add(re.sub(r'_[A-Za-z]\d?$', '', wid))
        if wid.endswith('X') or wid.endswith('x'):
            stems.add(wid[:-1])
        for s in stems:
            for v in {s, s.lower(), s.upper(), s.replace('_', '')}:
                add('gameUI/dynamic/%s.swf' % v, 'wolf ' + wid)
    # 已知的补充资源
    for p in ('gameImg/inviteFriends_tw2.swf', 'gameImg/ktyellow.swf',
              'gameUI/3366qqvip.swf', 'gameUI/qqvip.swf'):
        add(p, 'extra')
    return cand


def fetch_one(path, force):
    dst = local_path(path)
    if not force and os.path.exists(dst) and os.path.getsize(dst) > 0:
        return path, 'cached', os.path.getsize(dst)
    st, size = head(path)
    if st != 200:
        return path, 'miss %s' % st, 0
    try:
        st2, data = get(path)
    except Exception as e:                                    # noqa: BLE001
        return path, 'err %s' % e, 0
    if st2 != 200 or not data:
        return path, 'empty', 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'wb') as fh:
        fh.write(data)
    return path, 'ok', len(data)


def main():
    force = '--force' in sys.argv
    probe = '--probe' in sys.argv
    cand = candidates()
    todo = sorted(cand)
    print('候选 %d 个（其中本地已有 %d 个）'
          % (len(todo), sum(1 for p in todo if os.path.exists(local_path(p)))))
    if probe:
        with cf.ThreadPoolExecutor(12) as ex:
            res = list(ex.map(lambda p: (p,) + head(p), todo))
        ok = [r for r in res if r[1] == 200]
        print('线上存在 %d 个，共 %.1f MB' % (len(ok), sum(r[2] for r in ok) / 1048576))
        for p, _s, sz in ok:
            if not os.path.exists(local_path(p)):
                print('  缺  %-46s %8d  (%s)' % (p, sz, cand[p]))
        return
    with cf.ThreadPoolExecutor(10) as ex:
        res = list(ex.map(lambda p: fetch_one(p, force), todo))
    ok = [r for r in res if r[1] in ('ok', 'cached')]
    new = [r for r in res if r[1] == 'ok']
    miss = [r for r in res if r[1] not in ('ok', 'cached')]
    print('拿到 %d / %d（新下载 %d，共 %.1f MB）'
          % (len(ok), len(res), len(new), sum(r[2] for r in ok) / 1048576))
    if miss:
        print('线上没有的 %d 个（前 20）：' % len(miss))
        for p, why, _s in miss[:20]:
            print('   %-46s %s' % (p, why))
    manifest = os.path.join(SWF_DIR, 'site_assets.json')
    with open(manifest, 'w', encoding='utf-8') as fh:
        json.dump({'base': BASE,
                   'saved': [{'url': p, 'local': os.path.relpath(local_path(p), ROOT).replace('\\', '/'),
                              'bytes': s, 'why': cand[p]} for p, w, s in ok],
                   'missing': [{'url': p, 'why': why} for p, why, _s in miss]},
                  fh, ensure_ascii=False, indent=1)
    print('清单写入', os.path.relpath(manifest, ROOT))


if __name__ == '__main__':
    main()
