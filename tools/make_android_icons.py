"""从 launcher/winres/icon256.png（exe 的图标）生成安卓的自适应图标：android/res/mipmap-*/。

用法：python tools/make_android_icons.py      （需要 Pillow；生成的 PNG 已经提交，换图标时才用跑）

自适应图标是 108dp 的画布，系统按各家桌面的形状（圆、圆角方、水滴…）裁掉外圈，只保证中间直径 66dp 不被裁：
  * 背景层：纯色 @color/ic_launcher_background（徽章外圈的木头色 #8a5a2c），裁到哪都和外圈接得上；
  * 前景层：整枚徽章，外圈直径 76dp，里面的金色圆盘（羊在里面）正好落在 66dp 安全区内；
  * 单色层（安卓 13+ 的「主题图标」）：把金色底和深色描边抠掉，剩下羊的剪影，眼睛、鼻子、嘴是镂空的。
"""
import os

from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, 'launcher', 'winres', 'icon256.png')
RES = os.path.join(ROOT, 'android', 'res')
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
BADGE_DP = 76          # 徽章外圈直径
MONO_DP = 52           # 单色剪影的最长边


def sheep_mask(im):
    """羊的剪影：金色圆盘以内、不是金色底、也不是深色描边的像素"""
    px = im.load()
    w, h = im.size
    m = Image.new('L', im.size, 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128 or ((x - w / 2 + .5) ** 2 + (y - h / 2 + .5) ** 2) ** .5 > 109:
                continue
            gold = r > 200 and g > 150 and b < 175 and r - b > 70 and abs(r - g) < 70
            if not gold and 0.3 * r + 0.59 * g + 0.11 * b >= 125:
                mp[x, y] = 255
    return m.filter(ImageFilter.MedianFilter(3))


def place(layer, size_px, canvas_px):
    out = Image.new('RGBA', (canvas_px, canvas_px), (0, 0, 0, 0))
    layer = layer.resize((size_px, size_px) if layer.width == layer.height else
                         (round(layer.width * size_px / max(layer.size)), round(layer.height * size_px / max(layer.size))),
                         Image.LANCZOS)
    out.paste(layer, ((canvas_px - layer.width) // 2, (canvas_px - layer.height) // 2), layer)
    return out


def main():
    im = Image.open(SRC).convert('RGBA')
    badge = im.crop(im.getbbox())
    mask = sheep_mask(im)
    sheep = Image.new('RGBA', im.size, (255, 255, 255, 0))
    sheep.putalpha(mask)
    sheep = sheep.crop(mask.getbbox())
    for name, k in DENSITIES.items():
        d = os.path.join(RES, 'mipmap-' + name)
        os.makedirs(d, exist_ok=True)
        canvas = round(108 * k)
        place(badge, round(BADGE_DP * k), canvas).save(os.path.join(d, 'ic_launcher_foreground.png'), optimize=True)
        place(sheep, round(MONO_DP * k), canvas).save(os.path.join(d, 'ic_launcher_monochrome.png'), optimize=True)
    print('已生成：android/res/mipmap-*/ic_launcher_{foreground,monochrome}.png')


if __name__ == '__main__':
    main()
