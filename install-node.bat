@echo off
chcp 65001 >nul
echo ========================================
echo   CardGameMaker - Node.js 安装助手
echo ========================================
echo.
echo 检测当前 Node.js 安装状态...
echo.

where node >nul 2>&1
if %errorlevel% EQU 0 (
    echo [✅ ] Node.js 已安装！
    node --version
    echo.
) else (
    echo [❌ ] Node.js 未安装
    echo.
    echo ========================================
    echo   解决方案
    echo ========================================
    echo.
    echo 请按以下步骤操作：
    echo.
    echo   1. 访问 https://nodejs.org/
    echo   2. 下载并安装 LTS 版本（推荐 v18.x+）
    echo   3. 安装完成后重新打开此窗口
    echo   4. 再次运行此脚本验证
    echo.
    echo ========================================
    echo   自动下载安装包（可选）
    echo ========================================
    echo.
    echo 正在尝试下载最新 LTS 安装包...
    echo.
    start https://nodejs.org/download/release/latest-v20.x/
    echo.
    echo 浏览器已打开下载页面，请按照提示安装
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% NEQ 0 (
    echo [❌ ] npm 未安装（可能是错误路径）
    echo.
    echo 请在安装 Node.js 后重启终端
    pause
    exit /b 1
)

echo ========================================
echo   环境验证成功！
echo ========================================
echo.
echo Node.js 版本：
node --version
npm --version
echo.
echo ========================================
echo   现在可以启动项目了
echo ========================================
echo.
echo 启动选项：
echo.
echo   1. 双击桌面上的 CardGameMaker 快捷方式
echo   2. 运行 .\start.bat
echo   3. 运行 npm run dev 启动开发服务器
echo.
echo ========================================
echo.
pause