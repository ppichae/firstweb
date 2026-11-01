// 공부방(N1 · N3) 목록과 방 선택 화면
// 두 방은 같은 메뉴 구조(홈 · 단어 · 문법 · 독해 · 청해 · 오답 노트 …)를 쓰고, 학습 기록 저장소만 따로 쓴다.
// N1은 "n1lab:", N3는 "n3lab:"에 저장한다.
import { store, n3store } from "./store.js";
import { esc } from "./util.js";
import vocab from "./views/vocab.js";
import grammar from "./views/grammar.js";
import reading from "./views/reading.js";
import listening from "./views/listening.js";
import notes from "./views/notes.js";
import home from "./views/home.js";
import sprint from "./views/sprint.js";
import mock from "./views/mock.js";
import backup from "./views/backup.js";
import n3home from "./views/n3/home.js";
import n3roadmap from "./views/n3/roadmap.js";
import n3basics from "./views/n3/basics.js";
import n3practice, { n3MockView } from "./views/n3/practice.js";
import n3notes from "./views/n3/notes.js";
import { n3Reading as n3reading } from "./views/reading.js";
import { n3Listening as n3listening } from "./views/listening.js";
import { n3vocab, n3grammar } from "./views/n3/study.js";
import { createTogetherView } from "./views/together.js";
import { createBackupView } from "./views/backup.js";
import { summaryOf } from "./summary.js";
import { createKanjiView } from "./views/kanji.js";
import { createBadgesView } from "./badges.js";

// N1 홈과 D-30은 PDF 목록 단어·문형까지 합친 숫자를 보여 주므로 그 자료를 먼저 불러온다
home.needs = ["n1vocab", "n1grammar", "sources", "kanji"];
sprint.needs = ["n1vocab", "sources"];

export const ROOMS = {
  n1: {
    id: "n1", name: "N1 공부방", st: store, docTitle: "JLPT N1 合格!",
    eyebrow: "日本語能力試験 · N1", title: 'JLPT N1 <span lang="ja">合格!</span>',
    lede: "단어, 문법, 독해, 청해를 매일 조금씩. 틀린 문제는 자동으로 모아 두고, 시험 한 달 전에는 D-30 집중 모드로 마무리해요.",
    views: [home, vocab, grammar, createKanjiView("kanji", "n1"), reading, listening, notes, sprint, mock, createTogetherView("together", "n1"), backup, createBadgesView("badges", "n1", "home")],
  },
  n3: {
    id: "n3", name: "N3 공부방", st: n3store, docTitle: "JLPT N3 合格!",
    eyebrow: "日本語能力試験 · N3", title: 'JLPT N3 <span lang="ja">合格!</span>',
    lede: "히라가나·가타카나와 N5·N4 기초부터 N3 단어·문법·한자, 시험 대비까지. 4주 추천 일정을 참고해서 원하는 순서로 공부해요.",
    views: [n3home, n3roadmap, n3basics, n3vocab.view, n3grammar.view, createKanjiView("n3/kanji", "n3"), n3reading, n3listening, n3notes, n3practice, n3MockView, createTogetherView("n3/together", "n3"), createBackupView("n3/backup", "n3"), createBadgesView("n3/badges", "n3", "n3")],
  },
};

const LAST_KEY = "jlpt:room";
export function lastRoom() {
  try { const r = localStorage.getItem(LAST_KEY); return ROOMS[r] ? r : null; } catch (e) { return null; }
}
export function rememberRoom(id) { try { localStorage.setItem(LAST_KEY, id); } catch (e) { /* 저장소를 못 쓰면 기억하지 않는다 */ } }

// 예전부터 N1 사이트를 쓰던 사람인지 (N1 기록이 하나라도 있으면 첫 화면을 N1 홈으로 둔다)
export function hasN1Records() {
  try { return Object.keys(localStorage).some(k => k.startsWith(store.prefix)); } catch (e) { return false; }
}

/* ---------- 급수 선택 화면 ---------- */
function renderRooms(app) {
  const last = lastRoom();
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>급수 선택</h2><p>공부할 급수를 골라 주세요. N1과 N3는 진도, 오답, 단어장, 학습 기록이 따로 저장돼요.</p></div></div>' +
      '<div class="rooms">' +
        roomCard("n1", summaryOf("n1"), "고급 단어·문법·한자 · 독해 · 청해 · 시험 대비(D-30) · 모의고사", last === "n1") +
        roomCard("n3", summaryOf("n3"), "히라가나·가타카나부터 N5·N4 기초 · N3 단어·문법·한자 · 시험 대비(D-30) · 모의고사", last === "n3") +
      "</div>" +
    "</section>";
}

function roomCard(id, s, menu, isLast) {
  return '<a class="room" href="#' + ROOMS[id].views[0].id + '">' +
    '<span class="room-level" lang="ja">' + id.toUpperCase() + "</span>" +
    '<span class="room-name">' + esc(ROOMS[id].name) + (isLast ? ' <span class="badge">마지막으로 연 방</span>' : "") + "</span>" +
    '<span class="room-menu">' + esc(menu) + "</span>" +
    '<span class="room-stat">오늘 ' + s.todayMin + "분 · 연속 " + s.streak + "일 · 진도 " + s.progressPct + "%</span></a>";
}

export const roomsView = {
  id: "rooms", label: "급수 선택", render: renderRooms,
  needs: ["n1vocab", "n1grammar", "n3vocab", "n3grammar", "n3basics", "sources"],
  docTitle: "JLPT 合格!", eyebrow: "日本語能力試験", title: 'JLPT <span lang="ja">合格!</span>',
  lede: "공부할 급수를 골라 주세요. N1과 N3 학습 기록은 서로 섞이지 않아요.",
};
