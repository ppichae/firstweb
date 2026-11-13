// 최근 7일 학습량 막대그래프 (N1·N3 홈 공통, 기록은 방마다 따로)
// 막대 하나 = 하루. 모든 날의 값을 숫자로 적고, 기록이 없는 날은 0으로 보여 준다.
// 좁은 화면에서는 날짜 칸이 너무 좁아지지 않게 칸 너비를 지키고 옆으로 밀어서 본다.
import { dateKey, addDays, today } from "./util.js";

// 날짜별 학습량: 푼 문제 수(attempts) + 플래시카드 복습 수(activity.cards)
export function recentDaysOf(st, n = 7) {
  const attempts = st.get("attempts") || [];
  const activity = st.get("activity") || {};
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(today(), -i);
    const qs = attempts.filter(a => dateKey(new Date(a.at)) === key).length;
    const cards = (activity[key] && activity[key].cards) || 0;
    days.push({ key, questions: qs, cards, total: qs + cards });
  }
  return days;
}

export function weekChartHTML(days) {
  const max = Math.max(1, ...days.map(d => d.total));
  const sum = days.reduce((n, d) => n + d.total, 0);
  const W = ["일", "월", "화", "수", "목", "금", "토"];
  return (sum ? "" : '<p class="hint">최근 7일 동안 학습 기록이 없어요. 모든 날이 0이에요.</p>') +
    '<div class="week-scroll"><div class="week" role="list">' + days.map((d, i) => {
      const [y, m, dd] = d.key.split("-").map(Number);
      const wd = W[new Date(y, m - 1, dd).getDay()];
      const label = m + "/" + dd + "(" + wd + ")";
      const h = d.total ? Math.max(4, Math.round(d.total / max * 100)) : 0;
      const tip = label + " · 문제 " + d.questions + " · 카드 " + d.cards;
      const isToday = i === days.length - 1;
      return '<div class="week-col" role="listitem" tabindex="0" aria-label="' + tip + '">' +
        '<span class="week-tip">' + tip + "</span>" +
        '<span class="week-bar-wrap"><span class="week-bar' + (d.total ? "" : " zero") + '" style="height:' + h + '%"></span></span>' +
        '<span class="week-val' + (d.total ? "" : " zero") + '">' + d.total + "</span>" +
        '<span class="week-day' + (isToday ? " today" : "") + '">' + (isToday ? "오늘" : m + "/" + dd) + '<small>' + wd + "</small></span></div>";
    }).join("") + "</div></div>" +
    '<table class="sr-only"><caption>최근 7일 학습량</caption><tr><th>날짜</th><th>푼 문제</th><th>카드 복습</th></tr>' +
      days.map(d => "<tr><td>" + d.key + "</td><td>" + d.questions + "</td><td>" + d.cards + "</td></tr>").join("") + "</table>";
}

export function weekCardHTML(st) {
  const days = recentDaysOf(st);
  return '<article class="card-box"><div class="panel-head"><h3>최근 7일 학습량</h3><span class="hint">푼 문제 + 플래시카드 복습 · 합계 ' +
    days.reduce((n, d) => n + d.total, 0) + "</span></div>" + weekChartHTML(days) + "</article>";
}
