param(
  [int]$Port = 8788
)

# CardGameMaker 网页版本地启动器（Windows 自带 PowerShell 即可，无需安装任何东西）
# 用法：双击「启动游戏.bat」

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSCommandPath
$url = "http://127.0.0.1:$Port/"

$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.js'          = 'text/javascript; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'         = 'image/svg+xml'
  '.png'         = 'image/png'
  '.jpg'         = 'image/jpeg'
  '.jpeg'        = 'image/jpeg'
  '.webp'        = 'image/webp'
  '.ico'         = 'image/x-icon'
  '.woff2'       = 'font/woff2'
  '.ttf'         = 'font/ttf'
  '.mp3'         = 'audio/mpeg'
  '.wav'         = 'audio/wav'
  '.ogg'         = 'audio/ogg'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try {
  $listener.Start()
} catch {
  Write-Host "端口 $Port 已被占用，换一个：右键「启动游戏.bat」→ 编辑，把 8788 改成别的数字。" -ForegroundColor Yellow
  Read-Host "按回车退出"
  exit 1
}

Write-Host ""
Write-Host "  CardGameMaker 网页版" -ForegroundColor Yellow
Write-Host "  地址：$url" -ForegroundColor Cyan
Write-Host "  关闭这个窗口即停止游戏服务。" -ForegroundColor DarkGray
Write-Host ""

Start-Process $url

$rootFull = [System.IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    $file = Join-Path $rootFull $rel
    if (-not [System.IO.Path]::GetFullPath($file).StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }
    if ((Test-Path $file -PathType Container)) { $file = Join-Path $file 'index.html' }
    if (-not (Test-Path $file -PathType Leaf)) { $file = Join-Path $rootFull 'index.html' }

    $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
