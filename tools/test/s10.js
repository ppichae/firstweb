(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const top = document.defaultView.parent;
  const frame = top.document.getElementById("f");
  const LSx = () => frame.contentWindow.localStorage;
  const W = () => frame.contentWindow.document.documentElement.clientWidth;
  const doc = () => frame.contentWindow.document;
  const app = () => doc().getElementById("app");
  const go = async h => { frame.contentWindow.location.hash = h; await wait(1300); };
  const errs = [];
  frame.contentWindow.addEventListener("error", e => errs.push(e.message));
  frame.contentWindow.addEventListener("unhandledrejection", e => errs.push("REJ " + (e.reason && e.reason.message)));
  const routes = ["rooms", "home", "vocab", "grammar", "kanji", "reading", "listening", "notes", "sprint", "mock", "backup", "badges",
    "n3", "n3/roadmap", "n3/basics", "n3/vocab", "n3/grammar", "n3/kanji", "n3/reading", "n3/listening", "n3/notes", "n3/exam", "n3/mock", "n3/backup", "n3/badges"];
  try {
    const dark = !!top.DARK;
    if (dark) doc().documentElement.setAttribute("data-theme", "dark");
    const bad = [];
    for (const h of routes) {
      await go(h);
      const de = doc().documentElement;
      const sw = doc().getElementById("room-switch").getBoundingClientRect();
      const empty = !app().querySelector("h2");
      const over = de.scrollWidth > de.clientWidth;
      // 급수 선택 화면(rooms)에서는 '방 바꾸기' 버튼을 일부러 숨긴다 → 숨겨져 있어야 정상
      // 휴대폰 폭에서는 방 바꾸기가 하단 메뉴의 더보기로 옮겨 간다
      const narrowNav = W() <= 640 && h !== "rooms";
      const mb = doc().querySelector(".m-bar").getBoundingClientRect();
      const swBad = h === "rooms" ? !doc().getElementById("room-switch").hidden : narrowNav ? (mb.width === 0 || mb.right > de.clientWidth || mb.left < 0) : (sw.right > de.clientWidth || sw.left < 0 || sw.width === 0);
      if (empty || over || swBad) bad.push(h + (empty ? "(빈 화면)" : "") + (over ? "(가로 넘침)" : "") + (swBad ? "(방 바꾸기 잘림)" : ""));
    }
    check("모든 화면 " + routes.length + "개 열림·넘침 없음·버튼 보임 (" + W() + "px" + (dark ? ", 다크" : "") + ")", !bad.length, bad.join(", "));
    if (dark) {
      const bg = frame.contentWindow.getComputedStyle(doc().body).backgroundColor;
      check("다크 모드 배경", bg === "rgb(18, 20, 28)", bg);
    }
    // 터치 쓰기 (모바일·태블릿 공통)
    await go("n3/basics");
    app().querySelector('[data-mode="hira"]').click(); await wait(200);
    app().querySelector('[data-ksec="write"]').click(); await wait(500);
    const cv = app().querySelector(".wp-canvas"), r = cv.getBoundingClientRect();
    const P = (t, x, y) => cv.dispatchEvent(new frame.contentWindow.PointerEvent(t, { clientX: r.left + x * r.width, clientY: r.top + y * r.height, pointerId: 7, pointerType: "touch", bubbles: true, cancelable: true }));
    P("pointerdown", .2, .3); P("pointermove", .5, .32); P("pointermove", .8, .35); P("pointerup", .8, .35); await wait(50);
    check("터치로 한 획 쓰기", app().querySelector(".wp-n").textContent === "1");
    // 획순 애니메이션
    await go("n3/kanji");
    app().querySelector('[data-kanji="合"]').click(); await wait(600);
    const dlg = doc().querySelector(".kanji-dialog");
    dlg.querySelector('[data-sp="next"]').click(); await wait(50);
    check("획순 다음 획", dlg.querySelector(".sp-cur").textContent === "1");
    const dr = dlg.getBoundingClientRect();
    check("한자 창 화면 안", dr.left >= 0 && dr.right <= W() + 1 && dlg.scrollWidth <= dlg.clientWidth + 1);
    dlg.close();
    // 기록 만들기 → 새로고침 → 그대로인지
    await go("n3/vocab"); { const _c = app().querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await wait(100); } }
    app().querySelector('[data-act="known"]').click(); await wait(100);
    await go("vocab"); { const _c = app().querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await wait(100); } }
    app().querySelector('[data-act="fav"]').click(); await wait(100);
    const before = { n3: LSx().getItem("n3lab:lists"), n1: LSx().getItem("n1lab:words") || LSx().getItem("n1lab:lists") };
    frame.contentWindow.location.reload(); await wait(8000);
    frame.contentWindow.location.hash = "n3/vocab"; await wait(1500); app().querySelector('.topic-tile[data-cat="all"]').click(); await wait(200);
    const known = doc().querySelectorAll("#app .card.is-known").length;
    check("새로고침 후 N3 기록 유지", known >= 1 && LSx().getItem("n3lab:lists") === before.n3, known);
    frame.contentWindow.location.hash = "vocab"; await wait(1500); app().querySelector('.topic-tile[data-cat="all"]').click(); await wait(200);
    check("새로고침 후 N1 즐겨찾기 유지", [...doc().querySelectorAll('#app [data-act="fav"]')].some(b => b.getAttribute("aria-pressed") === "true"));
    check("N1·N3 기록 분리", !Object.keys(JSON.parse(LSx().getItem("n3lab:lists") || "{}")).some(k => k.startsWith("n1")) && !Object.keys(JSON.parse(LSx().getItem("n1lab:lists") || "{}")).some(k => k.startsWith("n3")));
    check("자바스크립트 오류 없음", !errs.length, errs.slice(0, 3).join(" / "));
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
