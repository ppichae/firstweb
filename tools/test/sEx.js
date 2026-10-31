(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1400); };
  try {
    await go("n3/vocab");
    const i = $("#v-q"); i.value = "計算"; i.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100);
    const card = $$(".card").find(c => c.querySelector(".word").textContent === "計算");
    card.querySelector(".card-face").click(); await wait(80);
    const c2 = $$(".card").find(c => c.querySelector(".word").textContent === "計算");
    check("단어 카드에 자체 제작 예문(한자 위 읽기)", !!c2.querySelector(".ex-own ruby") && c2.textContent.includes("계산이 맞지 않으니"), c2.querySelector(".ex-own") && c2.querySelector(".ex-own").textContent.slice(0, 50));
    check("루비 읽기 정확", c2.querySelector(".ex-own ruby rt").textContent === "けいさん");
    // 퀴즈 학습 정보: 예문·히라가나 읽기·쓰임 설명
    $('[data-mode="quiz"]').click(); await wait(300);
    let found = null;
    for (let k = 0; k < 40 && !found; k++) {
      if (k % 10 === 0 && k) { $("[data-qr=restart]").click(); await wait(200); }
      const q = $(".qr-q"); q.querySelector(".opt").click(); await wait(60);
      if (q.querySelector(".learn-box .ex-reading")) found = q.querySelector(".learn-box");
      const b = $(".qr-next"); if (!b) break; b.click(); await wait(100);
    }
    check("퀴즈 학습 정보에 예문·히라가나 읽기·설명", !!found && (!!found.querySelector(".ex-reading") && !!found.querySelector(".ex-note")), found ? found.querySelector(".ex-reading").textContent : "이번 무작위 10문제에 1~40번 단어가 안 나옴");
    // 한자 창 예문
    await go("n3/kanji");
    $('[data-kanji="合"]').click(); await wait(600);
    const d = document.querySelector(".kanji-dialog");
    check("한자 창에 자체 제작 예문", !!d.querySelector(".kd-ex .ex-own ruby"), d.querySelector(".kd-ex") ? d.querySelector(".kd-ex").textContent.slice(0, 40) : "예문 칸 없음");
    d.close();
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
