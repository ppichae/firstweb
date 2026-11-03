// 독해 화면: 유형별 지문 목록 + 지문 읽기(후리가나·문단 듣기·해석은 원할 때만) + 핵심 단어·문법 + 문제
// N1 방(data/reading.json)과 N3 방(data/n3/reading.json)이 같은 화면을 쓴다. 기록은 방마다 따로 남는다.
import { DB, EXTRA } from "../data.js";
import { store, n3store } from "../store.js";
import { esc, badges } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { jpText, rubyHTML, furiToggleHTML } from "../examples.js";
import { sayBtn, Player, getJaVoices, stopAll, VOICE_HELP } from "../speech.js";
import { award } from "../game.js";

const levelDots = n => "●".repeat(n) + "○".repeat(Math.max(0, 3 - n));
// 실제 글자 수 (후리가나·밑줄 표시 기호와 줄바꿈은 빼고 센다)
const plain = s => String(s).replace(/\{([^|}]+)\|[^}]+\}/g, "$1").replace(/\[\[|\]\]|\n/g, "");
const charCount = p => p.texts.reduce((n, t) => n + plain(t.paragraphs.join("")).length, 0);
const paraClass = p => "jp" + (p.type === "info" ? " info" : "");

// 핵심 단어·문법 (자료에 있을 때만)
function studyAidHTML(p) {
  const v = p.vocab || [], g = p.grammar || [];
  if (!v.length && !g.length) return "";
  return '<details class="g-more aid"><summary>핵심 단어 ' + v.length + "개 · 문법 " + g.length + "개</summary>" +
    (v.length ? '<ul class="aid-list">' + v.map(x => '<li><span class="jp" lang="ja">' + rubyHTML(x.w) + "</span>" + sayBtn(x.w, "단어 듣기") + " <span>" + esc(x.m) + "</span></li>").join("") + "</ul>" : "") +
    (g.length ? '<ul class="aid-list">' + g.map(x => '<li><b class="jp" lang="ja">' + esc(x.p) + "</b> <span>" + esc(x.m) + "</span></li>").join("") + "</ul>" : "") +
    "</details>";
}

// 지문 본문만 그린다 (진단 테스트·모의고사에서 사용, 해석 없음)
export function passageTextHTML(p) {
  return '<article class="passage"><div class="passage-label"><span>' + esc(p.typeLabel) + '</span></div>' +
    p.texts.map(t => (t.label ? '<h4 class="text-label">' + esc(t.label) + "</h4>" : "") +
      t.paragraphs.map(par => '<p class="' + paraClass(p) + '" lang="ja">' + jpText(par) + "</p>").join("")).join("") +
    "</article>";
}

// cfg: { id, roomId, st(저장소), data()(자료), needs }
export function createReadingView(cfg) {
  const ui = { type: "all", current: null };
  let timer = null;
  const data = () => cfg.data() || { meta: { types: {} }, passages: [] };

  function solvedCount(p) {
    const ids = new Set(p.questions.map(q => q.id));
    return new Set(cfg.st.get("attempts").filter(a => ids.has(a.qid)).map(a => a.qid)).size;
  }

  function render(app) {
    clearInterval(timer);
    const d = data(), types = d.meta.types || {}, all = d.passages || [];
    const list = all.filter(p => ui.type === "all" || p.type === ui.type);
    if (!list.find(p => p.id === ui.current)) ui.current = list.length ? list[0].id : null;
    const usedTypes = [...new Set(all.map(p => p.type))];
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>독해</h2></div>' +
          '<div class="toolbar">' + furiToggleHTML() + "</div></div>" +
        (all.length ? "" : '<p class="empty">독해 지문이 아직 없어요.</p>') +
        '<div class="toolbar">' + ["all", ...usedTypes].map(k =>
          '<button type="button" class="chip" data-rtype="' + k + '" aria-pressed="' + (ui.type === k) + '">' + (k === "all" ? "전체" : esc(String(types[k] || k).split(" · ")[0])) + "</button>").join("") + "</div>" +
        '<div class="picker">' + list.map(p =>
          '<button type="button" class="pick" data-passage="' + p.id + '" aria-pressed="' + (p.id === ui.current) + '">' +
            '<span class="pick-type">' + esc(p.typeLabel) + "</span>" +
            '<span class="pick-title" lang="ja">' + esc(plain(p.title)) + "</span>" +
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
    const p = all.find(x => x.id === ui.current);
    if (p) renderPassage(app.querySelector("#passage"), p, types);
  }

  function renderPassage(el, p, types) {
    const official = types[p.type];
    el.innerHTML =
      '<div class="panel-head"><div><h3 lang="ja">' + rubyHTML(p.title) + "</h3>" +
        '<p class="hint">' + (official ? "공식 유형 기준: " + esc(official) + " · " : "") + "이 지문: " + charCount(p) + "자</p></div>" +
        '<div class="toolbar"><span class="timer" id="timer" role="timer">0:00</span><span class="score" id="score"></span>' +
        '<button type="button" class="link-btn" id="reset">다시 풀기</button></div></div>' +
      '<div class="reading-layout">' +
        '<article class="passage">' +
          '<div class="passage-label"><span>' + esc(p.typeLabel) + " · 예상 풀이 시간 " + p.minutes + "분</span>" + badges(p) +
            '<button type="button" class="link-btn" id="play-all">▶ 지문 전체 듣기</button>' +
            '<button type="button" class="link-btn" id="toggle-trans" aria-expanded="false">해석 보기</button></div>' +
          p.texts.map(t => (t.label ? '<h4 class="text-label">' + esc(t.label) + "</h4>" : "") +
            t.paragraphs.map(par => '<p class="' + paraClass(p) + '" lang="ja">' + jpText(par) + " " + sayBtn(par.replace(/\[\[|\]\]/g, ""), "이 문단 듣기") + "</p>").join("")).join("") +
          '<div class="trans" id="trans" hidden>' +
            p.texts.map(t => (t.label ? "<h4>" + esc(t.label) + "</h4>" : "") + t.translation.map(par => "<p>" + esc(par) + "</p>").join("")).join("") +
          "</div>" +
          studyAidHTML(p) +
        "</article>" +
        '<div class="quiz" id="quiz"></div>' +
      "</div>";

    // 지문 전체 듣기: 문단을 「。」 단위로 나눠 차례로 읽는다 (다시 누르면 멈춤)
    const pbtn = el.querySelector("#play-all");
    let reader = null;
    pbtn.onclick = async () => {
      if (reader && reader.state === "playing") { reader.stop(); return; }
      const voices = await getJaVoices();
      if (!voices.length) { window.alert("이 기기에서 일본어 음성을 찾지 못했어요.\n" + VOICE_HELP); return; }
      const lines = p.texts.flatMap(t => t.paragraphs).flatMap(par => par.replace(/\[\[|\]\]/g, "").split(/(?<=。)|\n/))
        .map(s => s.trim()).filter(Boolean).map(ja => ({ sp: "ナ", ja }));
      reader = new Player(lines, voices, st => { if (st === "line") return; pbtn.textContent = st === "playing" ? "■ 듣기 멈추기" : "▶ 지문 전체 듣기"; });
      reader.play();
    };
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
      // N3 방의 문제는 문제 목록(QUESTIONS)에 없으므로 문제 내용을 기록에 함께 남긴다(오답 노트용)
      const qq = Object.assign({ area: "reading" }, q, cfg.roomId === "n3" ? { generated: true, kind: "reading" } : {});
      return mountQuestion(box, qq, {
        number: i + 1, wide: true, store: cfg.st,
        onAnswer: ok => {
          if (cfg.roomId === "n3") award("n3", ok ? "correct" : "wrong", q.id);
          results.set(q.id, ok);
          score.textContent = [...results.values()].filter(Boolean).length + " / " + p.questions.length + " 정답";
          if (results.size === p.questions.length) { clearInterval(timer); timerEl.classList.add("done"); }
        },
      });
    });
    el.querySelector("#reset").onclick = () => { results.clear(); mounted.forEach(m => m.reset()); score.textContent = ""; };
  }

  return {
    id: cfg.id, label: "독해", jp: "読解", needs: cfg.needs, render, leave: () => { clearInterval(timer); stopAll(); },
    open(id) { ui.type = "all"; ui.current = id; location.hash = cfg.id; },
  };
}

const n1Reading = createReadingView({ id: "reading", roomId: "n1", st: store, data: () => DB.reading });
export const n3Reading = createReadingView({ id: "n3/reading", roomId: "n3", st: n3store, data: () => EXTRA.n3reading, needs: ["n3reading"] });

// 다른 화면(오답 노트 등)에서 특정 지문을 바로 열 때
export const openPassage = id => n1Reading.open(id);

export default n1Reading;
