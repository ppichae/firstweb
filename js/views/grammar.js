// 문법 화면: 문형 목록(상세 설명·유사 문법) + 유형별 문제
import { DB } from "../data.js";
import { store } from "../store.js";
import { esc, badges, today } from "../util.js";
import { mountQuestion } from "../quiz.js";

const ui = { q: "", filter: "all", kind: "all", open: new Set() };
const state = id => store.get("grammar")[id] || {};

function render(app) {
  const items = DB.grammar.items;
  const kinds = [...new Set(DB.grammar.questions.map(q => q.kind))];
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>문법</h2><p>문형을 펼치면 상세 설명, 유사 문법과의 차이, 주의할 점이 나와요.</p></div>' +
        '<div class="progress">공부한 문법 <strong id="g-studied">0</strong> / ' + items.length + "</div></div>" +
      '<div class="filters">' +
        '<div class="field search"><label for="g-q">검색</label><input id="g-q" type="search" placeholder="문형이나 뜻으로 찾기" value="' + esc(ui.q) + '"></div>' +
      "</div>" +
      '<div class="toolbar">' + ["all:전체", "todo:아직 안 함", "studied:공부함", "fav:즐겨찾기"].map(s => {
        const [k, l] = s.split(":");
        return '<button type="button" class="chip" data-gfilter="' + k + '" aria-pressed="' + (ui.filter === k) + '">' + l + "</button>";
      }).join("") + "</div>" +
      '<div class="grammar-list" id="g-list"></div>' +
      '<div class="panel-head"><div><h3>문법 문제</h3><p>틀린 문제는 오답 노트에 저장돼요.</p></div>' +
        '<div class="toolbar"><span class="score" id="score"></span><button type="button" class="link-btn" id="reset">다시 풀기</button></div></div>' +
      '<div class="toolbar">' + ["all", ...kinds].map(k =>
        '<button type="button" class="chip" data-kind="' + esc(k) + '" aria-pressed="' + (ui.kind === k) + '">' + (k === "all" ? "전체" : esc(k)) + "</button>").join("") + "</div>" +
      '<div class="quiz" id="quiz"></div>' +
    "</section>";

  drawList(app);
  drawQuiz(app);
  app.querySelector("#g-q").oninput = e => { ui.q = e.target.value.trim(); drawList(app); };
  app.onclick = e => {
    const f = e.target.closest("[data-gfilter]");
    const k = e.target.closest("[data-kind]");
    const act = e.target.closest("[data-gact]");
    if (f) {
      ui.filter = f.dataset.gfilter;
      app.querySelectorAll("[data-gfilter]").forEach(b => b.setAttribute("aria-pressed", b === f));
      drawList(app);
    } else if (k) {
      ui.kind = k.dataset.kind;
      app.querySelectorAll("[data-kind]").forEach(b => b.setAttribute("aria-pressed", b === k));
      drawQuiz(app);
    } else if (act) {
      const id = act.dataset.id;
      store.update("grammar", g => {
        const s = g[id] || (g[id] = {});
        if (act.dataset.gact === "fav") s.fav = !s.fav;
        if (act.dataset.gact === "studied") s.studied = s.studied ? undefined : today();
      });
      drawList(app);
    }
  };
  // 펼친 상태를 기억해서 다시 그려도 유지한다 (한 번만 등록)
  if (!app.dataset.gToggle) {
    app.dataset.gToggle = "1";
    app.addEventListener("toggle", e => {
      const d = e.target.closest && e.target.closest("details.g-more[data-id]");
      if (d) d.open ? ui.open.add(d.dataset.id) : ui.open.delete(d.dataset.id);
    }, true);
  }
}

function drawList(app) {
  const items = DB.grammar.items.filter(g => {
    const s = state(g.id);
    if (ui.filter === "studied" && !s.studied) return false;
    if (ui.filter === "todo" && s.studied) return false;
    if (ui.filter === "fav" && !s.fav) return false;
    if (ui.q && ![g.pattern, g.meaning, g.connection].join(" ").includes(ui.q)) return false;
    return true;
  });
  app.querySelector("#g-studied").textContent = DB.grammar.items.filter(g => state(g.id).studied).length;
  const list = app.querySelector("#g-list");
  if (!items.length) { list.innerHTML = '<p class="empty">조건에 맞는 문법이 없어요.</p>'; return; }
  list.innerHTML = items.map(g => {
    const s = state(g.id);
    const ex = g.examples[0];
    return '<div class="g-item" id="' + g.id + '">' +
      '<div><div class="g-pattern" lang="ja">' + esc(g.pattern) + "</div>" +
        '<div class="g-actions">' +
          '<button type="button" class="mark star" data-gact="fav" data-id="' + g.id + '" aria-pressed="' + !!s.fav + '" aria-label="즐겨찾기">' + (s.fav ? "★" : "☆") + "</button>" +
          '<button type="button" class="mark" data-gact="studied" data-id="' + g.id + '" aria-pressed="' + !!s.studied + '">' + (s.studied ? "공부했어요 ✓" : "공부했어요") + "</button>" +
        "</div></div>" +
      '<div class="g-body"><div class="g-mean">' + esc(g.meaning) + '</div><div class="g-conn">접속 · ' + esc(g.connection) + "</div>" +
        '<div class="g-ex"><span class="jp" lang="ja">' + esc(ex.ja) + '</span><span class="ko">' + esc(ex.ko) + "</span></div>" +
        '<details class="g-more" data-id="' + g.id + '"' + (ui.open.has(g.id) ? " open" : "") + "><summary>자세히 보기</summary>" +
          "<dl>" +
            "<div><dt>상세 설명</dt><dd>" + esc(g.explanation) + "</dd></div>" +
            (g.examples.length > 1 ? "<div><dt>예문 더 보기</dt><dd>" + g.examples.slice(1).map(x =>
              '<span class="jp block" lang="ja">' + esc(x.ja) + '</span><span class="ko block">' + esc(x.ko) + "</span>").join("") + "</dd></div>" : "") +
            (g.similar && g.similar.length ? "<div><dt>유사 문법과의 차이</dt><dd>" + g.similar.map(x =>
              '<span class="block"><b lang="ja">' + esc(x.pattern) + "</b> — " + esc(x.difference) + "</span>").join("") + "</dd></div>" : "") +
            (g.caution ? "<div><dt>사용 시 주의사항</dt><dd>" + esc(g.caution) + "</dd></div>" : "") +
            (g.examPoint ? "<div><dt>시험에서 이렇게 물어볼 수 있어요</dt><dd>" + esc(g.examPoint) + "</dd></div>" : "") +
          "</dl>" + badges(g) +
        "</details>" +
      "</div></div>";
  }).join("");
}

function drawQuiz(app) {
  const qs = DB.grammar.questions.filter(q => ui.kind === "all" || q.kind === ui.kind).map(q => Object.assign({ area: "grammar" }, q));
  const quiz = app.querySelector("#quiz");
  const score = app.querySelector("#score");
  const results = new Map();
  quiz.innerHTML = "";
  score.textContent = "";
  const mounted = qs.map((q, i) => {
    const el = document.createElement("div");
    quiz.appendChild(el);
    return mountQuestion(el, q, {
      number: i + 1,
      onAnswer: ok => { results.set(q.id, ok); score.textContent = [...results.values()].filter(Boolean).length + " / " + qs.length + " 정답"; },
    });
  });
  app.querySelector("#reset").onclick = () => { results.clear(); mounted.forEach(m => m.reset()); score.textContent = ""; };
}

export default { id: "grammar", label: "문법", jp: "文法", render };
