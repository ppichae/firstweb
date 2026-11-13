(async () => {
  // 모든 주요 화면이 오류 없이 열리는지 (public 폴더 구조 점검용)
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const routes = ["rooms", "home", "vocab", "grammar", "kanji", "reading", "listening", "notes", "sprint", "mock", "backup", "badges",
    "n3", "n3/roadmap", "n3/basics", "n3/vocab", "n3/grammar", "n3/kanji", "n3/reading", "n3/listening", "n3/notes", "n3/exam", "n3/mock", "n3/backup", "n3/badges"];
  for (const h of routes) {
    location.hash = h; await wait(1500);
    const t = app().textContent;
    check(h + " 열림", t.length > 20 && !t.includes("불러오는 중") && !t.includes("불러오지 못했어요"), t.slice(0, 40));
  }
  location.hash = "n3/vocab"; await wait(1500);
  check("단어 주제 자료(public/data) 읽힘", app().querySelectorAll(".topic-tile").length === 13);
  location.hash = "n3/grammar"; await wait(1500);
  check("문법 주제 자료 읽힘", app().querySelectorAll(".topic-tile").length === 14);
  check("스타일(public/css) 적용", getComputedStyle(document.body).fontSize === "16px", getComputedStyle(document.body).fontSize);
  return log.join("\n");
})()
