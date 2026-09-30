"""HEAD-probe the original static server for monster (wolf) model SWFs.

The game loads monsters through DynamicLoad.getMonsterURL, which resolves to
`static/images/swf/gameUI/dynamic/m<id>.swf` (see MainClass ABC string `^(m[0-9])`).
This script only issues HEAD requests and prints the ids that exist.

usage: python tools/probe_monster_swf.py [lo] [hi]
"""
import concurrent.futures as cf
import sys
import urllib.request

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/gameUI/dynamic/'


def head(mid):
    req = urllib.request.Request(BASE + 'm%d.swf' % mid, method='HEAD')
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return mid, r.status, int(r.headers.get('Content-Length') or 0)
    except Exception as e:  # noqa: BLE001 - report any failure as a miss
        return mid, getattr(e, 'code', str(e)), 0


def main():
    lo = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    hi = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    with cf.ThreadPoolExecutor(12) as ex:
        res = list(ex.map(head, range(lo, hi + 1)))
    ok = [r for r in res if r[1] == 200]
    miss = [r[0] for r in res if r[1] != 200]
    print('range %d..%d  found %d  total %.1f KB' % (lo, hi, len(ok), sum(r[2] for r in ok) / 1024))
    print('found ids:', ' '.join(str(r[0]) for r in ok))
    if miss:
        print('missing:', ' '.join(str(m) for m in miss))


if __name__ == '__main__':
    main()
