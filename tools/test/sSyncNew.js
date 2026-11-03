(async () => {
  // 새 기록 칸(퀴즈 정답 right·카드 알았어요 cardOk·하루 한 번 todayKeys)이 계정 동기화에서 빠지지 않는지 (테스트 서버 ?sb=test, 테스트 계정만)
  const log = [];
  const check = (name, ok, extra) => { log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : "")); window.parent.document.getElementById("out").textContent = "RUNNING\n" + log.join("\n"); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const D = () => window.document;
  const app = () => D().getElementById("app");
  const $ = s => app() && app().querySelector(s);
  const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* 아직 */ } await wait(250); } return false; };
  const tag = Math.random().toString(36).slice(2, 8);
  const A = "fw-n-" + tag + "@example.com", PW = "Test-" + tag + "-pass1";
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  const mod = p => window.eval('import("./js/' + p + '")');
  const authText = () => (D().getElementById("auth-user") || {}).textContent || "";
  try {
    await until(() => $("#test-login"), 20000);
    window.location.hash = "login"; await until(() => $("#test-login"));
    setVal($("#tl-email"), A); setVal($("#tl-pass"), PW);
    $("#test-login").requestSubmit(); await until(() => window.location.hash === "#profile" || authText().includes("로그아웃"), 20000);
    if (window.location.hash === "#profile") {
      await until(() => $("#pf-nick"));
      setVal($("#pf-nick"), "새칸테스트"); $('input[name="pf-level"][value="N3"]').checked = true;
      $("#profile-form").requestSubmit(); await until(() => window.location.hash !== "#profile", 15000);
    }
    const sync = await mod("sync.js"), { n3store } = await mod("store.js"), auth = await mod("auth.js"), persist = await mod("persist.js"), game = await mod("game.js");
    const uid = auth.currentUser().id;
    await until(() => sync.syncStatus().active, 15000);
    check("로그인하면 동기화 시작", sync.syncStatus().active);
    // 오른쪽 위 버튼: 내 기록(백업 권장)·공부 파트너·로그아웃이 같은 모양
    await until(() => D().getElementById("sync-chip"), 10000);
    const look = el => { const c = window.getComputedStyle(el); return [c.borderRadius, c.fontSize, c.fontWeight, c.minHeight, c.paddingLeft, c.borderTopWidth].join(" "); };
    const chip = D().getElementById("sync-chip"), partner = D().querySelector('.site-actions a[href="#partner"]'), out = D().getElementById("sign-out");
    check("상단 버튼 모양이 같음(백업·공부 파트너·로그아웃)", look(chip) === look(out) && look(partner) === look(out) && window.getComputedStyle(out).borderRadius === "999px", look(chip) + " / " + look(partner) + " / " + look(out));
    window.localStorage.removeItem("sync:unregistered");
    n3store.update("lists", l => { l["n3-v0010"] = { cardOk: "2026-11-01", right: 2 }; });
    game.award("n3", "correct", "nq1"); game.award("n3", "correct", "nq1");
    await sync.flush();
    check("보낼 기록 모두 보냄", sync.syncStatus().pending === 0, JSON.stringify(sync.syncStatus()));
    const un = window.localStorage.getItem("sync:unregistered") || "[]";
    check("등록 안 된 칸 없음(cardOk·right·todayKeys)", !/cardOk|right|todayKeys/.test(un), un.slice(0, 200));
    check("같은 문제 두 번 → 경험치 5", n3store.get("game").xp === 5, n3store.get("game").xp);
    // 이 기기 기록을 지우고 서버에서 다시 받기
    sync.stopSync();
    const mine = await persist.getPrefix("u:" + uid + ":");
    await persist.putMany([], Object.keys(mine).filter(k => !k.endsWith(":game:local")));
    await sync.startSync(uid);
    await until(() => !sync.syncStatus().error && n3store.get("lists")["n3-v0010"], 40000);
    const w = n3store.get("lists")["n3-v0010"] || {};
    check("서버에서 되살아남: cardOk·right", w.cardOk === "2026-11-01" && w.right === 2, JSON.stringify(w));
    check("서버에서 되살아남: 경험치 5", n3store.get("game").xp === 5, n3store.get("game").xp);
    const before = n3store.get("game").xp;
    game.award("n3", "correct", "nq1");
    check("다시 받은 뒤에도 같은 문제는 오늘 경험치 없음", n3store.get("game").xp === before, n3store.get("game").xp);
    D().getElementById("sign-out").click();
    await until(() => !authText().includes("로그아웃"), 20000);
  } catch (e) { log.push("FAIL 테스트 중단: " + e.message); }
  return log.join("\n");
})()
