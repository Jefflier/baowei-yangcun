"""Search bilibili for reference gameplay videos.

usage: python tools/bili_search.py "保卫羊村" [pages] [--save tools/_video/_search.txt]

Windows 控制台默认是 GBK，直接 print 中文会乱码；--save 会把结果用 UTF-8 写到文件。
"""
import io
import json
import sys
import urllib.parse
import urllib.request
import http.cookiejar

try:                                    # 控制台能直接看中文就看，不能就退回 ascii
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
except Exception:                       # noqa: BLE001
    pass

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/122.0 Safari/537.36')
HEADERS = [
    ('User-Agent', UA),
    ('Referer', 'https://www.bilibili.com/'),
    ('Accept', 'application/json, text/plain, */*'),
    ('Accept-Language', 'zh-CN,zh;q=0.9'),
    ('Origin', 'https://www.bilibili.com'),
]

OPENER = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def warmup():
    """bilibili's WAF wants a buvid3 cookie before it answers api calls."""
    req = urllib.request.Request('https://www.bilibili.com/', headers=dict(HEADERS))
    try:
        OPENER.open(req, timeout=30).read(2048)
    except Exception:  # noqa: BLE001 - the cookie is set either way
        pass


def search(keyword, page=1):
    url = ('https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=%s&page=%d'
           % (urllib.parse.quote(keyword), page))
    req = urllib.request.Request(url, headers=dict(HEADERS))
    with OPENER.open(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8', 'replace'))


def main():
    args = sys.argv[1:]
    save = None
    if '--save' in args:
        i = args.index('--save')
        save = args[i + 1]
        del args[i:i + 2]
    keyword = args[0]
    pages = int(args[1]) if len(args) > 1 else 1
    warmup()
    seen = set()
    rows = []
    for p in range(1, pages + 1):
        data = search(keyword, p)
        for v in (data.get('data') or {}).get('result') or []:
            bvid = v.get('bvid')
            if not bvid or bvid in seen:
                continue
            seen.add(bvid)
            title = (v.get('title') or '').replace('<em class="keyword">', '').replace('</em>', '')
            row = '%-14s %-9s %8s  %s' % (bvid, v.get('duration'), v.get('play'), title[:70])
            rows.append(row)
            print(row)
    print('total', len(seen))
    if save:
        import os
        os.makedirs(os.path.dirname(save), exist_ok=True)
        with open(save, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(rows))
        print('saved', save)


if __name__ == '__main__':
    main()
