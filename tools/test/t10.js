(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const W = window.innerWidth;
  const out = ["width " + W];
  const scrollers = el => el.closest(".tablist, .segmented, .mock-table-wrap");
  function audit(name) {
    const issues = [];
    if (document.documentElement.scrollWidth > W) issues.push("가로스크롤 " + document.documentElement.scrollWidth);
    const over = $$("#app *, nav.tabs *").filter(el => {
      if (scrollers(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > W + 1 || r.left < -1);
    }).slice(0, 3).map(el => el.tagName + "." + el.className + "(" + Math.round(el.getBoundingClientRect().right) + ")");
    if (over.length) issues.push("넘침 " + over.join(", "));
    const small = $$("#app button, #app a, #app input, #app select, #app summary").filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.height < 32 && !el.closest(".badges") && !el.classList.contains("badge");
    }).slice(0, 4).map(el => (el.id || el.className || el.tagName) + ":" + Math.round(el.getBoundingClientRect().height) + "px «" + el.textContent.trim().slice(0, 12) + "»");
    if (small.length) issues.push("작은 터치영역 " + small.join(", "));
    const clipped = $$("#app *").filter(el => {
      const cs = getComputedStyle(el);
      return (cs.overflowX === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 2 && !el.classList.contains("meter-track") && !el.classList.contains("bar") && !el.classList.contains("sr-only");
    }).slice(0, 2).map(el => el.className);
    if (clipped.length) issues.push("잘림 " + clipped.join(", "));
    out.push((issues.length ? "ISSUE " : "OK    ") + name + (issues.length ? " → " + issues.join(" | ") : ""));
  }
  const go = async (hash, ms = 350) => { location.hash = hash; await wait(ms); };
  try {
    // 기록 조금 만들기
    await go("grammar"); $$(".q")[0].querySelector('[data-o="1"]').click(); $$(".q")[1].querySelector('[data-o="1"]').click();
    await go("home"); audit("홈");
    await go("vocab"); { const _c = document.querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } } audit("단어장");
    $(".card-face").click(); await wait(50); audit("단어장(펼침)");
    $('[data-mode="cards"]').click(); await wait(80); $("#flip").click(); await wait(50); audit("플래시카드");
    $('[data-mode="quiz"]').click(); await wait(80); $$(".q")[0].querySelector('[data-o="0"]').click(); await wait(30); audit("단어 퀴즈");
    $('[data-mode="compare"]').click(); await wait(80); audit("헷갈리는 단어");
    await go("grammar"); $("details.g-more summary").click(); await wait(30); audit("문법");
    await go("reading"); $("#toggle-trans").click(); await wait(30); audit("독해(중문)");
    $('[data-rtype="info"]').click(); await wait(150); audit("독해(정보 검색)");
    await go("listening", 2600); $(".l-show-script").click(); await wait(30); audit("청해");
    await go("notes"); $("[data-retry]") && $("[data-retry]").click(); await wait(50); audit("오답 노트");
    await go("sprint"); audit("D-30 설정");
    $("#s-date").value = "2026-12-06"; $("#setup").requestSubmit(); await wait(400); audit("D-30 진단");
    $$(".q").forEach(q => q.querySelector('[data-o="1"]').click()); await wait(50);
    $("#d-finish").click(); await wait(400); audit("D-30 일일 계획");
    await go("mock"); audit("모의고사 소개");
    $("#mock-start").requestSubmit(); await wait(300); $('[data-jump="22"]').click(); await wait(200); audit("모의고사 진행(독해)");
    $("#m-submit").click(); await wait(50); audit("모의고사 제출 확인");
    $("#m-submit-yes").click(); await wait(2800); audit("모의고사 2부(청해)");
    $("#m-submit").click(); await wait(50); $("#m-submit-yes").click(); await wait(400); audit("모의고사 결과");
    await go("backup"); audit("기록 관리");
    $("#b-reset").click(); await wait(50); audit("기록 관리(확인)");
  } catch (e) { out.push("ERROR " + e.stack); }
  return out.join("\n");
})()
