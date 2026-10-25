# setup-android.ps1 - Install JDK 17 + Android commandline-tools (platform 34 / build-tools 34.0.0) for CardGameMaker APK builds.
#
# One-time setup. Everything is installed outside the repo by default:
#   %LOCALAPPDATA%\CGM-Android\jdk        (Temurin JDK 17)
#   %LOCALAPPDATA%\CGM-Android\sdk        (Android SDK: cmdline-tools, platforms;android-34, build-tools;34.0.0)
#   %LOCALAPPDATA%\CGM-Android\downloads  (cached zip downloads)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-android.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/setup-android.ps1 -Force   # re-extract JDK/cmdline-tools
#
# After this script, run:  npm run apk   (or node scripts/build-apk.mjs)

param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$Base = if ($env:CGM_ANDROID_HOME) { $env:CGM_ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'CGM-Android' }
$Downloads = Join-Path $Base 'downloads'
$JdkRoot = Join-Path $Base 'jdk'
$SdkRoot = Join-Path $Base 'sdk'
$BuildToolsVersion = '34.0.0'
$Platform = 'android-34'

New-Item -ItemType Directory -Force -Path $Base, $Downloads, $JdkRoot, $SdkRoot | Out-Null

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Download-File([string]$Url, [string]$OutFile) {
  if ((Test-Path $OutFile) -and ((Get-Item $OutFile).Length -gt 1024) -and (-not $Force)) {
    Write-Host "    cached: $OutFile"
    return
  }
  Write-Host "    downloading: $Url"
  if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe -L --fail --retry 3 --max-time 1800 -o $OutFile $Url
    if ($LASTEXITCODE -ne 0) { throw "Download failed (curl exit $LASTEXITCODE): $Url" }
  } else {
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 1800
  }
  $size = (Get-Item $OutFile).Length
  if ($size -lt 1024) { throw "Downloaded file too small: $OutFile" }
  Write-Host ("    saved: {0} ({1:N1} MB)" -f $OutFile, ($size / 1MB))
}

function Find-Javac {
  $found = Get-ChildItem -Path $JdkRoot -Filter 'javac.exe' -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\bin\\javac\.exe$' } | Select-Object -First 1
  if ($found) { return $found.FullName }
  return $null
}

# ---------------------------------------------------------------- JDK 17
Write-Step "JDK 17 (Adoptium Temurin)"
$javac = if ($Force) { $null } else { Find-Javac }
if (-not $javac) {
  $jdkZip = Join-Path $Downloads 'jdk17.zip'
  Download-File 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' $jdkZip
  Write-Host "    extracting JDK..."
  if ($Force) { Remove-Item (Join-Path $JdkRoot '*') -Recurse -Force -ErrorAction SilentlyContinue }
  Expand-Archive -LiteralPath $jdkZip -DestinationPath $JdkRoot -Force
  $javac = Find-Javac
}
if (-not $javac) { throw "javac.exe not found after JDK extraction under $JdkRoot" }
$JavaHome = Split-Path -Parent (Split-Path -Parent $javac)
Write-Host "    JDK home: $JavaHome"
$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;$env:PATH"

# ------------------------------------------------------- Android cmdline-tools
Write-Step "Android commandline-tools"
$sdkManager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
if ((-not (Test-Path $sdkManager)) -or $Force) {
  $ctZip = Join-Path $Downloads 'cmdline-tools.zip'
  Download-File 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' $ctZip
  Write-Host "    extracting commandline-tools..."
  $tmp = Join-Path $SdkRoot 'cmdline-tools-extract'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -LiteralPath $ctZip -DestinationPath $tmp -Force
  $latest = Join-Path $SdkRoot 'cmdline-tools\latest'
  Remove-Item $latest -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path (Split-Path $latest -Parent) | Out-Null
  Move-Item (Join-Path $tmp 'cmdline-tools') $latest -Force
  Remove-Item $tmp -Recurse -Force
}
if (-not (Test-Path $sdkManager)) { throw "sdkmanager.bat not found: $sdkManager" }
Write-Host "    sdkmanager: $sdkManager"

# ------------------------------------------------------------- accept licenses
Write-Step "Accepting Android SDK licenses"
$yes = ((1..100) | ForEach-Object { 'y' }) -join "`r`n"
$yes | & $sdkManager --sdk_root="$SdkRoot" --licenses 2>&1 | ForEach-Object { Write-Host "    $_" }

# ------------------------------------------------------------ install packages
Write-Step "Installing platforms;$Platform / build-tools;$BuildToolsVersion / platform-tools"
& $sdkManager --sdk_root="$SdkRoot" "platforms;$Platform" "build-tools;$BuildToolsVersion" "platform-tools" 2>&1 |
  ForEach-Object { Write-Host "    $_" }
if ($LASTEXITCODE -ne 0) { throw "sdkmanager install failed (exit $LASTEXITCODE)" }

# ------------------------------------------------------------------- verify
Write-Step "Verifying toolchain"
$required = @(
  (Join-Path $SdkRoot "build-tools\$BuildToolsVersion\aapt2.exe"),
  (Join-Path $SdkRoot "build-tools\$BuildToolsVersion\zipalign.exe"),
  (Join-Path $SdkRoot "build-tools\$BuildToolsVersion\lib\d8.jar"),
  (Join-Path $SdkRoot "build-tools\$BuildToolsVersion\lib\apksigner.jar"),
  (Join-Path $SdkRoot "platforms\$Platform\android.jar")
)
$missing = @()
foreach ($file in $required) {
  if (Test-Path $file) { Write-Host "    OK  $file" }
  else { Write-Host "    MISSING  $file" -ForegroundColor Red; $missing += $file }
}
if ($missing.Count -gt 0) { throw "Toolchain incomplete, missing: $($missing -join '; ')" }

$javaVersion = (& cmd.exe /c "`"$JavaHome\bin\java.exe`" -version 2>&1" | Select-Object -First 1)
Write-Host ""
Write-Host "Toolchain ready." -ForegroundColor Green
Write-Host "  JAVA_HOME       = $JavaHome"
Write-Host "  ANDROID_SDK_ROOT= $SdkRoot"
Write-Host "  java            = $javaVersion"
Write-Host "  build-tools     = $BuildToolsVersion"
Write-Host "  platform        = $Platform"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  npm run apk                    # build public/apk/CardGameMaker-<version>.apk"
Write-Host "  or start the game (npm run dev) and use Settings -> Generate APK"
Write-Host ""
Write-Host "Note: these paths are auto-detected by scripts/build-apk.mjs (env -> %LOCALAPPDATA%\CGM-Android -> mobile/tools)."
