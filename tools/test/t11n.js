(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  try {
    const base = location.href.split("#")[0].replace(/index\.html$/, "");
    const { store } = await window.eval('import("' + base + 'js/store.js")');
    location.hash = "grammar"; await wait(1500); document.querySelector("[data-mode=quiz]").click(); await wait(200);
    $$(".q")[0].querySelector('[data-o="1"]').click(); await wait(30);
    location.hash = "backup"; await wait(300);
    check("기록 수 표시", $(".card-box .hint").textContent.includes("문제 풀이 1건"), $(".card-box .hint").textContent);
    $("#b-export").click(); await wait(100);
    check("백업 내려받기 안내", $(".toast") && $(".toast").textContent.includes("내려받았어요"));
    const backup = store.exportAll();
    check("백업 내용", backup.app === "jlpt-n1-goukaku" && backup.data.attempts.length === 1);
    $("#b-reset").click(); await wait(50);
    check("초기화 확인 단계", !!$("#b-reset-yes"));
    $("#b-reset-yes").click(); await wait(100);
    check("초기화", store.get("attempts").length === 0 && $(".toast").textContent.includes("지웠어요"));
    let threw = false; try { store.importAll({ foo: 1 }); } catch (e) { threw = e.message; }
    check("잘못된 파일 거부", threw && threw.includes("백업 파일이 아니에요"), threw);
    store.importAll(backup);
    check("복원", store.get("attempts").length === 1);
    location.hash = "home"; await wait(300);
    check("복원 후 홈 반영", $$(".tiles .tile-value")[2].textContent === "1");
  } catch (e) { log.push("ERROR " + e.stack); }
  return log.join("\n");
})()
