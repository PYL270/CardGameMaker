#!/bin/sh
# CardGameMaker 网页版（macOS / Linux）
# 需要 python3（系统自带即可）
cd "$(dirname "$0")" || exit 1
PORT=8788
URL="http://127.0.0.1:$PORT/"
echo ""
echo "  CardGameMaker 网页版"
echo "  地址：$URL"
echo "  关闭终端即停止服务。"
echo ""
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
if command -v open >/dev/null 2>&1; then open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
else echo "请手动在浏览器打开：$URL"; fi
wait $SERVER_PID
