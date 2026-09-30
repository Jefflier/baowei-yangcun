# Build game-ready sprite sheets for the original wolf models (ASCII only on purpose:
# PowerShell 5.1 reads .ps1 as ANSI, so non-ASCII here would corrupt the parser).
#
#   powershell -ExecutionPolicy Bypass -File tools\build_wolves.ps1
#   powershell -ExecutionPolicy Bypass -File tools\build_wolves.ps1 -Cell 96 -Batch 2
#
# Steps: export_wolves.py writes one big SVG per batch of wolves (4 dirs x 24 walk frames
#        + death frames) -> headless Chrome rasterises it -> slice_wolves.py cuts
#        assets/wolf/<id>.png (walk 24x4) and <id>_dead.png (death 12x4).
param(
  [int]$Cell = 96,
  [int]$Batch = 8,
  [string]$Only = "",
  [switch]$KeepSVG,
  [string]$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$extra = @()
if ($Only -ne "") { $extra += @('--only', $Only) }
Remove-Item tools\_wolfwork\sheet*.png, tools\_wolfwork\sheet*.svg -Force -ErrorAction SilentlyContinue
python tools/export_wolves.py --batch $Batch --cell $Cell --svg-only @extra
if ($LASTEXITCODE -ne 0) { throw "export_wolves.py failed with exit code $LASTEXITCODE" }

$meta = Get-Content tools\_wolfwork\pages.json -Raw | ConvertFrom-Json
if (-not $meta -or -not $meta.pages -or -not $meta.sizes) { throw "tools\_wolfwork\pages.json missing or malformed" }
$n = @($meta.pages).Count
Write-Host "[2/3] rasterising $n pages with Chrome"
# fresh profile per run: reusing one makes later launches merge into the running instance
# (they then never write a screenshot)
$profile = Join-Path $env:TEMP ("wolfbuild_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
for ($i = 0; $i -lt $n; $i++) {
  $w = $meta.sizes[$i][0]; $h = $meta.sizes[$i][1]
  $out = "$root\tools\_wolfwork\sheet$i.png"
  if (Test-Path $out) { Remove-Item -LiteralPath $out -Force }
  $ok = $false
  foreach ($budget in 30000, 90000) {
    & $Chrome --headless=new --no-sandbox --disable-gpu --in-process-gpu --no-first-run `
      --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=$budget `
      --default-background-color=00000000 `
      --user-data-dir="$profile" --window-size="$w,$h" `
      --screenshot="$out" "file:///$($root.Replace('\','/'))/tools/_wolfwork/sheet$i.svg" 2>&1 | Out-Null
    if ((Test-Path $out) -and ((Get-Item $out).Length -gt 20000)) { $ok = $true; break }
    Write-Host "  retry sheet$i (virtual-time-budget $budget)"
  }
  Write-Host ("  sheet{0}: {1}x{2} {3}" -f $i, $w, $h, $(if ($ok) { "ok" } else { "FAILED" }))
  if ($ok -and -not $KeepSVG) { Remove-Item -LiteralPath "$root\tools\_wolfwork\sheet$i.svg" -Force }
}

Write-Host "[3/3] slicing into assets\wolf"
python tools/slice_wolves.py
if ($LASTEXITCODE -ne 0) { throw "slice_wolves.py failed with exit code $LASTEXITCODE" }
Write-Host "done: assets/wolf/*.png"
