(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  try {
    location.hash = "n3/grammar"; await wait(1800);
    const it = $("#n3-g0001");
    check("N3 문형 예문(읽기·설명)", !!it && !!it.querySelector(".g-ex .ex-own ruby") && !!it.querySelector(".ex-note"), it && it.querySelector(".g-ex") && it.querySelector(".g-ex").textContent.slice(0, 40));
    const shown = $$(".g-item"); const withEx = shown.filter(g => g.querySelector(".ex-own"));
    check("보이는 문형 모두 예문 있음", withEx.length === shown.length, withEx.length + "/" + shown.length);
    $('[data-mode="quiz"]') && $('[data-mode="quiz"]').click(); await wait(400);
    let found = null;
    for (let k = 0; k < 10 && !found; k++) { const q = $(".qr-q"); if (!q) break; q.querySelector(".opt").click(); await wait(60); const lb = q.querySelector(".learn-box"); if (lb && lb.querySelector(".ex-own ruby")) found = lb; const b = $(".qr-next"); if (!b) break; b.click(); await wait(100); }
    check("N3 문법 퀴즈 학습 정보에 예문", !!found);
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message); }
  return log.join("\n");
})()
