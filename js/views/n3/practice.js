// N3 방 · 시험 대비: 영역별 연습 · 시간 제한 연습 테스트 · 결과 분석 · 틀린 문제 다시 풀기
// 모든 문제는 N3 단어·문형 목록으로 자동으로 만든 '자체 제작 연습 문제'다. 실제 JLPT 문제 형식과 다르다.
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc, shuffle, pct, fmtDate, dateKey } from "../../util.js";
import { mountQuestion, feedbackHTML } from "../../quiz.js";
import { runQuiz } from "../../quizRunner.js";
import { LIST_POS } from "../listStudy.js";
import { buildQuestion } from "../listStudy.js";
import { award } from "./game.js";

const SETS = { vocab: { area: "vocab", dataKey: "n3vocab" }, grammar: { area: "grammar", dataKey: "n3grammar" } };
const DRILLS = [
  ["vocab:reading", "어휘 · 읽기 고르기"], ["vocab:meaning", "어휘 · 뜻 고르기"], ["vocab:reverse", "어휘 · 단어 고르기"],
  ["grammar:meaning", "문형 · 뜻 고르기"], ["grammar:reverse", "문형 · 문형 고르기"],
];
const TEST = { minutes: 20, parts: [["vocab:reading", 12], ["vocab:meaning", 8], ["grammar:meaning", 6], ["grammar:reverse", 4]] };
const hasKanji = s => /[一-鿿々]/.test(s);
const typeLabel = key => (DRILLS.find(d => d[0] === key) || [key, key])[1];

const ui = { mode: "drill", drill: DRILLS[0][0] };
// 예전 '독해·청해·모의고사' 칸은 실제 자료가 생기면 다시 연다
let test = null;      // 진행 중이거나 막 끝난 테스트
let timer = null;


// 답한 뒤 보여 주는 학습 정보: 정답 단어·문형의 읽기와 뜻, 오답이면 고른 보기의 주인
function n3Extra(q, picked) {
  const all = [...((EXTRA.n3vocab && EXTRA.n3vocab.items) || []), ...((EXTRA.n3grammar && EXTRA.n3grammar.items) || [])];
  const head = v => v.word || v.pattern;
  const line = v => '<div class="lb-word"><b lang="ja">' + esc(head(v)) + "</b>" + (v.reading && v.reading !== head(v) ? ' <span class="reading" lang="ja">' + esc(v.reading) + "</span>" : "") +
    ' <span class="lb-mean">' + esc(v.meaning) + "</span>" + (v.pos ? ' <small class="hint">' + esc(LIST_POS[v.pos] || v.pos) + "</small>" : "") + "</div>";
  const v = all.find(x => x.id === q.wordId);
  if (!v) return "";
  let wrong = "";
  if (picked !== null && picked !== undefined && picked !== q.answer) {
    const t = q.options[picked];
    const o = all.find(x => x !== v && (x.meaning === t || x.reading === t || head(x) === t));
    if (o) wrong = '<div class="lb-row lb-wrong"><span class="lb-label">내가 고른 보기</span>' + line(o) + "</div>";
  }
  return '<div class="learn-box"><div class="lb-title">학습 정보</div>' + line(v) + wrong + "</div>";
}
function pool(setKey, type) {
  const d = EXTRA[SETS[setKey].dataKey];
  let items = (d && d.items) || [];
  if (type === "reading") items = items.filter(v => hasKanji(v.word) && v.reading);
  return items;
}

function make(key, count) {
  const [setKey, type] = key.split(":");
  const all = pool(setKey, "meaning");
  return shuffle(pool(setKey, type)).slice(0, count).map(v => {
    const q = buildQuestion(v, type, SETS[setKey], all, "n3");
    q.typeKey = key;
    return q;
  });
}

function render(app) {
  const ready = EXTRA.n3vocab && EXTRA.n3grammar;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>시험 대비</h2><p>영역별로 연습하고, 시간을 재며 풀어 본 뒤 약한 유형을 확인해요.</p></div></div>' +
      '<p class="notice"><b>자체 제작 연습 문제</b>예요. N3 단어·문형 목록으로 자동으로 만든 문제라 실제 JLPT 기출문제나 공식 문제 형식이 아니에요.</p>' +
      '<div class="segmented" role="tablist" aria-label="시험 대비">' +
        seg("drill", "영역별 연습") + seg("test", "시간 제한 테스트") + seg("history", "결과 기록") +
      "</div>" +
      '<div id="mode" class="stack"></div>' +
    "</section>";
  app.onclick = e => {
    const s = e.target.closest("[data-mode]");
    if (!s) return;
    if (test && !test.done && s.dataset.mode !== "test") { stopTimer(); test = null; }
    ui.mode = s.dataset.mode; render(app);
  };
  const el = app.querySelector("#mode");
  if (!ready) { el.innerHTML = '<p class="notice">N3 단어·문형 자료를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p>'; return; }
  if (ui.mode === "pending") ui.mode = "drill";
  ({ drill: renderDrill, test: renderTest, history: renderHistory })[ui.mode](el, app);
}

function seg(key, label) {
  return '<button type="button" role="tab" class="seg" data-mode="' + key + '" aria-selected="' + (ui.mode === key) + '">' + label + "</button>";
}

/* ---------- 영역별 연습: 바로 채점 ---------- */
function renderDrill(el) {
  el.innerHTML =
    '<div class="toolbar">' + DRILLS.map(([k, l]) =>
      '<button type="button" class="chip" data-drill="' + k + '" aria-pressed="' + (ui.drill === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div class="toolbar"><button type="button" class="link-btn" id="d-new">새 문제 10개</button></div>' +
    '<div class="quiz" id="d-quiz"></div>';
  // 한 문제씩 풀고, 답한 뒤에는 그 단어·문형의 학습 정보를 보여 준다
  const start = () => {
    runQuiz(el.querySelector("#d-quiz"), make(ui.drill, 10).map(q => ({ q, extra: n3Extra })), {
      store: n3store, label: "연습", onRestart: start, restartLabel: "새 문제 10개",
      onAnswer: (it, ok) => award(ok ? "correct" : "wrong"),
    });
  };
  el.onclick = e => {
    const d = e.target.closest("[data-drill]");
    if (d) { ui.drill = d.dataset.drill; el.querySelectorAll("[data-drill]").forEach(b => b.setAttribute("aria-pressed", b === d)); start(); }
    else if (e.target.closest("#d-new")) start();
  };
  start();
}

/* ---------- 시간 제한 테스트: 다 풀고 나서 한꺼번에 채점 ---------- */
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

function renderTest(el, app) {
  if (!test) {
    const total = TEST.parts.reduce((s, p) => s + p[1], 0);
    el.innerHTML =
      '<article class="card-box"><h3>연습 테스트 · ' + total + "문제 · " + TEST.minutes + "분</h3>" +
        '<ul class="points">' + TEST.parts.map(([k, n]) => "<li>" + esc(typeLabel(k)) + " " + n + "문제</li>").join("") + "</ul>" +
        '<p class="hint">풀 때는 정답을 보여 주지 않고, 제출하거나 시간이 끝나면 한꺼번에 채점해요. 다른 메뉴로 나가면 진행 중인 테스트는 사라져요.</p>' +
        '<div class="toolbar"><button type="button" class="btn" id="t-start">테스트 시작</button></div>' +
      "</article>";
    el.querySelector("#t-start").onclick = () => {
      const qs = TEST.parts.flatMap(([k, n]) => make(k, n));
      test = { qs, picks: qs.map(() => null), startedAt: Date.now(), ends: Date.now() + TEST.minutes * 60000, done: false };
      renderTest(el, app);
      startTimer(el, app);
    };
    return;
  }
  if (test.done) { renderResult(el, app); return; }

  el.innerHTML =
    '<div class="mock-bar"><span class="mock-part">연습 테스트 <span class="pick-meta" id="t-count"></span></span><span class="mock-timer" id="t-timer" role="timer"></span></div>' +
    '<div class="quiz">' + test.qs.map((q, i) =>
      '<div class="q" id="tq-' + i + '"><div class="q-top"><span class="q-num">問' + (i + 1) + " · " + esc(typeLabel(q.typeKey)) + "</span></div>" +
        '<div class="q-text" lang="ja">' + esc(q.prompt) + "</div>" +
        '<div class="opts' + (q.options.some(o => o.length > 12) ? " wide" : "") + '">' + q.options.map((o, j) =>
          '<button type="button" class="opt' + (test.picks[i] === j ? " picked" : "") + '" data-tq="' + i + '" data-to="' + j + '" aria-pressed="' + (test.picks[i] === j) + '"><span class="n">' + (j + 1) + '</span><span lang="ja">' + esc(o) + "</span></button>").join("") +
        "</div></div>").join("") + "</div>" +
    '<div class="mock-submit"><span class="hint" id="t-left"></span><button type="button" class="btn" id="t-submit">제출하고 채점하기</button></div>';
  updateCount(el);
  tick(el, app);
  el.onclick = e => {
    const o = e.target.closest("[data-to]");
    if (o) {
      const i = Number(o.dataset.tq), j = Number(o.dataset.to);
      test.picks[i] = j;
      el.querySelectorAll('[data-tq="' + i + '"]').forEach(b => {
        const on = Number(b.dataset.to) === j;
        b.classList.toggle("picked", on); b.setAttribute("aria-pressed", on);
      });
      updateCount(el);
    } else if (e.target.closest("#t-submit")) finish(el, app);
  };
}

function updateCount(el) {
  const n = test.picks.filter(p => p !== null).length;
  el.querySelector("#t-count").textContent = n + " / " + test.qs.length;
  el.querySelector("#t-left").textContent = n < test.qs.length ? "안 푼 문제 " + (test.qs.length - n) + "개는 오답으로 채점돼요." : "모두 풀었어요.";
}

function startTimer(el, app) { stopTimer(); timer = setInterval(() => tick(el, app), 1000); }

function tick(el, app) {
  if (!test || test.done) { stopTimer(); return; }
  const left = Math.max(0, test.ends - Date.now());
  const t = el.querySelector("#t-timer");
  if (t) {
    t.textContent = Math.floor(left / 60000) + ":" + String(Math.floor(left / 1000) % 60).padStart(2, "0");
    t.classList.toggle("low", left < 60000);
  }
  if (left <= 0) finish(el, app);
}

function finish(el, app) {
  stopTimer();
  test.done = true;
  test.usedSec = Math.round((Math.min(Date.now(), test.ends) - test.startedAt) / 1000);
  const byType = {};
  test.qs.forEach((q, i) => {
    const pick = test.picks[i];
    n3store.recordAttempt(q, pick === null ? -1 : pick, "test");
    award(pick === q.answer ? "correct" : "wrong");
    const b = byType[q.typeKey] || (byType[q.typeKey] = { total: 0, correct: 0 });
    b.total++; if (pick === q.answer) b.correct++;
  });
  test.byType = byType;
  test.correct = test.qs.filter((q, i) => test.picks[i] === q.answer).length;
  n3store.update("tests", list => { list.push({ at: Date.now(), total: test.qs.length, correct: test.correct, usedSec: test.usedSec, byType }); });
  renderTest(el, app);
  window.scrollTo(0, 0);
}

function renderResult(el, app) {
  const types = Object.entries(test.byType).map(([k, b]) => ({ k, ...b, rate: pct(b.correct, b.total) }));
  const weakest = [...types].sort((a, b) => a.rate - b.rate)[0];
  const wrongIdx = test.qs.map((q, i) => i).filter(i => test.picks[i] !== test.qs[i].answer);
  el.innerHTML =
    '<article class="card-box"><h3>결과 · ' + test.correct + " / " + test.qs.length + " 정답 (" + pct(test.correct, test.qs.length) + "%)</h3>" +
      '<p class="hint">걸린 시간 ' + Math.floor(test.usedSec / 60) + "분 " + (test.usedSec % 60) + "초 · 자체 제작 연습 테스트라 실제 JLPT 점수와는 관계없어요.</p>" +
      '<div class="meters">' + types.map(t =>
        '<div class="meter wide-name"><span class="meter-name">' + esc(typeLabel(t.k)) + '</span><span class="meter-track"><span style="width:' + t.rate + '%"></span></span>' +
        '<span class="meter-val">' + t.rate + "% <small>" + t.correct + "/" + t.total + "</small></span></div>").join("") + "</div>" +
      (weakest && weakest.rate < 100 ? '<p><b>가장 약한 유형</b> · ' + esc(typeLabel(weakest.k)) + " (" + weakest.rate + "%)</p>" : "<p>모든 유형을 다 맞혔어요.</p>") +
      '<div class="toolbar">' +
        (wrongIdx.length ? '<button type="button" class="btn" id="r-redo">틀린 ' + wrongIdx.length + "문제 다시 풀기</button>" : "") +
        '<button type="button" class="btn ghost" id="r-new">새 테스트</button></div>' +
    "</article>" +
    '<div class="quiz" id="r-redo-box"></div>' +
    '<h3>문제별 정답과 해설</h3>' +
    '<div class="quiz">' + test.qs.map((q, i) =>
      '<details class="q review-q"><summary><span class="q-num">問' + (i + 1) + " · " + esc(typeLabel(q.typeKey)) + "</span>" +
        '<span class="badge ' + (test.picks[i] === q.answer ? "ok" : "warn") + '">' + (test.picks[i] === q.answer ? "정답" : test.picks[i] === null ? "안 풂" : "오답") + "</span>" +
        '<span lang="ja">' + esc(q.prompt) + "</span></summary>" + feedbackHTML(q, test.picks[i], test.picks[i] !== q.answer) + "</details>").join("") + "</div>";
  el.onclick = e => {
    if (e.target.closest("#r-new")) { test = null; renderTest(el, app); }
    else if (e.target.closest("#r-redo")) {
      const box = el.querySelector("#r-redo-box");
      box.innerHTML = "";
      wrongIdx.forEach((i, n) => {
        const holder = document.createElement("div");
        box.appendChild(holder);
        mountQuestion(holder, test.qs[i], { label: "다시 풀기 " + (n + 1), store: n3store, mode: "review", onAnswer: ok => award(ok ? "correct" : "wrong") });
      });
      e.target.closest("#r-redo").remove();
    }
  };
}

/* ---------- 결과 기록과 유형별 약점 ---------- */
function renderHistory(el) {
  const tests = n3store.get("tests");
  const attempts = n3store.get("attempts").filter(a => a.qid.startsWith("n3-"));
  const byType = {};
  attempts.forEach(a => {
    const m = a.qid.match(/^n3-(reading|meaning|reverse)-n3-([vg])/);
    if (!m) return;
    const key = (m[2] === "v" ? "vocab" : "grammar") + ":" + m[1];
    const b = byType[key] || (byType[key] = { total: 0, correct: 0 });
    b.total++; if (a.correct) b.correct++;
  });
  const rows = Object.entries(byType).map(([k, b]) => ({ k, ...b, rate: pct(b.correct, b.total) })).sort((a, b) => a.rate - b.rate);
  el.innerHTML =
    '<article class="card-box"><h3>유형별 정답률</h3>' +
      (rows.length
        ? '<p class="hint">영역별 연습, 단어·문형 퀴즈, 테스트에서 푼 모든 문제로 계산해요. 정답률이 낮은 순서예요.</p><div class="meters">' + rows.map(t =>
            '<div class="meter wide-name"><span class="meter-name">' + esc(typeLabel(t.k)) + '</span><span class="meter-track"><span style="width:' + t.rate + '%"></span></span>' +
            '<span class="meter-val">' + t.rate + "% <small>" + t.correct + "/" + t.total + "</small></span></div>").join("") + "</div>"
        : '<p class="empty">아직 푼 문제가 없어요.</p>') +
    "</article>" +
    '<article class="card-box"><h3>테스트 기록</h3>' +
      (tests.length
        ? '<ul class="mock-history">' + tests.slice().reverse().map(t =>
            "<li>" + fmtDate(dateKey(new Date(t.at))) + " · <b>" + t.correct + " / " + t.total + "</b> (" + pct(t.correct, t.total) + "%) <small>" + Math.floor(t.usedSec / 60) + "분 " + (t.usedSec % 60) + "초</small></li>").join("") + "</ul>"
        : '<p class="empty">아직 테스트 기록이 없어요.</p>') +
    "</article>";
}


export default { id: "n3/exam", label: "시험 대비", jp: "試験対策", needs: ["n3vocab", "n3grammar", "sources"], render, leave() { stopTimer(); test = null; } };
