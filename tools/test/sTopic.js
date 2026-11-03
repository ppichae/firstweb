(async () => {
  // 단어 주제 목록, 오답 한 번에 풀기, 선택 칸 화살표, 더보기 새 모양, 7일 그래프가 화면 안에 들어오는지
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1300); };
  const css = (el, p) => window.getComputedStyle(el)[p];
  const noScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  const narrow = window.innerWidth <= 640;
  try {
    for (const [room, total] of [["n3/vocab", 733], ["vocab", null]]) {
      await go(room);
      const tiles = $$(".topic-tile");
      check(room + " 주제 칸 13개(12주제+전체)", tiles.length === 13, tiles.length);
      const num = t => Number(t.querySelector(".topic-sub").textContent.split("/")[1]);
      const all = num(tiles[tiles.length - 1]);
      const sum = tiles.slice(0, -1).reduce((s, t) => s + num(t), 0);
      check(room + " 주제별 합계 = 전체(빠짐·겹침 없음)", sum === all && (total === null || all === total), sum + " / " + all);
      check(room + " 첫 화면에 '더 보기' 없음", !$("#v-more-btn") && !$(".card"));
      check(room + " 가로 스크롤 없음", noScroll());
      tiles[0].click(); await wait(200);
      check(room + " 주제를 누르면 그 단어만, 더 보기 없이 전부", $$(".card").length === num({ querySelector: () => ({ textContent: "/" + $("#v-count").textContent.split("개")[0] }) }) && !$("#v-more-btn"), $$(".card").length);
      check(room + " 주제 제목 표시", $(".cat-head h3").textContent === "일·비즈니스");
      $("#cat-back").click(); await wait(100);
      check(room + " 주제 목록으로 돌아옴", $$(".topic-tile").length === 13);
      // 검색은 주제 목록에서 바로 된다
      const q = $("#v-q"); q.value = "計算"; q.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100);
      check(room + " 첫 화면 검색", $$(".card .word").some(w => w.textContent.includes("計算")), $$(".card").length);
      q.value = ""; q.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100);
      check(room + " 검색을 지우면 주제 목록", $$(".topic-tile").length === 13);
    }

    // 선택 칸은 어디서나 같은 화살표
    await go("n3/vocab"); $('.topic-tile[data-cat="all"]').click(); await wait(100);
    const hasArrow = s => css(s, "backgroundImage").includes("svg") && parseFloat(css(s, "paddingRight")) >= 36 && css(s, "appearance") === "none";
    check("품사 선택 칸 화살표", hasArrow($("#v-pos")), css($("#v-pos"), "backgroundPosition"));
    check("품사 칸 화살표 위치(오른쪽 14px·가운데)", css($("#v-pos"), "backgroundPosition") === "right 14px center" || css($("#v-pos"), "backgroundPosition").includes("calc(100% - 14px)"), css($("#v-pos"), "backgroundPosition"));
    $("#cat-back").click(); await wait(50);
    await go("n3/kanji"); $(".k-row").click(); await wait(500);
    const speed = document.querySelector("[data-sp-speed]");
    check("한자 속도 선택 칸 화살표", !!speed && hasArrow(speed));
    const close = document.querySelector(".kd-close"); if (close) close.click();
    await wait(100);

    // 오답 만들기: 틀릴 때까지 첫 보기를 고른다
    await go("n3/vocab"); $('[data-mode="quiz"]').click(); await wait(300);
    for (let k = 0, bad = 0; k < 12 && bad < 2; k++) { const o = $(".qr-q .opt"); if (!o) break; o.click(); await wait(80); if ($(".qr-q .fb-verdict.bad")) bad++; const nx = $(".qr-next"); if (nx) { nx.click(); await wait(100); } }
    $('[data-mode="list"]').click(); await wait(100);
    // 오답 노트
    await go("n3/notes");
    if ($("#n-run")) {
      const before = $$(".note").length;
      check("오답 칸에 내 답과 정답", !!$(".note-ans .is-bad") && !!$(".note-ans .is-good"));
      check("해설은 접혀 있음", $$(".note details").every(d => !d.open));
      $("#n-run").click(); await wait(200);
      check("한 번에 풀기: 첫 문제", !!$(".q .opt") && $(".detail-pos").textContent === "1 / " + before, $(".detail-pos").textContent);
      for (let i = 0; i < before; i++) {
        $(".q .opt").click(); await wait(80);
        check("문제 " + (i + 1) + " 답하면 다음 버튼", !!$("#n-next-btn"));
        $("#n-next-btn").click(); await wait(150);
      }
      check("끝나면 결과", !!$(".note-result") && $(".note-result .tile-value").textContent.endsWith("/ " + before));
      $("#n-exit").click(); await wait(150);
      check("오답 노트로 돌아옴", !!$(".panel-head h2") && $(".panel-head h2").textContent === "오답 노트");
    } else log.push("SKIP 오답 없음");
    check("오답 노트 가로 스크롤 없음", noScroll());

    await go("n3/together");
    check("함께 보기 메뉴 없음", ![...document.querySelectorAll("#tablist .tab")].some(t => t.textContent === "함께 보기"));

    await go("n3");
    const wk = $(".week");
    if (wk) {
      const box = $(".week-scroll") || wk;
      const last = [...wk.querySelectorAll(".week-col")].pop().getBoundingClientRect(), card = wk.closest("article, .card-box").getBoundingClientRect();
      check("7일 그래프 '오늘' 칸이 칸 안에", last.right <= card.right && box.scrollWidth <= box.clientWidth + 1, Math.round(last.right) + "/" + Math.round(card.right));
    }
    // 숫자 칸: 글자와 그래프가 겹치지 않는다
    const overlap = (a, b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top); };
    check("숫자 칸 글자와 원형 그래프가 겹치지 않음", $$(".stat-tile").every(t => { const r = t.querySelector(".stat-ring"); return !r || (!overlap(r, t.querySelector(".tile-sub")) && !overlap(r, t.querySelector(".tile-value")) && !overlap(r, t.querySelector(".tile-label"))); }));

    if (narrow) {
      document.querySelector(".m-bar [data-m-more]").click(); await wait(150);
      const sheet = document.querySelector(".m-sheet");
      check("더보기: 메뉴에 아이콘", sheet.querySelectorAll(".m-link svg").length === sheet.querySelectorAll(".m-link").length);
      check("더보기: 설정은 작은 버튼", !!sheet.querySelector('.m-tool[href="#rooms"]') && !!sheet.querySelector('.m-tool[data-m-proxy="theme-toggle"]') && !sheet.querySelector(".m-row"));
      check("더보기: 함께 보기 없음", ![...sheet.querySelectorAll(".m-link")].some(a => a.textContent === "함께 보기"));
      check("더보기가 화면 안에", sheet.getBoundingClientRect().bottom <= window.innerHeight + 1 && sheet.scrollWidth <= sheet.clientWidth);
      sheet.close();
    }
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
