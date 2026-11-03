(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const top = document.defaultView.parent;
  const frame = top.document.getElementById("f");
  const win = () => frame.contentWindow;
  const doc = () => win().document;
  const app = () => doc().getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const LS = k => JSON.parse(win().localStorage.getItem(k) || "null");
  const go = async h => { win().location.hash = h; await wait(1300); };
  // 퀴즈 하나를 끝까지 푼다: wrongFirst면 첫 문제는 일부러 틀린다
  async function solveAll(name, box, wrongFirst) {
    const q0 = box.querySelector(".qr-q .q");
    check(name + ": 한 문제씩", box.querySelectorAll(".qr-q .q").length === 1 && /문제 1 \/ \d+/.test(box.querySelector(".qr-head").textContent.replace(/\s+/g, " ")), box.querySelector(".qr-head").textContent.replace(/\s+/g, " "));
    check(name + ": 풀기 전 해설·학습 정보 숨김", !box.querySelector(".fb") && !box.querySelector(".learn-box"));
    const total = Number(box.querySelector(".qr-head").textContent.match(/\/\s*(\d+)/)[1]);
    let first = true, sawNextScroll = false, wrongSeen = false;
    for (let k = 0; k < total; k++) {
      const q = box.querySelector(".qr-q");
      const opts = [...q.querySelectorAll(".opt, .kq-opt")];
      if (!opts.length) { await wait(800); }
      const o2 = [...q.querySelectorAll(".opt, .kq-opt")];
      // 틀린 보기를 찾으려면 정답을 모르니, 첫 문제는 마지막 보기를 눌러 보고 결과로 판단한다
      o2[wrongFirst && first ? o2.length - 1 : 0].click(); await wait(80);
      if (q.querySelector(".fb-verdict.bad")) wrongSeen = true;
      if (first) {
        check(name + ": 답한 뒤 해설·학습 정보", !!q.querySelector(".fb") && !!q.querySelector(".learn-box .lb-word"), q.querySelector(".learn-box") ? q.querySelector(".learn-box").textContent.slice(0, 60) : "학습 정보 없음");
        if (q.querySelector(".fb-verdict.bad") && name !== "한자-획순") check(name + ": 오답이면 고른 보기 설명", !!q.querySelector(".lb-wrong") || name.startsWith("한자") || name.includes("시험형"), q.querySelector(".learn-box").textContent.slice(0, 80));
      }
      const btn = box.querySelector(".qr-next");
      if (!btn) { check(name + ": 다음 버튼", false, "문제 " + (k + 1)); return; }
      if (k === total - 1) { check(name + ": 마지막은 '결과 보기'", btn.textContent.includes("결과 보기")); }
      win().scrollTo(0, 99999); await wait(30);
      const yBefore = win().scrollY;
      btn.click(); await wait(700);
      if (k === 0 && total > 1) { const r = box.getBoundingClientRect(); sawNextScroll = win().scrollY < yBefore && r.top >= 0 && r.top < win().innerHeight * 0.6; check(name + ": 다음 문제로 자동 이동", sawNextScroll, Math.round(yBefore) + "→" + Math.round(win().scrollY) + " 위치 " + Math.round(box.getBoundingClientRect().top)); }
      first = false;
    }
    const res = box.querySelector(".qr-result");
    check(name + ": 결과 화면", !!res && /결과 · \d+ \/ \d+ 정답/.test(res.textContent), res && res.querySelector("h3").textContent);
    return { wrongSeen, res };
  }
  try {
    await go("vocab"); { const _c = app().querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } }
    $('[data-mode="quiz"]').click(); await wait(300);
    const a0 = (LS("n1lab:attempts") || []).length;
    const r1 = await solveAll("N1 단어", $("#quiz"), true);
    check("N1 단어: 풀이 10개 기록", (LS("n1lab:attempts") || []).length - a0 === 10, (LS("n1lab:attempts") || []).length - a0);
    if (r1.wrongSeen && $("[data-qr=retry]")) { $("[data-qr=retry]").click(); await wait(300); check("틀린 문제만 다시 풀기", !!$(".qr-q .q") && /문제 1 \//.test($(".qr-head").textContent)); }
    $('[data-qt="exam"]').click(); await wait(300);
    await solveAll("N1 단어 시험형", $("#quiz"), false);
    await go("grammar");
    $('[data-mode="quiz"]').click(); await wait(300);
    $('[data-gq="meaning"]').click(); await wait(300);
    await solveAll("N1 문법 뜻", $("#quiz"), true);
    await go("kanji");
    $('[data-kmode="quiz"]').click(); await wait(300);
    $('[data-kqt="meaning"]').click(); await wait(300);
    await solveAll("한자-뜻", $("#kq-box"), true);
    const lb = $("#kq-box .learn-box") || null;
    $('[data-kqt="order"]').click(); await wait(1500);
    const kb = $("#kq-box");
    kb.querySelector(".kq-opt").click(); await wait(100);
    check("한자-획순: 답한 뒤 한자 학습 정보", !!kb.querySelector(".kq-fb .learn-box") && kb.querySelector(".kq-fb .learn-box").textContent.includes("음독"));
    check("한자-획순: 다음 버튼", !!kb.querySelector(".qr-next"));
    await go("n3/vocab"); { const _c = app().querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } }
    $('[data-mode="quiz"]').click(); await wait(300);
    await solveAll("N3 단어", $("#quiz"), true);
    await go("n3/exam");
    $('[data-mode="drill"]').click(); await wait(300);
    await solveAll("N3 영역별 연습", $("#d-quiz"), true);
    // 결과 화면 '새 문제'
    $("[data-qr=restart]").click(); await wait(300);
    check("결과 화면 → 새 문제 10개", /문제 1 \/ 10/.test($("#d-quiz .qr-head").textContent.replace(/\s+/g, " ")));
    check("가로 스크롤 없음", doc().documentElement.scrollWidth <= doc().documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
