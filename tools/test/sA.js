(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const top = document.defaultView.parent;
  const frame = top.document.getElementById("f");
  const doc = () => frame.contentWindow.document;
  const app = () => doc().getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const LS = () => frame.contentWindow.localStorage;
  const go = async h => { frame.contentWindow.location.hash = h; await wait(1300); };
  const BAD = /AI 생성|AI 작성|AI가|검수 필요|검수 전|실제 어원 아님|상세 정보 준비 중|콘텐츠 준비 중|확인 필요|뜻예요|뜻 미확인/;
  try {
    check("급수 선택 화면: 메뉴 줄·중복 버튼 숨김", doc().querySelector("nav.tabs").hidden && doc().getElementById("room-switch").hidden && $$(".room").length === 2);
    const tb = doc().getElementById("theme-toggle");
    const wasDark = tb.getAttribute("aria-pressed") === "true";
    tb.click(); await wait(50);
    check("다크 모드 버튼 전환", doc().documentElement.getAttribute("data-theme") === (wasDark ? "light" : "dark") && LS().getItem("jlpt:theme") === (wasDark ? "light" : "dark") && tb.getAttribute("aria-pressed") === String(!wasDark), tb.textContent);
    frame.contentWindow.location.reload(); await wait(3000);
    check("새로고침 후 화면 모드 유지", doc().documentElement.getAttribute("data-theme") === (wasDark ? "light" : "dark"));
    doc().getElementById("theme-toggle").click(); await wait(50);
    // 모든 화면에서 미완성·부정 문구 검사
    const routes = ["home", "vocab", "grammar", "kanji", "reading", "listening", "notes", "sprint", "mock", "together", "backup", "badges",
      "n3", "n3/basics", "n3/vocab", "n3/grammar", "n3/kanji", "n3/notes", "n3/exam", "n3/together", "n3/backup", "n3/badges"];
    const hits = [];
    for (const h of routes) {
      await go(h);
      $$("#toggle-all").forEach(b => b.click()); await wait(50);
      $$("details").forEach(d => { d.open = true; });
      const m = app().textContent.match(BAD);
      if (m) hits.push(h + ":" + m[0]);
    }
    check("미완성·부정 문구 없음 (" + routes.length + "개 화면)", !hits.length, hits.join(", "));
    await go("vocab");
    $("#toggle-all").click(); await wait(100);
    check("'검수 완료' 표시가 잘못 나오지 않음", !$$(".badge").some(b => b.textContent === "검수 완료"));
    check("N1 단어: 헷갈리는 단어 탭 있음", !!$('[data-mode="compare"]'));
    $('[data-mode="quiz"]').click(); await wait(200);
    $$(".q").forEach(q => q.querySelectorAll(".opt")[0].click()); await wait(100);
    const fb = $$(".fb").map(f => f.textContent).join(" ");
    check("퀴즈 해설 문구(뜻이에요)", !BAD.test(fb) && (fb.includes("정답이에요") || fb.includes("오답이에요")), (fb.match(BAD) || [""])[0]);
    await go("n3/vocab");
    check("N3 단어: 빈 '헷갈리는 단어' 탭 숨김", !$('[data-mode="compare"]'));
    // 한자 창 별표
    await go("n3/kanji");
    $('[data-kanji="合"]').click(); await wait(600);
    const dlg = doc().querySelector(".kanji-dialog");
    const star = dlg.querySelector("[data-kfav]");
    check("창을 열 때 별표에 초점 없음", doc().activeElement !== star && star.getAttribute("aria-pressed") === "false", doc().activeElement && doc().activeElement.className);
    star.click(); await wait(50);
    check("별표 한 번 → 켜짐", dlg.querySelector("[data-kfav]").getAttribute("aria-pressed") === "true" && dlg.querySelector("[data-kfav]").textContent === "★");
    dlg.querySelector("[data-kfav]").click(); await wait(50);
    check("한 번 더 → 꺼짐", dlg.querySelector("[data-kfav]").getAttribute("aria-pressed") === "false");
    const dt = dlg.textContent;
    check("한자 창: 연상 이야기·자료 정보·네이버 링크, 부정 문구 없음", dt.includes("연상 이야기") && dt.includes("자료 정보") && !!dlg.querySelector('a[href*="hanja.dict.naver.com"]') && !BAD.test(dt), (dt.match(BAD) || [""])[0]);
    dlg.querySelector('[data-goto-kanji="含"]').click(); await wait(400);
    check("자료 없는 한자 창: 준비 중 문구 없음", !BAD.test(dlg.textContent) && !dlg.textContent.includes("준비 중"));
    dlg.close();
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
