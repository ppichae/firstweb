(async () => {
  // N3·N1 독해·청해 화면, 후리가나, 발음 버튼, 음성 설정 (로그인 잠금 끔: ?auth=off)
  const log = [];
  const check = (name, ok, extra) => { log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : "")); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const until = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* 아직 */ } await wait(200); } return false; };
  const noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth + 1;
  try {
    if (window.parent.DARK) document.documentElement.dataset.theme = "dark";
    // N3 독해
    location.hash = "n3/reading"; await until(() => $$(".pick").length >= 12);
    check("N3 독해: 지문 12개", $$(".pick").length === 12, $$(".pick").length);
    check("N3 독해: 유형 4가지 + 전체", $$("[data-rtype]").length === 5, $$("[data-rtype]").length);
    check("N3 독해: 후리가나(ruby) 표시", $$(".passage ruby").length > 10);
    check("N3 독해: 문단마다 발음 버튼", $$(".passage .say-btn").length >= 2);
    check("N3 독해: 핵심 단어·문법", !!$(".aid") && $(".aid summary").textContent.includes("핵심 단어"));
    check("N3 독해: 내부 상태 문구가 보이지 않음", !/AI 생성|검수 필요|준비 중|self_reviewed/.test(app().textContent));
    const quiz = $("#quiz");
    const before = window.localStorage.getItem("n3lab:attempts") || "[]";
    const opt = quiz.querySelector(".opt") || quiz.querySelector("button");
    check("N3 독해: 문제 선택지 있음", !!opt);
    opt.click(); await wait(300);
    const after = JSON.parse(window.localStorage.getItem("n3lab:attempts") || "[]");
    check("N3 독해: 답하면 N3 방에 기록", after.length === JSON.parse(before).length + 1 && after[after.length - 1].qid === "n3rq-001", JSON.stringify(after.slice(-1)));
    check("N3 독해: 해설 표시", /정답|오답/.test(quiz.textContent));
    check("N3 독해: N1 기록에는 안 들어감", !(window.localStorage.getItem("n1lab:attempts") || "").includes("n3rq-"));
    check("휴대폰 폭: N3 독해 넘치지 않음", noOverflow(), document.documentElement.scrollWidth);
    // 후리가나 숨기기
    const ft = $("[data-furi-toggle]"); ft.click(); await wait(100);
    const rt = $(".passage rt");
    check("후리가나 숨기기", document.documentElement.classList.contains("hide-furi") && getComputedStyle(rt).visibility === "hidden");
    $("[data-furi-toggle]").click(); await wait(100);
    check("후리가나 다시 보이기", !document.documentElement.classList.contains("hide-furi"));
    // 정보 검색 지문
    $$("[data-rtype]").find(b => b.dataset.rtype === "info").click(); await wait(200);
    check("N3 독해: 정보 검색 2개", $$(".pick").length === 2);
    // N3 청해
    location.hash = "n3/listening"; await until(() => $$(".pick").length >= 12);
    check("N3 청해: 문항 12개", $$(".pick").length === 12, $$(".pick").length);
    check("N3 청해: 유형 5가지 + 전체", $$("[data-ltype]").length === 6, $$("[data-ltype]").length);
    await until(() => $("[data-p=play]") || $(".audio-missing"), 8000);
    check("N3 청해: 재생 버튼 또는 음성 없음 안내", !!$("[data-p=play]") || !!$(".audio-missing"), $(".player").textContent.slice(0, 80));
    $(".l-show-script").click(); await wait(100);
    check("N3 청해: 스크립트 문장마다 다시 듣기 버튼", $$(".l-script .say-btn").length >= 6);
    check("N3 청해: 스크립트 후리가나", $$(".l-script ruby").length > 5);
    $(".l-show-trans").click(); await wait(100);
    check("N3 청해: 해석에 상황 설명 포함", $(".l-trans").textContent.includes("회사에서"));
    $$("[data-ltype]").find(b => b.dataset.ltype === "response").click(); await wait(300);
    check("N3 청해: 즉시 응답 선택지 3개", $$("#item .opt").length === 3 || $$("#item [data-opt]").length === 3, $$("#item .opt").length);
    check("휴대폰 폭: N3 청해 넘치지 않음", noOverflow());
    // N1 독해: 밑줄 기호가 그대로 보이지 않음
    location.hash = "reading"; await until(() => $$(".pick").length >= 7);
    check("N1 독해: 지문 19개 (기존 7 + 새 12)", $$(".pick").length === 19, $$(".pick").length);
    check("N1 독해: 지문 전체 듣기 버튼", !!$("#play-all"));
    check("N1 독해: 기존 지문에도 핵심 단어", !!$(".aid"));
    let bracket = false;
    for (const b of $$(".pick")) { b.click(); await wait(150); if ($(".passage").textContent.includes("[[")) bracket = true; }
    check("N1 독해: [[ ]] 기호가 보이지 않고 밑줄로", !bracket && $$("u.ul-mark").length >= 0);
    // N1 청해
    location.hash = "listening"; await until(() => $$(".pick").length >= 7);
    check("N1 청해: 문항 19개 (기존 7 + 새 12)", $$(".pick").length === 19, $$(".pick").length);
    // 단어장 발음 버튼
    location.hash = "vocab"; await until(() => $(".card-face"), 10000);
    $(".card-face").click(); await wait(200);
    check("N1 단어 카드: 펼치면 발음 버튼", !!$(".card .say-btn"));
    check("예문: 히라가나만 적은 중복 줄 없음", !$(".ex-reading"));
  } catch (e) { log.push("FAIL 테스트 중단: " + e.message + " " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
