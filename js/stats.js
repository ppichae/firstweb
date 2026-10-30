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
export function noteEntries() {
  const byQ = new Map();
  store.get("attempts").forEach(a => {
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

// 약점 영역: 5문제 이상 푼 영역 중 정답률이 낮은 순서
export const MIN_FOR_WEAKNESS = 5;
export function weakAreas() {
  const s = areaStats();
  return Object.entries(s).filter(([, r]) => r.total >= MIN_FOR_WEAKNESS).sort((a, b) => a[1].rate - b[1].rate);
}
