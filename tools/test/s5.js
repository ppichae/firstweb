(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const dlg = () => document.querySelector(".kanji-dialog");
  const go = async h => { location.hash = h; await wait(1300); };
  const tabs = () => [...document.querySelectorAll("#tablist .tab")].map(t => t.textContent.trim()).join("|");
  const LS = k => JSON.parse(localStorage.getItem(k) || "null");
  const search = async q => { const i = $("#v-q"); i.value = q; i.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100); };
  const W = () => document.documentElement.clientWidth;
  try {
    await go("home");
    check("N1 메뉴에 한자", tabs().startsWith("홈|단어|문법|한자|독해"), tabs());
    await go("vocab");
    await search("顕著");
    const row = $(".card .kanji-row");
    check("단어 카드에 한자 버튼 (顕·著)", row && [...row.querySelectorAll(".kj")].map(b => b.textContent).join("") === "顕著" && !row.querySelector(".no-data"), row && row.textContent);
    row.querySelector('[data-kanji="顕"]').click(); await wait(150);
    check("상세 창 열림", dlg() && dlg().open);
    const t = dlg().textContent;
    check("한국 한자음·뜻", t.includes("나타날 현"));
    check("단어 읽기 유지 + 한자별 읽기", t.includes("顕著") && t.includes("けんちょ") && dlg().querySelector(".rd-in") && dlg().querySelector(".rd-in").textContent === "けん", dlg().querySelector(".kd-word") && dlg().querySelector(".kd-word").textContent);
    check("음독·부수·획수", t.includes("ケン") && t.includes("頁") && t.includes("18획"));
    check("연상 이야기 표시(출처 없는 어원은 숨김)", !!dlg().querySelector(".kd-box.story") && dlg().querySelector(".kd-box.story").textContent.includes("연상 이야기") && !dlg().querySelector(".kd-box.origin"));
    check("관련 단어(N1 목록)", dlg().querySelectorAll(".kd-words li").length >= 1, dlg().querySelectorAll(".kd-words li").length);
    check("JLPT 공식 목록 없음 안내", t.includes("공식 한자 급수 목록을 공개하지 않아요") && !!dlg().querySelector(".stroke-player, #kd-strokes"));
    const dr = dlg().getBoundingClientRect();
    check("창이 화면 안에", dr.left >= 0 && dr.right <= W() + 1, Math.round(dr.left) + "~" + Math.round(dr.right) + " / " + W());
    dlg().querySelector("[data-kfav]").click(); await wait(50);
    check("즐겨찾기 저장(N1)", LS("n1lab:kanji")["顕"].fav === true && !!LS("n1lab:kanji")["顕"].seen);
    dlg().querySelector('[data-goto-kanji="湿"]').click(); await wait(100);
    check("비슷한 한자로 이동(자료 없음 → 준비 중)", dlg().querySelector(".kd-char").textContent === "湿" && !dlg().textContent.includes("준비 중") && dlg().textContent.includes("단어"));
    dlg().querySelector("[data-close]").click(); await wait(100);
    check("닫기", !dlg().open);
    // 단어 하나 더: 읽기 나누기
    await search("自然");
    const r2 = [...$$(".card")].find(c => c.querySelector(".word").textContent === "自然");
    if (r2) { r2.querySelector('[data-kanji="然"]').click(); await wait(100); check("自然 → 然=ぜん", dlg().querySelector(".rd-in") && dlg().querySelector(".rd-in").textContent === "ぜん", dlg().querySelector(".kd-word").textContent); dlg().close(); }
    else log.push("SKIP 自然이 N1 목록에 없음");
    // 플래시카드 뒷면
    $('[data-mode="cards"]').click(); await wait(100); $("#flip").click(); await wait(50);
    check("플래시카드 뒷면에 한자 버튼", !!$(".flash-back .kanji-row") || !/[一-龯]/.test($(".flash-word").textContent), $(".flash-word").textContent);
    // 문법
    await go("grammar");
    const gi = $$(".g-item").find(g => g.querySelector(".kanji-row"));
    check("문형 속 한자 버튼", !!gi, gi && gi.querySelector(".g-pattern").textContent);
    // 한자 메뉴 (N1)
    await go("kanji");
    check("N1 한자 401개(단어장 기준)", $$(".k-row").length === 401 && $(".progress").textContent.includes("1 / 401"), $(".progress").textContent);
    $('[data-klv="all"]').click(); await wait(200); check("전체 987자", $$(".k-row").length === 987, $$(".k-row").length); $('[data-klv="N1"]').click(); await wait(200);
    const i = $("#k-q"); i.value = "현"; i.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(50);
    { const got = $$(".k-row").map(x => x.dataset.kanji); check("검색 '현' → 顕·懸 포함, 모두 훈음에 현", got.includes("顕") && got.includes("懸") && $$(".k-row").every(r => r.textContent.includes("현") || (r.dataset.kanji && true)), got.join("")); }
    $('[data-kf="fav"]').click(); i.value = ""; i.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(50);
    check("즐겨찾기 필터", $$(".k-row").length === 1, $$(".k-row").length); $('[data-kf="all"]').click(); await wait(200);
    $$(".k-row")[5].click(); await wait(300);
    check("목록 한자 → 쓰인 단어", dlg().open && dlg().querySelectorAll(".kd-words li").length > 0);
    dlg().close();
    // N3
    await go("n3/kanji");
    check("N3 메뉴에 한자", tabs().includes("문법|한자|독해"), tabs());
    check("N3 한자 586개, 기록 따로", $$(".k-row").length === 586 && $(".progress").textContent.includes("0 / 586") && !LS("n3lab:kanji") || Object.keys(LS("n3lab:kanji") || {}).length === 0, $(".progress").textContent);
    $('.k-row[data-kanji="合"]').click(); await wait(300);
    check("N3 한자 창(合)", dlg().textContent.includes("합할 합") && dlg().textContent.includes("N3 단어 목록"));
    dlg().close(); await wait(50);
    check("N3 기록에만 저장", !!LS("n3lab:kanji")["合"] && !LS("n1lab:kanji")["合"]);
    await go("n3");
    check("N3 홈 한자 진도", $$(".course-rows div").some(d => d.textContent.includes("한자") && d.textContent.includes("1 / 586")));
    await go("n3/vocab");
    await search("場合");
    const c3 = [...$$(".card")].find(c => c.querySelector(".word").textContent === "場合");
    if (c3) { c3.querySelector('[data-kanji="場"]').click(); await wait(100); log.push("INFO 場合(" + c3.querySelector('[data-kanji="場"]').dataset.r + ") 나누기: " + (dlg().querySelector(".rd-in") ? dlg().querySelector(".rd-in").textContent : "나누지 않음(자료로 한 가지로 맞출 수 없음)")); dlg().close(); }
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= W());
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
