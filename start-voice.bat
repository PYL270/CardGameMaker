@echo off
chcp 65001 >nul
setlocal
title GPT-SoVITS API - CardGameMaker AI 配音

rem ============================================================
rem  CardGameMaker AI 配音本地服务
rem  用法：双击本文件启动，等出现 API 监听 127.0.0.1:9880 后，
rem        回到游戏 → 武将 · 卡牌工坊 →「AI 配音」→ 本地 GPT-SoVITS。
rem  关闭本窗口即停止服务。参考音频默认 voice_refs\ref-zh.wav。
rem ============================================================

set "GPT_HOME=D:\AI-shengyin\GPT\GPT-SoVITS-v2pro-20250604-nvidia50"
set "PYTHON=%GPT_HOME%\runtime\python.exe"
set "API_SCRIPT=api_v2.py"
set "API_CONFIG=GPT_SoVITS\configs\tts_infer.yaml"
set "API_HOST=127.0.0.1"
set "API_PORT=9880"

echo ============================================================
echo   GPT-SoVITS 本地配音 API
echo   目录: %GPT_HOME%
echo   地址: http://%API_HOST%:%API_PORT%
echo ============================================================
echo.

if not exist "%GPT_HOME%" (
  echo [错误] 未找到 GPT-SoVITS 目录：
  echo        %GPT_HOME%
  echo        请确认安装路径，或在 start-voice.bat 顶部修改 GPT_HOME。
  echo.
  pause
  exit /b 1
)

if not exist "%PYTHON%" (
  echo [错误] 未找到 runtime Python：
  echo        %PYTHON%
  echo        请确认 GPT-SoVITS 的 runtime 目录完整。
  echo.
  pause
  exit /b 1
)

if not exist "%GPT_HOME%\%API_SCRIPT%" (
  echo [错误] 未找到 %API_SCRIPT%，请检查 GPT-SoVITS 目录。
  echo.
  pause
  exit /b 1
)

echo 正在启动 GPT-SoVITS API（首次加载模型可能需要 1~3 分钟）...
echo 启动后请保持本窗口开启；关闭窗口即停止配音服务。
echo.
echo 提示：游戏内「武将 · 卡牌工坊 → AI 配音」选择「本地 GPT-SoVITS」，
echo       参考音频可先用 D:\CardGameMaker\voice_refs\ref-zh.wav。
echo.

cd /d "%GPT_HOME%"
"%PYTHON%" "%API_SCRIPT%" -a %API_HOST% -p %API_PORT% -c "%API_CONFIG%"

set "VOICE_EXIT=%ERRORLEVEL%"
echo.
if not "%VOICE_EXIT%"=="0" (
  echo [错误] GPT-SoVITS API 退出，代码 %VOICE_EXIT%
  echo        常见原因：端口 9880 被占用、模型路径/配置文件不对、显卡驱动或 CUDA 环境异常。
  echo        请把本窗口报错发给开发者。
) else (
  echo GPT-SoVITS API 已停止。
)
echo.
pause
endlocal
