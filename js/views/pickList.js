// 독해·청해 목록 화면: 이어서 풀기, 안 푼 것만 보기, 10개씩 보기 (자료가 늘어도 끝없이 스크롤하지 않게)
import { esc } from "../util.js";

const PAGE = 10;
const isDone = x => x.total > 0 && x.solved >= x.total;

// rows: [{ id, type, title, meta, solved, total }], ui: { status, shown }, attr: 항목 버튼의 data- 이름
export function pickListHTML(rows, ui, attr) {
  const next = rows.find(x => !isDone(x));
  const list = rows.filter(x => ui.status === "all" || (ui.status === "done" ? isDone(x) : !isDone(x)));
  const left = rows.filter(x => !isDone(x)).length;
  return (next && rows.some(x => x.solved > 0)
      ? '<button type="button" class="btn continue" data-' + attr + '="' + esc(next.id) + '">이어서 풀기 · <span lang="ja">' + esc(next.title) + "</span></button>" : "") +
    '<div class="toolbar">' + [["all", "전체 " + rows.length], ["todo", "안 푼 것 " + left], ["done", "다 푼 것 " + (rows.length - left)]].map(([k, l]) =>
      '<button type="button" class="chip" data-pstatus="' + k + '" aria-pressed="' + (ui.status === k) + '">' + l + "</button>").join("") + "</div>" +
    (list.length
      ? '<div class="picker">' + list.slice(0, ui.shown).map(x =>
          '<button type="button" class="pick' + (isDone(x) ? " is-done" : "") + '" data-' + attr + '="' + esc(x.id) + '">' +
            '<span class="pick-type">' + esc(x.type) + "</span>" +
            '<span class="pick-title" lang="ja">' + esc(x.title) + "</span>" +
            '<span class="pick-meta">' + esc(x.meta) + " · " + (isDone(x) ? "✓ 다 풀었어요" : x.solved + "/" + x.total + " 풂") + "</span>" +
          "</button>").join("") + "</div>"
      : '<p class="empty">여기에 해당하는 문제가 없어요.</p>') +
    (list.length > ui.shown ? '<button type="button" class="btn ghost more-list" data-pmore>' + Math.min(PAGE, list.length - ui.shown) + "개 더 보기</button>" : "");
}

// 목록의 공통 버튼 처리. 처리했으면 true
export function handlePickList(e, ui, redraw) {
  const s = e.target.closest("[data-pstatus]");
  if (s) { ui.status = s.dataset.pstatus; ui.shown = PAGE; redraw(); return true; }
  if (e.target.closest("[data-pmore]")) { ui.shown += PAGE; redraw(); return true; }
  return false;
}

// 풀이 화면 위쪽 막대: 목록으로 · 이전 · 다음
export function detailNavHTML(index, total) {
  return '<div class="detail-nav"><button type="button" class="btn ghost sm" data-dnav="list">← 목록</button>' +
    '<span class="detail-pos">' + (index + 1) + " / " + total + "</span>" +
    '<span class="detail-move"><button type="button" class="btn ghost sm" data-dnav="prev"' + (index <= 0 ? " disabled" : "") + ">이전</button>" +
    '<button type="button" class="btn ghost sm" data-dnav="next"' + (index >= total - 1 ? " disabled" : "") + ">다음</button></span></div>";
}

export const PICK_PAGE = PAGE;
