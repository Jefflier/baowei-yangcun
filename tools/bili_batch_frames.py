"""Batch-grab frames out of a multi-part bilibili video (one part per map).

`tools/bili_frame.py` resolves the stream url once per frame, which is slow when you want
frames from all 45 parts of a playthrough collection. This resolves once per part and
takes several frames from it.

usage:
  python tools/bili_batch_frames.py BV1CusDeKEN8 --parts 1-45 --at 60,120,180 \
         --out tools/_video/ref_all
  python tools/bili_batch_frames.py BV1CusDeKEN8 --parts 3,7,12 --at 40 --out tools/_video/ref_x

Needs yt-dlp + ffmpeg on PATH. Streams from bilibili expire, so the url is refreshed per part.
"""
import argparse
import os
import subprocess

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/122.0 Safari/537.36')
HEADERS = 'Referer: https://www.bilibili.com/\r\nUser-Agent: %s\r\n' % UA


def parse_range(spec, top):
    out = []
    for part in spec.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        elif part:
            out.append(int(part))
    return [p for p in out if 1 <= p <= top]


def stream_url(bvid, p):
    res = subprocess.run(['yt-dlp', '-g', '-f', 'bv*[height<=1080]/b[height<=1080]/b',
                          'https://www.bilibili.com/video/%s?p=%d' % (bvid, p)],
                         capture_output=True, text=True, check=False)
    urls = [u for u in res.stdout.split() if u.startswith('http')]
    return urls[0] if urls else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('bvid')
    ap.add_argument('--parts', default='1')
    ap.add_argument('--top', type=int, default=64)
    ap.add_argument('--at', default='60')
    ap.add_argument('--out', default='tools/_video/ref_all')
    args = ap.parse_args()

    parts = parse_range(args.parts, args.top)
    times = [float(t) for t in args.at.split(',') if t.strip()]
    os.makedirs(args.out, exist_ok=True)
    ok = 0
    for p in parts:
        url = stream_url(args.bvid, p)
        if not url:
            print('p%-3d no stream' % p)
            continue
        for t in times:
            dst = os.path.join(args.out, '%s_p%02d_t%05.0f.png' % (args.bvid, p, t))
            if os.path.exists(dst):
                ok += 1
                continue
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-threads', '1', '-headers', HEADERS,
                            '-ss', str(t), '-i', url, '-frames:v', '1',
                            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-y', dst], check=False)
            if os.path.exists(dst):
                ok += 1
            else:
                print('p%-3d t%-5.0f FAIL' % (p, t))
        print('p%-3d done' % p)
    print('grabbed %d frames -> %s' % (ok, args.out))


if __name__ == '__main__':
    main()
