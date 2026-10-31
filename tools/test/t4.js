(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const input = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  const change = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("change", { bubbles: true })); };

  location.hash = "vocab"; await wait(300);
  check("에러 없음", !$(".error-box"));
  check("단어 44개", $$(".card").length === 44, $$(".card").length);
  // 검색
  input($("#v-q"), "けねん"); await wait(50);
  check("검색(읽기)", $$(".card").length === 1, $$(".card").length);
  input($("#v-q"), "걱정"); await wait(50);
  check("검색(뜻)", $$(".card").length >= 2, $$(".card").length);
  input($("#v-q"), ""); await wait(50);
  change($("#v-pos"), "verb"); await wait(50);
  const verbs = $$(".card").length;
  check("품사 필터(동사)", verbs > 0 && verbs < 44 && $$(".card .pos").every(p => p.textContent.startsWith("동사")), verbs);
  change($("#v-pos"), ""); change($("#v-topic"), "업무·조직"); await wait(50);
  check("주제 필터", $$(".card .pos").every(p => p.textContent.includes("업무·조직")), $$(".card").length);
  change($("#v-topic"), ""); await wait(50);
  // 카드 펼치기 → 유의어 표시
  $(".card-face").click(); await wait(50);
  check("카드 상세(유의어·표현)", !!$(".card .rels") && $(".card .rels").textContent.includes("유의어"), $(".card .rels") && $(".card .rels").textContent.slice(0, 40));
  // 즐겨찾기 / 몰라요 / 외웠어요
  $('[data-act="fav"]').click(); await wait(50);
  $$('[data-act="unknown"]')[1].click(); await wait(50);
  $$('[data-act="known"]')[2].click(); await wait(50);
  $('[data-status="fav"]').click(); await wait(50);
  check("즐겨찾기 필터", $$(".card").length === 1, $$(".card").length);
  $('[data-status="unknown"]').click(); await wait(50);
  check("몰라요 필터", $$(".card").length === 1, $$(".card").length);
  $('[data-status="review"]').click(); await wait(50);
  check("복습 필요 필터(몰라요 포함)", $$(".card").length === 1 && $("#due-count").textContent === "1", $$(".card").length + " / due " + $("#due-count").textContent);
  $('[data-status="known"]').click(); await wait(50);
  check("외운 단어 필터 + 도장", $$(".card").length === 1 && !!$(".seal"));
  check("외움 수", $("#known-count").textContent === "1");

  // 플래시카드
  $('[data-mode="cards"]').click(); await wait(50);
  check("플래시카드 시작", !!$(".flash-word") && !!$("#flip"), $(".progress") && $(".progress").textContent);
  const firstWord = $(".flash-word").textContent;
  $("#flip").click(); await wait(50);
  check("답 보기", !!$(".flash-back .meaning") && $$(".grade").length === 4);
  check("간격 미리보기", $$(".grade small").map(s => s.textContent).join(",") === "오늘,1일 뒤,1일 뒤,3일 뒤", $$(".grade small").map(s => s.textContent).join(","));
  $(".grade-good").click(); await wait(50);
  const words = JSON.parse(localStorage.getItem("n1lab:words"));
  const reviewed = Object.values(words).find(w => w.srs);
  check("SRS 저장", !!reviewed && reviewed.srs.interval === 1 && reviewed.srs.reps === 1, JSON.stringify(reviewed && reviewed.srs));
  check("다음 카드로", $(".flash-word") && $(".flash-word").textContent !== firstWord);
  $("#flip").click(); await wait(30);
  $(".grade-again").click(); await wait(50);
  const act = JSON.parse(localStorage.getItem("n1lab:activity"));
  check("학습량 기록", Object.values(act)[0].cards === 2, JSON.stringify(act));

  // 퀴즈
  $('[data-mode="quiz"]').click(); await wait(50);
  check("무작위 뜻 퀴즈 10문제", $$(".q").length === 10, $$(".q").length);
  const q0 = $$(".q")[0];
  const correctIdx = [...q0.querySelectorAll(".opt")].findIndex(() => false);
  // 일부러 틀린 답 고르기: 정답이 아닌 것을 찾기 위해 하나 누르고 결과 확인
  q0.querySelector('[data-o="0"]').click(); await wait(50);
  const wasWrong = !!q0.querySelector(".fb-verdict.bad");
  check("자동 문제 해설", q0.querySelector(".fb") && q0.querySelector(".fb").textContent.includes("뜻이에요"));
  const at = JSON.parse(localStorage.getItem("n1lab:attempts"));
  check("자동 문제 기록(snap 포함)", at.length === 1 && !!at[0].snap, JSON.stringify(at[0]).slice(0, 80));
  if (wasWrong) {
    const w2 = JSON.parse(localStorage.getItem("n1lab:words"));
    const wid = at[0].snap.wordId;
    check("틀린 단어 → 오늘 복습", w2[wid] && w2[wid].wrong === 1 && w2[wid].srs.due <= new Date().toISOString().slice(0, 10), JSON.stringify(w2[wid]));
  } else log.push("SKIP 틀린 단어 확인(첫 답이 정답이었음)");
  $('[data-qt="exam"]').click(); await wait(50);
  check("시험형 13문제", $$(".q").length === 13, $$(".q").length);
  check("밑줄 표시", $$(".q u.mark-under").length >= 5);
  $('[data-qt="reading"]').click(); await wait(50);
  check("읽기 퀴즈", $$(".q").length === 10 && $(".q-text").textContent.includes("読み方"));

  // 헷갈리는 단어
  $('[data-mode="compare"]').click(); await wait(50);
  check("비교 5세트", $$(".compare").length === 5, $$(".compare").length);

  // 문법
  location.hash = "grammar"; await wait(200);
  check("문법 20개", $$(".g-item").length === 20, $$(".g-item").length);
  check("문법 문제 16개", $$(".q").length === 16, $$(".q").length);
  $("details.g-more summary").click(); await wait(50);
  const det = $("details.g-more");
  check("자세히 보기", det.open && det.textContent.includes("유사 문법과의 차이") && det.textContent.includes("사용 시 주의사항"));
  $('[data-gact="studied"]').click(); await wait(50);
  check("공부했어요", $("#g-studied").textContent === "1");
  check("펼침 유지", $("details.g-more").open === true);
  input($("#g-q"), "べく"); await wait(50);
  check("문법 검색", $$(".g-item").length === 1, $$(".g-item").length);
  input($("#g-q"), ""); await wait(50);
  $('[data-kind="문장 배열"]').click(); await wait(50);
  check("유형 필터(문장 배열)", $$(".q").length === 3, $$(".q").length);
  $$(".q")[0].querySelector('[data-o="0"]').click(); await wait(50);
  check("배열 문제 오답 해설", $$(".q")[0].textContent.includes("바른 순서"));
  check("가로 스크롤 없음", document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + "/" + window.innerWidth);
  return log.join("\n");
})()
