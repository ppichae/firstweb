(async () => {
  // 학습 기록 동기화 테스트 (테스트 서버 ?sb=test, 테스트 계정만 사용)
  const log = [];
  const check = (name, ok, extra) => { log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : "")); window.parent.document.getElementById("out").textContent = "RUNNING\n" + log.join("\n"); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const D = () => window.document;   // 새로고침해도 지금 문서를 쓴다
  const app = () => D().getElementById("app");
  const $ = s => app() && app().querySelector(s), $$ = s => (app() ? [...app().querySelectorAll(s)] : []);
  const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* 아직 */ } await wait(250); } return false; };
  const tag = Math.random().toString(36).slice(2, 8);
  const A = "fw-s-" + tag + "@example.com", PW = "Test-" + tag + "-pass1";
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  const mod = p => window.eval('import("./js/' + p + '")');
  const authText = () => (D().getElementById("auth-user") || {}).textContent || "";
  async function login(email, nick, level) {
    window.location.hash = "login"; await until(() => $("#test-login"));
    setVal($("#tl-email"), email); setVal($("#tl-pass"), PW);
    $("#test-login").requestSubmit(); await until(() => window.location.hash === "#profile" || authText().includes("로그아웃"), 20000);
    if (window.location.hash === "#profile") {
      await until(() => $("#pf-nick"));
      setVal($("#pf-nick"), nick); $('input[name="pf-level"][value="' + level + '"]').checked = true;
      $("#profile-form").requestSubmit(); await until(() => window.location.hash !== "#profile", 15000);
    }
  }
  try {
    await until(() => $("#test-login"), 20000);
    // 로그인 전 이 기기에 있던 예전 기록 (가져오기 테스트용). 이 값은 끝까지 바뀌면 안 된다
    const T0 = Date.parse("2026-10-01T09:00:00Z");
    const LEG = {
      "n1lab:attempts": JSON.stringify([{ qid: "q1", area: "vocab", choice: 1, correct: true, at: T0, mode: "practice" }, { qid: "q2", area: "vocab", choice: 0, correct: false, at: T0 + 1000, mode: "practice" }, { qid: "q2", area: "vocab", choice: 0, correct: false, at: T0 + 1000, mode: "practice" }]),
      "n1lab:words": JSON.stringify({ v2: { status: "known", wrong: 1 } }),
      "n1lab:activity": JSON.stringify({ "2026-10-01": { cards: 5 } }),
      "n1lab:cheers": JSON.stringify([{ text: "예전 응원 " + tag, at: T0 }]),
    };
    Object.keys(LEG).forEach(k => window.localStorage.setItem(k, LEG[k]));
    const legacySame = () => Object.keys(LEG).every(k => window.localStorage.getItem(k) === LEG[k]);

    await login(A, "동기화테스트", "N1");
    const sync = await mod("sync.js"), { store, n3store } = await mod("store.js"), auth = await mod("auth.js"), persist = await mod("persist.js");
    const db = auth.getClient(), uid = auth.currentUser().id;
    await until(() => sync.syncStatus().active, 15000);
    check("로그인하면 동기화 시작", sync.syncStatus().active);
    check("이 기기 저장소 사용(IndexedDB, 안 되면 기본 저장소)", ["idb", "ls"].includes(sync.syncStatus().storage), sync.syncStatus().storage);
    check("새 계정은 예전 기록을 자동으로 합치지 않음", store.get("attempts").length === 0, store.get("attempts").length);
    check("상단에 동기화 표시", await until(() => D().getElementById("sync-chip"), 10000));

    // 1. 기록이 서버로 올라감
    store.update("words", w => { w.v1 = { status: "known", fav: true, wrong: 2 }; });
    store.recordAttempt({ id: "q9", area: "vocab", answer: 1 }, 1);
    store.logActivity("cards", 3);
    n3store.update("lists", l => { l.n3a = { status: "unknown" }; });
    check("바꾼 기록이 바로 화면 기록에 반영", store.get("words").v1.status === "known" && store.get("attempts").length === 1);
    check("보내기 전 '보내지 않은 기록' 있음", sync.syncStatus().pending > 0, sync.syncStatus().pending);
    await sync.flush();
    check("보낸 뒤 '보내지 않은 기록' 0", sync.syncStatus().pending === 0, sync.syncStatus().pending + " " + sync.syncStatus().error);
    const ls = (await db.from("learning_state").select("room, area, item_id, field, value")).data || [];
    check("서버: 단어 상태·즐겨찾기 저장", ls.some(s => s.item_id === "v1" && s.field === "status" && s.value === "known") && ls.some(s => s.item_id === "v1" && s.field === "fav" && s.value === true));
    check("서버: N3 기록은 n3 학습실로", ls.some(s => s.room === "n3" && s.item_id === "n3a"));
    const tot = (await db.rpc("my_counter_totals")).data || [];
    const total = (area, item, field) => Number((tot.find(t => t.area === area && t.item_id === item && t.field === field) || {}).total || 0);
    check("서버: 오답 횟수 2", total("words", "v1", "wrong") === 2);
    const today = Object.keys(store.get("activity")).pop();
    check("서버: 오늘 카드 3", total("activity", today, "cards") === 3);
    const evs = (await db.from("study_events").select("event_id, kind").eq("kind", "attempt")).data || [];
    check("서버: 문제 풀이 1개(고유 번호)", evs.length === 1 && evs[0].event_id === store.get("attempts")[0].id);

    // 2. 이 기기 기록을 모두 지워도 서버에서 되살아남
    sync.stopSync();
    const mine = await persist.getPrefix("u:" + uid + ":");
    await persist.putMany([], Object.keys(mine));
    check("이 기기 계정 기록 지움", Object.keys(await persist.getPrefix("u:" + uid + ":")).length === 0);
    await sync.startSync(uid);
    await until(() => !sync.syncStatus().error, 40000);   // 서버 응답이 늦으면 늦게 받아 온다
    check("서버에서 되살아남: 단어", store.get("words").v1 && store.get("words").v1.status === "known" && store.get("words").v1.fav === true && store.get("words").v1.wrong === 2);
    check("서버에서 되살아남: 문제 풀이·카드", store.get("attempts").length === 1 && store.get("activity")[today].cards === 3);
    check("서버에서 되살아남: N3", n3store.get("lists").n3a && n3store.get("lists").n3a.status === "unknown");

    // 3. 응답을 못 받았을 때 다시 보내도 한 번만 들어감
    window.__syncFault = { dropAck: true };
    store.logActivity("cards", 1);
    store.update("words", w => { w.v1.fav = false; });
    await sync.flush();
    check("응답을 못 받으면 '보내지 않은 기록'으로 남음", sync.syncStatus().pending > 0, sync.syncStatus().pending);
    window.__syncFault = null;
    await sync.flush(); await sync.flush(); await sync.pull();
    const tot2 = (await db.rpc("my_counter_totals")).data || [];
    check("다시 보내도 카드는 한 번만 더해짐(4)", Number((tot2.find(t => t.area === "activity" && t.field === "cards" && t.item_id === today) || {}).total) === 4);
    check("다시 보낸 즐겨찾기 해제 반영, 충돌 아님", store.get("words").v1.fav !== true && sync.syncStatus().conflicts === 0, JSON.stringify(store.get("words").v1));
    check("화면 기록도 카드 4", store.get("activity")[today].cards === 4);

    // 4. 보내기 전에 창이 닫혀도(새로고침) 기록이 남아서 나중에 보내짐
    window.__syncFault = { noFlush: true };
    store.logActivity("cards", 2);
    store.recordAttempt({ id: "q10", area: "vocab", answer: 0 }, 0);
    // 이 기기 저장이 끝날 때까지 기다린다 (저장 직후 창이 닫히는 상황)
    for (let i = 0; i < 60; i++) {
      const ob = (await persist.getPrefix("u:" + uid + ":outbox"))["u:" + uid + ":outbox"] || [];
      if (ob.some(e => e.type === "item" && e.data && e.data.qid === "q10")) break;
      await wait(250);
    }
    check("닫기 전 보내지 않은 기록 있음", sync.syncStatus().pending >= 2, sync.syncStatus().pending);
    window.location.reload();
    await wait(1500);
    await until(() => D().getElementById("sync-chip") && window.__syncFault === undefined, 30000);
    const sync2 = await mod("sync.js"), st2 = (await mod("store.js")).store;
    await until(() => sync2.syncStatus().active && sync2.syncStatus().pending === 0, 30000);
    check("새로고침 뒤 남은 기록을 보냄", sync2.syncStatus().active && sync2.syncStatus().pending === 0, JSON.stringify(sync2.syncStatus()));
    const tot3 = (await (await mod("auth.js")).getClient().rpc("my_counter_totals")).data || [];
    check("서버: 카드 6", Number((tot3.find(t => t.area === "activity" && t.field === "cards" && t.item_id === today) || {}).total) === 6);
    check("화면: 문제 풀이 2개", st2.get("attempts").length === 2, st2.get("attempts").length);

  } catch (e) { log.push("FAIL 테스트 중단: " + e.message); }
  return log.join("\n");
})()
