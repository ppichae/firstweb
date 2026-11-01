// D-30 FINAL SPRINT: 시험 전 한 달 동안 매일 개인 학습 계획을 만들어 주는 집중 모드
// 계획은 날마다 새로 계산한다. 어제 못 한 일을 오늘에 더하지 않아서 학습량이 끝없이 쌓이지 않는다.
import { DB } from "../data.js";
import { store } from "../store.js";
import { esc, AREAS, today, addDays, diffDays, fmtDate, dateKey, shuffle } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { nextExam } from "../exam.js";
import { reviewWordIds, openVocabMode } from "./vocab.js";
import { unresolvedNotes } from "../stats.js";
import { renderItem as mountListening } from "./listening.js";
import { passageTextHTML } from "./reading.js";
import { stopAll } from "../speech.js";
import { examTarget } from "../dday.js";
import { examNavHTML, afterExamHTML, mockSummaryHTML } from "../examHub.js";

export const PHASES = [
  { key: "p1", from: 30, to: 22, name: "진단과 기초 다지기", goals: ["전체 실력 진단", "부족한 어휘와 문법 정리", "핵심 개념 학습"] },
  { key: "p2", from: 21, to: 15, name: "취약 영역 집중", goals: ["취약 영역 집중 훈련", "오답 반복 복습", "독해·청해 유형별 연습"] },
  { key: "p3", from: 14, to: 8, name: "실전 감각 익히기", goals: ["실전 모의고사", "시간 관리 훈련", "영역별 약점 보완"] },
  { key: "p4", from: 7, to: 1, name: "마무리 점검", goals: ["오답 노트 집중 복습", "자주 틀리는 어휘·문법 확인", "최종 실전 점검"] },
];
// D-30보다 일찍 시작하면 D-22까지는 첫 구간 계획을 쓴다
export function phaseFor(left) {
  if (left >= 22) return PHASES[0];
  if (left >= 15) return PHASES[1];
  if (left >= 8) return PHASES[2];
  if (left >= 1) return PHASES[3];
  return null;
}

const LEVELS = { start: "N1 준비를 막 시작했어요", base: "기초는 있어요 (N2 합격 수준)", near: "합격권에 가까워요" };
const GOALS = { light: { label: "가볍게 (공부 시간의 80%)", mult: 0.8 }, normal: { label: "보통 (공부 시간만큼)", mult: 1 }, hard: { label: "많이 (공부 시간의 120%)", mult: 1.2 } };
const MINUTES = [30, 60, 90, 120, 180];

// 한 단위에 걸리는 예상 시간(분). 계획의 총 시간을 하루 공부 시간에 맞출 때 쓴다
const COST = { card: 0.4, vocabQ: 0.6, grammarQ: 1, grammarStudy: 3, readingQ: 3, listeningQ: 2, note: 1.5, diag: 20, mock: 50 };
const UNIT = { card: "장", vocabQ: "문제", grammarQ: "문제", grammarStudy: "개", readingQ: "문제", listeningQ: "문제", note: "문제", diag: "회", mock: "회" };

const ui = { diag: false, editing: false, confirmReset: false };

/* ---------- 계획 계산 ---------- */

// 집중할 영역: 진단에서 3문제 중 1개 이하로 맞힌 영역 + 스스로 고른 부족한 영역
export function focusAreas(s) {
  const set = new Set();
  if (s.weak) set.add(s.weak);
  if (s.diagnostic) Object.entries(s.diagnostic).forEach(([a, r]) => { if (r.c <= 1) set.add(a); });
  if (s.strong && set.has(s.strong) && !(s.diagnostic && s.diagnostic[s.strong].c <= 1)) set.delete(s.strong);
  return [...set];
}

export function buildPlan(s, day = today()) {
  const left = diffDays(day, s.examDate);
  const phase = phaseFor(left);
  if (!phase) return null;
  const budget = Math.round(s.minutes * GOALS[s.goal].mult);
  const focus = focusAreas(s);
  const isToday = day === today();
  const due = isToday ? reviewWordIds().length : null;
  const notesOpen = unresolvedNotes().length;
  const lv = s.level;
  const tasks = [];
  const add = (id, metric, target, title, detail, link, prio, area) =>
    tasks.push({ id, metric, target, title, detail, link, prio, area, scalable: metric !== "diag" && metric !== "mock" });

  if (!s.diagnostic) add("diag", "diag", 1, "진단 테스트", "어휘·문법·독해·청해 각 3문제로 지금 실력을 확인해요. 결과에 따라 계획이 바뀌어요.", "diag", 0);
  const newCards = phase.key === "p4" ? 0 : lv === "start" ? 15 : 10;
  add("cards", "card", Math.max(10, Math.min(60, (due === null ? 15 : due) + newCards)), "단어 플래시카드",
    "복습할 단어" + (newCards ? "와 새 단어" : "") + "를 간격 반복으로 외워요.", "vocab:cards", 1, "vocab");

  if (phase.key === "p1") {
    add("gstudy", "grammarStudy", lv === "start" ? 4 : 3, "문법 문형 공부", "문형을 펼쳐 상세 설명과 유사 문법 차이를 읽고 '공부했어요'를 눌러요.", "grammar", 2, "grammar");
    add("vq", "vocabQ", 10, "어휘 문제", "무작위 뜻·읽기 퀴즈나 시험형 문제를 풀어요.", "vocab:quiz", 3, "vocab");
    add("gq", "grammarQ", 5, "문법 문제", "빈칸·배열·문맥 문제를 풀어요.", "grammar", 3, "grammar");
    add("rq", "readingQ", 2, "독해", "단문이나 중문 지문을 하나 골라 풀어요.", "reading", 4, "reading");
    add("lq", "listeningQ", 2, "청해", "과제 이해·포인트 이해 문제를 들어요.", "listening", 4, "listening");
  } else if (phase.key === "p2") {
    if (notesOpen) add("notes", "note", Math.min(notesOpen, 8), "오답 다시 풀기", "오답 노트의 '다시 풀 문제'를 풀어요.", "notes", 2);
    add("vq", "vocabQ", 10, "어휘 문제", "문맥 규정·바꿔 말하기 같은 시험형 문제 위주로 풀어요.", "vocab:quiz", 3, "vocab");
    add("gq", "grammarQ", 6, "문법 문제", "유사 문법 구별과 문장 배열 문제를 풀어요.", "grammar", 3, "grammar");
    add("rq", "readingQ", 3, "독해 유형별 연습", "아직 안 푼 유형(통합 이해·정보 검색 등)을 골라요.", "reading", 3, "reading");
    add("lq", "listeningQ", 3, "청해 유형별 연습", "개요 이해·즉시 응답·통합 이해도 들어 보세요.", "listening", 3, "listening");
  } else if (phase.key === "p3") {
    if (left % 2 === 0) add("mock", "mock", 1, "실전 모의고사", "시간을 재고 끝까지 풀어요. 결과는 학습용 추정치예요.", "mock", 1);
    else add("rq", "readingQ", 4, "독해 시간 재며 풀기", "지문마다 표시된 예상 시간 안에 푸는 연습을 해요.", "reading", 2, "reading");
    if (notesOpen) add("notes", "note", Math.min(notesOpen, 6), "오답 다시 풀기", "모의고사에서 틀린 문제부터 다시 풀어요.", "notes", 2);
    add("gq", "grammarQ", 5, "문법 문제", "약한 유형 위주로 풀어요.", "grammar", 4, "grammar");
    add("lq", "listeningQ", 3, "청해", "속도 1.2배로 들어 보는 것도 좋아요.", "listening", 4, "listening");
    add("vq", "vocabQ", 8, "어휘 문제", "시험형 문제를 풀어요.", "vocab:quiz", 4, "vocab");
  } else {
    if (notesOpen) add("notes", "note", Math.min(notesOpen, 12), "오답 노트 집중 복습", "'많이 틀린 순'으로 정렬해서 다시 풀어요.", "notes", 1);
    else add("rq", "readingQ", 3, "독해 실전 감각 유지", "다시 풀 오답이 없으니, 시간을 재며 지문을 풀어요.", "reading", 1, "reading");
    add("vq", "vocabQ", 10, "자주 틀린 어휘 확인", "단어장의 '복습 필요' 필터로 틀렸던 단어를 확인하고 퀴즈를 풀어요.", "vocab:quiz", 2, "vocab");
    add("gq", "grammarQ", 5, "자주 틀린 문법 확인", "오답 노트의 문법 영역과 유사 문법 구별 문제를 다시 봐요.", "grammar", 2, "grammar");
    if (left === 3) add("mock", "mock", 1, "최종 실전 점검 (모의고사)", "실제 시험과 같은 순서로 풀어 봐요.", "mock", 1);
    else add("lq", "listeningQ", 2, "청해 감각 유지", "짧은 문제로 귀를 풀어요.", "listening", 3, "listening");
  }

  // 집중 영역은 목표량을 늘리고 제목에 표시한다
  tasks.forEach(t => {
    if (t.area && focus.includes(t.area) && t.scalable) { t.target = Math.ceil(t.target * 1.5); t.focus = true; t.prio -= 0.5; }
    if (t.area && t.area === s.strong && !focus.includes(t.area) && t.scalable) t.target = Math.max(1, Math.round(t.target * 0.7));
  });

  // 하루 공부 시간에 맞춘다: 넘치면 목표량을 줄이고, 그래도 넘치면 우선순위가 낮은 일을 뺀다
  const cost = t => COST[t.metric] * t.target;
  const sum = () => tasks.reduce((n, t) => n + cost(t), 0);
  // 시간이 많이 남으면 목표량을 늘린다 (최대 2.5배)
  const fixed = tasks.filter(t => !t.scalable).reduce((n, t) => n + cost(t), 0);
  if (sum() > budget) {
    const f = Math.max(0.1, (budget - fixed) / (sum() - fixed));
    tasks.forEach(t => { if (t.scalable) t.target = Math.max(1, Math.floor(t.target * f)); });
  } else if (sum() < budget * 0.8 && sum() > fixed) {
    const f = Math.min(2.5, (budget * 0.95 - fixed) / (sum() - fixed));
    tasks.forEach(t => { if (t.scalable) t.target = Math.max(1, Math.floor(t.target * f)); });
  }
  // 다시 풀 오답 수보다 많이, 카드 80장보다 많이 잡지 않는다
  tasks.forEach(t => {
    if (t.metric === "note") t.target = Math.min(t.target, notesOpen);
    if (t.metric === "card") t.target = Math.min(t.target, 80);
  });
  tasks.sort((a, b) => a.prio - b.prio);
  while (sum() > budget * 1.1 && tasks.length > 2) {
    const i = tasks.map(t => t.scalable).lastIndexOf(true);
    if (i < 0) break;
    tasks.splice(i, 1);
  }
  tasks.forEach(t => { t.minutes = Math.max(1, Math.round(cost(t))); t.unit = UNIT[t.metric]; });
  return { day, left, phase, budget, tasks, minutes: Math.round(sum()), focus };
}

// 오늘 실제로 한 양 (풀이 기록·카드 복습 기록에서 센다)
function metricDone(metric, day) {
  const at = store.get("attempts").filter(a => dateKey(new Date(a.at)) === day);
  const areaCount = area => at.filter(a => a.area === area && a.mode !== "mock").length;
  switch (metric) {
    case "card": return ((store.get("activity")[day] || {}).cards) || 0;
    case "vocabQ": return areaCount("vocab");
    case "grammarQ": return areaCount("grammar");
    case "readingQ": return areaCount("reading");
    case "listeningQ": return areaCount("listening");
    case "note": return at.filter(a => a.mode === "review").length;
    case "grammarStudy": return Object.values(store.get("grammar")).filter(g => g.studied === day).length;
    case "diag": return store.get("sprint") && store.get("sprint").diagnostic ? 1 : 0;
    case "mock": return store.get("mocks").filter(m => dateKey(new Date(m.at)) === day).length;
    default: return 0;
  }
}

function withProgress(plan, s) {
  // 완료는 실제로 푼 문제·복습 기록으로만 정한다 (예전에 직접 완료 표시한 기록 s.manual은 지우지 않고 남겨 두지만 쓰지 않는다)
  plan.tasks.forEach(t => {
    t.done = metricDone(t.metric, plan.day);
    t.complete = t.done >= t.target;
    t.ratio = t.complete ? 1 : Math.min(1, t.done / t.target);
  });
  plan.completed = plan.tasks.filter(t => t.complete).length;
  return plan;
}

// 홈 화면용 오늘 요약. 모드를 시작하지 않았거나 시험이 지났으면 null
export function sprintSummary() {
  const s = store.get("sprint");
  if (!s) return null;
  const plan = buildPlan(s);
  if (!plan) return null;
  withProgress(plan, s);
  return { done: plan.completed, total: plan.tasks.length };
}

/* ---------- 화면 ---------- */

function render(app) {
  stopAll();
  const s = store.get("sprint");
  if (!s || ui.editing) { renderSetup(app, s); addNav(app); return; }
  if (ui.diag) return renderDiagnostic(app, s);
  const left = diffDays(today(), s.examDate);
  if (left < 0) renderFinished(app, s);
  else renderDaily(app, s, left);
  addNav(app);
}

// 시험 대비 안의 작은 메뉴(D-30 계획 · 모의고사 · 오답 노트)를 화면 맨 위에 붙인다
function addNav(app) {
  const p = app.querySelector(".panel");
  if (p) p.insertAdjacentHTML("afterbegin", examNavHTML("n1", "sprint"));
}

function renderSetup(app, s) {
  const exam = nextExam();
  const room = examTarget(store);   // 홈에서 정한 시험일이 있으면 그 날짜로 시작한다
  const v = s || { examDate: room ? room.date : exam ? exam.date : addDays(today(), 30), minutes: 90, level: "base", strong: "vocab", weak: "listening", goal: "normal" };
  const opt = (obj, cur) => Object.entries(obj).map(([k, l]) => '<option value="' + k + '"' + (k === cur ? " selected" : "") + ">" + esc(typeof l === "string" ? l : l.label) + "</option>").join("");
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>D-30 FINAL SPRINT</h2><p>시험 한 달 전부터 매일 할 일을 정해 주는 집중 모드예요. 정보를 입력하면 진단 테스트 뒤에 계획을 만들어요.</p></div></div>' +
      '<form class="setup card-box" id="setup" novalidate>' +
        '<div class="form-grid">' +
          '<div class="field"><label for="s-date">시험 날짜</label><input id="s-date" type="date" required value="' + esc(v.examDate) + '">' +
            (exam ? '<span class="hint">공식 일정: ' + esc(exam.label) + " " + fmtDate(exam.date) + "</span>" : "") + "</div>" +
          '<div class="field"><label for="s-min">하루 공부 가능 시간</label><select id="s-min">' + MINUTES.map(m => '<option value="' + m + '"' + (m === v.minutes ? " selected" : "") + ">" + (m >= 60 ? Math.floor(m / 60) + "시간" + (m % 60 ? " " + m % 60 + "분" : "") : m + "분") + "</option>").join("") + "</select></div>" +
          '<div class="field"><label for="s-level">현재 N1 실력</label><select id="s-level">' + opt(LEVELS, v.level) + "</select></div>" +
          '<div class="field"><label for="s-goal">목표 학습량</label><select id="s-goal">' + opt(GOALS, v.goal) + "</select></div>" +
          '<div class="field"><label for="s-strong">가장 자신 있는 영역</label><select id="s-strong">' + opt(AREAS, v.strong) + "</select></div>" +
          '<div class="field"><label for="s-weak">가장 부족한 영역</label><select id="s-weak">' + opt(AREAS, v.weak) + "</select></div>" +
        "</div>" +
        '<p class="form-error" id="s-err" role="alert" hidden></p>' +
        '<div class="toolbar"><button type="submit" class="btn">' + (s ? "저장하기" : "시작하기") + "</button>" +
          (s ? '<button type="button" class="btn ghost" id="s-cancel">취소</button>' : "") + "</div>" +
      "</form>" +
      '<article class="card-box"><h3>이렇게 진행돼요</h3><ol class="phases-list">' + PHASES.map(p =>
        "<li><b>D-" + p.from + " ~ D-" + p.to + "</b> " + esc(p.name) + ' <span class="hint">' + p.goals.map(esc).join(" · ") + "</span></li>").join("") + "</ol>" +
        '<p class="hint">D-30보다 일찍 시작하면 D-22까지는 첫 구간 계획으로 공부해요.</p></article>' +
    "</section>";

  const cancel = app.querySelector("#s-cancel");
  if (cancel) cancel.onclick = () => { ui.editing = false; render(app); };
  app.querySelector("#setup").onsubmit = e => {
    e.preventDefault();
    const val = id => app.querySelector(id).value;
    const err = app.querySelector("#s-err");
    const date = val("#s-date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = "시험 날짜를 입력해 주세요."; err.hidden = false; return; }
    if (date <= today()) { err.textContent = "시험 날짜는 내일 이후로 골라 주세요. 오늘이나 지난 날짜로는 계획을 만들 수 없어요."; err.hidden = false; return; }
    if (val("#s-strong") === val("#s-weak")) { err.textContent = "자신 있는 영역과 부족한 영역을 다르게 골라 주세요."; err.hidden = false; return; }
    const next = Object.assign({}, s || { startedAt: today(), manual: {}, diagnostic: null }, {
      examDate: date, minutes: Number(val("#s-min")), level: val("#s-level"), goal: val("#s-goal"), strong: val("#s-strong"), weak: val("#s-weak"),
    });
    store.set("sprint", next);
    store.set("examDate", date);   // 홈의 D-Day도 같은 시험일을 쓴다
    ui.editing = false;
    ui.diag = !next.diagnostic;
    render(app);
    window.scrollTo(0, 0);
  };
}

/* 진단 테스트: 영역별 3문제 */
function diagnosticSet(s) {
  if (s.diagSet) return s.diagSet;
  const pick = (list, n) => shuffle(list).slice(0, n).map(q => q.id);
  const set = {
    vocab: pick(DB.vocab.questions, 3),
    grammar: pick(DB.grammar.questions.filter(q => q.kind === "빈칸 채우기"), 3),
    reading: ["r002", "r003", "r005"].filter(id => DB.reading.passages.some(p => p.id === id)),
    listening: ["l004", "l005", "l006"].filter(id => DB.listening.items.some(it => it.id === id)),
  };
  store.update("sprint", sp => { sp.diagSet = set; });
  return set;
}

function renderDiagnostic(app, s) {
  const set = diagnosticSet(s);
  const results = { vocab: {}, grammar: {}, reading: {}, listening: {} };
  const total = set.vocab.length + set.grammar.length + set.reading.length + set.listening.length;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>진단 테스트</h2><p>영역별 3문제씩, 모두 ' + total + "문제예요. 모르는 문제는 짐작하지 말고 가장 가까운 답을 고르세요.</p></div>" +
        '<div class="progress">푼 문제 <strong id="d-count">0</strong> / ' + total + "</div></div>" +
      '<h3 class="diag-h">어휘</h3><div class="quiz" id="d-vocab"></div>' +
      '<h3 class="diag-h">문법</h3><div class="quiz" id="d-grammar"></div>' +
      '<h3 class="diag-h">독해</h3><div class="stack" id="d-reading"></div>' +
      '<h3 class="diag-h">청해</h3><div class="stack" id="d-listening"></div>' +
      '<div class="toolbar"><button type="button" class="btn" id="d-finish" disabled>결과 보고 계획 만들기</button>' +
        '<button type="button" class="link-btn" id="d-later">나중에 하기</button></div>' +
    "</section>";

  const finish = app.querySelector("#d-finish");
  const onAnswer = area => (ok, choice, q) => {
    results[area][q.id] = ok;
    const n = Object.values(results).reduce((k, r) => k + Object.keys(r).length, 0);
    app.querySelector("#d-count").textContent = n;
    finish.disabled = n < total;
  };
  const mountList = (area, ids) => {
    const box = app.querySelector("#d-" + area);
    ids.forEach((id, i) => {
      const el = document.createElement("div");
      box.appendChild(el);
      const q = (area === "vocab" ? DB.vocab.questions : DB.grammar.questions).find(x => x.id === id);
      mountQuestion(el, Object.assign({ area }, q), { number: i + 1, mode: "diagnostic", onAnswer: (ok, c) => onAnswer(area)(ok, c, q) });
    });
  };
  mountList("vocab", set.vocab);
  mountList("grammar", set.grammar);
  set.reading.forEach(pid => {
    const p = DB.reading.passages.find(x => x.id === pid);
    const q = p.questions[0];
    const wrap = document.createElement("div");
    wrap.className = "diag-reading";
    wrap.innerHTML = passageTextHTML(p) + '<div class="d-q"></div>';
    app.querySelector("#d-reading").appendChild(wrap);
    mountQuestion(wrap.querySelector(".d-q"), Object.assign({ area: "reading" }, q), { wide: true, mode: "diagnostic", onAnswer: (ok, c) => onAnswer("reading")(ok, c, q) });
  });
  set.listening.forEach((lid, i) => {
    const el = document.createElement("div");
    app.querySelector("#d-listening").appendChild(el);
    mountListening(el, DB.listening.items.find(x => x.id === lid), { number: i + 1, mode: "diagnostic", hideTools: true, onAnswer: onAnswer("listening") });
  });

  finish.onclick = () => {
    const diag = {};
    Object.entries(results).forEach(([a, r]) => { diag[a] = { c: Object.values(r).filter(Boolean).length, t: Object.keys(r).length }; });
    store.update("sprint", sp => { sp.diagnostic = diag; sp.diagnosedAt = today(); });
    ui.diag = false;
    stopAll();
    render(app);
    window.scrollTo(0, 0);
  };
  app.querySelector("#d-later").onclick = () => { ui.diag = false; stopAll(); render(app); };
}

function renderDaily(app, s, left) {
  const plan = buildPlan(s);
  if (left === 0 || !plan) {
    app.innerHTML = '<section class="panel"><div class="exam-day card-box"><span class="tile-label">오늘은 시험 날이에요</span><span class="dday">D-DAY</span>' +
      "<p>새로운 공부보다 컨디션을 지키는 것이 중요해요. 수험표와 신분증을 챙기고, 오답 노트를 가볍게 훑어보세요.</p>" +
      '<div class="toolbar"><a class="btn ghost" href="#notes">오답 노트 훑어보기</a></div></div></section>';
    return;
  }
  withProgress(plan, s);
  const tomorrow = left > 1 ? buildPlan(s, addDays(today(), 1)) : null;
  const notes = unresolvedNotes().sort((a, b) => b.wrongCount - a.wrongCount);
  const phaseIdx = PHASES.indexOf(plan.phase);
  const pctDone = Math.round(plan.completed / plan.tasks.length * 100);

  app.innerHTML =
    '<section class="panel">' +
      '<div class="sprint-head">' +
        '<div class="tile exam-tile"><span class="tile-label">시험까지 · ' + fmtDate(s.examDate) + '</span><span class="dday">D-' + left + "</span>" +
          '<span class="tile-sub">' + (left > 30 ? "D-30까지 " + (left - 30) + "일 남았어요 · 첫 구간 계획으로 시작해요" : esc(plan.phase.name)) + "</span></div>" +
        '<div class="card-box"><span class="tile-label">이번 구간의 목표</span><ul class="goal-list">' + plan.phase.goals.map(g => "<li>" + esc(g) + "</li>").join("") + "</ul>" +
          (plan.focus.length ? '<p class="hint">집중 영역: <b>' + plan.focus.map(a => AREAS[a]).join("·") + "</b> (진단 결과와 선택한 부족한 영역 기준)</p>" : "") + "</div>" +
      "</div>" +

      '<ol class="timeline" aria-label="D-30 구간">' + PHASES.map((p, i) =>
        '<li class="' + (i < phaseIdx ? "past" : i === phaseIdx ? "now" : "") + '"><b>D-' + p.from + "~" + p.to + "</b><span>" + esc(p.name) + "</span></li>").join("") + "</ol>" +

      '<article class="card-box">' +
        '<div class="panel-head"><div><h3>오늘의 학습 · ' + fmtDate(plan.day) + "</h3>" +
          '<p class="hint" id="plan-time">예상 ' + plan.minutes + "분 / 하루 목표 " + plan.budget + "분 · 진행률은 실제로 푼 문제와 복습 기록으로 자동 계산돼요.</p></div>" +
          '<div class="progress">완료 <strong>' + plan.completed + " / " + plan.tasks.length + "</strong> (" + pctDone + "%)</div></div>" +
        '<div class="bar wide" aria-hidden="true"><span style="width:' + pctDone + '%"></span></div>' +
        '<ul class="tasks">' + plan.tasks.map(t =>
          '<li class="task' + (t.complete ? " complete" : "") + '">' +
            '<span class="task-check" aria-hidden="true">' + (t.complete ? "✓" : "") + "</span>" +
            '<div class="task-body"><div class="task-title">' + esc(t.title) + (t.focus ? ' <span class="badge ai">집중</span>' : "") + "</div>" +
              '<div class="task-detail">' + esc(t.detail) + "</div>" +
              '<div class="task-meta">' + (t.complete ? "<b>완료</b> · " : "아직 완료 전 · ") + Math.min(t.done, t.target) + " / " + t.target + t.unit + " · 약 " + t.minutes + "분</div>" +
              '<span class="meter-track" aria-hidden="true"><span style="width:' + Math.round(t.ratio * 100) + '%"></span></span>' +
            "</div>" +
            (t.complete ? "" : '<div class="task-actions"><button type="button" class="btn ghost sm" data-go="' + t.link + '">하러 가기</button></div>') +
          "</li>").join("") + "</ul>" +
        '<p class="hint">못 한 일은 내일로 쌓이지 않아요. 계획은 매일 그날의 복습량과 남은 날짜로 새로 만들어져요.</p>' +
      "</article>" +

      '<div class="home-grid">' +
        '<article class="card-box"><h3>복습해야 할 오답</h3>' +
          (notes.length
            ? '<p class="hint">다시 풀 문제 ' + notes.length + "개 · 많이 틀린 순</p><ul class=\"mini-notes\">" + notes.slice(0, 3).map(n =>
                '<li><span class="badge">' + AREAS[n.area] + '</span> <span lang="ja">' + esc(n.q.prompt.split("\n")[0].replace(/\[\[|\]\]/g, "").slice(0, 40)) + "</span> <small>" + n.wrongCount + "번 틀림</small></li>").join("") + "</ul>" +
              '<a class="btn ghost sm" href="#notes">오답 노트로 가기</a>'
            : '<p class="hint">다시 풀 오답이 없어요.</p>') +
        "</article>" +
        '<article class="card-box"><h3>내일 추천</h3>' +
          (tomorrow
            ? '<p class="hint">' + fmtDate(tomorrow.day) + " · D-" + tomorrow.left + (tomorrow.phase !== plan.phase ? " · 새 구간 시작: " + esc(tomorrow.phase.name) : "") + "</p>" +
              '<ul class="goal-list">' + tomorrow.tasks.map(t => "<li>" + esc(t.title) + " <small>" + t.target + t.unit + "</small></li>").join("") + "</ul>" +
              '<p class="hint">단어 복습량은 내일 실제 복습 일정에 따라 달라져요.</p>'
            : '<p class="hint">내일은 시험 날이에요. 오늘은 무리하지 말고 일찍 쉬세요.</p>') +
        "</article>" +
      "</div>" +

      mockSummaryHTML(store.get("mocks"), "mock") +
      '<article class="card-box"><h3>진단 결과</h3>' +
        (s.diagnostic
          ? '<div class="meters">' + Object.entries(s.diagnostic).map(([a, r]) =>
              '<div class="meter"><span class="meter-name">' + AREAS[a] + '</span><span class="meter-track" aria-hidden="true"><span style="width:' + (r.t ? r.c / r.t * 100 : 0) + '%"></span></span><span class="meter-val">' + r.c + " / " + r.t + "</span></div>").join("") + "</div>" +
            '<p class="hint">' + fmtDate(s.diagnosedAt) + " 진단 · 문제 수가 적어서 대략적인 참고용이에요.</p>"
          : '<p class="hint">아직 진단 테스트를 보지 않았어요.</p>') +
        '<div class="toolbar"><button type="button" class="btn ghost sm" data-go="diag">' + (s.diagnostic ? "진단 다시 보기" : "진단 테스트 보기") + "</button></div>" +
      "</article>" +

      '<article class="card-box"><h3>설정</h3>' +
        '<p class="hint">하루 ' + s.minutes + "분 · " + esc(LEVELS[s.level]) + " · 자신 있는 영역 " + AREAS[s.strong] + " · 부족한 영역 " + AREAS[s.weak] + " · 목표 " + esc(GOALS[s.goal].label) + "</p>" +
        '<div class="toolbar"><button type="button" class="btn ghost sm" id="sp-edit">설정 바꾸기</button>' +
          (ui.confirmReset
            ? '<span class="confirm">D-30 모드를 끝낼까요? 학습 기록은 남아요.</span><button type="button" class="btn sm danger" id="sp-reset-yes">끝내기</button><button type="button" class="link-btn" id="sp-reset-no">취소</button>'
            : '<button type="button" class="link-btn" id="sp-reset">D-30 모드 끝내기</button>') +
        "</div>" +
      "</article>" +
    "</section>";

  bindCommon(app);
}

function renderFinished(app, s) {
  const exam = nextExam();
  app.innerHTML =
    '<section class="panel"><div class="card-box"><h2>시험이 끝났어요</h2>' +
      "<p>" + fmtDate(s.examDate) + " 시험을 목표로 한 D-30 모드가 끝났어요. 수고 많으셨어요. 학습 기록과 오답 노트는 그대로 남아 있어요.</p>" +
      '<div class="toolbar">' +
        (exam ? '<button type="button" class="btn" id="sp-next">다음 시험(' + esc(exam.label) + ")으로 다시 시작</button>" : "") +
        '<button type="button" class="btn ghost" id="sp-edit">다른 날짜로 설정</button>' +
        '<button type="button" class="link-btn" id="sp-end">D-30 모드 끝내기</button>' +
      "</div>" +
      (exam ? "" : '<p class="hint">등록된 다음 시험 날짜가 없어요. <a href="https://www.jlpt.jp/" target="_blank" rel="noopener">공식 사이트</a>에서 일정을 확인한 뒤 날짜를 직접 입력하세요.</p>') +
    "</div>" + mockSummaryHTML(store.get("mocks"), "mock") + afterExamHTML("n1") + "</section>";
  const next = app.querySelector("#sp-next");
  if (next) next.onclick = () => { store.update("sprint", sp => { sp.examDate = exam.date; sp.diagnostic = null; sp.diagSet = null; sp.manual = {}; sp.startedAt = today(); }); ui.diag = true; render(app); };
  app.querySelector("#sp-end").onclick = () => { store.set("sprint", null); render(app); };
  bindCommon(app);
}

function bindCommon(app) {
  app.onclick = e => {
    const go = e.target.closest("[data-go]");
    const id = e.target.id;
    if (go) {
      const to = go.dataset.go;
      if (to === "diag") { if (store.get("sprint").diagnostic) store.update("sprint", sp => { sp.diagSet = null; }); ui.diag = true; render(app); window.scrollTo(0, 0); }
      else if (to.startsWith("vocab:")) openVocabMode(to.split(":")[1]);
      else location.hash = to;
    } else if (id === "sp-edit") { ui.editing = true; render(app); }
    else if (id === "sp-reset") { ui.confirmReset = true; render(app); }
    else if (id === "sp-reset-no") { ui.confirmReset = false; render(app); }
    else if (id === "sp-reset-yes") { ui.confirmReset = false; store.set("sprint", null); render(app); }
  };
}

export default { id: "sprint", label: "시험 대비", jp: "試験対策", render, leave: () => { stopAll(); ui.confirmReset = false; } };
