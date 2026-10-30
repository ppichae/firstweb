// N3 방 · 홈: N1 홈과 같은 구성(D-Day · 지금 할 일 · 숫자 칸) + 4주 추천 일정 · 과정별 진행
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc, pct } from "../../util.js";
import { daysUntil } from "../../exam.js";
import { noteEntries } from "../../stats.js";
import { ddayTileHTML, bindDday, examTarget } from "../../dday.js";
import { level, streak, todayCount, XP_RULES } from "./game.js";
import { unitDone } from "./basics.js";
import { n3vocab, n3grammar } from "./study.js";
import { badgesOf } from "../../summary.js";
import { roomKanjiList } from "../../kanji.js";

const WEEKS = [
  { n: 1, title: "가나 + N5", items: [["#n3/basics", "가나 표 · 가나 퀴즈"], ["#n3/basics", "기초 단원 1~7 (발음 · 인사 · です · 조사 · こそあど · 형용사 · ます형)"]] },
  { n: 2, title: "N4 + N3 입문", items: [["#n3/basics", "기초 단원 8~9 (て형 · N4 핵심 문형)"], ["#n3/vocab", "N3 단어 플래시카드 시작"], ["#n3/grammar", "N3 문법 목록 훑어보기"]] },
  { n: 3, title: "N3 집중", items: [["#n3/vocab", "N3 단어 플래시카드 · 퀴즈"], ["#n3/grammar", "N3 문법 퀴즈"], ["#n3/exam", "영역별 연습"]] },
  { n: 4, title: "모의 테스트 + 복습", items: [["#n3/exam", "시간 제한 연습 테스트"], ["#n3/notes", "오답 노트 다시 풀기"]] },
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
  const units = EXTRA.n3basics ? EXTRA.n3basics.units : [];
  const unitsDone = units.filter(u => unitDone(u.id)).length;
  const nextUnit = units.find(u => !unitDone(u.id));
  const openNotes = noteEntries(n3store).filter(n => !n.resolved).length;
  const attempts = n3store.get("attempts");
  const correct = attempts.filter(a => a.correct).length;
  const kanjiSet = roomKanjiList("n3");
  const tests = n3store.get("tests");
  const best = tests.length ? Math.max(...tests.map(t => Math.round(t.correct / t.total * 100))) : null;

  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>오늘의 학습</h2><p>처음부터 시작해도 괜찮아요. 기초 → N3 집중 → 시험 대비 순서를 추천하지만, 원하는 메뉴로 자유롭게 이동해도 돼요.</p></div></div>' +
      '<div class="home-top">' +
        ddayTileHTML(n3store) +
        '<article class="tile todo-tile"><span class="tile-label">지금 할 일</span><ul class="todo">' +
          '<li><a href="#n3/basics">' + (nextUnit ? "다음 기초 단원" : "기초 단원") + "</a><strong>" + (nextUnit ? esc(nextUnit.title) : units.length ? "모두 완료" : "준비 중") + "</strong></li>" +
          '<li><a href="#n3/vocab" data-goto="cards">복습할 단어</a><strong>' + n3vocab.reviewWordIds().length + "개</strong></li>" +
          '<li><a href="#n3/notes">다시 풀 오답</a><strong>' + openNotes + "개</strong></li>" +
        "</ul></article>" +
      "</div>" +

      '<div class="tiles">' +
        tile("학습한 단어", n3vocab.studiedCount(), "/ " + n3vocab.total() + "개") +
        tile("공부한 문법", n3grammar.studiedCount(), "/ " + n3grammar.total() + "개") +
        tile("누적 문제 풀이", attempts.length, attempts.length ? "정답률 " + pct(correct, attempts.length) + "%" : "문제") +
        '<article class="tile"><span class="tile-label">레벨</span><span class="tile-value">Lv ' + lv.lv + ' <small class="xp">' + lv.xp + " XP</small></span>" +
          '<div class="bar wide" aria-hidden="true"><span style="width:' + (lv.into / lv.need * 100) + '%"></span></div>' +
          '<span class="tile-sub">연속 학습 <b>' + streak() + "일</b> · 오늘 " + todayCount() + "회</span></article>" +
      "</div>" +

      badgeCard() +
      '<article class="card-box"><div class="q-top"><h3>4주 추천 일정</h3><span class="badge">안내용</span></div>' +
        '<p class="hint">시험일까지 남은 날로 계산한 추천이에요. ' + (week ? "지금은 <b>" + week + "주차</b>쯤이에요. " : "") + "순서대로 하지 않아도 되고, 언제든 다른 주차의 공부를 해도 돼요.</p>" +
        '<ol class="weeks">' + WEEKS.map(w =>
          '<li class="' + (w.n === week ? "now" : "") + '"><b>' + w.n + "주차 · " + esc(w.title) + "</b>" +
            "<ul>" + w.items.map(([h, t]) => '<li><a href="' + h + '">' + esc(t) + "</a></li>").join("") + "</ul></li>").join("") +
        "</ol>" +
      "</article>" +

      '<div class="courses">' +
        course("A", "기초 과정 (N5·N4)", "#n3/basics", [
          ["핵심 단원", units.length ? unitsDone + " / " + units.length + " 완료" : "준비 중"],
          ["가나 표 · 퀴즈", "있음"],
          ["N5·N4 단어 · 기초 한자", "콘텐츠 준비 중"],
        ]) +
        course("B", "N3 집중 과정", "#n3/vocab", [
          ["단어", n3vocab.total() ? n3vocab.studiedCount() + " / " + n3vocab.total() + " 학습" : "콘텐츠 준비 중"],
          ["문법", n3grammar.total() ? n3grammar.studiedCount() + " / " + n3grammar.total() + " 공부함" : "콘텐츠 준비 중"],
          ["한자", kanjiSet.length ? kanjiSet.filter(c => (n3store.get("kanji")[c] || {}).seen).length + " / " + kanjiSet.length + " 살펴봄" : "콘텐츠 준비 중"],
          ["독해 · 청해", "콘텐츠 준비 중"],
        ]) +
        course("C", "시험 대비 과정", "#n3/exam", [
          ["연습 테스트", tests.length ? tests.length + "회 · 최고 " + best + "%" : "아직 없음"],
          ["다시 풀 오답", openNotes + "개"],
          ["실전 구성 모의고사", "콘텐츠 준비 중"],
        ]) +
      "</div>" +
      '<p class="hint">경험치: 맞힌 문제 +' + XP_RULES.correct + ", 틀린 문제도 +" + XP_RULES.wrong + ", 플래시카드 +" + XP_RULES.card + ", 단원 처음 완료 +" + XP_RULES.unit + ". 학습 기록은 N1 방과 따로 이 브라우저에 저장돼요.</p>" +
    "</section>";

  app.onclick = e => {
    const g = e.target.closest("[data-goto]");
    if (g) { e.preventDefault(); n3vocab.openMode(g.dataset.goto); }
  };
  bindDday(app, n3store, () => render(app));
}

function tile(label, value, sub) {
  return '<article class="tile"><span class="tile-label">' + label + '</span><span class="tile-value">' + esc(value) + '</span><span class="tile-sub">' + esc(sub) + "</span></article>";
}

function course(letter, title, href, rows) {
  return '<article class="card-box course"><div class="q-top"><h3><span class="course-letter">' + letter + "</span> " + esc(title) + '</h3><a href="' + href + '">열기 →</a></div>' +
    '<dl class="course-rows">' + rows.map(([t, v]) => "<div><dt>" + esc(t) + "</dt><dd>" + esc(v) + "</dd></div>").join("") + "</dl></article>";
}

export default { id: "n3", label: "홈", needs: ["n3basics", "n3vocab", "n3grammar", "sources", "kanji", "kanjiN3"], render };

function badgeCard() {
  const list = badgesOf("n3");
  const got = list.filter(b => b.got).length;
  return '<article class="card-box"><div class="q-top"><h3>학습 배지</h3><span class="hint">' + got + " / " + list.length + " 받음</span></div>" +
    '<ul class="medals">' + list.map(b =>
      '<li class="medal-item' + (b.got ? " got" : "") + '"><b>' + esc(b.name) + "</b><small>" + esc(b.desc) + "</small>" +
      '<span class="sr-only">' + (b.got ? "받음" : "아직 못 받음") + "</span></li>").join("") + "</ul></article>";
}
