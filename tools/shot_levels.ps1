# 无头 Chrome 批量截战斗画面（需要先 python tools/devserver.py 8123）。
#   powershell -ExecutionPolicy Bypass -File tools/shot_levels.ps1 -names "0,11,30"
#   -names 是关卡下标（0 起，data.js 的 maps 顺序）；-extra 是 tools/shot.html 的参数：
#     rich=1 银币管够；towers=N 摆 N 座塔；walls=N 撒 N 堵墙；sim=S 推演 S 秒；live=1 不暂停（无「暂停」遮罩）
#   输出 tools/_preview/shots/L<下标>.png
param([string]$names = "0", [string]$extra = "rich=1&towers=6&walls=10&sim=10&wait=1200", [int]$budget = 9000)
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "tools\_preview\shots"; New-Item -ItemType Directory -Force $out | Out-Null
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
foreach ($m in $names.Split(",")) {
  $prof = Join-Path $env:TEMP ("svshot_" + [guid]::NewGuid().ToString("N").Substring(0,6)); New-Item -ItemType Directory -Force $prof | Out-Null
  $png = Join-Path $out "L$m.png"
  $url = "http://localhost:8123/tools/shot.html?go=battle&map=$m&$extra"
  Start-Process -Wait -FilePath $chrome -ArgumentList @("--headless=new","--no-sandbox","--disable-gpu","--allow-file-access-from-files","--user-data-dir=$prof","--virtual-time-budget=$budget","--window-size=1284,724","--screenshot=$png",$url)
  Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
  "$m -> $png"
}
