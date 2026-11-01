(async () => {
  // 홈 '학습 ○주차'(처음 공부한 날 기준, 화면만 연 시간은 세지 않음) · 실시간 남은 시간 · 시험 시작 시각
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1400); };
  try {
    await go("n3");
    const w = $(".study-week");
    check("N3 학습 3주차 (15일 전 첫 문제, 40일 전 화면 시간은 무시)", !!w && w.textContent.includes("N3 학습 3주차"), w && w.textContent);
    const cd = $(".dday-tile .countdown");
    check("남은 시간 표시 (10일 … 남았어요)", !!cd && /^9일 \d+시간 \d\d분 남았어요$/.test(cd.textContent), cd && cd.textContent);
    check("0시 기준 안내", $(".dday-tile").textContent.includes("0시 기준"));
    check("4주 추천 일정은 시험일 기준이라고 표시", app().textContent.includes("4주 추천 일정 시험일 기준"));
    // 시작 시각 정하기
    $("#dd-edit").click(); await wait(200);
    const ti = $("#dd-time"); ti.value = "13:30";
    $("#dd-save").click(); await wait(300);
    check("시작 시각 저장", JSON.parse(localStorage.getItem("n3lab:examTime")) === "13:30", localStorage.getItem("n3lab:examTime"));
    const cd2 = $(".dday-tile .countdown");
    const [y, mo, dd] = JSON.parse(localStorage.getItem("n3lab:examDate")).split("-").map(Number);
    const min = Math.floor((new Date(y, mo - 1, dd, 13, 30).getTime() - Date.now()) / 60000);
    check("시각 반영 (13:30까지)", cd2.textContent.startsWith(Math.floor(min / 1440) + "일 " + Math.floor((min % 1440) / 60) + "시간"), cd2.textContent + " / 예상 " + min + "분");
    // 실시간으로 줄어드는지: 2분 뒤로 바꾸고 30초 넘게 기다린다
    cd2.dataset.until = String(Date.now() + 120000);
    await wait(31000);
    check("30초마다 다시 계산", /^0?1분 남았어요$/.test(cd2.textContent) || /^0?[12]분 남았어요$/.test(cd2.textContent), cd2.textContent);
    cd2.dataset.until = String(Date.now() - 1000);
    await wait(31000);
    check("시간이 되면 안내", cd2.textContent === "시험 시간이 되었어요", cd2.textContent);
    // N1: 화면만 열어 둔 날은 학습 시작 전
    localStorage.setItem("jlpt:room", "n1");
    await go("home");
    const w1 = $(".study-week");
    check("N1 화면 시간만 있으면 '학습 시작 전'", !!w1 && w1.textContent.includes("N1 학습 시작 전"), w1 && w1.textContent);
    check("N1 남은 시간 표시", !!$(".dday-tile .countdown"));
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
