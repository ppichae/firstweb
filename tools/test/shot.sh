#!/bin/sh
# usage: shot.sh <url-path> <width> <height> <outname>
# 폭이 500px보다 좁으면 정확한 폭의 iframe 안에 넣어서 찍는다 (헤드리스 크롬 최소 창 폭 때문)
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
S="C:/Users/Owner/AppData/Local/Temp/claude/c--Users-Owner-Documents-firstweb/aff8e9c3-ffd7-48f7-8ee2-a6d92d386652/scratchpad"
OUT="$S/$4.png"
URL="http://localhost:8765/$1"
W=$2
if [ "$2" -lt 600 ]; then
  printf '<!doctype html><body style="margin:0;background:#888"><iframe src="%s" style="border:0;width:%spx;height:%spx;display:block"></iframe>' "$URL" "$2" "$3" > "/c/Users/Owner/Documents/firstweb/_frame.html"
  URL="http://localhost:8765/_frame.html"
  W=600
fi
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 \
  --user-data-dir="$S/chrome-profile" \
  --window-size="$W,$3" --screenshot="$OUT" "$URL" 2>/dev/null
rm -f "/c/Users/Owner/Documents/firstweb/_frame.html"
echo "$OUT"
