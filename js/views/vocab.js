// 단어 화면: 단어장 · 플래시카드 · 퀴즈 · 헷갈리는 단어
import { DB } from "../data.js";
import { store } from "../store.js";
import { esc, badges, shuffle, today } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { GRADES, schedule, preview, newCard } from "../srs.js";

export const POS = {
  "noun-suru": "명사 · する동사", noun: "명사", "na-adj": "な형용사", "i-adj": "い형용사",
  verb: "동사", taru: "~と / ~とした", adverb: "부사", expression: "표현",
};
const LEVEL = { 1: "기본", 2: "중요", 3: "심화" };
const NEW_PER_SESSION = 10;

const ui = { mode: "list", q: "", pos: "", topic: "", status: "all", showAll: false, quizType: "meaning" };
const revealed = new Set();

const wordState = id => store.get("words")[id] || {};

// 복습이 필요한 단어: 간격 반복 일정이 오늘 이전이거나, '몰라요'로 표시한 단어
export function needsReview(id) {
  const s = wordState(id);
  return s.status === "unknown" || (!!s.srs && s.srs.due <= today());
}
export const reviewWordIds = () => DB.vocab.items.filter(v => needsReview(v.id)).map(v => v.id);

function setWord(id, fn) { store.update("words", w => { fn(w[id] || (w[id] = {})); }); }

// 퀴즈에서 틀린 단어는 오늘 다시 복습하도록 일정을 당긴다
export function markWordWrong(id) {
  setWord(id, s => { s.wrong = (s.wrong || 0) + 1; s.srs = Object.assign(newCard(), s.srs, { due: today() }); });
}

function render(app) {
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>단어</h2><p id="vocab-sub"></p></div>' +
        '<div class="toolbar"><div class="progress"><strong id="known-count">0</strong> / ' + DB.vocab.items.length + " 외움 · 복습 필요 <strong id=\"due-count\">0</strong></div>" +
        '<div class="bar" aria-hidden="true"><span id="known-bar" style="width:0%"></span></div></div></div>' +
      '<div class="segmented" role="tablist" aria-label="단어 학습 방식">' +
        seg("list", "단어장") + seg("cards", "플래시카드") + seg("quiz", "퀴즈") + seg("compare", "헷갈리는 단어") +
      "</div>" +
      '<div id="mode" class="stack"></div>' +
    "</section>";
  app.onclick = e => {
    const s = e.target.closest("[data-mode]");
    if (s) { ui.mode = s.dataset.mode; render(app); }
  };
  ({ list: renderList, cards: renderCards, quiz: renderQuiz, compare: renderCompare })[ui.mode](app.querySelector("#mode"));
  updateCounts(app);
}

function seg(key, label) {
  return '<button type="button" role="tab" class="seg" data-mode="' + key + '" aria-selected="' + (ui.mode === key) + '">' + label + "</button>";
}

function updateCounts(app) {
  const items = DB.vocab.items;
  const known = items.filter(v => wordState(v.id).status === "known").length;
  app.querySelector("#known-count").textContent = known;
  app.querySelector("#due-count").textContent = reviewWordIds().length;
  app.querySelector("#known-bar").style.width = (known / items.length * 100) + "%";
  const subs = {
    list: "카드를 누르면 읽는 법, 뜻, 예문, 유의어가 보여요.",
    cards: "기억한 정도를 고르면, 다음 복습 날짜가 자동으로 정해져요.",
    quiz: "틀린 단어는 오답 노트에 저장되고, 오늘 복습할 단어로 들어가요.",
    compare: "뜻이 비슷하거나 읽기가 같은 단어를 나란히 비교해요.",
  };
  app.querySelector("#vocab-sub").textContent = subs[ui.mode];
}

/* ---------- 단어장 ---------- */
function renderList(el) {
  const topics = [...new Set(DB.vocab.items.map(v => v.topic))];
  const usedPos = [...new Set(DB.vocab.items.map(v => v.pos))];
  el.innerHTML =
    '<div class="filters">' +
      '<div class="field search"><label for="v-q">검색</label><input id="v-q" type="search" placeholder="한자, 읽기, 뜻으로 찾기" value="' + esc(ui.q) + '"></div>' +
      '<div class="field"><label for="v-pos">품사</label><select id="v-pos"><option value="">전체</option>' +
        usedPos.map(p => '<option value="' + p + '"' + (ui.pos === p ? " selected" : "") + ">" + esc(POS[p] || p) + "</option>").join("") + "</select></div>" +
      '<div class="field"><label for="v-topic">주제</label><select id="v-topic"><option value="">전체</option>' +
        topics.map(t => '<option' + (ui.topic === t ? " selected" : "") + ">" + esc(t) + "</option>").join("") + "</select></div>" +
    "</div>" +
    '<div class="toolbar">' +
      ["all:전체", "review:복습 필요", "unknown:몰라요", "known:외운 단어", "fav:즐겨찾기"].map(s => {
        const [k, l] = s.split(":");
        return '<button type="button" class="chip" data-status="' + k + '" aria-pressed="' + (ui.status === k) + '">' + l + "</button>";
      }).join("") +
      '<button type="button" class="chip" id="toggle-all" aria-pressed="' + ui.showAll + '">' + (ui.showAll ? "뜻 모두 가리기" : "뜻 모두 보기") + "</button>" +
    "</div>" +
    '<p class="result-count" id="v-count"></p>' +
    '<div class="cards" id="cards"></div>';

  const draw = () => drawCards(el);
  el.querySelector("#v-q").oninput = e => { ui.q = e.target.value.trim(); draw(); };
  el.querySelector("#v-pos").onchange = e => { ui.pos = e.target.value; draw(); };
  el.querySelector("#v-topic").onchange = e => { ui.topic = e.target.value; draw(); };
  el.onclick = e => {
    const st = e.target.closest("[data-status]");
    const face = e.target.closest("[data-word]");
    const act = e.target.closest("[data-act]");
    if (st) {
      ui.status = st.dataset.status;
      el.querySelectorAll("[data-status]").forEach(b => b.setAttribute("aria-pressed", b === st));
    } else if (e.target.closest("#toggle-all")) {
      ui.showAll = !ui.showAll; revealed.clear();
      const t = el.querySelector("#toggle-all");
      t.setAttribute("aria-pressed", ui.showAll);
      t.textContent = ui.showAll ? "뜻 모두 가리기" : "뜻 모두 보기";
    } else if (face) {
      const id = face.dataset.word;
      revealed.has(id) ? revealed.delete(id) : revealed.add(id);
    } else if (act) {
      const id = act.dataset.id, a = act.dataset.act;
      setWord(id, s => {
        if (a === "fav") s.fav = !s.fav;
        if (a === "known") s.status = s.status === "known" ? undefined : "known";
        if (a === "unknown") s.status = s.status === "unknown" ? undefined : "unknown";
      });
      updateCounts(document);
    } else return;
    draw();
  };
  draw();
}

function matches(v) {
  const s = wordState(v.id);
  if (ui.pos && v.pos !== ui.pos) return false;
  if (ui.topic && v.topic !== ui.topic) return false;
  if (ui.status === "known" && s.status !== "known") return false;
  if (ui.status === "unknown" && s.status !== "unknown") return false;
  if (ui.status === "fav" && !s.fav) return false;
  if (ui.status === "review" && !needsReview(v.id)) return false;
  if (ui.q) {
    const hay = [v.word, v.reading, v.meaning, ...(v.synonyms || []), ...(v.collocations || [])].join(" ").toLowerCase();
    if (!hay.includes(ui.q.toLowerCase())) return false;
  }
  return true;
}

function drawCards(el) {
  const list = DB.vocab.items.filter(matches);
  el.querySelector("#v-count").textContent = list.length + "개 단어";
  const cards = el.querySelector("#cards");
  if (!list.length) {
    cards.innerHTML = '<p class="empty">조건에 맞는 단어가 없어요. 검색어나 필터를 바꿔 보세요.</p>';
    return;
  }
  cards.innerHTML = list.map(v => {
    const s = wordState(v.id);
    const open = ui.showAll || revealed.has(v.id);
    const ex = v.examples && v.examples[0];
    const rel = (label, arr) => arr && arr.length ? '<span class="rel"><b>' + label + '</b> <span lang="ja">' + arr.map(esc).join("、") + "</span></span>" : "";
    return '<article class="card' + (s.status === "known" ? " is-known" : "") + '">' +
      (s.status === "known" ? '<span class="seal" aria-hidden="true" lang="ja">済</span>' : "") +
      '<button type="button" class="card-face" data-word="' + v.id + '" aria-expanded="' + open + '">' +
        '<span class="word" lang="ja">' + esc(v.word) + "</span>" +
        (open
          ? '<span class="reading" lang="ja">' + esc(v.reading) + '</span><span class="meaning">' + esc(v.meaning) + "</span>" +
            (ex ? '<span class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + esc(ex.ko) + "</span>" : "") +
            '<span class="rels">' + rel("유의어", v.synonyms) + rel("반의어", v.antonyms) + rel("자주 쓰는 표현", v.collocations) + "</span>" +
            (v.usage ? '<span class="usage">' + esc(v.usage) + "</span>" : "") +
            badges(v)
          : '<span class="hint">눌러서 뜻 보기</span>') +
      "</button>" +
      '<div class="card-meta"><span class="pos">' + esc(POS[v.pos] || v.pos) + " · " + esc(v.topic) + " · " + LEVEL[v.level] + "</span>" +
        (needsReview(v.id) ? '<span class="badge warn">복습 필요</span>' : "") + "</div>" +
      '<div class="card-foot">' +
        '<button type="button" class="mark star" data-act="fav" data-id="' + v.id + '" aria-pressed="' + !!s.fav + '" aria-label="즐겨찾기">' + (s.fav ? "★" : "☆") + "</button>" +
        '<span class="foot-right">' +
          '<button type="button" class="mark unknown" data-act="unknown" data-id="' + v.id + '" aria-pressed="' + (s.status === "unknown") + '">몰라요</button>' +
          '<button type="button" class="mark" data-act="known" data-id="' + v.id + '" aria-pressed="' + (s.status === "known") + '">' + (s.status === "known" ? "외웠어요 ✓" : "외웠어요") + "</button>" +
        "</span>" +
      "</div>" +
    "</article>";
  }).join("");
}

/* ---------- 플래시카드 (간격 반복) ---------- */
let session = null;

function buildSession() {
  const words = store.get("words");
  const due = DB.vocab.items.filter(v => words[v.id] && words[v.id].srs && words[v.id].srs.due <= today());
  const fresh = DB.vocab.items.filter(v => !(words[v.id] && words[v.id].srs)).slice(0, NEW_PER_SESSION);
  return { queue: [...shuffle(due), ...fresh].map(v => v.id), done: 0, flipped: false, total: due.length + fresh.length, dueCount: due.length, newCount: fresh.length };
}

function renderCards(el) {
  if (!session) session = buildSession();
  const draw = () => {
    if (!session.queue.length) {
      el.innerHTML = '<div class="flash-done"><h3>' + (session.total ? "오늘 복습을 마쳤어요" : "지금 복습할 카드가 없어요") + "</h3>" +
        "<p>" + (session.total ? session.done + "장을 복습했어요. 다음 복습 날짜가 된 단어는 이 화면에 다시 나와요." : "모든 단어의 다음 복습 날짜가 아직 오지 않았어요.") + "</p>" +
        '<button type="button" class="btn ghost" id="restart">새 카드로 다시 시작</button></div>';
      el.querySelector("#restart").onclick = () => { session = buildSession(); draw(); };
      return;
    }
    const v = DB.vocab.items.find(x => x.id === session.queue[0]);
    const s = wordState(v.id);
    const card = s.srs || newCard();
    const ex = v.examples && v.examples[0];
    el.innerHTML =
      '<p class="progress">남은 카드 <strong>' + session.queue.length + "</strong> · 복습 " + session.dueCount + " · 새 단어 " + session.newCount + "</p>" +
      '<div class="flash">' +
        '<div class="flash-word" lang="ja">' + esc(v.word) + "</div>" +
        (session.flipped
          ? '<div class="flash-back"><div class="reading" lang="ja">' + esc(v.reading) + '</div><div class="meaning">' + esc(v.meaning) + "</div>" +
            (ex ? '<div class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + esc(ex.ko) + "</div>" : "") + "</div>"
          : '<button type="button" class="btn" id="flip">답 보기</button>') +
      "</div>" +
      (session.flipped
        ? '<div class="grades">' + GRADES.map(g =>
            '<button type="button" class="grade grade-' + g.key + '" data-grade="' + g.key + '"><span>' + g.label + "</span><small>" + preview(card, g.key) + "</small></button>").join("") + "</div>"
        : "");
    const flip = el.querySelector("#flip");
    if (flip) { flip.onclick = () => { session.flipped = true; draw(); }; flip.focus(); }
  };
  el.onclick = e => {
    const g = e.target.closest("[data-grade]");
    if (!g) return;
    const id = session.queue.shift();
    const grade = g.dataset.grade;
    setWord(id, s => {
      s.srs = schedule(s.srs, grade);
      if (grade === "again") s.status = "unknown";
    });
    store.logActivity("cards");
    if (grade === "again") session.queue.push(id);
    session.done++;
    session.flipped = false;
    updateCounts(document);
    draw();
  };
  draw();
}

/* ---------- 퀴즈 ---------- */
function makeGenerated(type, count = 10) {
  const items = DB.vocab.items;
  return shuffle(items).slice(0, Math.min(count, items.length)).map(v => {
    const field = type === "meaning" ? "meaning" : "reading";
    const others = shuffle(items.filter(o => o.id !== v.id && o[field] !== v[field])).slice(0, 3);
    const opts = shuffle([v, ...others]);
    return {
      id: "gen-" + type + "-" + v.id, area: "vocab", generated: true, wordId: v.id,
      kind: type === "meaning" ? "뜻 고르기" : "읽기 고르기",
      prompt: type === "meaning" ? "「" + v.word + "」の意味は？" : "「" + v.word + "」の読み方は？",
      options: opts.map(o => o[field]),
      answer: opts.indexOf(v),
      explanation: "「" + v.word + "」(" + v.reading + ")은 '" + v.meaning + "'라는 뜻이에요.",
      wrongReasons: opts.map(o => o === v ? "" : "「" + o[field] + "」는 「" + o.word + "」의 " + (field === "meaning" ? "뜻" : "읽기") + "예요."),
      source: { type: "ai" }, review: "needs-review",
    };
  });
}

function renderQuiz(el) {
  const types = [["meaning", "무작위 뜻 고르기"], ["reading", "무작위 읽기 고르기"], ["exam", "시험형 문제"]];
  el.innerHTML =
    '<div class="toolbar">' + types.map(([k, l]) =>
      '<button type="button" class="chip" data-qt="' + k + '" aria-pressed="' + (ui.quizType === k) + '">' + l + "</button>").join("") +
      '<span class="score" id="score"></span><button type="button" class="link-btn" id="new-set">새 문제</button>' +
    "</div>" +
    '<p class="hint" id="quiz-note"></p>' +
    '<div class="quiz" id="quiz"></div>';
  const start = () => {
    const qs = ui.quizType === "exam"
      ? DB.vocab.questions.map(q => Object.assign({ area: "vocab" }, q))
      : makeGenerated(ui.quizType);
    el.querySelector("#quiz-note").textContent = ui.quizType === "exam"
      ? "한자 읽기 · 문맥 규정 · 바꿔 말하기 · 용법 유형의 연습문제예요."
      : "단어장에서 무작위로 10개를 뽑아 만든 문제예요. '새 문제'를 누르면 다시 뽑아요.";
    const results = new Map();
    const score = el.querySelector("#score");
    const quiz = el.querySelector("#quiz");
    quiz.innerHTML = "";
    score.textContent = "";
    qs.forEach((q, i) => {
      const box = document.createElement("div");
      quiz.appendChild(box);
      mountQuestion(box, q, {
        number: i + 1,
        onAnswer: ok => {
          results.set(q.id, ok);
          const wid = q.wordId || q.word;
          if (!ok && wid) { markWordWrong(wid); updateCounts(document); }
          score.textContent = [...results.values()].filter(Boolean).length + " / " + qs.length + " 정답";
        },
      });
    });
  };
  el.onclick = e => {
    const t = e.target.closest("[data-qt]");
    if (t) {
      ui.quizType = t.dataset.qt;
      el.querySelectorAll("[data-qt]").forEach(b => b.setAttribute("aria-pressed", b === t));
      start();
    } else if (e.target.closest("#new-set")) start();
  };
  start();
}

/* ---------- 헷갈리는 단어 ---------- */
function renderCompare(el) {
  el.innerHTML = '<div class="compare-list">' + (DB.vocab.confusables || []).map(c =>
    '<article class="compare">' +
      '<div class="compare-head"><h3>' + esc(c.title) + "</h3>" + badges(c) + "</div>" +
      '<div class="compare-cols">' + c.words.map(w =>
        '<div class="compare-col"><div class="word sm" lang="ja">' + esc(w.word) + '</div><div class="reading" lang="ja">' + esc(w.reading) + "</div>" +
        '<div class="meaning">' + esc(w.meaning) + '</div><div class="ex"><span class="jp" lang="ja">' + esc(w.example.ja) + "</span>" + esc(w.example.ko) + "</div></div>").join("") +
      "</div>" +
      '<p class="compare-point"><b>구별 포인트</b> ' + esc(c.point) + "</p>" +
    "</article>").join("") + "</div>";
}

export default { id: "vocab", label: "단어", jp: "語彙", render };
