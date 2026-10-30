// 시험까지 남은 날(D-Day) 칸: N1 방과 N3 방 홈에서 같은 모양으로 쓴다
// 시험일은 방마다 따로 저장한다(st의 "examDate"). 정하지 않았으면 JLPT 공식 사이트에서 확인한 다음 시험일을 쓴다.
import { esc, today, fmtDate } from "./util.js";
import { nextExam, daysUntil } from "./exam.js";

const editing = new Set();   // 시험일을 고치는 중인 방

export function examTarget(st) {
  const custom = st.get("examDate");
  if (custom && custom >= today()) return { date: custom, label: "내가 정한 시험일", custom: true };
  const e = nextExam();
  return e ? { date: e.date, label: e.label, source: e.source, custom: false } : null;
}

export function ddayTileHTML(st) {
  const t = examTarget(st);
  const official = nextExam();
  if (editing.has(st.prefix)) {
    return '<article class="tile exam-tile dday-tile"><span class="tile-label">시험일 정하기</span>' +
      '<label class="dday-edit"><span class="sr-only">시험 날짜</span><input type="date" id="dd-date" min="' + today() + '" value="' + esc(t ? t.date : "") + '"></label>' +
      '<span class="dday-actions"><button type="button" class="btn sm on-ink" id="dd-save">저장</button>' +
        (official ? '<button type="button" class="link-btn" id="dd-official">공식 일정(' + fmtDate(official.date) + ")으로</button>" : "") +
        '<button type="button" class="link-btn" id="dd-cancel">취소</button></span>' +
      '<span class="tile-sub" id="dd-msg" role="status"></span></article>';
  }
  if (!t) {
    return '<article class="tile exam-tile dday-tile"><span class="tile-label">다음 시험</span>' +
      '<span class="tile-sub">등록된 시험 날짜가 지났어요. <a href="https://www.jlpt.jp/" target="_blank" rel="noopener">공식 사이트</a>에서 일정을 확인한 뒤 직접 정해 주세요.</span>' +
      '<span class="dday-actions"><button type="button" class="link-btn" id="dd-edit">시험일 정하기</button></span></article>';
  }
  const left = daysUntil(t.date);
  return '<article class="tile exam-tile dday-tile">' +
    '<span class="tile-label">다음 시험 · ' + esc(t.label) + "</span>" +
    '<span class="dday">' + (left === 0 ? "D-DAY" : "D-" + left) + "</span>" +
    '<span class="tile-sub">' + fmtDate(t.date) +
      (t.source ? ' · <a href="' + t.source + '" target="_blank" rel="noopener">공식 일정</a>' : "") + "</span>" +
    '<span class="dday-actions"><button type="button" class="link-btn" id="dd-edit">시험일 바꾸기</button></span>' +
  "</article>";
}

// 칸 안의 버튼 처리. rerender: 바뀐 날짜로 화면을 다시 그리는 함수
export function bindDday(root, st, rerender) {
  const tile = root.querySelector(".dday-tile");
  if (!tile) return;
  tile.onclick = e => {
    if (e.target.closest("#dd-edit")) { editing.add(st.prefix); rerender(); }
    else if (e.target.closest("#dd-cancel")) { editing.delete(st.prefix); rerender(); }
    else if (e.target.closest("#dd-official")) { st.set("examDate", null); editing.delete(st.prefix); rerender(); }
    else if (e.target.closest("#dd-save")) {
      const v = tile.querySelector("#dd-date").value;
      if (!v || v < today()) { tile.querySelector("#dd-msg").textContent = "오늘 이후의 날짜를 골라 주세요."; return; }
      st.set("examDate", v); editing.delete(st.prefix); rerender();
    }
  };
}
