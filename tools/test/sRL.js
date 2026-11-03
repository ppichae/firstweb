(async () => {
  // N3·N1 독해·청해: 목록 화면 ↔ 풀이 화면, 지문 듣기 버튼 하나, 지문·문제 탭, 한 번에 한 문제, 후리가나, 음성 설정 (로그인 잠금 끔: ?auth=off)
  const log = [];
  const check = (name, ok, extra) => { log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : "")); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const until = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* 아직 */ } await wait(200); } return false; };
  const noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth + 1;
  const narrow = () => window.innerWidth < 900;
  const shown = el => !!el && window.getComputedStyle(el).display !== "none";
  const showAll = async () => { while ($("[data-pmore]")) { $("[data-pmore]").click(); await wait(80); } };
  try {
    // N3 독해 목록
    location.hash = "n3/reading"; await until(() => $$(".pick").length >= 10);
    check("독해 목록: 10개씩 보여 줌", $$(".pick").length === 10 && !!$("[data-pmore]"), $$(".pick").length);
    check("독해 목록: 목록 화면에는 지문이 없음(끝없이 이어지지 않음)", !$(".passage") && !$("#quiz"));
    await showAll();
    check("N3 독해: 지문 12개", $$(".pick").length === 12, $$(".pick").length);
    check("N3 독해: 유형 4가지 + 전체", $$("[data-rtype]").length === 5, $$("[data-rtype]").length);
    check("독해 목록: 전체·안 푼 것·다 푼 것", $$("[data-pstatus]").map(b => b.textContent).join("|") === "전체 12|안 푼 것 12|다 푼 것 0", $$("[data-pstatus]").map(b => b.textContent).join("|"));
    check("독해 목록: 푼 것이 없으면 이어서 풀기 없음", !$(".continue"));
    // 풀이 화면
    $(".pick").click(); await until(() => $(".passage"));
    check("풀이 화면: 목록은 사라지고 지문만", !$(".pick") && !!$(".passage"));
    check("풀이 화면: 목록·이전·다음", !!$('[data-dnav="list"]') && $('[data-dnav="prev"]').disabled && !$('[data-dnav="next"]').disabled);
    check("N3 독해: 후리가나(ruby) 표시", $$(".passage ruby").length > 10);
    check("독해: 듣기 버튼은 지문에 하나만", !!$("#play-all") && $$(".passage > p .say-btn").length === 0, $$(".passage > p .say-btn").length);
    check("N3 독해: 핵심 단어·문법", !!$(".aid") && $(".aid summary").textContent.includes("핵심 단어"));
    check("N3 독해: 내부 상태 문구가 보이지 않음", !/AI 생성|검수 필요|준비 중|self_reviewed/.test(app().textContent));
    if (narrow()) {
      check("좁은 화면: 처음에는 지문만", shown($(".passage")) && !shown($(".quiz-pane")));
      $('.pane-tabs [data-pane="quiz"]').click(); await wait(100);
      check("좁은 화면: 문제 탭을 누르면 문제만", !shown($(".passage")) && shown($(".quiz-pane")));
    } else {
      check("넓은 화면: 지문과 문제를 나란히", shown($(".passage")) && shown($(".quiz-pane")) && !shown($(".pane-tabs")));
    }
    const quiz = $("#quiz");
    const before = window.localStorage.getItem("n3lab:attempts") || "[]";
    const opt = quiz.querySelector(".opt");
    check("N3 독해: 문제 선택지 있음", !!opt);
    opt.click(); await wait(300);
    const after = JSON.parse(window.localStorage.getItem("n3lab:attempts") || "[]");
    check("N3 독해: 답하면 N3 방에 기록", after.length === JSON.parse(before).length + 1 && after[after.length - 1].qid === "n3rq-001", JSON.stringify(after.slice(-1)));
    check("N3 독해: 해설 표시", /정답|오답/.test(quiz.textContent));
    check("N3 독해: N1 기록에는 안 들어감", !(window.localStorage.getItem("n1lab:attempts") || "").includes("n3rq-"));
    check("문제에 영어 내부 이름 없음", !/reading|listening/.test($$(".q-num").map(x => x.textContent).join()), $$(".q-num").map(x => x.textContent).join());
    check("다 풀면 다음 지문 버튼", !!$("[data-next-passage]") && !$("[data-next-passage]").hidden);
    check("휴대폰 폭: N3 독해 넘치지 않음", noOverflow(), document.documentElement.scrollWidth);
    // 여러 문제 지문: 한 번에 한 문제
    $('[data-dnav="next"]').click(); await wait(200);
    let many = 0;
    for (let k = 0; k < 11 && !many; k++) { const n = $$("#quiz > div").length; if (n > 1) many = n; else { $('[data-dnav="next"]').click(); await wait(200); } }
    check("여러 문제 지문을 찾음", many > 1, many);
    check("한 번에 한 문제만 보임", $$("#quiz > div").filter(d => !d.hidden).length === 1 && $("#q-pos").textContent === "문제 1 / " + many, $("#q-pos").textContent);
    $("#q-next").click(); await wait(80);
    check("다음 문제로 이동", $("#q-pos").textContent === "문제 2 / " + many && !$("#q-prev").disabled);
    // 후리가나 숨기기
    if (narrow()) { $('.pane-tabs [data-pane="text"]').click(); await wait(80); }
    const ft = $("[data-furi-toggle]"); ft.click(); await wait(100);
    const rt = $(".passage rt");
    check("후리가나 숨기기", document.documentElement.classList.contains("hide-furi") && window.getComputedStyle(rt).visibility === "hidden");
    $("[data-furi-toggle]").click(); await wait(100);
    check("후리가나 다시 보이기", !document.documentElement.classList.contains("hide-furi"));
    // 목록으로 돌아가기: 푼 기록 반영
    $('[data-dnav="list"]').click(); await wait(200);
    check("목록으로 돌아감", !!$(".pick") && !$(".passage"));
    check("이어서 풀기 버튼", !!$(".continue") && $(".continue").dataset.passage !== "", $(".continue") && $(".continue").textContent);
    $('[data-pstatus="done"]').click(); await wait(100);
    check("다 푼 것 필터", $$(".pick").length === 1 && $(".pick").classList.contains("is-done"), $$(".pick").length);
    $('[data-pstatus="todo"]').click(); await wait(100);
    check("안 푼 것 필터", $$(".pick.is-done").length === 0 && $$(".pick").length >= 1);
    $('[data-pstatus="all"]').click(); await wait(100);
    $$("[data-rtype]").find(b => b.dataset.rtype === "info").click(); await wait(200);
    check("N3 독해: 정보 검색 2개", $$(".pick").length === 2);
    $$("[data-rtype]").find(b => b.dataset.rtype === "all").click(); await wait(100);
    // N3 청해
    location.hash = "n3/listening"; await until(() => $$(".pick").length >= 10);
    check("청해 목록: 목록 화면에는 문제가 없음", !$("#item") && !$(".listen"));
    await showAll();
    check("N3 청해: 문항 12개", $$(".pick").length === 12, $$(".pick").length);
    check("N3 청해: 유형 5가지 + 전체", $$("[data-ltype]").length === 6, $$("[data-ltype]").length);
    $(".pick").click(); await until(() => $(".listen"));
    await until(() => $("[data-p=play]") || $(".audio-missing"), 8000);
    check("N3 청해: 재생 버튼 또는 음성 없음 안내", !!$("[data-p=play]") || !!$(".audio-missing"), $(".player").textContent.slice(0, 80));
    $(".l-show-script").click(); await wait(100);
    check("N3 청해: 스크립트 문장마다 다시 듣기 버튼", $$(".l-script .say-btn").length >= 6);
    check("N3 청해: 스크립트 후리가나", $$(".l-script ruby").length > 5);
    $(".l-show-trans").click(); await wait(100);
    check("N3 청해: 해석에 상황 설명 포함", $(".l-trans").textContent.includes("회사에서"));
    $(".l-quiz .opt").click(); await wait(150);
    check("청해: 답하면 다음 문제 버튼", !$(".next-passage").hidden);
    check("청해: 문제에 영어 내부 이름 없음", !/listening/.test($(".q-num") ? $$(".q-num").map(x => x.textContent).join() : ""));
    $(".next-passage").click(); await wait(200);
    check("청해: 다음 문제로 이동", $(".detail-pos").textContent.startsWith("2 /"), $(".detail-pos").textContent);
    $('[data-dnav="list"]').click(); await wait(150);
    $$("[data-ltype]").find(b => b.dataset.ltype === "response").click(); await wait(300);
    $(".pick").click(); await until(() => $(".listen"));
    check("N3 청해: 즉시 응답 선택지 3개", $$("#item .opt").length === 3 || $$("#item [data-opt]").length === 3, $$("#item .opt").length);
    check("휴대폰 폭: N3 청해 넘치지 않음", noOverflow());
    $('[data-dnav="list"]').click(); await wait(100);
    $$("[data-ltype]").find(b => b.dataset.ltype === "all").click(); await wait(100);
    // N1 독해: 밑줄 기호가 그대로 보이지 않음
    location.hash = "reading"; await until(() => $$(".pick").length >= 7);
    await showAll();
    check("N1 독해: 지문 19개 (기존 7 + 새 12)", $$(".pick").length === 19, $$(".pick").length);
    const ids = $$(".pick").map(b => b.dataset.passage);
    $(".pick").click(); await until(() => $(".passage"));
    check("N1 독해: 지문 듣기 버튼", !!$("#play-all"));
    check("N1 독해: 기존 지문에도 핵심 단어", !!$(".aid"));
    let bracket = false, paraBtn = false;
    for (let i = 0; i < ids.length; i++) {
      if ($(".passage").textContent.includes("[[")) bracket = true;
      if ($$(".passage > p .say-btn").length) paraBtn = true;
      if (i < ids.length - 1) { $('[data-dnav="next"]').click(); await wait(120); }
    }
    check("N1 독해: [[ ]] 기호가 보이지 않음", !bracket);
    check("N1 독해: 19개 모두 문단 듣기 버튼 없음", !paraBtn);
    $('[data-dnav="list"]').click(); await wait(100);
    // N1 청해
    location.hash = "listening"; await until(() => $$(".pick").length >= 7);
    await showAll();
    check("N1 청해: 문항 19개 (기존 7 + 새 12)", $$(".pick").length === 19, $$(".pick").length);
    // 단어장 발음 버튼
    location.hash = "vocab"; await until(() => $(".topic-tile"), 10000); $('.topic-tile[data-cat="all"]').click(); await until(() => $(".card-face"), 3000);
    $(".card-face").click(); await wait(200);
    check("N1 단어 카드: 펼치면 발음 버튼", !!$(".card .say-btn"));
    check("예문: 히라가나만 적은 중복 줄 없음", !$(".ex-reading"));
    // 유리 디자인과 오른쪽 위 버튼 모양
    const css = (el, p) => window.getComputedStyle(el)[p];
    const box = $(".card");
    check("유리 칸: 반투명 배경", /rgba\(.*0\.\d+\)/.test(css(box, "backgroundColor")), css(box, "backgroundColor"));
    check("버튼 알약 모양", css(document.getElementById("theme-toggle"), "borderRadius") === "999px" && css(document.getElementById("room-switch"), "borderRadius") === "999px");
  } catch (e) { log.push("FAIL 테스트 중단: " + e.message + " " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
