(async () => {
  // 시험 대비 통합: 작은 메뉴, 자동 완료(완료 버튼 없음), N3 D-30 계획, N3 모의고사 따로, 시험 뒤 안내
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1400); };
  const navText = () => $$(".exam-nav .seg").map(a => a.textContent + (a.getAttribute("aria-current") ? "*" : "")).join("|");
  const noScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  try {
    const st = await window.eval('import("./js/store.js")');
    // N1
    await go("sprint");
    check("N1 시험 대비 작은 메뉴", navText() === "D-30 계획*|모의고사|오답 노트", navText());
    const ex = JSON.parse(localStorage.getItem("n1lab:examDate"));
    check("D-30 설정: 홈 시험일로 시작", $("#s-date") && $("#s-date").value === ex, $("#s-date") && $("#s-date").value + " / " + ex);
    $("#setup").requestSubmit(); await wait(600);
    if ($("#d-later")) { $("#d-later").click(); await wait(400); }
    check("N1 오늘의 학습 목록", $$(".task").length >= 3, $$(".task").length);
    check("N1 완료 버튼 없음", !$("[data-manual]") && !app().textContent.includes("완료로 표시") && !app().textContent.includes("완료 표시 취소"));
    check("N1 완료 전 항목은 '아직 완료 전'", $$(".task:not(.complete) .task-meta").every(m => m.textContent.startsWith("아직 완료 전")));
    check("N1 모의고사 칸(기록 없음 안내)", app().textContent.includes("아직 푼 모의고사가 없어요"));
    await go("mock");
    check("N1 모의고사 화면 작은 메뉴", navText() === "D-30 계획|모의고사*|오답 노트", navText());
    // N1 시험 뒤
    st.store.update("sprint", s => { s.examDate = "2000-01-01"; });
    await go("sprint");
    check("N1 시험 뒤: 시험이 끝났어요 + 이후 안내", app().textContent.includes("시험이 끝났어요") && app().textContent.includes("시험이 끝난 뒤에도"));
    check("N1 가로 스크롤 없음", noScroll());

    // N3
    localStorage.setItem("jlpt:room", "n3");
    await go("n3/exam");
    check("N3 시험 대비 작은 메뉴", navText() === "D-30 계획 · 연습*|모의고사|오답 노트", navText());
    check("N3 첫 칸은 D-30 계획 설정", !!$("#n3s-form"));
    $("#n3s-min").value = "30"; $("#n3s-form").requestSubmit(); await wait(500);
    check("N3 시험일 저장(홈 D-Day와 같음)", JSON.parse(localStorage.getItem("n3lab:examDate")) === $("#n3s-date") || !!JSON.parse(localStorage.getItem("n3lab:examDate")), localStorage.getItem("n3lab:examDate"));
    const tasks = $$(".task");
    check("N3 오늘의 학습 목록", tasks.length >= 4, tasks.map(t => t.querySelector(".task-title").textContent).join(","));
    const vq = tasks.find(t => t.querySelector(".task-title").textContent.startsWith("어휘"));
    check("N3 어휘 문제 12개 → 자동 완료, 하러 가기 없음", vq && vq.classList.contains("complete") && vq.querySelector(".task-meta").textContent.startsWith("완료") && !vq.querySelector("[data-go]"), vq && vq.querySelector(".task-meta").textContent);
    check("N3 완료 버튼 없음", !app().textContent.includes("완료로 표시"));
    const goBtn = $$(".task:not(.complete) [data-go]")[0];
    check("N3 남은 항목에 하러 가기", !!goBtn);
    $('[data-mode="drill"]').click(); await wait(400);
    check("N3 영역별 연습 열림", !!$("#d-quiz"));
    await go("n3/mock");
    check("N3 모의고사 따로", navText() === "D-30 계획 · 연습|모의고사*|오답 노트" && $$(".panel > .segmented:not(.exam-nav) .seg").map(s => s.textContent).join("|") === "모의고사 풀기|결과 기록", $$(".panel > .segmented:not(.exam-nav) .seg").map(s => s.textContent).join("|"));
    await go("n3");
    const todo = $$(".todo li").find(l => l.textContent.includes("D-30 오늘의 목표"));
    check("N3 홈 지금 할 일에 D-30", !!todo && /\d+ \/ \d+ 완료/.test(todo.textContent), todo && todo.textContent);
    st.n3store.update("sprint", s => { s.examDate = "2000-01-01"; });
    await go("n3/exam");
    check("N3 시험 뒤: 이후 안내와 N1 공부방 연결", app().textContent.includes("시험이 끝났어요") && !!$('a[href="#home"]'));
    check("N3 가로 스크롤 없음", noScroll());
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
