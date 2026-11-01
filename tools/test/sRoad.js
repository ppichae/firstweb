(async () => {
  // N3 학습 로드맵: N5→N4→N3 단계, 실제 기록 진행률, 추천(이전 단계 보완·가장 덜 한 항목), 급수/레벨 구분 안내
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1500); };
  try {
    await go("n3/roadmap");
    const st = $$(".road-stage");
    check("세 단계 N5·N4·N3", st.map(s => s.querySelector(".badge").textContent).join("|") === "N5|N4|N3", st.map(s => s.querySelector(".badge").textContent).join("|"));
    check("N5·N4 100%, 완료 표시", st[0].classList.contains("done") && st[0].querySelector(".q-top b").textContent === "100%" && st[1].querySelector(".q-top b").textContent === "100%");
    check("지금 단계 N3", st[2].classList.contains("now") && $(".roadmap-now").textContent.includes("지금 단계: N3 실전"), $(".roadmap-now .hint").textContent);
    const rec = $$(".rec-list li").map(l => l.textContent);
    check("이전 단계 보완 추천 (기초 정답률 33%)", rec.some(t => t.includes("33%") && t.includes("복습")), rec.join(" / "));
    check("가장 덜 한 항목 추천", rec.some(t => t.includes("N3 실전 단계의")), rec.join(" / "));
    check("독해·청해 문제 수가 자료에서 계산됨", st[2].textContent.includes("독해") && /독해.*0 \/ [1-9]\d*/.test(st[2].querySelector(".meters").textContent.replace(/\s+/g, " ")));
    check("급수와 레벨 구분 안내", app().textContent.includes("레벨이 높다고 급수가 오르는 것은 아니에요"));
    check("내부 상태 문구 없음", !/준비 중|검수 필요|AI 생성/.test(app().textContent));
    $$(".rec-list [data-go]")[0].click(); await wait(800);
    check("추천 '하러 가기' → 기초", location.hash === "#n3/basics", location.hash);
    await go("n3");
    check("N3 홈에 로드맵 링크", !!$('a[href="#n3/roadmap"]'));
    // 기록이 없으면 N5부터
    ["n3lab:kanaProgress", "n3lab:basics", "n3lab:attempts"].forEach(k => localStorage.removeItem(k));
    const s = await window.eval('import("./js/store.js")');
    s.n3store.set("kanaProgress", { hira: {}, kata: {} }); s.n3store.set("basics", {}); s.n3store.set("attempts", []);
    await go("n3/roadmap");
    check("기록 없으면 N5부터 추천", $(".roadmap-now").textContent.includes("지금 단계: N5 입문") && $(".rec-list").textContent.includes("히라가나"), $(".roadmap-now").textContent.slice(0, 120));
    check("가로 스크롤 없음", document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
