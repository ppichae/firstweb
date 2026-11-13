// 간격 반복 학습(SRS): 잘 기억할수록 다음 복습까지의 간격을 늘린다
// SM-2 방식을 단순하게 줄인 것. 평가는 4단계: again(모르겠어요) · hard(헷갈려요) · good(알았어요) · easy(쉬워요)
// 저장하는 값(again·hard·good·easy)은 예전과 같아서 기존 복습 일정이 그대로 이어진다
import { today, addDays } from "./util.js";

export const GRADES = [
  { key: "again", label: "모르겠어요" },
  { key: "hard", label: "헷갈려요" },
  { key: "good", label: "알았어요" },
  { key: "easy", label: "쉬워요" },
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
  return n === 0 ? "오늘 다시" : n === 1 ? "내일 다시" : n + "일 뒤 다시";
}

export const isDue = card => !!card && card.due <= today();

// 화면에 보여 주는 복습 간격 설명 (위 schedule과 같은 규칙)
export const SRS_HELP =
  "버튼 아래 날짜가 그 카드를 다시 보게 되는 날이에요. " +
  "'모르겠어요'는 오늘 이 묶음 끝에 한 번 더 나오고, 기억 점수가 조금 내려가요. " +
  "처음 볼 때는 '헷갈려요·알았어요' 내일, '쉬워요' 3일 뒤예요. 두 번째에는 각각 2일·3일·5일 뒤예요. " +
  "그다음부터는 지난 간격에 기억 점수(처음 2.5배)를 곱해 늘어나요. '헷갈려요'는 조금만(약 1.2배), '쉬워요'는 더 길게(1.3배 더) 늘어나요. 가장 긴 간격은 180일이에요.";
