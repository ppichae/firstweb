(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const txt = s => ($(s) ? $(s).textContent : "(없음)");
  const draft = () => JSON.parse(localStorage.getItem("n1lab:mockDraft"));
  try {
    location.hash = "mock"; await wait(300);
    check("탭 9개", $$(".tab").length === 9, $$(".tab").map(t => t.textContent).join("|"));
    check("소개 화면", !!$("#mock-start") && $(".mock-table").textContent.includes("110분"));
    check("지난 결과 없음 안내", $$(".card-box")[2].textContent.includes("아직 본 모의고사가 없어요"));
    $("#mock-start").requestSubmit(); await wait(300);
    const d0 = draft();
    check("시작 · 임시 저장", d0 && d0.set[1].length === 28 && d0.set[2].length === 7, d0 && d0.set[1].length + "+" + d0.set[2].length);
    check("문항 수에 맞춘 시간", d0.minutes[1] === 49 && d0.minutes[2] === 21, JSON.stringify(d0.minutes));
    check("타이머 표시", /^4[89]:\d\d$/.test(txt("#mock-timer")), txt("#mock-timer"));
    check("번호판 28개", $$(".pal").length === 28);
    check("남은 문제 28", txt(".mock-bar strong") === "28");
    $('[data-pick="2"]').click(); await wait(50);
    check("답 선택 표시", $('[data-pick="2"]').classList.contains("picked") && $(".pal").classList.contains("done"));
    check("남은 문제 27", txt(".mock-bar strong") === "27");
    check("임시 저장됨", draft().answers[d0.set[1][0]] === 2);
    $("#m-next").click(); await wait(100);
    check("다음 문제", txt(".q-num").startsWith("2번"));
    $("#m-prev").click(); await wait(100);
    check("이전 문제 + 답 유지", txt(".q-num").startsWith("1번") && $('[data-pick="2"]').classList.contains("picked"));
    $('[data-jump="25"]').click(); await wait(100);
    check("번호로 이동(독해 지문 표시)", txt(".q-num").startsWith("26번") && !!$(".passage"), txt(".q-num"));
    // 다른 화면에 갔다 와도 이어서
    location.hash = "home"; await wait(200); location.hash = "mock"; await wait(300);
    check("다른 화면 다녀와도 이어서", txt(".q-num").startsWith("26번"));
    // 1부 제출 확인 단계
    $("#m-submit").click(); await wait(50);
    check("제출 확인(미응답 경고)", txt(".confirm").includes("27개"), txt(".confirm"));
    $("#m-submit-no").click(); await wait(50);
    // 시간 초과 자동 제출: 마감 시간을 지난 것으로 바꾼다
    const d1 = draft(); d1.deadline = Date.now() - 1000; localStorage.setItem("n1lab:mockDraft", JSON.stringify(d1));
    location.hash = "home"; await wait(200); location.hash = "mock"; await wait(400);
    check("1부 시간 종료 → 자동 제출 → 2부", txt(".mock-part").includes("2부") && !!$(".toast"), txt(".mock-part"));
    check("2부 청해 플레이어", !!$(".listen .player"));
    await wait(2200);
    check("2부 플레이어 준비", !!$("[data-p=play]") || $(".player").textContent.includes("음성 준비 필요"), $(".player").textContent.slice(0, 30));
    // 청해 몇 문제 답하기
    $('[data-pick="0"]').click(); await wait(30);
    check("답해도 플레이어 유지", !!$("[data-p=play]") || $(".player").textContent.includes("음성 준비 필요"));
    $("#m-next").click(); await wait(100);
    $('[data-pick="1"]').click(); await wait(30);
    $("#m-submit").click(); await wait(50);
    $("#m-submit-yes").click(); await wait(400);
    check("결과 화면", txt("h2") === "모의고사 결과");
    check("공식 점수 아님 표시", $(".estimate").textContent.includes("공식 점수 아님") && $(".estimate").textContent.includes("합격 여부를 판단하는 데 쓸 수 없어요"));
    check("합격/불합격 판정 없음", !/합격입니다|불합격입니다|합격 가능/.test(document.getElementById("app").textContent));
    check("영역별 정답률 타일", $$(".tiles .tile").length === 5);
    check("문제별 해설 35개", $$(".review-q").length === 35, $$(".review-q").length);
    $$(".review-q")[1].open = true; await wait(30);
    check("미응답 해설 문구", $$(".review-q")[1].textContent.includes("답하지 않았어요"));
    const m = JSON.parse(localStorage.getItem("n1lab:mocks"));
    check("결과 저장", m.length === 1 && m[0].total.t === 35);
    const at = JSON.parse(localStorage.getItem("n1lab:attempts")).filter(a => a.mode === "mock");
    check("답한 문제만 풀이 기록(3개)", at.length === 3, at.length);
    check("임시 저장 삭제", draft() === null);
    $("#r-back").click(); await wait(200);
    check("지난 결과 목록", $$(".mock-history li").length === 1);
    $("[data-result]").click(); await wait(200);
    check("지난 결과 다시 보기", txt("h2") === "모의고사 결과");
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + "/" + window.innerWidth);
  } catch (e) { log.push("ERROR " + e.stack); }
  return log.join("\n");
})()
