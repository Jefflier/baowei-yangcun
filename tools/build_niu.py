"""把《牛来攻城》打包成单个 HTML（便于分享）。
用法：python tools/build_niu.py   → 生成 dist/牛来攻城.html

niulai/index.html 引用了保卫羊村的 core.js / audio.js / 原作音效 / 原作矢量美术（../js、../assets），
这里全部内联进一个文件；原作矢量包只保留本作用到的符号（塔全要，建筑/障碍/羊/狼道具各取几个），
体积比全量内联小一半多。
"""
import json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
GAME = os.path.join(ROOT, 'niulai')

# 原作矢量包：库名 → 本作用到的符号（None = 全要）
KEEP = {
    'tower': None,
    'building': ['qiang', 'niulang', 'zhinv', 'panlong'],
    'obstacle': ['zhangai_shu1', 'zhangai_shu2', 'zhangai_shu3', 'zhangai_shitou1', 'zhangai_shitou2', 'zhangai_shitou3'],
    'sheep': ['sheepHigh', 'sheepAfraid', 'sheepCry', 'sheepAnger'],
    'wolfui': ['balloon'],
}


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def trim_art(code):
    """window.SVA_ART["lib"] = {...}; → 只留 KEEP 里的符号"""
    m = re.search(r'window\.SVA_ART\["(\w+)"\]\s*=\s*', code)
    if not m or m.group(1) not in KEEP or KEEP[m.group(1)] is None:
        return code
    lib = m.group(1)
    body = code[m.end():].rstrip().rstrip(';')
    data = json.loads(body)
    kept = {k: v for k, v in data.items() if k in KEEP[lib]}
    missing = set(KEEP[lib]) - set(kept)
    if missing:
        raise SystemExit('素材库 %s 里缺少符号：%s' % (lib, ', '.join(sorted(missing))))
    head = code[:m.start()]
    return head + 'window.SVA_ART["%s"] = %s;\n' % (lib, json.dumps(kept, ensure_ascii=False, separators=(',', ':')))


def main():
    html = read(os.path.join(GAME, 'index.html'))
    css = read(os.path.join(GAME, 'css', 'niu.css'))
    html = html.replace('<link rel="stylesheet" href="css/niu.css">', '<style>\n' + css + '\n</style>')

    def inline(m):
        src = m.group(1)
        code = read(os.path.normpath(os.path.join(GAME, src)))
        if '/assets/art/' in '/' + src.replace('\\', '/'):
            code = trim_art(code)
        # 注释/字符串里出现 </script 会提前结束 <script> 块，写成 <\/script（JS 语义不变）
        code = code.replace('</script', '<\\/script')
        return '<script>\n' + code + '\n</script>'

    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    out_dir = os.path.join(ROOT, 'dist')
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, '牛来攻城.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('已生成：%s（%.0f KB）' % (out, os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
