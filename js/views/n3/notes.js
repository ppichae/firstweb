// N3 방 · 오답 노트: N3 방에서 틀린 문제만 모은다 (N1 오답 노트와 따로 저장)
import { n3store } from "../../store.js";
import { esc, multiline, dateKey, fmtDate } from "../../util.js";
import { mountQuestion } from "../../quiz.js";
import { noteEntries } from "../../stats.js";
import { award } from "./game.js";

const AREA = { basics: "기초", vocab: "단어", grammar: "문법", kanji: "한자", reading: "독해", listening: "청해" };
const ui = { area: "all", status: "open" };
const retrying = new Set();

function render(app) {
  const all = noteEntries(n3store);
  const counts = { all: all.length };
  Object.keys(AREA).forEach(a => { counts[a] = all.filter(n => n.area === a).length; });
  const list = all.filter(n => (ui.area === "all" || n.area === ui.area) &&
    (ui.status === "all" || (ui.status === "open" ? !n.resolved : n.resolved))).sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  const openCount = all.filter(n => !n.resolved).length;

  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>오답 노트</h2><p>N3 방에서 틀린 문제가 자동으로 모여요. N1 방의 오답 노트와는 따로 저장돼요.</p></div>' +
        '<div class="progress">다시 풀 문제 <strong>' + openCount + "</strong> · 극복한 문제 <strong>" + (all.length - openCount) + "</strong></div></div>" +
      '<div class="toolbar">' + [["all", "전체"], ...Object.entries(AREA)].map(([k, l]) =>
        '<button type="button" class="chip" data-narea="' + k + '" aria-pressed="' + (ui.area === k) + '">' + l + " " + (counts[k] || 0) + "</button>").join("") + "</div>" +
      '<div class="toolbar">' + [["open", "다시 풀 문제"], ["done", "극복한 문제"], ["all", "모두"]].map(([k, l]) =>
        '<button type="button" class="chip" data-nstatus="' + k + '" aria-pressed="' + (ui.status === k) + '">' + l + "</button>").join("") + "</div>" +
      (list.length ? '<div class="notes">' + list.map(noteHTML).join("") + "</div>"
        : '<p class="empty">' + (all.length ? "이 조건에 맞는 오답이 없어요." : "아직 틀린 문제가 없어요. 기초 단원, 어휘·문형 퀴즈, 시험 대비에서 틀린 문제가 여기에 모여요.") + "</p>") +
    "</section>";

  list.forEach(n => { if (retrying.has(n.qid)) mountRetry(app, n); });
  app.onclick = e => {
    const a = e.target.closest("[data-narea]"), s = e.target.closest("[data-nstatus]"), r = e.target.closest("[data-retry]");
    if (a) { ui.area = a.dataset.narea; render(app); }
    else if (s) { ui.status = s.dataset.nstatus; render(app); }
    else if (r) { retrying.add(r.dataset.retry); mountRetry(app, all.find(n => n.qid === r.dataset.retry)); }
  };
}

function noteHTML(n) {
  const q = n.q;
  const mine = n.lastChoice >= 0 ? (n.lastChoice + 1) + ". " + esc(q.options[n.lastChoice]) : "답하지 않음";
  return '<article class="note">' +
    '<div class="q-top"><span class="q-num">' + (AREA[n.area] || n.area) + (q.kind ? " · " + esc(q.kind) : "") + "</span>" +
      '<span class="badges"><span class="badge ' + (n.resolved ? "ok" : "warn") + '">' + (n.resolved ? "극복함" : "다시 풀기 필요") + "</span>" +
      '<span class="badge ai">자체 제작 연습</span></span></div>' +
    '<div class="q-text" lang="ja">' + multiline(q.prompt) + "</div>" +
    '<dl class="note-facts">' +
      '<div><dt>내가 고른 답</dt><dd lang="ja">' + mine + "</dd></div>" +
      '<div><dt>정답</dt><dd lang="ja">' + (q.answer + 1) + ". " + esc(q.options[q.answer]) + "</dd></div>" +
      "<div><dt>틀린 횟수</dt><dd>" + n.wrongCount + "번 (총 " + n.attempts + "번 풂)</dd></div>" +
      "<div><dt>마지막으로 틀린 날</dt><dd>" + fmtDate(dateKey(new Date(n.lastWrongAt))) + "</dd></div>" +
    "</dl>" +
    '<div class="history" aria-label="풀이 기록">' + n.history.map(ok => '<span class="' + (ok ? "h-ok" : "h-bad") + '">' + (ok ? "○" : "✕") + "</span>").join("") + "</div>" +
    (q.explanation ? '<details class="g-more"><summary>해설</summary><p>' + multiline(q.explanation) + "</p></details>" : "") +
    '<div class="toolbar"><button type="button" class="btn ghost" data-retry="' + esc(n.qid) + '">다시 풀기</button></div>' +
    '<div class="retry" id="retry-' + esc(n.qid) + '"></div>' +
  "</article>";
}

function mountRetry(app, n) {
  const box = app.querySelector("#retry-" + CSS.escape(n.qid));
  if (!box || box.childElementCount) return;
  const holder = document.createElement("div");
  box.appendChild(holder);
  mountQuestion(holder, Object.assign({}, n.q, { area: n.area }), {
    label: "다시 풀기", mode: "review", wide: true, store: n3store,
    onAnswer: ok => { retrying.delete(n.qid); award(ok ? "correct" : "wrong", n.qid); },
  });
}

export default { id: "n3/notes", label: "오답 노트", render };
