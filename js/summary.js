// 방(사람)마다의 학습 요약: 공동 대시보드 · 방 선택 화면 · 홈이 함께 쓴다
// 모든 숫자는 그 방 저장소의 실제 기록에서만 계산한다.
import { store, n3store } from "./store.js";
import { today, addDays, dateKey, diffDays } from "./util.js";
import { vocabStudied, vocabTotal } from "./views/vocab.js";
import { grammarStudied, grammarTotal } from "./views/grammar.js";
import { n3vocab, n3grammar } from "./views/n3/study.js";
import { unitDone, coreUnits } from "./views/n3/basics.js";
import { EXTRA } from "./data.js";
import { badgeList } from "./badges.js";

export const PEOPLE = {
  n1: { id: "n1", st: store, defaultName: "N1 학습자", room: "N1 공부방", home: "home" },
  n3: { id: "n3", st: n3store, defaultName: "N3 학습자", room: "N3 공부방", home: "n3" },
};
export const otherOf = id => (id === "n1" ? "n3" : "n1");
export const nameOf = id => ((PEOPLE[id].st.get("profile") || {}).name || PEOPLE[id].defaultName);

// 공부한 날: 학습량 기록(시간·카드·문제)이 있거나 문제를 푼 날
function studyDays(st) {
  const days = new Set();
  const act = st.get("activity");
  Object.keys(act).forEach(k => { if (Object.values(act[k]).some(v => v > 0)) days.add(k); });
  st.get("attempts").forEach(a => days.add(dateKey(new Date(a.at))));
  return days;
}

export function streakOf(st) {
  const days = studyDays(st);
  let day = days.has(today()) ? today() : addDays(today(), -1);
  let n = 0;
  while (days.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

// 이번 주(월요일부터 오늘까지)의 날짜들
function thisWeek() {
  const t = today();
  const [y, m, d] = t.split("-").map(Number);
  const back = (new Date(y, m - 1, d).getDay() + 6) % 7;   // 월요일까지 며칠 전인지
  const keys = [];
  for (let i = back; i >= 0; i--) keys.push(addDays(t, -i));
  return keys;
}

function progressOf(id) {
  if (id === "n1") {
    const done = vocabStudied() + grammarStudied(), total = vocabTotal() + grammarTotal();
    return { done, total };
  }
  const units = EXTRA.n3basics ? coreUnits(EXTRA.n3basics) : [];
  const done = n3vocab.studiedCount() + n3grammar.studiedCount() + units.filter(u => unitDone(u.id)).length;
  return { done, total: n3vocab.total() + n3grammar.total() + units.length };
}

export function summaryOf(id) {
  const st = PEOPLE[id].st;
  const act = st.get("activity");
  const sum = (keys, field) => keys.reduce((n, k) => n + ((act[k] && act[k][field]) || 0), 0);
  const allKeys = Object.keys(act);
  const week = thisWeek();
  const goal = st.get("goal");
  const weekMin = Math.floor(sum(week, "seconds") / 60);
  const p = progressOf(id);
  const attempts = st.get("attempts");
  return {
    id, name: nameOf(id),
    todayMin: Math.floor(sum([today()], "seconds") / 60),
    totalMin: Math.floor(sum(allKeys, "seconds") / 60),
    wordsToday: sum([today()], "words"),
    questionsToday: attempts.filter(a => dateKey(new Date(a.at)) === today()).length,
    streak: streakOf(st),
    progress: p, progressPct: p.total ? Math.round(p.done / p.total * 100) : 0,
    weekMin, goalMin: goal && goal.weeklyMinutes ? goal.weeklyMinutes : null,
    goalPct: goal && goal.weeklyMinutes ? Math.min(100, Math.round(weekMin / goal.weeklyMinutes * 100)) : null,

  };
}

// 배지는 badges.js에서 계산한다 (예전 이름 badgesOf를 그대로 쓸 수 있게 이어 준다)
export const badgesOf = id => badgeList(id);

// 응원 메시지 (보낸 사람의 저장소에 남긴다)
export function allCheers() {
  const out = [];
  Object.keys(PEOPLE).forEach(id => (PEOPLE[id].st.get("cheers") || []).forEach(c => out.push(Object.assign({ from: id, to: otherOf(id) }, c))));
  return out.sort((a, b) => b.at - a.at);
}

export const daysSince = at => diffDays(dateKey(new Date(at)), today());

// 처음 공부한 날: 문제를 풀었거나 카드·글자 연습 같은 학습 기록이 처음 생긴 날
// 화면을 열어 둔 시간(seconds)만 있는 날은 세지 않는다. 기록이 없으면 null
export function firstStudyDay(st) {
  const days = [];
  const act = st.get("activity") || {};
  Object.keys(act).forEach(k => { if (Object.entries(act[k]).some(([f, v]) => f !== "seconds" && v > 0)) days.push(k); });
  (st.get("attempts") || []).forEach(a => days.push(dateKey(new Date(a.at))));
  return days.length ? days.sort()[0] : null;
}

// 학습 주차: 처음 공부한 날이 1주차 첫날 (7일마다 한 주)
export function studyWeekOf(st) {
  const first = firstStudyDay(st);
  if (!first) return null;
  return { first, week: Math.floor(Math.max(0, diffDays(first, today())) / 7) + 1 };
}

// 홈 맨 위의 '학습 ○주차' 한 줄 (처음 공부한 날 기준. 시험일과는 따로다)
export function studyWeekHTML(st, level) {
  const w = studyWeekOf(st);
  return '<p class="study-week">' + (w
    ? '<span class="badge">' + level + " 학습 " + w.week + "주차</span> <small class=\"hint\">처음 공부한 날(" + w.first.slice(5).replace("-", "/") + ")부터 센 주차예요</small>"
    : '<span class="badge">' + level + ' 학습 시작 전</span> <small class="hint">문제를 풀거나 카드를 복습한 날부터 1주차가 시작돼요</small>') + "</p>";
}
