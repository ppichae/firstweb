(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s);
  try {
    location.hash = "grammar"; await wait(1600);
    const it = $("#g001");
    check("N1 문법 예문에 한자 읽기", !!it && !!it.querySelector(".g-ex .ex-own ruby"), it && it.querySelector(".g-ex").textContent.slice(0, 40));
    check("원래 해석 유지", it.textContent.includes("오늘부로 접수를 마감합니다."));
    const more = it.querySelector("details.g-more"); more.open = true; await wait(100);
    check("예문 더 보기도 읽기 포함", !!more.querySelector(".ex-own ruby") && more.textContent.includes("서면으로 알려 드립니다"));
    check("같은 예문 중복 없음", it.querySelectorAll(".ex-own").length === 2, it.querySelectorAll(".ex-own").length);
    check("즐겨찾기·공부했어요 버튼 유지", it.querySelectorAll(".g-actions button").length === 2);
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message); }
  return log.join("\n");
})()
