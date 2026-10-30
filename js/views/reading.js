// 독해 화면
import { DB } from "../data.js";
import { esc, multiline } from "../util.js";
import { mountQuestion } from "../quiz.js";

let current = null;

function render(app) {
  const passages = DB.reading.passages;
  const p = passages.find(x => x.id === current) || passages[0];
  current = p.id;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>독해</h2><p>지문을 읽고 질문에 답하세요. 다 풀면 해석을 확인해 보세요.</p></div>' +
        '<div class="toolbar"><span class="score" id="score"></span><button type="button" class="link-btn" id="reset">다시 풀기</button></div></div>' +
      '<div class="reading-layout">' +
        '<article class="passage">' +
          '<div class="passage-label"><span>' + esc(p.typeLabel) + "</span>" +
            '<button type="button" class="link-btn" id="toggle-trans" aria-expanded="false">해석 보기</button></div>' +
          p.texts.map(t => (t.label ? "<h3>" + esc(t.label) + "</h3>" : "") +
            t.paragraphs.map(par => '<p class="jp" lang="ja">' + multiline(par) + "</p>").join("")).join("") +
          '<div class="trans" id="trans" hidden>' +
            p.texts.map(t => t.translation.map(par => "<p>" + esc(par) + "</p>").join("")).join("") +
          "</div>" +
        "</article>" +
        '<div class="quiz" id="quiz"></div>' +
      "</div>" +
    "</section>";

  const trans = app.querySelector("#trans");
  const tbtn = app.querySelector("#toggle-trans");
  tbtn.onclick = () => {
    trans.hidden = !trans.hidden;
    tbtn.setAttribute("aria-expanded", !trans.hidden);
    tbtn.textContent = trans.hidden ? "해석 보기" : "해석 숨기기";
  };

  const results = new Map();
  const score = app.querySelector("#score");
  const updateScore = () => {
    const right = [...results.values()].filter(Boolean).length;
    score.textContent = results.size ? right + " / " + p.questions.length + " 정답" : "";
  };
  const quizEl = app.querySelector("#quiz");
  const mounted = p.questions.map((q, i) => {
    const el = document.createElement("div");
    quizEl.appendChild(el);
    return mountQuestion(el, Object.assign({ area: "reading" }, q), {
      number: i + 1, wide: true, onAnswer: ok => { results.set(q.id, ok); updateScore(); },
    });
  });
  app.querySelector("#reset").onclick = () => { results.clear(); mounted.forEach(m => m.reset()); updateScore(); };
}

export default { id: "reading", label: "독해", jp: "読解", render };
