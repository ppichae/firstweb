// 학습 기록 저장소
// 지금은 브라우저의 LocalStorage에 저장한다. 그래서 다른 브라우저나 기기와는 자동으로 공유되지 않는다.
// 나중에 서버 데이터베이스로 옮길 때는 이 파일의 read / write 부분을 서버 요청으로 바꾸면 된다.
// 방(N1 · N3)마다 저장소를 따로 만든다. 앞이름(prefix)이 달라서 기록이 서로 섞이지 않는다.

import { today } from "./util.js";
import { syncRoom, viewEnsure, change as syncChange, importData, resetRoom, syncStatus } from "./sync.js";

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const VERSION = 1;

// N1 방에서 저장하는 기록의 종류와 처음 값
const N1_DEFAULTS = {
  words: {},       // 단어 id → { status: "known" | "unknown", fav: true, srs: {...}, wrong: 틀린 횟수 }
  grammar: {},     // 문법 id → { studied: "2026-10-30", fav: true }
  attempts: [],    // 문제 풀이 기록 { qid, area, choice, correct, at, mode }
  sprint: null,    // D-30 집중 모드 설정과 진행 상황
  mocks: [],       // 모의고사 결과
  activity: {},    // 날짜 → { cards: 플래시카드 복습 수 }
  lists: {},       // PDF 단어·문형 목록 id → { status, fav, srs, wrong } (3단계에서 추가)
  examDate: null,  // 내가 정한 시험일 (없으면 공식 다음 시험일)
  profile: null,   // { name: 화면에 보일 이름 }
  goal: null,      // { weeklyMinutes: 이번 주 목표 학습 시간(분) }
  cheers: [],      // 이 사람이 보낸 응원 메시지 { text, at }
  game: null,      // 경험치 { xp } — 처음 열 때 기존 기록으로 한 번 환산(game.js)
  badges: {},      // 배지 → 처음 받은 날
  kanji: {},       // 한자 → { seen: 처음 본 날, last, fav }
};

// 정해 두지 않은 종류(예: N3 방의 "words")를 물으면 오류 없이 undefined를 돌려준다
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function createStore(PREFIX, APP_ID, DEFAULTS) {
  const KEYS = Object.keys(DEFAULTS);
  const cache = {};
  let storageOK = true;

  // 로그인한 계정으로 동기화 중이면 계정 기록(sync.js)을 읽고 쓴다. 아니면 지금까지처럼 이 브라우저(localStorage)
  function read(key) {
    const room = syncRoom(PREFIX);
    if (room) return viewEnsure(room, key, clone(DEFAULTS[key]));
    if (key in cache) return cache[key];
    let value = clone(DEFAULTS[key]);
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) value = JSON.parse(raw);
    } catch (e) { storageOK = false; }
    cache[key] = value;
    return value;
  }

  function write(key, value) {
    const room = syncRoom(PREFIX);
    if (room) { syncChange(room, key, clone(read(key)), value); return; }
    cache[key] = value;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (e) { storageOK = false; }
  }

  return {
    prefix: PREFIX,
    get: read,
    set: write,
    // 기록을 꺼내서 고친 뒤 다시 저장한다
    update(key, fn) {
      const room = syncRoom(PREFIX);
      if (room) {   // 바뀌기 전 모습을 먼저 떠 두어야 무엇이 바뀌었는지 알 수 있다
        const before = clone(read(key)), v = read(key), r = fn(v);
        syncChange(room, key, before, r === undefined ? v : r);
        return;
      }
      const v = read(key); const r = fn(v); write(key, r === undefined ? v : r);
    },
    get available() { return syncRoom(PREFIX) ? !syncStatus().storageError : storageOK; },

    // 문제를 풀 때마다 한 줄씩 남긴다. 오답 노트와 대시보드는 모두 이 기록으로 계산한다
    // 자동으로 만든 문제(무작위 단어 퀴즈 등)는 자료 파일에 없으므로 문제 내용도 함께 남긴다
    recordAttempt(q, choice, mode = "practice") {
      this.update("attempts", list => {
        const rec = { id: newId(), qid: q.id, area: q.area, choice, correct: choice === q.answer, at: Date.now(), mode };   // id: 동기화용 고유 번호
        if (q.generated) rec.snap = { kind: q.kind, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation, wordId: q.wordId };
        list.push(rec);
        if (this.onAttempt) this.onAttempt(rec);   // 경험치 등 (N1 방에서 game.js가 연결)
      });
    },

    // 오늘 한 학습량을 센다 (예: 플래시카드 복습)
    logActivity(kind, n = 1) {
      const key = today();
      this.update("activity", a => { a[key] = a[key] || {}; a[key][kind] = (a[key][kind] || 0) + n; });
    },

    // 백업: 모든 기록을 하나의 파일 내용으로 만든다
    exportAll() {
      const data = {};
      KEYS.forEach(k => { data[k] = read(k); });
      return { app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), data };
    },
    // 복원: 백업 파일 내용으로 기록을 바꾼다. 형식이 맞지 않으면 아무것도 바꾸지 않는다
    importAll(obj) {
      if (!obj || obj.app !== APP_ID || typeof obj.data !== "object") {
        throw new Error("이 사이트에서 만든 백업 파일이 아니에요.");
      }
      // 계정으로 동기화 중이면 덮어쓰지 않고 '가져오기'로 올린다 (같은 기록은 두 번 들어가지 않고, 나중에 취소할 수 있다)
      const room = syncRoom(PREFIX);
      if (room) return importData({ [room]: obj.data }, "backup-file", "백업 파일 " + (obj.exportedAt || ""));
      KEYS.forEach(k => { if (k in obj.data) write(k, obj.data[k]); });
    },
    // 기록 지우기. 계정으로 동기화 중이면 서버의 이 학습실 기록만 지운다
    resetAll() {
      const room = syncRoom(PREFIX);
      if (room) return resetRoom(room);
      KEYS.forEach(k => write(k, clone(DEFAULTS[k])));
    },

    // 예전 버전(외운 단어만 저장)의 기록을 새 구조로 옮긴다
    migrateLegacy(vocabItems) {
      try {
        const raw = localStorage.getItem("n1-known-words");
        if (!raw || localStorage.getItem(PREFIX + "migrated")) return;
        const old = JSON.parse(raw);
        this.update("words", words => {
          old.forEach(text => {
            const item = vocabItems.find(v => v.word === text);
            if (item) words[item.id] = Object.assign(words[item.id] || {}, { status: "known" });
          });
        });
        localStorage.setItem(PREFIX + "migrated", "1");
      } catch (e) { /* 옮길 기록이 없거나 저장소를 쓸 수 없으면 건너뛴다 */ }
    },
  };
}

// N1 방: 예전부터 쓰던 "n1lab:" 기록을 그대로 쓴다 (옮기거나 지우지 않는다)
export const store = createStore("n1lab:", "jlpt-n1-goukaku", N1_DEFAULTS);

// N3 방: "n3lab:"에 따로 저장한다
export const n3store = createStore("n3lab:", "jlpt-n3-room", {
  lists: {},       // N3 단어·문형 id → { status, fav, srs, wrong }
  basics: {},      // 기초 단원 id → { done: "2026-11-01", best: 맞힌 수 }
  kana: {},        // 가나 글자 → { right, wrong }
  attempts: [],    // 문제 풀이 기록 (N1과 같은 모양)
  activity: {},    // 날짜 → { cards, questions }
  tests: [],       // 시간 제한 연습 테스트 결과
  sprint: null,    // D-30 계획 설정 { examDate, minutes, startedAt }
  game: { xp: 0 }, // 경험치
  examDate: null,  // 내가 정한 시험일
  profile: null,
  goal: null,
  cheers: [],
  kanji: {},
  kanaProgress: { hira: {}, kata: {} },  // 문자별 퀴즈 기록 { right, wrong } — 히라가나·가타카나 따로
  kanaWritten: { hira: {}, kata: {} },   // 문자별 쓰기 연습 횟수
  badges: {},      // 배지 → 처음 받은 날
});
