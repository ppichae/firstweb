// 학습 영역 목록: 앞으로 넓힐 영역까지 한곳에 적어 둔다
// 자료가 준비된 영역(ready: true)만 화면에 나온다. 새 영역은 자료와 화면을 만든 뒤 ready를 켜면 된다.
// 급수(N5~N1)는 JLPT 시험 단계이고, 레벨(Lv)은 각 공부방에서 쌓은 공부량이라 서로 다른 개념이다.
export const TRACKS = [
  { id: "jlpt-n5", group: "JLPT", label: "N5", room: "n3", ready: true, note: "N3 공부방 '기초'에서 문자와 기본 문장을 배워요." },
  { id: "jlpt-n4", group: "JLPT", label: "N4", room: "n3", ready: true, note: "N3 공부방 '기초'의 활용·핵심 문형으로 배워요." },
  { id: "jlpt-n3", group: "JLPT", label: "N3", room: "n3", ready: true },
  { id: "jlpt-n2", group: "JLPT", label: "N2", room: null, ready: false },
  { id: "jlpt-n1", group: "JLPT", label: "N1", room: "n1", ready: true },
  { id: "life", group: "실생활 일본어", label: "일상·여행·식당·쇼핑·교통·직장·전화·이메일", room: null, ready: false },
  { id: "advanced", group: "고급 일본어", label: "뉴스·칼럼·고급 문법·관용 표현·사자성어·한자 심화·문화", room: null, ready: false },
  { id: "free", group: "자유 학습", label: "나만의 단어장·즐겨찾기·개인 목표·자유 독해·청해", room: null, ready: false },
];

export const readyTracks = room => TRACKS.filter(t => t.ready && (!room || t.room === room));
