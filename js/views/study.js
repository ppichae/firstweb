// 단어 · 문법 학습 화면 (N1 방과 N3 방이 같은 화면 구조를 쓴다)
// 기본 자료(data/vocabulary.json · grammar.json)와 PDF 목록 자료(data/n1 · data/n3)를 한 화면에 합쳐서 보여 준다.
// 기록 위치는 그대로 둔다: 기본 단어 → "words", 기본 문법 → "grammar", PDF·N3 목록 → "lists" (방마다 다른 저장소)
import { EXTRA } from "../data.js";
import { esc, badges, shuffle, today } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { GRADES, schedule, preview, newCard } from "../srs.js";
import { listBadges, LIST_POS, buildQuestion } from "./listStudy.js";

const POS = Object.assign({}, LIST_POS, { expression: "표현" });
const LEVEL = { 1: "기본", 2: "중요", 3: "심화" };
const PAGE = 60;
const NEW_PER_SESSION = 10;
const isKana = s => /^[぀-ヿ～ー・]+$/.test(s || "");
const normPattern = s => String(s || "").replace(/[～〜…\s]/g, "").replace(/\(.*?\)|（.*?）/g, "");

/* ---------- 자료 합치기 ---------- */
// 기본 자료와 PDF 목록을 합친다. PDF 목록에서 기본 자료와 겹치는 항목은 숨기고, 기본 항목에 'PDF 목록에도 있음'을 붙인다
function merge(coreItems, extraItems, sameAs) {
  const out = coreItems.map(c => ({ item: c, core: true, also: [] }));
  extraItems.forEach(x => {
    const hit = out.find(o => o.core && sameAs(o.item, x));
    if (hit) hit.also.push(x); else out.push({ item: x, core: false, also: [] });
  });
  return out;
}
const sameWord = (a, b) => a.word === b.word || (a.reading === b.reading && (isKana(a.word) || isKana(b.word)));
const samePattern = (a, b) => normPattern(a.pattern) === normPattern(b.pattern);

function alsoBadge(e) {
  if (!e.also.length) return "";
  const ids = [...new Set(e.also.flatMap(x => (x.sources || []).map(s => s.id)))];
  return '<span class="badge" title="' + esc(ids.join(", ")) + '">PDF 목록에도 있음</span>';
}

function seg(ui, key, label) {
  return '<button type="button" role="tab" class="seg" data-mode="' + key + '" aria-selected="' + (ui.mode === key) + '">' + label + "</button>";
}

function chipRow(attr, list, current) {
  return list.map(([k, l]) => '<button type="button" class="chip" data-' + attr + '="' + k + '" aria-pressed="' + (current === k) + '">' + l + "</button>").join("");
}

/* =========================================================
   단어
   cfg: { id, label, jp, st, core: () => 기본 자료(JSON) | null, extraKey, idPrefix, onEvent, title }
   ========================================================= */
export function createVocabView(cfg) {
  const st = cfg.st;
  const ui = { mode: "list", q: "", pos: "", topic: "", src: "", status: "all", showAll: false, shown: PAGE, quizType: "meaning" };
  const revealed = new Set();
  let session = null;
  let cache = null;

  const coreData = () => (cfg.core ? cfg.core() : null);
  function entries() {
    const core = (coreData() && coreData().items) || [];
    const extra = (EXTRA[cfg.extraKey] && EXTRA[cfg.extraKey].items) || [];
    if (!cache || cache.core !== core || cache.extra !== extra) cache = { core, extra, list: merge(core, extra, sameWord) };
    return cache.list;
  }
  const items = () => entries().map(e => e.item);
  const isCore = id => entries().some(e => e.core && e.item.id === id);
  const bucket = id => (isCore(id) ? "words" : "lists");
  const state = id => st.get(bucket(id))[id] || {};
  const setState = (id, fn) => { const b = bucket(id); st.update(b, w => { fn(w[id] || (w[id] = {})); }); };
  const emit = kind => { if (cfg.onEvent) cfg.onEvent(kind); };

  // 복습이 필요한 단어: 간격 반복 일정이 오늘 이전이거나, '몰라요'로 표시한 단어
  const needsReview = id => { const s = state(id); return s.status === "unknown" || (!!s.srs && s.srs.due <= today()); };
  const reviewWordIds = () => items().filter(v => needsReview(v.id)).map(v => v.id);
  const studiedCount = () => items().filter(v => { const s = state(v.id); return s.srs || s.status; }).length;

  // 퀴즈에서 틀린 단어는 오늘 다시 복습하도록 일정을 당긴다
  function markWordWrong(id) {
    if (!items().some(v => v.id === id)) return;
    setState(id, s => { s.wrong = (s.wrong || 0) + 1; s.srs = Object.assign(newCard(), s.srs, { due: today() }); });
  }

  function render(app) {
    const all = items();
    if (!all.length) {
      app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>단어</h2></div></div><p class="notice">콘텐츠 준비 중이에요. 단어 자료 파일을 불러오지 못했어요.</p></section>';
      return;
    }
    const hasCore = !!coreData();
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>단어</h2><p id="vocab-sub"></p></div>' +
          '<div class="toolbar"><div class="progress"><strong id="known-count">0</strong> / ' + all.length + ' 외움 · 복습 필요 <strong id="due-count">0</strong></div>' +
          '<div class="bar" aria-hidden="true"><span id="known-bar" style="width:0%"></span></div></div></div>' +
        '<div class="segmented" role="tablist" aria-label="단어 학습 방식">' +
          seg(ui, "list", "단어장") + seg(ui, "cards", "플래시카드") + seg(ui, "quiz", "퀴즈") + seg(ui, "compare", "헷갈리는 단어") +
        "</div>" +
        (hasCore ? "" : '<p class="notice">PDF 학습 목록에서 일본어 표기와 읽기만 참고했어요. 한국어 뜻은 AI가 새로 쓴 것이라 <b>검수 필요</b> 상태이고, 예문은 준비 중이에요.</p>') +
        '<div id="mode" class="stack"></div>' +
      "</section>";
    app.onclick = e => {
      const s = e.target.closest("[data-mode]");
      if (s) { ui.mode = s.dataset.mode; render(app); }
    };
    ({ list: renderList, cards: renderCards, quiz: renderQuiz, compare: renderCompare })[ui.mode](app.querySelector("#mode"));
    updateCounts(app);
  }

  function updateCounts(root) {
    const all = items();
    const known = all.filter(v => state(v.id).status === "known").length;
    const kc = root.querySelector("#known-count");
    if (!kc) return;
    kc.textContent = known;
    root.querySelector("#due-count").textContent = reviewWordIds().length;
    root.querySelector("#known-bar").style.width = (known / all.length * 100) + "%";
    const subs = {
      list: "카드를 누르면 읽는 법, 뜻, 예문이 보여요. 기본 단어장과 PDF 목록 단어를 한곳에 모았어요.",
      cards: "기억한 정도를 고르면, 다음 복습 날짜가 자동으로 정해져요.",
      quiz: "틀린 단어는 오답 노트에 저장되고, 오늘 복습할 단어로 들어가요.",
      compare: "뜻이 비슷하거나 읽기가 같은 단어를 나란히 비교해요.",
    };
    root.querySelector("#vocab-sub").textContent = subs[ui.mode];
  }

  /* ---------- 단어장 ---------- */
  function renderList(el) {
    const hasCore = !!coreData();
    const all = entries();
    const usedPos = [...new Set(all.map(e => e.item.pos))];
    const topics = [...new Set(all.filter(e => e.core).map(e => e.item.topic))];
    el.innerHTML =
      '<div class="filters">' +
        '<div class="field search"><label for="v-q">검색</label><input id="v-q" type="search" placeholder="한자, 읽기, 뜻으로 찾기" value="' + esc(ui.q) + '"></div>' +
        '<div class="field"><label for="v-pos">품사</label><select id="v-pos"><option value="">전체</option>' +
          usedPos.map(p => '<option value="' + p + '"' + (ui.pos === p ? " selected" : "") + ">" + esc(POS[p] || p) + "</option>").join("") + "</select></div>" +
        (hasCore
          ? '<div class="field"><label for="v-src">자료</label><select id="v-src"><option value="">전체</option>' +
              '<option value="core"' + (ui.src === "core" ? " selected" : "") + ">기본 단어장</option>" +
              '<option value="pdf"' + (ui.src === "pdf" ? " selected" : "") + ">PDF 목록</option></select></div>" +
            '<div class="field"><label for="v-topic">주제</label><select id="v-topic"><option value="">전체</option>' +
              topics.map(t => "<option" + (ui.topic === t ? " selected" : "") + ">" + esc(t) + "</option>").join("") + "</select></div>"
          : "") +
      "</div>" +
      '<div class="toolbar">' +
        chipRow("status", [["all", "전체"], ["review", "복습 필요"], ["unknown", "몰라요"], ["known", "외운 단어"], ["fav", "즐겨찾기"]], ui.status) +
        '<button type="button" class="chip" id="toggle-all" aria-pressed="' + ui.showAll + '">' + (ui.showAll ? "뜻 모두 가리기" : "뜻 모두 보기") + "</button>" +
      "</div>" +
      '<p class="result-count" id="v-count"></p>' +
      '<div class="cards" id="cards"></div>' +
      '<div class="toolbar" id="v-more"></div>';

    const draw = () => drawCards(el);
    const reset = () => { ui.shown = PAGE; draw(); };
    el.querySelector("#v-q").oninput = e => { ui.q = e.target.value.trim(); reset(); };
    el.querySelector("#v-pos").onchange = e => { ui.pos = e.target.value; reset(); };
    const src = el.querySelector("#v-src"), topic = el.querySelector("#v-topic");
    if (src) src.onchange = e => { ui.src = e.target.value; reset(); };
    if (topic) topic.onchange = e => { ui.topic = e.target.value; reset(); };
    el.onclick = e => {
      const stt = e.target.closest("[data-status]"), face = e.target.closest("[data-word]"), act = e.target.closest("[data-act]");
      if (stt) {
        ui.status = stt.dataset.status; ui.shown = PAGE;
        el.querySelectorAll("[data-status]").forEach(b => b.setAttribute("aria-pressed", b === stt));
      } else if (e.target.closest("#toggle-all")) {
        ui.showAll = !ui.showAll; revealed.clear();
        const t = el.querySelector("#toggle-all");
        t.setAttribute("aria-pressed", ui.showAll);
        t.textContent = ui.showAll ? "뜻 모두 가리기" : "뜻 모두 보기";
      } else if (e.target.closest("#v-more-btn")) {
        ui.shown += PAGE;
      } else if (face) {
        const id = face.dataset.word;
        revealed.has(id) ? revealed.delete(id) : revealed.add(id);
      } else if (act) {
        const id = act.dataset.id, a = act.dataset.act;
        setState(id, s => {
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

  function matches(e) {
    const v = e.item, s = state(v.id);
    if (ui.pos && v.pos !== ui.pos) return false;
    if (ui.src === "core" && !e.core) return false;
    if (ui.src === "pdf" && e.core) return false;
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
    const list = entries().filter(matches);
    el.querySelector("#v-count").textContent = list.length + "개 단어" + (list.length > ui.shown ? " 중 " + ui.shown + "개 표시" : "");
    el.querySelector("#v-more").innerHTML = list.length > ui.shown ? '<button type="button" class="btn ghost" id="v-more-btn">' + Math.min(PAGE, list.length - ui.shown) + "개 더 보기</button>" : "";
    const cards = el.querySelector("#cards");
    if (!list.length) { cards.innerHTML = '<p class="empty">조건에 맞는 단어가 없어요. 검색어나 필터를 바꿔 보세요.</p>'; return; }
    cards.innerHTML = list.slice(0, ui.shown).map(cardHTML).join("");
  }

  function cardHTML(e) {
    const v = e.item, s = state(v.id);
    const open = ui.showAll || revealed.has(v.id);
    const ex = v.examples && v.examples[0];
    const rel = (label, arr) => arr && arr.length ? '<span class="rel"><b>' + label + '</b> <span lang="ja">' + arr.map(esc).join("、") + "</span></span>" : "";
    const meta = e.core ? esc(POS[v.pos] || v.pos) + " · " + esc(v.topic) + " · " + LEVEL[v.level] : esc(POS[v.pos] || v.pos) + " · PDF 목록 · " + esc(v.level);
    return '<article class="card' + (s.status === "known" ? " is-known" : "") + '">' +
      (s.status === "known" ? '<span class="seal" aria-hidden="true" lang="ja">済</span>' : "") +
      '<button type="button" class="card-face" data-word="' + v.id + '" aria-expanded="' + open + '">' +
        '<span class="word" lang="ja">' + esc(v.word) + "</span>" +
        (open
          ? (v.reading && v.reading !== v.word ? '<span class="reading" lang="ja">' + esc(v.reading) + "</span>" : "") +
            '<span class="meaning">' + esc(v.meaning) + "</span>" +
            (ex ? '<span class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + esc(ex.ko) + "</span>" : '<span class="ex">예문 준비 중</span>') +
            (e.core
              ? '<span class="rels">' + rel("유의어", v.synonyms) + rel("반의어", v.antonyms) + rel("자주 쓰는 표현", v.collocations) + "</span>" +
                (v.usage ? '<span class="usage">' + esc(v.usage) + "</span>" : "") +
                badges(v).replace(/<\/span>$/, alsoBadge(e) + "</span>")
              : listBadges(v))
          : '<span class="hint">눌러서 뜻 보기</span>') +
      "</button>" +
      '<div class="card-meta"><span class="pos">' + meta + "</span>" +
        (needsReview(v.id) ? '<span class="badge warn">복습 필요</span>' : "") + "</div>" +
      '<div class="card-foot">' +
        '<button type="button" class="mark star" data-act="fav" data-id="' + v.id + '" aria-pressed="' + !!s.fav + '" aria-label="즐겨찾기">' + (s.fav ? "★" : "☆") + "</button>" +
        '<span class="foot-right">' +
          '<button type="button" class="mark unknown" data-act="unknown" data-id="' + v.id + '" aria-pressed="' + (s.status === "unknown") + '">몰라요</button>' +
          '<button type="button" class="mark" data-act="known" data-id="' + v.id + '" aria-pressed="' + (s.status === "known") + '">' + (s.status === "known" ? "외웠어요 ✓" : "외웠어요") + "</button>" +
        "</span>" +
      "</div>" +
    "</article>";
  }

  /* ---------- 플래시카드 (간격 반복) ---------- */
  function buildSession() {
    const all = items();
    const due = all.filter(v => { const s = state(v.id); return s.srs && s.srs.due <= today(); });
    const fresh = all.filter(v => !state(v.id).srs).slice(0, NEW_PER_SESSION);
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
      const v = items().find(x => x.id === session.queue[0]);
      const card = state(v.id).srs || newCard();
      const ex = v.examples && v.examples[0];
      el.innerHTML =
        '<p class="progress">남은 카드 <strong>' + session.queue.length + "</strong> · 복습 " + session.dueCount + " · 새 단어 " + session.newCount + "</p>" +
        '<div class="flash">' +
          '<div class="flash-word" lang="ja">' + esc(v.word) + "</div>" +
          (session.flipped
            ? '<div class="flash-back">' + (v.reading && v.reading !== v.word ? '<div class="reading" lang="ja">' + esc(v.reading) + "</div>" : "") +
              '<div class="meaning">' + esc(v.meaning) + "</div>" +
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
      setState(id, s => {
        s.srs = schedule(s.srs, grade);
        if (grade === "again") s.status = "unknown";
      });
      st.logActivity("cards");
      emit("card");
      if (grade === "again") session.queue.push(id);
      session.done++;
      session.flipped = false;
      updateCounts(document);
      draw();
    };
    draw();
  }

  /* ---------- 퀴즈 ---------- */
  function renderQuiz(el) {
    const core = coreData();
    const types = [["meaning", "뜻 고르기"], ["reading", "읽기 고르기"], ["reverse", "단어 고르기"]];
    if (core && core.questions && core.questions.length) types.push(["exam", "시험형 문제"]);
    if (!types.some(t => t[0] === ui.quizType)) ui.quizType = "meaning";
    el.innerHTML =
      '<div class="toolbar">' + chipRow("qt", types, ui.quizType) +
        '<span class="score" id="score"></span><button type="button" class="link-btn" id="new-set">새 문제</button>' +
      "</div>" +
      '<p class="hint" id="quiz-note"></p>' +
      '<div class="quiz" id="quiz"></div>';
    const start = () => {
      let qs;
      if (ui.quizType === "exam") qs = core.questions.map(q => Object.assign({ area: "vocab" }, q));
      else {
        let pool = items();
        if (ui.quizType === "reading") pool = pool.filter(v => /[一-鿿々]/.test(v.word) && v.reading);
        qs = shuffle(pool).slice(0, 10).map(v => buildQuestion(v, ui.quizType, { area: "vocab" }, items(), cfg.idPrefix));
      }
      el.querySelector("#quiz-note").innerHTML = ui.quizType === "exam"
        ? "한자 읽기 · 문맥 규정 · 바꿔 말하기 · 용법 유형의 연습문제예요."
        : "단어장에서 무작위로 10개를 뽑아 만든 <b>자체 제작 연습 문제</b>예요. 실제 JLPT 기출문제가 아니에요. '새 문제'를 누르면 다시 뽑아요.";
      const results = new Map();
      const score = el.querySelector("#score");
      const quiz = el.querySelector("#quiz");
      quiz.innerHTML = "";
      score.textContent = "";
      qs.forEach((q, i) => {
        const box = document.createElement("div");
        quiz.appendChild(box);
        mountQuestion(box, q, {
          number: i + 1, store: st,
          onAnswer: ok => {
            results.set(q.id, ok);
            const wid = q.wordId || q.word;
            if (!ok && wid) { markWordWrong(wid); updateCounts(document); }
            emit(ok ? "correct" : "wrong");
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
    const list = (coreData() && coreData().confusables) || [];
    if (!list.length) { el.innerHTML = '<p class="notice">콘텐츠 준비 중이에요. 이 방의 헷갈리는 단어 비교 자료가 아직 없어요.</p>'; return; }
    el.innerHTML = '<div class="compare-list">' + list.map(c =>
      '<article class="compare">' +
        '<div class="compare-head"><h3>' + esc(c.title) + "</h3>" + badges(c) + "</div>" +
        '<div class="compare-cols">' + c.words.map(w =>
          '<div class="compare-col"><div class="word sm" lang="ja">' + esc(w.word) + '</div><div class="reading" lang="ja">' + esc(w.reading) + "</div>" +
          '<div class="meaning">' + esc(w.meaning) + '</div><div class="ex"><span class="jp" lang="ja">' + esc(w.example.ja) + "</span>" + esc(w.example.ko) + "</div></div>").join("") +
        "</div>" +
        '<p class="compare-point"><b>구별 포인트</b> ' + esc(c.point) + "</p>" +
      "</article>").join("") + "</div>";
  }

  // 다른 화면에서 특정 학습 방식(예: 플래시카드)으로 바로 열 때
  function openMode(mode) {
    ui.mode = mode;
    if (mode === "cards") session = null;   // 최신 복습 목록으로 다시 만든다
    if (location.hash === "#" + cfg.id) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = cfg.id;
  }

  return {
    view: { id: cfg.id, label: cfg.label || "단어", jp: cfg.jp || "語彙", needs: [cfg.extraKey, "sources"], render },
    needsReview, reviewWordIds, markWordWrong, openMode, studiedCount, total: () => items().length,
  };
}

/* =========================================================
   문법: '문법 학습' · '플래시카드' · '문법 퀴즈' 탭
   cfg: { id, label, jp, st, core: () => 기본 자료(JSON) | null, extraKey, idPrefix, onEvent }
   ========================================================= */
export function createGrammarView(cfg) {
  const st = cfg.st;
  const ui = { mode: "learn", q: "", src: "", filter: "all", shown: PAGE, quiz: null, scope: "all", open: new Set() };
  let session = null;
  let cache = null;

  const coreData = () => (cfg.core ? cfg.core() : null);
  function entries() {
    const core = (coreData() && coreData().items) || [];
    const extra = (EXTRA[cfg.extraKey] && EXTRA[cfg.extraKey].items) || [];
    if (!cache || cache.core !== core || cache.extra !== extra) cache = { core, extra, list: merge(core, extra, samePattern) };
    return cache.list;
  }
  const items = () => entries().map(e => e.item);
  const isCore = id => entries().some(e => e.core && e.item.id === id);
  const bucket = id => (isCore(id) ? "grammar" : "lists");
  const state = id => st.get(bucket(id))[id] || {};
  const setState = (id, fn) => { const b = bucket(id); st.update(b, g => { fn(g[id] || (g[id] = {})); }); };
  const emit = kind => { if (cfg.onEvent) cfg.onEvent(kind); };
  const studiedCount = () => items().filter(g => state(g.id).studied).length;

  function render(app) {
    const all = items();
    if (!all.length) {
      app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>문법</h2></div></div><p class="notice">콘텐츠 준비 중이에요. 문법 자료 파일을 불러오지 못했어요.</p></section>';
      return;
    }
    const subs = {
      learn: "문형을 펼치면 상세 설명과 예문이 나와요. 기본 문법과 PDF 목록 문형을 한곳에 모았어요.",
      cards: "문형을 보고 뜻을 떠올린 뒤, 기억한 정도를 골라요.",
      quiz: "이 방의 문법 범위에서 문제를 풀어요. 틀린 문제는 오답 노트에 저장돼요.",
    };
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>문법</h2><p>' + subs[ui.mode] + "</p></div>" +
          '<div class="toolbar"><div class="progress">공부한 문법 <strong id="g-studied">' + studiedCount() + "</strong> / " + all.length + "</div>" +
          '<div class="bar" aria-hidden="true"><span id="g-bar" style="width:' + (studiedCount() / all.length * 100) + '%"></span></div></div></div>' +
        '<div class="segmented" role="tablist" aria-label="문법 학습 방식">' +
          seg(ui, "learn", "문법 학습") + seg(ui, "cards", "플래시카드") + seg(ui, "quiz", "문법 퀴즈") +
        "</div>" +
        (coreData() ? "" : '<p class="notice">PDF 학습 목록에서 문형 표기만 참고했어요. 뜻은 AI가 새로 쓴 것이라 <b>검수 필요</b> 상태이고, 접속 형태와 예문은 준비 중이에요.</p>') +
        '<div id="mode" class="stack"></div>' +
      "</section>";
    app.onclick = e => {
      const s = e.target.closest("[data-mode]");
      if (s) { ui.mode = s.dataset.mode; render(app); }
    };
    // 펼친 상태를 기억해서 다시 그려도 유지한다 (한 번만 등록)
    if (!app.dataset.gToggle) {
      app.dataset.gToggle = "1";
      app.addEventListener("toggle", e => {
        const d = e.target.closest && e.target.closest("details.g-more[data-id]");
        if (d && d.dataset.owner === cfg.id) d.open ? ui.open.add(d.dataset.id) : ui.open.delete(d.dataset.id);
      }, true);
    }
    ({ learn: renderLearn, cards: renderCards, quiz: renderQuiz })[ui.mode](app.querySelector("#mode"), app);
  }

  function updateStudied(app) {
    const n = studiedCount();
    const s = app.querySelector("#g-studied"), b = app.querySelector("#g-bar");
    if (s) s.textContent = n;
    if (b) b.style.width = (n / items().length * 100) + "%";
  }

  /* ---------- 문법 학습 ---------- */
  function renderLearn(el, app) {
    el.innerHTML =
      '<div class="filters">' +
        '<div class="field search"><label for="g-q">검색</label><input id="g-q" type="search" placeholder="문형이나 뜻으로 찾기" value="' + esc(ui.q) + '"></div>' +
        (coreData()
          ? '<div class="field"><label for="g-src">자료</label><select id="g-src"><option value="">전체</option>' +
              '<option value="core"' + (ui.src === "core" ? " selected" : "") + ">기본 문법</option>" +
              '<option value="pdf"' + (ui.src === "pdf" ? " selected" : "") + ">PDF 목록</option></select></div>"
          : "") +
      "</div>" +
      '<div class="toolbar">' + chipRow("gfilter", [["all", "전체"], ["todo", "아직 안 함"], ["studied", "공부함"], ["fav", "즐겨찾기"]], ui.filter) + "</div>" +
      '<p class="result-count" id="g-count"></p>' +
      '<div class="grammar-list" id="g-list"></div>' +
      '<div class="toolbar" id="g-more"></div>' +
      '<div class="toolbar"><button type="button" class="btn ghost" id="to-quiz">이 범위로 문법 퀴즈 풀기</button></div>';
    const draw = () => drawList(el, app);
    el.querySelector("#g-q").oninput = e => { ui.q = e.target.value.trim(); ui.shown = PAGE; draw(); };
    const src = el.querySelector("#g-src");
    if (src) src.onchange = e => { ui.src = e.target.value; ui.shown = PAGE; draw(); };
    el.onclick = e => {
      const f = e.target.closest("[data-gfilter]"), act = e.target.closest("[data-gact]");
      if (f) {
        ui.filter = f.dataset.gfilter; ui.shown = PAGE;
        el.querySelectorAll("[data-gfilter]").forEach(b => b.setAttribute("aria-pressed", b === f));
      } else if (e.target.closest("#g-more-btn")) ui.shown += PAGE;
      else if (act) {
        setState(act.dataset.id, s => {
          if (act.dataset.gact === "fav") s.fav = !s.fav;
          if (act.dataset.gact === "studied") s.studied = s.studied ? undefined : today();
        });
        updateStudied(app);
      } else if (e.target.closest("#to-quiz")) {
        ui.mode = "quiz";
        ui.scope = ui.filter === "studied" ? "studied" : ui.filter === "fav" ? "fav" : "all";
        render(app); return;
      } else return;
      draw();
    };
    draw();
  }

  function matches(e) {
    const g = e.item, s = state(g.id);
    if (ui.src === "core" && !e.core) return false;
    if (ui.src === "pdf" && e.core) return false;
    if (ui.filter === "studied" && !s.studied) return false;
    if (ui.filter === "todo" && s.studied) return false;
    if (ui.filter === "fav" && !s.fav) return false;
    if (ui.q && ![g.pattern, g.reading, g.meaning, g.connection].join(" ").includes(ui.q)) return false;
    return true;
  }

  function drawList(el) {
    const list = entries().filter(matches);
    el.querySelector("#g-count").textContent = list.length + "개 문형" + (list.length > ui.shown ? " 중 " + ui.shown + "개 표시" : "");
    el.querySelector("#g-more").innerHTML = list.length > ui.shown ? '<button type="button" class="btn ghost" id="g-more-btn">' + Math.min(PAGE, list.length - ui.shown) + "개 더 보기</button>" : "";
    const box = el.querySelector("#g-list");
    if (!list.length) { box.innerHTML = '<p class="empty">조건에 맞는 문법이 없어요.</p>'; return; }
    box.innerHTML = list.slice(0, ui.shown).map(itemHTML).join("");
  }

  function itemHTML(e) {
    const g = e.item, s = state(g.id);
    const ex = g.examples && g.examples[0];
    const more = e.core
      ? "<dl>" +
          "<div><dt>상세 설명</dt><dd>" + esc(g.explanation) + "</dd></div>" +
          (g.examples.length > 1 ? "<div><dt>예문 더 보기</dt><dd>" + g.examples.slice(1).map(x =>
            '<span class="jp block" lang="ja">' + esc(x.ja) + '</span><span class="ko block">' + esc(x.ko) + "</span>").join("") + "</dd></div>" : "") +
          (g.similar && g.similar.length ? "<div><dt>유사 문법과의 차이</dt><dd>" + g.similar.map(x =>
            '<span class="block"><b lang="ja">' + esc(x.pattern) + "</b> — " + esc(x.difference) + "</span>").join("") + "</dd></div>" : "") +
          (g.caution ? "<div><dt>사용 시 주의사항</dt><dd>" + esc(g.caution) + "</dd></div>" : "") +
          (g.examPoint ? "<div><dt>시험에서 이렇게 물어볼 수 있어요</dt><dd>" + esc(g.examPoint) + "</dd></div>" : "") +
        "</dl>" + badges(g).replace(/<\/span>$/, alsoBadge(e) + "</span>")
      : "<dl><div><dt>설명 · 접속 형태 · 예문</dt><dd>준비 중이에요.</dd></div>" +
          "<div><dt>실린 목록</dt><dd>" + listBadges(g) + "</dd></div></dl>";
    return '<div class="g-item" id="' + g.id + '">' +
      '<div><div class="g-pattern" lang="ja">' + esc(g.pattern) + "</div>" +
        (g.reading && !e.core ? '<div class="g-conn" lang="ja">' + esc(g.reading) + "</div>" : "") +
        '<div class="g-actions">' +
          '<button type="button" class="mark star" data-gact="fav" data-id="' + g.id + '" aria-pressed="' + !!s.fav + '" aria-label="즐겨찾기">' + (s.fav ? "★" : "☆") + "</button>" +
          '<button type="button" class="mark" data-gact="studied" data-id="' + g.id + '" aria-pressed="' + !!s.studied + '">' + (s.studied ? "공부했어요 ✓" : "공부했어요") + "</button>" +
        "</div></div>" +
      '<div class="g-body"><div class="g-mean">' + esc(g.meaning) + "</div>" +
        (e.core ? '<div class="g-conn">접속 · ' + esc(g.connection) + "</div>" : '<div class="g-conn">PDF 목록 · ' + esc(g.level) + "</div>") +
        (ex ? '<div class="g-ex"><span class="jp" lang="ja">' + esc(ex.ja) + '</span><span class="ko">' + esc(ex.ko) + "</span></div>" : "") +
        '<details class="g-more" data-owner="' + cfg.id + '" data-id="' + g.id + '"' + (ui.open.has(g.id) ? " open" : "") + "><summary>자세히 보기</summary>" + more + "</details>" +
      "</div></div>";
  }

  /* ---------- 플래시카드 ---------- */
  function buildSession() {
    const all = items();
    const due = all.filter(g => { const s = state(g.id); return s.srs && s.srs.due <= today(); });
    const fresh = all.filter(g => !state(g.id).srs).slice(0, NEW_PER_SESSION);
    return { queue: [...shuffle(due), ...fresh].map(g => g.id), done: 0, flipped: false, total: due.length + fresh.length, dueCount: due.length, newCount: fresh.length };
  }

  function renderCards(el) {
    if (!session) session = buildSession();
    const draw = () => {
      if (!session.queue.length) {
        el.innerHTML = '<div class="flash-done"><h3>' + (session.total ? "오늘 복습을 마쳤어요" : "지금 복습할 카드가 없어요") + "</h3>" +
          "<p>" + (session.total ? session.done + "장을 복습했어요." : "모든 문형의 다음 복습 날짜가 아직 오지 않았어요.") + "</p>" +
          '<button type="button" class="btn ghost" id="restart">새 카드로 다시 시작</button></div>';
        el.querySelector("#restart").onclick = () => { session = buildSession(); draw(); };
        return;
      }
      const g = items().find(x => x.id === session.queue[0]);
      const card = state(g.id).srs || newCard();
      const ex = g.examples && g.examples[0];
      el.innerHTML =
        '<p class="progress">남은 카드 <strong>' + session.queue.length + "</strong> · 복습 " + session.dueCount + " · 새 문형 " + session.newCount + "</p>" +
        '<div class="flash"><div class="flash-word sm" lang="ja">' + esc(g.pattern) + "</div>" +
          (session.flipped
            ? '<div class="flash-back"><div class="meaning">' + esc(g.meaning) + "</div>" +
              (g.connection ? '<div class="g-conn">접속 · ' + esc(g.connection) + "</div>" : "") +
              (ex ? '<div class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + esc(ex.ko) + "</div>" : "") + "</div>"
            : '<button type="button" class="btn" id="flip">답 보기</button>') +
        "</div>" +
        (session.flipped
          ? '<div class="grades">' + GRADES.map(gr =>
              '<button type="button" class="grade grade-' + gr.key + '" data-grade="' + gr.key + '"><span>' + gr.label + "</span><small>" + preview(card, gr.key) + "</small></button>").join("") + "</div>"
          : "");
      const flip = el.querySelector("#flip");
      if (flip) { flip.onclick = () => { session.flipped = true; draw(); }; flip.focus(); }
    };
    el.onclick = e => {
      const gr = e.target.closest("[data-grade]");
      if (!gr) return;
      const id = session.queue.shift();
      setState(id, s => { s.srs = schedule(s.srs, gr.dataset.grade); });
      st.logActivity("cards");
      emit("card");
      if (gr.dataset.grade === "again") session.queue.push(id);
      session.done++;
      session.flipped = false;
      draw();
    };
    draw();
  }

  /* ---------- 문법 퀴즈 ---------- */
  function renderQuiz(el) {
    const core = coreData();
    const coreQs = (core && core.questions) || [];
    const types = [["meaning", "뜻 고르기"], ["reverse", "문형 고르기"]];
    if (coreQs.length) types.unshift(["exam", "시험형 문제"]);
    if (!types.some(t => t[0] === ui.quiz)) ui.quiz = types[0][0];
    const kinds = [...new Set(coreQs.map(q => q.kind))];
    if (ui.quiz === "exam" && ui.scope !== "all" && !kinds.includes(ui.scope)) ui.scope = "all";
    if (ui.quiz !== "exam" && kinds.includes(ui.scope)) ui.scope = "all";
    const scopes = ui.quiz === "exam"
      ? [["all", "전체 유형"], ...kinds.map(k => [k, k])]
      : [["all", "전체 문형"], ["studied", "공부한 문형"], ["fav", "즐겨찾기"]];
    el.innerHTML =
      '<div class="toolbar">' + chipRow("gq", types, ui.quiz) + "</div>" +
      '<div class="toolbar"><span class="hint">범위</span>' + chipRow("gscope", scopes, ui.scope) + "</div>" +
      '<div class="toolbar"><span class="score" id="score"></span><button type="button" class="link-btn" id="reset">' + (ui.quiz === "exam" ? "다시 풀기" : "새 문제") + "</button></div>" +
      '<p class="hint" id="gq-note"></p>' +
      '<div class="quiz" id="quiz"></div>';
    const start = () => {
      let qs;
      const note = el.querySelector("#gq-note");
      if (ui.quiz === "exam") {
        qs = coreQs.filter(q => ui.scope === "all" || q.kind === ui.scope).map(q => Object.assign({ area: "grammar" }, q));
        note.textContent = "빈칸 채우기 · 문장 배열 · 문맥 · 유사 문법 구별 유형의 연습문제예요.";
      } else {
        const pool = items().filter(g => ui.scope === "all" || (ui.scope === "studied" ? state(g.id).studied : state(g.id).fav));
        qs = shuffle(pool).slice(0, 10).map(g => buildQuestion(g, ui.quiz, { area: "grammar" }, items(), cfg.idPrefix));
        note.innerHTML = pool.length
          ? "선택한 범위의 문형 " + pool.length + "개에서 " + Math.min(10, pool.length) + "개를 뽑아 만든 <b>자체 제작 연습 문제</b>예요. 실제 JLPT 기출문제가 아니에요."
          : "이 범위에 문형이 없어요. '문법 학습'에서 공부했어요·즐겨찾기를 표시하거나 '전체 문형'을 골라 주세요.";
      }
      const results = new Map();
      const score = el.querySelector("#score");
      const quiz = el.querySelector("#quiz");
      quiz.innerHTML = "";
      score.textContent = "";
      qs.forEach((q, i) => {
        const box = document.createElement("div");
        quiz.appendChild(box);
        mountQuestion(box, q, {
          number: i + 1, store: st,
          onAnswer: ok => {
            results.set(q.id, ok);
            emit(ok ? "correct" : "wrong");
            score.textContent = [...results.values()].filter(Boolean).length + " / " + qs.length + " 정답";
          },
        });
      });
    };
    el.onclick = e => {
      const t = e.target.closest("[data-gq]"), s = e.target.closest("[data-gscope]");
      if (t) { ui.quiz = t.dataset.gq; renderQuiz(el); }
      else if (s) { ui.scope = s.dataset.gscope; renderQuiz(el); }
      else if (e.target.closest("#reset")) start();
    };
    start();
  }

  return {
    view: { id: cfg.id, label: cfg.label || "문법", jp: cfg.jp || "文法", needs: [cfg.extraKey, "sources"], render },
    studiedCount, total: () => items().length,
  };
}
