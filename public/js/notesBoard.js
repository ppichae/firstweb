// 오답 노트 화면 (N1·N3 공용): 틀린 문제를 한 번에 이어서 다시 풀고, 목록은 내 답과 정답만 짧게 보여 준다
// 기록은 attempts에서 계산하므로 다시 풀면 맞힌 문제는 자동으로 '극복한 문제'로 옮겨 간다
import { esc, multiline, dateKey, fmtDate } from "./util.js";
import { mountQuestion } from "./quiz.js";
import { noteEntries } from "./stats.js";

// cfg: { id, st, areas, emptyText, parentOf(note) → {title, link} | null, openParent(note), award(ok, qid), needs }
export function createNotesView(cfg) {
  const ui = { area: "all", status: "open", run: null };
  const retrying = new Set();
  // 많이 틀린 문제부터, 같으면 최근에 틀린 문제부터
  const order = (a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt - a.lastWrongAt;
  const answerText = (q, i) => (i >= 0 && q.options[i] !== undefined ? (i + 1) + ". " + esc(q.options[i]) : "답하지 않음");

  function render(app) {
    if (ui.run) { renderRun(app); return; }
    const all = noteEntries(cfg.st);
    const openCount = all.filter(n => !n.resolved).length;
    const count = a => all.filter(n => n.area === a && (ui.status === "all" || (ui.status === "open" ? !n.resolved : n.resolved))).length;
    const list = all.filter(n => (ui.area === "all" || n.area === ui.area) &&
      (ui.status === "all" || (ui.status === "open" ? !n.resolved : n.resolved))).sort(order);
    const runnable = list.filter(n => !n.resolved);
    // 문제가 있는 영역만 칩으로 보여 준다
    const areaChips = Object.entries(cfg.areas).filter(([k]) => count(k) > 0 || ui.area === k);

    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>오답 노트</h2></div>' +
          '<div class="progress">극복한 문제 <strong>' + (all.length - openCount) + "</strong> / " + all.length + "</div></div>" +
        (runnable.length
          ? '<article class="card-box note-hero"><div class="note-hero-num"><span class="tile-label">다시 풀 문제</span><span class="tile-value">' + runnable.length + "</span></div>" +
              '<button type="button" class="btn" id="n-run">한 번에 다시 풀기</button></article>'
          : "") +
        (all.length
          ? '<div class="toolbar">' + [["open", "다시 풀 문제"], ["done", "극복한 문제"], ["all", "모두"]].map(([k, l]) =>
              '<button type="button" class="chip" data-nstatus="' + k + '" aria-pressed="' + (ui.status === k) + '">' + l + "</button>").join("") + "</div>" +
            (areaChips.length > 1 || ui.area !== "all"
              ? '<div class="toolbar">' + [["all", "전체"], ...areaChips].map(([k, l]) =>
                  '<button type="button" class="chip" data-narea="' + k + '" aria-pressed="' + (ui.area === k) + '">' + l + " " + (k === "all" ? Object.keys(cfg.areas).reduce((sum, x) => sum + count(x), 0) : count(k)) + "</button>").join("") + "</div>"
              : "")
          : "") +
        (list.length ? '<div class="notes">' + list.map(noteHTML).join("") + "</div>"
          : '<p class="empty">' + (all.length ? "이 조건에 맞는 오답이 없어요." : cfg.emptyText) + "</p>") +
      "</section>";

    list.forEach(n => { if (retrying.has(n.qid)) mountRetry(app, n); });
    app.onclick = e => {
      const a = e.target.closest("[data-narea]"), s = e.target.closest("[data-nstatus]");
      const r = e.target.closest("[data-retry]"), o = e.target.closest("[data-open]");
      if (a) { ui.area = a.dataset.narea; render(app); }
      else if (s) { ui.status = s.dataset.nstatus; ui.area = "all"; render(app); }
      else if (e.target.closest("#n-run")) { ui.run = { ids: runnable.map(n => n.qid), i: 0, right: 0, wrong: [], answered: false }; render(app); scrollTo(0, 0); }
      else if (r) { retrying.add(r.dataset.retry); mountRetry(app, all.find(n => n.qid === r.dataset.retry)); }
      else if (o && cfg.openParent) cfg.openParent(all.find(n => n.qid === o.dataset.open));
    };
  }

  function noteHTML(n) {
    const q = n.q;
    const parent = cfg.parentOf ? cfg.parentOf(n) : null;
    const wr = q.wrongReasons && q.wrongReasons[n.lastChoice];
    return '<article class="note" id="note-' + esc(n.qid) + '">' +
      '<div class="note-top"><span class="q-num">' + esc(cfg.areas[n.area] || n.area) + (q.kind && !/^(reading|listening)$/.test(q.kind) ? " · " + esc(q.kind) : "") +
        (parent ? ' · <span lang="ja">' + esc(parent.title) + "</span>" : "") + "</span>" +
        (n.resolved ? '<span class="badge ok">극복함</span>' : n.wrongCount > 1 ? '<span class="badge warn">' + n.wrongCount + "번 틀림</span>" : "") + "</div>" +
      '<div class="q-text note-q" lang="ja">' + multiline(q.prompt) + "</div>" +
      '<dl class="note-ans">' +
        '<div class="is-bad"><dt>내가 고른 답</dt><dd lang="ja">' + answerText(q, n.lastChoice) + "</dd></div>" +
        '<div class="is-good"><dt>정답</dt><dd lang="ja">' + (q.answer + 1) + ". " + esc(q.options[q.answer]) + "</dd></div>" +
      "</dl>" +
      '<div class="note-actions"><button type="button" class="btn ghost sm" data-retry="' + esc(n.qid) + '">이 문제만 풀기</button>' +
        (parent ? '<button type="button" class="link-btn" data-open="' + esc(n.qid) + '">' + esc(parent.link) + "</button>" : "") + "</div>" +
      '<details class="g-more"><summary>해설·기록</summary><dl>' +
        (q.explanation ? "<div><dt>정답인 이유</dt><dd>" + multiline(q.explanation) + "</dd></div>" : "") +
        (wr ? "<div><dt>내가 고른 답이 틀린 이유</dt><dd>" + multiline(wr) + "</dd></div>" : "") +
        (q.evidence ? '<div><dt>근거가 되는 부분</dt><dd lang="ja">' + multiline(q.evidence) + "</dd></div>" : "") +
        "<div><dt>틀린 횟수</dt><dd>" + n.wrongCount + "번 (총 " + n.attempts + "번 풂)</dd></div>" +
        "<div><dt>마지막으로 틀린 날</dt><dd>" + fmtDate(dateKey(new Date(n.lastWrongAt))) + "</dd></div>" +
        '<div><dt>풀이 기록</dt><dd class="history" aria-label="풀이 기록">' + n.history.map(ok => '<span class="' + (ok ? "h-ok" : "h-bad") + '">' + (ok ? "○" : "✕") + "</span>").join("") + "</dd></div>" +
      "</dl></details>" +
      '<div class="retry" id="retry-' + esc(n.qid) + '"></div>' +
    "</article>";
  }

  function questionOpts(n, onAnswer, label) {
    return { label, mode: "review", wide: true, store: cfg.st, onAnswer: ok => { if (cfg.award) cfg.award(ok, n.qid); onAnswer(ok); } };
  }

  function mountRetry(app, n) {
    const box = app.querySelector("#retry-" + CSS.escape(n.qid));
    if (!box || box.childElementCount) return;
    const holder = document.createElement("div");
    box.appendChild(holder);
    mountQuestion(holder, Object.assign({}, n.q, { area: n.area }), questionOpts(n, () => { retrying.delete(n.qid); }, "다시 풀기"));
    holder.scrollIntoView({ block: "nearest" });
  }

  /* ---------- 한 번에 다시 풀기: 한 문제씩 넘어가고 끝나면 결과를 보여 준다 ---------- */
  function renderRun(app) {
    const run = ui.run;
    const total = run.ids.length;
    if (run.i >= total) {
      app.innerHTML =
        '<section class="panel"><div class="panel-head"><div><h2>다시 풀기 결과</h2></div></div>' +
          '<article class="card-box note-result"><span class="tile-value">' + run.right + " / " + total + "</span>" +
            "<p>" + (run.wrong.length ? "맞힌 문제는 '극복한 문제'로 옮겼어요. 아직 " + run.wrong.length + "문제가 남았어요." : "모두 맞혔어요! 전부 '극복한 문제'로 옮겼어요.") + "</p>" +
            '<div class="toolbar">' + (run.wrong.length ? '<button type="button" class="btn" id="n-again">남은 ' + run.wrong.length + "문제 다시 풀기</button>" : "") +
              '<button type="button" class="btn ghost" id="n-exit">오답 노트로</button></div></article></section>';
      app.onclick = e => {
        if (e.target.closest("#n-again")) { ui.run = { ids: run.wrong, i: 0, right: 0, wrong: [], answered: false }; render(app); }
        else if (e.target.closest("#n-exit")) { ui.run = null; render(app); }
      };
      return;
    }
    const n = noteEntries(cfg.st).find(x => x.qid === run.ids[run.i]);
    if (!n) { run.i++; renderRun(app); return; }
    const parent = cfg.parentOf ? cfg.parentOf(n) : null;
    run.answered = false;
    app.innerHTML =
      '<section class="panel">' +
        '<div class="detail-nav"><button type="button" class="btn ghost sm" id="n-exit">← 그만 풀기</button><span class="detail-pos">' + (run.i + 1) + " / " + total + "</span></div>" +
        '<div class="bar wide" aria-hidden="true"><span style="width:' + (run.i / total * 100) + '%"></span></div>' +
        (parent ? '<p class="hint">' + esc(cfg.areas[n.area] || n.area) + ' · <span lang="ja">' + esc(parent.title) + '</span> <button type="button" class="link-btn" data-open="' + esc(n.qid) + '">' + esc(parent.link) + "</button></p>" : "") +
        '<div id="n-q"></div><div id="n-next"></div>' +
      "</section>";
    mountQuestion(app.querySelector("#n-q"), Object.assign({}, n.q, { area: n.area }), questionOpts(n, ok => {
      if (ok) run.right++; else run.wrong.push(n.qid);
      run.answered = true;
      app.querySelector("#n-next").innerHTML = '<button type="button" class="btn next-passage" id="n-next-btn">' + (run.i + 1 < total ? "다음 문제" : "결과 보기") + "</button>";
    }, cfg.areas[n.area] || "다시 풀기"));
    app.onclick = e => {
      const o = e.target.closest("[data-open]");
      if (e.target.closest("#n-exit")) { ui.run = null; render(app); }
      else if (e.target.closest("#n-next-btn")) { run.i++; render(app); scrollTo(0, 0); }
      else if (o && cfg.openParent) { ui.run = null; cfg.openParent(n); }
    };
  }

  return { id: cfg.id, label: "오답 노트", needs: cfg.needs, render, leave: () => { ui.run = null; } };
}
