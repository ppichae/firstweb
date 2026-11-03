(async () => {
  // 홈 '학습한 단어' 기준: 외웠어요·퀴즈 정답·카드 알았어요/쉬워요만 센다. 몰라요·틀린 것·카드 '헷갈려요'까지만 한 단어는 '공부 중'
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1400); };
  const wordTile = () => $$(".tile").find(t => t.querySelector(".tile-label") && t.querySelector(".tile-label").textContent === "학습한 단어");
  try {
    await go("n3");
    let t = wordTile();
    check("N3 학습한 단어 = 3 (외웠어요·카드 알았어요·퀴즈 정답)", t && t.querySelector(".tile-value").textContent === "3", t && t.textContent);
    check("공부 중 2개 (몰라요만·카드 기록만)", t && t.querySelector(".tile-sub").textContent.includes("공부 중 2개"), t && t.querySelector(".tile-sub").textContent);
    const help = $(".stat-help");
    check("숫자 기준 설명 있음", !!help && help.textContent.includes("같은 단어는 여러 번 공부해도 1개"));
    // 카드에서 '알았어요'를 고르면 학습한 단어가 하나 는다
    await go("n3/vocab"); { const _c = document.querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } }
    $('[data-mode="cards"]').click(); await wait(300);
    const word = $(".flash-word").textContent;
    $("#flip").click(); await wait(300);
    const gb = $('[data-grade="good"]'); check("알았어요 버튼 있음", !!gb); gb.click(); await wait(600);
    const lists = JSON.parse(localStorage.getItem("n3lab:lists") || "{}");
    const rec = Object.entries(lists).find(([id, s]) => s.cardOk && s.srs && s.srs.reps >= (id === "n3-v0004" ? 2 : 1));
    check("카드 '알았어요'에 cardOk 기록", !!rec, word);
    await go("n3");
    t = wordTile();
    const v = t && t.querySelector(".tile-value").textContent;
    check("카드 '알았어요' 뒤 학습한 단어 수", rec && v === (rec[0] === "n3-v0004" ? "3" : "4"), v + " / " + (rec && rec[0]));
    // N1 홈에도 같은 설명
    localStorage.setItem("jlpt:room", "n1");
    await go("home");
    check("N1 홈 숫자 기준 설명", !!$(".stat-help"));
    check("N1 학습한 단어 칸에 '공부 중'", !!wordTile() && wordTile().textContent.includes("공부 중"));
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
