"""Which original map art does each level of the B-site recording use?

For every extracted video frame, SIFT-match it against every map art (assets/map/m*.png plus the two
防线 maps) and keep the best RANSAC-inlier count and the similarity transform art->frame.
Outputs tools/_work/frame_art.json  {part: [ {frame, art, inl, s, tx, ty}, ... ]}
usage: python tools/map_match_frames.py
"""
import glob
import json
import os
import re
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART_DIRS = [os.path.join(ROOT, 'assets', 'map')]
EXTRA = {'mfx1': os.path.join(ROOT, 'tools', '_work', 'mfx1_raw.png'),
         'mfx2': os.path.join(ROOT, 'tools', '_work', 'mfx2_raw.png')}
OUT = os.path.join(ROOT, 'tools', '_work', 'frame_art.json')


def load_art(path, maxw=1100):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 4:
        a = im[:, :, 3:4].astype(np.float32) / 255
        bg = np.full(im[:, :, :3].shape, 128, np.float32)
        rgb = (im[:, :, :3] * a + bg * (1 - a)).astype(np.uint8)
    else:
        rgb = im
    k = min(1.0, maxw / rgb.shape[1])
    if k < 1:
        rgb = cv2.resize(rgb, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    return rgb, k


def main():
    sift = cv2.SIFT_create(nfeatures=4000)
    arts = {}
    for p in glob.glob(os.path.join(ROOT, 'assets', 'map', 'm*.png')):
        arts[os.path.splitext(os.path.basename(p))[0]] = p
    arts.update(EXTRA)
    feats = {}
    for mid, p in arts.items():
        rgb, k = load_art(p)
        g = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY)
        kp, des = sift.detectAndCompute(g, None)
        feats[mid] = (kp, des, k)
        print(mid, len(kp), 'kp, scale', round(k, 3))
    bf = cv2.BFMatcher()
    res = {}
    frames = sorted(glob.glob(os.path.join(ROOT, 'tools', '_video', 'ref_all', '*.png')) +
                    glob.glob(os.path.join(ROOT, 'tools', '_video', 'ref_open', '*.png')))
    for f in frames:
        m = re.search(r'_p(\d+)_t(\d+)', f)
        part, t = int(m.group(1)), int(m.group(2))
        im = cv2.imread(f)
        h, w = im.shape[:2]
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        # the game canvas: skip the site's top button strip and the white border
        g = g[40:h - 190, :]
        kp2, des2 = sift.detectAndCompute(g, None)
        best = None
        if des2 is None or len(kp2) < 20:
            res.setdefault(part, []).append({'frame': os.path.basename(f), 'art': None, 'inl': 0})
            continue
        for mid, (kp1, des1, k) in feats.items():
            mm = bf.knnMatch(des1, des2, k=2)
            good = [a for a, b in (x for x in mm if len(x) == 2) if a.distance < 0.72 * b.distance]
            if len(good) < 8:
                continue
            src = np.float32([kp1[a.queryIdx].pt for a in good]) / k        # art px
            dst = np.float32([kp2[a.trainIdx].pt for a in good])
            M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=6)
            if M is None:
                continue
            n = int(inl.sum())
            s = float(np.hypot(M[0, 0], M[1, 0]))
            if best is None or n > best['inl']:
                best = {'frame': os.path.basename(f), 'art': mid, 'inl': n, 's': round(s, 4),
                        'tx': round(float(M[0, 2]), 1), 'ty': round(float(M[1, 2] + 40), 1), 'good': len(good)}
        res.setdefault(part, []).append(best or {'frame': os.path.basename(f), 'art': None, 'inl': 0})
    json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('--- best per part')
    for part in sorted(res):
        b = max(res[part], key=lambda r: r['inl'])
        print('p%02d  %-5s inl=%-4d s=%s' % (part, b.get('art'), b['inl'], b.get('s')))


if __name__ == '__main__':
    main()
