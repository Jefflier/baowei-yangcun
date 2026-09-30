"""Dump the ABC constant-pool strings of DoABC blocks whose class name matches a pattern.
usage: python tools/abc_strings.py file.swf pattern [pattern...]"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from swflib import read_swf


def read_u30(d, p):
    r = 0
    sh = 0
    while True:
        b = d[p]
        p += 1
        r |= (b & 0x7f) << sh
        sh += 7
        if not b & 0x80:
            break
    return r, p


def abc_strings(d):
    p = 4
    e = d.index(b'\0', p)
    name = d[p:e]
    p = e + 1
    p += 4
    n, p = read_u30(d, p)
    for _ in range(max(0, n - 1)):
        _, p = read_u30(d, p)
    n, p = read_u30(d, p)
    for _ in range(max(0, n - 1)):
        _, p = read_u30(d, p)
    n, p = read_u30(d, p)
    p += 8 * max(0, n - 1)
    n, p = read_u30(d, p)
    out = []
    for _ in range(max(0, n - 1)):
        l, p = read_u30(d, p)
        out.append(d[p:p + l].decode('utf-8', 'replace'))
        p += l
    return name.decode('latin1'), out


if __name__ == '__main__':
    s = read_swf(sys.argv[1])
    pats = sys.argv[2:]
    for t, d in s['tags']:
        if t != 82:
            continue
        name, st = abc_strings(d)
        if any(pt in name for pt in pats):
            print('=====', name, len(st))
            print([x for x in st if not x.startswith('C:')][:200])
