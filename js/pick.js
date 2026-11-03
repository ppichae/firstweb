// 퀴즈 문제 고르기: 풀이 기록을 보고 '마지막에 틀린 것 2 · 처음 보는 것 6 · 오래전에 맞힌 것 2'(10문제 기준)를 섞는다
// 바로 전 퀴즈들에 나온 항목은 되도록 다시 내지 않는다. 한 번의 퀴즈 안에서는 같은 항목이 두 번 나오지 않는다.
import { shuffle } from "./util.js";

const DAY = 86400000;

// attempts: 이 방의 풀이 기록, 항목 id는 기록의 snap.wordId(자동으로 만든 문제)로 찾는다
export function itemStats(attempts) {
  const m = new Map();
  (attempts || []).forEach(a => {
    const id = a.snap && a.snap.wordId;
    if (!id) return;
    const s = m.get(id) || { total: 0, wrong: 0, last: 0, lastOk: null };
    s.total++; if (!a.correct) s.wrong++;
    if ((a.at || 0) >= s.last) { s.last = a.at || 0; s.lastOk = !!a.correct; }
    m.set(id, s);
  });
  return m;
}

// pool: 고를 항목들, n: 몇 개, opts: { attempts, weak(item) → 약한 항목인지(오답 기록 등) }
// 돌려주는 순서는 섞여 있다
export function pickItems(pool, n, opts = {}) {
  const stats = itemStats(opts.attempts);
  const ids = new Set(pool.map(it => it.id));
  // 이 범위의 항목만 본다 (다른 화면에서 푼 문제가 '최근' 칸을 차지하지 않게)
  const sorted = (opts.attempts || []).filter(a => a.snap && ids.has(a.snap.wordId)).sort((a, b) => (b.at || 0) - (a.at || 0));
  const recent = new Set(sorted.slice(0, n * 2).map(a => a.snap.wordId));   // 바로 전 두 번 정도의 퀴즈
  const previous = new Set(sorted.slice(0, n).map(a => a.snap.wordId));     // 바로 전 한 번
  const now = Date.now();
  const weak = [], fresh = [], stale = [], rest = [];
  pool.forEach(it => {
    const s = stats.get(it.id);
    // 약한 항목: 마지막에 틀린 것. 다시 맞히면 일반 문제로 돌아간다. 퀴즈 기록이 없으면 다른 기록(opts.weak)으로 판단한다
    if (s ? s.lastOk === false : (opts.weak && opts.weak(it))) weak.push(it);
    else if (!s) fresh.push(it);
    else if (now - s.last > 3 * DAY) stale.push(it);
    else rest.push(it);
  });
  const chosen = [], seen = new Set();
  const take = (list, k, skip) => {
    for (const it of shuffle(list)) {
      if (k <= 0 || chosen.length >= n) return;
      if (seen.has(it.id) || (skip && skip.has(it.id))) continue;
      chosen.push(it); seen.add(it.id); k--;
    }
  };
  // 새 단어를 많이 만나도록 처음 보는 것을 가장 많이 낸다
  const quota = { weak: Math.round(n * 0.2), fresh: Math.round(n * 0.6), stale: Math.round(n * 0.2) };
  take(weak, quota.weak, previous);      // 틀린 것은 바로 다음 퀴즈만 건너뛰고 다시 낸다 (오답 재출제)
  take(fresh, quota.fresh, recent);
  take(stale, quota.stale, recent);
  // 모자라면 최근에 안 나온 것부터 채우고, 그래도 모자라면 최근 것도 쓴다
  take([...weak, ...fresh, ...stale, ...rest], n, recent);
  take(pool, n);
  return shuffle(chosen);
}
