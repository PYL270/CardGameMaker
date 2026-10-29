<#
  CardGameMaker - icon factory
  ------------------------------------------------------------------
  Single source of truth : branding/icon-base.png  (512x512 master artwork)
  Generates              : web/PWA icons, Android mipmaps, app.ico, desktop shortcut icon
  Idempotent             : skips all work when the base art hash is unchanged.
                           Pass -Force to rebuild unconditionally.

  Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make-icons.ps1 [-Force]
#>
param(
  [string]$Root = '',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }
$Root = (Resolve-Path $Root).Path

$basePath   = Join-Path $Root 'branding\icon-base.png'
$statePath  = Join-Path $Root 'branding\.icons-state.json'
$webDir     = Join-Path $Root 'public\icons'
$resDir     = Join-Path $Root 'android\app\src\main\res'
$valuesDir  = Join-Path $resDir 'values'
$icoPath    = Join-Path $Root 'app.ico'
$lnkPath    = Join-Path $env:USERPROFILE 'Desktop\CardGameMaker.lnk'

if (-not (Test-Path $basePath)) {
  Write-Error "Base artwork not found: $basePath"
  exit 1
}

# ---------------------------------------------------------------- fingerprint
$baseHash = (Get-FileHash $basePath -Algorithm SHA256).Hash
$prevHash = ''
if (Test-Path $statePath) {
  try { $prevHash = (Get-Content $statePath -Raw | ConvertFrom-Json).hash } catch { $prevHash = '' }
}

$required = @(
  (Join-Path $webDir 'icon-512.png'),
  (Join-Path $webDir 'icon-192.png'),
  (Join-Path $webDir 'icon-48.png'),
  (Join-Path $resDir 'mipmap-xxxhdpi\ic_launcher.png'),
  (Join-Path $resDir 'mipmap-xxxhdpi\ic_launcher_foreground.png'),
  $icoPath
)
$missing = @($required | Where-Object { -not (Test-Path $_) })

if (-not $Force -and $prevHash -eq $baseHash -and $missing.Count -eq 0) {
  Write-Output "icons: up to date ($($baseHash.Substring(0,8)))"
  exit 0
}

Write-Output "icons: rebuilding from icon-base.png ($($baseHash.Substring(0,8)))"

$base = [System.Drawing.Image]::FromFile($basePath)

# ---------------------------------------------------------------- icon renderer
function New-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($base, 0, 0, $size, $size)
  $g.Dispose()
  return $bmp
}

function Save-Png($bmp, [string]$outPath) {
  $dir = Split-Path -Parent $outPath
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}

# ---------------------------------------------------------------- web / PWA
foreach ($sz in @(16, 32, 48, 96, 180, 192, 512)) {
  $b = New-Icon $sz
  Save-Png $b (Join-Path $webDir "icon-$sz.png")
  $b.Dispose()
}
# maskable uses the same art: the gold ring sits at 77% radius, inside the 80% safe circle.
$b = New-Icon 512
Save-Png $b (Join-Path $webDir 'icon-maskable-512.png')
$b.Dispose()

# ---------------------------------------------------------------- android
# Adaptive foreground: the base art is a rounded-square plate, so a plain scale
# would show a square inside the launcher's circle mask. Feather the outer rim
# (plate margin is empty from 80% radius out, gold ring ends at ~77%).
function Save-Foreground([int]$canvas, [int]$inner, [int]$off, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap($canvas, $canvas, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($base, $off, $off, $inner, $inner)
  $g.Dispose()

  $rect = New-Object System.Drawing.Rectangle(0, 0, $canvas, $canvas)
  $bd = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($bd.Stride * $canvas)
  [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $bytes, 0, $bytes.Length)

  $c = $canvas / 2.0
  $half = $inner / 2.0
  $rIn = $half * 0.80
  $rOut = $half * 0.88
  for ($y = 0; $y -lt $canvas; $y++) {
    $row = $y * $bd.Stride
    $dy = $y + 0.5 - $c
    for ($x = 0; $x -lt $canvas; $x++) {
      $i = $row + $x * 4
      $dx = $x + 0.5 - $c
      $r = [math]::Sqrt($dx * $dx + $dy * $dy)
      if ($r -le $rIn) { continue }
      if ($r -ge $rOut) { $bytes[$i + 3] = 0; continue }
      $t = 1.0 - ($r - $rIn) / ($rOut - $rIn)
      $t = $t * $t * (3 - 2 * $t)
      $bytes[$i + 3] = [byte]([math]::Round($bytes[$i + 3] * $t))
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $bd.Scan0, $bytes.Length)
  $bmp.UnlockBits($bd)
  Save-Png $bmp $outPath
  $bmp.Dispose()
}

$densities = [ordered]@{ 'mdpi' = 1.0; 'hdpi' = 1.5; 'xhdpi' = 2.0; 'xxhdpi' = 3.0; 'xxxhdpi' = 4.0 }
foreach ($k in $densities.Keys) {
  $m = $densities[$k]
  $dir = Join-Path $resDir "mipmap-$k"
  $sz = [int](48 * $m)

  $full = New-Icon $sz
  Save-Png $full (Join-Path $dir 'ic_launcher.png')

  $round = New-Object System.Drawing.Bitmap($sz, $sz)
  $rg = [System.Drawing.Graphics]::FromImage($round)
  $rg.SmoothingMode = 'AntiAlias'
  $rg.InterpolationMode = 'HighQualityBicubic'
  $rg.PixelOffsetMode = 'HighQuality'
  $rg.Clear([System.Drawing.Color]::Transparent)
  $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
  $clip.AddEllipse(0, 0, $sz, $sz)
  $rg.SetClip($clip)
  $rg.DrawImage($full, 0, 0, $sz, $sz)
  $rg.Dispose(); $clip.Dispose()
  Save-Png $round (Join-Path $dir 'ic_launcher_round.png')
  $round.Dispose()
  $full.Dispose()

  $fgCanvas = [int](108 * $m)
  $fgInner = [int]($fgCanvas * 0.84)
  $fgOff = [int](($fgCanvas - $fgInner) / 2)
  Save-Foreground $fgCanvas $fgInner $fgOff (Join-Path $dir 'ic_launcher_foreground.png')
}

# Adaptive background must match the plate, otherwise a light ring shows up.
$probe = New-Object System.Drawing.Bitmap($basePath)
$c = $probe.GetPixel(8, 8)
$bgHex = '#{0:X2}{1:X2}{2:X2}' -f $c.R, $c.G, $c.B
$probe.Dispose()

if (-not (Test-Path $valuesDir)) { New-Item -ItemType Directory -Force -Path $valuesDir | Out-Null }
$bgXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$bgHex</color>
</resources>
"@
[IO.File]::WriteAllText((Join-Path $valuesDir 'ic_launcher_background.xml'), $bgXml, (New-Object Text.UTF8Encoding($false)))

# ---------------------------------------------------------------- app.ico
$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
$pngs = @()
foreach ($sz in $icoSizes) {
  $b = New-Icon $sz
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += , ($ms.ToArray())
  $b.Dispose(); $ms.Dispose()
}

$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($out)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$icoSizes.Count)
$offset = 6 + 16 * $icoSizes.Count
for ($i = 0; $i -lt $icoSizes.Count; $i++) {
  $sz = $icoSizes[$i]
  $dim = if ($sz -ge 256) { 0 } else { $sz }
  $bw.Write([Byte]$dim); $bw.Write([Byte]$dim)
  $bw.Write([Byte]0); $bw.Write([Byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$pngs[$i].Length)
  $bw.Write([UInt32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Flush()
$icoBytes = $out.ToArray()
$bw.Dispose(); $out.Dispose()
[IO.File]::WriteAllBytes($icoPath, $icoBytes)
$base.Dispose()

# ---------------------------------------------------------------- shortcut
# Windows caches icons by file path, so pointing the shortcut at a content-addressed
# copy guarantees the new artwork shows up without clearing the shell icon cache.
$icoHash = (Get-FileHash $icoPath -Algorithm SHA256).Hash.Substring(0, 8)
$versionedIco = Join-Path $Root "app-$icoHash.ico"
if (-not (Test-Path $versionedIco)) {
  Copy-Item $icoPath $versionedIco -Force
}
Get-ChildItem $Root -Filter 'app-*.ico' -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -ne $versionedIco } |
  Remove-Item -Force -ErrorAction SilentlyContinue

if (Test-Path $lnkPath) {
  $sh = New-Object -ComObject WScript.Shell
  $s = $sh.CreateShortcut($lnkPath)
  if ($s.IconLocation -ne "$versionedIco,0") {
    $s.IconLocation = "$versionedIco,0"
    $s.Save()
    Write-Output "icons: shortcut icon -> app-$icoHash.ico"
  }
}

# Nudge the shell so the desktop repaints immediately.
try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CgmShellNotify {
  [DllImport("shell32.dll")] public static extern void SHChangeNotify(int eventId, int flags, IntPtr a, IntPtr b);
}
"@ -ErrorAction SilentlyContinue
  [CgmShellNotify]::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
} catch { }

# ---------------------------------------------------------------- state
$state = @{ hash = $baseHash; generatedAt = (Get-Date).ToString('s'); background = $bgHex } | ConvertTo-Json
[IO.File]::WriteAllText($statePath, $state, (New-Object Text.UTF8Encoding($false)))

Write-Output "icons: done (web 8, android 5x3, ico 7 sizes, bg $bgHex)"
