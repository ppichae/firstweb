// 실전 모의고사: 1부 언어지식·독해, 2부 청해. 타이머·문제 이동·임시 저장·자동 제출·결과 분석
// 결과는 정답률을 단순 환산한 '학습용 추정치'이고, JLPT 공식 점수가 아니다.
import { DB, QUESTIONS } from "../data.js";
import { store } from "../store.js";
import { esc, multiline, AREAS, shuffle, pct, fmtDate, dateKey } from "../util.js";
import { feedbackHTML } from "../quiz.js";
import { passageTextHTML } from "./reading.js";
import { setupPlayer } from "./listening.js";
import { stopAll } from "../speech.js";
import { EXAM_INFO } from "../exam.js";
import { examNavHTML } from "../examHub.js";

const DRAFT_KEY = "n1lab:mockDraft";   // 풀고 있는 모의고사 (임시 저장)
const PARTS = { 1: { name: "1부 · 언어지식(문자·어휘·문법)·독해", official: 110 }, 2: { name: "2부 · 청해", official: 55 } };
const READING_SET = ["r002", "r001", "r005", "r007"];
let timer = null;
const ui = { review: null, confirm: false };

/* ---------- 임시 저장 ---------- */
function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { return null; } }
function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* 저장 못 해도 풀이는 계속된다 */ } }
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 무시 */ } }

/* ---------- 문제 구성 ---------- */
function buildSet() {
  const part1 = [
    ...shuffle(DB.vocab.questions).slice(0, 10).map(q => q.id),
    ...shuffle(DB.grammar.questions).slice(0, 10).map(q => q.id),
    ...READING_SET.flatMap(id => (DB.reading.passages.find(p => p.id === id) || { questions: [] }).questions.map(q => q.id)),
  ];
  const part2 = DB.listening.items.flatMap(it => it.questions.map(q => q.id));
  return { 1: part1, 2: part2 };
}
// 문항 수에 맞춘 시간(분): 어휘 1분, 문법 1.5분, 지문은 예상 풀이 시간, 청해 3분
function fittedMinutes(set) {
  const p1 = set[1].reduce((n, id) => {
    const q = QUESTIONS.get(id);
    if (!q) return n;
    if (q.area === "vocab") return n + 1;
    if (q.area === "grammar") return n + 1.5;
    const p = DB.reading.passages.find(x => x.id === q.passageId);
    return n + p.minutes / p.questions.length;
  }, 0);
  return { 1: Math.ceil(p1), 2: set[2].length * 3 };
}

function start(timeMode) {
  const set = buildSet();
  const minutes = timeMode === "official" ? { 1: PARTS[1].official, 2: PARTS[2].official } : fittedMinutes(set);
  const d = { startedAt: Date.now(), timeMode, set, minutes, part: 1, index: 0, answers: {}, deadline: Date.now() + minutes[1] * 60000, partEnded: {} };
  saveDraft(d);
  return d;
}

/* ---------- 화면 ---------- */
function render(app) {
  clearInterval(timer);
  stopAll();
  const d = loadDraft();
  // 시험 대비 안의 작은 메뉴는 문제를 푸는 동안에는 보이지 않게 한다
  const nav = () => { const p = app.querySelector(".panel"); if (p) p.insertAdjacentHTML("afterbegin", examNavHTML("n1", "mock")); };
  if (ui.review) { renderResult(app, ui.review); nav(); return; }
  if (d) {
    // 다른 화면에 가 있는 동안 시간이 끝났으면 자동 제출
    if (Date.now() >= d.deadline) { submitPart(app, d, true); return; }
    return renderExam(app, d);
  }
  renderIntro(app);
  nav();
}

function renderIntro(app) {
  const set = buildSet();
  const fit = fittedMinutes(set);
  const history = store.get("mocks");
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>실전 모의고사</h2><p>실제 N1처럼 1부(언어지식·독해)와 2부(청해)로 나눠 시간을 재고 풀어요.</p></div></div>' +
      '<article class="card-box"><h3>구성</h3>' +
        '<table class="mock-table"><thead><tr><th>구분</th><th>이 모의고사</th><th>실제 시험 시간</th></tr></thead><tbody>' +
          "<tr><td>1부 언어지식·독해</td><td>어휘 10 · 문법 10 · 독해 " + (set[1].length - 20) + "문제</td><td>" + EXAM_INFO.sections[0].minutes + "분</td></tr>" +
          "<tr><td>2부 청해</td><td>" + set[2].length + "문제</td><td>" + EXAM_INFO.sections[1].minutes + "분</td></tr>" +
        "</tbody></table>" +
        '<p class="hint">문제는 모두 자체 제작 연습 문제이고, 실제 시험보다 문항 수가 적어요.</p>' +
      "</article>" +
      '<form class="card-box" id="mock-start"><h3>시간 설정</h3>' +
        '<label class="radio"><input type="radio" name="tm" value="fitted" checked> <span><b>문항 수에 맞춘 시간 (추천)</b> 1부 ' + fit[1] + "분 · 2부 " + fit[2] + "분</span></label>" +
        '<label class="radio"><input type="radio" name="tm" value="official"> <span><b>실제 시험 시간</b> 1부 110분 · 2부 55분 <small>(문항 수가 적어 시간이 많이 남아요)</small></span></label>' +
        '<div class="toolbar"><button type="submit" class="btn">모의고사 시작</button></div>' +
        '<p class="hint">시작하면 답은 자동으로 임시 저장돼요. 다른 화면에 다녀와도 이어서 풀 수 있고, 시간이 끝나면 자동으로 제출돼요.</p>' +
      "</form>" +
      '<article class="card-box"><h3>지난 결과</h3>' +
        (history.length
          ? '<ul class="mock-history">' + history.slice().reverse().map((m, i) =>
              '<li><button type="button" class="link-btn" data-result="' + (history.length - 1 - i) + '">' + fmtDate(dateKey(new Date(m.at))) + " · 전체 정답률 " + m.total.rate + "%</button> <small>" +
              Object.entries(m.areas).map(([a, r]) => AREAS[a] + " " + (r.rate === null ? "-" : r.rate + "%")).join(" · ") + "</small></li>").join("") + "</ul>"
          : '<p class="hint">아직 본 모의고사가 없어요.</p>') +
      "</article>" +
    "</section>";
  app.querySelector("#mock-start").onsubmit = e => {
    e.preventDefault();
    start(app.querySelector('input[name="tm"]:checked').value);
    render(app);
    window.scrollTo(0, 0);
  };
  app.onclick = e => {
    const r = e.target.closest("[data-result]");
    if (r) { ui.review = store.get("mocks")[Number(r.dataset.result)]; render(app); window.scrollTo(0, 0); }
  };
}

function renderExam(app, d) {
  const ids = d.set[d.part];
  const qid = ids[d.index];
  const q = QUESTIONS.get(qid);
  const answered = ids.filter(id => d.answers[id] !== undefined).length;
  const passage = q.area === "reading" ? DB.reading.passages.find(p => p.id === q.passageId) : null;
  const item = q.area === "listening" ? DB.listening.items.find(it => it.id === q.itemId) : null;

  app.innerHTML =
    '<section class="panel mock">' +
      '<div class="mock-bar">' +
        '<div><div class="mock-part">' + PARTS[d.part].name + "</div>" +
          '<div class="hint">남은 문제 <strong>' + (ids.length - answered) + "</strong> / " + ids.length + "</div></div>" +
        '<div class="mock-timer" id="mock-timer" role="timer" aria-live="off">--:--</div>' +
      "</div>" +
      '<nav class="palette" aria-label="문제 번호">' + ids.map((id, i) =>
        '<button type="button" class="pal' + (d.answers[id] !== undefined ? " done" : "") + (i === d.index ? " now" : "") + '" data-jump="' + i + '" aria-label="' + (i + 1) + "번" + (d.answers[id] !== undefined ? " 답함" : "") + '">' + (i + 1) + "</button>").join("") + "</nav>" +
      (passage ? passageTextHTML(passage) : "") +
      (item ? '<article class="listen"><h3 lang="ja">' + esc(item.title) + '</h3><div class="player"><p class="hint">음성을 준비하고 있어요…</p></div></article>' : "") +
      '<div class="q">' +
        '<div class="q-top"><span class="q-num">' + (d.index + 1) + "번 · " + AREAS[q.area] + (q.kind ? " · " + esc(q.kind) : "") + "</span></div>" +
        '<div class="q-text" lang="ja">' + multiline(q.prompt) + "</div>" +
        '<div class="opts wide">' + q.options.map((o, j) =>
          '<button type="button" class="opt' + (d.answers[qid] === j ? " picked" : "") + '" data-pick="' + j + '" aria-pressed="' + (d.answers[qid] === j) + '"><span class="n">' + (j + 1) + '</span><span lang="ja">' + esc(o) + "</span></button>").join("") +
        "</div>" +
      "</div>" +
      '<div class="mock-nav">' +
        '<button type="button" class="btn ghost" id="m-prev"' + (d.index === 0 ? " disabled" : "") + ">이전 문제</button>" +
        '<button type="button" class="btn ghost" id="m-next"' + (d.index === ids.length - 1 ? " disabled" : "") + ">다음 문제</button>" +
      "</div>" +
      '<div class="mock-submit">' +
        (ui.confirm
          ? '<span class="confirm">' + (answered < ids.length ? "아직 답하지 않은 문제가 " + (ids.length - answered) + "개 있어요. " : "") + (d.part === 1 ? "1부를 제출하고 2부(청해)로 넘어갈까요?" : "제출하고 결과를 볼까요?") + "</span>" +
            '<button type="button" class="btn" id="m-submit-yes">제출</button><button type="button" class="link-btn" id="m-submit-no">계속 풀기</button>'
          : '<button type="button" class="btn" id="m-submit">' + (d.part === 1 ? "1부 제출" : "답안 제출") + "</button>" +
            '<button type="button" class="link-btn" id="m-quit">그만두기</button>') +
      "</div>" +
    "</section>";

  if (item) setupPlayer(app.querySelector(".player"), item);

  const timerEl = app.querySelector("#mock-timer");
  const tick = () => {
    const left = Math.max(0, d.deadline - Date.now());
    const s = Math.ceil(left / 1000);
    timerEl.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    timerEl.classList.toggle("low", s <= 300);
    if (left <= 0) { clearInterval(timer); submitPart(app, loadDraft(), true); }
  };
  tick();
  timer = setInterval(() => { if (!timerEl.isConnected) clearInterval(timer); else tick(); }, 1000);

  const go = i => { const cur = loadDraft(); cur.index = i; saveDraft(cur); ui.confirm = false; render(app); };
  app.onclick = e => {
    const p = e.target.closest("[data-pick]"), j = e.target.closest("[data-jump]");
    const id = e.target.id;
    if (p) {
      // 화면을 다시 그리지 않고 표시만 바꾼다 (청해 음성이 끊기지 않게)
      const cur = loadDraft();
      cur.answers[qid] = Number(p.dataset.pick);
      saveDraft(cur);
      app.querySelectorAll("[data-pick]").forEach(b => {
        const on = b === p;
        b.classList.toggle("picked", on);
        b.setAttribute("aria-pressed", on);
      });
      const pal = app.querySelector('[data-jump="' + d.index + '"]');
      pal.classList.add("done");
      pal.setAttribute("aria-label", (d.index + 1) + "번 답함");
      const left = ids.filter(id => cur.answers[id] === undefined).length;
      app.querySelector(".mock-bar strong").textContent = left;
    } else if (j) go(Number(j.dataset.jump));
    else if (id === "m-prev") go(d.index - 1);
    else if (id === "m-next") go(d.index + 1);
    else if (id === "m-submit") { ui.confirm = true; render(app); }
    else if (id === "m-submit-no") { ui.confirm = false; render(app); }
    else if (id === "m-submit-yes") { ui.confirm = false; submitPart(app, loadDraft(), false); }
    else if (id === "m-quit") { ui.confirm = false; app.querySelector(".mock-submit").innerHTML = '<span class="confirm">그만두면 지금까지 푼 답은 저장되지 않아요.</span><button type="button" class="btn danger" id="m-quit-yes">그만두기</button><button type="button" class="link-btn" id="m-submit-no">계속 풀기</button>'; }
    else if (id === "m-quit-yes") { clearDraft(); render(app); }
  };
}

// 한 부를 끝낸다. 1부면 2부로, 2부면 채점한다
function submitPart(app, d, timedOut) {
  if (!d) return render(app);
  d.partEnded[d.part] = timedOut ? "time" : "submit";
  if (d.part === 1) {
    d.part = 2; d.index = 0; d.deadline = Date.now() + d.minutes[2] * 60000;
    saveDraft(d);
    render(app);
    showToast(app, timedOut ? "1부 시간이 끝나 자동으로 제출했어요. 2부(청해)를 시작해요." : "1부를 제출했어요. 2부(청해)를 시작해요.");
    return;
  }
  const result = grade(d);
  store.update("mocks", list => { list.push(result); });
  clearDraft();
  ui.review = result;
  render(app);
  window.scrollTo(0, 0);
  if (timedOut) showToast(app, "시간이 끝나 자동으로 제출했어요.");
}

function grade(d) {
  const all = [...d.set[1], ...d.set[2]];
  const areas = { vocab: { c: 0, t: 0 }, grammar: { c: 0, t: 0 }, reading: { c: 0, t: 0 }, listening: { c: 0, t: 0 } };
  const items = all.map(id => {
    const q = QUESTIONS.get(id);
    const choice = d.answers[id] === undefined ? null : d.answers[id];
    const ok = choice === q.answer;
    areas[q.area].t++; if (ok) areas[q.area].c++;
    // 답한 문제는 풀이 기록에 남겨 오답 노트·대시보드에 반영한다
    if (choice !== null) store.recordAttempt(Object.assign({ area: q.area }, q), choice, "mock");
    return { qid: id, choice, ok };
  });
  Object.values(areas).forEach(r => { r.rate = pct(r.c, r.t); });
  const c = items.filter(i => i.ok).length;
  // 학습용 추정치: 정답률을 60점 만점으로 단순 환산 (공식 점수 아님)
  const est = r => (r.t ? Math.round(r.c / r.t * 60) : null);
  const lang = { c: areas.vocab.c + areas.grammar.c, t: areas.vocab.t + areas.grammar.t };
  return {
    at: Date.now(), timeMode: d.timeMode, minutes: d.minutes, partEnded: d.partEnded,
    durationMin: Math.round((Date.now() - d.startedAt) / 60000),
    total: { c, t: items.length, rate: pct(c, items.length) },
    areas, items,
    estimate: { language: est(lang), reading: est(areas.reading), listening: est(areas.listening) },
  };
}

function renderResult(app, r) {
  const weakest = Object.entries(r.areas).filter(([, v]) => v.t).sort((a, b) => a[1].rate - b[1].rate)[0];
  const unanswered = r.items.filter(i => i.choice === null).length;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>모의고사 결과</h2><p>' + fmtDate(dateKey(new Date(r.at))) + " · 걸린 시간 " + r.durationMin + "분 · " + (r.timeMode === "official" ? "실제 시험 시간" : "문항 수에 맞춘 시간") + "</p></div>" +
        '<button type="button" class="btn ghost sm" id="r-back">모의고사 처음으로</button></div>' +
      '<div class="tiles">' +
        '<article class="tile"><span class="tile-label">전체 정답률</span><span class="tile-value">' + r.total.rate + '%</span><span class="tile-sub">' + r.total.c + " / " + r.total.t + "문제" + (unanswered ? " · 미응답 " + unanswered : "") + "</span></article>" +
        Object.entries(r.areas).map(([a, v]) =>
          '<article class="tile"><span class="tile-label">' + AREAS[a] + '</span><span class="tile-value">' + (v.rate === null ? "-" : v.rate + "%") + '</span><span class="tile-sub">' + v.c + " / " + v.t + "</span></article>").join("") +
      "</div>" +
      '<article class="card-box estimate"><h3>학습용 추정치 <span class="badge warn">공식 점수 아님</span></h3>' +
        '<dl class="facts">' +
          '<div class="fact"><dt>언어지식(문자·어휘·문법)</dt><dd>' + (r.estimate.language ?? "-") + " / 60</dd></div>" +
          '<div class="fact"><dt>독해</dt><dd>' + (r.estimate.reading ?? "-") + " / 60</dd></div>" +
          '<div class="fact"><dt>청해</dt><dd>' + (r.estimate.listening ?? "-") + " / 60</dd></div>" +
        "</dl>" +
        '<p class="hint">정답률을 60점 만점으로 단순히 바꾼 숫자예요. JLPT의 실제 점수는 정답 개수를 그대로 환산하는 방식이 아니고, 이 모의고사는 문항 수도 적어서 합격 여부를 판단하는 데 쓸 수 없어요. 영역별로 어디가 약한지 보는 용도로만 쓰세요.</p>' +
      "</article>" +
      '<article class="card-box"><h3>결과 분석</h3><ul class="goal-list">' +
        (weakest ? "<li>가장 낮은 영역은 <b>" + AREAS[weakest[0]] + "</b>(" + weakest[1].rate + "%)이에요. D-30 모드나 해당 영역 화면에서 집중해 보세요.</li>" : "") +
        "<li>틀린 문제 " + r.items.filter(i => i.choice !== null && !i.ok).length + "개는 오답 노트에 저장했어요.</li>" +
        (unanswered ? "<li>답하지 않은 문제가 " + unanswered + "개 있어요. 시간 배분을 다시 확인해 보세요.</li>" : "") +
        (r.partEnded && (r.partEnded[1] === "time" || r.partEnded[2] === "time") ? "<li>시간이 끝나 자동 제출된 부분이 있어요.</li>" : "") +
      '</ul><a class="btn ghost sm" href="#notes">오답 노트로 가기</a></article>' +
      '<h3>문제별 해설</h3><div class="quiz">' + r.items.map((it, i) => {
        const q = QUESTIONS.get(it.qid);
        if (!q) return "";
        return '<details class="q review-q' + (it.ok ? "" : " is-wrong") + '"><summary><span class="q-num">' + (i + 1) + "번 · " + AREAS[q.area] + "</span> " +
          '<span class="badge ' + (it.ok ? "ok" : "warn") + '">' + (it.ok ? "정답" : it.choice === null ? "미응답" : "오답") + "</span></summary>" +
          '<div class="q-text" lang="ja">' + multiline(q.prompt) + "</div>" +
          feedbackHTML(q, it.choice) + "</details>";
      }).join("") + "</div>" +
    "</section>";
  app.querySelector("#r-back").onclick = () => { ui.review = null; render(app); window.scrollTo(0, 0); };
}

function showToast(app, text) {
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = text;
  app.prepend(t);
  setTimeout(() => t.remove(), 5000);
}

export default { id: "mock", label: "모의고사", render, leave: () => { clearInterval(timer); stopAll(); ui.confirm = false; ui.review = null; } };
