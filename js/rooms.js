// 공부방(N1 · N3) 목록과 방 선택 화면
// 방마다 메뉴와 학습 기록 저장소가 따로 있다. N1은 "n1lab:", N3는 "n3lab:"에 저장한다.
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
import { createListStudy } from "./views/listStudy.js";
import n3home from "./views/n3/home.js";
import n3basics from "./views/n3/basics.js";
import n3practice from "./views/n3/practice.js";
import n3notes from "./views/n3/notes.js";
import n3more from "./views/n3/more.js";
import { award } from "./views/n3/game.js";

// N1 방에 추가한 PDF 목록 단어·문형 (기존 단어·문법 화면은 그대로 두고 메뉴를 하나 더한다)
const n1lists = createListStudy({
  id: "n1/lists", label: "PDF 단어·문형", jp: "単語帳", st: store, idPrefix: "n1pdf",
  title: "PDF 단어 · 문형",
  intro: "PDF 학습 목록에서 고른 N1 단어와 문형을 기존 단어 화면처럼 목록 · 플래시카드 · 퀴즈로 공부해요.",
  sets: [
    { key: "vocab", dataKey: "n1vocab", label: "어휘", area: "vocab" },
    { key: "grammar", dataKey: "n1grammar", label: "문형", area: "grammar" },
  ],
});

const n3onEvent = kind => award(kind);
const n3vocab = createListStudy({
  id: "n3/vocab", label: "N3 어휘", jp: "語彙", st: n3store, idPrefix: "n3", onEvent: n3onEvent,
  title: "N3 어휘", intro: "N3 학습 목록의 단어를 목록 · 플래시카드 · 퀴즈로 공부해요.",
  sets: [{ key: "vocab", dataKey: "n3vocab", label: "어휘", area: "vocab" }],
});
const n3grammar = createListStudy({
  id: "n3/grammar", label: "N3 문형", jp: "文法", st: n3store, idPrefix: "n3", onEvent: n3onEvent,
  title: "N3 문형", intro: "N3 학습 목록의 문형을 목록 · 플래시카드 · 퀴즈로 공부해요.",
  sets: [{ key: "grammar", dataKey: "n3grammar", label: "문형", area: "grammar" }],
});

export const ROOMS = {
  n1: {
    id: "n1", name: "N1 공부방", docTitle: "JLPT N1 合格!",
    eyebrow: "日本語能力試験 · N1", title: 'JLPT N1 <span lang="ja">合格!</span>',
    lede: "단어, 문법, 독해, 청해를 매일 조금씩. 틀린 문제는 자동으로 모아 두고, 시험 한 달 전에는 D-30 집중 모드로 마무리해요.",
    views: [home, vocab, grammar, n1lists, reading, listening, notes, sprint, mock, backup],
  },
  n3: {
    id: "n3", name: "N3 공부방", docTitle: "JLPT N3 合格!",
    eyebrow: "日本語能力試験 · N3", title: 'JLPT N3 <span lang="ja">合格!</span>',
    lede: "가나와 N5·N4 기초부터 N3 어휘·문형, 시험 대비까지. 4주 추천 일정을 참고해서 원하는 순서로 공부해요.",
    views: [n3home, n3basics, n3vocab, n3grammar, n3more, n3practice, n3notes],
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

/* ---------- 방 선택 화면 ---------- */
function renderRooms(app) {
  const n1Attempts = store.get("attempts").length;
  const n1Words = Object.keys(store.get("words")).length;
  const n3xp = (n3store.get("game") || {}).xp || 0;
  const n3Attempts = n3store.get("attempts").length;
  const last = lastRoom();
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>공부방 고르기</h2><p>방마다 메뉴와 학습 기록(진도, 오답, 단어장)이 완전히 따로 저장돼요.</p></div></div>' +
      '<div class="rooms">' +
        roomCard("n1", "N1 공부방", "日本語能力試験 N1", "단어 · 문법 · 독해 · 청해 · D-30 · 모의고사 · PDF 단어·문형",
          "문제 풀이 " + n1Attempts + "건 · 단어 기록 " + n1Words + "개", last === "n1") +
        roomCard("n3", "N3 공부방", "日本語能力試験 N3", "가나 · N5·N4 기초 · N3 어휘·문형 · 시험 대비 · 오답 노트",
          "문제 풀이 " + n3Attempts + "건 · " + n3xp + " XP", last === "n3") +
      "</div>" +
      '<p class="hint">학습 기록은 이 브라우저에만 저장돼요. 같은 기기에서 두 사람이 쓸 때는 자기 방을 골라서 공부하면 돼요.</p>' +
    "</section>";
}

function roomCard(id, name, jp, menu, stat, isLast) {
  return '<a class="room" href="#' + ROOMS[id].views[0].id + '">' +
    '<span class="room-level" lang="ja">' + id.toUpperCase() + "</span>" +
    '<span class="room-name">' + esc(name) + (isLast ? ' <span class="badge">마지막으로 연 방</span>' : "") + "</span>" +
    '<span class="room-jp" lang="ja">' + esc(jp) + "</span>" +
    '<span class="room-menu">' + esc(menu) + "</span>" +
    '<span class="room-stat">' + esc(stat) + "</span></a>";
}

export const roomsView = {
  id: "rooms", label: "방 고르기", render: renderRooms,
  docTitle: "JLPT 合格!", eyebrow: "日本語能力試験", title: 'JLPT <span lang="ja">合格!</span>',
  lede: "공부할 방을 골라 주세요. N1 방과 N3 방의 기록은 서로 섞이지 않아요.",
};
