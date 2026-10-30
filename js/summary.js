// 방(사람)마다의 학습 요약: 공동 대시보드 · 방 선택 화면 · 홈이 함께 쓴다
// 모든 숫자는 그 방 저장소의 실제 기록에서만 계산한다.
import { store, n3store } from "./store.js";
import { today, addDays, dateKey, diffDays } from "./util.js";
import { vocabStudied, vocabTotal } from "./views/vocab.js";
import { grammarStudied, grammarTotal } from "./views/grammar.js";
import { n3vocab, n3grammar } from "./views/n3/study.js";
import { unitDone } from "./views/n3/basics.js";
import { EXTRA } from "./data.js";

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
  const units = EXTRA.n3basics ? EXTRA.n3basics.units : [];
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
    badges: badgesOf(id),
  };
}

// 학습 배지: 기록으로 조건을 확인한다 (날짜를 따로 저장하지 않음)
export function badgesOf(id) {
  const st = PEOPLE[id].st;
  const attempts = st.get("attempts");
  const right = attempts.filter(a => a.correct).length;
  const streak = streakOf(st);
  const p = progressOf(id);
  const totalMin = Math.floor(Object.values(st.get("activity")).reduce((n, d) => n + (d.seconds || 0), 0) / 60);
  const list = [
    ["first", "첫걸음", "문제를 처음 풀었어요", attempts.length >= 1],
    ["right50", "정답 50", "문제를 50개 맞혔어요", right >= 50],
    ["right300", "정답 300", "문제를 300개 맞혔어요", right >= 300],
    ["streak3", "3일 연속", "3일 연속 공부했어요", streak >= 3],
    ["streak7", "7일 연속", "7일 연속 공부했어요", streak >= 7],
    ["study100", "100개 학습", "단어·문법·단원을 100개 공부했어요", p.done >= 100],
    ["hour5", "5시간", "누적 학습 시간이 5시간을 넘었어요", totalMin >= 300],
  ];
  if (id === "n3") {
    const units = EXTRA.n3basics ? EXTRA.n3basics.units : [];
    const kana = Object.values(n3store.get("kana")).reduce((n, k) => n + (k.right || 0), 0);
    const tests = n3store.get("tests");
    list.push(
      ["kana50", "가나 50", "가나 퀴즈를 50번 맞혔어요", kana >= 50],
      ["basics", "기초 완주", "기초 단원을 모두 마쳤어요", units.length > 0 && units.every(u => unitDone(u.id))],
      ["test80", "테스트 80점", "연습 테스트에서 80% 이상 맞혔어요", tests.some(t => t.correct / t.total >= 0.8)],
    );
  } else {
    const mocks = store.get("mocks");
    list.push(["mock1", "모의고사 1회", "실전 모의고사를 끝까지 풀었어요", mocks.length >= 1]);
  }
  return list.map(([key, name, desc, got]) => ({ key, name, desc, got: !!got }));
}

// 응원 메시지 (보낸 사람의 저장소에 남긴다)
export function allCheers() {
  const out = [];
  Object.keys(PEOPLE).forEach(id => (PEOPLE[id].st.get("cheers") || []).forEach(c => out.push(Object.assign({ from: id, to: otherOf(id) }, c))));
  return out.sort((a, b) => b.at - a.at);
}

export const daysSince = at => diffDays(dateKey(new Date(at)), today());
