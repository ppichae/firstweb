// N3 방 · D-30 계획: 시험일까지 남은 날과 하루 공부 시간으로 그날 할 일을 정한다 (N1 D-30과 같은 4구간)
// 완료는 실제로 푼 문제·카드 복습·연습 테스트 기록으로만 자동 계산한다. 직접 완료를 누르는 버튼은 없다.
// 계획은 날마다 새로 계산해서, 못 한 일이 다음 날로 쌓이지 않는다.
import { n3store } from "../../store.js";
import { esc, today, addDays, diffDays, fmtDate, dateKey } from "../../util.js";
import { PHASES, phaseFor } from "../sprint.js";
import { examTarget } from "../../dday.js";
import { nextExam } from "../../exam.js";
import { noteEntries, moreHTML } from "../../stats.js";
import { afterExamHTML } from "../../examHub.js";
import { n3vocab } from "./study.js";

const MINUTES = [20, 30, 60, 90, 120];
const COST = { card: 0.4, vocabQ: 0.6, grammarQ: 1, readingQ: 3, listeningQ: 2, note: 1.5, test: 25 };
const UNIT = { card: "장", vocabQ: "문제", grammarQ: "문제", readingQ: "문제", listeningQ: "문제", note: "문제", test: "회" };
const ui = { editing: false, confirmEnd: false };

const openNotes = () => noteEntries(n3store).filter(n => !n.resolved).length;

export function buildN3Plan(s, day = today()) {
  const left = diffDays(day, s.examDate);
  const phase = phaseFor(left);
  if (!phase) return null;
  const notes = openNotes();
  const due = day === today() ? n3vocab.reviewWordIds().length : 10;
  const tasks = [];
  const add = (id, metric, target, title, detail, link) => tasks.push({ id, metric, target, title, detail, link, scalable: metric !== "test" });
  add("cards", "card", Math.max(10, Math.min(60, due + (phase.key === "p4" ? 0 : 10))), "단어 플래시카드", "복습할 단어와 새 단어를 카드로 외워요.", "n3/vocab:cards");
  if (phase.key === "p1") {
    add("vq", "vocabQ", 10, "어휘 문제", "뜻·읽기 고르기 퀴즈를 풀어요.", "n3/vocab:quiz");
    add("gq", "grammarQ", 5, "문법 문제", "문법 화면의 퀴즈를 풀어요.", "n3/grammar");
    add("rq", "readingQ", 2, "독해", "지문 하나를 골라 풀어요.", "n3/reading");
    add("lq", "listeningQ", 2, "청해", "문제 하나를 듣고 풀어요.", "n3/listening");
  } else if (phase.key === "p2") {
    if (notes) add("notes", "note", Math.min(notes, 8), "오답 다시 풀기", "오답 노트의 다시 풀 문제를 풀어요.", "n3/notes");
    add("vq", "vocabQ", 10, "어휘 문제", "틀렸던 단어 위주로 퀴즈를 풀어요.", "n3/vocab:quiz");
    add("gq", "grammarQ", 6, "문법 문제", "헷갈리는 문형을 다시 풀어요.", "n3/grammar");
    add("rq", "readingQ", 3, "독해 연습", "아직 안 푼 지문을 골라요.", "n3/reading");
    add("lq", "listeningQ", 3, "청해 연습", "여러 유형을 들어 보세요.", "n3/listening");
  } else if (phase.key === "p3") {
    if (left % 2 === 0) add("test", "test", 1, "모의고사 (시간 제한)", "시간을 재고 끝까지 풀어요.", "n3/mock");
    else add("rq", "readingQ", 4, "독해 시간 재며 풀기", "지문마다 시간을 정해 두고 풀어요.", "n3/reading");
    if (notes) add("notes", "note", Math.min(notes, 6), "오답 다시 풀기", "모의고사에서 틀린 문제부터 다시 풀어요.", "n3/notes");
    add("gq", "grammarQ", 5, "문법 문제", "약한 문형 위주로 풀어요.", "n3/grammar");
    add("lq", "listeningQ", 3, "청해", "짧은 문제로 귀를 풀어요.", "n3/listening");
    add("vq", "vocabQ", 8, "어휘 문제", "퀴즈를 풀어요.", "n3/vocab:quiz");
  } else {
    if (notes) add("notes", "note", Math.min(notes, 12), "오답 노트 집중 복습", "많이 틀린 문제부터 다시 풀어요.", "n3/notes");
    else add("rq", "readingQ", 3, "독해 감각 유지", "다시 풀 오답이 없으니 지문을 풀어요.", "n3/reading");
    add("vq", "vocabQ", 10, "자주 틀린 어휘 확인", "틀렸던 단어를 다시 확인해요.", "n3/vocab:quiz");
    add("gq", "grammarQ", 5, "자주 틀린 문법 확인", "헷갈렸던 문형을 다시 풀어요.", "n3/grammar");
    if (left === 3) add("test", "test", 1, "최종 점검 (모의고사)", "실제 시험처럼 시간을 재고 풀어요.", "n3/mock");
    else add("lq", "listeningQ", 2, "청해 감각 유지", "짧은 문제를 들어요.", "n3/listening");
  }
  // 하루 공부 시간에 맞춰 목표량을 늘리거나 줄인다 (모의고사는 그대로)
  const cost = t => COST[t.metric] * t.target;
  const fixed = tasks.filter(t => !t.scalable).reduce((n, t) => n + cost(t), 0);
  const flex = tasks.filter(t => t.scalable).reduce((n, t) => n + cost(t), 0);
  if (flex > 0) {
    const f = Math.max(0.2, Math.min(2.5, (s.minutes - fixed) / flex));
    tasks.forEach(t => { if (t.scalable) t.target = Math.max(1, Math.floor(t.target * f)); });
  }
  tasks.forEach(t => {
    if (t.metric === "note") t.target = Math.min(t.target, notes);
    if (t.metric === "card") t.target = Math.min(t.target, 80);
    t.minutes = Math.max(1, Math.round(cost(t))); t.unit = UNIT[t.metric];
  });
  return { day, left, phase, tasks, minutes: Math.round(tasks.reduce((n, t) => n + cost(t), 0)) };
}

// 그날 실제로 한 양
function done(metric, day) {
  const at = n3store.get("attempts").filter(a => dateKey(new Date(a.at)) === day);
  const area = a => at.filter(x => x.area === a && x.mode !== "test" && x.mode !== "review").length;
  switch (metric) {
    case "card": return ((n3store.get("activity")[day] || {}).cards) || 0;
    case "vocabQ": return area("vocab");
    case "grammarQ": return area("grammar");
    case "readingQ": return area("reading");
    case "listeningQ": return area("listening");
    case "note": return at.filter(a => a.mode === "review").length;
    case "test": return (n3store.get("tests") || []).filter(t => dateKey(new Date(t.at)) === day).length;
    default: return 0;
  }
}

export function n3PlanWithProgress(s) {
  const plan = buildN3Plan(s);
  if (!plan) return null;
  plan.tasks.forEach(t => { t.done = done(t.metric, plan.day); t.complete = t.done >= t.target; t.ratio = t.complete ? 1 : Math.min(1, t.done / t.target); });
  plan.completed = plan.tasks.filter(t => t.complete).length;
  return plan;
}

/* ---------- 화면 (시험 대비 화면 안의 'D-30 계획' 칸) ---------- */
export function renderN3Plan(el) {
  const s = n3store.get("sprint");
  if (!s || ui.editing) return setup(el, s);
  const left = diffDays(today(), s.examDate);
  if (left < 0) return finished(el, s);
  if (left === 0) {
    el.innerHTML = '<div class="exam-day card-box"><span class="tile-label">오늘은 시험 날이에요</span><span class="dday">D-DAY</span>' +
      "<p>새로운 공부보다 컨디션을 지키는 것이 중요해요. 수험표와 신분증을 챙기고, 오답 노트를 가볍게 훑어보세요.</p>" +
      '<div class="toolbar"><a class="btn ghost" href="#n3/notes">오답 노트 훑어보기</a></div></div>';
    return;
  }
  const plan = n3PlanWithProgress(s);
  const idx = PHASES.indexOf(plan.phase);
  const pctDone = Math.round(plan.completed / plan.tasks.length * 100);
  el.innerHTML =
    '<div class="sprint-head">' +
      '<div class="tile exam-tile"><span class="tile-label">시험까지 · ' + fmtDate(s.examDate) + '</span><span class="dday">D-' + left + "</span>" +
        '<span class="tile-sub">' + (left > 30 ? "D-30까지 " + (left - 30) + "일 남았어요 · 첫 구간 계획으로 시작해요" : esc(plan.phase.name)) + "</span></div>" +
      '<div class="card-box"><span class="tile-label">이번 구간의 목표</span><ul class="goal-list">' + plan.phase.goals.map(g => "<li>" + esc(g) + "</li>").join("") + "</ul></div>" +
    "</div>" +
    '<ol class="timeline" aria-label="D-30 구간">' + PHASES.map((p, i) =>
      '<li class="' + (i < idx ? "past" : i === idx ? "now" : "") + '"><b>D-' + p.from + "~" + p.to + "</b><span>" + esc(p.name) + "</span></li>").join("") + "</ol>" +
    '<article class="card-box">' +
      '<div class="panel-head"><div><h3>오늘의 학습 · ' + fmtDate(plan.day) + "</h3>" +
        '<p class="hint">예상 ' + plan.minutes + "분 / 하루 " + s.minutes + "분</p></div>" +
        '<div class="progress">완료 <strong>' + plan.completed + " / " + plan.tasks.length + "</strong> (" + pctDone + "%)</div></div>" +
      '<div class="bar wide" aria-hidden="true"><span style="width:' + pctDone + '%"></span></div>' +
      '<ul class="tasks">' + plan.tasks.map(t =>
        '<li class="task' + (t.complete ? " complete" : "") + '">' +
          '<span class="task-check" aria-hidden="true">' + (t.complete ? "✓" : "") + "</span>" +
          '<div class="task-body"><div class="task-title">' + esc(t.title) + "</div>" +
            '<div class="task-detail">' + esc(t.detail) + "</div>" +
            '<div class="task-meta">' + (t.complete ? "<b>완료</b> · " : "아직 완료 전 · ") + Math.min(t.done, t.target) + " / " + t.target + t.unit + " · 약 " + t.minutes + "분</div>" +
            '<span class="meter-track" aria-hidden="true"><span style="width:' + Math.round(t.ratio * 100) + '%"></span></span>' +
          "</div>" +
          (t.complete ? "" : '<div class="task-actions"><button type="button" class="btn ghost sm" data-go="' + t.link + '">하러 가기</button></div>') +
        "</li>").join("") + "</ul>" +
    "</article>" +
    '<article class="card-box"><h3>설정</h3><p class="hint">시험일 ' + fmtDate(s.examDate) + " · 하루 " + s.minutes + "분</p>" +
      '<div class="toolbar"><button type="button" class="btn ghost sm" id="n3s-edit">설정 바꾸기</button>' +
        (ui.confirmEnd
          ? '<span class="confirm">D-30 계획을 끝낼까요? 학습 기록은 남아요.</span><button type="button" class="btn sm danger" id="n3s-end-yes">끝내기</button><button type="button" class="link-btn" id="n3s-end-no">취소</button>'
          : '<button type="button" class="link-btn" id="n3s-end">D-30 계획 끝내기</button>') +
      "</div></article>";
  bind(el);
}

function setup(el, s) {
  const room = examTarget(n3store);
  const v = s || { examDate: room ? room.date : addDays(today(), 30), minutes: 30 };
  el.innerHTML =
    '<form class="setup card-box" id="n3s-form" novalidate>' +
      "<h3>D-30 계획 " + (s ? "설정 바꾸기" : "시작하기") + "</h3>" +
      '<div class="form-grid">' +
        '<div class="field"><label for="n3s-date">시험 날짜</label><input id="n3s-date" type="date" required min="' + addDays(today(), 1) + '" value="' + esc(v.examDate) + '"></div>' +
        '<div class="field"><label for="n3s-min">하루 공부 시간</label><select id="n3s-min">' + MINUTES.map(m => '<option value="' + m + '"' + (m === v.minutes ? " selected" : "") + ">" + (m >= 60 ? Math.floor(m / 60) + "시간" + (m % 60 ? " " + m % 60 + "분" : "") : m + "분") + "</option>").join("") + "</select></div>" +
      "</div>" +
      '<p class="form-error" id="n3s-err" role="alert" hidden></p>' +
      '<div class="toolbar"><button type="submit" class="btn">' + (s ? "저장하기" : "시작하기") + "</button>" + (s ? '<button type="button" class="btn ghost" id="n3s-cancel">취소</button>' : "") + "</div>" +
    "</form>" +
    moreHTML("이렇게 진행돼요", '<ol class="phases-list">' + PHASES.map(p =>
      "<li><b>D-" + p.from + " ~ D-" + p.to + "</b> " + esc(p.name) + ' <span class="hint">' + p.goals.map(esc).join(" · ") + "</span></li>").join("") + "</ol>");
  const cancel = el.querySelector("#n3s-cancel");
  if (cancel) cancel.onclick = () => { ui.editing = false; renderN3Plan(el); };
  el.querySelector("#n3s-form").onsubmit = e => {
    e.preventDefault();
    const date = el.querySelector("#n3s-date").value, err = el.querySelector("#n3s-err");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today()) { err.textContent = "시험 날짜는 내일 이후로 골라 주세요."; err.hidden = false; return; }
    n3store.set("sprint", Object.assign({}, s || { startedAt: today() }, { examDate: date, minutes: Number(el.querySelector("#n3s-min").value) }));
    n3store.set("examDate", date);   // 홈의 D-Day도 같은 시험일을 쓴다
    ui.editing = false;
    renderN3Plan(el);
  };
}

function finished(el, s) {
  const exam = nextExam();
  el.innerHTML =
    '<div class="card-box"><h3>시험이 끝났어요</h3>' +
      "<p>" + fmtDate(s.examDate) + " 시험을 목표로 한 D-30 계획이 끝났어요. 수고 많으셨어요. 학습 기록과 오답 노트는 그대로 남아 있어요.</p>" +
      '<div class="toolbar">' +
        (exam ? '<button type="button" class="btn" id="n3s-next">다음 시험(' + esc(exam.label) + ")으로 다시 시작</button>" : "") +
        '<button type="button" class="btn ghost" id="n3s-edit">다른 날짜로 설정</button>' +
        '<button type="button" class="link-btn" id="n3s-end-yes">D-30 계획 끝내기</button>' +
      "</div>" +
      (exam ? "" : '<p class="hint">등록된 다음 시험 날짜가 없어요. <a href="https://www.jlpt.jp/" target="_blank" rel="noopener">공식 사이트</a>에서 일정을 확인한 뒤 날짜를 직접 입력하세요.</p>') +
    "</div>" + afterExamHTML("n3");
  bind(el);
  const next = el.querySelector("#n3s-next");
  if (next) next.onclick = () => { n3store.update("sprint", sp => { sp.examDate = exam.date; sp.startedAt = today(); }); n3store.set("examDate", exam.date); renderN3Plan(el); };
}

function bind(el) {
  el.onclick = e => {
    const go = e.target.closest("[data-go]");
    const id = e.target.id;
    if (go) {
      const to = go.dataset.go;
      if (to.startsWith("n3/vocab:")) n3vocab.openMode(to.split(":")[1]);
      else location.hash = to;
    } else if (id === "n3s-edit") { ui.editing = true; renderN3Plan(el); }
    else if (id === "n3s-end") { ui.confirmEnd = true; renderN3Plan(el); }
    else if (id === "n3s-end-no") { ui.confirmEnd = false; renderN3Plan(el); }
    else if (id === "n3s-end-yes") { ui.confirmEnd = false; n3store.set("sprint", null); renderN3Plan(el); }
  };
}

// 홈의 '지금 할 일'용 오늘 요약 (계획이 없거나 시험이 지났으면 null)
export function n3SprintSummary() {
  const s = n3store.get("sprint");
  if (!s) return null;
  const plan = n3PlanWithProgress(s);
  return plan ? { done: plan.completed, total: plan.tasks.length } : null;
}
