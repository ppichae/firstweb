(async () => {
  // 카카오 로그인: 로그인 화면 버튼, 카카오로 가는 주소(Supabase 경유), 이메일 없이 닉네임·사진만 요청하는지
  // 실행: AUTHQ= sh tools/test/run.sh tools/test/sKakao.js 390 844 "#login"  (로그인 잠금을 켠 채로 연다)
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s);
  try {
    for (let i = 0; i < 20 && !$("#kakao-login"); i++) await wait(300);
    const k = $("#kakao-login"), g = $("#google-login");
    check("로그인 화면에 카카오 버튼", !!k && k.textContent.includes("카카오 로그인"));
    check("카카오 버튼을 누를 수 있음(연결됨)", !!k && !k.disabled);
    check("Google 버튼도 그대로", !!g && !g.disabled);
    const cs = getComputedStyle(k);
    check("카카오 버튼 노란색(#FEE500)", cs.backgroundColor === "rgb(254, 229, 0)", cs.backgroundColor);
    check("버튼 두 개 높이가 같음", Math.round(k.getBoundingClientRect().height) === Math.round(g.getBoundingClientRect().height));
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    // 화면을 옮기지 않고 카카오로 갈 주소만 받아 확인한다
    const auth = await window.Function('return import("./js/auth.js")')();
    const url = new URL(await auth.signInWithKakao({ dryRun: true }));
    const p = url.searchParams;
    check("Supabase 로그인 주소로 감", url.host === "twilteeguigiiuslfdsg.supabase.co" && url.pathname === "/auth/v1/authorize", url.host + url.pathname);
    check("provider=kakao", p.get("provider") === "kakao");
    check("로그인 후 이 컴퓨터 테스트 서버로 돌아옴", (p.get("redirect_to") || "").startsWith("http://localhost:8765/"), p.get("redirect_to"));
    check("닉네임·프로필 사진만 요청(이메일 없음)", p.get("scopes") === "profile_nickname profile_image", p.get("scopes"));
    check("주소에 비밀 값이 없음(공개 정보만)", !/secret/i.test(url.href) && !p.has("client_secret"));
    check("PKCE 보안 코드 사용", p.get("code_challenge_method") === "s256" || p.get("code_challenge_method") === "S256", p.get("code_challenge_method"));
    // 다음 단계 확인용으로 주소를 남긴다 (비밀 값 없음)
    log.push("URL " + url.href);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
