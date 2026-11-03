(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  location.hash = "notes"; await wait(300);
  check("빈 오답 노트 안내", $(".empty") && $(".empty").textContent.includes("아직 틀린 문제가 없어요"));
  // 문법 1문제 틀리기, 1문제 맞히기
  location.hash = "grammar"; await wait(1500); document.querySelector("[data-mode=quiz]").click(); await wait(200); document.querySelector("[data-gq=exam]").click(); await wait(200);
  $$(".q")[0].querySelector('[data-o="2"]').click(); await wait(30);
  $(".qr-next").click(); await wait(100);   // 한 문제씩: 다음 문제로 넘어가서 두 번째 문제를 푼다
  $(".qr-q .q").querySelector('[data-o="1"]').click(); await wait(30);
  // 어휘 자동 문제 틀리기 (정답 아닌 보기 찾기)
  location.hash = "vocab"; await wait(1500); { const s = document.querySelector("#v-src"); s.value = "core"; s.dispatchEvent(new window.Event("change", { bubbles: true })); await wait(100); }
  $('[data-mode="quiz"]').click(); await wait(100);
  const q0 = $$(".q")[0];
  q0.querySelector('[data-o="0"]').click(); await wait(30);
  const vocabWrong = !!q0.querySelector(".fb-verdict.bad");
  // 독해 틀리기
  location.hash = "reading"; await wait(300);
  $$(".q")[0].querySelector('[data-o="1"]').click(); await wait(30);
  // 청해 틀리기
  location.hash = "listening"; await wait(300);
  $(".q").querySelector('[data-o="0"]').click(); await wait(30);

  location.hash = "notes"; await wait(300);
  const expected = 3 + (vocabWrong ? 1 : 0);
  check("오답 자동 수집", $$(".note").length === expected, $$(".note").length + " (expected " + expected + ")");
  check("영역 칩 개수", $('[data-narea="grammar"]').textContent.includes("1") && $('[data-narea="reading"]').textContent.includes("1"));
  const n = $(".note");
  check("내 답·정답·횟수·날짜", ["내가 고른 답", "정답", "틀린 횟수", "마지막으로 틀린 날"].every(t => n.textContent.includes(t)));
  check("상세 해설", n.querySelector("details").textContent.includes("정답인 이유"));
  $('[data-narea="reading"]').click(); await wait(50);
  check("영역 필터", $$(".note").length === 1 && !!$("[data-open]"));
  // 다시 풀기 → 맞히기
  $("[data-retry]").click(); await wait(50);
  const retryQ = $(".retry .q");
  check("다시 풀기 문제 표시", !!retryQ);
  const ansIdx = 0; // rq001 정답 0
  retryQ.querySelector('[data-o="' + ansIdx + '"]').click(); await wait(50);
  check("다시 풀어 정답", !!retryQ.querySelector(".fb-verdict.good"));
  // 다시 그리면 극복함으로 이동, 기록 유지
  location.hash = "grammar"; await wait(100); location.hash = "notes"; await wait(300);
  $('[data-narea="reading"]').click(); await wait(50);
  check("극복한 문제는 '다시 풀 문제'에서 빠짐", $$(".note").length === 0);
  $('[data-nstatus="done"]').click(); await wait(50);
  const h = $$(".note .history span").map(s => s.textContent).join("");
  check("과거 기록 유지(✕○)", h === "✕○", h);
  $('[data-nstatus="all"]').click(); $('[data-narea="all"]').click(); await wait(50);
  check("모두 보기", $$(".note").length === expected, $$(".note").length);
  // 지문 열기
  $('[data-narea="reading"]').click(); await wait(50);
  $("[data-open]").click(); await wait(300);
  check("지문 열기 → 독해 화면", location.hash === "#reading" && !!$(".passage"));
  return log.join("\n");
})()
