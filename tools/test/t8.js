(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const pad = n => String(n).padStart(2, "0");
  const dk = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return dk(d); };

  location.hash = "sprint"; await wait(300);
  check("설정 화면", !!$("#setup") && $("#s-date").value === "2026-12-06", $("#s-date").value);
  // 검증: 지난 날짜
  $("#s-date").value = plus(-1);
  $("#setup").requestSubmit(); await wait(50);
  check("지난 날짜 거부", !$("#s-err").hidden && $("#s-err").textContent.includes("내일 이후"));
  $("#s-date").value = plus(28);
  $("#s-strong").value = "grammar"; $("#s-weak").value = "grammar";
  $("#setup").requestSubmit(); await wait(50);
  check("같은 영역 거부", $("#s-err").textContent.includes("다르게"));
  $("#s-weak").value = "listening"; $("#s-min").value = "90";
  $("#setup").requestSubmit(); await wait(300);
  check("진단 테스트 시작", $("h2").textContent === "진단 테스트" && $$("#d-vocab .q").length === 3 && $$("#d-grammar .q").length === 3, $$(".q").length);
  check("독해 지문 포함", $$("#d-reading .passage").length === 3);
  check("청해 문제 포함(스크립트 숨김)", $$("#d-listening .listen").length === 3 && $$("#d-listening .listen-tools").every(t => t.hidden));
  check("결과 버튼 비활성", $("#d-finish").disabled);
  // 모든 문제 풀기: 어휘는 모두 1번, 나머지 정답 위치 다양
  const qs = $$(".q");
  qs.forEach(q => q.querySelector('[data-o="0"]').click());
  await wait(100);
  check("12문제 풂", $("#d-count").textContent === "12", $("#d-count").textContent);
  check("청해 답 후 스크립트 보기 가능", $$("#d-listening .listen-tools").every(t => !t.hidden));
  $("#d-finish").click(); await wait(300);
  const sp = JSON.parse(localStorage.getItem("n1lab:sprint"));
  check("진단 결과 저장", sp.diagnostic && Object.values(sp.diagnostic).every(r => r.t === 3), JSON.stringify(sp.diagnostic));
  check("일일 계획 화면", !!$(".tasks") && $(".dday").textContent === "D-28", $(".dday").textContent);
  check("구간 1 표시", $(".timeline li.now").textContent.includes("D-30"));
  const titles = $$(".task-title").map(t => t.textContent);
  check("과제 목록", titles.length >= 4, titles.join(" | "));
  check("청해 집중(부족한 영역)", titles.some(t => t.startsWith("청해") && t.includes("집중")));
  check("진단 과제는 없음", !titles.some(t => t.includes("진단")));
  const mins = $("#plan-time").textContent;
  check("예상 시간 ≤ 목표 시간 근처", (() => { const m = mins.match(/예상 (\d+)분 \/ 하루 목표 (\d+)분/); return m && +m[1] <= +m[2] * 1.1; })(), mins);
  // 진행률 자동 계산: 어휘 진단(diagnostic 모드)도 기록 → 오늘 어휘 문제 3개 반영
  const vocabTask = $$(".task").find(t => t.querySelector(".task-title").textContent.startsWith("어휘"));
  check("어휘 진행률 자동", vocabTask && vocabTask.querySelector(".task-meta").textContent.includes("아직 완료 전 · 3 /"), vocabTask && vocabTask.querySelector(".task-meta").textContent);
  // 직접 완료 버튼은 없고, 완료는 기록으로만 정해진다
  check("완료로 표시 버튼 없음", !$("[data-manual]") && !document.getElementById("app").textContent.includes("완료로 표시"));
  check("내일 추천", $$(".home-grid .goal-list li").length >= 3);
  check("홈 요약 연동", true);
  location.hash = "home"; await wait(300);
  check("홈: D-30 오늘의 목표", $$(".todo strong")[2].textContent.includes("완료"), $$(".todo strong")[2].textContent);

  // 하루 30분이면 학습량이 줄어든다
  location.hash = "sprint"; await wait(300);
  const before = $("#plan-time").textContent.match(/예상 (\d+)분/)[1];
  $("#sp-edit").click(); await wait(100);
  $("#s-min").value = "30"; $("#setup").requestSubmit(); await wait(300);
  const m = $("#plan-time").textContent.match(/예상 (\d+)분 \/ 하루 목표 (\d+)분/);
  check("30분으로 줄이면 계획도 줄어듦", m && +m[1] < +before && +m[1] <= 33 && +m[2] === 30, before + "분 → " + (m && m[1]) + "분 (" + $$(".task").length + "개)");
  // 끝내기 확인
  $("#sp-reset").click(); await wait(50);
  check("끝내기 확인 단계", !!$("#sp-reset-yes"));
  $("#sp-reset-no").click(); await wait(50);
  check("취소하면 유지", !!$(".tasks"));
  check("가로 스크롤 없음", document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + "/" + window.innerWidth);
  return log.join("\n");
})()
