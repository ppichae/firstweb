(async () => {
  // N1 문법(PDF 목록) 예문이 화면에 나오는지: 후리가나·해석·쓰임 설명·발음 버튼, 핵심 문법 예문은 그대로
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s);
  const until = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* 아직 */ } await wait(200); } return false; };
  try {
    location.hash = "grammar"; await until(() => $("#g001"), 10000);
    const ids = ["n1-g0003", "n1-g0080", "n1-g0158", "n1-g0160"];
    // 목록은 60개씩 보여 주므로, 찾는 문형이 나올 때까지 '더 보기'를 누른다
    for (let k = 0; k < 15 && !ids.every(id => document.getElementById(id)); k++) { const m = document.getElementById("g-more-btn"); if (!m) break; m.click(); await wait(300); }
    let shown = 0;
    for (const id of ids) {
      let el = document.getElementById(id);
      if (!el) { const s = app().querySelector("input[type=search]"); if (s) { s.value = ""; } }
      el = document.getElementById(id);
      if (el && el.querySelector(".ex-own ruby") && el.querySelector(".ex-own .ko") && el.querySelector(".say-btn")) shown++;
      else log.push("INFO " + id + " → " + (el ? el.textContent.slice(0, 60) : "화면에 없음"));
    }
    check("N1 문법 목록 예문 표시(후리가나·해석·발음)", shown === ids.length, shown + "/" + ids.length);
    const g3 = document.getElementById("n1-g0003");
    check("「もさることながら」 예문 문장", !!g3 && g3.textContent.includes("さることながら"), g3 && g3.querySelector(".ex-own") ? g3.querySelector(".ex-own").textContent.slice(0, 40) : "");
    const g1 = $("#g001");
    check("핵심 문법 예문 그대로", !!g1 && g1.textContent.includes("오늘부로 접수를 마감합니다."));
    check("히라가나만 적은 중복 줄 없음", !app().querySelector(".ex-reading"));
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("FAIL 테스트 중단: " + e.message); }
  return log.join("\n");
})()
