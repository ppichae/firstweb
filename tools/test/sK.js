(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1600); };
  const type = async v => { const i = $("#k-q"); i.value = v; i.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(250); };
  const room = window.parent.ROOM || "n3";
  try {
    if (window.parent.DARK) document.documentElement.dataset.theme = "dark";
    await go(room === "n1" ? "kanji" : "n3/kanji");
    const lv = room === "n1" ? "N1" : "N3", want = room === "n1" ? 401 : 586;
    check(lv + " 한자 목록 전체 표시(숨김 없음)", $$(".k-row").length === want, $$(".k-row").length);
    $('[data-klv="all"]').click(); await wait(400);
    check("전체 필터 987자", $$(".k-row").length === 987, $$(".k-row").length);
    $('[data-klv="' + (room === "n1" ? "N3" : "N1") + '"]').click(); await wait(400);
    check("다른 급수 필터", $$(".k-row").length === (room === "n1" ? 586 : 401), $$(".k-row").length);
    $('[data-klv="' + lv + '"]').click(); await wait(400);
    // 가나다순
    const eums = $$(".k-row .kr-ko b").map(b => b.textContent);
    const sorted = eums.every((e, i) => i === 0 || eums[i - 1].localeCompare(e, "ko") <= 0);
    check("한국 음 가나다순 정렬", sorted, eums.slice(0, 6).join(","));
    check("첫 묶음이 ㄱ", ($(".k-ghead") || {}).dataset && $(".k-ghead").dataset.kgroup === "ㄱ");
    check("목록에 훈음 표시", $$(".k-row .kr-ko").every(x => x.textContent.trim().length > 0));
    // 초성 바로가기
    const before = window.scrollY;
    const ixs = $$(".k-ix").filter(b => !b.disabled); const ix = ixs[Math.floor(ixs.length / 2)];
    ix.click(); await wait(900);
    const head = $('[data-kgroup="' + ix.dataset.kix + '"]');
    const top = head.getBoundingClientRect().top;
    check("초성 바로가기로 이동(" + ix.dataset.kix + ")", window.scrollY > before && top > 0 && top < window.innerHeight * 0.5, "top=" + Math.round(top));
    const ixBox = $("#k-index").getBoundingClientRect();
    check("초성 줄이 위에 고정됨", ixBox.top >= 0 && ixBox.top < 140, Math.round(ixBox.top));
    window.scrollTo(0, 0); await wait(200);
    // 검색
    if (room === "n1") {
      await type("막힐"); check("훈으로 검색(막힐 → 阻)", $$(".k-row").some(r => r.dataset.kanji === "阻"), $$(".k-row").map(r => r.dataset.kanji).join(""));
      await type("はばむ"); check("훈독으로 검색(はばむ → 阻)", $$(".k-row").length >= 1 && $$(".k-row").some(r => r.dataset.kanji === "阻"));
      await type("ソ"); check("음독으로 검색(ソ)", $$(".k-row").some(r => r.dataset.kanji === "阻"));
      await type("阻"); check("한자로 검색", $$(".k-row").length === 1 && $$(".k-row")[0].dataset.kanji === "阻");
    } else {
      await type("배울"); check("훈으로 검색(배울 → 学)", $$(".k-row").some(r => r.dataset.kanji === "学"));
      await type("まなぶ"); check("훈독으로 검색(まなぶ → 学)", $$(".k-row").some(r => r.dataset.kanji === "学"));
      await type("ガク"); check("음독으로 검색(ガク)", $$(".k-row").some(r => r.dataset.kanji === "学"));
    }
    await type("");
    // 목록과 상세 화면 훈음이 같음
    const rows0 = $$(".k-row"); let same = 0, diff = [];
    for (const ch of [rows0[0], rows0[37], rows0[150], rows0[rows0.length - 1]].map(x => x.dataset.kanji)) {
      const r = $(".k-row[data-kanji=\"" + ch + "\"]");
      const listKo = r.querySelector(".kr-ko").textContent.trim();
      r.click(); await wait(500);
      const d = document.querySelector(".kanji-dialog");
      const dKo = (d.querySelector(".kd-ko") || {}).textContent;
      const hasKo = !!r.querySelector(".kr-ko b");
      if (!hasKo || dKo.trim() === listKo) same++; else diff.push(r.dataset.kanji + ":" + listKo + "/" + dKo);
      if (ch === rows0[37].dataset.kanji) {
        check("상세 창 획순·쓰기·단어 유지", !!d.querySelector("#kd-strokes") && !!d.querySelector("#kd-write") && !!d.querySelector(".kd-words, .kd-sec"));
        check("상세 창 음독·훈독 표시", d.querySelectorAll(".rd").length >= 1);
        check("내부 상태 문구 노출 없음", !/검수|확인 권장|AI 생성|미완성|근거 부족|미확인/.test(d.textContent));
      }
      d.close(); await wait(150);
    }
    check("목록과 상세 창 훈음 일치", diff.length === 0, diff.join(" "));
    // 즐겨찾기 기록 유지
    const r0 = $$(".k-row")[2]; r0.click(); await wait(500);
    let d = document.querySelector(".kanji-dialog"); d.querySelector("[data-kfav]").click(); await wait(200); d.close(); await wait(300);
    $('[data-kf="fav"]').click(); await wait(300);
    check("즐겨찾기 필터", $$(".k-row").length === 1 && $$(".k-row")[0].dataset.kanji === r0.dataset.kanji, $$(".k-row").length);
    $('[data-kf="all"]').click(); await wait(300);
    // 일본에서 만든 한자
    if (room === "n1") {
      await type("枠"); const r = $$(".k-row")[0];
      check("枠: 훈음 대신 '일본에서 만든 한자'", r && r.textContent.includes("일본에서 만든 한자"), r && r.textContent);
      r.click(); await wait(500); d = document.querySelector(".kanji-dialog");
      check("枠 상세 창 열림·훈독 わく", d.textContent.includes("わく") && d.textContent.includes("일본에서 만든 한자"));
      d.close(); await type("");
    }
    // 퀴즈
    $('[data-kmode="quiz"]').click(); await wait(500);
    check("한자 퀴즈 문제 표시", !!$(".qr-q .opt") || !!$(".qr-q"), ($("#kq-box") || {}).textContent && $("#kq-box").textContent.slice(0, 40));
    for (let k = 0; k < 8; k++) { const o = $(".qr-q .opt"); if (o) o.click(); await wait(80); const b = $(".qr-next"); if (!b) break; b.click(); await wait(120); }
    check("퀴즈 진행 중 오류 없음", !!$(".qr-q") || !!$(".qr-result"));
    $('[data-kmode="list"]').click(); await wait(400);
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth, document.documentElement.scrollWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
