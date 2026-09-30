"""HEAD-probe the original static server for wolf model SWFs using the monster ids we know.

The client loads a monster through `DynamicLoad.getMonsterURL(res)`, i.e.
`<base>/images/swf/gameUI/dynamic/<res>.swf`. `res` comes from the server config; the
community encyclopedia keys in js/data.js (`baozul`, `bdl`, `bfsl`, ...) are the same
internal monster ids, so they are the best filename candidates.

usage: python tools/probe_wolf_res.py [--full]
"""
import concurrent.futures as cf
import json
import os
import sys
import urllib.request

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def wolf_keys():
    src = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
    start = src.index('{', src.index('window.SVD'))
    data = json.loads(src[start:src.rindex('}') + 1])
    return list(data['wolves'].keys())


def names(keys, full):
    out = []
    for k in keys:
        cands = [k, k.lower(), k.upper(), k.replace('_', '')]
        if not full:
            cands = cands[:1]
        for c in cands:
            for folder in ('gameUI/dynamic/', 'gameUI/', 'monster/', ''):
                out.append(folder + c + '.swf')
    return sorted(set(out))


def head(name):
    req = urllib.request.Request(BASE + name, method='HEAD')
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return name, r.status, int(r.headers.get('Content-Length') or 0)
    except Exception as e:  # noqa: BLE001
        return name, getattr(e, 'code', 'err'), 0


def main():
    full = '--full' in sys.argv
    save = None
    if '--save' in sys.argv:
        save = sys.argv[sys.argv.index('--save') + 1]
    cand = names(wolf_keys(), full)
    print('candidates', len(cand), '(full=%s)' % full)
    with cf.ThreadPoolExecutor(16) as ex:
        res = list(ex.map(head, cand))
    ok = [r for r in res if r[1] == 200]
    print('found %d' % len(ok))
    for name, _s, size in ok:
        print('  %-52s %8d' % (name, size))
    if save:
        os.makedirs(os.path.dirname(save), exist_ok=True)
        with open(save, 'w', encoding='utf-8') as fh:
            json.dump({'base': BASE, 'found': [[n, s] for n, _st, s in ok]}, fh, indent=1)
        print('saved', save)


if __name__ == '__main__':
    main()
