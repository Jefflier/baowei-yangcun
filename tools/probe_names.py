"""HEAD-probe arbitrary candidate file names under the original static SWF folders.

usage: python tools/probe_names.py gameUI/dynamic w wolf monster
        -> probes w1..w60, wolf1..wolf60, monster1..monster60 (plus 2-digit zero padding)
"""
import concurrent.futures as cf
import sys
import urllib.request

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/'


def head(name):
    req = urllib.request.Request(BASE + name, method='HEAD')
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return name, r.status, int(r.headers.get('Content-Length') or 0)
    except Exception as e:  # noqa: BLE001
        return name, getattr(e, 'code', 'err'), 0


def main():
    folder = sys.argv[1].strip('/') + '/'
    prefixes = sys.argv[2:]
    names = []
    for p in prefixes:
        for n in range(1, 61):
            names.append('%s%s%s.swf' % (folder, p, n))
            names.append('%s%s%02d.swf' % (folder, p, n))
    with cf.ThreadPoolExecutor(16) as ex:
        res = list(ex.map(head, names))
    ok = [r for r in res if r[1] == 200]
    print('probed %d  found %d' % (len(names), len(ok)))
    for name, _status, size in ok:
        print('  %-40s %8d' % (name, size))


if __name__ == '__main__':
    main()
