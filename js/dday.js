// 시험까지 남은 날(D-Day) 칸: N1 방과 N3 방 홈에서 같은 모양으로 쓴다
// 시험일은 방마다 따로 저장한다(st의 "examDate"). 정하지 않았으면 JLPT 공식 사이트에서 확인한 다음 시험일을 쓴다.
// 남은 시간은 시험 시작 시각(st의 "examTime", "HH:MM")까지 센다. 시각을 정하지 않으면 시험일 0시까지 센다.
// (JLPT 시작 시각은 급수·나라마다 달라서 이 사이트에 정해 두지 않았다)
import { esc, today, fmtDate } from "./util.js";
import { nextExam, daysUntil } from "./exam.js";

const editing = new Set();   // 시험일을 고치는 중인 방

export function examTarget(st) {
  const custom = st.get("examDate");
  if (custom && custom >= today()) return { date: custom, label: "내가 정한 시험일", custom: true };
  const e = nextExam();
  return e ? { date: e.date, label: e.label, source: e.source, custom: false } : null;
}

const validTime = v => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
// 시험 시작 순간(이 기기의 시간대 기준)
function examMoment(date, time) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = validTime(time) ? time.split(":").map(Number) : [0, 0];
  return new Date(y, m - 1, d, hh, mm).getTime();
}
// 남은 시간 글자: '34일 12시간 05분 남았어요'
export function remainText(ms) {
  if (ms <= 0) return "시험 시간이 되었어요";
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  return (d ? d + "일 " : "") + (d || h ? h + "시간 " : "") + String(m).padStart(2, "0") + "분 남았어요";
}

// 화면에 있는 모든 남은 시간 칸을 30초마다 고친다 (칸이 없으면 아무것도 하지 않는다)
let ticker = null;
function tick() {
  const els = document.querySelectorAll("[data-until]");
  els.forEach(el => { el.textContent = remainText(Number(el.dataset.until) - Date.now()); });
}
function startTicker() { if (!ticker) ticker = setInterval(tick, 30000); }

export function ddayTileHTML(st) {
  const t = examTarget(st);
  const official = nextExam();
  const time = st.get("examTime");
  if (editing.has(st.prefix)) {
    return '<article class="tile exam-tile dday-tile"><span class="tile-label">시험일 정하기</span>' +
      '<label class="dday-edit"><span class="sr-only">시험 날짜</span><input type="date" id="dd-date" min="' + today() + '" value="' + esc(t ? t.date : "") + '"></label>' +
      '<label class="dday-edit"><span class="tile-sub">시작 시각 (모르면 비워 두세요)</span><input type="time" id="dd-time" value="' + esc(validTime(time) ? time : "") + '"></label>' +
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
  const until = examMoment(t.date, time);
  startTicker();
  return '<article class="tile exam-tile dday-tile">' +
    '<span class="tile-label">다음 시험 · ' + esc(t.label) + "</span>" +
    '<span class="dday">' + (left === 0 ? "D-DAY" : "D-" + left) + "</span>" +
    '<span class="tile-sub countdown" data-until="' + until + '">' + remainText(until - Date.now()) + "</span>" +
    '<span class="tile-sub">' + fmtDate(t.date) + (validTime(time) ? " " + time + " 시작" : " 0시 기준") +
      (t.source ? ' · <a href="' + t.source + '" target="_blank" rel="noopener">공식 일정</a>' : "") + "</span>" +
    '<span class="dday-actions"><button type="button" class="link-btn" id="dd-edit">시험일·시각 바꾸기</button></span>' +
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
      const tm = tile.querySelector("#dd-time").value;
      if (!v || v < today()) { tile.querySelector("#dd-msg").textContent = "오늘 이후의 날짜를 골라 주세요."; return; }
      st.set("examDate", v); st.set("examTime", validTime(tm) ? tm : null); editing.delete(st.prefix); rerender();
    }
  };
}
