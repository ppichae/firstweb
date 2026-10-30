// 경험치(XP) · 레벨 · 칭호 (N1 방과 N3 방이 같은 구조, 기록과 기준은 따로)
// XP는 실제 학습 활동(문제 풀이, 카드 복습, 단원·문자·한자 학습)으로만 오른다. 학습 시간만으로는 오르지 않는다.
// N1·N3의 레벨은 각 방 안의 성장 단계예요. 같은 레벨 숫자라도 두 급수의 실력이 같다는 뜻이 아니에요.
import { store, n3store } from "./store.js";
import { today } from "./util.js";

const ROOM = { n1: store, n3: n3store };
export const XP_RULES = { correct: 5, wrong: 1, card: 2, unit: 30, kana: 2, write: 2 };
export const XP_TEXT = "맞힌 문제 +5 · 틀린 문제 +1 · 카드 복습 +2 · 단원 완료 +30 · 문자 연습 +2 · 쓰기 연습 +2";

// 레벨 기준: N3는 초보자가 금방 첫 레벨을 넘을 수 있게 작게 시작하고, N1은 심화 학습량에 맞게 넓게 잡았다
export const LEVELS = {
  n3: [
    [0, "🌱", "새싹"], [40, "🐣", "병아리"], [100, "🍙", "오니기리"], [180, "🎋", "대나무"], [280, "🚃", "전철 타기"],
    [400, "🗾", "일본 여행자"], [550, "⛩️", "도리이 통과"], [730, "🗻", "후지산 등반"], [940, "🌸", "벚꽃 만개"], [1200, "🏯", "N3 합격 준비 완료"],
  ],
  n1: [
    [0, "📘", "첫 장을 연 학습자"], [100, "✍️", "어휘 탐구자"], [250, "📜", "문법 연마자"], [450, "🧭", "독해 항해사"], [700, "🎧", "청해 집중러"],
    [1000, "🏛️", "고급 학습자"], [1400, "🦉", "깊이 읽는 사람"], [1900, "🗡️", "시험 전략가"], [2500, "🏆", "N1 도전자"], [3200, "👑", "N1 합격 준비 완료"],
  ],
};

export function award(roomId, kind) {
  const n = XP_RULES[kind] || 0;
  if (!n) return;
  ROOM[roomId].update("game", g => { g = g || { xp: 0 }; g.xp = (g.xp || 0) + n; return g; });
}

export function levelOf(roomId) {
  const xp = ((ROOM[roomId].get("game")) || {}).xp || 0;
  const table = LEVELS[roomId];
  let i = 0;
  while (i + 1 < table.length && xp >= table[i + 1][0]) i++;
  const [base, emoji, title] = table[i];
  const next = table[i + 1];
  return {
    lv: i + 1, emoji, title, xp, max: !next,
    into: xp - base, need: next ? next[0] - base : 0, toNext: next ? next[0] - xp : 0,
    nextTitle: next ? next[1] + " " + next[2] : null,
  };
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
store.onAttempt = rec => award("n1", rec.correct ? "correct" : "wrong");
