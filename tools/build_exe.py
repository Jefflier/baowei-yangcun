"""打包 Windows 程序：dist/保卫羊村怀旧服.exe（一个文件，双击即玩，不用安装）。

用法：
  python tools/build_exe.py            先跑 build_single.py 生成单文件版，再打成 exe
  python tools/build_exe.py --no-html  直接用现成的 dist/保卫羊村怀旧服.html

需要 Go 1.21+（https://go.dev/dl/），Linux / macOS 上也能直接交叉编译出 Windows 的 exe。
exe 本身是 launcher/ 里的启动器：把游戏页面 gzip 后嵌进去，运行时在 127.0.0.1 起一个本地服务，
再用 Edge 的应用模式开一个独立窗口（详见 launcher/main.go）。
图标 / 版本信息在 launcher/rsrc_windows_amd64.syso，改了 launcher/winres/ 后用 go-winres make 重新生成。
"""
import argparse
import base64
import gzip
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
HTML = os.path.join(ROOT, 'dist', '保卫羊村怀旧服.html')
EXE = os.path.join(ROOT, 'dist', '保卫羊村怀旧服.exe')
LAUNCHER = os.path.join(ROOT, 'launcher')

# 只给 exe 版加的两样东西：窗口 / 任务栏图标，和给启动器报平安的心跳（启动器据此在窗口关掉后退出）
HEARTBEAT = """<script>
/* exe 启动器（launcher/main.go）用：页面开着就每 5 秒报一次平安，关窗口时道别 */
(function () {
  // 心跳用 GET（连接被关掉时浏览器会自动重试，POST 不会）；读掉响应，不然控制台会记成「请求被取消」
  function alive() { try { fetch('/__alive', { cache: 'no-store' }).then(function (r) { return r.text(); }).catch(function () {}); } catch (e) {} }
  alive();
  setInterval(alive, 5000);
  addEventListener('pagehide', function () { if (navigator.sendBeacon) navigator.sendBeacon('/__bye'); });
})();
</script>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--no-html', action='store_true', help='不重新生成单文件版')
    a = ap.parse_args()

    go = shutil.which('go')
    if not go:
        sys.exit('没找到 Go：请先安装 https://go.dev/dl/ （1.21 或更新）')
    if not a.no_html:
        subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build_single.py')], check=True)

    with open(HTML, encoding='utf-8') as f:
        html = f.read()
    with open(os.path.join(LAUNCHER, 'winres', 'icon64.png'), 'rb') as f:
        icon = '<link rel="icon" href="data:image/png;base64,%s">\n' % base64.b64encode(f.read()).decode('ascii')
    head, body = html.index('</head>'), html.rindex('</body>')
    html = html[:head] + icon + html[head:body] + HEARTBEAT + html[body:]
    with open(os.path.join(LAUNCHER, 'game.html.gz'), 'wb') as f:
        f.write(gzip.compress(html.encode('utf-8'), 9, mtime=0))

    env = dict(os.environ, GOOS='windows', GOARCH='amd64', CGO_ENABLED='0')
    subprocess.run([go, 'build', '-trimpath', '-ldflags', '-s -w -H windowsgui', '-o', EXE, '.'],
                   cwd=LAUNCHER, env=env, check=True)
    print('已生成：%s（%.1f MB）' % (EXE, os.path.getsize(EXE) / 1048576))


if __name__ == '__main__':
    main()
