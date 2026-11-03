(async () => {
  // 문장 빈칸 전수 검사(4개 자료 전체), 유형 섞기, 틀린 단어 규칙, 풀어 본 정도, 한 번에 푸는 문제 수
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1800); };
  const mod = p => window.eval('import("./js/' + p + '")');
  try {
    const L = await mod("views/listStudy.js"), Ex = await mod("examples.js"), P = await mod("pick.js"), D = await mod("data.js");
    await go("vocab"); { const _c = document.querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } } await go("grammar"); await go("n3/vocab"); { const _c = document.querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } } await go("n3/grammar");
    const merged = (core, extra) => { const seen = new Set(), out = []; [...(core || []), ...(extra || [])].forEach(v => { const k = v.word || v.pattern; if (!seen.has(k)) { seen.add(k); out.push(v); } }); return out; };
    const sets = [
      ["N1 단어", merged(D.DB.vocab.items, D.EXTRA.n1vocab.items), "vocab", D.DB.vocab.questions.length],
      ["N3 단어", D.EXTRA.n3vocab.items, "vocab", 0],
      ["N1 문법", merged(D.DB.grammar.items, D.EXTRA.n1grammar.items), "grammar", D.DB.grammar.questions.length],
      ["N3 문법", D.EXTRA.n3grammar.items, "grammar", 0],
    ];
    const summary = [];
    for (const [name, items, area, fixed] of sets) {
      const bad = []; let n = 0;
      for (const v of items) {
        if (!L.blankOf(v)) continue;
        n++;
        const q = L.buildQuestion(v, "blank", { area }, items, "t");
        const b = L.blankOf(v), t = L.blankText(v), sentence = Ex.plainOf(b.ja);
        const first = q.prompt.split("\n")[0];
        if (q.options.length !== 4) bad.push(t + ":보기수" + q.options.length);
        if (new Set(q.options).size !== q.options.length) bad.push(t + ":보기중복");
        if (q.options[q.answer] !== t) bad.push(t + ":정답불일치");
        if (first.replace("（　　）", t) !== sentence) bad.push(t + ":문장복원실패");
        if (first.includes(t)) bad.push(t + ":문제에 정답 노출");
        if (q.options.some((o, i) => i !== q.answer && sentence.includes(o))) bad.push(t + ":보기가 문장에 있음");
        if (!/[가-힣]/.test(q.prompt.split("\n")[1] || "")) bad.push(t + ":해석없음");
        if (area === "grammar" && q.options.some(o => /[～~〜A-Za-z0-9＋+?？!！…/／가-힣\s]/.test(o) || o.length < 2)) bad.push(t + ":보기에 기호·설명 " + q.options.join(","));
        // 보기마다 가운데가 비지 않은 문형에서 온 것이어야 한다 (같은 글자가 되는 문형이 둘이면 그중 하나라도 멀쩡하면 된다)
        const whole = x => !/[～~〜]/.test(x.pattern.replace(/[（(].*?[）)]/g, "").replace(/^[～~〜]+|[～~〜]+$/g, ""));
        if (area === "grammar" && q.options.some(o => !items.some(x => L.blankText(x) === o && whole(x)))) bad.push(t + ":가운데가 빈 문형 " + q.options.join(","));
        if (/\{|\}/.test(q.promptHTML.replace(/<[^>]+>/g, ""))) bad.push(t + ":후리가나 표시 깨짐");
      }
      check(name + ": 빈칸 문제 전수 검사", !bad.length && n > 0, n + "문제" + (bad.length ? " · 문제 " + bad.length + ": " + bad.slice(0, 6).join(", ") : ""));
      const total = items.reduce((c, v) => c + L.typesFor(v).length, 0) + fixed;
      summary.push(name + " 항목 " + items.length + " · 빈칸 " + n + " · 전체 " + total);
    }
    check("문제 수 집계", true, summary.join(" / "));
    // 틀린 단어 규칙
    const pool = Array.from({ length: 200 }, (_, i) => ({ id: "x" + i }));
    const at = (id, ok, ago) => ({ snap: { wordId: id }, correct: ok, at: Date.now() - ago });
    const old = 5 * 86400000;
    let wrongBack = 0;
    for (let k = 0; k < 50; k++) {
      const filler = Array.from({ length: 10 }, (_, i) => at("x" + (100 + i), true, i + 1));   // 바로 전 세트는 다른 단어
      const r = P.pickItems(pool, 10, { attempts: [...filler, at("x0", false, old), at("x1", false, old + 5)] });
      if (r.some(x => x.id === "x0") && r.some(x => x.id === "x1")) wrongBack++;
    }
    check("마지막에 틀린 단어는 다시 나옴", wrongBack === 50, wrongBack + "/50");
    let prevBack = 0;
    for (let k = 0; k < 100; k++) { if (P.pickItems(pool, 10, { attempts: [at("x0", false, 1000)] }).some(x => x.id === "x0")) prevBack++; }
    check("틀린 단어도 바로 다음 세트는 건너뜀", prevBack === 0, prevBack + "/100");
    let again = 0;
    for (let k = 0; k < 200; k++) { if (P.pickItems(pool, 10, { attempts: [at("x2", true, 1000), at("x2", false, 2000)], weak: () => false }).some(x => x.id === "x2")) again++; }
    check("다시 맞힌 단어는 틀린 단어에서 빠짐", again === 0, again + "/200");
    let fresh = 0; const seen = pool.slice(0, 50).map((x, i) => at(x.id, true, old + i));
    for (let k = 0; k < 50; k++) fresh += P.pickItems(pool, 10, { attempts: seen }).filter(x => Number(x.id.slice(1)) >= 50).length;
    check("처음 보는 단어를 가장 많이 냄", fresh / 50 >= 6, (fresh / 50).toFixed(1) + "개/10");
    // 화면
    await go("n3/vocab"); { const _c = document.querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } } $('[data-mode="quiz"]').click(); await wait(400);
    check("첫 화면은 전체 섞기", $('[data-qt="mix"]').getAttribute("aria-pressed") === "true");
    const pr = () => $("#quiz-progress").textContent;
    check("풀어 본 정도 표시", /단어 733개 중 0개 풀어 봄 · 문제 [\d,]+개 중 0개 풀어 봄/.test(pr()), pr());
    $('[data-qc="20"]').click(); await wait(300);
    check("한 번에 20문제", /\/ 20/.test($(".qr-head").textContent), $(".qr-head").textContent);
    const kinds = new Set();
    for (let k = 0; k < 20; k++) { kinds.add($(".q-num").textContent.split("·")[1].trim()); $(".q .opt").click(); await wait(60); const nx = $(".qr-next"); if (nx) { nx.click(); await wait(60); } }
    check("전체 섞기에 여러 유형이 나옴", kinds.size >= 3, [...kinds].join(","));
    check("풀면 진행 수가 늘어남", /중 20개 풀어 봄 · 문제 [\d,]+개 중 20개 풀어 봄/.test(pr()), pr());
    $('[data-qt="blank"]').click(); await wait(300);
    const qt = $(".q-text");
    check("문장 빈칸 화면: 빈칸과 해석", !!qt.querySelector(".q-blank") && /[가-힣]/.test(qt.querySelector(".q-ko").textContent), qt.textContent.slice(0, 60));
    $(".q .opt").click(); await wait(100);
    check("답한 뒤 학습 정보", !!$(".learn-box"));
    check("가로 스크롤 없음(단어)", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    await go("n3/grammar"); $('[data-mode="quiz"]').click(); await wait(400);
    check("문법 퀴즈 풀어 본 정도", /문형 306개 중 0개/.test($("#quiz-progress").textContent), $("#quiz-progress").textContent);
    $('[data-gq="blank"]').click(); await wait(300);
    check("문법 문장 빈칸", !!$(".q-text .q-blank"));
    await go("n3/exam"); $('[data-mode="drill"]').click(); await wait(400);
    check("N3 영역별 연습에 문장 빈칸", !!$('[data-drill="vocab:blank"]') && !!$("#d-quiz .q-blank"));
    localStorage.setItem("jlpt:room", "n1");
    await go("grammar"); $('[data-mode="quiz"]').click(); await wait(400);
    check("N1 문법 첫 화면이 고정 문제가 아님", $('[data-gq="mix"]').getAttribute("aria-pressed") === "true" && /\/ 10/.test($(".qr-head").textContent));
    $('[data-gq="exam"]').click(); await wait(300);
    check("시험형 문제 유지", $$(".q").length > 0);
    check("가로 스크롤 없음(문법)", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
