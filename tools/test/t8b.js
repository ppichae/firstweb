(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const base = location.href.split("#")[0].replace(/index\.html$/, "");
  const sp = await window.eval('import("' + base + 'js/views/sprint.js")');
  const { store } = await window.eval('import("' + base + 'js/store.js")');
  const { addDays, today } = await window.eval('import("' + base + 'js/util.js")');
  const S = n => ({ examDate: addDays(today(), n), minutes: 90, level: "base", goal: "normal", strong: "vocab", weak: "listening", diagnostic: { vocab: { c: 3, t: 3 }, grammar: { c: 2, t: 3 }, reading: { c: 2, t: 3 }, listening: { c: 1, t: 3 } }, manual: {} });
  const rows = [];
  for (const n of [40, 30, 22, 21, 15, 14, 8, 7, 3, 1]) {
    const p = sp.buildPlan(S(n));
    rows.push("D-" + n + " " + p.phase.key + " " + p.minutes + "/" + p.budget + "분 [" + p.tasks.map(t => t.id + ":" + t.target).join(" ") + "]");
  }
  log.push(rows.join("\n"));
  const ph = [40, 22, 21, 15, 14, 8, 7, 1].map(n => sp.buildPlan(S(n)).phase.key).join(",");
  check("구간 경계", ph === "p1,p1,p2,p2,p3,p3,p4,p4", ph);
  check("D-0, 지난 날짜는 계획 없음", sp.buildPlan(S(0)) === null && sp.buildPlan(S(-1)) === null);
  const all = [40, 30, 22, 21, 15, 14, 8, 7, 3, 1].map(n => sp.buildPlan(S(n)));
  check("모든 날 예상 시간 ≤ 목표의 110%", all.every(p => p.minutes <= p.budget * 1.1), all.map(p => p.minutes).join(","));
  check("모든 날 목표의 60% 이상", all.every(p => p.minutes >= p.budget * 0.6), all.map(p => p.minutes).join(","));
  check("D-14 짝수일 모의고사", sp.buildPlan(S(14)).tasks.some(t => t.id === "mock"));
  check("D-3 최종 모의고사", sp.buildPlan(S(3)).tasks.some(t => t.id === "mock"));
  check("청해 집중(진단 1/3)", sp.buildPlan(S(25)).tasks.find(t => t.id === "lq").focus === true);
  check("자신 있는 어휘는 집중 아님", !sp.buildPlan(S(25)).tasks.find(t => t.id === "vq").focus);
  // 시험이 지난 상태 화면
  store.set("sprint", Object.assign(S(-2), {}));
  location.hash = "home"; await wait(100); location.hash = "sprint"; await wait(300);
  log.push("DEBUG app: " + document.getElementById("app").innerHTML.slice(0, 300) + " hash=" + location.hash);
  check("시험 종료 화면", $("h2") && $("h2").textContent === "시험이 끝났어요" && !!$("#sp-next"), $("h2").textContent);
  $("#sp-next").click(); await wait(300);
  const s2 = store.get("sprint");
  if (!$("#sp-next")) return log.join("
");
  check("다음 시험으로 다시 시작 → 진단부터", s2.examDate === "2026-12-06" && $("h2").textContent === "진단 테스트", s2.examDate);
  // 시험 당일
  store.set("sprint", S(0));
  location.hash = "home"; await wait(100); location.hash = "sprint"; await wait(300);
  check("시험 당일 화면", $(".dday") && $(".dday").textContent === "D-DAY");
  // D-30보다 이른 시작
  store.set("sprint", S(40));
  location.hash = "home"; await wait(100); location.hash = "sprint"; await wait(300);
  check("D-40 시작 안내", $(".exam-tile .tile-sub").textContent.includes("D-30까지 10일"), $(".exam-tile .tile-sub").textContent);
  return log.join("\n");
})()
