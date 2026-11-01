(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1000); };
  const tabs = () => [...document.querySelectorAll("#tablist .tab")].map(t => t.textContent.trim());
  const sw = () => document.getElementById("room-switch");
  const swVisible = () => { const r = sw().getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= document.documentElement.clientWidth; };
  // 시험일은 오늘 날짜에서 계산한다 (날짜가 바뀌어도 테스트가 맞게)
  const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const PLUS30 = plus(30), PLUS31 = plus(31);
  try {
    // 예전 기록이 있는 상태로 첫 화면 → N1 홈
    check("첫 화면 N1 홈", $("h2").textContent === "오늘의 학습" && document.title.includes("N1"), document.title);
    check("N1 메뉴", tabs().join("|") === "홈|단어|문법|한자|독해|청해|오답 노트|시험 대비|모의고사|함께 보기|기록 관리", tabs().join("|"));
    check("방 바꾸기 보임(N1)", swVisible() && sw().textContent === "방 바꾸기");
    const tv = $$(".tiles .tile");
    check("N1 홈 단어 칸(기존 기록 유지)", tv[0].textContent.includes("2") && tv[0].textContent.includes("/ "), tv[0].textContent);
    check("N1 홈 문법 칸", tv[1].textContent.includes("1"), tv[1].textContent);
    // D-Day
    check("D-Day 표시", /D-\d+/.test($(".dday-tile").textContent), $(".dday-tile .dday").textContent);
    $("#dd-edit").click(); await wait(100);
    $("#dd-date").value = PLUS30; $("#dd-save").click(); await wait(100);
    check("N1 시험일 변경", $(".dday-tile").textContent.includes("내가 정한 시험일") && $(".dday-tile .dday").textContent === "D-30", $(".dday-tile .dday").textContent);
    $("#dd-edit").click(); await wait(50); $("#dd-date").value = "2020-01-01"; $("#dd-save").click(); await wait(50);
    check("지난 날짜 거부", $("#dd-msg") && $("#dd-msg").textContent.includes("오늘 이후"));
    $("#dd-cancel").click(); await wait(50);
    // 단어
    await go("vocab");
    const cnt = $("#v-count").textContent;
    const total = Number(cnt.match(/(\d+)개 단어/)[1]);
    check("N1 단어 통합 개수 (44 + 916 - 겹침)", total > 916 && total < 960, cnt);
    check("단어 학습 방식 탭", $$(".seg").map(s => s.textContent).join("|") === "단어장|플래시카드|퀴즈|헷갈리는 단어");
    $("#v-src").value = "core"; $("#v-src").dispatchEvent(new Event("change", { bubbles: true })); await wait(100);
    check("자료: 기본 단어장 44", $("#v-count").textContent.startsWith("44개"), $("#v-count").textContent);
    check("기존 외운 단어 표시 유지", !!$(".card.is-known"));
    $("#v-src").value = "pdf"; $("#v-src").dispatchEvent(new Event("change", { bubbles: true })); await wait(100);
    const pdfN = Number($("#v-count").textContent.match(/(\d+)개/)[1]);
    check("자료: PDF 목록 (중복 제외)", pdfN === total - 44 && pdfN < 916, pdfN + " (중복 " + (916 - pdfN) + "개 숨김)");
    const pdfWords = $$(".card .word").map(w => w.textContent);
    check("PDF 첫 카드 기존 외움 표시 유지(n1-v0001)", !!$(".card.is-known"));
    $("#v-src").value = ""; $("#v-src").dispatchEvent(new Event("change", { bubbles: true })); await wait(100);
    $$(".card-face")[0].click(); await wait(50);
    check("기본 단어 펼침(유의어 등)", $$(".card")[0].textContent.length > 20);
    // 중복 노출 검사: 화면 전체 목록에서 같은 표기가 두 번 나오지 않는지
    const allWords = [];
    $("#v-q").value = "";
    for (let i = 0; i < 20 && $("#v-more-btn"); i++) { $("#v-more-btn").click(); await wait(30); }
    $$(".card .word").forEach(w => allWords.push(w.textContent));
    const dup = allWords.filter((w, i) => allWords.indexOf(w) !== i);
    check("같은 표기 중복 노출 없음", dup.length === 0, allWords.length + "개 중 중복 " + dup.join(","));
    $('[data-mode="quiz"]').click(); await wait(100);
    check("퀴즈 종류", $$("[data-qt]").map(b => b.textContent).join("|") === "뜻 고르기|읽기 고르기|단어 고르기|시험형 문제");
    $$(".q")[0].querySelectorAll(".opt")[0].click(); await wait(50);
    $('[data-qt="exam"]').click(); await wait(100);
    check("시험형 문제(기존) 유지", $$(".q").length > 0, $$(".q").length);
    $('[data-mode="compare"]').click(); await wait(100);
    check("헷갈리는 단어(기존) 유지", $$(".compare").length > 0);
    // 문법
    await go("grammar");
    check("문법 탭: 학습/플래시카드/퀴즈", $$(".seg").map(s => s.textContent).join("|") === "문법 학습|플래시카드|문법 퀴즈");
    check("퀴즈가 학습 화면 아래에 섞여 있지 않음", !$(".q"));
    const gc = $("#g-count").textContent;
    check("N1 문법 통합 개수", Number(gc.match(/\d+/)[0]) > 491, gc + " / 진도 " + app().querySelector(".progress").textContent);
    check("기존 공부함 표시 유지(g001)", app().querySelector("#g001 [data-gact=studied]").getAttribute("aria-pressed") === "true");
    $('[data-mode="quiz"]').click(); await wait(100);
    check("문법 퀴즈 바로 열림(시험형)", $$(".q").length > 0 && $$("[data-gq]").map(b => b.textContent).join("|") === "시험형 문제|뜻 고르기|문형 고르기", $$(".q").length);
    $('[data-gq="meaning"]').click(); await wait(100);
    check("뜻 고르기 10문제(한 문제씩)", /\/ 10/.test($(".qr-head").textContent) && $$(".q").length === 1);
    $('[data-gscope="studied"]').click(); await wait(100);
    check("범위: 공부한 문형", $$(".q").length === 1, $$(".q").length + " / " + $("#gq-note").textContent.slice(0, 30));
    $$(".q")[0].querySelectorAll(".opt")[0].click(); await wait(50);
    const n1att = JSON.parse(localStorage.getItem("n1lab:attempts"));
    check("N1 문법 퀴즈 기록은 N1에", n1att.length >= 3 && !JSON.parse(localStorage.getItem("n3lab:attempts") || "[]").length, n1att.length);
    $('[data-mode="cards"]').click(); await wait(100);
    $("#flip").click(); await wait(50); $('[data-grade="good"]').click(); await wait(50);
    check("문법 플래시카드", !!$(".flash") || !!$(".flash-done"));
    // 예전 주소
    await go("n1/lists");
    check("예전 주소 #n1/lists → 단어", $("h2").textContent === "단어");
    await go("notes");
    check("N1 오답 노트(예전 기록 유지)", $$(".note").length >= 1, $$(".note").length);
    // N3
    await go("n3");
    check("N3 메뉴", tabs().join("|") === "홈|로드맵|기초|단어|문법|한자|독해|청해|오답 노트|시험 대비|모의고사|함께 보기|기록 관리", tabs().join("|"));
    check("방 바꾸기 보임(N3)", swVisible());
    check("N3 홈 구조(D-Day·할 일·칸 4개)", !!$(".dday-tile") && !!$(".todo-tile") && $$(".tiles .tile").length === 4);
    check("N3 D-Day는 N1 설정과 별개", $(".dday-tile").textContent.includes("2026년") , $(".dday-tile .tile-label").textContent);
    $("#dd-edit").click(); await wait(50); $("#dd-date").value = PLUS31; $("#dd-save").click(); await wait(100);
    check("N3 시험일 설정", $(".dday-tile .dday").textContent === "D-31" && localStorage.getItem("n3lab:examDate") === JSON.stringify(PLUS31) && localStorage.getItem("n1lab:examDate") === JSON.stringify(PLUS30), $(".dday-tile .dday").textContent);
    check("N3 단어 칸(기존 기록)", $$(".tiles .tile")[0].textContent.includes("1"), $$(".tiles .tile")[0].textContent);
    const linkDeco = getComputedStyle($(".weeks a")).textDecorationLine;
    check("N3 링크 밑줄 없음", linkDeco === "none", linkDeco + " / 열기: " + getComputedStyle($(".course .q-top a")).textDecorationLine);
    await go("n3/vocab");
    check("N3 단어 화면 구조 = N1", $$(".seg").map(s => s.textContent).join("|") === "단어장|플래시카드|퀴즈" && $("#v-count").textContent.startsWith("733"), $("#v-count").textContent);
    await go("n3/grammar");
    check("N3 문법 화면 구조 = N1", $$(".seg").map(s => s.textContent).join("|") === "문법 학습|플래시카드|문법 퀴즈" && $("#g-count").textContent.startsWith("306"));
    $('[data-mode="quiz"]').click(); await wait(100);
    check("N3 문법 퀴즈(시험형 없음)", $$("[data-gq]").map(b => b.textContent).join("|") === "뜻 고르기|문형 고르기" && /\/ 10/.test($(".qr-head").textContent));
    $$(".q")[0].querySelectorAll(".opt")[0].click(); await wait(50);
    const n3att = JSON.parse(localStorage.getItem("n3lab:attempts"));
    check("N3 퀴즈 기록은 N3에", n3att.length === 1 && n3att[0].qid.startsWith("n3-"), n3att[0].qid);
    await go("n3/reading"); check("N3 독해 화면", $("h2").textContent === "독해");
    await go("n3/listening"); check("N3 청해 준비 중", $("h2").textContent === "청해");
    // 단원 흐름
    await go("n3/basics");
    $('[data-mode="units"]').click(); await wait(200); $('[data-unit="b09"]').click(); await wait(200);
    check("단원 진행 표시", $(".unit-nav").textContent.includes("1 / 8"));
    $$("#u-quiz .q").forEach((q, i) => q.querySelectorAll(".opt")[i === 0 ? 0 : q.querySelectorAll(".opt").length - 1].click()); await wait(100);
    const res = $(".unit-result");
    check("결과 + 다음 단원 버튼", !!res && !!res.querySelector("[data-unit=b02]") && res.textContent.includes("다음 단원으로 이동"), res && res.textContent.slice(0, 60));
    check("틀린 문제 다시 보기 버튼", !!$("#see-wrong"));
    check("해설이 보임", $$("#u-quiz .fb").length === 4);
    res.querySelector("[data-unit=b02]").click(); await wait(200);
    check("다음 단원으로 이동", $(".unit-nav").textContent.includes("2 / 8") && $(".card-box h3").textContent.includes("기본 문장"), $(".card-box h3").textContent);
    $("#back").click(); await wait(100);
    $('[data-unit="b08"]').click(); await wait(200);
    $$("#u-quiz .q").forEach(q => q.querySelectorAll(".opt")[0].click()); await wait(100);
    check("마지막 단원 완료 안내", !$(".unit-result [data-unit]") && $(".unit-result").textContent.includes("마지막 단원"), $(".unit-result").textContent.slice(0, 80));
    $("#again").click(); await wait(100);
    check("이 단원 다시 풀기", $$("#u-quiz .fb").length === 0 && $(".unit-nav").textContent.includes("8 / 8"));
    // 방 바꾸기
    sw().click(); await wait(800);
    check("급수 선택 화면(중복 버튼 숨김)", $("h2").textContent === "급수 선택" && sw().hidden);
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.stack); }
  return log.join("\n");
})()
