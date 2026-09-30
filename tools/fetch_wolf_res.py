"""Download the wolf model SWFs listed by probe_wolf_res.py.

usage: python tools/fetch_wolf_res.py tools/_meta/wolf_res.json
Files land in tdsheep_swf/monster/<name>.swf (already-present files are skipped).
"""
import concurrent.futures as cf
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tdsheep_swf', 'monster')


def fetch(base, name):
    dst = os.path.join(OUT, os.path.basename(name))
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return name, 'cached', os.path.getsize(dst)
    try:
        with urllib.request.urlopen(base + name, timeout=30) as r:
            data = r.read()
    except Exception as e:  # noqa: BLE001
        return name, getattr(e, 'code', 'err'), 0
    with open(dst, 'wb') as fh:
        fh.write(data)
    return name, 'ok', len(data)


def main():
    meta = json.load(open(sys.argv[1], encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    with cf.ThreadPoolExecutor(12) as ex:
        res = list(ex.map(lambda n: fetch(meta['base'], n[0]), meta['found']))
    ok = [r for r in res if r[1] in ('ok', 'cached')]
    print('saved %d / %d  (%.0f KB)' % (len(ok), len(res), sum(r[2] for r in ok) / 1024))
    bad = [r for r in res if r[1] not in ('ok', 'cached')]
    if bad:
        print('failed:', bad[:8])


if __name__ == '__main__':
    main()
