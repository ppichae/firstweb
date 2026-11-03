(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const dlg = () => document.querySelector(".kanji-dialog");
  const W = () => document.documentElement.clientWidth;
  const go = async h => { location.hash = h; await wait(1300); };
  const menuOK = () => {
    const tl = document.getElementById("tablist"), sw = document.getElementById("room-switch").getBoundingClientRect();
    const tabs = [...tl.querySelectorAll(".tab")];
    const wide = W() >= 900;
    const clipped = wide ? tabs.filter(t => { const r = t.getBoundingClientRect(); return r.right > W() || r.right > sw.left + 1 && r.top < sw.bottom && r.bottom > sw.top; }).map(t => t.textContent) : [];
    return { ok: (wide ? tl.scrollWidth <= tl.clientWidth + 1 && !clipped.length : true) && sw.right <= W() && sw.left >= 0, info: "탭 " + tabs.length + "개, 줄 수 " + new Set(tabs.map(t => Math.round(t.getBoundingClientRect().top))).size + (clipped.length ? " 잘림:" + clipped.join(",") : "") };
  };
  try {
    check("급수 선택 화면", $("h2").textContent === "급수 선택" && $$(".room-name").map(r => r.textContent).join(",") === "N1 공부방,N3 공부방" && !app().textContent.includes("프로필"), $$(".room-name").map(r => r.textContent).join(","));
    check("급수 선택 화면에서 중복 버튼 숨김", document.getElementById("room-switch").hidden && document.querySelector("nav.tabs").hidden);
    for (const h of ["home", "n3"]) {
      await go(h);
      const t = [...document.querySelectorAll("#tablist .tab")].map(x => x.textContent);
      check(h + " 메뉴 한글만", t.every(x => !/[぀-ヿ一-鿿]/.test(x)), t.join("|"));
      const m = menuOK(); check(h + " 메뉴 잘림 없음 (" + W() + "px)", m.ok, m.info);
    }
    const wl = $(".weeks ul li a");
    check("추천 일정 밑줄 없음·카드형", getComputedStyle(wl).textDecorationLine === "none" && getComputedStyle(wl).display === "block");
    const fl = document.querySelector("footer a");
    check("본문 링크 밑줄 없음", getComputedStyle(fl).textDecorationLine === "none");
    // 획순
    await go("n3/kanji");
    $('[data-kanji="合"]').click(); await wait(600);
    const sp = () => dlg().querySelector(".stroke-player");
    check("획순 플레이어 표시", !!sp() && sp().querySelector(".sp-count").textContent.replace(/\s/g, "") === "0/6획", sp() && sp().querySelector(".sp-count").textContent);
    const cnt = () => sp().querySelector(".sp-cur").textContent;
    sp().querySelector('[data-sp="next"]').click(); await wait(50);
    sp().querySelector('[data-sp="next"]').click(); await wait(50);
    check("다음 획 2번 → 2", cnt() === "2" && parseFloat(sp().querySelectorAll(".ink path")[1].style.strokeDashoffset) === 0);
    sp().querySelector('[data-sp="prev"]').click(); await wait(50);
    check("이전 획 → 1", cnt() === "1");
    sp().querySelector('[data-sp="play"]').click(); await wait(400);
    check("재생 중 → 일시정지 버튼", sp().querySelector('[data-sp="play"]').textContent.includes("일시정지"));
    await wait(1500);
    sp().querySelector('[data-sp="play"]').click(); await wait(50);
    const mid = Number(cnt());
    check("일시정지", sp().querySelector('[data-sp="play"]').textContent.includes("재생") && mid >= 2, "현재 " + mid);
    await wait(800);
    check("멈춘 뒤 그대로", Number(cnt()) === mid);
    sp().querySelector('[data-sp="all"]').click(); await wait(50);
    check("완성 모양 6/6", cnt() === "6" && sp().querySelector(".sp-bar").style.width === "100%");
    sp().querySelector('[data-sp="restart"]').click(); await wait(100);
    check("처음부터 다시 재생", Number(cnt()) <= 1 && sp().querySelector('[data-sp="play"]').textContent.includes("일시정지"));
    const sel = sp().querySelector("[data-sp-speed]"); sel.value = "2"; sel.dispatchEvent(new window.Event("change"));
    await wait(4500);
    check("빠르게 재생해서 끝까지", cnt() === "6", cnt());
    const nb = sp().querySelector("[data-sp-nums]"); nb.checked = true; nb.dispatchEvent(new window.Event("change"));
    check("획 번호 보기", sp().querySelector(".sp-svg").classList.contains("show-nums") && sp().querySelectorAll(".nums text").length === 6);
    check("출처 표시", sp().textContent.includes("KanjiVG (CC BY-SA 3.0)"));
    check("획수 자료 출처 표시", dlg().querySelector(".kd-foot").textContent.includes("KanjiVG"));
    const dr = dlg().getBoundingClientRect();
    check("창 안 넘침", dr.right <= W() + 1 && dlg().scrollWidth <= dlg().clientWidth + 1);
    dlg().querySelector('[data-goto-kanji="含"]').click(); await wait(300);
    check("자료 없는 한자 → 획순 칸 숨김", !dlg().querySelector("#kd-strokes") && !dlg().textContent.includes("준비 중"));
    dlg().close();
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= W());
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
