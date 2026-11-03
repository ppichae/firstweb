(async () => {
  // 문법 주제 목록, 단어·문법의 주제별 퀴즈와 플래시카드
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1300); };
  const noScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  const LS = k => JSON.parse(localStorage.getItem(k) || "null");
  const change = async (el, v) => { el.value = v; el.dispatchEvent(new window.Event("change", { bubbles: true })); await wait(250); };
  try {
    const fetchJson = async p => (await fetch(p, { cache: "no-cache" })).json();
    const gt = await fetchJson("data/grammar-topics.json"), vt = await fetchJson("data/vocab-topics.json");
    const g3 = await fetchJson("data/n3/grammar.json"), v3 = await fetchJson("data/n3/vocab.json");

    // 문법 주제 화면
    for (const [room, total] of [["n3/grammar", 306], ["grammar", null]]) {
      await go(room);
      const tiles = $$(".topic-tile");
      check(room + " 주제 칸 14개(13주제+전체)", tiles.length === 14, tiles.length);
      const num = t => Number(t.querySelector(".topic-sub").textContent.split("/")[1]);
      const all = num(tiles[tiles.length - 1]), sum = tiles.slice(0, -1).reduce((s, t) => s + num(t), 0);
      check(room + " 주제별 합계 = 전체(빠짐·겹침 없음)", sum === all && (total === null || all === total), sum + " / " + all);
      check(room + " 첫 화면에 더 보기 없음", !$("#g-more-btn") && !$(".g-item"));
      const first = num(tiles[0]);
      tiles[0].click(); await wait(250);
      check(room + " 주제를 누르면 그 문형만 전부", $$(".g-item").length === first && !$("#g-more-btn"), $$(".g-item").length + "/" + first);
      check(room + " 주제 제목", $(".cat-head h3").textContent === "시간·순서");
      check(room + " 가로 스크롤 없음", noScroll());
      $("#cat-back").click(); await wait(100);
      const q = $("#g-q"); q.value = "ように"; q.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(150);
      check(room + " 첫 화면 검색", $$(".g-item").length >= 1, $$(".g-item").length);
      q.value = ""; q.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100);
      check(room + " 검색을 지우면 주제 목록", $$(".topic-tile").length === 14);
    }

    // 단어: 주제별 퀴즈
    const bizNums = new Set(vt.n3.biz);
    const inBiz = id => { const m = /-v0*(\d+)$/.exec(id || ""); return m && bizNums.has(Number(m[1])); };
    await go("n3/vocab");
    $('[data-cat="biz"]').click(); await wait(200);
    check("단어 주제 화면에 퀴즈·카드 바로 가기", !!$('.cat-go [data-mode="quiz"]') && !!$('.cat-go [data-mode="cards"]'));
    $('.cat-go [data-mode="quiz"]').click(); await wait(400);
    check("단어 퀴즈: 고른 주제 유지", $("#v-topic").value === "biz", $("#v-topic").value);
    const before = (LS("n3lab:attempts") || []).length;
    for (let k = 0; k < 6; k++) { const o = $(".qr-q .opt"); if (!o) break; o.click(); await wait(80); const nx = $(".qr-next"); if (nx) { nx.click(); await wait(100); } }
    const made = (LS("n3lab:attempts") || []).slice(before);
    const ids = made.map(a => a.snap && a.snap.wordId).filter(Boolean);
    check("단어 퀴즈: 나온 문제가 모두 그 주제 단어", ids.length >= 5 && ids.every(inBiz), ids.length + "개: " + ids.filter(x => !inBiz(x)).join(","));

    // 단어: 주제별 카드
    $('[data-mode="cards"]').click(); await wait(300);
    check("단어 카드: 고른 주제 유지", $("#v-topic").value === "biz");
    const bizWords = new Set(v3.items.filter(v => inBiz(v.id)).map(v => v.word));
    const seen = [];
    for (let k = 0; k < 4 && $(".flash-word"); k++) { seen.push($(".flash-word").textContent); $("#flip").click(); await wait(60); $('[data-grade="good"]').click(); await wait(80); }
    check("단어 카드: 나온 카드가 모두 그 주제 단어", seen.length >= 3 && seen.every(w => bizWords.has(w)), seen.join(","));
    await change($("#v-topic"), "time");
    check("단어 카드: 주제를 바꾸면 그 주제 카드", !!$(".flash-word") && new Set(v3.items.filter(v => vt.n3.time.includes(Number(/-v0*(\d+)$/.exec(v.id)[1]))).map(v => v.word)).has($(".flash-word").textContent), $(".flash-word") && $(".flash-word").textContent);
    await change($("#v-topic"), "");
    check("단어 카드: 전체로 되돌림", $("#v-topic").value === "");
    $('[data-mode="list"]').click(); await wait(200);
    check("전체를 고르면 단어장은 주제 목록", $$(".topic-tile").length === 13);

    // 문법: 주제별 퀴즈와 카드
    const willNums = new Set(gt.n3.will);
    const inWill = id => { const m = /-g0*(\d+)$/.exec(id || ""); return m && willNums.has(Number(m[1])); };
    await go("n3/grammar");
    $('[data-cat="will"]').click(); await wait(200);
    $('.cat-go [data-mode="quiz"]').click(); await wait(400);
    check("문법 퀴즈: 고른 주제 유지", $("#g-topic").value === "will");
    const b2 = (LS("n3lab:attempts") || []).length;
    for (let k = 0; k < 6; k++) { const o = $(".qr-q .opt"); if (!o) break; o.click(); await wait(80); const nx = $(".qr-next"); if (nx) { nx.click(); await wait(100); } }
    const gids = (LS("n3lab:attempts") || []).slice(b2).map(a => a.snap && a.snap.wordId).filter(Boolean);
    check("문법 퀴즈: 나온 문제가 모두 그 주제 문형", gids.length >= 5 && gids.every(inWill), gids.length + "개: " + gids.filter(x => !inWill(x)).join(","));
    $('[data-mode="cards"]').click(); await wait(300);
    const willPatterns = new Set(g3.items.filter(g => inWill(g.id)).map(g => g.pattern));
    check("문법 카드: 그 주제 문형", $("#g-topic").value === "will" && !!$(".flash-word") && willPatterns.has($(".flash-word").textContent), $(".flash-word") && $(".flash-word").textContent);
    check("가로 스크롤 없음", noScroll());

    // N1: 기본 문법도 주제에 들어간다, 시험형은 주제 선택이 없다
    await go("grammar");
    $('[data-cat="limit"]').click(); await wait(250);
    check("N1 기본 문법도 주제에 포함(ずくめ)", $$(".g-pattern").some(p => p.textContent.includes("ずくめ")));
    $('[data-mode="quiz"]').click(); await wait(300);
    $('[data-gq="exam"]').click(); await wait(300);
    check("N1 문법 시험형: 주제 선택 없음", !$("#g-topic"));
    $('[data-gq="mix"]').click(); await wait(300);
    check("N1 문법 일반 퀴즈: 주제 선택 있음", !!$("#g-topic") && $("#g-topic").value === "limit");
    await go("vocab"); $('[data-mode="quiz"]').click(); await wait(300);
    $('[data-qt="exam"]').click(); await wait(300);
    check("N1 단어 시험형: 주제 선택 숨김", $(".topic-pick").style.display === "none");
    $('[data-qt="mix"]').click(); await wait(300);
    check("N1 단어 일반 퀴즈: 주제 선택 보임", $(".topic-pick").style.display !== "none");
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
