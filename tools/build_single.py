"""把整个游戏打包成单个 HTML 文件（便于分享）。
用法：python tools/build_single.py   → 生成 dist/保卫羊村怀旧服.html
"""
import os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def main():
    html = read('index.html')
    css = read('css/style.css')
    html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')

    def inline(m):
        src = m.group(1)
        code = read(src)
        # 注释/字符串里出现 </script 会让浏览器提前结束 <script> 块。
        # 标准做法是把 `</script` 写成 `<\/script`（JS 里 `\/` 就是 `/`，语义不变）。
        code = code.replace('</script', '<\\/script')
        return '<script>\n' + code + '\n</script>'

    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    out_dir = os.path.join(ROOT, 'dist')
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, '保卫羊村怀旧服.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('已生成：%s（%.0f KB）' % (out, os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
