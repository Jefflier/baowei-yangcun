# -*- coding: utf-8 -*-
"""把「羊村布阵工具」文件夹打成分享包 羊村布阵工具.zip

规则：
  * 只打包这个文件夹里的内容，压缩包内顶层目录就是「羊村布阵工具」
  * 不包含 refs/（布局参考图，工具里用不上、分享包也不需要）
  * 不包含 _build/media、__pycache__ 这类生成缓存
  * 教程 / 实例视频（放在文件夹里的 *.mp4 / *.mkv 等）会自动一起打进去
  * 压缩包内的文件名按 UTF-8 写入，避免中文名在资源管理器里乱码

用法： python _build/make_package.py [输出路径]
      不给输出路径时，默认写到 ../羊村布阵工具.zip
"""

import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # .../羊村布阵工具
PROJ = os.path.dirname(ROOT)                                          # .../羊村工具-齐民要术
DEFAULT_OUT = os.path.join(PROJ, "羊村布阵工具.zip")

SKIP_DIRS = {
    os.path.join(ROOT, "refs"),
    os.path.join(ROOT, "_build", "media"),
    os.path.join(ROOT, "_build", "__pycache__"),
    os.path.join(ROOT, "__pycache__"),
}


def main():
    OUT = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    OUT = os.path.abspath(OUT)
    if os.path.exists(OUT):
        os.remove(OUT)
    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if os.path.join(base, d) not in SKIP_DIRS]
            for name in sorted(files):
                path = os.path.join(base, name)
                rel = os.path.relpath(path, PROJ).replace(os.sep, "/")
                z.write(path, rel)
                count += 1
    print("打包完成：%s（%d 个文件，%.1f MB）" % (OUT, count, os.path.getsize(OUT) / 1048576.0))


if __name__ == "__main__":
    main()
