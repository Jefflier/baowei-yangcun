"""HEAD-probe which wolf ids have a swf on the (public) static server; prints sizes, downloads nothing.
usage: python tools/probe_wolf_swf.py yc.json"""
import json, sys, urllib.request, concurrent.futures as cf

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/gameUI/dynamic/'
d = json.load(open(sys.argv[1], encoding='utf-8'))
ids = list(d['wolfs'].keys())
# summon models referenced by other wolves
for w in d['wolfs'].values():
    sm = w.get('summon') or w.get('sm')
    if isinstance(sm, str) and sm not in ids:
        ids.append(sm)
for m in d['maps']:
    wf = m.get('wolf') or {}
    for k in ('boss', 'randomBoss', 'finalBoss'):
        for x in wf.get(k) or []:
            if isinstance(x, str) and x not in ids:
                ids.append(x)
    for p in wf.get('prop') or []:
        if p[1] not in ids:
            ids.append(p[1])


def head(i):
    req = urllib.request.Request(BASE + i + '.swf', method='HEAD')
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return i, r.status, int(r.headers.get('Content-Length') or 0)
    except Exception as e:
        return i, getattr(e, 'code', str(e)), 0


with cf.ThreadPoolExecutor(8) as ex:
    res = list(ex.map(head, ids))
ok = [r for r in res if r[1] == 200]
bad = [r for r in res if r[1] != 200]
print('ids', len(ids), 'found', len(ok), 'missing', len(bad), 'total bytes', sum(r[2] for r in ok))
print('missing:', ' '.join('%s(%s)' % (r[0], r[1]) for r in bad))
json.dump({'ok': [[r[0], r[2]] for r in ok], 'missing': [r[0] for r in bad]}, open(sys.argv[2] if len(sys.argv) > 2 else 'probe.json', 'w'))
