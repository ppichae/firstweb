// N3 방 · 기초 과정: 히라가나 · 가타카나 · 문자 통합 학습 · 핵심 단원(개념 → 예문 → 짧은 퀴즈) · 단어·한자(준비 중)
// 히라가나와 가타카나는 화면과 진도가 따로다(kana.js). 문자 규칙 수업(b01·k01)은 각 문자 화면의 '촉음·장음'에서 배운다.
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc, today } from "../../util.js";
import { mountQuestion } from "../../quiz.js";
import { stopAll } from "../../speech.js";
import { award } from "./game.js";
import { renderScript, renderMixed, speak, voiceText, scriptProgress } from "./kana.js";

const ui = { mode: "hira", unit: null, sec: {}, quiz: {}, writeChar: {} };

export const unitDone = id => !!(n3store.get("basics")[id] || {}).done;
// 핵심 단원: 문자 규칙 수업(track 있음)을 뺀 문법·표현 단원
export const coreUnits = data => data.units.filter(u => !u.track);

function render(app) {
  const data = EXTRA.n3basics;
  if (!data) {
    app.innerHTML = '<section class="panel"><h2>기초 과정</h2><p class="notice">콘텐츠 준비 중이에요. 기초 과정 자료 파일을 불러오지 못했어요.</p></section>';
    return;
  }
  const units = coreUnits(data);
  if (ui.unit && !units.some(u => u.id === ui.unit)) ui.unit = null;
  const done = units.filter(u => unitDone(u.id)).length;
  const h = scriptProgress(data, "hira"), k = scriptProgress(data, "kata");
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>기초 과정</h2>' +
        "<p>히라가나·가타카나부터 기본 문장, 동사·형용사 활용까지 N3 공부에 꼭 필요한 바탕을 빠르게 익혀요.</p></div>" +
        '<div class="progress">히라가나 <strong>' + h.done + "</strong>/" + h.total + " · 가타카나 <strong>" + k.done + "</strong>/" + k.total + " · 단원 <strong>" + done + "</strong>/" + units.length + "</div></div>" +
      '<p class="notice"><b>자체 제작 학습 자료</b> · AI가 새로 쓴 설명과 연습 문제예요. 공식 JLPT 자료가 아니고, 아직 <b>검수 필요</b> 상태예요.</p>' +
      '<div class="segmented" role="tablist" aria-label="기초 과정">' +
        seg("hira", "히라가나") + seg("kata", "가타카나") + seg("mix", "문자 통합 학습") + seg("units", "핵심 단원") + seg("pending", "단어·한자") +
      "</div>" +
      '<div id="mode" class="stack"></div>' +
    "</section>";
  app.onclick = e => {
    const s = e.target.closest("[data-mode]");
    if (s) { ui.mode = s.dataset.mode; ui.unit = null; stopAll(); render(app); }
  };
  const el = app.querySelector("#mode");
  if (ui.mode === "hira" || ui.mode === "kata") renderScript(el, app, data, ui.mode, ui);
  else if (ui.mode === "mix") renderMixed(el, app, data, ui);
  else if (ui.mode === "units") (ui.unit ? renderUnit : renderUnits)(el, app, data);
  else renderPending(el, app, data);
}

// 다른 화면(홈 일정 등)에서 특정 학습 칸으로 바로 열 때
export function openBasics(mode) {
  ui.mode = mode; ui.unit = null;
  if (location.hash === "#n3/basics") window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = "n3/basics";
}

function seg(key, label) {
  return '<button type="button" role="tab" class="seg" data-mode="' + key + '" aria-selected="' + (ui.mode === key) + '">' + label + "</button>";
}


/* ---------- 단원 목록 ---------- */
function renderUnits(el, app, data) {
  el.innerHTML = '<ol class="units">' + coreUnits(data).map((u, i) => {
    const rec = n3store.get("basics")[u.id] || {};
    return '<li><button type="button" class="unit' + (rec.done ? " is-done" : "") + '" data-unit="' + u.id + '">' +
      '<span class="unit-no">' + (i + 1) + "</span>" +
      '<span class="unit-body"><span class="unit-title">' + esc(u.title) + ' <span class="jp" lang="ja">' + esc(u.jp) + "</span></span>" +
        '<span class="unit-goal">' + esc(u.goal) + "</span></span>" +
      '<span class="unit-state">' + (rec.done ? "완료 · " + rec.best + "/" + u.quiz.length : "추천 " + u.week + "주차") + "</span>" +
    "</button></li>";
  }).join("") + "</ol>";
  el.onclick = e => {
    const b = e.target.closest("[data-unit]");
    if (b) { ui.unit = b.dataset.unit; render(app); window.scrollTo(0, 0); }
  };
}

/* ---------- 단원 하나: 개념 → 예문 → 퀴즈 ---------- */
function renderUnit(el, app, data) {
  const idx = coreUnits(data).findIndex(u => u.id === ui.unit);
  const u = coreUnits(data)[idx];
  const next = coreUnits(data)[idx + 1];
  el.innerHTML =
    '<div class="toolbar unit-nav"><button type="button" class="link-btn" id="back">← 단원 목록</button><span class="progress">단원 <strong>' + (idx + 1) + '</strong> / ' + coreUnits(data).length + '</span></div>' +
    '<article class="card-box">' +
      '<div class="q-top"><h3>' + (idx + 1) + ". " + esc(u.title) + "</h3>" +
        '<span class="badges"><span class="badge ai">자체 제작 · AI 작성</span><span class="badge warn">검수 필요</span></span></div>' +
      '<p class="hint">목표: ' + esc(u.goal) + "</p>" +
      '<h4 class="step">① 개념</h4><ul class="points">' + u.points.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul>" +
      '<h4 class="step">② 예문</h4><ul class="examples">' + u.examples.map((x, i) =>
        '<li><button type="button" class="say" data-say="' + i + '" aria-label="듣기">▶</button>' +
        '<span><span class="jp block" lang="ja">' + esc(x.ja) + '</span><span class="ko">' + esc(x.ko) + "</span></span></li>").join("") + "</ul>" +
      '<p class="p-state" id="voice-msg" role="status">' + esc(voiceText()) + "</p>" +
    "</article>" +
    '<h4 class="step">③ 확인 퀴즈 <span class="score" id="u-score"></span></h4>' +
    '<div class="quiz" id="u-quiz"></div>' +
    '<div id="u-next"></div>';

  const results = new Map();
  const quiz = el.querySelector("#u-quiz");
  u.quiz.forEach((q, i) => {
    const box = document.createElement("div");
    quiz.appendChild(box);
    const full = Object.assign({ id: "n3-basic-" + u.id + "-" + i, area: "basics", generated: true, kind: q.prompt.includes("（　）") ? "빈칸 채우기" : u.title, source: { type: "ai" }, review: "needs-review" }, q);
    mountQuestion(box, full, {
      label: "확인 " + (i + 1), store: n3store, wide: true,
      onAnswer: ok => {
        results.set(i, ok);
        award(ok ? "correct" : "wrong");
        const right = [...results.values()].filter(Boolean).length;
        el.querySelector("#u-score").textContent = right + " / " + u.quiz.length;
        if (results.size === u.quiz.length) finish(right);
      },
    });
  });

  function finish(right) {
    const first = !unitDone(u.id);
    n3store.update("basics", b => {
      const r = b[u.id] || {};
      b[u.id] = { done: r.done || today(), best: Math.max(r.best || 0, right) };
    });
    if (first) award("unit");
    const wrong = [...results.entries()].filter(([, ok]) => !ok).map(([i]) => i);
    const allDone = coreUnits(data).every(x => unitDone(x.id));
    el.querySelector("#u-next").innerHTML =
      '<article class="card-box unit-result" role="status">' +
        "<h3>결과 · " + right + " / " + u.quiz.length + " 정답" + (first ? " <small class=\"xp\">경험치 +30</small>" : "") + "</h3>" +
        '<p class="hint">' + (wrong.length ? "틀린 문제 " + wrong.length + "개의 정답과 해설은 위 문제 아래에 펼쳐져 있어요." : "모두 맞혔어요. 해설은 각 문제 아래에서 다시 볼 수 있어요.") + "</p>" +
        (next
          ? '<p>다음 단원: <b>' + (idx + 2) + ". " + esc(next.title) + "</b></p>"
          : "<p><b>" + (allDone ? "기초 과정의 모든 단원을 마쳤어요! " : "마지막 단원이에요. ") + "</b>" +
            (allDone ? "이제 N3 단어와 문법으로 넘어가 보세요." : "아직 끝내지 않은 단원은 단원 목록에서 확인할 수 있어요.") + "</p>") +
        '<div class="toolbar">' +
          (next ? '<button type="button" class="btn" data-unit="' + next.id + '">다음 단원으로 이동 →</button>'
            : allDone ? '<a class="btn" href="#n3/vocab">N3 단어로 가기 →</a>' : "") +
          (wrong.length ? '<button type="button" class="btn ghost" id="see-wrong">틀린 문제 다시 보기</button>' : "") +
          '<button type="button" class="btn ghost" id="again">이 단원 다시 풀기</button>' +
          '<button type="button" class="link-btn" id="back2">단원 목록</button>' +
        "</div></article>";
    el.dataset.firstWrong = wrong.length ? wrong[0] : "";
  }

  el.onclick = async e => {
    if (e.target.closest("#back") || e.target.closest("#back2")) { ui.unit = null; stopAll(); render(app); window.scrollTo(0, 0); return; }
    if (e.target.closest("#see-wrong")) { const q = quiz.children[Number(el.dataset.firstWrong)]; if (q) q.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    if (e.target.closest("#again")) { render(app); const qz = app.querySelector("#u-quiz"); if (qz) qz.scrollIntoView({ block: "start" }); return; }
    const n = e.target.closest("[data-unit]");
    if (n) { ui.unit = n.dataset.unit; stopAll(); render(app); window.scrollTo(0, 0); return; }
    const s = e.target.closest("[data-say]");
    if (s) speak(u.examples[Number(s.dataset.say)].ja, el.querySelector("#voice-msg"));
  };
}

/* ---------- 아직 자료가 없는 영역 ---------- */
function renderPending(el, app, data) {
  el.innerHTML = '<div class="pending-list">' + (data.pending || []).map(p =>
    '<article class="card-box pending"><h3>' + esc(p.title) + '</h3><p class="hint">' + esc(p.note) + "</p></article>").join("") + "</div>";
}

export default { id: "n3/basics", label: "기초", jp: "基礎", needs: ["n3basics"], render, leave: stopAll };
