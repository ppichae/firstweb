// 학습 기록 계산: 오답 노트·대시보드·D-30 모드가 함께 쓴다
// 모든 숫자는 실제 풀이 기록(store의 attempts 등)에서만 계산한다. 기록이 없으면 0이나 null을 돌려준다.
import { store } from "./store.js";
import { QUESTIONS, DB } from "./data.js";
import { dateKey, addDays, today, pct } from "./util.js";

// 문제 id로 문제 내용 찾기 (자동으로 만든 문제는 기록에 남긴 내용으로)
export function questionFor(qid, attempt) {
  const q = QUESTIONS.get(qid);
  if (q) return q;
  const snap = attempt && attempt.snap;
  return snap ? Object.assign({ id: qid, area: attempt.area, generated: true, source: { type: "ai" }, review: "needs-review" }, snap) : null;
}

// 문제별 풀이 이력. 한 번이라도 틀린 문제만 오답 노트에 들어간다
export function noteEntries(st = store) {
  const byQ = new Map();
  st.get("attempts").forEach(a => {
    if (!byQ.has(a.qid)) byQ.set(a.qid, []);
    byQ.get(a.qid).push(a);
  });
  const out = [];
  byQ.forEach((list, qid) => {
    const wrong = list.filter(a => !a.correct);
    if (!wrong.length) return;
    const lastWrong = wrong[wrong.length - 1];
    const last = list[list.length - 1];
    const q = questionFor(qid, list.find(a => a.snap) || lastWrong);
    if (!q) return;   // 자료에서 지워진 문제
    out.push({
      qid, q, area: q.area || lastWrong.area,
      wrongCount: wrong.length, attempts: list.length,
      lastWrongAt: lastWrong.at, lastChoice: lastWrong.choice,
      resolved: last.correct,          // 마지막으로 풀었을 때 맞혔는가
      history: list.map(a => a.correct),
    });
  });
  return out;
}

export const unresolvedNotes = () => noteEntries().filter(n => !n.resolved);

// 영역별 정답률 (모의고사 포함 모든 풀이)
export function areaStats() {
  const res = {};
  ["vocab", "grammar", "reading", "listening"].forEach(a => { res[a] = { total: 0, correct: 0, rate: null }; });
  store.get("attempts").forEach(a => {
    if (!res[a.area]) return;
    res[a.area].total++;
    if (a.correct) res[a.area].correct++;
  });
  Object.values(res).forEach(r => { r.rate = pct(r.correct, r.total); });
  return res;
}

// 최근 n일의 날짜별 학습량 (푼 문제 수 + 플래시카드 복습 수)
export function recentDays(n = 7) {
  const attempts = store.get("attempts");
  const activity = store.get("activity");
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(today(), -i);
    const qs = attempts.filter(a => dateKey(new Date(a.at)) === key).length;
    const cards = (activity[key] && activity[key].cards) || 0;
    days.push({ key, questions: qs, cards, total: qs + cards });
  }
  return days;
}

// 학습한 단어: 플래시카드로 복습했거나, 외웠어요/몰라요로 표시한 단어
export function studiedWordCount() {
  const w = store.get("words");
  return DB.vocab.items.filter(v => w[v.id] && (w[v.id].srs || w[v.id].status)).length;
}
export const studiedGrammarCount = () => DB.grammar.items.filter(g => (store.get("grammar")[g.id] || {}).studied).length;

// 약점 영역: 5문제 이상 푼 영역 중 정답률이 80% 미만인 영역 (낮은 순서)
export const MIN_FOR_WEAKNESS = 5;
export const WEAK_BELOW = 80;
export const judgedAreas = () => Object.entries(areaStats()).filter(([, r]) => r.total >= MIN_FOR_WEAKNESS);
export function weakAreas() {
  return judgedAreas().filter(([, r]) => r.rate < WEAK_BELOW).sort((a, b) => a[1].rate - b[1].rate);
}

// 홈 숫자 칸: 아이콘, 큰 숫자, 원형 그래프(pct가 있을 때). tone: mint·sky·lav·peach
const ICONS = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3"/>',
  pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>',
  flame: '<path d="M12 3c.6 3.5 5.5 5.8 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.6 2.2-4.8.3 1.5 1 2.3 1.8 2.8C10.2 9 10.5 5.800 12 3z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.500"/><rect x="13" y="4" width="7" height="7" rx="1.500"/><rect x="4" y="13" width="7" height="7" rx="1.500"/><rect x="13" y="13" width="7" height="7" rx="1.500"/>',
  biz: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  life: '<path d="M4 11l8-7 8 7"/><path d="M6 9.500V20h12V9.500"/><path d="M10 20v-6h4v6"/>',
  people: '<circle cx="9" cy="8" r="3.500"/><path d="M3 20c0-3.500 2.700-6 6-6s6 2.500 6 6"/><path d="M16 5a3.500 3.500 0 0 1 0 6.500"/><path d="M18 14.500c1.800.8 3 2.800 3 5.500"/>',
  mind: '<path d="M12 20s-8-4.700-8-10.500A4.500 4.500 0 0 1 12 7a4.500 4.500 0 0 1 8 2.500C20 15.300 12 20 12 20z"/>',
  society: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.500 2.500 3.800 5.500 3.800 9s-1.300 6.500-3.800 9c-2.500-2.500-3.800-5.500-3.800-9S9.500 5.500 12 3z"/>',
  body: '<path d="M3 12h4l2.500-6 4 12 2.500-6h5"/>',
  nature: '<path d="M5 19c0-8 5-14 15-15 0 10-5 15-12 15-1 0-2-.1-3 0z"/><path d="M5 21c1.500-5 5-8.500 9-10.500"/>',
  place: '<path d="M12 21s-7-6.300-7-11.500a7 7 0 0 1 14 0C19 14.700 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
  action: '<path d="M4 8h13l-3.500-3.500"/><path d="M20 16H7l3.500 3.500"/>',
  state: '<circle cx="8" cy="8" r="4"/><rect x="13" y="13" width="7" height="7" rx="1.500"/><path d="M6 20l2.500-4.500L11 20z"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>',
  map: '<path d="M9 4L3 6.500v13.500l6-2.500 6 2.500 6-2.500V4l-6 2.500z"/><path d="M9 4v13.500"/><path d="M15 6.500V20"/>',
  seed: '<path d="M12 21v-9"/><path d="M12 12c0-4 2.500-6.500 7-7 0 4.500-2.500 7-7 7z"/><path d="M12 15c0-3-2-5-6-5.500 0 3.500 2 5.500 6 5.500z"/>',
  ear: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.500"/><rect x="17" y="14" width="4" height="6" rx="1.500"/>',
  retry: '<path d="M4 12a8 8 0 1 1 2.500 5.800"/><path d="M4 19v-5h5"/>',
  paper: '<path d="M6 3h9l4 4v14H6z"/><path d="M14.500 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="7"/>',
  swap: '<path d="M4 8h13l-3.500-3.500"/><path d="M20 16H7l3.500 3.500"/>',
  moon: '<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500z"/>',
  link: '<circle cx="8" cy="9" r="3.500"/><circle cx="16.500" cy="9" r="3"/><path d="M2.500 20c0-3.200 2.500-5.500 5.500-5.500s5.500 2.300 5.500 5.500"/><path d="M15.500 14.600c3-.3 6 1.700 6 5.400"/>',
  cloud: '<path d="M7 18a4.500 4.500 0 0 1-.6-9A6 6 0 0 1 18 10a4 4 0 0 1-.5 8z"/>',
};
export const iconSVG = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.book) + "</svg>";
export function statTileHTML(label, value, sub, opts = {}) {
  const R = 25, C = 2 * Math.PI * R, pct = opts.pct;
  const ring = pct === undefined || pct === null ? "" :
    '<svg class="stat-ring" viewBox="0 0 60 60" aria-hidden="true"><circle class="ring-bg" cx="30" cy="30" r="' + R + '"/>' +
    '<circle class="ring-fg" cx="30" cy="30" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - Math.min(100, Math.max(0, pct)) / 100)).toFixed(1) + '"/>' +
    '<text x="30" y="30">' + Math.round(pct) + "</text></svg>";
  return '<article class="tile stat-tile tone-' + (opts.tone || "mint") + '"><div class="stat-head"><span class="stat-icon" aria-hidden="true">' +
    iconSVG(opts.icon) + "</span>" +
    '<span class="tile-label">' + label + "</span></div>" +
    '<div class="stat-main"><span class="tile-value">' + String(value).replace(/[&<>"']/g, "") + '</span><span class="tile-sub">' + String(sub).replace(/[&<>"']/g, "") + "</span></div>" + ring + "</article>";
}

// 가끔만 보는 정보를 접어 두는 칸 (누르면 펼쳐진다)
export const moreHTML = (label, inner) => '<details class="more-box"><summary>' + label + "</summary>" + inner + "</details>";

// 홈 숫자 칸의 기준 설명 (N1·N3 같은 기준). 화면의 숫자와 같은 규칙을 글로 적은 것이다
export function statsHelpHTML(roomId) {
  const rows = [
    ["학습한 단어", "'외웠어요'를 눌렀거나, 퀴즈에서 한 번 이상 맞혔거나, 플래시카드에서 '알았어요·쉬워요'를 고른 단어예요. 같은 단어는 여러 번 공부해도 1개로 세요."],
    ["공부 중", "카드·퀴즈·표시 기록은 있지만 아직 위 기준에 못 미친 단어예요. 틀렸거나 '몰라요'만 누른 단어가 여기에 들어가요. 단어를 열어 보기만 한 것은 세지 않아요."],
    ["공부한 문법", "문법 화면에서 '공부했어요'를 누른 문형이에요."],
    ["누적 문제 풀이", "지금까지 푼 문제 수예요. 같은 문제를 다시 풀면 다시 세요. 정답률은 맞힌 수 ÷ 푼 수예요."],
  ];
  if (roomId === "n3") rows.push(["연속 학습", "문제를 풀었거나 카드·글자 연습 등 학습 기록이 있는 날이 오늘(또는 어제)부터 며칠 이어졌는지예요."]);
  return '<details class="voice-box stat-help"><summary>숫자는 이렇게 세요</summary><dl class="stat-rules">' +
    rows.map(([k, v]) => '<div><dt>' + k + "</dt><dd>" + v + "</dd></div>").join("") + "</dl></details>";
}
