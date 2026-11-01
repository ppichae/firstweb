// '시험 대비' 묶음: 시험 대비 안의 작은 메뉴(D-30 계획 · 모의고사 · 오답 노트)와 시험이 끝난 뒤 안내 (N1·N3 같은 모양)
// 모의고사는 메뉴에서 따로 바로 들어갈 수도 있다. 이 칸은 같은 묶음의 화면끼리 오가게 해 준다.
import { esc, AREAS, fmtDate, pct, dateKey } from "./util.js";

const NAV = {
  n1: [["sprint", "D-30 계획"], ["mock", "모의고사"], ["notes", "오답 노트"]],
  n3: [["n3/exam", "D-30 계획 · 연습"], ["n3/mock", "모의고사"], ["n3/notes", "오답 노트"]],
};

export function examNavHTML(roomId, active) {
  return '<nav class="segmented exam-nav" aria-label="시험 대비">' + NAV[roomId].map(([id, label]) =>
    '<a class="seg" href="#' + id + '"' + (id === active ? ' aria-current="page" aria-selected="true"' : "") + ">" + label + "</a>").join("") + "</nav>";
}

// 시험이 끝난 뒤에도 계속 쓸 수 있게: 복습과 다음 목표 안내. 실제로 있는 화면으로만 연결한다
export function afterExamHTML(roomId) {
  const links = roomId === "n3"
    ? [["n3/vocab", "단어 복습 계속하기"], ["n3/grammar", "문법 복습"], ["n3/notes", "오답 노트 정리"], ["home", "N1 공부방에서 다음 급수 준비"]]
    : [["vocab", "단어 복습 계속하기"], ["grammar", "문법 복습"], ["notes", "오답 노트 정리"], ["reading", "독해로 고급 일본어 읽기"]];
  return '<article class="card-box"><h3>시험이 끝난 뒤에도</h3>' +
    '<p class="hint">학습 기록·오답·배지·레벨은 그대로 남아요. 복습을 이어 가거나 다음 목표를 정해 보세요.</p>' +
    '<div class="toolbar">' + links.map(([h, l]) => '<a class="btn ghost sm" href="#' + h + '">' + esc(l) + "</a>").join("") + "</div></article>";
}

// N1 모의고사 최근 결과 요약 (기록이 없으면 안내만)
export function mockSummaryHTML(mocks, href) {
  if (!mocks || !mocks.length) {
    return '<article class="card-box"><h3>모의고사</h3><p class="hint">아직 푼 모의고사가 없어요. 실제 시험처럼 시간을 재고 풀어 볼 수 있어요.</p>' +
      '<a class="btn ghost sm" href="#' + href + '">모의고사 보기</a></article>';
  }
  const last = mocks[mocks.length - 1];
  const areas = Object.entries(last.areas || {}).filter(([, r]) => r.t);
  const weak = areas.slice().sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)[0];
  return '<article class="card-box"><h3>모의고사 최근 결과</h3>' +
    '<p class="hint">' + fmtDate(dateKey(new Date(last.at))) + " · 전체 " + last.total.c + " / " + last.total.t + " (" + pct(last.total.c, last.total.t) + "%) · 지금까지 " + mocks.length + "회</p>" +
    '<div class="meters">' + areas.map(([a, r]) =>
      '<div class="meter"><span class="meter-name">' + AREAS[a] + '</span><span class="meter-track" aria-hidden="true"><span style="width:' + (r.c / r.t * 100) + '%"></span></span><span class="meter-val">' + r.c + " / " + r.t + "</span></div>").join("") + "</div>" +
    (weak ? '<p class="hint">가장 낮은 영역: <b>' + AREAS[weak[0]] + "</b> · 틀린 문제는 오답 노트에 모여 있어요.</p>" : "") +
    '<div class="toolbar"><a class="btn ghost sm" href="#' + href + '">모의고사 보기</a></div></article>';
}
