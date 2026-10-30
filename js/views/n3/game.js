// N3 방의 게임 요소: 공통 경험치·레벨(js/game.js)을 N3 방 기록으로 쓴다
// 공부를 돕는 보조 장치라서 점수는 작게, 실제 학습 기록에서만 계산한다.
import { n3store } from "../../store.js";
import { today, addDays } from "../../util.js";
import { award as awardRoom, levelOf, XP_RULES } from "../../game.js";

export { XP_RULES };

// 학습 행동 하나를 기록하고 경험치를 더한다
export function award(kind) {
  awardRoom("n3", kind);
  if (kind === "correct" || kind === "wrong" || kind === "kana") n3store.logActivity("questions");
}

export const level = () => levelOf("n3");

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
