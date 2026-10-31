// 4지선다 문제 하나를 보여 주고, 답을 고르면 해설을 펼친다 (어휘·문법·독해·청해 공통)
import { esc, multiline, badges, AREAS } from "./util.js";
import { store } from "./store.js";
import { grammarById } from "./data.js";

// q: 문제 자료, opts: { number, record(기록 여부), mode, onAnswer(correct, choice), wide, label, store(기록할 방, 기본은 N1),
//                     extra(q, picked) → 답한 뒤 해설 아래에 덧붙일 학습 정보(HTML) }
export function mountQuestion(el, q, opts = {}) {
  let picked = null;

  function render() {
    const done = picked !== null;
    const wide = opts.wide || q.options.some(o => o.length > 12);
    el.className = "q";
    el.innerHTML =
      '<div class="q-top"><span class="q-num">' + esc(opts.label || ("問" + (opts.number || 1))) +
        (q.kind ? " · " + esc(q.kind) : "") + "</span>" + badges(q) + "</div>" +
      '<div class="q-text" lang="ja">' + (q.promptHTML || multiline(q.prompt)) + "</div>" +   // promptHTML: 후리가나·발음 버튼이 붙은 문제 (안전하게 만든 HTML)
      '<div class="opts' + (wide ? " wide" : "") + '">' +
        q.options.map((o, j) => {
          let cls = "opt";
          if (done && j === q.answer) cls += " correct";
          else if (done && j === picked) cls += " wrong";
          return '<button type="button" class="' + cls + '" data-o="' + j + '"' + (done ? " disabled" : "") +
            '><span class="n">' + (j + 1) + '</span><span lang="ja">' + esc(o) + "</span></button>";
        }).join("") +
      "</div>" +
      (done ? feedbackHTML(q, picked, opts.record !== false) + (opts.extra ? opts.extra(q, picked) : "") : "");
  }

  el.onclick = e => {
    const b = e.target.closest("[data-o]");
    if (!b || picked !== null) return;
    picked = Number(b.dataset.o);
    if (opts.record !== false) (opts.store || store).recordAttempt(q, picked, opts.mode);
    render();
    if (opts.onAnswer) opts.onAnswer(picked === q.answer, picked);
  };

  render();
  return { reset() { picked = null; render(); }, get answered() { return picked !== null; } };
}

export function feedbackHTML(q, picked, saved = false) {
  const ok = picked === q.answer;
  const rows = [];
  rows.push(["정답", (q.answer + 1) + ". " + esc(q.options[q.answer])]);
  if (picked !== null && !ok) rows.push(["내가 고른 답", (picked + 1) + ". " + esc(q.options[picked])]);
  if (q.explanation) rows.push(["정답인 이유", multiline(q.explanation)]);
  if (!ok && picked !== null && q.wrongReasons && q.wrongReasons[picked]) {
    rows.push(["내가 고른 답이 틀린 이유", multiline(q.wrongReasons[picked])]);
  }
  if (q.evidence) rows.push(["근거가 되는 부분", '<span class="quote" lang="ja">' + multiline(q.evidence) + "</span>"]);
  const g = q.related ? grammarById(q.related) : null;
  if (g) {
    rows.push(["관련 문법", '<strong lang="ja">' + esc(g.pattern) + "</strong> — " + esc(g.meaning) +
      (g.explanation ? "<br>" + multiline(g.explanation) : "")]);
  }
  return '<div class="fb" role="status">' +
    '<div class="fb-verdict ' + (ok ? "good" : "bad") + '">' + (ok ? "정답이에요" : picked === null ? "답하지 않았어요" : "오답이에요") +
      (!ok && saved ? " · 오답 노트에 저장했어요" : "") + "</div>" +
    "<dl>" + rows.map(([t, d]) => "<div><dt>" + t + "</dt><dd>" + d + "</dd></div>").join("") + "</dl>" +
  "</div>";
}

export const areaLabel = a => AREAS[a] || a;

// 여러 문제를 한 화면에 늘어놓는 퀴즈의 맨 아래 막대: 점수와 '새 문제' 버튼 (맨 위로 올라가지 않아도 이어서 풀 수 있게)
// box 끝에 붙이고, 답할 때마다 update(맞힌 수, 푼 수)를 부른다
export function endBar(box, total, onNew, newLabel = "새 문제 풀기") {
  const bar = document.createElement("div");
  bar.className = "end-bar";
  bar.innerHTML = '<span class="end-msg" role="status"></span><button type="button" class="btn ghost">' + esc(newLabel) + "</button>";
  box.appendChild(bar);
  bar.querySelector("button").onclick = onNew;
  const msg = bar.querySelector(".end-msg");
  return {
    update(right, done) {
      const all = done >= total;
      msg.textContent = all ? "다 풀었어요 · " + right + " / " + total + " 정답" : done + " / " + total + " 풂";
      bar.classList.toggle("done", all);
      bar.querySelector("button").className = "btn" + (all ? "" : " ghost");
    },
  };
}
