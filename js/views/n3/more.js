// N3 방 · 독해 · 청해: N1 방과 같은 메뉴 자리에 두되, 자료가 없어서 '콘텐츠 준비 중'으로만 보여 준다
function pendingView(id, label, jp, title, note) {
  return {
    id, label, jp,
    render(app) {
      app.innerHTML =
        '<section class="panel">' +
          '<div class="panel-head"><div><h2>' + title + "</h2><p>이 영역은 자료를 준비하는 중이에요. 임시 내용으로 채우지 않았어요.</p></div></div>" +
          '<article class="card-box pending"><h3>콘텐츠 준비 중</h3><p class="hint">' + note + "</p></article>" +
        "</section>";
    },
  };
}

export const n3reading = pendingView("n3/reading", "독해", "読解", "독해", "N3 독해 지문과 문제 자료가 아직 없어요. 자료가 준비되면 N1 독해 화면과 같은 구조로 열릴 예정이에요.");
export const n3listening = pendingView("n3/listening", "청해", "聴解", "청해", "N3 청해 스크립트와 음성 자료가 아직 없어요. 자료가 준비되면 N1 청해 화면과 같은 구조로 열릴 예정이에요.");
