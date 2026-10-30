// 홈 대시보드: 실제 학습 기록으로만 계산한 현황
import { store } from "../store.js";
import { esc, AREAS, pct, pctText } from "../util.js";
import { areaStats, recentDays, unresolvedNotes, weakAreas, judgedAreas, MIN_FOR_WEAKNESS, WEAK_BELOW } from "../stats.js";
import { reviewWordIds, openVocabMode, vocabStudied, vocabTotal } from "./vocab.js";
import { grammarStudied, grammarTotal } from "./grammar.js";
import { ddayTileHTML, bindDday } from "../dday.js";
import { growthCardHTML } from "../badges.js";
import { EXAM_INFO } from "../exam.js";
import { sprintSummary } from "./sprint.js";

function render(app) {
  const attempts = store.get("attempts");
  const correct = attempts.filter(a => a.correct).length;
  const areas = areaStats();
  const days = recentDays(7);
  const weak = weakAreas();
  const dueWords = reviewWordIds().length;
  const openNotes = unresolvedNotes().length;
  const sprint = sprintSummary();

  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>오늘의 학습</h2><p>모든 숫자는 이 브라우저에 저장된 실제 학습 기록으로 계산해요.</p></div></div>' +

      '<div class="home-top">' +
        ddayTileHTML(store) +
        '<article class="tile todo-tile"><span class="tile-label">지금 할 일</span><ul class="todo">' +
          '<li><a href="#vocab" data-goto="cards">복습할 단어</a><strong>' + dueWords + "개</strong></li>" +
          '<li><a href="#notes">다시 풀 오답</a><strong>' + openNotes + "개</strong></li>" +
          '<li><a href="#sprint">D-30 오늘의 목표</a><strong>' + (sprint ? sprint.done + " / " + sprint.total + " 완료" : "시작 전") + "</strong></li>" +
        "</ul></article>" +
      "</div>" +

      '<div class="tiles">' +
        tile("학습한 단어", vocabStudied(), "/ " + vocabTotal() + "개") +
        tile("공부한 문법", grammarStudied(), "/ " + grammarTotal() + "개") +
        tile("누적 문제 풀이", attempts.length, "문제") +
        tile("전체 정답률", attempts.length ? pct(correct, attempts.length) + "%" : "기록 없음", attempts.length ? correct + "문제 정답" : "") +
      "</div>" +
      growthCardHTML("n1", "#badges") +

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

      '<article class="card-box"><div class="panel-head"><h3>최근 7일 학습량</h3><span class="hint">푼 문제 + 플래시카드 복습 · 합계 ' +
        days.reduce((n, d) => n + d.total, 0) + "</span></div>" + weekChart(days) + "</article>" +

      '<article class="card-box"><h3>시험 구성</h3><dl class="facts">' +
        EXAM_INFO.sections.map(s => '<div class="fact"><dt>' + esc(s.name) + "</dt><dd>" + s.minutes + "분</dd></div>").join("") +
        '<div class="fact"><dt>합격 기준</dt><dd>' + esc(EXAM_INFO.pass) + "</dd></div></dl>" +
        '<p class="hint">출처: <a href="' + EXAM_INFO.source + '" target="_blank" rel="noopener">JLPT 공식 사이트</a></p></article>' +
    "</section>";

  app.onclick = e => {
    const g = e.target.closest("[data-goto]");
    if (g) { e.preventDefault(); openVocabMode(g.dataset.goto); }
  };
  bindDday(app, store, () => render(app));
}

function tile(label, value, sub) {
  return '<article class="tile"><span class="tile-label">' + label + '</span><span class="tile-value">' + esc(value) + '</span><span class="tile-sub">' + esc(sub) + "</span></article>";
}

// 최근 7일 막대그래프: 막대 하나 = 하루. 값은 막대에 올리거나 선택하면 보인다
function weekChart(days) {
  const max = Math.max(...days.map(d => d.total));
  if (!max) return '<p class="empty">최근 7일 동안 학습 기록이 없어요.</p>';
  const W = ["일", "월", "화", "수", "목", "금", "토"];
  return '<div class="week" role="list">' + days.map((d, i) => {
    const [y, m, dd] = d.key.split("-").map(Number);
    const wd = W[new Date(y, m - 1, dd).getDay()];
    const label = m + "/" + dd + "(" + wd + ")";
    const h = d.total ? Math.max(4, Math.round(d.total / max * 100)) : 0;
    const tip = label + " · 문제 " + d.questions + " · 카드 " + d.cards;
    return '<div class="week-col" role="listitem" tabindex="0" aria-label="' + tip + '">' +
      '<span class="week-tip">' + tip + "</span>" +
      '<span class="week-bar-wrap"><span class="week-bar" style="height:' + h + '%"></span></span>' +
      '<span class="week-val">' + (i === days.length - 1 || d.total === max ? d.total : "") + "</span>" +
      '<span class="week-day' + (i === days.length - 1 ? " today" : "") + '">' + (i === days.length - 1 ? "오늘" : label) + "</span></div>";
  }).join("") + "</div>" +
  '<table class="sr-only"><caption>최근 7일 학습량</caption><tr><th>날짜</th><th>푼 문제</th><th>카드 복습</th></tr>' +
    days.map(d => "<tr><td>" + d.key + "</td><td>" + d.questions + "</td><td>" + d.cards + "</td></tr>").join("") + "</table>";
}

export default { id: "home", label: "홈", render };
