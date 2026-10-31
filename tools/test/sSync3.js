(async () => {
  // 계정 모드의 기록 관리(백업 파일 복원·지우기)와 휴대폰 폭 화면 확인 (테스트 서버 ?sb=test)
  const log = [];
  const check = (name, ok, extra) => { log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : "")); window.parent.document.getElementById("out").textContent = "RUNNING\n" + log.join("\n"); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const D = () => window.document;
  const app = () => D().getElementById("app");
  const $ = s => app() && app().querySelector(s);
  const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* 아직 */ } await wait(250); } return false; };
  const tag = Math.random().toString(36).slice(2, 8);
  const A = "fw-r-" + tag + "@example.com", PW = "Test-" + tag + "-pass1";
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  const mod = p => window.eval('import("./js/' + p + '")');
  const authText = () => (D().getElementById("auth-user") || {}).textContent || "";
  const noOverflow = () => D().documentElement.scrollWidth <= window.innerWidth + 1;
  try {
    if (window.parent.DARK) D().documentElement.dataset.theme = "dark";
    await until(() => $("#test-login"), 20000);
    window.location.hash = "login"; await until(() => $("#test-login"));
    setVal($("#tl-email"), A); setVal($("#tl-pass"), PW);
    $("#test-login").requestSubmit(); await until(() => window.location.hash === "#profile", 20000);
    await until(() => $("#pf-nick"));
    setVal($("#pf-nick"), "복원테스트"); $('input[name="pf-level"][value="N1"]').checked = true;
    $("#profile-form").requestSubmit(); await until(() => window.location.hash !== "#profile", 15000);
    const sync = await mod("sync.js"), { store } = await mod("store.js");
    await until(() => sync.syncStatus().active, 15000);
    check("로그인·동기화 시작", sync.syncStatus().active);
    check("휴대폰 폭: 상단(닉네임·내 기록·파트너·로그아웃)이 넘치지 않음", noOverflow(), D().documentElement.scrollWidth + " > " + window.innerWidth);

    // 기록 관리 화면: 계정 모드 안내
    window.location.hash = "backup"; await until(() => $("#b-file"), 15000);
    check("기록 관리: 계정에 저장된다는 안내", app().textContent.includes("내 계정에 저장돼요") && !app().textContent.includes("실시간 동기화는 지원하지 않아요"));
    check("기록 관리: 내 기록 화면 링크", !!$('a[href="#records"]'));
    check("휴대폰 폭: 기록 관리 넘치지 않음", noOverflow());

    // 백업 파일 복원 = 계정에 더하기 (지금 기록은 남음)
    store.recordAttempt({ id: "now1", area: "vocab", answer: 1 }, 1);
    await sync.flush();
    const file = { app: "jlpt-n1-goukaku", version: 1, exportedAt: "2026-10-20T00:00:00Z", data: {
      attempts: [{ qid: "bk1", area: "grammar", choice: 2, correct: false, at: Date.parse("2026-10-20T01:00:00Z"), mode: "practice" }],
      grammar: { g5: { studied: "2026-10-20" } } } };
    const r1 = await store.importAll(file);
    check("복원: 백업 기록이 계정에 더해짐", store.get("attempts").length === 2 && store.get("grammar").g5 && store.get("grammar").g5.studied === "2026-10-20", JSON.stringify(r1));
    check("복원: 지금 기록도 그대로", store.get("attempts").some(a => a.qid === "now1"));
    const r2 = await store.importAll(file);
    check("같은 백업 파일을 다시 복원해도 늘지 않음", store.get("attempts").length === 2 && r2.inserted === 0, JSON.stringify(r2));

    // 내 기록 화면에 '백업 파일' 가져오기로 남음
    window.location.hash = "records"; await until(() => $("#rc-export"), 20000);
    check("내 기록: 백업 파일 가져오기 기록 표시", app().textContent.includes("백업 파일"));
    check("휴대폰 폭: 내 기록 넘치지 않음", noOverflow(), D().documentElement.scrollWidth);

    // 기록 관리 → 이 방 기록 지우기(화면 버튼)
    window.location.hash = "backup"; await until(() => $("#b-reset"), 15000);
    $("#b-reset").click(); await until(() => $("#b-reset-yes"));
    $("#b-reset-yes").click(); await until(() => app().textContent.includes("모든 기록을 지웠어요"), 20000);
    check("화면에서 지우기: N1 기록 비움", store.get("attempts").length === 0 && !store.get("grammar").g5, store.get("attempts").length);

    // 로그아웃
    D().getElementById("sign-out").click();
    await until(() => !authText().includes("로그아웃"), 20000);
    check("로그아웃", !(await mod("sync.js")).syncStatus().active);
  } catch (e) { log.push("FAIL 테스트 중단: " + e.message); }
  return log.join("\n");
})()
