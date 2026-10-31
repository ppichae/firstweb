(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  try {
    await wait(3000);
    check("키를 넣으면 학습 화면이 잠기고 로그인 화면으로", location.hash === "#login", location.hash);
    check("가려던 화면 기억", sessionStorage.getItem("jlpt:afterLogin") === "vocab", sessionStorage.getItem("jlpt:afterLogin"));
    const b = app().querySelector("#google-login");
    check("Google 버튼 누를 수 있음(로그인 도구 연결됨)", !!b && !b.disabled);
    check("준비 중 표시 사라짐", !app().textContent.includes("준비 중"));
    check("로그인 없이 공부하기 링크 없음", !app().querySelector(".login-skip"));
    check("계정 표시는 숨김(로그인 전)", document.getElementById("auth-user").hidden);
  } catch (e) { log.push("ERROR " + e.message); }
  return log.join("\n");
})()
