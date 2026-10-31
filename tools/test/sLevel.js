(async () => {
  // 레벨 50: 예전 경험치로 다시 계산(낮아지지 않음), 레벨 살펴보기, 하루 한 번 경험치, 레벨 업 알림
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1400); };
  try {
    const g = await window.eval('import("./js/game.js")');
    // 예전 표에서 레벨 k가 되던 경험치는 새 표에서 k 이상이어야 한다
    const OLD = { n3: [0, 40, 100, 180, 280, 400, 550, 730, 940, 1200], n1: [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200] };
    let bad = [];
    ["n3", "n1"].forEach(r => OLD[r].forEach((xp, i) => { let lv = 1; while (lv < 50 && xp >= g.xpFor(r, lv + 1)) lv++; if (lv < i + 1) bad.push(r + " Lv" + (i + 1)); }));
    check("예전 레벨보다 낮아지는 경우 없음", !bad.length, bad.join(","));
    let inc = true; ["n3", "n1"].forEach(r => { for (let l = 2; l < 50; l++) if (g.xpFor(r, l + 1) - g.xpFor(r, l) < g.xpFor(r, l) - g.xpFor(r, l - 1)) inc = false; });
    check("다음 레벨까지 필요한 경험치가 줄지 않음", inc);
    check("N3 1200 XP = Lv 13", g.levelOf("n3").lv === 13, g.levelOf("n3").lv);
    check("N1 3200 XP = Lv 16", g.levelOf("n1").lv === 16, g.levelOf("n1").lv);
    check("Lv 50까지", g.levelInfo("n3", 50).title === "마스터" && g.levelInfo("n1", 41).emoji === "👑");
    // 레벨 살펴보기
    await go("n3/badges");
    check("배지 화면 지금 레벨", $(".growth-lv .lv-title").textContent.includes("Lv 13 · 기초 다지기"), $(".growth-lv .lv-title").textContent);
    check("레벨 살펴보기: 지금 레벨", $("#lv-view .lv-card.now") && $("#lv-view .lv-title").textContent === "Lv 13 · 기초 다지기");
    $('#lv-view [data-lvgo="14"]').click(); await wait(100);
    check("다음 레벨 누르면 Lv 14", $("#lv-view .lv-title").textContent === "Lv 14 · 기초 다지기" && $("#lv-view .lv-state").textContent.includes("XP 더"), $("#lv-view .lv-card").textContent);
    $('#lv-view [data-lvgo="41"]').click(); await wait(100);
    check("단계 누르면 Lv 41 마스터", $("#lv-view .lv-title").textContent === "Lv 41 · 마스터");
    $('#lv-view [data-lvgo="1"]').click(); await wait(100);
    check("Lv 1에서 이전 버튼 꺼짐", $('#lv-view [data-lvgo="0"]').disabled);
    // 하루 한 번
    g.award("n3", "correct", "t-q1"); g.award("n3", "correct", "t-q1"); g.award("n3", "wrong", "t-q1");
    check("같은 문제 하루 한 번만 +5", JSON.parse(localStorage.getItem("n3lab:game")).xp === 1205, localStorage.getItem("n3lab:game").slice(0, 40));
    g.award("n3", "card", "t-q1");
    check("문제와 카드는 따로 셈 (+2)", JSON.parse(localStorage.getItem("n3lab:game")).xp === 1207);
    g.award("n3", "unit");
    check("단원 완료는 그대로 +30", JSON.parse(localStorage.getItem("n3lab:game")).xp === 1237);
    const t = document.getElementById("lvup");
    check("레벨 업 알림 (Lv 14)", !!t && t.classList.contains("on") && t.textContent.includes("Lv 14"), t && t.textContent);
    // 다음 날이 되면 다시 받을 수 있다 (날짜만 바꿔서 확인)
    const st = await window.eval('import("./js/store.js")'); st.n3store.update("game", x => { x.todayKeys.day = "2000-01-01"; return x; });
    g.award("n3", "correct", "t-q1");
    check("다음 날에는 다시 +5", JSON.parse(localStorage.getItem("n3lab:game")).xp === 1242);
    // N1 홈 성장 칸
    localStorage.setItem("jlpt:room", "n1");
    await go("home");
    check("N1 홈 Lv 16 · 기초 다지기", $(".growth .lv-title").textContent.includes("Lv 16 · 기초 다지기"), $(".growth .lv-title").textContent);
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
