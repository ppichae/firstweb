(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const LS = k => JSON.parse(localStorage.getItem(k) || "null");
  const go = async h => { location.hash = h; await wait(1300); };
  const tabs = () => [...document.querySelectorAll("#tablist .tab")].map(t => t.textContent.trim()).join("|");
  try {
    await go("home");
    check("N1 경험치 1회 환산(19 XP), 원래 기록 그대로", LS("n1lab:game").xp === 19 && LS("n1lab:attempts").length === 3 && LS("n1lab:game").convertedFrom.attempts === 3, JSON.stringify(LS("n1lab:game")));
    const g = $(".growth");
    check("N1 홈 성장 칸", g && g.textContent.includes("Lv 1") && g.textContent.includes("입문") && g.textContent.includes("19 XP") && g.textContent.includes("오늘의 작은 목표"), g && g.textContent.slice(0, 120));
    check("대표 배지(첫 문제)", g.querySelectorAll(".medal").length >= 1 && g.textContent.includes("첫 문제"));
    check("메뉴에 배지 탭은 없음", !tabs().includes("배지"), tabs());
    g.querySelector('a[href="#badges"]').click(); await wait(1300);
    check("전체 배지 화면", $("h2").textContent === "배지와 레벨" && $$(".medal-item").length >= 20 && $$(".card-box h3").map(h => h.textContent).join(",").includes("특별 목표"), $$(".medal-item").length);
    check("N1 배지 기록 저장(받은 날)", !!(LS("n1lab:badges") || {}).first);
    check("환산 안내", app().textContent.includes("처음 한 번 경험치로 바꿔"));
    // N1 문제 → 경험치
    await go("vocab"); { const _c = document.querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } }
    $('[data-mode="quiz"]').click(); await wait(200);
    $$(".q")[0].querySelectorAll(".opt")[0].click(); await wait(100);
    const xp1 = LS("n1lab:game").xp;
    check("N1 문제 풀면 경험치(+5 또는 +1)", xp1 === 24 || xp1 === 20, xp1);
    // N1 한자 퀴즈
    await go("kanji");
    check("한자 탭 3개", $$(".seg").map(s => s.textContent).join("|") === "한자 목록|한자 퀴즈|오답 복습 · 기록");
    $('[data-kmode="quiz"]').click(); await wait(300);
    check("퀴즈 유형 7칩", $$("[data-kqt]").length === 7 && $$("[data-kqt]").map(b => b.textContent).join("|").includes("획순"));
    $('[data-kqt="meaning"]').click(); await wait(300);
    // 한 문제씩 푸는 퀴즈: 보기 하나 누르고 '다음 문제'를 누르는 것을 끝까지 반복한다
    const solve = async box => { let n = 0; for (let k = 0; k < 12; k++) { if (box.querySelector(".kq-opt") === null && !box.querySelector(".qr-q .opt")) await wait(800); const o = box.querySelector(".qr-q .opt, .qr-q .kq-opt"); if (!o) break; o.click(); n++; await wait(80); const b = box.querySelector(".qr-next"); if (!b) break; const last = b.textContent.includes("결과"); b.click(); await wait(120); if (last) break; } return n; };
    const kb = () => $("#kq-box");
    check("한자 → 뜻 10문제", /\/ 10/.test(kb().querySelector(".qr-head").textContent), kb().querySelector(".qr-head").textContent);
    const solved = await solve(kb());
    const n1k = LS("n1lab:attempts").filter(a => a.area === "kanji");
    check("N1 한자 퀴즈 기록(N1에만)", solved === 10 && n1k.length === 10 && !(LS("n3lab:attempts") || []).some(a => a.area === "kanji"), solved + "문제 풀이, 기록 " + n1k.length);
    check("결과 화면", !!kb().querySelector(".qr-result"));
    for (const t of ["reverse", "onkun", "inword", "radical"]) {
      $('[data-kqt="' + t + '"]').click(); await wait(300);
      const q = kb().querySelector(".qr-q .q");
      check("유형 " + t, !!q && /\/ \d+/.test(kb().querySelector(".qr-head").textContent), q ? q.querySelector(".q-text").textContent.slice(0, 40) : "");
    }
    $('[data-kqt="order"]').click(); await wait(1500);
    const oq = kb().querySelector(".qr-q");
    check("획순 문제(그림 보기)", oq.querySelectorAll(".kq-opt svg").length >= 3 && !!oq.querySelector(".kq-hi"), "보기 " + oq.querySelectorAll(".kq-opt").length);
    oq.querySelector(".kq-opt").click(); await wait(100);
    check("획순 문제 채점·해설", !!oq.querySelector(".kq-fb .fb-verdict") && oq.querySelector(".kq-fb").textContent.includes("KanjiVG"));
    $('[data-kmode="review"]').click(); await wait(300);
    check("유형별 정답률 6칸", $$(".meter").length === 6);
    const weakN = $$(".card-box .kj").length;
    check("다시 볼 한자", weakN >= 1 || app().textContent.includes("아직 다시 볼 한자가 없어요"), weakN);
    if ($("#kr-start")) { $("#kr-start").click(); await wait(1200); check("다시 풀기 시작", !!$("#kr-quiz .qr-q")); }
    await go("notes");
    check("N1 오답 노트에 한자 칸", $$("[data-narea]").map(b => b.textContent).join(",").includes("한자"));
    // N3
    await go("n3");
    check("N3 경험치 그대로(120)", LS("n3lab:game").xp === 120, LS("n3lab:game").xp);
    const g3 = $(".growth");
    check("N3 성장 칸 Lv4 새싹 (120 XP, 레벨 50 표)", g3 && g3.textContent.includes("Lv 4") && g3.textContent.includes("새싹") && g3.textContent.includes("글자 퀴즈 5개"), g3 && g3.textContent.slice(0, 100));
    g3.querySelector('a[href="#n3/badges"]').click(); await wait(1300);
    check("N3 배지: 받을 수 없는 배지는 숨김", $$(".medal-item.pending").length === 0 && app().textContent.includes("히라가나 완료") && !app().textContent.includes("준비 중"));
    await go("n3/kanji");
    $('[data-kmode="quiz"]').click(); await wait(300);
    $('[data-kqt="mix"]').click(); await wait(1500);
    await solve(kb());
    check("N3 한자 퀴즈 기록·경험치", (LS("n3lab:attempts") || []).filter(a => a.area === "kanji").length >= 5 && LS("n3lab:game").xp > 120, LS("n3lab:game").xp);
    await go("n3/notes");
    { const allBtn = $('[data-nstatus="all"]'); if (allBtn) { allBtn.click(); await wait(100); } check("N3 오답 노트에 한자 오답 표시(틀린 한자가 있을 때만)", $$(".note .q-num").some(s => s.textContent.includes("한자")) === (LS("n3lab:attempts") || []).some(a => a.area === "kanji" && !a.correct), $$(".note .q-num").length); }
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
