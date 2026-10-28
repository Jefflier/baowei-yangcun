"""打包安卓 App 的侧载版：dist/保卫羊村怀旧服.apk（安卓 8.0 及以上可装；目标 API 37，按安卓 16 / 17 的新规矩适配）。
没有广告。上架 Google Play 的带广告版本用 Android Studio 打开 android/ 构建，见 docs/ANDROID_ADS.md。

用法：
  python tools/build_apk.py                               生成 dist/保卫羊村怀旧服.apk
  python tools/build_apk.py --keystore 我的.p12 --alias 名字 --storepass 密码 [--keypass 密码]   用自己的签名

只需要 Python 3.8+ 和 JDK 11–21（java / javac / keytool 在 PATH 里或设了 JAVA_HOME），**不需要** Android SDK、Gradle：
第一次运行会从 Maven Central 下载工具链（约 260 MB，按 SHA-256 校验，缓存在 tools/_android/，之后离线可用）：
  * apktool-cli 3.0.3 —— 只用它自带的 aapt2（编译资源、生成二进制 AndroidManifest）
  * Robolectric android-all-instrumented 17 —— 安卓 17（API 37）的框架类和资源表，相当于 SDK 里的 android.jar
  * dalvik-dx 16.0.1 —— .class → classes.dex
  * apksig 2.3.0 —— 谷歌 apksigner 的库本体，做 v2 签名和校验（android/ApkSign.java）
（谷歌自己的 dl.google.com / maven.google.com 在不少网络下连不上，这条路线只依赖 Maven Central。）

APK 里装的是：
  * classes.dex —— android/src 里的外壳：一个全屏 WebView（见 MainActivity.java 开头的说明），
    加上 android/sideload/java 里的空广告实现
  * assets/www/ —— 游戏本体，和目录版一模一样：index.html（末尾插入 android/app.js）、css、js、
    assets 下 index.html 引用的脚本，以及战斗底图 / 大厅与世界地图 / 狼图集的 PNG（按需加载，比单文件版省内存）
签名：默认用仓库里的 android/sideload.keystore（公开的侧载密钥，密码 baoweiyangcun）。谁重新打包都是同一个签名，
新版 APK 能直接覆盖安装、存档不丢；要上架应用商店请换成自己的密钥（换了密钥就得先卸载旧版）。
改版本号：改 android/version.properties（每次发新版 versionCode +1；Google Play 版也读它）。
"""
import argparse
import hashlib
import os
import re
import shutil
import stat
import struct
import subprocess
import sys
import time
import urllib.request
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build_single  # noqa: E402  复用它的图片清单（战斗底图 / 场景 / 狼图集）

APK = os.path.join(ROOT, 'dist', '保卫羊村怀旧服.apk')
SRC = os.path.join(ROOT, 'android')
CACHE = os.path.join(ROOT, 'tools', '_android')
WORK = os.path.join(CACHE, 'build')

PACKAGE = 'com.baoweiyangcun.huaijiu'   # 和 android/build.gradle.kts 的 applicationId 一致
MIN_SDK = 26          # 安卓 8.0
TARGET_SDK = 37       # 安卓 17
COMPILE_SDK = (37, '17')

KEYSTORE = os.path.join(SRC, 'sideload.keystore')
KEY_ALIAS = KEY_PASS = 'baoweiyangcun'

MAVEN = 'https://repo1.maven.org/maven2/'
TOOLCHAIN = {
    'apktool': ('org/apktool/apktool-cli/3.0.3/apktool-cli-3.0.3.jar',
                '29fc610eed9dd349e75d40fd5af02538e0118b08d56a61ef6f53f8256adadc9a'),
    'android': ('org/robolectric/android-all-instrumented/17-robolectric-15733970-i7/'
                'android-all-instrumented-17-robolectric-15733970-i7.jar',
                '30a15243ba9a6a016361876facc75432f4ec5db0f9e27d4984a4a6b167b432bd'),
    'dx': ('com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
           '1e4b645628e3bdb097b5331d669e177ef235a551582a8c646dbe36865e541907'),
    'apksig': ('com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
               '9637078c0016244e4be0941836295365a7e2e5b164c59cb7885783c40460bfee'),
}
# android-all-instrumented 的类实现了 Robolectric 的两个标记接口，编译时给 javac 两个空壳即可（不进 APK）
ROBO_STUBS = ('ShadowedObject', 'InstrumentedInterface')
# 已经是压缩格式的文件原样存（STORED，4 字节对齐），其它的 deflate
STORE_EXT = ('.png', '.webp', '.jpg', '.jpeg', '.gif', '.mp3', '.ogg', '.arsc')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def fetch(name):
    rel, digest = TOOLCHAIN[name]
    dst = os.path.join(CACHE, os.path.basename(rel))
    if os.path.exists(dst) and sha256(dst) == digest:
        return dst
    os.makedirs(CACHE, exist_ok=True)
    for i in range(6):
        try:
            print('下载 %s …' % os.path.basename(rel), flush=True)
            with urllib.request.urlopen(MAVEN + rel, timeout=120) as r, open(dst + '.part', 'wb') as f:
                shutil.copyfileobj(r, f, 1 << 20)
            break
        except OSError as e:          # Maven Central 偶尔限流（429），等一会儿再试
            if i == 5:
                raise SystemExit('下载失败：%s（%s）' % (MAVEN + rel, e))
            time.sleep(5 * (i + 1))
    if sha256(dst + '.part') != digest:
        os.remove(dst + '.part')
        raise SystemExit('校验失败：%s 的 SHA-256 不对' % rel)
    os.replace(dst + '.part', dst)
    return dst


def aapt2_path(apktool):
    plat = 'windows' if os.name == 'nt' else 'macosx' if sys.platform == 'darwin' else 'linux'
    member = 'prebuilt/%s/aapt2%s' % (plat, '.exe' if plat == 'windows' else '')
    dst = os.path.join(CACHE, 'aapt2-3.0.3-' + os.path.basename(member))
    if not os.path.exists(dst):
        with zipfile.ZipFile(apktool) as z, open(dst, 'wb') as f:
            f.write(z.read(member))
        os.chmod(dst, os.stat(dst).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return dst


def jdk_tool(name):
    home = os.environ.get('JAVA_HOME')
    exe = name + ('.exe' if os.name == 'nt' else '')
    if home and os.path.exists(os.path.join(home, 'bin', exe)):
        return os.path.join(home, 'bin', exe)
    p = shutil.which(name)
    if not p:
        raise SystemExit('没找到 %s：请安装 JDK 11–21（https://adoptium.net/），或设置 JAVA_HOME' % name)
    return p


def run(cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], **kw)
    if r.returncode:
        raise SystemExit('命令失败（%d）：%s' % (r.returncode, ' '.join(str(c) for c in cmd)))


def version():
    """android/version.properties → (versionCode, versionName)"""
    with open(os.path.join(SRC, 'version.properties'), encoding='utf-8') as f:
        kv = dict(l.strip().split('=', 1) for l in f if '=' in l and not l.lstrip().startswith('#'))
    return int(kv['versionCode']), kv['versionName']


def web_files():
    """(APK 里 assets/www/ 下的路径, 内容)：index.html 引用的样式和脚本 + 图片加载器按路径去取的 PNG"""
    html = build_single.read('index.html')
    refs = re.findall(r'<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"', html)
    local = [r for r in refs if not re.match(r'(data:|https?:|//)', r)]
    out = [('index.html', html.replace('</body>', '<script src="app.js"></script>\n</body>').encode('utf-8'))]
    with open(os.path.join(SRC, 'app.js'), 'rb') as f:
        out.append(('app.js', f.read()))
    for rel in local + build_single.image_list(lite=False):
        with open(os.path.join(ROOT, rel), 'rb') as f:
            out.append((rel, f.read()))
    return out


def zip_add(zf, name, data, store):
    """写一个条目；STORED 条目的数据按 4 字节对齐（同 zipalign：用 0xD935 扩展字段补齐）"""
    zi = zipfile.ZipInfo(name, date_time=(2008, 1, 1, 0, 0, 0))   # 固定时间戳：同样的输入打出同样的包
    if store:
        zi.compress_type = zipfile.ZIP_STORED
        pad = -(zf.fp.tell() + 30 + len(name.encode('utf-8')) + 6) % 4
        zi.extra = struct.pack('<HHH', 0xD935, 2 + pad, 4) + b'\0' * pad
    else:
        zi.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(zi, data, compresslevel=9)


def check_alignment(path):
    """签名后再查一遍：所有 STORED 条目（尤其 resources.arsc，目标 30+ 必须对齐）的数据起点都是 4 的倍数"""
    with zipfile.ZipFile(path) as z, open(path, 'rb') as f:
        for zi in z.infolist():
            if zi.compress_type != zipfile.ZIP_STORED:
                continue
            f.seek(zi.header_offset + 26)
            n, m = struct.unpack('<HH', f.read(4))
            if (zi.header_offset + 30 + n + m) % 4:
                raise SystemExit('对齐检查失败：' + zi.filename)
        arsc = z.getinfo('resources.arsc')
        if arsc.compress_type != zipfile.ZIP_STORED:
            raise SystemExit('resources.arsc 必须不压缩存放')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--keystore', default=KEYSTORE, help='PKCS12 密钥库（默认 android/sideload.keystore）')
    ap.add_argument('--alias', default=KEY_ALIAS)
    ap.add_argument('--storepass', default=KEY_PASS)
    ap.add_argument('--keypass', help='密钥密码（默认同 --storepass）')
    a = ap.parse_args()
    keypass = a.keypass or a.storepass

    java, javac = jdk_tool('java'), jdk_tool('javac')
    jars = {k: fetch(k) for k in TOOLCHAIN}
    aapt2 = aapt2_path(jars['apktool'])
    if not os.path.exists(a.keystore):
        if os.path.abspath(a.keystore) != KEYSTORE:
            raise SystemExit('找不到密钥库：' + a.keystore)
        print('android/sideload.keystore 不在了，新生成一个（注意：签名变了，旧版 App 要先卸载才能装新版）')
        run([jdk_tool('keytool'), '-genkeypair', '-keystore', KEYSTORE, '-storetype', 'PKCS12',
             '-storepass', KEY_PASS, '-keypass', KEY_PASS, '-alias', KEY_ALIAS, '-keyalg', 'RSA', '-keysize', '2048',
             '-validity', '36500', '-dname', 'CN=Baowei Yangcun Huaijiu (sideload),O=baowei-yangcun fan project'])

    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK)
    w = lambda *p: os.path.join(WORK, *p)

    # 1. 资源 + 清单：aapt2 编译 android/res，对着安卓 17 的框架资源表链接。
    #    清单里不写包名（Gradle 要求写在 build.gradle.kts 里），这里补上再交给 aapt2
    with open(os.path.join(SRC, 'AndroidManifest.xml'), encoding='utf-8') as f:
        manifest = re.sub(r'<manifest\b', '<manifest package="%s"' % PACKAGE, f.read(), count=1)
    with open(w('AndroidManifest.xml'), 'w', encoding='utf-8') as f:
        f.write(manifest)
    version_code, version_name = version()
    run([aapt2, 'compile', '--dir', os.path.join(SRC, 'res'), '-o', w('res.zip')])
    run([aapt2, 'link', '-o', w('base.apk'), '-I', jars['android'],
         '--manifest', w('AndroidManifest.xml'),
         '--min-sdk-version', MIN_SDK, '--target-sdk-version', TARGET_SDK,
         '--version-code', version_code, '--version-name', version_name,
         '--compile-sdk-version-code', COMPILE_SDK[0], '--compile-sdk-version-name', COMPILE_SDK[1],
         w('res.zip')])

    # 2. 代码：javac（对着 API 37 的框架类；dx 只认 Java 8 的 class 文件）→ dx → classes.dex
    stub_dir = w('robo_stubs', 'org', 'robolectric', 'internal', 'bytecode')
    os.makedirs(stub_dir)
    for n in ROBO_STUBS:
        with open(os.path.join(stub_dir, n + '.java'), 'w') as f:
            f.write('package org.robolectric.internal.bytecode; public interface %s {}\n' % n)
    run([javac, '--release', '8', '-Xlint:-options', '-d', w('robo_classes')]
        + [os.path.join(stub_dir, n + '.java') for n in ROBO_STUBS])
    sources = [os.path.join(d, f) for top in ('src', os.path.join('sideload', 'java'))
               for d, _, fs in os.walk(os.path.join(SRC, top)) for f in fs if f.endswith('.java')]
    run([javac, '--release', '8', '-encoding', 'UTF-8', '-Xlint:all,-options',
         '-cp', os.pathsep.join([jars['android'], w('robo_classes')]), '-d', w('classes')] + sources)
    run([java, '-cp', jars['dx'], 'com.android.dx.command.Main', '--dex', '--min-sdk-version=%d' % MIN_SDK,
         '--output=' + w('classes.dex'), w('classes')])

    # 3. 组装未签名的 APK：清单和资源（来自 aapt2）+ classes.dex + assets/www/（游戏本体）
    files = web_files()
    with zipfile.ZipFile(w('base.apk')) as base, zipfile.ZipFile(w('unsigned.apk'), 'w') as zf:
        for zi in base.infolist():
            zip_add(zf, zi.filename, base.read(zi), zi.compress_type == zipfile.ZIP_STORED)
        with open(w('classes.dex'), 'rb') as f:
            zip_add(zf, 'classes.dex', f.read(), False)
        for rel, data in files:
            zip_add(zf, 'assets/www/' + rel, data, rel.lower().endswith(STORE_EXT))

    # 4. v2 签名 + 校验，再查对齐、用 aapt2 读一遍清单
    os.makedirs(os.path.dirname(APK), exist_ok=True)
    # apksig 2.3.0 还在用 JDK 内部的 sun.security.*，新版 JDK 要显式放行
    opens = [x for p in ('x509', 'pkcs', 'util') for x in ('--add-exports', 'java.base/sun.security.%s=ALL-UNNAMED' % p)]
    run([java] + opens + ['-cp', jars['apksig'], os.path.join(SRC, 'ApkSign.java'),
         w('unsigned.apk'), w('signed.apk'), a.keystore, a.storepass, a.alias, keypass, MIN_SDK])
    check_alignment(w('signed.apk'))
    shutil.copyfile(w('signed.apk'), APK)        # 先签到纯英文路径再拷过去：有的系统上 Java 处理不了中文文件名参数
    badging = subprocess.run([aapt2, 'dump', 'badging', w('signed.apk')], capture_output=True, text=True, encoding='utf-8').stdout
    print('\n'.join(l for l in badging.splitlines() if re.match(r'(package|minSdk|targetSdk|application-label:)', l)))
    print('已生成：%s（%.1f MB，游戏文件 %d 个）' % (APK, os.path.getsize(APK) / 1048576, len(files)))


if __name__ == '__main__':
    main()
