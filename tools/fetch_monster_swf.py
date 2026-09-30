"""Download monster (wolf) model SWFs from the original static server.

usage: python tools/fetch_monster_swf.py 1 2 3 5 6 ...        # explicit ids
       python tools/fetch_monster_swf.py --scan 1 1500        # probe then download

Files land in tdsheep_swf/monster/m<id>.swf. Already-present files are skipped.
"""
import concurrent.futures as cf
import os
import sys
import urllib.request

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/gameUI/dynamic/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'tdsheep_swf', 'monster')


def fetch(mid):
    path = os.path.join(OUT, 'm%d.swf' % mid)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return mid, 'cached', os.path.getsize(path)
    try:
        with urllib.request.urlopen(BASE + 'm%d.swf' % mid, timeout=30) as r:
            data = r.read()
    except Exception as e:  # noqa: BLE001
        return mid, getattr(e, 'code', 'err'), 0
    with open(path, 'wb') as fh:
        fh.write(data)
    return mid, 'ok', len(data)


def main():
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    if args and args[0] == '--scan':
        lo, hi = int(args[1]), int(args[2])
        ids = range(lo, hi + 1)
    else:
        ids = [int(a) for a in args]
    with cf.ThreadPoolExecutor(16) as ex:
        res = list(ex.map(fetch, ids))
    ok = [r for r in res if r[1] in ('ok', 'cached')]
    print('wanted %d  saved %d  bytes %.1f KB' % (len(list(ids)), len(ok), sum(r[2] for r in ok) / 1024))
    print('ids:', ' '.join(str(r[0]) for r in ok))


if __name__ == '__main__':
    main()
