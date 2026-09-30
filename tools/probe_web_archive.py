"""查 Internet Archive 上原版 CDN 的存档清单。

原 Qzone CDN（客户端 AS3 里写死的 `$_xc_publish` 常量）是
`http://app16488.imgcache.qzoneapp.com/app16488/static`，早已下线；
镜像站只能按完整路径取文件，配置类的东西（尤其带数值的 config.xml）多半只能从存档里找。

用法：
  python tools/probe_web_archive.py                 # 默认查 app16488.imgcache.qzoneapp.com
  python tools/probe_web_archive.py --host qqtdsheep.qzoneapp.com
  python tools/probe_web_archive.py --ext swf xml mp3
  python tools/probe_web_archive.py --save          # 把命中的 URL 列表写进 tdsheep_swf/extra/

CDX 接口一次最多几万行，超量会被截断，脚本会提示。
"""
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tdsheep_swf', 'extra')
UA = 'Mozilla/5.0 (compatible; tdsheep-asset-archiver/1.0)'

DEFAULT_HOSTS = ['app16488.imgcache.qzoneapp.com', 'qqtdsheep.qzoneapp.com',
                 'app16488.qzoneapp.com']
CDX = ('https://web.archive.org/cdx/search/cdx'
       '?url=%s&matchType=domain&fl=original,timestamp,statuscode,mimetype,length'
       '&collapse=urlkey&limit=%d')


def query(host, limit=4000, timeout=120):
    url = CDX % (urllib.parse.quote(host), limit)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'replace')


def main():
    args = sys.argv[1:]
    hosts = list(DEFAULT_HOSTS)
    if '--host' in args:
        hosts = args[args.index('--host') + 1].split(',')
    exts = None
    if '--ext' in args:
        exts = tuple('.' + e.lower().lstrip('.') for e in args[args.index('--ext') + 1:])
        exts = tuple(e for e in exts if not e.startswith('--'))
    limit = 4000
    if '--limit' in args:
        limit = int(args[args.index('--limit') + 1])

    allrows = []
    for host in hosts:
        try:
            txt = query(host, limit)
        except Exception as e:                                 # noqa: BLE001
            print('!! %s 查询失败：%s' % (host, e))
            continue
        rows = [l.split(' ', 4) for l in txt.splitlines() if l.strip()]
        print('%-38s 存档 %d 条%s' % (host, len(rows), '（可能被 limit 截断）' if len(rows) >= limit else ''))
        allrows += [(host,) + tuple(r) for r in rows]

    keep = []
    for r in allrows:
        url = r[1]
        if exts and not url.lower().split('?')[0].endswith(exts):
            continue
        keep.append(r)
    print('合计 %d 条，筛出 %d 条' % (len(allrows), len(keep)))

    # 按扩展名分组，方便看哪些类型值得挖
    from collections import Counter
    c = Counter(os.path.splitext(u.split('?')[0])[1].lower() for _h, u, *_ in allrows)
    print('扩展名分布：', c.most_common(20))
    for h, url, ts, status, mime, size in keep[:400]:
        print('   %-90s %s %s %s' % (url, ts, status, size))
    if len(keep) > 400:
        print('   …还有 %d 条' % (len(keep) - 400))

    if '--save' in args:
        os.makedirs(OUT, exist_ok=True)
        dst = os.path.join(OUT, 'web_archive_cdx.json')
        with open(dst, 'w', encoding='utf-8') as fh:
            json.dump([{'host': h, 'url': u, 'timestamp': ts, 'status': st,
                        'mime': mi, 'length': ln}
                       for h, u, ts, st, mi, ln in allrows],
                      fh, ensure_ascii=False, indent=1)
        print('清单写入', os.path.relpath(dst, ROOT))


if __name__ == '__main__':
    main()
