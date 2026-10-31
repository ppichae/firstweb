(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));

  check("에러 상자 없음", !$(".error-box"), $(".error-box") && $(".error-box").textContent);
  check("탭 3개", $$(".tab").length === 3, $$(".tab").length);
  check("단어 카드 14개", $$(".card").length === 14, $$(".card").length);
  // 카드 뒤집기
  $(".card-face").click(); await wait(50);
  check("카드 뜻 표시", !!$(".card .meaning"), $(".card .meaning") && $(".card .meaning").textContent);
  // 외웠어요
  $("[data-mark]").click(); await wait(50);
  check("외웠어요 저장", $("#known-count").textContent === "1" && !!$(".seal"), $("#known-count").textContent);
  check("LocalStorage 기록", JSON.stringify(JSON.parse(localStorage.getItem("n1lab:words"))).includes("known"));
  // 필터
  $('[data-filter="done"]').click(); await wait(50);
  check("외운 단어 필터", $$(".card").length === 1, $$(".card").length);
  $('[data-filter="todo"]').click(); await wait(50);
  check("못 외움 필터", $$(".card").length === 13, $$(".card").length);
  $('[data-filter="all"]').click(); $("#toggle-all").click(); await wait(50);
  check("뜻 모두 보기", $$(".card .meaning").length === 14, $$(".card .meaning").length);

  // 문법
  location.hash = "grammar"; await wait(200);
  check("문법 10개", $$(".g-item").length === 10, $$(".g-item").length);
  check("퀴즈 4문제", $$(".q").length === 4, $$(".q").length);
  // 첫 문제 오답 선택
  $$(".q")[0].querySelector('[data-o="1"]').click(); await wait(50);
  const fb = $$(".q")[0].querySelector(".fb");
  check("오답 피드백", !!fb && fb.textContent.includes("오답이에요") && fb.textContent.includes("내가 고른 답이 틀린 이유") && fb.textContent.includes("관련 문법"), fb && fb.textContent.slice(0, 120));
  // 둘째 문제 정답
  $$(".q")[1].querySelector('[data-o="1"]').click(); await wait(50);
  check("정답 피드백", $$(".q")[1].querySelector(".fb").textContent.includes("정답이에요"));
  check("점수", $("#score").textContent === "1 / 4 정답", $("#score").textContent);
  const at = JSON.parse(localStorage.getItem("n1lab:attempts"));
  check("풀이 기록 2건", at.length === 2, at.length);
  $("#reset").click(); await wait(50);
  check("다시 풀기", !$(".fb") && $("#score").textContent === "");

  // 독해
  location.hash = "reading"; await wait(200);
  check("지문 표시", $$(".passage p.jp").length === 3);
  check("밑줄 표시", !!$("u.mark-under"));
  check("해석 숨김", $("#trans").hidden === true);
  $("#toggle-trans").click(); await wait(50);
  check("해석 보기", $("#trans").hidden === false);
  $$(".q")[2].querySelector('[data-o="2"]').click(); await wait(50);
  check("독해 근거 표시", $$(".q")[2].querySelector(".fb").textContent.includes("근거가 되는 부분"));
  check("가로 스크롤 없음", document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + "/" + window.innerWidth);
  return log.join("\n");
})()
