"""Search Bing Images and download reference pictures (for hand-modelling art).

usage: python tools/fetch_refs.py "保卫羊村 狼" out_dir [count]
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/122.0 Safari/537.36')


def search(query, count):
    """Baidu image search JSON api (thumbURL / middleURL are direct image links)."""
    out = []
    for pn in (0, 30, 60, 90):
        url = ('https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592'
               '&is=&fp=result&word=%s&pn=%d&rn=30&gsm=1e' % (urllib.parse.quote(query), pn))
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9',
                                                   'Referer': 'https://image.baidu.com/'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode('utf-8', 'replace')
                                  .replace('\\\'', "'"))
        except Exception:  # noqa: BLE001 - fall through with whatever we have
            break
        for item in data.get('data') or []:
            if not isinstance(item, dict):
                continue
            full = item.get('middleURL') or item.get('hoverURL') or item.get('thumbURL')
            thumb = item.get('thumbURL') or full
            if full:
                out.append((full, thumb))
            if len(out) >= count:
                return out
    return out


def main():
    query, outdir = sys.argv[1], sys.argv[2]
    count = int(sys.argv[3]) if len(sys.argv) > 3 else 40
    os.makedirs(outdir, exist_ok=True)
    hits = search(query, count)
    print('found %d urls' % len(hits))
    saved = 0
    for i, (full, thumb) in enumerate(hits):
        for url, tag in ((full, ''), (thumb, '_t')):
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
            if ext not in ('.jpg', '.jpeg', '.png', '.gif', '.webp'):
                ext = '.jpg'
            name = os.path.join(outdir, 'ref%03d%s%s' % (i, tag, ext))
            if os.path.exists(name):
                continue
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=25) as r:
                    data = r.read()
                if len(data) < 3000:
                    continue
                with open(name, 'wb') as fh:
                    fh.write(data)
                saved += 1
            except Exception:  # noqa: BLE001 - plenty of dead links, keep going
                continue
    print('saved %d files into %s' % (saved, outdir))


if __name__ == '__main__':
    main()
