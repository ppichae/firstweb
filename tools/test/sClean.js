(async () => {
  // 정보 줄이기: 안내문을 지웠고, 접은 정보는 눌러서 볼 수 있으며, 기능은 그대로인지
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1500); };
  // 접힌 칸(details) 안의 요소는 화면에 보이지 않아도 크기를 돌려줄 수 있어서, 열려 있는지를 먼저 본다
  const visible = el => !!el && !el.closest("details:not([open])") && el.getClientRects().length > 0;
  try {
    check("머리글 설명 없음", !document.getElementById("site-lede") && !document.getElementById("site-eyebrow"));
    check("맨 아래 안내는 한 문단, 공식 문제가 아니라는 안내 유지", document.querySelectorAll("footer p").length === 1 && document.querySelector("footer").textContent.includes("JLPT 공식 문제가 아니에요"));
    check("맨 아래에 틀린 저장 안내 없음", !document.querySelector("footer").textContent.includes("브라우저에만"));
    // N3 홈
    await go("n3");
    const more = $(".more-box");
    check("N3 홈: 통계·일정은 접혀 있음", !!more && !more.open && !visible(more.querySelector(".weeks")));
    check("N3 홈: 지금 할 일·숫자 칸·성장은 바로 보임", visible($(".todo-tile")) && visible($(".tiles")) && visible($(".growth")));
    check("N3 홈: 로드맵과 겹치던 과정 칸 없음", !$(".courses"));
    more.querySelector("summary").click(); await wait(100);
    check("N3 홈: 펼치면 4주 일정·7일 그래프·시험 구성·숫자 기준", more.open && visible(more.querySelector(".weeks")) && more.textContent.includes("최근 7일") && more.textContent.includes("N3 시험 구성") && !!more.querySelector(".stat-help"));
    // 단어 카드
    await go("n3/vocab");
    const card = $$(".card").find(c => c.querySelector(".word").textContent === "計算");
    check("단어: 접힌 카드는 단어와 버튼만", !card.querySelector(".pos") && !card.querySelector(".kj") && card.querySelector("[data-act=known]").textContent.includes("외웠어요"), card.textContent);
    check("단어: 자료 안내 상자 없음", !$(".notice"));
    check("단어: 누르면 뜻이 보인다는 안내 한 줄", $("#v-count").textContent.includes("단어를 누르면 뜻이 보여요"));
    card.querySelector(".card-face").click(); await wait(100);
    const open = $$(".card").find(c => c.querySelector(".word").textContent === "計算");
    check("단어: 펼치면 읽기·뜻·예문·품사·한자", open.textContent.includes("けいさん") && open.textContent.includes("계산") && !!open.querySelector(".ex-own") && !!open.querySelector(".pos") && !!open.querySelector('[data-kanji="計"]'));
    check("단어: 펼쳐도 출처 배지 없음", !open.querySelector(".badges"));
    open.querySelector('[data-kanji="計"]').click(); await wait(500);
    const dlg = document.querySelector(".kanji-dialog");
    check("단어: 한자 버튼으로 한자 창 열림", dlg.open && dlg.textContent.includes("이 한자가 쓰인 단어"));
    check("한자 창: 라이선스 안내 유지", dlg.querySelector(".kd-foot").textContent.includes("KanjiVG") && dlg.querySelector(".kd-foot").textContent.includes("KRADFILE"));
    dlg.close(); await wait(100);
    // 문법
    await go("n3/grammar");
    const g = $(".g-item");
    check("문법: 평소에는 문형과 뜻만", !!g.querySelector(".g-mean") && !visible(g.querySelector(".g-ex")) && g.querySelector("summary").textContent === "예문·설명 보기");
    g.querySelector("summary").click(); await wait(100);
    check("문법: 펼치면 예문", visible($(".g-item .g-ex")), $(".g-item .g-more").open);
    // 퀴즈: 답한 뒤 정답 여부 + 학습 정보만
    $('[data-mode="quiz"]').click(); await wait(400);
    $('[data-gq="meaning"]').click(); await wait(300);
    check("퀴즈: 자체 제작 배지·안내 없음", !$(".q .badges") && $("#gq-note").textContent === "");
    $(".q .opt").click(); await wait(100);
    check("퀴즈: 답한 뒤 판정과 학습 정보만", !!$(".fb-verdict") && !$(".fb dl") && !!$(".learn-box"));
    check("퀴즈: 정답 칸 표시 유지", !!$(".opt.correct"));
    // 모의고사는 공식 문제로 오해하지 않게 안내 유지
    await go("n3/mock");
    check("N3 모의고사: 연습 테스트 안내 유지", app().textContent.includes("어휘·문형 문제로 만든 연습 테스트예요"));
    await go("n3/together");
    check("함께 보기: 틀린 '동기화 안 됨' 안내 없음", !app().textContent.includes("자동 동기화는 되지 않아요"));
    // 빈 범위 안내는 남긴다
    await go("n3/grammar"); $('[data-mode="quiz"]').click(); await wait(300); $('[data-gscope="fav"]').click(); await wait(300);
    check("퀴즈: 범위에 문형이 없으면 안내", $("#gq-note").textContent.includes("이 범위에 문형이 없어요"));
    $('[data-gscope="all"]').click(); await wait(200);
    // N1
    localStorage.setItem("jlpt:room", "n1");
    await go("home");
    const m1 = $(".more-box");
    check("N1 홈: 영역별 정답률은 접혀 있고 펼칠 수 있음", !!m1 && !visible(m1.querySelector(".home-grid")) && m1.textContent.includes("영역별 정답률"));
    await go("sprint");
    check("N1 D-30 시작 화면: 진행 안내 접힘", !!$(".more-box") && !$(".more-box").open);
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
