import sys, glob, os, collections
sys.path.insert(0, os.path.dirname(__file__))
from swflib import *

D = os.path.join(os.path.dirname(__file__), '..', 'tdsheep_swf')
files = sys.argv[1:] or sorted(glob.glob(os.path.join(D, '*.swf')))
for f in files:
    s = read_swf(f)
    cnt = collections.Counter(TAGNAMES.get(t, str(t)) for t, _ in s['tags'])
    sym = symbol_class(s['tags'])
    print('=' * 70)
    print(os.path.basename(f), 'v%d' % s['version'], 'stage', [v / 20 for v in s['frame']], 'tags', dict(cnt))
    print('symbols:', len(sym))
    names = sorted(sym.items(), key=lambda kv: kv[0])
    print('; '.join('%d:%s' % kv for kv in names[:60]), '...' if len(names) > 60 else '')
