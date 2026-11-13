// 시험 정보 (JLPT 공식 사이트에서 확인한 값만 적는다)
// 새 시험 날짜가 발표되면 EXAMS에 한 줄 추가한다.
import { today, diffDays, esc } from "./util.js";

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

// N3 시험 구성 (JLPT 공식 사이트에서 확인: 2026-10-31)
export const EXAM_INFO_N3 = {
  sections: [
    { name: "언어지식(문자·어휘)", minutes: 30 },
    { name: "언어지식(문법)·독해", minutes: 70 },
    { name: "청해", minutes: 40 },
  ],
  pass: "180점 중 95점 이상, 언어지식(문자·어휘·문법)·독해·청해 각각 19점 이상",
  source: "https://www.jlpt.jp/guideline/results.html",
  sectionsSource: "https://www.jlpt.jp/e/guideline/testsections.html",
};

// 공식 문제 예시(무료 공개 문제집·음성). 이 사이트에 옮기지 않고 링크만 건다
export const OFFICIAL_SAMPLES = "https://www.jlpt.jp/e/samples/sampleindex.html";

// 홈의 '시험 구성' 칸 (N1·N3 같은 모양)
export function examCardHTML(info, level) {
  return '<article class="card-box"><h3>' + level + ' 시험 구성 <small class="hint">JLPT 공식 기준</small></h3><dl class="facts">' +
    info.sections.map(s => '<div class="fact"><dt>' + esc(s.name) + "</dt><dd>" + s.minutes + "분</dd></div>").join("") +
    '<div class="fact"><dt>합격 기준</dt><dd>' + esc(info.pass) + "</dd></div></dl>" +
    '<p class="hint">출처: <a href="' + info.source + '" target="_blank" rel="noopener">JLPT 공식 사이트</a> · ' +
    '실제 시험 형식의 공식 문제 예시와 음성은 <a href="' + OFFICIAL_SAMPLES + '" target="_blank" rel="noopener">JLPT 공식 문제 예시</a>에서 무료로 볼 수 있어요. 이 사이트의 문제는 자체 제작 연습 문제예요.</p></article>';
}
