"""Scan every DoABC block in a SWF and print the method bodies that mention a property string.

Unlike abc_dis.py (which filters by the first few strings of a block), this walks all blocks,
so it finds static initialisers such as `GlobalVersionCtrl.$vWolf = '...'` wherever they live.

usage: python tools/abc_find.py file.swf vWolf VERSION
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from abc_dis import disasm, parse_abc
from swflib import read_swf


def main():
    swf = read_swf(sys.argv[1])
    needles = sys.argv[2:]
    for t, d in swf['tags']:
        if t != 82:
            continue
        try:
            strings, mn, methods, bodies = parse_abc(d)
        except Exception:  # noqa: BLE001 - skip unparsable blocks
            continue
        for i, body in bodies.items():
            try:
                lines = disasm(body, strings, mn)
            except Exception:  # noqa: BLE001
                continue
            text = '\n'.join(lines)
            if not any(n in text for n in needles):
                continue
            name = methods[i] if i < len(methods) else '?'
            print('=== block %s  method %s' % (strings[0][:60], name))
            for line in lines:
                head = line.split()[1] if len(line.split()) > 1 else ''
                if not head.startswith('debug'):
                    print('   ', line)


if __name__ == '__main__':
    main()
