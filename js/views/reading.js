// 독해 화면: 유형별 지문 목록 + 지문 읽기(해석은 원할 때만) + 문제
import { DB } from "../data.js";
import { store } from "../store.js";
import { esc, multiline, badges } from "../util.js";
import { mountQuestion } from "../quiz.js";

const ui = { type: "all", current: null };
let timer = null;

const levelDots = n => "●".repeat(n) + "○".repeat(3 - n);
// 실제 글자 수 (밑줄 표시 기호와 줄바꿈은 빼고 센다)
const charCount = p => p.texts.reduce((n, t) => n + t.paragraphs.join("").replace(/\[\[|\]\]|\n/g, "").length, 0);

function solvedCount(p) {
  const ids = new Set(p.questions.map(q => q.id));
  return new Set(store.get("attempts").filter(a => ids.has(a.qid)).map(a => a.qid)).size;
}

function render(app) {
  clearInterval(timer);
  const types = DB.reading.meta.types;
  const list = DB.reading.passages.filter(p => ui.type === "all" || p.type === ui.type);
  if (!list.find(p => p.id === ui.current)) ui.current = list.length ? list[0].id : null;
  const usedTypes = [...new Set(DB.reading.passages.map(p => p.type))];
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>독해</h2><p>지문을 고르고 읽은 뒤 문제를 푸세요. 해석은 원할 때만 펼쳐요.</p></div></div>' +
      '<div class="toolbar">' + ["all", ...usedTypes].map(k =>
        '<button type="button" class="chip" data-rtype="' + k + '" aria-pressed="' + (ui.type === k) + '">' + (k === "all" ? "전체" : esc(types[k].split(" · ")[0])) + "</button>").join("") + "</div>" +
      '<div class="picker">' + list.map(p =>
        '<button type="button" class="pick" data-passage="' + p.id + '" aria-pressed="' + (p.id === ui.current) + '">' +
          '<span class="pick-type">' + esc(p.typeLabel) + "</span>" +
          '<span class="pick-title" lang="ja">' + esc(p.title) + "</span>" +
          '<span class="pick-meta">난이도 ' + levelDots(p.difficulty) + " · 약 " + p.minutes + "분 · " + charCount(p) + "자 · " + solvedCount(p) + "/" + p.questions.length + " 풂</span>" +
        "</button>").join("") + "</div>" +
      '<div id="passage"></div>' +
    "</section>";
  app.onclick = e => {
    const t = e.target.closest("[data-rtype]");
    const p = e.target.closest("[data-passage]");
    if (t) { ui.type = t.dataset.rtype; render(app); }
    else if (p) { ui.current = p.dataset.passage; render(app); app.querySelector("#passage").scrollIntoView({ block: "start" }); }
  };
  const p = DB.reading.passages.find(x => x.id === ui.current);
  if (p) renderPassage(app.querySelector("#passage"), p);
}

function renderPassage(el, p) {
  const official = DB.reading.meta.types[p.type];
  el.innerHTML =
    '<div class="panel-head"><div><h3 lang="ja">' + esc(p.title) + "</h3>" +
      '<p class="hint">공식 유형 기준: ' + esc(official) + " · 이 지문: " + charCount(p) + "자</p></div>" +
      '<div class="toolbar"><span class="timer" id="timer" role="timer">0:00</span><span class="score" id="score"></span>' +
      '<button type="button" class="link-btn" id="reset">다시 풀기</button></div></div>' +
    '<div class="reading-layout">' +
      '<article class="passage">' +
        '<div class="passage-label"><span>' + esc(p.typeLabel) + " · 예상 풀이 시간 " + p.minutes + "분</span>" + badges(p) +
          '<button type="button" class="link-btn" id="toggle-trans" aria-expanded="false">해석 보기</button></div>' +
        p.texts.map(t => (t.label ? '<h4 class="text-label">' + esc(t.label) + "</h4>" : "") +
          t.paragraphs.map(par => '<p class="jp' + (p.type === "info" ? " info" : "") + '" lang="ja">' + multiline(par) + "</p>").join("")).join("") +
        '<div class="trans" id="trans" hidden>' +
          p.texts.map(t => (t.label ? "<h4>" + esc(t.label) + "</h4>" : "") + t.translation.map(par => "<p>" + esc(par) + "</p>").join("")).join("") +
        "</div>" +
      "</article>" +
      '<div class="quiz" id="quiz"></div>' +
    "</div>";

  const trans = el.querySelector("#trans");
  const tbtn = el.querySelector("#toggle-trans");
  tbtn.onclick = () => {
    trans.hidden = !trans.hidden;
    tbtn.setAttribute("aria-expanded", !trans.hidden);
    tbtn.textContent = trans.hidden ? "해석 보기" : "해석 숨기기";
  };

  // 풀이 시간: 지문을 연 순간부터 모든 문제를 풀 때까지
  const started = Date.now();
  const timerEl = el.querySelector("#timer");
  const tick = () => {
    const s = Math.floor((Date.now() - started) / 1000);
    timerEl.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " / 예상 " + p.minutes + "분";
  };
  tick();
  clearInterval(timer);
  timer = setInterval(() => { if (!el.isConnected) clearInterval(timer); else tick(); }, 1000);

  const results = new Map();
  const score = el.querySelector("#score");
  const quiz = el.querySelector("#quiz");
  const mounted = p.questions.map((q, i) => {
    const box = document.createElement("div");
    quiz.appendChild(box);
    return mountQuestion(box, Object.assign({ area: "reading" }, q), {
      number: i + 1, wide: true,
      onAnswer: ok => {
        results.set(q.id, ok);
        score.textContent = [...results.values()].filter(Boolean).length + " / " + p.questions.length + " 정답";
        if (results.size === p.questions.length) { clearInterval(timer); timerEl.classList.add("done"); }
      },
    });
  });
  el.querySelector("#reset").onclick = () => { results.clear(); mounted.forEach(m => m.reset()); score.textContent = ""; };
}

export default { id: "reading", label: "독해", jp: "読解", render, leave: () => clearInterval(timer) };
