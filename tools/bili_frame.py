"""Grab single frames out of a bilibili video without downloading the whole file.

usage: python tools/bili_frame.py BV1xxxx 300 900 1800 --out tools/_video/ref

It asks yt-dlp for the direct stream url, then lets ffmpeg seek over HTTP.
"""
import argparse
import os
import subprocess
import sys

YTDLP = 'yt-dlp'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/122.0 Safari/537.36')
HEADERS = ('Referer: https://www.bilibili.com/\r\nUser-Agent: %s\r\n' % UA)


def stream_url(bvid):
    res = subprocess.run([YTDLP, '-g', '-f', 'bv*[height<=1080]/b[height<=1080]/b',
                          'https://www.bilibili.com/video/%s' % bvid],
                         capture_output=True, text=True, check=False)
    urls = [u for u in res.stdout.split() if u.startswith('http')]
    if not urls:
        raise SystemExit('no stream url for %s:\n%s' % (bvid, res.stderr[-500:]))
    return urls[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('bvid')
    ap.add_argument('times', nargs='+', type=float)
    ap.add_argument('--out', default='tools/_video/ref')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    for t in args.times:
        dst = os.path.join(args.out, '%s_%06.1f.png' % (args.bvid, t))
        url = stream_url(args.bvid)          # signed urls go stale, refresh per frame
        cmd = ['ffmpeg', '-loglevel', 'error', '-threads', '1', '-headers', HEADERS,
               '-i', url, '-ss', str(t), '-frames:v', '1', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
               '-y', dst]
        subprocess.run(cmd, check=False)
        print('%s -> %s' % (t, 'ok' if os.path.exists(dst) else 'FAIL'))


if __name__ == '__main__':
    main()
