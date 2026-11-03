// 홈 대시보드: 실제 학습 기록으로만 계산한 현황
import { store } from "../store.js";
import { esc, AREAS, pct, pctText } from "../util.js";
import { areaStats, unresolvedNotes, weakAreas, judgedAreas, MIN_FOR_WEAKNESS, WEAK_BELOW, statsHelpHTML, moreHTML, statTileHTML } from "../stats.js";
import { reviewWordIds, openVocabMode, vocabStudied, vocabTotal, vocabTouched } from "./vocab.js";
import { grammarStudied, grammarTotal } from "./grammar.js";
import { ddayTileHTML, bindDday } from "../dday.js";
import { growthCardHTML } from "../badges.js";
import { weekCardHTML } from "../weekchart.js";
import { EXAM_INFO, examCardHTML } from "../exam.js";
import { sprintSummary } from "./sprint.js";
import { studyWeekHTML } from "../summary.js";

function render(app) {
  const attempts = store.get("attempts");
  const correct = attempts.filter(a => a.correct).length;
  const areas = areaStats();

  const weak = weakAreas();
  const dueWords = reviewWordIds().length;
  const openNotes = unresolvedNotes().length;
  const sprint = sprintSummary();

  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>오늘의 학습</h2></div></div>' +
      studyWeekHTML(store, "N1") +

      '<div class="home-top">' +
        ddayTileHTML(store) +
        '<article class="tile todo-tile"><span class="tile-label">지금 할 일</span><ul class="todo">' +
          '<li><a href="#vocab" data-goto="cards">복습할 단어</a><strong>' + dueWords + "개</strong></li>" +
          '<li><a href="#notes">다시 풀 오답</a><strong>' + openNotes + "개</strong></li>" +
          '<li><a href="#sprint">D-30 오늘의 목표</a><strong>' + (sprint ? sprint.done + " / " + sprint.total + " 완료" : "시작 전") + "</strong></li>" +
        "</ul></article>" +
      "</div>" +

      '<div class="tiles">' +
        statTileHTML("학습한 단어", vocabStudied(), "/ " + vocabTotal() + "개 · 공부 중 " + vocabTouched() + "개", { tone: "mint", icon: "book", pct: vocabTotal() ? vocabStudied() / vocabTotal() * 100 : 0 }) +
        statTileHTML("공부한 문법", grammarStudied(), "/ " + grammarTotal() + "개", { tone: "sky", icon: "pen", pct: grammarTotal() ? grammarStudied() / grammarTotal() * 100 : 0 }) +
        statTileHTML("누적 문제 풀이", attempts.length, "문제", { tone: "lav", icon: "check" }) +
        statTileHTML("전체 정답률", attempts.length ? pct(correct, attempts.length) + "%" : "기록 없음", attempts.length ? correct + "문제 정답" : "", { tone: "peach", icon: "target", pct: attempts.length ? pct(correct, attempts.length) : null }) +
      "</div>" +
      weekCardHTML(store) +
      growthCardHTML("n1", "#badges") +

      moreHTML("학습 기록 더 보기", statsHelpHTML("n1") +
      '<div class="home-grid">' +
        '<article class="card-box"><h3>영역별 정답률</h3><div class="meters">' +
          Object.entries(areas).map(([k, r]) =>
            '<div class="meter"><span class="meter-name">' + AREAS[k] + "</span>" +
            '<span class="meter-track" aria-hidden="true"><span style="width:' + (r.rate || 0) + '%"></span></span>' +
            '<span class="meter-val">' + pctText(r.rate) + (r.total ? ' <small>' + r.correct + "/" + r.total + "</small>" : "") + "</span></div>").join("") +
        "</div></article>" +
        '<article class="card-box"><h3>영역별 약점</h3>' +
          (weak.length
            ? '<ol class="weak">' + weak.map(([k, r]) => "<li><b>" + AREAS[k] + "</b> 정답률 " + r.rate + "% <small>(" + r.total + "문제)</small></li>").join("") + "</ol>" +
              '<p class="hint">' + MIN_FOR_WEAKNESS + "문제 이상 푼 영역 중 정답률 " + WEAK_BELOW + "% 미만인 영역이에요. 맨 위부터 보완해 보세요.</p>"
            : judgedAreas().length
              ? '<p class="hint">기록이 있는 영역(' + judgedAreas().map(([k]) => AREAS[k]).join("·") + ")은 모두 정답률 " + WEAK_BELOW + "% 이상이에요.</p>"
              : '<p class="hint">아직 판단할 기록이 부족해요. 영역별로 ' + MIN_FOR_WEAKNESS + "문제 이상 풀면 약점을 보여 드려요.</p>") +
        "</article>" +
      "</div>" +
      examCardHTML(EXAM_INFO, "N1")) +
    "</section>";

  app.onclick = e => {
    const g = e.target.closest("[data-goto]");
    if (g) { e.preventDefault(); openVocabMode(g.dataset.goto); }
  };
  bindDday(app, store, () => render(app));
}

export default { id: "home", label: "홈", render };
