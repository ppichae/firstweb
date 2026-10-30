// 여러 화면에서 함께 쓰는 작은 도구들

// 글자를 HTML에 안전하게 넣는다 (<, > 같은 기호가 태그로 바뀌지 않게)
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 날짜는 "2026-10-30" 같은 글자로 다룬다 (내 컴퓨터 시간대 기준)
export function dateKey(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export const today = () => dateKey(new Date());
function toUTC(key) { const [y, m, d] = key.split("-").map(Number); return Date.UTC(y, m - 1, d); }
export function addDays(key, n) { const [y, m, d] = key.split("-").map(Number); return dateKey(new Date(y, m - 1, d + n)); }
export function diffDays(from, to) { return Math.round((toUTC(to) - toUTC(from)) / 86400000); }
export function fmtDate(key) { const [, m, d] = key.split("-").map(Number); return m + "월 " + d + "일"; }

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 정답률(%) — 푼 문제가 없으면 null (화면에는 '기록 없음')
export const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
export const pctText = v => (v === null ? "기록 없음" : v + "%");

export const AREAS = { vocab: "어휘", grammar: "문법", reading: "독해", listening: "청해", kanji: "한자" };

// 출처·검수 표시
export function badges(item) {
  const out = [];
  const src = item.source || {};
  if (src.type === "official") out.push('<span class="badge ok">공식 자료</span>');
  else if (src.type === "pdf") out.push('<span class="badge">' + esc(src.label || "내 PDF") + "</span>");
  else out.push('<span class="badge ai">AI 생성 연습문제</span>');
  if (src.url) out.push('<a class="badge" href="' + esc(src.url) + '" target="_blank" rel="noopener">출처</a>');
  if (item.review !== "verified") out.push('<span class="badge warn">검수 필요</span>');
  return '<span class="badges">' + out.join("") + "</span>";
}

// 줄바꿈이 있는 글을 안전하게 보여 준다. [[밑줄]] 표시는 밑줄로 바꾼다
export const multiline = s => esc(s).replace(/\n/g, "<br>")
  .replace(/\[\[(.+?)\]\]/g, '<u class="mark-under">$1</u>');
