"""把某个导出库的 SVG 拼成一张网页图册，方便肉眼挑符号。

usage: python tools/svg_sheet.py material [--cols 8] [--out tools/_preview/_gal_material]
       python tools/svg_sheet.py item material     # 多个库，各出一张

看完用无头 Chrome 截图：
  chrome --headless=new --allow-file-access-from-files --window-size=1500,1300 \
         --screenshot=out.png "file:///.../tools/_preview/_gal_material/index.html"
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sheet(lib, cols, out):
    srcdir = os.path.join(ROOT, 'assets', 'svg', lib)
    if not os.path.isdir(srcdir):
        print('skip %s（没有这个库，先跑 tools/export_assets.py %s）' % (lib, lib))
        return
    names = sorted(f for f in os.listdir(srcdir) if f.endswith('.svg'))
    pre = '../../../assets/svg/%s/' % lib
    q = '"'
    cells = ''.join('<div class=c><img src=%s%s%s%s><div>%s</div></div>'
                    % (q, pre, n, q, n[:-4]) for n in names)
    html = ('<!doctype html><meta charset=utf-8><style>'
            'body{margin:0;background:#6a8f3a;font:11px sans-serif;display:grid;'
            'grid-template-columns:repeat(%d,1fr);gap:4px;padding:4px}'
            '.c{background:#fff;padding:3px;text-align:center;overflow:hidden}'
            '.c img{max-width:100%%;height:76px;object-fit:contain;display:block;margin:auto}'
            '</style>%s') % (cols, cells)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('%-9s %3d 张 → %s' % (lib, len(names), out))


def main():
    args = sys.argv[1:]
    cols = 8
    out = None
    libs = []
    i = 0
    while i < len(args):
        if args[i] == '--cols':
            cols = int(args[i + 1]); i += 2
        elif args[i] == '--out':
            out = args[i + 1]; i += 2
        else:
            libs.append(args[i]); i += 1
    if not libs:
        svgroot = os.path.join(ROOT, 'assets', 'svg')
        libs = sorted(d for d in os.listdir(svgroot) if os.path.isdir(os.path.join(svgroot, d)))
    for lib in libs:
        sheet(lib, cols, out or os.path.join(ROOT, 'tools', '_preview', '_gal_' + lib))


if __name__ == '__main__':
    main()
