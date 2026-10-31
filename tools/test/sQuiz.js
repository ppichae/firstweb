(async () => {
  // 퀴즈: 기록을 보고 고르기(오답 재출제·중복 방지), 뜻 고르기 후리가나·발음, 맨 아래 '새 문제' 막대, 휴대폰 hover 버그
  const log = [];
  const check = (name, ok, extra) => { log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : "")); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const until = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* 아직 */ } await wait(200); } return false; };
  const attempts = () => JSON.parse(window.localStorage.getItem("n1lab:attempts") || "[]");
  // 한 세트(10문제)를 푼다. wrong=true면 일부러 틀린다. 낸 단어 id 목록을 돌려준다
  async function playSet(wrong) {
    const ids = [];
    for (let k = 0; k < 10; k++) {
      await until(() => $("#quiz .opt:not(:disabled)"));
      const q = $("#quiz .q"); const opts = [...q.querySelectorAll(".opt")];
      const before = attempts().length;
      // 정답 칸은 답한 뒤에야 알 수 있으므로, 기록으로 정답 여부를 본다
      opts[0].click(); await wait(150);
      const rec = attempts()[before];
      ids.push(rec && rec.snap && rec.snap.wordId);
      const next = $(".qr-next"); if (next) { next.click(); await wait(150); }
    }
    return ids;
  }
  try {
    location.hash = "vocab"; await until(() => $("[data-mode]") || $(".segmented"), 10000);
    const qbtn = [...app().querySelectorAll("button, a")].find(b => /퀴즈/.test(b.textContent) && (b.dataset.mode || b.getAttribute("role") === "tab"));
    if (qbtn) qbtn.click();
    await until(() => $("#quiz .q"), 10000);
    check("단어 퀴즈 열림", !!$("#quiz .q"));
    check("퀴즈에 후리가나 보이기/숨기기 버튼", !!$("[data-furi-toggle]"));
    const p = $("#quiz .q-text");
    check("뜻 고르기: 문제 단어에 후리가나 또는 가나 단어", !!p.querySelector("ruby") || !/[一-鿿]/.test((p.textContent.match(/「(.*?)」/) || ["", ""])[1]), p.innerHTML.slice(0, 80));
    check("뜻 고르기: 문제에 발음 버튼", !!p.querySelector(".say-btn"));
    const set1 = await playSet(true);
    check("한 세트 10문제, 같은 단어 두 번 안 나옴", set1.filter(Boolean).length === 10 && new Set(set1).size === 10, set1.join(","));
    const wrong1 = attempts().slice(-10).filter(a => !a.correct).map(a => a.snap.wordId);
    // 결과 화면의 '새 문제 10개'
    await until(() => app().querySelector('[data-qr="restart"]'));
    check("결과 화면에 새 문제 버튼", !!app().querySelector('[data-qr="restart"]'));
    app().querySelector('[data-qr="restart"]').click(); await wait(300);
    const set2 = await playSet(false);
    const again = set2.filter(id => wrong1.includes(id)).length;
    const overlap = set2.filter(id => set1.includes(id)).length;
    check("틀린 단어가 다음 세트에 다시 나옴(오답 재출제)", wrong1.length === 0 || again >= Math.min(3, wrong1.length), "틀린 " + wrong1.length + "개 중 " + again + "개");
    check("틀리지 않은 단어는 바로 다시 나오지 않음", overlap === again, "겹침 " + overlap + " · 오답 재출제 " + again);
    // 읽기 고르기에는 후리가나·발음 버튼 없음 (정답이 보이면 안 된다)
    const rt = $$("[data-qt]").find(b => b.dataset.qt === "reading"); if (rt) { rt.click(); await until(() => $("#quiz .q")); }
    const rp = $("#quiz .q-text");
    check("읽기 고르기: 후리가나·발음 버튼 없음", !!rt && !rp.querySelector("ruby") && !rp.querySelector(".say-btn"), rp.innerHTML.slice(0, 60));
    // 휴대폰 hover 버그: 선택지 hover 색은 마우스 기기에서만
    const rules = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } });
    const bare = rules.some(r => r.selectorText && /\.opt:hover/.test(r.selectorText));
    const inMedia = rules.some(r => r.media && /hover: hover/.test(r.media.mediaText) && /\.opt:hover/.test(r.cssText));
    check("선택지 hover는 마우스 기기에서만(휴대폰에서 저절로 파란 테두리 안 생김)", !bare && inMedia);
    // N3 가나 퀴즈: 맨 아래 막대
    location.hash = "n3/basics"; await until(() => app().textContent.includes("히라가나"), 10000);
    const kq = [...app().querySelectorAll("[data-ksec]")].find(b => b.dataset.ksec === "quiz");
    if (kq) kq.click();
    await until(() => $("#k-quiz .q"), 8000);
    const bar = $(".end-bar");
    check("가나 퀴즈: 맨 아래에 '새 문제' 막대", !!bar && bar.querySelector("button").textContent.includes("새 문제"), bar ? bar.textContent : "없음");
    check("가나 퀴즈: 막대가 문제 아래에 있음", !!bar && !!$("#k-quiz") && ($("#k-quiz").compareDocumentPosition(bar) & 4) === 4);
    const qs = $$("#k-quiz .q");
    for (const q of qs) { const o = q.querySelector(".opt:not(:disabled)"); if (o) { o.click(); await wait(30); } }
    check("가나 퀴즈: 다 풀면 점수 표시", bar.classList.contains("done") && /다 풀었어요/.test(bar.textContent), bar.textContent);
    const firstBefore = $("#k-quiz .q .q-text").textContent + $$("#k-quiz .q").map(q => q.querySelector(".opt").disabled).join();
    bar.querySelector("button").click(); await wait(200);
    check("가나 퀴즈: 새 문제를 받으면 아직 안 푼 문제", $$("#k-quiz .opt:disabled").length === 0 && $$(".end-bar").length === 1);
  } catch (e) { log.push("FAIL 테스트 중단: " + e.message + " " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
