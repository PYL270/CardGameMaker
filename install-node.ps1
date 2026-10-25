# CardGameMaker - Node.js 安装助手 (PowerShell 版本)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CardGameMaker - Node.js 安装助手" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "[✅ ] Node.js 已安装！" -ForegroundColor Green
    Write-Host "    $(node --version)" -ForegroundColor Gray
    Write-Host ""

    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host "[✅ ] npm 已安装" -ForegroundColor Green
        Write-Host "    $(npm --version)" -ForegroundColor Gray
        Write-Host ""

        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  环境验证成功！" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "现在可以启动项目了！" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "运行以下命令：" -ForegroundColor Yellow
        Write-Host "  npm run dev         # 启动开发服务器" -ForegroundColor Gray
        Write-Host "  npm start           # 启动完整服务" -ForegroundColor Gray
        Write-Host "  npm test            # 运行测试" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "[❌ ] npm 未找到" -ForegroundColor Red
    }

} else {
    Write-Host "[❌ ] Node.js 未安装" -ForegroundColor Red
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  解决方案" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "请按以下步骤操作：" -ForegroundColor Yellow
    Write-Host "  1. 访问 https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "  2. 下载并安装 LTS 版本（推荐 v18.x+）" -ForegroundColor Cyan
    Write-Host "  3. 安装完成后重新打开 PowerShell" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  浏览器已自动打开下载页面" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    start https://nodejs.org/download/release/latest-v20.x/
}