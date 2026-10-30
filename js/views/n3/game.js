// N3 방의 게임 요소: 경험치(XP) · 레벨 · 연속 학습일
// 공부를 돕는 보조 장치라서 점수는 작게, 실제 학습 기록에서만 계산한다.
import { n3store } from "../../store.js";
import { today, addDays } from "../../util.js";

export const XP_RULES = { correct: 5, wrong: 1, card: 2, unit: 30, kana: 2 };
const PER_LEVEL = 150;

// 학습 행동 하나를 기록하고 경험치를 더한다
export function award(kind) {
  const n = XP_RULES[kind] || 0;
  n3store.update("game", g => { g.xp = (g.xp || 0) + n; });
  if (kind === "correct" || kind === "wrong" || kind === "kana") n3store.logActivity("questions");
}

export function level() {
  const xp = (n3store.get("game") || {}).xp || 0;
  const lv = Math.floor(xp / PER_LEVEL) + 1;
  return { xp, lv, into: xp % PER_LEVEL, need: PER_LEVEL };
}

// 오늘(또는 어제)까지 하루도 빠짐없이 공부한 날 수
export function streak() {
  const act = n3store.get("activity");
  const studied = k => act[k] && Object.values(act[k]).some(v => v > 0);
  let day = studied(today()) ? today() : addDays(today(), -1);
  let n = 0;
  while (studied(day)) { n++; day = addDays(day, -1); }
  return n;
}

export function todayCount() {
  const a = n3store.get("activity")[today()] || {};
  return Object.values(a).reduce((s, v) => s + v, 0);
}
