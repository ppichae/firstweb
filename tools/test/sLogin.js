(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s);
  const preview = location.search.includes("auth=preview");
  try {
    if (window.parent.DARK) document.documentElement.dataset.theme = "dark";
    await wait(800);
    if (!preview) {
      location.hash = "vocab"; await wait(1500);
      check("연결 전: 로그인 없이 기존 학습 화면 그대로", location.hash === "#vocab" && !!$(".card, .word, #v-q"), location.hash);
      location.hash = "login"; await wait(800);
      const b = $("#google-login");
      check("로그인 화면 표시", !!b && app().textContent.includes("로그인"));
      check("Google 버튼은 눌러지지 않음(준비 중)", b.disabled && app().textContent.includes("준비 중"));
      b.click(); await wait(300);
      check("눌러도 로그인된 것처럼 바뀌지 않음", location.hash === "#login" && !app().textContent.includes("로그인됐") , location.hash);
      check("로그인 없이 공부하기 링크", !!$(".login-skip"));
      check("로그인 화면에서는 메뉴 숨김", document.querySelector("nav.tabs").hidden);
      $(".login-skip").click(); await wait(1500);
      check("링크로 급수 선택 화면 이동", location.hash === "#rooms" && !document.querySelector("nav.tabs").hidden === false, location.hash);
    } else {
      check("미리보기: 학습 화면 대신 로그인 화면으로", location.hash === "#login" && !!$("#google-login"), location.hash);
      check("가려던 화면 안내 문구", app().textContent.includes("로그인한 뒤에 볼 수 있어요"));
      check("가려던 화면 기억", sessionStorage.getItem("jlpt:afterLogin") === "n3/kanji", sessionStorage.getItem("jlpt:afterLogin"));
      location.hash = "n3/grammar"; await wait(800);
      check("다른 학습 화면도 잠김", location.hash === "#login");
      location.hash = "rooms"; await wait(800);
      check("급수 선택 화면도 잠김", location.hash === "#login");
      check("미리보기에서도 로그인은 되지 않음", $("#google-login").disabled);
      check("미리보기에는 '로그인 없이' 링크 없음", !$(".login-skip"));
    }
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
