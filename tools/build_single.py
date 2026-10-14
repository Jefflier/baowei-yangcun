"""把整个游戏打包成**一个**自包含的 HTML 文件：双击即玩，不需要服务器，也不再引用任何外部文件。

用法：
  python tools/build_single.py          → dist/保卫羊村怀旧服.html（完整版）
  python tools/build_single.py --lite   → 不内联狼的精灵图（体积小很多，狼退回程序化美术）
  python tools/build_single.py --png    → 图片保持 PNG，不转 WebP（没装 Pillow 时自动如此）

做了三件事：
  1. css/style.css 和 index.html 里的每个 <script src> 原样内联；
  2. assets/scene、assets/map、assets/wolf 下的图片转成 data URI，写进 window.SVA_ASSETS
     （键 = 原来的相对路径；三个图片加载器先查这里，查不到才按路径去取）；
  3. 装了 Pillow 时把图片转成**无损** WebP（像素不变），逐张和原 PNG 比，取小的那个。
"""
import argparse
import base64
import io
import json
import os
import re
from concurrent.futures import ProcessPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'dist', '保卫羊村怀旧服.html')

try:
    from PIL import Image, features
    HAVE_WEBP = bool(features.check('webp'))
except ImportError:
    HAVE_WEBP = False


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def wolf_index():
    """assets/wolf/index.js 里列出的已烘图集（每只有 <id>.png 和 <id>_dead.png）"""
    m = re.search(r'SVA_WOLF_INDEX\s*=\s*(\[.*?\])', read('assets/wolf/index.js'), re.S)
    return json.loads(m.group(1))


def image_list(lite):
    files = []
    for d in ('assets/scene', 'assets/map'):
        files += sorted(d + '/' + f for f in os.listdir(os.path.join(ROOT, d)) if f.endswith('.png'))
    if not lite:
        for wid in wolf_index():
            files += ['assets/wolf/%s.png' % wid, 'assets/wolf/%s_dead.png' % wid]
    return files


def encode(args):
    rel, webp = args
    with open(os.path.join(ROOT, rel), 'rb') as f:
        raw = f.read()
    mime, data = 'image/png', raw
    if webp:
        im = Image.open(io.BytesIO(raw))
        alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
        buf = io.BytesIO()
        im.convert('RGBA' if alpha else 'RGB').save(buf, 'WEBP', lossless=True, method=4)
        if buf.tell() < len(raw):
            mime, data = 'image/webp', buf.getvalue()
    return rel, 'data:%s;base64,%s' % (mime, base64.b64encode(data).decode('ascii'))


def assets_script(lite, webp):
    files = image_list(lite)
    with ProcessPoolExecutor() as ex:
        pairs = list(ex.map(encode, [(f, webp) for f in files], chunksize=4))
    # 一张图一行：编辑器打开产物时不会因为一行几十 MB 卡死
    body = ',\n'.join('%s:%s' % (json.dumps(k), json.dumps(v)) for k, v in pairs)
    return '<script>\nwindow.SVA_ASSETS = {\n' + body + '\n};\n</script>\n', len(files)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--lite', action='store_true', help='不内联狼的精灵图')
    ap.add_argument('--png', action='store_true', help='图片保持 PNG，不转 WebP')
    a = ap.parse_args()
    lite, webp = a.lite, HAVE_WEBP and not a.png

    tag = r'<script src="([^"]+)"></script>'
    html = read('index.html').replace('<link rel="stylesheet" href="css/style.css">',
                                      '<style>\n' + read('css/style.css') + '\n</style>')
    left = re.search(r'\b(src|href)="(?!data:|https?:)[^"]*"', re.sub(tag, '', html))
    if left:
        raise SystemExit('index.html 里还有没法内联的本地引用：' + left.group(0))

    def inline(m):
        # --lite 不带图集：清单置空，加载器就不会去请求不存在的文件
        code = 'window.SVA_WOLF_INDEX = [];' if lite and m.group(1) == 'assets/wolf/index.js' else read(m.group(1))
        # 注释/字符串里出现 </script 会让浏览器提前结束 <script> 块；写成 <\/script（JS 里 \/ 就是 /，语义不变）
        return '<script>\n' + code.replace('</script', '<\\/script') + '\n</script>'

    html = re.sub(tag, inline, html)
    assets, n = assets_script(lite, webp)
    first = html.index('<script>')                       # 放在所有游戏脚本之前
    html = html[:first] + assets + html[first:]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('已生成：%s（%.1f MB，内联图片 %d 张，%s）' % (OUT, os.path.getsize(OUT) / 1048576, n,
                                                 '无损 WebP' if webp else 'PNG'))


if __name__ == '__main__':
    main()
