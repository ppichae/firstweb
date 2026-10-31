(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1400); };
  try {
    if (window.parent.DARK) document.documentElement.dataset.theme = "dark";
    await go("vocab");
    const i = $("#v-q"); i.value = "懸念"; i.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(150);
    const card = () => $$(".card").find(c => c.querySelector(".word").textContent === "懸念");
    card().querySelector(".card-face").click(); await wait(100);
    const c = card();
    check("N1 단어 카드 예문에 한자 읽기(루비)", !!c.querySelector(".ex-own ruby"), c.querySelector(".ex") && c.querySelector(".ex").textContent.slice(0, 40));
    const rts = [...c.querySelectorAll(".ex-own rt")].map(r => r.textContent).join(",");
    check("읽기가 문맥에 맞음(先=さき, 行=ゆ, 懸念=けねん)", rts.includes("さき") && rts.includes("ゆ") && rts.includes("けねん"), rts);
    check("원래 한국어 해석 유지", c.textContent.includes("경기 전망을 우려하는 목소리가 높아지고 있다."));
    check("같은 예문이 두 번 나오지 않음", c.querySelectorAll(".ex").length === 1);
    check("히라가나에는 읽기를 붙이지 않음", ![...c.querySelectorAll(".ex-own ruby")].some(r => /^[぀-ゟ]+$/.test(r.firstChild.textContent)));
    // 즐겨찾기·상태 버튼 유지
    check("카드 버튼(외움·즐겨찾기 등) 유지", c.querySelectorAll("button").length >= 2, c.querySelectorAll("button").length);
    // 퀴즈 학습 정보
    $('[data-mode="quiz"]').click(); await wait(300);
    let found = null;
    for (let k = 0; k < 30 && !found; k++) {
      if (k % 10 === 0 && k) { $("[data-qr=restart]").click(); await wait(200); }
      const q = $(".qr-q"); if (!q) break; q.querySelector(".opt").click(); await wait(60);
      const lb = q.querySelector(".learn-box"); if (lb && lb.querySelector(".ex-own ruby")) found = lb;
      const b = $(".qr-next"); if (!b) break; b.click(); await wait(100);
    }
    check("N1 퀴즈 학습 정보에 읽기 붙은 예문·히라가나 읽기·설명", !!found && !!found.querySelector(".ex-reading") && !!found.querySelector(".ex-note"), found ? found.querySelector(".ex-reading").textContent : "무작위 문제에 핵심 단어가 안 나옴");
    check("학습 정보에 같은 예문이 두 번 나오지 않음", !found || found.querySelectorAll(".lb-ex").length === 1, found && found.querySelectorAll(".lb-ex").length);
    // 한자 창
    await go("kanji");
    const kb = $('[data-kanji="懸"]'); if (kb) { kb.click(); await wait(600); }
    const d = document.querySelector(".kanji-dialog");
    check("N1 한자 창 예문에 읽기(루비)", !!d && !!d.querySelector(".kd-ex .ex-own ruby"), d && d.querySelector(".kd-ex") ? d.querySelector(".kd-ex").textContent.slice(0, 40) : "예문 칸 없음");
    if (d && d.open) d.close();
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    if (window.parent.DARK) { const rt = document.querySelector("rt"); check("다크 모드 적용", document.documentElement.dataset.theme === "dark"); }
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
