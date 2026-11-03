// 단어 · 문법 학습 화면 (N1 방과 N3 방이 같은 화면 구조를 쓴다)
// 기본 자료(data/vocabulary.json · grammar.json)와 PDF 목록 자료(data/n1 · data/n3)를 한 화면에 합쳐서 보여 준다.
// 기록 위치는 그대로 둔다: 기본 단어 → "words", 기본 문법 → "grammar", PDF·N3 목록 → "lists" (방마다 다른 저장소)
import { EXTRA } from "../data.js";
import { esc, badges, shuffle, today } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { runQuiz } from "../quizRunner.js";
import { GRADES, schedule, preview, newCard, SRS_HELP } from "../srs.js";
import { LIST_POS, buildQuestion, blankOf, blankText, mixedQuestion, quizProgress } from "./listStudy.js";
import { kanjiRowHTML, handleKanjiClick } from "../kanji.js";
import { examplesFor, exampleHTML, plainOf, EXAMPLE_KEYS, furiToggleHTML } from "../examples.js";
import { sayBtn } from "../speech.js";
import { pickItems } from "../pick.js";

// 문형을 소리로 읽을 글: 〜 기호는 빼고, 「A／B」처럼 여러 형태면 첫 번째만
const patternSpeech = p => String(p || "").replace(/[〜～~]/g, "").split(/[／/]/)[0].trim();

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

function seg(ui, key, label) {
  return '<button type="button" role="tab" class="seg" data-mode="' + key + '" aria-selected="' + (ui.mode === key) + '">' + label + "</button>";
}

// 퀴즈: 한 번에 풀 문제 수와 지금까지 풀어 본 정도
const QUIZ_COUNTS = [["10", "10문제"], ["20", "20문제"], ["30", "30문제"]];
const progressText = (p, noun) => noun + " " + p.items.toLocaleString() + "개 중 " + p.doneItems.toLocaleString() + "개 풀어 봄 · 문제 " + p.questions.toLocaleString() + "개 중 " + p.doneQuestions.toLocaleString() + "개 풀어 봄";

function chipRow(attr, list, current) {
  return list.map(([k, l]) => '<button type="button" class="chip" data-' + attr + '="' + k + '" aria-pressed="' + (current === k) + '">' + l + "</button>").join("");
}

/* =========================================================
   단어
   cfg: { id, label, jp, st, core: () => 기본 자료(JSON) | null, extraKey, idPrefix, onEvent, title }
   ========================================================= */
export function createVocabView(cfg) {
  const st = cfg.st;
  const ui = { mode: "list", q: "", pos: "", topic: "", src: "", status: "all", showAll: false, shown: PAGE, quizType: "mix", count: "10" };
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
  const emit = (kind, key) => { if (cfg.onEvent) cfg.onEvent(kind, key); };   // key: 하루 한 번만 경험치를 주기 위한 항목 id

  // 복습이 필요한 단어: 간격 반복 일정이 오늘 이전이거나, '몰라요'로 표시한 단어
  const needsReview = id => { const s = state(id); return s.status === "unknown" || (!!s.srs && s.srs.due <= today()); };
  const reviewWordIds = () => items().filter(v => needsReview(v.id)).map(v => v.id);
  // 학습한 단어: '외웠어요'를 눌렀거나, 퀴즈에서 맞혔거나, 카드에서 '알았어요·쉬워요'를 고른 단어 (같은 단어는 1개로 센다)
  // 단어를 열어 보기만 했거나, 틀렸거나, '몰라요'만 누른 단어는 세지 않는다
  const rightIds = () => new Set(st.get("attempts").filter(a => a.correct && a.area === "vocab" && a.snap && a.snap.wordId).map(a => a.snap.wordId));
  const isStudied = (s, right, id) => s.status === "known" || s.right > 0 || !!s.cardOk || right.has(id);
  const studiedCount = () => { const r = rightIds(); return items().filter(v => isStudied(state(v.id), r, v.id)).length; };
  // 공부 중인 단어: 기록(카드·퀴즈·표시)은 있지만 아직 학습한 단어 기준에는 못 미친 단어
  const touchedCount = () => { const r = rightIds(); return items().filter(v => { const s = state(v.id); return (s.srs || s.status || s.wrong) && !isStudied(s, r, v.id); }).length; };

  // 퀴즈에서 틀린 단어는 오늘 다시 복습하도록 일정을 당긴다
  function markWordWrong(id) {
    if (!items().some(v => v.id === id)) return;
    setState(id, s => { s.wrong = (s.wrong || 0) + 1; s.srs = Object.assign(newCard(), s.srs, { due: today() }); });
  }

  function render(app) {
    const all = items();
    if (!all.length) {
      app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>단어</h2></div></div><p class="notice">자료를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요. 단어 자료 파일을 불러오지 못했어요.</p></section>';
      return;
    }
    const hasCore = !!coreData();
    if (ui.mode === "compare" && !(hasCore && (coreData().confusables || []).length)) ui.mode = "list";
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>단어</h2></div>' +
          '<div class="toolbar"><div class="progress"><strong id="known-count">0</strong> / ' + all.length + ' 외움 · 복습 필요 <strong id="due-count">0</strong></div>' +
          '<div class="bar" aria-hidden="true"><span id="known-bar" style="width:0%"></span></div></div></div>' +
        '<div class="segmented" role="tablist" aria-label="단어 학습 방식">' +
          seg(ui, "list", "단어장") + seg(ui, "cards", "플래시카드") + seg(ui, "quiz", "퀴즈") + ((coreData() && (coreData().confusables || []).length) ? seg(ui, "compare", "헷갈리는 단어") : "") +
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

  function updateCounts(root) {
    const all = items();
    const known = all.filter(v => state(v.id).status === "known").length;
    const kc = root.querySelector("#known-count");
    if (!kc) return;
    kc.textContent = known;
    root.querySelector("#due-count").textContent = reviewWordIds().length;
    root.querySelector("#known-bar").style.width = (known / all.length * 100) + "%";
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
              '<option value="pdf"' + (ui.src === "pdf" ? " selected" : "") + ">참고 목록 단어</option></select></div>" +
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
      if (handleKanjiClick(e, cfg.roomId)) return;
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
    el.querySelector("#v-count").textContent = list.length + "개 단어" + (list.length > ui.shown ? " 중 " + ui.shown + "개 표시" : "") + " · 단어를 누르면 뜻이 보여요";
    el.querySelector("#v-more").innerHTML = list.length > ui.shown ? '<button type="button" class="btn ghost" id="v-more-btn">' + Math.min(PAGE, list.length - ui.shown) + "개 더 보기</button>" : "";
    const cards = el.querySelector("#cards");
    if (!list.length) { cards.innerHTML = '<p class="empty">조건에 맞는 단어가 없어요. 검색어나 필터를 바꿔 보세요.</p>'; return; }
    cards.innerHTML = list.slice(0, ui.shown).map(cardHTML).join("");
  }

  function cardHTML(e) {
    const v = e.item, s = state(v.id);
    const open = ui.showAll || revealed.has(v.id);
    const ex = examplesFor(v.id)[0] ? null : v.examples && v.examples[0];   // 읽기가 붙은 예문이 있으면 그것을 보여 준다
    const rel = (label, arr) => arr && arr.length ? '<span class="rel"><b>' + label + '</b> <span lang="ja">' + arr.map(esc).join("、") + "</span></span>" : "";
    return '<article class="card' + (s.status === "known" ? " is-known" : "") + '">' +
      (s.status === "known" ? '<span class="seal" aria-hidden="true" lang="ja">済</span>' : "") +
      '<button type="button" class="card-face" data-word="' + v.id + '" aria-expanded="' + open + '">' +
        '<span class="word" lang="ja">' + esc(v.word) + "</span>" +
        (open
          ? sayBtn(v.reading || v.word, "단어 발음 듣기") + (v.reading && v.reading !== v.word ? '<span class="reading" lang="ja">' + esc(v.reading) + "</span>" : "") +
            '<span class="meaning">' + esc(v.meaning) + "</span>" +
            (ex ? '<span class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + sayBtn(ex.ja, "예문 듣기") + esc(ex.ko) + "</span>" : (examplesFor(v.id)[0] ? '<span class="ex">' + exampleHTML(examplesFor(v.id)[0], false) + "</span>" : "")) +
            (e.core ? '<span class="rels">' + rel("유의어", v.synonyms) + rel("반의어", v.antonyms) + rel("자주 쓰는 표현", v.collocations) + "</span>" +
                (v.usage ? '<span class="usage">' + esc(v.usage) + "</span>" : "") : "")
          : "") +
      "</button>" +
      // 접혀 있을 때는 단어와 버튼만 보여 주고, 품사·한자는 펼쳤을 때 보여 준다
      (open || needsReview(v.id) ? '<div class="card-meta">' + (open ? '<span class="pos">' + esc(POS[v.pos] || v.pos) + "</span>" : "") +
        (needsReview(v.id) ? '<span class="badge warn">복습 필요</span>' : "") + "</div>" : "") +
      (open ? kanjiRowHTML(v.word, v.reading) : "") +
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
      const ex = examplesFor(v.id)[0] ? null : v.examples && v.examples[0];
      el.innerHTML =
        '<p class="progress">남은 카드 <strong>' + session.queue.length + "</strong> · 복습 " + session.dueCount + " · 새 단어 " + session.newCount + "</p>" +
        '<div class="flash">' +
          '<div class="flash-word" lang="ja">' + esc(v.word) + "</div>" +
          (session.flipped
            ? '<div class="flash-back">' + (v.reading && v.reading !== v.word ? '<div class="reading" lang="ja">' + esc(v.reading) + " " + sayBtn(v.reading, "단어 발음 듣기") + "</div>" : '<div>' + sayBtn(v.word, "단어 발음 듣기") + "</div>") +
              '<div class="meaning">' + esc(v.meaning) + "</div>" +
              (ex ? '<div class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + sayBtn(ex.ja, "예문 듣기") + esc(ex.ko) + "</div>" : (examplesFor(v.id)[0] ? '<div class="ex">' + exampleHTML(examplesFor(v.id)[0], false) + "</div>" : "")) + kanjiRowHTML(v.word, v.reading) + "</div>"
            : '<button type="button" class="btn" id="flip">답 보기</button>') +
        "</div>" +
        (session.flipped
          ? '<div class="grades">' + GRADES.map(g =>
              '<button type="button" class="grade grade-' + g.key + '" data-grade="' + g.key + '"><span>' + g.label + "</span><small>" + preview(card, g.key) + "</small></button>").join("") + "</div>" + '<p class="hint srs-help">' + SRS_HELP + "</p>"
          : "");
      const flip = el.querySelector("#flip");
      if (flip) { flip.onclick = () => { session.flipped = true; draw(); }; flip.focus(); }
    };
    el.onclick = e => {
      if (handleKanjiClick(e, cfg.roomId)) return;
      const g = e.target.closest("[data-grade]");
      if (!g) return;
      const id = session.queue.shift();
      const grade = g.dataset.grade;
      setState(id, s => {
        s.srs = schedule(s.srs, grade);
        if (grade === "again") s.status = "unknown";
        if (grade === "good" || grade === "easy") s.cardOk = today();
      });
      st.logActivity("cards");
      st.logActivity("words");
      emit("card", id);
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
    const coreQs = (core && core.questions) || [];
    const types = [["mix", "전체 섞기"], ["blank", "문장 빈칸"], ["meaning", "뜻 고르기"], ["reading", "읽기 고르기"], ["reverse", "단어 고르기"]];
    if (coreQs.length) types.push(["exam", "시험형 문제"]);
    if (!types.some(t => t[0] === ui.quizType)) ui.quizType = "mix";
    el.innerHTML =
      '<div class="toolbar">' + chipRow("qt", types, ui.quizType) + "</div>" +
      '<div class="toolbar"><span class="hint">한 번에</span>' + chipRow("qc", QUIZ_COUNTS, ui.count) +
        furiToggleHTML() +
        '<button type="button" class="link-btn" id="new-set">새 문제</button>' +
      "</div>" +
      '<p class="quiz-progress" id="quiz-progress" role="status"></p>' +
      '<div class="quiz" id="quiz"></div>';
    const fixedIds = coreQs.map(q => q.id);
    const showProgress = () => { el.querySelector("#quiz-progress").textContent = progressText(quizProgress(items(), st.get("attempts"), fixedIds), "단어"); };
    const start = () => {
      let qs;
      const n = Number(ui.count);
      if (ui.quizType === "exam") qs = coreQs.map(q => Object.assign({ area: "vocab" }, q));
      else {
        const set = { area: "vocab" }, attempts = st.get("attempts");
        let pool = items();
        if (ui.quizType === "reading") pool = pool.filter(v => /[一-鿿々]/.test(v.word) && v.reading);
        if (ui.quizType === "blank") pool = pool.filter(blankOf);
        // 틀린 단어·처음 보는 단어·오래전에 맞힌 단어를 섞고, 최근 퀴즈에 나온 단어는 되도록 피한다 (pick.js)
        const picked = pickItems(pool, n, { attempts, weak: v => (state(v.id).wrong || 0) > 0 && state(v.id).status !== "known" });
        const tried = new Set(attempts.map(a => a.qid));
        qs = picked.map(v => ui.quizType === "mix" ? mixedQuestion(v, set, items(), cfg.idPrefix, tried) : buildQuestion(v, ui.quizType, set, items(), cfg.idPrefix));
      }
      showProgress();
      // 한 문제씩 풀고, 답한 뒤에는 그 단어의 학습 정보(읽기·뜻·예문·헷갈린 단어)를 보여 준다
      runQuiz(el.querySelector("#quiz"), qs.map(q => ({ q, extra: vocabExtra })), {
        store: st, label: "문제", onRestart: start, restartLabel: ui.quizType === "exam" ? "처음부터 다시" : "새 문제 " + n + "개",
        onAnswer: (it, ok) => {
          const wid = it.q.wordId || it.q.word;
          st.logActivity("words");
          if (ok && wid && items().some(v => v.id === wid)) setState(wid, s => { s.right = (s.right || 0) + 1; });
          if (!ok && wid) { markWordWrong(wid); updateCounts(document); }
          emit(ok ? "correct" : "wrong", it.q.id);
          showProgress();
        },
      });
    };
    el.onclick = e => {
      const t = e.target.closest("[data-qt]"), c = e.target.closest("[data-qc]");
      if (t) {
        ui.quizType = t.dataset.qt;
        el.querySelectorAll("[data-qt]").forEach(b => b.setAttribute("aria-pressed", b === t));
        start();
      } else if (c) {
        ui.count = c.dataset.qc;
        el.querySelectorAll("[data-qc]").forEach(b => b.setAttribute("aria-pressed", b === c));
        start();
      } else if (e.target.closest("#new-set")) start();
    };
    start();
  }

  /* ---------- 답한 뒤 보여 주는 단어 학습 정보 ---------- */
  const wordLine = v => '<div class="lb-word"><b lang="ja">' + esc(v.word) + "</b>" + sayBtn(v.reading || v.word, "단어 발음 듣기") +
    (v.reading && v.reading !== v.word ? ' <span class="reading" lang="ja">' + esc(v.reading) + "</span>" : "") +
    ' <span class="lb-mean">' + esc(v.meaning) + '</span> <small class="hint">' + esc(POS[v.pos] || v.pos || "") + "</small></div>";

  // 고른 보기(뜻·읽기·표기)가 어느 단어의 것인지 찾는다
  const ownerOf = text => items().find(x => x.meaning === text || x.word === text || x.reading === text);

  function vocabExtra(q, picked) {
    const all = items();
    const v = all.find(x => x.id === q.wordId) || all.find(x => x.id === q.word);
    if (!v) return "";
    // 읽기가 붙은 예문(읽기·쓰임 설명 포함)이 있으면 그것을 먼저, 같은 문장의 기본 예문은 빼고 보여 준다
    const own = examplesFor(v.id).slice(0, 1);
    const exs = (v.examples || []).filter(x => !own.some(e => plainOf(e.ja) === x.ja)).slice(0, own.length ? 1 : 2);
    const rel = (label, arr) => (arr && arr.length ? '<div class="lb-row"><span class="lb-label">' + label + '</span><span lang="ja">' + arr.map(esc).join("、") + "</span></div>" : "");
    let wrongPart = "";
    if (picked !== null && picked !== undefined && picked !== q.answer) {
      const o = ownerOf(q.options[picked]);
      if (o && o.id !== v.id) wrongPart = '<div class="lb-row lb-wrong"><span class="lb-label">내가 고른 보기</span>' + wordLine(o) + "</div>";
    }
    return '<div class="learn-box"><div class="lb-title">학습 정보</div>' + wordLine(v) +
      exs.map(x => '<div class="lb-ex"><span class="jp" lang="ja">' + esc(x.ja) + '</span><span class="ko">' + esc(x.ko) + "</span></div>").join("") +
      own.map(e => '<div class="lb-ex">' + exampleHTML(e, true) + "</div>").join("") +
      rel("유의어", v.synonyms) + rel("자주 쓰는 표현", v.collocations) + wrongPart + "</div>";
  }

  /* ---------- 헷갈리는 단어 ---------- */
  function renderCompare(el) {
    const list = (coreData() && coreData().confusables) || [];
    if (!list.length) { el.innerHTML = '<p class="notice">자료를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요. 이 방의 헷갈리는 단어 비교 자료가 아직 없어요.</p>'; return; }
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
    view: { id: cfg.id, label: cfg.label || "단어", jp: cfg.jp || "語彙", needs: [cfg.extraKey, "sources", "kanji", "checks", EXAMPLE_KEYS[cfg.extraKey]], render },
    needsReview, reviewWordIds, markWordWrong, openMode, studiedCount, touchedCount, total: () => items().length,
  };
}

/* =========================================================
   문법: '문법 학습' · '플래시카드' · '문법 퀴즈' 탭
   cfg: { id, label, jp, st, core: () => 기본 자료(JSON) | null, extraKey, idPrefix, onEvent }
   ========================================================= */
export function createGrammarView(cfg) {
  const st = cfg.st;
  const ui = { mode: "learn", q: "", src: "", filter: "all", shown: PAGE, quiz: null, scope: "all", count: "10", open: new Set() };
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
  const emit = (kind, key) => { if (cfg.onEvent) cfg.onEvent(kind, key); };   // key: 하루 한 번만 경험치를 주기 위한 항목 id
  const studiedCount = () => items().filter(g => state(g.id).studied).length;

  function render(app) {
    const all = items();
    if (!all.length) {
      app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>문법</h2></div></div><p class="notice">자료를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요. 문법 자료 파일을 불러오지 못했어요.</p></section>';
      return;
    }
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>문법</h2></div>' +
          '<div class="toolbar"><div class="progress">공부한 문법 <strong id="g-studied">' + studiedCount() + "</strong> / " + all.length + "</div>" +
          '<div class="bar" aria-hidden="true"><span id="g-bar" style="width:' + (studiedCount() / all.length * 100) + '%"></span></div></div></div>' +
        '<div class="segmented" role="tablist" aria-label="문법 학습 방식">' +
          seg(ui, "learn", "문법 학습") + seg(ui, "cards", "플래시카드") + seg(ui, "quiz", "문법 퀴즈") +
        "</div>" +
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
              '<option value="pdf"' + (ui.src === "pdf" ? " selected" : "") + ">참고 목록 문형</option></select></div>"
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
      if (handleKanjiClick(e, cfg.roomId)) return;
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
    const own = examplesFor(g.id);   // 읽기가 붙은 예문이 있으면 그것을 보여 준다
    const ex = own[0] ? null : g.examples && g.examples[0];
    const more = e.core
      ? "<dl>" +
          "<div><dt>접속</dt><dd>" + esc(g.connection) + "</dd></div>" +
          "<div><dt>상세 설명</dt><dd>" + esc(g.explanation) + "</dd></div>" +
          (own.length > 1 ? "<div><dt>예문 더 보기</dt><dd>" + own.slice(1).map(x => exampleHTML(x, true)).join("") + "</dd></div>"
            : !own.length && g.examples.length > 1 ? "<div><dt>예문 더 보기</dt><dd>" + g.examples.slice(1).map(x =>
            '<span class="jp block" lang="ja">' + esc(x.ja) + '</span><span class="ko block">' + esc(x.ko) + "</span>").join("") + "</dd></div>" : "") +
          (g.similar && g.similar.length ? "<div><dt>유사 문법과의 차이</dt><dd>" + g.similar.map(x =>
            '<span class="block"><b lang="ja">' + esc(x.pattern) + "</b> — " + esc(x.difference) + "</span>").join("") + "</dd></div>" : "") +
          (g.caution ? "<div><dt>사용 시 주의사항</dt><dd>" + esc(g.caution) + "</dd></div>" : "") +
          (g.examPoint ? "<div><dt>시험에서 이렇게 물어볼 수 있어요</dt><dd>" + esc(g.examPoint) + "</dd></div>" : "") +
        "</dl>"
      : "";
    return '<div class="g-item" id="' + g.id + '">' +
      '<div><div class="g-pattern" lang="ja">' + esc(g.pattern) + " " + sayBtn(patternSpeech(g.pattern), "문형 발음 듣기") + "</div>" +
        (g.reading && !e.core ? '<div class="g-conn" lang="ja">' + esc(g.reading) + "</div>" : "") +
        '<div class="g-actions">' +
          '<button type="button" class="mark star" data-gact="fav" data-id="' + g.id + '" aria-pressed="' + !!s.fav + '" aria-label="즐겨찾기">' + (s.fav ? "★" : "☆") + "</button>" +
          '<button type="button" class="mark" data-gact="studied" data-id="' + g.id + '" aria-pressed="' + !!s.studied + '">' + (s.studied ? "공부했어요 ✓" : "공부했어요") + "</button>" +
        "</div></div>" +
      '<div class="g-body"><div class="g-mean">' + esc(g.meaning) + "</div>" +
        // 예문과 설명은 접어 두고, 평소에는 문형과 뜻만 보여 준다
        '<details class="g-more" data-owner="' + cfg.id + '" data-id="' + g.id + '"' + (ui.open.has(g.id) ? " open" : "") + "><summary>예문·설명 보기</summary>" +
          (ex ? '<div class="g-ex"><span class="jp" lang="ja">' + esc(ex.ja) + '</span><span class="ko">' + esc(ex.ko) + "</span></div>"
            : (examplesFor(g.id)[0] ? '<div class="g-ex">' + exampleHTML(examplesFor(g.id)[0], true) + "</div>" : "")) +
          kanjiRowHTML(g.pattern, g.reading) + more + "</details>" +
      "</div></div>";
  }

  /* ---------- 답한 뒤 보여 주는 문법 학습 정보 ---------- */
  const patternLine = g => '<div class="lb-word"><b lang="ja">' + esc(g.pattern) + "</b>" + sayBtn(patternSpeech(g.pattern), "문형 발음 듣기") +
    (g.reading ? ' <span class="reading" lang="ja">' + esc(g.reading) + "</span>" : "") +
    ' <span class="lb-mean">' + esc(g.meaning) + "</span></div>";

  function grammarExtra(q, picked) {
    const all = items();
    const g = all.find(x => x.id === q.wordId) || all.find(x => x.id === q.related);
    if (!g) return "";
    const ex = examplesFor(g.id)[0] ? null : (g.examples || [])[0];
    let wrongPart = "";
    if (picked !== null && picked !== undefined && picked !== q.answer && q.generated) {
      const t = q.options[picked];
      const o = all.find(x => x.meaning === t || x.pattern === t || blankText(x) === t);
      if (o && o.id !== g.id) wrongPart = '<div class="lb-row lb-wrong"><span class="lb-label">내가 고른 보기</span>' + patternLine(o) + "</div>";
    }
    return '<div class="learn-box"><div class="lb-title">학습 정보</div>' + patternLine(g) +
      (g.connection ? '<div class="lb-row"><span class="lb-label">접속</span><span>' + esc(g.connection) + "</span></div>" : "") +
      (ex ? '<div class="lb-ex"><span class="jp" lang="ja">' + esc(ex.ja) + '</span><span class="ko">' + esc(ex.ko) + "</span></div>"
        : (examplesFor(g.id)[0] ? '<div class="lb-ex">' + exampleHTML(examplesFor(g.id)[0], true) + "</div>" : "")) +
      wrongPart + "</div>";
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
      const ex = examplesFor(g.id)[0] ? null : g.examples && g.examples[0];
      el.innerHTML =
        '<p class="progress">남은 카드 <strong>' + session.queue.length + "</strong> · 복습 " + session.dueCount + " · 새 문형 " + session.newCount + "</p>" +
        '<div class="flash"><div class="flash-word sm" lang="ja">' + esc(g.pattern) + "</div>" +
          (session.flipped
            ? '<div class="flash-back"><div class="meaning">' + esc(g.meaning) + "</div>" +
              (g.connection ? '<div class="g-conn">접속 · ' + esc(g.connection) + "</div>" : "") +
              (ex ? '<div class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + sayBtn(ex.ja, "예문 듣기") + esc(ex.ko) + "</div>" : (examplesFor(g.id)[0] ? '<div class="ex">' + exampleHTML(examplesFor(g.id)[0], false) + "</div>" : "")) + "</div>"
            : '<button type="button" class="btn" id="flip">답 보기</button>') +
        "</div>" +
        (session.flipped
          ? '<div class="grades">' + GRADES.map(gr =>
              '<button type="button" class="grade grade-' + gr.key + '" data-grade="' + gr.key + '"><span>' + gr.label + "</span><small>" + preview(card, gr.key) + "</small></button>").join("") + "</div>" + '<p class="hint srs-help">' + SRS_HELP + "</p>"
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
      emit("card", id);
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
    const types = [["mix", "전체 섞기"], ["blank", "문장 빈칸"], ["meaning", "뜻 고르기"], ["reverse", "문형 고르기"]];
    if (coreQs.length) types.push(["exam", "시험형 문제"]);
    if (!types.some(t => t[0] === ui.quiz)) ui.quiz = "mix";
    const kinds = [...new Set(coreQs.map(q => q.kind))];
    if (ui.quiz === "exam" && ui.scope !== "all" && !kinds.includes(ui.scope)) ui.scope = "all";
    if (ui.quiz !== "exam" && kinds.includes(ui.scope)) ui.scope = "all";
    const scopes = ui.quiz === "exam"
      ? [["all", "전체 유형"], ...kinds.map(k => [k, k])]
      : [["all", "전체 문형"], ["studied", "공부한 문형"], ["fav", "즐겨찾기"]];
    el.innerHTML =
      '<div class="toolbar">' + chipRow("gq", types, ui.quiz) + "</div>" +
      '<div class="toolbar"><span class="hint">범위</span>' + chipRow("gscope", scopes, ui.scope) + "</div>" +
      '<div class="toolbar"><span class="hint">한 번에</span>' + chipRow("gc", QUIZ_COUNTS, ui.count) + furiToggleHTML() + '<button type="button" class="link-btn" id="reset">' + (ui.quiz === "exam" ? "다시 풀기" : "새 문제") + "</button></div>" +
      '<p class="quiz-progress" id="quiz-progress" role="status"></p>' +
      '<p class="hint" id="gq-note"></p>' +
      '<div class="quiz" id="quiz"></div>';
    const fixedIds = coreQs.map(q => q.id);
    const showProgress = () => { el.querySelector("#quiz-progress").textContent = progressText(quizProgress(items(), st.get("attempts"), fixedIds), "문형"); };
    const start = () => {
      let qs;
      const note = el.querySelector("#gq-note"), n = Number(ui.count);
      if (ui.quiz === "exam") {
        qs = coreQs.filter(q => ui.scope === "all" || q.kind === ui.scope).map(q => Object.assign({ area: "grammar" }, q));
        note.textContent = "";
      } else {
        const set = { area: "grammar" }, attempts = st.get("attempts");
        let pool = items().filter(g => ui.scope === "all" || (ui.scope === "studied" ? state(g.id).studied : state(g.id).fav));
        if (ui.quiz === "blank") pool = pool.filter(blankOf);
        const tried = new Set(attempts.map(a => a.qid));
        qs = pickItems(pool, n, { attempts, weak: g => (state(g.id).wrong || 0) > 0 })
          .map(g => ui.quiz === "mix" ? mixedQuestion(g, set, items(), cfg.idPrefix, tried) : buildQuestion(g, ui.quiz, set, items(), cfg.idPrefix));
        note.textContent = pool.length ? "" : "이 범위에 문형이 없어요. '문법 학습'에서 공부했어요·즐겨찾기를 표시하거나 '전체 문형'을 골라 주세요.";
      }
      showProgress();
      runQuiz(el.querySelector("#quiz"), qs.map(q => ({ q, extra: grammarExtra })), {
        store: st, label: "문제", onRestart: start, restartLabel: ui.quiz === "exam" ? "처음부터 다시" : "새 문제 " + n + "개",
        empty: "이 범위에 문형이 없어요.",
        onAnswer: (it, ok) => { emit(ok ? "correct" : "wrong", it.q.id); showProgress(); },
      });
    };
    el.onclick = e => {
      const t = e.target.closest("[data-gq]"), s = e.target.closest("[data-gscope]"), c = e.target.closest("[data-gc]");
      if (t) { ui.quiz = t.dataset.gq; renderQuiz(el); }
      else if (s) { ui.scope = s.dataset.gscope; renderQuiz(el); }
      else if (c) { ui.count = c.dataset.gc; renderQuiz(el); }
      else if (e.target.closest("#reset")) start();
    };
    start();
  }

  return {
    view: { id: cfg.id, label: cfg.label || "문법", jp: cfg.jp || "文法", needs: [cfg.extraKey, "sources", "kanji", "checks", EXAMPLE_KEYS[cfg.extraKey]], render },
    studiedCount, total: () => items().length,
  };
}
