(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const txt = s => ($(s) ? $(s).textContent : "(없음)");
  try {
    const base = location.href.split("#")[0].replace(/index\.html$/, "");
    const sp = await window.eval('import("' + base + 'js/views/sprint.js")');
    const { store } = await window.eval('import("' + base + 'js/store.js")');
    const { addDays, today } = await window.eval('import("' + base + 'js/util.js")');
    const S = n => ({ examDate: addDays(today(), n), minutes: 90, level: "base", goal: "normal", strong: "vocab", weak: "listening", diagnostic: { vocab: { c: 3, t: 3 }, grammar: { c: 2, t: 3 }, reading: { c: 2, t: 3 }, listening: { c: 1, t: 3 } }, diagnosedAt: today(), manual: {} });
    const days = [40, 30, 22, 21, 15, 14, 8, 7, 3, 1];
    const plans = days.map(n => sp.buildPlan(S(n)));
    log.push(plans.map((p, i) => "D-" + days[i] + " " + p.phase.key + " " + p.minutes + "/" + p.budget + "분 [" + p.tasks.map(t => t.id + ":" + t.target).join(" ") + "]").join("\n"));
    const ph = [40, 22, 21, 15, 14, 8, 7, 1].map(n => sp.buildPlan(S(n)).phase.key).join(",");
    check("구간 경계", ph === "p1,p1,p2,p2,p3,p3,p4,p4", ph);
    check("D-0, 지난 날짜는 계획 없음", sp.buildPlan(S(0)) === null && sp.buildPlan(S(-1)) === null);
    check("모든 날 예상 시간 ≤ 목표의 110%", plans.every(p => p.minutes <= p.budget * 1.1), plans.map(p => p.minutes).join(","));
    check("모든 날 목표의 60% 이상", plans.every(p => p.minutes >= p.budget * 0.6), plans.map(p => p.minutes).join(","));
    check("D-14 짝수일 모의고사", sp.buildPlan(S(14)).tasks.some(t => t.id === "mock"));
    check("D-3 최종 모의고사", sp.buildPlan(S(3)).tasks.some(t => t.id === "mock"));
    check("청해 집중(진단 1/3)", sp.buildPlan(S(25)).tasks.find(t => t.id === "lq").focus === true);
    check("자신 있는 어휘는 집중 아님", !sp.buildPlan(S(25)).tasks.find(t => t.id === "vq").focus);

    store.set("sprint", S(-2));
    location.hash = "home"; await wait(150); location.hash = "sprint"; await wait(400);
    check("시험 종료 화면", txt("h2") === "시험이 끝났어요" && !!$("#sp-next"), txt("h2") + " | " + document.getElementById("app").textContent.slice(0, 80));
    if ($("#sp-next")) {
      $("#sp-next").click(); await wait(300);
      check("다음 시험으로 다시 시작 → 진단부터", store.get("sprint").examDate === "2026-12-06" && txt("h2") === "진단 테스트", store.get("sprint").examDate + " " + txt("h2"));
      $("#d-later").click(); await wait(200);
    }
    store.set("sprint", S(0));
    location.hash = "home"; await wait(150); location.hash = "sprint"; await wait(400);
    check("시험 당일 화면", txt(".dday") === "D-DAY", txt(".dday"));
    store.set("sprint", S(40));
    location.hash = "home"; await wait(150); location.hash = "sprint"; await wait(400);
    check("D-40 시작 안내", txt(".exam-tile .tile-sub").includes("D-30까지 10일"), txt(".exam-tile .tile-sub"));
  } catch (e) { log.push("ERROR " + e.stack); }
  return log.join("\n");
})()
