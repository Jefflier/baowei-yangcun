# -*- coding: utf-8 -*-
"""扫「保卫羊村怀旧论坛」（Discuz）的版块帖子列表，找资料 / 数据 / 设定帖。

两个站其实是同一批人：
  https://www.tdsheepvillage.com/   （主站）
  http://www.kingdowin.com/         （开发方域名，同一个 Discuz，fid 1..4）

用法：
  python tools/forum_scan.py                      # 列出两个站各版块的帖子标题
  python tools/forum_scan.py --grep 百科 数据 数值
  python tools/forum_scan.py --thread 8468        # 抓某个帖子的正文
  python tools/forum_scan.py --thread 8468 --site kingdowin

抓取用 curl.exe（Windows 自带）：开发方站的 chunked 编码有问题，urllib 读不全，
而且它挂在 Cloudflare 后面，需要正常 UA。
"""
import html
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '_refs', 'forum')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')

SITES = [
    ('tdsheep', 'https://www.tdsheepvillage.com'),
    ('kingdowin', 'http://www.kingdowin.com'),
]
FIDS = [1, 2, 3, 4, 5, 6, 7, 8]


def fetch(url, cache_key, fresh=False):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, cache_key)
    if not fresh and os.path.exists(dst) and os.path.getsize(dst) > 0:
        return open(dst, encoding='utf-8', errors='replace').read()
    tmp = dst + '.tmp'
    subprocess.run(['curl.exe', '-s', '-L', '-m', '30', '-A', UA, '-o', tmp, url],
                   check=False)
    data = open(tmp, 'rb').read() if os.path.exists(tmp) else b''
    if data:
        os.replace(tmp, dst)
    return data.decode('utf-8', errors='replace')


def threads(txt):
    """→ [(tid, 标题)]"""
    out = []
    seen = set()
    pat = r'<a href="forum\.php\?mod=viewthread&amp;tid=(\d+)[^"]*"[^>]*>(.*?)</a>'
    for m in re.finditer(pat, txt, re.S):
        tid = m.group(1)
        title = html.unescape(re.sub(r'<[^>]+>', '', m.group(2)).strip())
        if not title or title.isdigit() or tid in seen:
            continue
        seen.add(tid)
        out.append((tid, title))
    return out


def thread_text(txt):
    posts = re.findall(r'<td class="t_f"[^>]*>(.*?)</td>', txt, re.S)
    out = []
    for p in posts:
        p = re.sub(r'<br\s*/?>', '\n', p)
        p = re.sub(r'<script.*?</script>', '', p, flags=re.S)
        p = re.sub(r'<[^>]+>', '', p)
        p = re.sub(r'\n{3,}', '\n\n', html.unescape(p)).strip()
        if p:
            out.append(p)
    return out


def main():
    args = sys.argv[1:]
    fresh = '--fresh' in args
    if '--thread' in args:
        tid = args[args.index('--thread') + 1]
        key = args[args.index('--site') + 1] if '--site' in args else 'tdsheep'
        base = dict(SITES)[key]
        txt = fetch('%s/forum.php?mod=viewthread&tid=%s' % (base, tid),
                    '%s_t%s.html' % (key, tid), fresh)
        m = re.search(r'<title>(.*?)</title>', txt, re.S)
        print('标题：', html.unescape(m.group(1)).strip() if m else '?')
        for i, p in enumerate(thread_text(txt)):
            print('--- 第 %d 楼 ---' % (i + 1))
            print(p[:4000])
        return

    grep = []
    if '--grep' in args:
        grep = [g for g in args[args.index('--grep') + 1:] if not g.startswith('--')]
    for key, base in SITES:
        for fid in FIDS:
            txt = fetch('%s/forum.php?mod=forumdisplay&fid=%d' % (base, fid),
                        '%s_f%d.html' % (key, fid), fresh)
            rows = threads(txt)
            if not rows:
                continue
            print('=== %s fid=%d  %d 帖' % (key, fid, len(rows)))
            for tid, title in rows:
                if grep and not any(g in title for g in grep):
                    continue
                print('   %-6s %s' % (tid, title))


if __name__ == '__main__':
    main()
