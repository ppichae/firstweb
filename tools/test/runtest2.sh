#!/bin/sh
# usage: [PRE=pre.js] runtest2.sh <test.js> [width] [height] [hash]
# runtest.sh와 같지만, PRE 파일(사이트를 열기 전에 저장소에 넣을 예전 기록)을 먼저 실행하고, 크롬이 멈추면 150초 뒤 끝낸다.
S="/c/Users/Owner/AppData/Local/Temp/claude/c--Users-Owner-Documents-firstweb/aff8e9c3-ffd7-48f7-8ee2-a6d92d386652/scratchpad"
P="/c/Users/Owner/Documents/firstweb"
W=${2:-1440}; H=${3:-1000}; HASH=${4:-}
{
  printf '<!doctype html><meta charset="utf-8"><body style="margin:0"><pre id="out">RUNNING</pre>'
  printf '<iframe id="f" style="border:0;width:%spx;height:%spx"></iframe><script>\n' "$W" "$H"
  printf 'const errors=[];\n'
  printf 'const f=document.getElementById("f");\n'
  printf 'f.addEventListener("load",()=>{const w=f.contentWindow; w.addEventListener("error",e=>errors.push("ERR "+e.message)); w.addEventListener("unhandledrejection",e=>errors.push("REJ "+(e.reason&&e.reason.message)));},{once:true});\n'
  printf 'localStorage.clear();\n'
  if [ -n "$PRE" ]; then cat "$PRE"; printf '\n'; fi
  printf 'f.src="index.html%s";\n' "$HASH"
  printf 'setTimeout(async()=>{const w=f.contentWindow,document=w.document,window=w,location=w.location,localStorage=w.localStorage;try{const r=await (\n'
  cat "$1"
  printf '\n);window.parent.document.getElementById("out").textContent=(errors.length?errors.join("\\n")+"\\n":"")+r;}catch(e){window.parent.document.getElementById("out").textContent="TEST CRASH "+e.stack+"\\n"+errors.join("\\n");}},2500);\n'
  printf '</script>'
} > "$P/_test.html"
timeout ${TMO:-150} "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --virtual-time-budget=${BUDGET:-60000} \
  --user-data-dir="C:/Users/Owner/AppData/Local/Temp/claude/c--Users-Owner-Documents-firstweb/aff8e9c3-ffd7-48f7-8ee2-a6d92d386652/scratchpad/chrome-test" \
  --window-size=1600,1200 --dump-dom "http://localhost:8765/_test.html" 2>/dev/null \
  | awk '/<pre id="out">/{f=1; sub(/.*<pre id="out">/,"")} f{ if (sub(/<\/pre>.*/,"")) { print; exit } print }' \
  | sed 's/&gt;/>/g; s/&lt;/</g; s/&amp;/\&/g; s/&quot;/"/g'
rm -f "$P/_test.html"
