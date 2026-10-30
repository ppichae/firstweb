// 오답 노트: 틀린 문제를 영역별로 모아 보고 다시 푼다
import { DB } from "../data.js";
import { esc, multiline, badges, AREAS, dateKey, fmtDate } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { noteEntries } from "../stats.js";
import { openPassage } from "./reading.js";
import { openListening } from "./listening.js";

const ui = { area: "all", status: "open", sort: "recent" };
const retrying = new Set();

function render(app) {
  const all = noteEntries();
  const counts = { all: all.length };
  Object.keys(AREAS).forEach(a => { counts[a] = all.filter(n => n.area === a).length; });
  let list = all.filter(n => (ui.area === "all" || n.area === ui.area) &&
    (ui.status === "all" || (ui.status === "open" ? !n.resolved : n.resolved)));
  list.sort(ui.sort === "count" ? (a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt - a.lastWrongAt : (a, b) => b.lastWrongAt - a.lastWrongAt);
  const openCount = all.filter(n => !n.resolved).length;

  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>오답 노트</h2><p>틀린 문제는 모든 영역에서 자동으로 모여요. 다시 맞혀도 예전 기록은 그대로 남아요.</p></div>' +
        '<div class="progress">다시 풀 문제 <strong>' + openCount + "</strong> · 극복한 문제 <strong>" + (all.length - openCount) + "</strong></div></div>" +
      '<div class="toolbar">' + [["all", "전체"], ...Object.entries(AREAS)].map(([k, l]) =>
        '<button type="button" class="chip" data-narea="' + k + '" aria-pressed="' + (ui.area === k) + '">' + l + " " + (counts[k] || 0) + "</button>").join("") + "</div>" +
      '<div class="toolbar">' +
        [["open", "다시 풀 문제"], ["done", "극복한 문제"], ["all", "모두"]].map(([k, l]) =>
          '<button type="button" class="chip" data-nstatus="' + k + '" aria-pressed="' + (ui.status === k) + '">' + l + "</button>").join("") +
        '<label class="rate">정렬 <select id="n-sort"><option value="recent"' + (ui.sort === "recent" ? " selected" : "") + '>최근에 틀린 순</option><option value="count"' + (ui.sort === "count" ? " selected" : "") + ">많이 틀린 순</option></select></label>" +
      "</div>" +
      (list.length ? '<div class="notes">' + list.map(noteHTML).join("") + "</div>"
        : '<p class="empty">' + (all.length ? "이 조건에 맞는 오답이 없어요." : "아직 틀린 문제가 없어요. 단어·문법·독해·청해에서 문제를 풀면 틀린 문제가 여기에 모여요.") + "</p>") +
    "</section>";

  list.forEach(n => { if (retrying.has(n.qid)) mountRetry(app, n); });

  app.querySelector("#n-sort").onchange = e => { ui.sort = e.target.value; render(app); };
  app.onclick = e => {
    const a = e.target.closest("[data-narea]"), s = e.target.closest("[data-nstatus]");
    const r = e.target.closest("[data-retry]"), o = e.target.closest("[data-open]");
    if (a) { ui.area = a.dataset.narea; render(app); }
    else if (s) { ui.status = s.dataset.nstatus; render(app); }
    else if (r) {
      retrying.add(r.dataset.retry);
      mountRetry(app, all.find(n => n.qid === r.dataset.retry));
    } else if (o) {
      const [kind, id] = o.dataset.open.split(":");
      if (kind === "reading") openPassage(id); else openListening(id);
    }
  };
}

function noteHTML(n) {
  const q = n.q;
  const parent = n.area === "reading" ? DB.reading.passages.find(p => p.id === q.passageId)
    : n.area === "listening" ? DB.listening.items.find(it => it.id === q.itemId) : null;
  const mine = q.options[n.lastChoice];
  const wr = q.wrongReasons && q.wrongReasons[n.lastChoice];
  return '<article class="note" id="note-' + esc(n.qid) + '">' +
    '<div class="q-top"><span class="q-num">' + AREAS[n.area] + (q.kind ? " · " + esc(q.kind) : "") +
      (parent ? ' · <span lang="ja">' + esc(parent.title) + "</span>" : "") + "</span>" +
      '<span class="badges"><span class="badge ' + (n.resolved ? "ok" : "warn") + '">' + (n.resolved ? "극복함" : "다시 풀기 필요") + "</span>" + badges(q).replace(/^<span class="badges">|<\/span>$/g, "") + "</span></div>" +
    '<div class="q-text" lang="ja">' + multiline(q.prompt) + "</div>" +
    '<dl class="note-facts">' +
      "<div><dt>내가 고른 답</dt><dd lang=\"ja\">" + (n.lastChoice + 1) + ". " + esc(mine) + "</dd></div>" +
      "<div><dt>정답</dt><dd lang=\"ja\">" + (q.answer + 1) + ". " + esc(q.options[q.answer]) + "</dd></div>" +
      "<div><dt>틀린 횟수</dt><dd>" + n.wrongCount + "번 (총 " + n.attempts + "번 풂)</dd></div>" +
      "<div><dt>마지막으로 틀린 날</dt><dd>" + fmtDate(dateKey(new Date(n.lastWrongAt))) + "</dd></div>" +
    "</dl>" +
    '<div class="history" aria-label="풀이 기록">' + n.history.map(ok => '<span class="' + (ok ? "h-ok" : "h-bad") + '">' + (ok ? "○" : "✕") + "</span>").join("") + "</div>" +
    '<details class="g-more"><summary>상세 해설</summary><dl>' +
      (q.explanation ? "<div><dt>정답인 이유</dt><dd>" + multiline(q.explanation) + "</dd></div>" : "") +
      (wr ? "<div><dt>내가 고른 답이 틀린 이유</dt><dd>" + multiline(wr) + "</dd></div>" : "") +
      (q.evidence ? '<div><dt>근거가 되는 부분</dt><dd lang="ja">' + multiline(q.evidence) + "</dd></div>" : "") +
    "</dl></details>" +
    '<div class="toolbar">' +
      '<button type="button" class="btn ghost" data-retry="' + esc(n.qid) + '">다시 풀기</button>' +
      (parent ? '<button type="button" class="link-btn" data-open="' + n.area + ":" + parent.id + '">' + (n.area === "reading" ? "지문 열기" : "음성 다시 듣기") + "</button>" : "") +
    "</div>" +
    '<div class="retry" id="retry-' + esc(n.qid) + '"></div>' +
  "</article>";
}

function mountRetry(app, n) {
  const box = app.querySelector("#retry-" + CSS.escape(n.qid));
  if (!box || box.childElementCount) return;
  const holder = document.createElement("div");
  box.appendChild(holder);
  mountQuestion(holder, Object.assign({}, n.q, { area: n.area }), {
    label: "다시 풀기", mode: "review", wide: true,
    onAnswer: () => { retrying.delete(n.qid); },
  });
  holder.scrollIntoView({ block: "nearest" });
}

export default { id: "notes", label: "오답 노트", render };
