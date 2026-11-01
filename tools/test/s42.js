(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1200); };
  const tabs = () => [...document.querySelectorAll("#tablist .tab")].map(t => t.textContent.trim()).join("|");
  const LS = k => JSON.parse(localStorage.getItem(k) || "null");
  const today = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
  const upload = async (obj, raw) => {
    const input = $("#b-file");
    const dt = new window.DataTransfer();
    dt.items.add(new window.File([raw || JSON.stringify(obj)], "b.json", { type: "application/json" }));
    input.files = dt.files; input.dispatchEvent(new window.Event("change", { bubbles: true }));
    const before = input; for (let i = 0; i < 40 && $("#b-file") === before; i++) await wait(100);
  };
  try {
    check("급수 선택 화면", $("h2").textContent === "급수 선택" && $$(".room-name").map(r => r.textContent).join(",") === "N1 공부방,N3 공부방", $$(".room-name").map(r => r.textContent).join(","));
    check("급수 선택 화면에서 중복 버튼 숨김", document.getElementById("room-switch").hidden);
    $$(".room")[1].click(); await wait(1200);
    check("N3 메뉴", tabs() === "홈|기초|단어|문법|한자|독해|청해|오답 노트|시험 대비|모의고사|함께 보기|기록 관리", tabs());
    check("N3 홈 성장 칸", !!$(".growth") && $(".growth").textContent.includes("Lv"));
    // 학습 시간: 15초마다 지금 방에 더한다
    document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
    await wait(16000);
    const a3 = LS("n3lab:activity") || {};
    check("학습 시간 기록(N3)", a3[today] && a3[today].seconds >= 15, JSON.stringify(a3[today]));
    check("N1에는 시간 안 더함", !(LS("n1lab:activity") || {})[today]);
    // 기초 단원 9개(인사 추가)
    await go("n3/basics");
    $('[data-mode="units"]').click(); await wait(200); check("핵심 단원 8개, 1번째 인사", $$(".unit").length === 8 && $$(".unit-title")[0].textContent.includes("인사"), $$(".unit").length);
    $('[data-unit="b03"]').click(); await wait(200);
    check("빈칸 채우기 유형 표시", $$("#u-quiz .q-num").some(n => n.textContent.includes("빈칸 채우기")));
    $$("#u-quiz .q").forEach(q => q.querySelectorAll(".opt")[0].click()); await wait(100);
    // 단어 퀴즈 → 오늘 학습한 단어
    await go("n3/vocab");
    $('[data-mode="quiz"]').click(); await wait(200);
    for (let k = 0; k < 3; k++) { $(".qr-q .opt").click(); await wait(60); $(".qr-next").click(); await wait(80); }   // 한 문제씩 3문제
    // 함께 보기
    await go("n3/together");
    check("함께 보기 두 사람", $$(".person").length === 2 && $(".person.is-me").textContent.includes("N3 학습자"));
    check("동기화 안내", app().textContent.includes("자동 동기화는 되지 않아요"));
    const me = $(".person.is-me");
    check("오늘 단어·문제·연속", me.textContent.includes("3회") && /오늘푼문제\d+문제/.test(me.textContent.replace(/\s/g, "")) && me.textContent.includes("1일"), me.querySelector(".person-facts").textContent);
    $("#name-edit").click(); await wait(50);
    $("#name-input").value = "민수"; $("#name-save").click(); await wait(100);
    check("이름 바꾸기", $(".person.is-me h3").textContent.includes("민수") && LS("n3lab:profile").name === "민수");
    $("#goal-edit").click(); await wait(50);
    $("#goal-input").value = "5"; $("#goal-save").click(); await wait(50);
    check("목표 범위 검사", $("#goal-msg").textContent.includes("10분"));
    $("#goal-input").value = "120"; $("#goal-save").click(); await wait(100);
    check("이번 주 목표 저장", $(".person.is-me").textContent.includes("이번 주 목표") && LS("n3lab:goal").weeklyMinutes === 120);
    $('[data-preset="0"]').click(); await wait(100);
    check("응원 보내기(준비된 문구)", $(".cheers li") && $(".cheers li").textContent.includes("민수 → N1 학습자"), $(".cheers li") && $(".cheers li").textContent);
    $("#cheer-text").value = "<b>같이 가자</b>"; $("#cheer-form").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true })); await wait(100);
    check("직접 쓴 응원(글자 그대로 표시)", $(".cheers li .cheer-text").textContent === "<b>같이 가자</b>" && !$(".cheers li b"));
    // N1 방에서 보기
    await go("together");
    check("N1에서 같은 메시지 보임", $$(".cheers li").length === 2 && $(".person.is-me").textContent.includes("N1 학습자"));
    check("N1 메뉴", tabs() === "홈|단어|문법|한자|독해|청해|오답 노트|시험 대비|모의고사|함께 보기|기록 관리", tabs());
    // 기록 관리 (N3)
    await go("n3/backup");
    check("기록 관리 안내", app().textContent.includes("실시간 동기화는 지원하지 않아요"));
    check("백업 버튼 3종", $$("[data-export]").map(b => b.textContent).join("|") === "N3 기록만 내려받기|N1 기록만|전체(N1+N3)");
    $("#b-export").click(); await wait(100);
    check("N3 백업 안내", $(".toast").textContent.includes("N3 백업 파일을 내려받았어요"));
    await upload(null, "not json");
    check("잘못된 파일(JSON 아님)", $(".toast").textContent.includes("올바른 백업 형식이 아니에요"));
    await upload({ app: "other" });
    check("다른 사이트 파일 거부", $(".toast").textContent.includes("백업 파일이 아니에요"));
    await upload({ app: "jlpt-n3-room", data: { attempts: "x" } });
    check("기록 형식 검사", $(".toast").textContent.includes("형식이 올바르지 않아요"), $(".toast").textContent);
    const allBackup = {
      app: "jlpt-goukaku-all", rooms: {
        n1: { app: "jlpt-n1-goukaku", data: { attempts: [{ qid: "g", area: "vocab", choice: 0, correct: true, at: Date.now() }], words: { v001: { status: "known" } } } },
        n3: { app: "jlpt-n3-room", data: { attempts: [], lists: { "n3-v0001": { status: "known" }, "n3-v0002": { fav: true } }, profile: { name: "복원됨" } } },
      },
    };
    await upload(allBackup);
    check("복원 전 확인(두 방 내용)", !!$(".confirm-box") && $(".confirm-box").textContent.includes("N1 방: 문제 풀이 1건") && $(".confirm-box").textContent.includes("N3 방: 문제 풀이 0건 · 단어 기록 2개"), $(".confirm-box") && $(".confirm-box").textContent.slice(0, 120));
    $("#b-pre-backup").click(); await wait(50);
    check("먼저 백업 버튼", $("#b-pre-backup").textContent.includes("백업했어요"));
    $("#b-import-yes").click(); await wait(100);
    check("복원 결과 안내", $(".toast").textContent.includes("N1(문제 풀이 1건") && $(".toast").textContent.includes("N3(문제 풀이 0건"), $(".toast").textContent);
    check("복원된 기록", LS("n3lab:profile").name === "복원됨" && LS("n1lab:attempts").length === 1 && LS("n3lab:attempts").length === 0);
    // N3만 지우기
    $("#b-reset").click(); await wait(50); $("#b-reset-yes").click(); await wait(100);
    check("N3만 지우기", $(".toast").textContent.includes("N3 방의 모든 기록을 지웠어요") && Object.keys(LS("n3lab:lists")).length === 0 && LS("n1lab:attempts").length === 1);
    await go("rooms");
  
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
