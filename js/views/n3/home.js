// N3 방 · 홈: N1 홈과 같은 구성(D-Day · 지금 할 일 · 숫자 칸) + 4주 추천 일정 · 과정별 진행
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc, pct } from "../../util.js";
import { daysUntil, examCardHTML, EXAM_INFO_N3 } from "../../exam.js";
import { noteEntries, statsHelpHTML, moreHTML } from "../../stats.js";
import { ddayTileHTML, bindDday, examTarget } from "../../dday.js";
import { level, streak, todayCount, XP_RULES } from "./game.js";
import { unitDone, coreUnits, openBasics } from "./basics.js";
import { n3vocab, n3grammar } from "./study.js";
import { growthCardHTML } from "../../badges.js";
import { n3SprintSummary } from "./sprint.js";
import { studyWeekHTML } from "../../summary.js";
import { weekCardHTML } from "../../weekchart.js";

const WEEKS = [
  { n: 1, title: "문자 + N5", items: [["#n3/basics", "히라가나 (50음도·퀴즈·쓰기)", "hira"], ["#n3/basics", "가타카나 (50음도·퀴즈·쓰기)", "kata"], ["#n3/basics", "문자 통합 학습 (구별·혼합 퀴즈)", "mix"], ["#n3/basics", "핵심 단원 1~6 (인사 · です · 조사 · こそあど · 형용사 · ます형)", "units"]] },
  { n: 2, title: "N4 + N3 입문", items: [["#n3/basics", "핵심 단원 7~8 (て형 · N4 핵심 문형)", "units"], ["#n3/vocab", "N3 단어 플래시카드 시작"], ["#n3/grammar", "N3 문법 목록 훑어보기"]] },
  { n: 3, title: "N3 집중", items: [["#n3/vocab", "N3 단어 플래시카드 · 퀴즈"], ["#n3/grammar", "N3 문법 퀴즈"], ["#n3/exam", "영역별 연습"]] },
  { n: 4, title: "모의 테스트 + 복습", items: [["#n3/mock", "모의고사 (시간 제한 테스트)"], ["#n3/notes", "오답 노트 다시 풀기"]] },
];

// 시험일까지 남은 날로 지금 몇 주차쯤인지 안내한다 (강제가 아니다)
function suggestedWeek(days) {
  if (days === null) return null;
  return Math.min(4, Math.max(1, 4 - Math.floor((days - 1) / 7)));
}

function render(app) {
  const target = examTarget(n3store);
  const week = suggestedWeek(target ? daysUntil(target.date) : null);
  const lv = level();
  const units = EXTRA.n3basics ? coreUnits(EXTRA.n3basics) : [];
  const nextUnit = units.find(u => !unitDone(u.id));
  const openNotes = noteEntries(n3store).filter(n => !n.resolved).length;
  const sprint = n3SprintSummary();
  const attempts = n3store.get("attempts");
  const correct = attempts.filter(a => a.correct).length;

  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>오늘의 학습</h2></div></div>' +
      studyWeekHTML(n3store, "N3") +
      '<div class="home-top">' +
        ddayTileHTML(n3store) +
        '<article class="tile todo-tile"><span class="tile-label">지금 할 일</span><ul class="todo">' +
          '<li><a href="#n3/basics">' + (nextUnit ? "다음 기초 단원" : "기초 단원") + "</a><strong>" + (nextUnit ? esc(nextUnit.title) : units.length ? "모두 완료" : "—") + "</strong></li>" +
          '<li><a href="#n3/vocab" data-goto="cards">복습할 단어</a><strong>' + n3vocab.reviewWordIds().length + "개</strong></li>" +
          '<li><a href="#n3/notes">다시 풀 오답</a><strong>' + openNotes + "개</strong></li>" +
          '<li><a href="#n3/exam">D-30 오늘의 목표</a><strong>' + (sprint ? sprint.done + " / " + sprint.total + " 완료" : "시작 전") + "</strong></li>" +
        "</ul></article>" +
      "</div>" +

      '<div class="tiles">' +
        tile("학습한 단어", n3vocab.studiedCount(), "/ " + n3vocab.total() + "개 · 공부 중 " + n3vocab.touchedCount() + "개") +
        tile("공부한 문법", n3grammar.studiedCount(), "/ " + n3grammar.total() + "개") +
        tile("누적 문제 풀이", attempts.length, attempts.length ? "정답률 " + pct(correct, attempts.length) + "%" : "문제") +
        tile("연속 학습", streak() + "일", "오늘 학습 " + todayCount() + "회") +
      "</div>" +
      growthCardHTML("n3", "#n3/badges") +
      moreHTML("학습 기록·일정 더 보기", statsHelpHTML("n3") + weekCardHTML(n3store) +
      '<article class="card-box"><div class="q-top"><h3>4주 추천 일정 <small class="hint">시험일 기준</small></h3><a href="#n3/roadmap">N5→N3 로드맵 보기 →</a></div>' +
        (week ? '<p class="hint">지금은 <b>' + week + "주차</b>쯤이에요.</p>" : "") +
        '<ol class="weeks">' + WEEKS.map(w =>
          '<li class="' + (w.n === week ? "now" : "") + '"><b>' + w.n + "주차 · " + esc(w.title) + "</b>" +
            "<ul>" + w.items.map(([h, t, m]) => '<li><a href="' + h + '"' + (m ? ' data-basics="' + m + '"' : "") + '>' + esc(t) + "</a></li>").join("") + "</ul></li>").join("") +
        "</ol>" +
      "</article>" +

      examCardHTML(EXAM_INFO_N3, "N3")) +
    "</section>";

  app.onclick = e => {
    const b = e.target.closest("[data-basics]");
    if (b) { e.preventDefault(); openBasics(b.dataset.basics); return; }
    const g = e.target.closest("[data-goto]");
    if (g) { e.preventDefault(); n3vocab.openMode(g.dataset.goto); }
  };
  bindDday(app, n3store, () => render(app));
}

function tile(label, value, sub) {
  return '<article class="tile"><span class="tile-label">' + label + '</span><span class="tile-value">' + esc(value) + '</span><span class="tile-sub">' + esc(sub) + "</span></article>";
}


export default { id: "n3", label: "홈", needs: ["n3basics", "n3vocab", "n3grammar", "sources", "kanji", "kanjiN3"], render };
