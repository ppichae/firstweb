(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const LS = k => JSON.parse(localStorage.getItem(k) || "null");
  const W = () => document.documentElement.clientWidth;
  const draw = async (canvas, pts) => {
    const r = canvas.getBoundingClientRect();
    const at = ([x, y]) => ({ clientX: r.left + x / 109 * r.width, clientY: r.top + y / 109 * r.height, pointerId: 1, bubbles: true, cancelable: true, pointerType: "touch" });
    canvas.dispatchEvent(new window.PointerEvent("pointerdown", at(pts[0])));
    for (const p of pts.slice(1)) canvas.dispatchEvent(new window.PointerEvent("pointermove", at(p)));
    canvas.dispatchEvent(new window.PointerEvent("pointerup", at(pts[pts.length - 1])));
    await wait(20);
  };
  const seg = async m => { $('[data-mode="' + m + '"]').click(); await wait(300); };
  const sec = async k => { $('[data-ksec="' + k + '"]').click(); await wait(300); };
  try {
    location.hash = "n3/basics"; await wait(1500);
    check("기초 탭 구성", $$(".seg").map(s => s.textContent).join("|") === "히라가나|가타카나|문자 통합 학습|핵심 단원|단어·한자", $$(".seg").map(s => s.textContent).join("|"));
    check("히라가나 첫 화면 50음도 46자", $$(".kana:not(.empty)").length === 46 && $(".kana .r").textContent === "a (아)", $(".kana .r").textContent);
    check("한국어 발음 참고용 안내", app().textContent.includes("참고용") && app().textContent.includes("완전히 같지 않아요"));
    await sec("dakuon"); check("탁음·반탁음 25자", $$(".kana:not(.empty)").length === 25 && $(".kana .k").textContent === "が");
    await sec("yoon"); check("요음 33자", $$(".kana:not(.empty)").length === 33);
    await sec("rules"); check("히라가나 촉음·장음 수업(b01)", app().textContent.includes("히라가나 발음 규칙") && $$("#l-quiz .q").length === 4);
    await sec("quiz");
    const opts = $$(".q")[0].querySelectorAll(".opt");
    check("퀴즈 보기 'bu (부)' 형식", [...opts].every(o => /^\d[a-zō]+ \(.+\)$/.test(o.textContent)), [...opts].map(o => o.textContent).join(", "));
    $$(".q").forEach(q => q.querySelectorAll(".opt")[0].click()); await wait(100);
    const kp1 = LS("n3lab:kanaProgress");
    check("히라가나 기록만 생김", Object.keys(kp1.hira).length > 0 && Object.keys(kp1.kata).length === 0, "hira " + Object.keys(kp1.hira).length + " / kata " + Object.keys(kp1.kata).length);
    await sec("write");
    const cv = () => $(".wp-canvas");
    check("쓰기 칸·가이드", !!cv() && !!$(".wp-model .guide path") && app().textContent.includes("자동으로 채점하지 않아요"));
    await draw(cv(), [[20, 30], [60, 30], [90, 32]]);
    check("한 획 쓰기 → 1", $(".wp-n").textContent === "1");
    $('[data-wp="undo"]').click(); await wait(30);
    check("한 획 지우기 → 0", $(".wp-n").textContent === "0");
    await draw(cv(), [[25, 35], [80, 33]]); await draw(cv(), [[50, 15], [50, 80]]); await draw(cv(), [[60, 50], [40, 80], [70, 90]]);
    check("あ 3획 쓰면 획 수 같다는 안내", $(".wp-msg").textContent.includes("3획으로 같아요"), $(".wp-msg").textContent);
    $('[data-wp="compare"]').click(); await wait(30);
    check("완성 모양과 비교", $(".wp-model").classList.contains("compare"));
    $('[data-wp="hint"]').click(); await wait(30);
    $('[data-wp="clear"]').click(); await wait(30);
    check("모두 지우기 → 0, 다음 획 보기 = 1번 획 강조", $(".wp-n").textContent === "0" && $$(".wp-model .ink path")[0].classList.contains("hint-now"));
    await draw(cv(), [[25, 35], [80, 33]]);
    $('[data-wp="done"]').click(); await wait(50);
    check("쓰기 연습 기록(히라가나)", LS("n3lab:kanaWritten").hira["あ"] === 1 && !Object.keys(LS("n3lab:kanaWritten").kata).length);
    // 가타카나
    await seg("kata");
    check("가타카나 50음도", $(".kana .k").textContent === "ア" && $(".kana-head .progress").textContent.includes("가타카나 기본 글자"));
    await sec("quiz");
    $$(".q").forEach(q => q.querySelectorAll(".opt")[0].click()); await wait(100);
    const kp2 = LS("n3lab:kanaProgress");
    check("가타카나 기록 따로, 히라가나 그대로", Object.keys(kp2.kata).length > 0 && JSON.stringify(kp2.hira) === JSON.stringify(kp1.hira));
    await sec("rules"); check("가타카나 규칙 수업(k01, ー·ッ)", app().textContent.includes("가타카나 발음 규칙") && app().textContent.includes("コーヒー"));
    await sec("write"); check("가타카나 쓰기 가이드", !!$(".wp-model .guide path") && $(".write-head .kt-char").textContent === "ア");
    // 문자 통합
    await seg("mix");
    check("통합 구별표 46쌍", $$(".kana-pair").length === 46);
    $('[data-msec="which"]').click(); await wait(200);
    check("어느 문자일까 퀴즈", $$(".q").length === 10 && $(".q .opt").textContent.includes("히라가나"));
    $('[data-msec="mixquiz"]').click(); await wait(200); check("혼합 읽기 퀴즈", $$(".q").length === 10);
    $('[data-msec="words"]').click(); await wait(200); check("단어 읽기 16 + 퀴즈 8", $$(".kana-word").length === 16 && $$(".q").length === 8);
    $('[data-msec="confuse"]').click(); await wait(200); check("헷갈리는 문자 10쌍", $$(".compare").length === 10);
    $('[data-msec="review"]').click(); await wait(200); check("오답 복습", $$(".q").length > 0 || app().textContent.includes("다시 볼 글자가 없어요"), $$(".q").length + "문제");
    // 핵심 단원
    await seg("units");
    check("핵심 단원 8개(문자 규칙 제외), 1번 인사", $$(".unit").length === 8 && $$(".unit-title")[0].textContent.includes("인사"), $$(".unit").length);
    // 한자 창 쓰기
    location.hash = "n3/kanji"; await wait(1300);
    $('[data-kanji="合"]').click(); await wait(500);
    const dlg = document.querySelector(".kanji-dialog");
    dlg.querySelector("[data-open-write]").click(); await wait(500);
    const kc = dlg.querySelector(".wp-canvas");
    await draw(kc, [[30, 40], [55, 15], [80, 40]]);
    dlg.querySelector('[data-wp="done"]').click(); await wait(50);
    check("한자 쓰기 연습 기록(N3)", LS("n3lab:kanji")["合"].written === 1 && !(LS("n1lab:kanji") || {})["合"]);
    const dr = dlg.getBoundingClientRect();
    check("창 안 넘침", dr.right <= W() + 1 && dlg.scrollWidth <= dlg.clientWidth + 1);
    dlg.close();
    // 홈 일정 링크
    location.hash = "n3"; await wait(1300);
    check("1주차 일정: 히라가나·가타카나·문자 통합·단원 1~6", [...$$(".weeks > li")[0].querySelectorAll("a")].map(a => a.textContent).join("|").includes("가타카나"), [...$$(".weeks > li")[0].querySelectorAll("a")].map(a => a.textContent.slice(0, 10)).join("|"));
    $('[data-basics="kata"]').click(); await wait(1300);
    check("일정에서 가타카나로 바로 이동", location.hash === "#n3/basics" && $('[data-mode="kata"]').getAttribute("aria-selected") === "true");
    location.hash = "n3"; await wait(1300);
    check("홈 과정 칸: 히라가나·가타카나 따로", $$(".course-rows div").some(d => d.textContent.includes("히라가나 기본 글자")) && $$(".course-rows div").some(d => d.textContent.includes("가타카나 기본 글자")));
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= W());
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
