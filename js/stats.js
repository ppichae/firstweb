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
};
export function statTileHTML(label, value, sub, opts = {}) {
  const R = 25, C = 2 * Math.PI * R, pct = opts.pct;
  const ring = pct === undefined || pct === null ? "" :
    '<svg class="stat-ring" viewBox="0 0 60 60" aria-hidden="true"><circle class="ring-bg" cx="30" cy="30" r="' + R + '"/>' +
    '<circle class="ring-fg" cx="30" cy="30" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - Math.min(100, Math.max(0, pct)) / 100)).toFixed(1) + '"/>' +
    '<text x="30" y="30">' + Math.round(pct) + "</text></svg>";
  return '<article class="tile stat-tile tone-' + (opts.tone || "mint") + '"><div class="stat-head"><span class="stat-icon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[opts.icon] || ICONS.book) + "</svg></span>" +
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
