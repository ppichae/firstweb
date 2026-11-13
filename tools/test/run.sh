#!/bin/sh
# 사이트 자동 테스트 실행기: tools/serve.ps1이 public 폴더를 열어 둔 상태에서 쓴다
# 사용법: [PRE=기록.js] sh tools/test/run.sh <테스트.js> [가로] [세로] [#주소]
# 테스트 페이지(_test.html)를 public에 잠깐 만들고, 크롬으로 열어 결과를 출력한 뒤 지운다 (.gitignore에 있어 올라가지 않는다)
R="$(cd "$(dirname "$0")/../.." && pwd)"
P="$R/public"
PROFILE="${CHROME_PROFILE:-C:/Temp/firstweb-chrome-test}"
W=${2:-1440}; H=${3:-1000}; HASH=${4:-}
{
  printf '<!doctype html><meta charset="utf-8"><body style="margin:0"><pre id="out">RUNNING</pre>'
  printf '<iframe id="f" style="border:0;width:%spx;height:%spx"></iframe><script>\n' "$W" "$H"
  printf 'const errors=[];\n'
  printf 'const f=document.getElementById("f");\n'
  printf 'f.addEventListener("load",()=>{const w=f.contentWindow; w.addEventListener("error",e=>errors.push("ERR "+e.message)); w.addEventListener("unhandledrejection",e=>errors.push("REJ "+(e.reason&&e.reason.message)));},{once:true});\n'
  printf 'localStorage.clear();\n'
  if [ -n "$PRE" ]; then cat "$PRE"; printf '\n'; fi
  # 로그인 잠금을 끄고 기존 기능을 테스트한다 (주소에 ?가 이미 있으면 그대로 둔다. AUTHQ= 로 끌 수 있다)
  case "$HASH" in "?"*) Q="";; *) Q="${AUTHQ-?auth=off}";; esac
  printf 'f.src="index.html%s%s";\n' "$Q" "$HASH"
  printf 'setTimeout(async()=>{const w=f.contentWindow,document=w.document,window=w,location=w.location,localStorage=w.localStorage;try{const r=await (\n'
  cat "$1"
  printf '\n);window.parent.document.getElementById("out").textContent=(errors.length?errors.join("\\n")+"\\n":"")+r;}catch(e){window.parent.document.getElementById("out").textContent="TEST CRASH "+e.stack+"\\n"+errors.join("\\n");}},2500);\n'
  printf '</script>'
} > "$P/_test.html"
timeout ${TMO:-150} "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --virtual-time-budget=${BUDGET:-60000} \
  --user-data-dir="$PROFILE" \
  --window-size=1600,1200 --dump-dom "http://localhost:8765/_test.html" 2>/dev/null \
  | awk '/<pre id="out">/{f=1; sub(/.*<pre id="out">/,"")} f{ if (sub(/<\/pre>.*/,"")) { print; exit } print }' \
  | sed 's/&gt;/>/g; s/&lt;/</g; s/&amp;/\&/g; s/&quot;/"/g'
rm -f "$P/_test.html"
