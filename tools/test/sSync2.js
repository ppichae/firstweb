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

    // 준비: 앞 테스트(sSync.js)에서 쌓인 것과 같은 기록
    store.update("words", w => { w.v1 = { status: "known", wrong: 2 }; });
    n3store.update("lists", l => { l.n3a = { status: "unknown" }; });
    store.recordAttempt({ id: "q9", area: "vocab", answer: 1 }, 1);
    store.recordAttempt({ id: "q10", area: "vocab", answer: 0 }, 0);
    store.logActivity("cards", 6);
    const today = Object.keys(store.get("activity")).pop();
    await sync.flush();
    check("준비 기록 보냄", sync.syncStatus().pending === 0, JSON.stringify(sync.syncStatus()));
    const sync2 = sync, st2 = store;
    // 5. 다른 기기가 먼저 바꾼 칸 → '확인 필요'
    const db2 = db;
    const other = await db2.rpc("apply_state_ops", { ops: [{ op_id: crypto.randomUUID(), room: "n1", area: "grammar", item_id: "g1", field: "studied", kind: "set", value: "2026-10-30", base_version: 0, device_id: "other-device" }] });
    check("다른 기기 변경 서버 반영", other.data && other.data[0].status === "applied", JSON.stringify(other.error || other.data));
    st2.update("grammar", g => { g.g1 = { studied: "2026-10-31" }; });
    await sync2.flush(); await sync2.pull();
    check("같은 칸을 이 기기에서 바꾸면 '확인 필요' 1개", sync2.syncStatus().conflicts === 1, sync2.syncStatus().conflicts);
    check("확인 전에는 서버 값 유지", st2.get("grammar").g1.studied === "2026-10-30", JSON.stringify(st2.get("grammar").g1));
    window.location.hash = "records"; await until(() => $("[data-take]"), 20000);
    check("내 기록 화면에 확인 필요 항목과 고르기 버튼", !!$("[data-take]") && !!$("[data-keep]") && app().textContent.includes("공부했어요") && app().textContent.includes("이 기기에서 바꾼 값"), app().textContent.slice(0, 500));
    $("[data-take]").click(); await until(() => app().textContent.includes("바꾼 값으로 정했어요"), 20000);
    check("'바꾼 값으로' 고르면 이 기기 값으로", st2.get("grammar").g1.studied === "2026-10-31" && sync2.syncStatus().conflicts === 0, JSON.stringify(st2.get("grammar").g1));
    // 저장된 값 유지
    await db2.rpc("apply_state_ops", { ops: [{ op_id: crypto.randomUUID(), room: "n1", area: "grammar", item_id: "g2", field: "studied", kind: "set", value: "2026-10-29", base_version: 0, device_id: "other-device" }] });
    st2.update("grammar", g => { g.g2 = { studied: "2026-10-31" }; });
    await sync2.flush(); await sync2.pull();
    window.location.hash = "home"; await wait(300); window.location.hash = "records"; await until(() => $("[data-keep]"), 20000);
    $("[data-keep]").click(); await until(() => app().textContent.includes("저장된 값을 유지했어요"), 20000);
    check("'저장된 값 유지' 고르면 서버 값 그대로", st2.get("grammar").g2.studied === "2026-10-29" && sync2.syncStatus().conflicts === 0, JSON.stringify(st2.get("grammar").g2));
    check("상단 표시: 확인 필요가 사라짐", !D().getElementById("sync-chip").textContent.includes("확인 필요"), D().getElementById("sync-chip").textContent);

    // 6. 예전 기록 가져오기
    check("가져올 예전 기록 표시", !!$("#rc-import") && app().textContent.includes("문제 풀이 3개"));
    $("#rc-import").click(); await until(() => $("#rc-import-yes"));
    check("가져오기 전 확인", !!$("#rc-import-yes"));
    $("#rc-import-yes").click(); await until(() => app().textContent.includes("가져왔어요"), 30000);
    const msg1 = ($(".notice.pt-good") || {}).textContent || "";
    const legKeys = Object.keys(window.localStorage).filter(k => k.startsWith("n1lab:") || k.startsWith("n3lab:"));
    check("가져오기 완료(새 기록 = 서버 확인, 문제 3 + 오답 1 + 카드 1 이상)", /새 기록 (\d+)개/.test(msg1) && +RegExp.$1 >= 5 && msg1.includes("서버 확인 " + RegExp.$1 + "개"), msg1 + " / 예전 기록 키: " + legKeys.join(","));
    check("가져온 기록 합쳐짐", st2.get("attempts").length === 5 && st2.get("words").v2 && st2.get("words").v2.status === "known" && st2.get("activity")["2026-10-01"].cards === 5);
    check("같은 문제 기록 2개도 따로 들어감", st2.get("attempts").filter(a => a.qid === "q2").length === 2);
    check("예전 기록 원본은 그대로", legacySame());
    $("#rc-import").click(); await until(() => $("#rc-import-yes"));
    $("#rc-import-yes").click(); await until(() => app().textContent.includes("가져왔어요"), 30000);
    const msg2 = ($(".notice.pt-good") || {}).textContent || "";
    check("다시 가져오면 새 기록 0개", msg2.includes("새 기록 0개"), msg2);
    check("다시 가져와도 늘지 않음", st2.get("attempts").length === 5 && st2.get("activity")["2026-10-01"].cards === 5 && st2.get("words").v2.wrong === 1);
    check("예전 응원 메시지 보관(1개)", app().textContent.includes("예전 응원 " + tag) && $$(".card-box h3").some(h => h.textContent.includes("예전 응원 메시지") && h.textContent.includes("1개")));

    // 7. 가져오기 취소: 가져온 것만 빠지고 그 뒤 기록은 남음
    st2.recordAttempt({ id: "q11", area: "vocab", answer: 2 }, 2);
    st2.update("words", w => { w.v3 = { status: "known" }; });
    await sync2.flush();
    window.location.hash = "home"; await wait(300); window.location.hash = "records"; await until(() => $$("[data-cancel]").length === 2, 20000);
    check("가져오기 기록 2개 표시", $$("[data-cancel]").length === 2);
    $$("[data-cancel]").pop().click(); await until(() => $("[data-cancel-yes]"));
    $("[data-cancel-yes]").click(); await until(() => app().textContent.includes("가져오기를 취소했어요"), 30000);
    const at = st2.get("attempts");
    check("취소: 가져온 문제 풀이 3개만 빠짐", at.length === 3 && !at.some(a => a.qid === "q1") && at.some(a => a.qid === "q11"), at.map(a => a.qid).join(","));
    check("취소: 가져온 단어 상태 되돌림", !(st2.get("words").v2 && st2.get("words").v2.status), JSON.stringify(st2.get("words").v2));
    check("취소: 가져온 카드 횟수 빠짐", !(st2.get("activity")["2026-10-01"] && st2.get("activity")["2026-10-01"].cards), JSON.stringify(st2.get("activity")["2026-10-01"]));
    check("취소 뒤에도 그 뒤 기록 유지", st2.get("words").v3 && st2.get("words").v3.status === "known" && st2.get("words").v1.status === "known" && st2.get("activity")[today].cards === 6);
    check("취소됨 표시", app().textContent.includes("취소됨"));
    check("예전 기록 원본은 그대로(취소 뒤)", legacySame());

    // 8. 등록되지 않은 기록은 보내지 않고 알림
    st2.set("zzUnknown", { a: 1 });
    check("등록되지 않은 기록은 따로 기록", (window.localStorage.getItem("sync:unregistered") || "").includes("n1.zzUnknown"));

    // 9. 기록 관리 → 지우기: 이 학습실만
    await st2.resetAll();
    const n3 = (await mod("store.js")).n3store;
    check("N1 기록 지우기: N1만 비움", st2.get("attempts").length === 0 && Object.keys(st2.get("words")).length === 0 && n3.get("lists").n3a.status === "unknown");
    const left = (await db2.from("study_events").select("room")).data || [];
    check("서버: N1 기록 없음, N3 남음", !left.some(r => r.room === "n1"));
    check("예전 기록 원본은 그대로(지운 뒤)", legacySame());

    // 10. 백업 파일 받기 버튼과 7일 알림
    window.location.hash = "home"; await wait(300); window.location.hash = "records"; await until(() => $("#rc-export"), 20000);
    check("백업 7일 알림(처음)", app().textContent.includes("7일이 지났어요"));
    $("#rc-export").click(); await until(() => app().textContent.includes("백업 파일을 받았어요"));
    check("백업 받으면 알림 사라짐", !app().textContent.includes("7일이 지났어요"));

    // 11. 로그아웃하면 동기화 끝, 예전 기록 보기로
    D().getElementById("sign-out").click();
    await until(() => !authText().includes("로그아웃"), 20000);
    const sync3 = await mod("sync.js");
    check("로그아웃하면 동기화 끝", !sync3.syncStatus().active);
    check("예전 기록 원본은 그대로(로그아웃 뒤)", legacySame());
  } catch (e) { log.push("FAIL 테스트 중단: " + e.message); }
  return log.join("\n");
})()
