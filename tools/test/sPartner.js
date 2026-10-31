(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(250); } return false; };
  const tag = Math.random().toString(36).slice(2, 8);
  const A = "fw-a-" + tag + "@example.com", B = "fw-b-" + tag + "@example.com", PW = "Test-" + tag + "-pass1";
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  async function login(email, nick, level) {
    location.hash = "login"; await until(() => $("#test-login"));
    setVal($("#tl-email"), email); setVal($("#tl-pass"), PW);
    $("#test-login").requestSubmit(); await until(() => location.hash === "#profile" || document.getElementById("auth-user").textContent.includes("로그아웃"), 20000);
    if (location.hash === "#profile") {
      await until(() => $("#pf-nick"));
      setVal($("#pf-nick"), nick); $('input[name="pf-level"][value="' + level + '"]').checked = true;
      $("#profile-form").requestSubmit(); await until(() => location.hash !== "#profile", 15000);
    }
  }
  async function logout() {
    const b = document.getElementById("sign-out"); if (b) b.click();
    await until(() => location.hash === "#login" && !document.getElementById("auth-user").textContent.includes("로그아웃"));
    await wait(500);
  }
  async function openPartner() {
    location.hash = "partner";
    await until(() => $(".pt-grid") || $(".pt-bad"), 20000); await wait(300);
  }
  try {
    if (window.parent.DARK) document.documentElement.dataset.theme = "dark";
    await until(() => $("#test-login"), 20000);
    check("테스트 서버: 테스트 계정 로그인 칸 표시", !!$("#test-login"));

    // 가: 가입 → 프로필 설정(N1) → 공부방
    await login(A, "가테스트", "N1");
    check("처음 로그인하면 프로필 설정 후 공부방으로", location.hash === "#home" || location.hash === "#vocab" || location.hash === "", location.hash);
    check("오른쪽 위에 닉네임·공부 파트너·로그아웃", document.getElementById("auth-user").textContent.includes("가테스트") && document.getElementById("auth-user").textContent.includes("공부 파트너"));
    await openPartner();
    check("연결 전 화면: 코드 만들기·입력", !!$("#pt-make") && !!$("#pt-enter"));
    $("#pt-make").click(); await until(() => $(".pt-code"));
    const code = ($(".pt-code") || {}).textContent;
    check("연결 코드 8자리 표시", /^[A-Z0-9]{8}$/.test(code || ""), code);
    setVal($("#pt-code-in"), code); $("#pt-enter").requestSubmit(); await until(() => app().textContent.includes("내가 만든 코드는"));
    check("내 코드 입력은 거절", app().textContent.includes("내가 만든 코드는 입력할 수 없어요"));
    await logout();

    // 나: 가입 → 프로필(N1, 둘 다 N1) → 코드 입력
    await login(B, "나테스트", "N1");
    await openPartner();
    setVal($("#pt-code-in"), "ABCDEFGH"); $("#pt-enter").requestSubmit(); await until(() => app().textContent.includes("코드가 맞지 않거나"));
    check("틀린 코드 거절 안내", app().textContent.includes("코드가 맞지 않거나"));
    setVal($("#pt-code-in"), code); $("#pt-enter").requestSubmit(); await until(() => app().textContent.includes("요청을 보냈어요"));
    check("가의 코드로 연결 요청", app().textContent.includes("요청을 보냈어요"));
    check("보낸 요청에 '요청 취소'", !!$("[data-cancel]"));
    check("승인 전에는 연결 안 됨", !app().textContent.includes("응원 메시지"));
    await logout();

    // 가: 받은 요청 승인 → 연결
    await login(A, "가테스트", "N1");
    await openPartner();
    check("받은 연결 요청 표시", !!$("[data-acc]"));
    $("[data-acc]").click(); await until(() => app().textContent.includes("연결됐어요"), 20000);
    check("승인하면 연결", app().textContent.includes("연결됐어요"));
    check("파트너 요약 카드(나테스트, N1)", $$(".pt-card").length === 2 && $$(".pt-card")[1].textContent.includes("나테스트") && $$(".pt-card")[1].textContent.includes("N1"));
    check("요약에 진도·공부 시간·연속 학습·최근 학습·목표", ["진도", "총 공부 시간", "연속 학습", "최근 학습", "이번 주 목표"].every(w => $$(".pt-card")[1].textContent.includes(w)));
    setVal($("#pt-text"), "오늘도 화이팅!"); $("#pt-send").requestSubmit(); await until(() => app().textContent.includes("응원 메시지를 보냈어요"));
    check("응원 메시지 보내기", !!$$(".pt-msgs li.mine").find(li => li.textContent.includes("오늘도 화이팅!")));
    check("보낸 메시지는 '안 읽음'", $$(".pt-msgs li.mine")[0].textContent.includes("안 읽음"));
    // 급수를 N3로 바꿔도 연결 유지
    location.hash = "profile"; await until(() => $("#pf-nick"));
    $('input[name="pf-level"][value="N3"]').checked = true; $("#profile-form").requestSubmit(); await until(() => location.hash === "#partner", 15000);
    await until(() => $(".pt-grid"), 20000); await wait(300);
    check("급수를 N3로 바꿔도 연결 유지", $$(".pt-card").length === 2 && $$(".pt-card")[0].textContent.includes("N3"));
    await logout();

    // 나: 메시지 받기·읽음, 상대 급수 N3 보임
    await login(B, "나테스트", "N1");
    await openPartner();
    check("받은 메시지 보임", !!$$(".pt-msgs li.theirs").find(li => li.textContent.includes("오늘도 화이팅!")));
    check("파트너 급수 N3로 보임(서로 다른 급수 연결)", $$(".pt-card")[1].textContent.includes("가테스트") && $$(".pt-card")[1].textContent.includes("N3"));
    check("상대 화면에 오답·즐겨찾기 같은 개인 기록 없음", !/오답|즐겨찾기/.test($$(".pt-card")[1].textContent));
    await logout();
    await login(A, "가테스트", "N3");
    await openPartner();
    check("나가 읽은 뒤 '읽음' 표시", $$(".pt-msgs li.mine")[0].textContent.includes("읽음") && !$$(".pt-msgs li.mine")[0].textContent.includes("안 읽음"));
    // 연결 해제
    window.confirm = () => true;
    $("#pt-unlink").click(); await until(() => app().textContent.includes("연결을 해제했어요"), 20000);
    check("연결 해제", !!$("#pt-make"));
    await logout();
    await login(B, "나테스트", "N1");
    await openPartner();
    check("해제 뒤 나에게도 상대 요약·메시지 안 보임", !!$("#pt-make") && !app().textContent.includes("오늘도 화이팅!"));
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth, document.documentElement.scrollWidth);
    await logout();
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
