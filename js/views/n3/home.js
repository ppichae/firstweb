// N3 방 · 홈: 시험까지 남은 날, 레벨·연속 학습, 4주 추천 일정(안내용), 과정별 진행
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc, fmtDate } from "../../util.js";
import { nextExam, daysUntil } from "../../exam.js";
import { noteEntries } from "../../stats.js";
import { level, streak, todayCount, XP_RULES } from "./game.js";
import { unitDone } from "./basics.js";

const WEEKS = [
  { n: 1, title: "가나 + N5", items: [["#n3/basics", "가나 표 · 가나 퀴즈"], ["#n3/basics", "기초 단원 1~6 (발음 · です · 조사 · こそあど · 형용사 · ます형)"]] },
  { n: 2, title: "N4 + N3 입문", items: [["#n3/basics", "기초 단원 7~8 (て형 · N4 핵심 문형)"], ["#n3/vocab", "N3 어휘 플래시카드 시작"], ["#n3/grammar", "N3 문형 목록 훑어보기"]] },
  { n: 3, title: "N3 집중", items: [["#n3/vocab", "N3 어휘 플래시카드 · 퀴즈"], ["#n3/grammar", "N3 문형 퀴즈"], ["#n3/exam", "영역별 연습"]] },
  { n: 4, title: "모의 테스트 + 복습", items: [["#n3/exam", "시간 제한 연습 테스트"], ["#n3/notes", "오답 노트 다시 풀기"]] },
];

// 시험일까지 남은 날로 지금 몇 주차쯤인지 안내한다 (강제가 아니다)
function suggestedWeek(days) {
  if (days === null) return null;
  return Math.min(4, Math.max(1, 4 - Math.floor((days - 1) / 7)));
}

function studied(prefix) {
  const l = n3store.get("lists");
  return Object.keys(l).filter(id => id.startsWith(prefix) && (l[id].srs || l[id].status)).length;
}

function render(app) {
  const exam = nextExam();
  const days = exam ? daysUntil(exam.date) : null;
  const week = suggestedWeek(days);
  const lv = level();
  const units = EXTRA.n3basics ? EXTRA.n3basics.units : [];
  const unitsDone = units.filter(u => unitDone(u.id)).length;
  const vocabTotal = EXTRA.n3vocab ? EXTRA.n3vocab.items.length : 0;
  const grammarTotal = EXTRA.n3grammar ? EXTRA.n3grammar.items.length : 0;
  const notes = noteEntries(n3store);
  const openNotes = notes.filter(n => !n.resolved).length;
  const tests = n3store.get("tests");
  const best = tests.length ? Math.max(...tests.map(t => Math.round(t.correct / t.total * 100))) : null;

  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>N3 공부방</h2><p>처음부터 시작해도 괜찮아요. 기초 → N3 집중 → 시험 대비 순서를 추천하지만, 원하는 메뉴로 자유롭게 이동해도 돼요.</p></div></div>' +
      '<div class="home-top">' +
        '<article class="tile exam-tile">' +
          (exam
            ? '<span class="tile-label">다음 시험 · ' + esc(exam.label) + '</span><span class="dday">D-' + days + "</span>" +
              '<span class="tile-sub">' + fmtDate(exam.date) + ' · <a href="' + exam.source + '" target="_blank" rel="noopener">공식 일정</a></span>'
            : '<span class="tile-label">다음 시험</span><span class="tile-sub">등록된 시험 날짜가 지났어요. <a href="https://www.jlpt.jp/" target="_blank" rel="noopener">공식 사이트</a>에서 확인하세요.</span>') +
        "</article>" +
        '<article class="tile"><span class="tile-label">레벨</span>' +
          '<span class="tile-value">Lv ' + lv.lv + ' <small class="xp">' + lv.xp + " XP</small></span>" +
          '<div class="bar wide" aria-hidden="true"><span style="width:' + (lv.into / lv.need * 100) + '%"></span></div>' +
          '<span class="tile-sub">다음 레벨까지 ' + (lv.need - lv.into) + " XP · 연속 학습 <b>" + streak() + "일</b> · 오늘 학습 " + todayCount() + "회</span>" +
        "</article>" +
      "</div>" +

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
          ["어휘", vocabTotal ? studied("n3-v") + " / " + vocabTotal + " 학습" : "콘텐츠 준비 중"],
          ["문형", grammarTotal ? studied("n3-g") + " / " + grammarTotal + " 학습" : "콘텐츠 준비 중"],
          ["한자 · 독해 · 청해", "콘텐츠 준비 중"],
        ]) +
        course("C", "시험 대비 과정", "#n3/exam", [
          ["연습 테스트", tests.length ? tests.length + "회 · 최고 " + best + "%" : "아직 없음"],
          ["다시 풀 오답", openNotes + "개"],
          ["실전 구성 모의고사", "콘텐츠 준비 중"],
        ]) +
      "</div>" +
      '<p class="hint">경험치: 맞힌 문제 +' + XP_RULES.correct + ", 틀린 문제도 +" + XP_RULES.wrong + ", 플래시카드 +" + XP_RULES.card + ", 단원 처음 완료 +" + XP_RULES.unit + ". 학습 기록은 N1 방과 따로 이 브라우저에 저장돼요.</p>" +
    "</section>";
}

function course(letter, title, href, rows) {
  return '<article class="card-box course"><div class="q-top"><h3><span class="course-letter">' + letter + "</span> " + esc(title) + '</h3><a href="' + href + '">열기</a></div>' +
    '<dl class="course-rows">' + rows.map(([t, v]) => "<div><dt>" + esc(t) + "</dt><dd>" + esc(v) + "</dd></div>").join("") + "</dl></article>";
}

export default { id: "n3", label: "홈", jp: "ホーム", needs: ["n3basics", "n3vocab", "n3grammar"], render };
