// 경험치(XP) · 레벨 · 칭호 (N1 방과 N3 방이 같은 구조, 기록과 기준은 따로)
// XP는 실제 학습 활동(문제 풀이, 카드 복습, 단원·문자·한자 학습)으로만 오른다. 학습 시간만으로는 오르지 않는다.
// N1·N3의 레벨은 각 방 안의 성장 단계예요. 같은 레벨 숫자라도 두 급수의 실력이 같다는 뜻이 아니에요.
import { store, n3store } from "./store.js";
import { today, esc } from "./util.js";

const ROOM = { n1: store, n3: n3store };
export const XP_RULES = { correct: 5, wrong: 1, card: 2, unit: 30, kana: 2, write: 2 };
export const XP_TEXT = "맞힌 문제 +5 · 틀린 문제 +1 · 카드 복습 +2 · 단원 완료 +30 · 문자 연습 +2 · 쓰기 연습 +2 (같은 문제·카드·글자는 하루에 처음 한 번만)";

// 레벨은 50까지, 10레벨마다 한 단계. 다음 레벨까지 필요한 경험치는 조금씩 늘어난다.
// 예전 10레벨 표(N3 Lv10 = 1200, N1 Lv10 = 3200)보다 같은 경험치에서 레벨이 낮아지지 않게 잡았다.
export const MAX_LV = 50;
const SCALE = { n3: 20, n1: 40 };
export const STAGES = {
  n3: [["🌱", "새싹"], ["🍙", "기초 다지기"], ["🚃", "실력 쌓기"], ["🗻", "숙련"], ["🏯", "마스터"]],
  n1: [["📘", "입문"], ["✍️", "기초 다지기"], ["🧭", "실력 향상"], ["🦉", "숙련"], ["👑", "마스터"]],
};
// lv 레벨이 되는 데 필요한 누적 경험치
// 레벨마다 다음 레벨까지의 간격을 10 단위로 반올림해서 더한다 (간격이 앞 레벨보다 줄지 않는다)
const TABLE = {};
Object.keys(SCALE).forEach(r => { const t = [0, 0]; for (let lv = 2; lv <= MAX_LV; lv++) t[lv] = t[lv - 1] + Math.round(SCALE[r] * (Math.pow(lv - 1, 1.6) - Math.pow(lv - 2, 1.6)) / 10) * 10; TABLE[r] = t; });
export const xpFor = (roomId, lv) => TABLE[roomId][Math.max(1, Math.min(MAX_LV, lv))];
export function levelInfo(roomId, lv) {
  const [emoji, title] = STAGES[roomId][Math.floor((lv - 1) / 10)];
  return { lv, emoji, title, from: xpFor(roomId, lv), to: lv < MAX_LV ? xpFor(roomId, lv + 1) : null, stage: Math.floor((lv - 1) / 10) + 1 };
}
const lvOfXp = (roomId, xp) => { let lv = 1; while (lv < MAX_LV && xp >= xpFor(roomId, lv + 1)) lv++; return lv; };

// 같은 문제(q)·카드(c)·쓰기 글자(w)는 하루에 처음 한 번만 경험치를 준다. 오늘 받은 항목은 game.todayKeys에 날짜와 함께 남긴다
const GROUP = { correct: "q", wrong: "q", kana: "q", card: "c", write: "w" };

export function award(roomId, kind, key) {
  const n = XP_RULES[kind] || 0;
  if (!n) return;
  let up = null;
  ROOM[roomId].update("game", g => {
    g = g || { xp: 0 };
    if (key != null && GROUP[kind]) {
      const k = GROUP[kind] + ":" + key;
      if (!g.todayKeys || g.todayKeys.day !== today()) g.todayKeys = { day: today(), keys: {} };
      if (g.todayKeys.keys[k]) return g;
      g.todayKeys.keys[k] = 1;
    }
    const before = lvOfXp(roomId, g.xp || 0);
    g.xp = (g.xp || 0) + n;
    const after = lvOfXp(roomId, g.xp);
    if (after > before) up = after;
    return g;
  });
  if (up) showLevelUp(roomId, up);
}

export function levelOf(roomId) {
  const xp = ((ROOM[roomId].get("game")) || {}).xp || 0;
  const lv = lvOfXp(roomId, xp);
  const cur = levelInfo(roomId, lv);
  const next = lv < MAX_LV ? levelInfo(roomId, lv + 1) : null;
  return {
    lv, emoji: cur.emoji, title: cur.title, xp, max: !next,
    into: xp - cur.from, need: next ? next.from - cur.from : 0, toNext: next ? next.from - xp : 0,
    nextTitle: next ? "Lv " + next.lv + " · " + next.emoji + " " + next.title : null,
  };
}

// 레벨이 오르면 화면 아래에 잠깐 알려 준다
function showLevelUp(roomId, lv) {
  try {
    const info = levelInfo(roomId, lv);
    let el = document.getElementById("lvup");
    if (!el) { el = document.createElement("div"); el.id = "lvup"; el.className = "lvup-toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = '<span aria-hidden="true">' + info.emoji + "</span> 레벨 업! <b>Lv " + lv + " · " + esc(info.title) + "</b>";
    el.classList.add("on");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("on"), 4000);
  } catch (e) { /* 화면이 없으면 건너뛴다 */ }
}

// N1 방은 예전에 경험치가 없었다. 처음 한 번만 기존 기록(푼 문제·카드 복습)으로 경험치를 환산해 둔다. 원래 기록은 바꾸지 않는다.
function ensureN1Game() {
  try {
    if (store.get("game")) return;
    const attempts = store.get("attempts") || [];
    const correct = attempts.filter(a => a.correct).length;
    const cards = Object.values(store.get("activity") || {}).reduce((n, d) => n + (d.cards || 0), 0);
    // 환산할 기록이 없으면 아무것도 저장하지 않는다 (처음 온 사람이 급수 선택 화면을 그대로 보도록)
    if (!attempts.length && !cards) return;
    const xp = correct * XP_RULES.correct + (attempts.length - correct) * XP_RULES.wrong + cards * XP_RULES.card;
    store.set("game", { xp, convertedFrom: { attempts: attempts.length, correct, cards }, convertedAt: today() });
  } catch (e) { /* 저장소를 못 쓰면 건너뛴다 */ }
}
ensureN1Game();

// N1 방의 모든 문제 풀이(단어·문법·독해·청해·모의고사)에 경험치를 준다
store.onAttempt = rec => award("n1", rec.correct ? "correct" : "wrong", rec.qid);
