// N3 방 · 한자 · 독해 · 청해: 아직 자료가 없어서 '콘텐츠 준비 중'으로만 보여 준다
const AREAS = [
  ["한자", "漢字", "N3 한자 자료가 아직 없어요. 한자 상세 학습, 획순 애니메이션, 따라 쓰기, 한자 퀴즈는 다음 단계(5~8단계)에서 만들 예정이에요."],
  ["독해", "読解", "N3 독해 지문과 문제 자료가 아직 없어요."],
  ["청해", "聴解", "N3 청해 스크립트와 음성 자료가 아직 없어요."],
];

function render(app) {
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>한자 · 독해 · 청해</h2><p>이 영역은 자료를 준비하는 중이에요. 임시 내용으로 채우지 않았어요.</p></div></div>' +
      '<div class="pending-list">' + AREAS.map(([t, jp, note]) =>
        '<article class="card-box pending"><h3>' + t + ' <span class="jp" lang="ja">' + jp + '</span></h3><p class="hint">콘텐츠 준비 중이에요. ' + note + "</p></article>").join("") +
      "</div>" +
    "</section>";
}

export default { id: "n3/more", label: "한자·독해·청해", jp: "準備中", render };
