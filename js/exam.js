// 시험 정보 (JLPT 공식 사이트에서 확인한 값만 적는다)
// 새 시험 날짜가 발표되면 EXAMS에 한 줄 추가한다.
import { today, diffDays } from "./util.js";

export const EXAM_INFO = {
  sections: [
    { name: "언어지식(문자·어휘·문법)·독해", minutes: 110 },
    { name: "청해", minutes: 55 },
  ],
  pass: "180점 중 100점 이상, 언어지식·독해·청해 각각 19점 이상",
  source: "https://www.jlpt.jp/guideline/results.html",
};

export const EXAMS = [
  { date: "2026-12-06", label: "2026년 제2회 (12월)", source: "https://www.jlpt.jp/" },
];

export function nextExam() {
  const t = today();
  return EXAMS.find(e => e.date >= t) || null;
}
export const daysUntil = date => diffDays(today(), date);
