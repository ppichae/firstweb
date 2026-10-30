// 간격 반복 학습(SRS): 잘 기억할수록 다음 복습까지의 간격을 늘린다
// SM-2 방식을 단순하게 줄인 것. 평가는 4단계: again(다시) · hard(어려움) · good(알맞음) · easy(쉬움)
import { today, addDays } from "./util.js";

export const GRADES = [
  { key: "again", label: "다시", hint: "오늘 다시" },
  { key: "hard", label: "어려움" },
  { key: "good", label: "알맞음" },
  { key: "easy", label: "쉬움" },
];

export function newCard() { return { reps: 0, interval: 0, ease: 2.5, due: today(), lapses: 0 }; }

// 평가에 따라 다음 복습 날짜를 정한다
export function schedule(card, grade) {
  const c = Object.assign(newCard(), card);
  if (grade === "again") {
    c.reps = 0; c.lapses += 1; c.interval = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
  } else {
    let next;
    if (c.reps === 0) next = grade === "easy" ? 3 : 1;
    else if (c.reps === 1) next = grade === "hard" ? 2 : grade === "easy" ? 5 : 3;
    else if (grade === "hard") next = Math.max(c.interval + 1, Math.round(c.interval * 1.2));
    else next = Math.round(c.interval * c.ease * (grade === "easy" ? 1.3 : 1));
    if (grade === "hard") c.ease = Math.max(1.3, c.ease - 0.15);
    if (grade === "easy") c.ease += 0.15;
    c.interval = Math.min(next, 180);
    c.reps += 1;
  }
  c.due = addDays(today(), c.interval);
  c.last = today();
  return c;
}

// 각 평가를 골랐을 때 며칠 뒤에 다시 보게 되는지 (버튼에 표시)
export function preview(card, grade) {
  const n = schedule(card, grade).interval;
  return n === 0 ? "오늘" : n + "일 뒤";
}

export const isDue = card => !!card && card.due <= today();
