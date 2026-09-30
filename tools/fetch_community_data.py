"""抓社区整理的原作数据（数值 / 地图布局 / 提取脚本）。

来源：GitHub `AC-ake/tdsheepvillage-lineup`（社区做的「羊村百科全书」排阵工具）——
它把原作的塔造价曲线、狼参数、47 张地图布局整理成了 `data.js`，
还留了 `_build/extract_data.py`（数据从哪来、怎么算的，都在里面）。

落盘到 `tdsheep_swf/community/`。

用法：
  python tools/fetch_community_data.py --list    # 只列文件，不下载
  python tools/fetch_community_data.py           # 下载全部（已有的跳过）
  python tools/fetch_community_data.py --force
"""
import concurrent.futures as cf
import json
import os
import sys
import urllib.request

REPO = 'AC-ake/tdsheepvillage-lineup'
BRANCH = 'main'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tdsheep_swf', 'community')
UA = 'Mozilla/5.0 (compatible; tdsheep-asset-archiver/1.0)'

API = 'https://api.github.com/repos/%s/git/trees/%s?recursive=1' % (REPO, BRANCH)
RAW = 'https://raw.githubusercontent.com/%s/%s/' % (REPO, BRANCH)


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def tree():
    d = json.loads(get(API).decode('utf-8'))
    if 'tree' not in d:
        raise SystemExit('GitHub API 出错：%s' % d.get('message'))
    return [t for t in d['tree'] if t['type'] == 'blob']


def main():
    args = sys.argv[1:]
    force = '--force' in args
    mode_list = '--list' in args
    blobs = tree()
    print('%s / %s：%d 个文件，共 %.1f MB'
          % (REPO, BRANCH, len(blobs), sum(t.get('size') or 0 for t in blobs) / 1048576))
    todo = []
    for t in blobs:
        path = t['path']
        if path.endswith('.pyc') or path.endswith('.mkv'):      # 字节码与教程视频不要
            continue
        dst = os.path.join(OUT, path.replace('/', os.sep))
        if force or not (os.path.exists(dst) and os.path.getsize(dst) == (t.get('size') or -1)):
            todo.append((path, dst, t.get('size') or 0))
    print('需要下载 %d 个' % len(todo))
    for path, _dst, size in todo:
        print('   %-34s %8d' % (path, size))
    if mode_list or not todo:
        return

    def one(item):
        path, dst, _size = item
        try:
            data = get(RAW + urllib.request.quote(path))
        except Exception as e:                                 # noqa: BLE001
            return path, 'err %s' % e, 0
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, 'wb') as fh:
            fh.write(data)
        return path, 'ok', len(data)

    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(one, todo))
    for path, why, n in res:
        if why != 'ok':
            print('  !! %-34s %s' % (path, why))
    print('下载完成 %d 个，共 %.1f MB'
          % (sum(1 for r in res if r[1] == 'ok'), sum(r[2] for r in res) / 1048576))


if __name__ == '__main__':
    main()
