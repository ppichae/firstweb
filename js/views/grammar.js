// 문법 화면
import { DB } from "../data.js";
import { esc } from "../util.js";
import { mountQuestion } from "../quiz.js";

function render(app) {
  const items = DB.grammar.items;
  const questions = DB.grammar.questions.map(q => Object.assign({ area: "grammar" }, q));
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>문법</h2><p>문형, 뜻, 접속(앞에 오는 말의 형태), 예문 순서로 정리했어요.</p></div></div>' +
      '<div class="grammar-list">' + items.map(g => {
        const ex = g.examples[0];
        return '<div class="g-item"><div class="g-pattern" lang="ja">' + esc(g.pattern) + "</div>" +
          '<div><div class="g-mean">' + esc(g.meaning) + '</div><div class="g-conn">접속 · ' + esc(g.connection) + "</div>" +
          '<div class="g-ex"><span class="jp" lang="ja">' + esc(ex.ja) + '</span><span class="ko">' + esc(ex.ko) + "</span></div></div></div>";
      }).join("") + "</div>" +
      '<div class="panel-head"><div><h3>문법 퀴즈</h3><p>괄호에 들어갈 가장 알맞은 표현을 고르세요.</p></div>' +
        '<div class="toolbar"><span class="score" id="score"></span><button type="button" class="link-btn" id="reset">다시 풀기</button></div></div>' +
      '<div class="quiz" id="quiz"></div>' +
    "</section>";

  const quizEl = app.querySelector("#quiz");
  const results = new Map();
  const score = app.querySelector("#score");
  const updateScore = () => {
    const right = [...results.values()].filter(Boolean).length;
    score.textContent = results.size ? right + " / " + questions.length + " 정답" : "";
  };
  const mounted = questions.map((q, i) => {
    const el = document.createElement("div");
    quizEl.appendChild(el);
    return mountQuestion(el, q, { number: i + 1, onAnswer: ok => { results.set(q.id, ok); updateScore(); } });
  });
  app.querySelector("#reset").onclick = () => { results.clear(); mounted.forEach(m => m.reset()); updateScore(); };
}

export default { id: "grammar", label: "문법", jp: "文法", render };
