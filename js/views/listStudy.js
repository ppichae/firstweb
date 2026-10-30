// PDF 목록 단어·문형 학습 화면 (N1 방과 N3 방이 함께 쓴다)
// 기존 단어 화면처럼 목록 · 플래시카드 · 퀴즈로 공부한다. 기록은 방마다 다른 저장소(st)의 "lists"에 남는다.
import { EXTRA, sourceById } from "../data.js";
import { esc, shuffle, today } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { GRADES, schedule, preview, newCard } from "../srs.js";

export const LIST_POS = {
  noun: "명사", "noun-suru": "명사 · する동사", verb: "동사", "i-adj": "い형용사", "na-adj": "な형용사",
  adverb: "부사", phrase: "표현", taru: "~と / ~とした", prefix: "접두어", suffix: "접미어", adnominal: "연체사",
};
const STATUS = { VERIFIED: "검수 완료", AI_GENERATED: "AI 작성", NEEDS_REVIEW: "검수 필요", SOURCE_PENDING: "출처 확인 필요" };
const PAGE = 60;
const NEW_PER_SESSION = 10;
const hasKanji = s => /[一-鿿々]/.test(s);

// 단어는 word, 문형은 pattern에 표기가 들어 있다
const head = it => it.word || it.pattern;

// 출처·검수 표시: 어떤 PDF 목록에 있었는지, 뜻은 누가 썼는지, 검수했는지
export function listBadges(it) {
  const out = [];
  const ids = [...new Set((it.sources || []).map(s => s.id))];
  ids.forEach(id => {
    const s = sourceById(id);
    const secs = it.sources.filter(x => x.id === id).map(x => x.section).join(", ");
    const name = s ? s.publisher.split(" (")[0] + " " + s.level : id;
    out.push('<span class="badge" title="' + esc((s ? s.title : id) + " — " + secs) + '">목록: ' + esc(name) + "</span>");
  });
  if (it.meaningOrigin === "AI_GENERATED") out.push('<span class="badge ai">뜻: AI 작성</span>');
  if (it.status !== "VERIFIED") out.push('<span class="badge warn">' + esc(STATUS[it.status] || it.status) + "</span>");
  else out.push('<span class="badge ok">검수 완료</span>');
  return '<span class="badges">' + out.join("") + "</span>";
}

function sourceLines(it) {
  return (it.sources || []).map(x => {
    const s = sourceById(x.id);
    return esc((s ? s.publisher.split(" (")[0] + " " + s.level : x.id) + " — " + x.section);
  }).join("<br>");
}

// opts: { id, label, jp, st(저장소), sets: [{ key, dataKey, label, area }], title, intro, onEvent(kind) }
export function createListStudy(opts) {
  const st = opts.st;
  const ui = { set: opts.sets[0].key, mode: "list", q: "", pos: "", status: "all", showAll: false, shown: PAGE, quizType: "meaning" };
  const revealed = new Set();
  let session = null;

  const curSet = () => opts.sets.find(s => s.key === ui.set);
  const items = () => { const d = EXTRA[curSet().dataKey]; return (d && d.items) || []; };
  const state = id => st.get("lists")[id] || {};
  const setState = (id, fn) => st.update("lists", l => { fn(l[id] || (l[id] = {})); });
  const needsReview = id => { const s = state(id); return s.status === "unknown" || (!!s.srs && s.srs.due <= today()); };
  const emit = kind => { if (opts.onEvent) opts.onEvent(kind); };

  function render(app) {
    const set = curSet();
    const list = items();
    if (!list.length) {
      app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>' + esc(opts.title) + "</h2></div></div>" +
        '<p class="notice">콘텐츠 준비 중이에요. ' + esc(set.label) + " 자료 파일을 아직 불러오지 못했어요.</p></section>";
      return;
    }
    const known = list.filter(v => state(v.id).status === "known").length;
    const due = list.filter(v => needsReview(v.id)).length;
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>' + esc(opts.title) + "</h2><p>" + esc(opts.intro) + "</p></div>" +
          '<div class="toolbar"><div class="progress"><strong>' + known + "</strong> / " + list.length + " 외움 · 복습 필요 <strong>" + due + "</strong></div>" +
          '<div class="bar" aria-hidden="true"><span style="width:' + (known / list.length * 100) + '%"></span></div></div></div>' +
        (opts.sets.length > 1
          ? '<div class="toolbar">' + opts.sets.map(s => {
              const d = EXTRA[s.dataKey];
              return '<button type="button" class="chip" data-set="' + s.key + '" aria-pressed="' + (ui.set === s.key) + '">' + esc(s.label) + " " + (d && d.items ? d.items.length : 0) + "</button>";
            }).join("") + "</div>"
          : "") +
        '<p class="notice">PDF에서는 일본어 표기와 읽기만 학습 목록으로 참고했어요. 한국어 뜻은 AI가 새로 쓴 것이라 모두 <b>검수 필요</b> 상태예요. 예문은 아직 준비 중이에요.</p>' +
        '<div class="segmented" role="tablist" aria-label="학습 방식">' +
          seg("list", set.area === "grammar" ? "문형 목록" : "단어장") + seg("cards", "플래시카드") + seg("quiz", "퀴즈") +
        "</div>" +
        '<div id="mode" class="stack"></div>' +
      "</section>";
    app.onclick = e => {
      const s = e.target.closest("[data-mode]"), t = e.target.closest("[data-set]");
      if (s) { ui.mode = s.dataset.mode; render(app); }
      else if (t) { ui.set = t.dataset.set; ui.pos = ""; ui.shown = PAGE; session = null; revealed.clear(); render(app); }
    };
    app.oninput = app.onchange = null;
    ({ list: renderList, cards: renderCards, quiz: renderQuiz })[ui.mode](app.querySelector("#mode"), app);
  }

  function seg(key, label) {
    return '<button type="button" role="tab" class="seg" data-mode="' + key + '" aria-selected="' + (ui.mode === key) + '">' + label + "</button>";
  }

  /* ---------- 목록 ---------- */
  function renderList(el, app) {
    const isVocab = curSet().area !== "grammar";
    const usedPos = isVocab ? [...new Set(items().map(v => v.pos))] : [];
    el.innerHTML =
      '<div class="filters">' +
        '<div class="field search"><label for="l-q">검색</label><input id="l-q" type="search" placeholder="표기, 읽기, 뜻으로 찾기" value="' + esc(ui.q) + '"></div>' +
        (isVocab ? '<div class="field"><label for="l-pos">품사</label><select id="l-pos"><option value="">전체</option>' +
          usedPos.map(p => '<option value="' + p + '"' + (ui.pos === p ? " selected" : "") + ">" + esc(LIST_POS[p] || p) + "</option>").join("") + "</select></div>" : "") +
      "</div>" +
      '<div class="toolbar">' +
        ["all:전체", "review:복습 필요", "unknown:몰라요", "known:외운 것", "fav:즐겨찾기"].map(s => {
          const [k, l] = s.split(":");
          return '<button type="button" class="chip" data-status="' + k + '" aria-pressed="' + (ui.status === k) + '">' + l + "</button>";
        }).join("") +
        '<button type="button" class="chip" id="l-all" aria-pressed="' + ui.showAll + '">' + (ui.showAll ? "뜻 모두 가리기" : "뜻 모두 보기") + "</button>" +
      "</div>" +
      '<p class="result-count" id="l-count"></p>' +
      '<div class="cards" id="l-cards"></div>' +
      '<div class="toolbar" id="l-more"></div>';

    const draw = () => drawCards(el);
    el.querySelector("#l-q").oninput = e => { ui.q = e.target.value.trim(); ui.shown = PAGE; draw(); };
    const pos = el.querySelector("#l-pos");
    if (pos) pos.onchange = e => { ui.pos = e.target.value; ui.shown = PAGE; draw(); };
    el.onclick = e => {
      const stt = e.target.closest("[data-status]"), face = e.target.closest("[data-item]"), act = e.target.closest("[data-act]");
      if (stt) {
        ui.status = stt.dataset.status; ui.shown = PAGE;
        el.querySelectorAll("[data-status]").forEach(b => b.setAttribute("aria-pressed", b === stt));
      } else if (e.target.closest("#l-all")) {
        ui.showAll = !ui.showAll; revealed.clear();
        const t = el.querySelector("#l-all");
        t.setAttribute("aria-pressed", ui.showAll);
        t.textContent = ui.showAll ? "뜻 모두 가리기" : "뜻 모두 보기";
      } else if (e.target.closest("#l-more-btn")) {
        ui.shown += PAGE;
      } else if (face) {
        const id = face.dataset.item;
        revealed.has(id) ? revealed.delete(id) : revealed.add(id);
      } else if (act) {
        const id = act.dataset.id, a = act.dataset.act;
        setState(id, s => {
          if (a === "fav") s.fav = !s.fav;
          if (a === "known") s.status = s.status === "known" ? undefined : "known";
          if (a === "unknown") s.status = s.status === "unknown" ? undefined : "unknown";
        });
        e.stopPropagation();
        render(app);
        return;
      } else return;
      draw();
    };
    draw();
  }

  function matches(v) {
    const s = state(v.id);
    if (ui.pos && v.pos !== ui.pos) return false;
    if (ui.status === "known" && s.status !== "known") return false;
    if (ui.status === "unknown" && s.status !== "unknown") return false;
    if (ui.status === "fav" && !s.fav) return false;
    if (ui.status === "review" && !needsReview(v.id)) return false;
    if (ui.q) {
      const hay = [head(v), v.reading, v.meaning].join(" ").toLowerCase();
      if (!hay.includes(ui.q.toLowerCase())) return false;
    }
    return true;
  }

  function drawCards(el) {
    const list = items().filter(matches);
    const isVocab = curSet().area !== "grammar";
    el.querySelector("#l-count").textContent = list.length + "개" + (list.length > ui.shown ? " 중 " + ui.shown + "개 표시" : "");
    const cards = el.querySelector("#l-cards");
    const more = el.querySelector("#l-more");
    more.innerHTML = list.length > ui.shown ? '<button type="button" class="btn ghost" id="l-more-btn">' + Math.min(PAGE, list.length - ui.shown) + "개 더 보기</button>" : "";
    if (!list.length) {
      cards.innerHTML = '<p class="empty">조건에 맞는 항목이 없어요. 검색어나 필터를 바꿔 보세요.</p>';
      return;
    }
    cards.innerHTML = list.slice(0, ui.shown).map(v => {
      const s = state(v.id);
      const open = ui.showAll || revealed.has(v.id);
      return '<article class="card' + (s.status === "known" ? " is-known" : "") + '">' +
        (s.status === "known" ? '<span class="seal" aria-hidden="true" lang="ja">済</span>' : "") +
        '<button type="button" class="card-face" data-item="' + v.id + '" aria-expanded="' + open + '">' +
          '<span class="word' + (isVocab ? "" : " sm") + '" lang="ja">' + esc(head(v)) + "</span>" +
          (open
            ? (v.reading && v.reading !== head(v) ? '<span class="reading" lang="ja">' + esc(v.reading) + "</span>" : "") +
              '<span class="meaning">' + esc(v.meaning) + "</span>" +
              '<span class="ex">예문 준비 중</span>' +
              '<span class="usage">' + sourceLines(v) + "</span>" +
              listBadges(v)
            : '<span class="hint">눌러서 뜻 보기</span>') +
        "</button>" +
        '<div class="card-meta"><span class="pos">' + (isVocab ? esc(LIST_POS[v.pos] || v.pos) + " · " : "문형 · ") + esc(v.level) + "</span>" +
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
  function buildSession() {
    const l = st.get("lists");
    const due = items().filter(v => l[v.id] && l[v.id].srs && l[v.id].srs.due <= today());
    const fresh = items().filter(v => !(l[v.id] && l[v.id].srs)).slice(0, NEW_PER_SESSION);
    return { set: ui.set, queue: [...shuffle(due), ...fresh].map(v => v.id), done: 0, flipped: false, total: due.length + fresh.length, dueCount: due.length, newCount: fresh.length };
  }

  function renderCards(el, app) {
    if (!session || session.set !== ui.set) session = buildSession();
    const draw = () => {
      if (!session.queue.length) {
        el.innerHTML = '<div class="flash-done"><h3>' + (session.total ? "오늘 복습을 마쳤어요" : "지금 복습할 카드가 없어요") + "</h3>" +
          "<p>" + (session.total ? session.done + "장을 복습했어요. 다음 복습 날짜가 된 카드는 이 화면에 다시 나와요." : "모든 카드의 다음 복습 날짜가 아직 오지 않았어요.") + "</p>" +
          '<button type="button" class="btn ghost" id="restart">새 카드로 다시 시작</button></div>';
        el.querySelector("#restart").onclick = () => { session = buildSession(); draw(); };
        return;
      }
      const v = items().find(x => x.id === session.queue[0]);
      const card = state(v.id).srs || newCard();
      el.innerHTML =
        '<p class="progress">남은 카드 <strong>' + session.queue.length + "</strong> · 복습 " + session.dueCount + " · 새 카드 " + session.newCount + "</p>" +
        '<div class="flash">' +
          '<div class="flash-word" lang="ja">' + esc(head(v)) + "</div>" +
          (session.flipped
            ? '<div class="flash-back">' + (v.reading && v.reading !== head(v) ? '<div class="reading" lang="ja">' + esc(v.reading) + "</div>" : "") +
              '<div class="meaning">' + esc(v.meaning) + "</div>" + listBadges(v) + "</div>"
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
      draw();
    };
    draw();
  }

  /* ---------- 퀴즈 (목록으로 자동으로 만드는 자체 제작 연습) ---------- */
  function quizTypes() {
    return curSet().area === "grammar"
      ? [["meaning", "문형 → 뜻"], ["reverse", "뜻 → 문형"]]
      : [["meaning", "단어 → 뜻"], ["reading", "단어 → 읽기"], ["reverse", "뜻 → 단어"]];
  }

  function makeQuestions(type, count = 10) {
    const set = curSet();
    let pool = items();
    if (type === "reading") pool = pool.filter(v => hasKanji(v.word) && v.reading);
    return shuffle(pool).slice(0, Math.min(count, pool.length)).map(v => buildQuestion(v, type, set, items(), opts.idPrefix));
  }

  function renderQuiz(el) {
    const types = quizTypes();
    if (!types.some(t => t[0] === ui.quizType)) ui.quizType = types[0][0];
    el.innerHTML =
      '<div class="toolbar">' + types.map(([k, l]) =>
        '<button type="button" class="chip" data-qt="' + k + '" aria-pressed="' + (ui.quizType === k) + '">' + l + "</button>").join("") +
        '<span class="score" id="score"></span><button type="button" class="link-btn" id="new-set">새 문제</button>' +
      "</div>" +
      '<p class="hint">목록에서 무작위로 10개를 뽑아 만든 <b>자체 제작 연습 문제</b>예요. 실제 JLPT 기출문제가 아니에요. 틀린 문제는 오답 노트에 모여요.</p>' +
      '<div class="quiz" id="quiz"></div>';
    const start = () => {
      const qs = makeQuestions(ui.quizType);
      const results = new Map();
      const score = el.querySelector("#score");
      const quiz = el.querySelector("#quiz");
      quiz.innerHTML = "";
      score.textContent = "";
      qs.forEach((q, i) => {
        const box = document.createElement("div");
        quiz.appendChild(box);
        mountQuestion(box, q, {
          number: i + 1, store: st, label: "연습 " + (i + 1),
          onAnswer: ok => {
            results.set(q.id, ok);
            if (!ok) setState(q.wordId, s => { s.wrong = (s.wrong || 0) + 1; s.srs = Object.assign(newCard(), s.srs, { due: today() }); });
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

  return { id: opts.id, label: opts.label, jp: opts.jp, needs: [...opts.sets.map(s => s.dataKey), "sources"], render };
}

// 목록 항목 하나로 4지선다 문제를 만든다 (시험 대비 화면에서도 쓴다)
// type: meaning(표기→뜻) · reading(표기→읽기) · reverse(뜻→표기)
export function buildQuestion(v, type, set, pool, idPrefix = "gen") {
  const field = type === "meaning" ? "meaning" : type === "reading" ? "reading" : (v.word ? "word" : "pattern");
  // 오답 보기는 같은 품사 · 비슷한 길이를 먼저 고른다 (길이만 보고 정답을 알 수 없게)
  const any = pool.filter(o => o.id !== v.id && o[field] && o[field] !== v[field] && (type !== "reading" || hasKanji(o.word)));
  const samePos = any.filter(o => !v.pos || o.pos === v.pos);
  const close = list => list.filter(o => Math.abs(o[field].length - v[field].length) <= 1);
  const picked = [];
  for (const o of [...shuffle(close(samePos)), ...shuffle(close(any)), ...shuffle(samePos), ...shuffle(any)]) {
    if (picked.length === 3) break;
    if (!picked.some(p => p[field] === o[field])) picked.push(o);
  }
  const opts = shuffle([v, ...picked]);
  const kinds = { meaning: "뜻 고르기", reading: "읽기 고르기", reverse: (set.area === "grammar" ? "문형" : "단어") + " 고르기" };
  const prompt = type === "meaning" ? "「" + head(v) + "」の意味は？"
    : type === "reading" ? "「" + v.word + "」の読み方は？"
    : "‘" + v.meaning + "’에 맞는 " + (set.area === "grammar" ? "문형" : "단어") + "는？";
  return {
    id: idPrefix + "-" + type + "-" + v.id, area: set.area, generated: true, wordId: v.id,
    kind: kinds[type], prompt,
    options: opts.map(o => o[field]),
    answer: opts.indexOf(v),
    explanation: "「" + head(v) + "」" + (v.reading && v.reading !== head(v) ? "(" + v.reading + ")" : "") + "은 '" + v.meaning + "'라는 뜻이에요. (뜻은 AI가 작성했고 검수 전이에요)",
    wrongReasons: opts.map(o => o === v ? ""
      : type === "reverse" ? "「" + o[field] + "」는 '" + o.meaning + "'라는 뜻이에요."
      : "「" + o[field] + "」는 「" + head(o) + "」의 " + (field === "meaning" ? "뜻" : "읽기") + "예요."),
    source: { type: "ai" }, review: "needs-review",
  };
}
