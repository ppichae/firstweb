(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    await wait(4000);
    const err = document.querySelector("#login-error");
    check("코드 처리 실패 시 로그인 화면에 이유 표시", !!err && !err.hidden, err && err.textContent);
    check("주소창에서 일회용 코드 제거", !location.search.includes("code="), location.search);
  } catch (e) { log.push("ERROR " + e.message); }
  return log.join("\n");
})()
