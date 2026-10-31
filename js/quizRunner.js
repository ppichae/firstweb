// 한 문제씩 푸는 퀴즈 진행기 (단어·문법·한자·N3 영역별 연습이 함께 쓴다)
// 답을 고르면 해설이 펼쳐지고 '다음 문제' 버튼이 나온다. 버튼을 누르면 다음 문제를 보여 주고 문제 위치로 부드럽게 이동한다.
// 마지막 문제를 풀면 결과 화면(점수 · 틀린 문제 해설 · 틀린 문제만 다시 풀기)을 보여 준다.
// 풀이 기록(오답 노트 등)은 지금처럼 mountQuestion이 문제마다 남긴다.
import { esc } from "./util.js";
import { mountQuestion, feedbackHTML } from "./quiz.js";

const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 상단 메뉴(고정)에 가려지지 않도록 그 높이만큼 띄워서 이동한다
function scrollToEl(el) {
  const nav = document.querySelector("nav.tabs");
  const offset = (nav && !nav.hidden ? nav.getBoundingClientRect().height : 0) + 12;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  if (Math.abs(el.getBoundingClientRect().top - offset) < 4) return;   // 이미 제자리면 움직이지 않는다
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? "auto" : "smooth" });
}

/* items: [{ q, extra?(q, picked), custom?(holder, done(ok)) }]
   opts: { store, label, mode, onAnswer(item, ok), onRestart(), restartLabel, empty } */
export function runQuiz(box, items, opts = {}) {
  const results = [];   // { ok, picked }
  let i = 0;

  if (!items.length) {
    box.innerHTML = '<p class="empty">' + esc(opts.empty || "이 조건으로 만들 수 있는 문제가 없어요.") + "</p>";
    return;
  }

  function header() {
    const right = results.filter(r => r && r.ok).length;
    return '<div class="qr-head"><span class="qr-step">문제 <b>' + Math.min(i + 1, items.length) + "</b> / " + items.length + "</span>" +
      '<span class="qr-bar" aria-hidden="true"><span style="width:' + (results.filter(Boolean).length / items.length * 100) + '%"></span></span>' +
      '<span class="qr-score">정답 ' + right + "</span></div>";
  }

  function showQuestion(scroll) {
    const it = items[i];
    // mountQuestion이 담긴 칸의 class를 "q"로 바꾸므로, qr-q 안에 따로 칸을 하나 더 둔다
    box.innerHTML = header() + '<div class="qr-q"><div></div></div><div class="qr-nav"></div>';
    const holder = box.querySelector(".qr-q > div");
    const done = (ok, picked) => {
      results[i] = { ok, picked };
      box.querySelector(".qr-head").outerHTML = header();
      const last = i === items.length - 1;
      const nav = box.querySelector(".qr-nav");
      nav.innerHTML = '<button type="button" class="btn qr-next">' + (last ? "결과 보기" : "다음 문제 →") + "</button>";
      const btn = nav.querySelector(".qr-next");
      btn.onclick = () => { if (last) showResult(); else { i++; showQuestion(true); } };
      if (opts.onAnswer) opts.onAnswer(it, ok, picked);
    };
    if (it.custom) it.custom(holder, ok => done(ok, null));
    else {
      mountQuestion(holder, it.q, {
        label: (opts.label || "문제") + " " + (i + 1), store: opts.store, mode: opts.mode, wide: it.wide, extra: it.extra,
        onAnswer: (ok, picked) => done(ok, picked),
      });
    }
    if (scroll) scrollToEl(box);
  }

  function showResult() {
    const right = results.filter(r => r.ok).length;
    const wrong = items.map((it, k) => ({ it, r: results[k] })).filter(x => !x.r.ok);
    box.innerHTML =
      '<article class="card-box qr-result" role="status"><h3>결과 · ' + right + " / " + items.length + " 정답</h3>" +
        '<div class="bar wide" aria-hidden="true"><span style="width:' + (right / items.length * 100) + '%"></span></div>' +
        "<p>" + (wrong.length ? "틀린 문제 " + wrong.length + "개는 오답 노트에도 저장됐어요. 아래에서 해설을 다시 볼 수 있어요." : "모두 맞혔어요! 🎉") + "</p>" +
        '<div class="toolbar">' +
          (wrong.length ? '<button type="button" class="btn" data-qr="retry">틀린 문제만 다시 풀기</button>' : "") +
          (opts.onRestart ? '<button type="button" class="btn ghost" data-qr="restart">' + esc(opts.restartLabel || "새 문제 풀기") + "</button>" : "") +
        "</div></article>" +
      (wrong.length
        ? '<h4 class="step">틀린 문제 다시 보기</h4><div class="quiz">' + wrong.map(({ it, r }, n) => it.q
            ? '<details class="q review-q"><summary><span class="q-num">틀린 문제 ' + (n + 1) + '</span><span lang="ja">' + esc(it.q.prompt) + "</span></summary>" +
                feedbackHTML(it.q, r.picked, true) + (it.extra ? it.extra(it.q, r.picked) : "") + "</details>"
            : "").join("") + "</div>"
        : "");
    box.onclick = e => {
      const b = e.target.closest("[data-qr]");
      if (!b) return;
      if (b.dataset.qr === "restart") opts.onRestart();
      else runQuiz(box, wrong.map(x => x.it), Object.assign({}, opts, { label: "다시 풀기" }));
    };
    scrollToEl(box);
  }

  box.onclick = null;
  showQuestion(false);
}
