"""把 SWF 里所有 DoABC 块的字符串常量池倒成一个文本文件，方便 grep。

用法：python tools/abc_dump_strings.py tdsheep_swf/MainClass.swf tools/_work/abc_strings.txt
每行格式： `块名<TAB>字符串`
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from abc_strings import abc_strings                      # noqa: E402
from swflib import read_swf                              # noqa: E402


def main():
    src, dst = sys.argv[1], sys.argv[2]
    swf = read_swf(src)
    n = 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w', encoding='utf-8', newline='\n') as fh:
        for t, d in swf['tags']:
            if t != 82:
                continue
            try:
                name, st = abc_strings(d)
            except Exception:                                # noqa: BLE001
                continue
            for s in st:
                if s:
                    # 字符串里可能自带换行/制表符，转义掉，保证一行一条
                    esc = s.replace('\\', '\\\\').replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                    fh.write('%s\t%s\n' % (name, esc))
                    n += 1
    print('写了 %d 行 -> %s' % (n, dst))


if __name__ == '__main__':
    main()
