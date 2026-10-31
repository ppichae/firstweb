(async () => {
  const out = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const over = () => { const d = document.documentElement; const bad = [...document.querySelectorAll("#app *")].filter(e => e.getBoundingClientRect().right > d.clientWidth + 1 && !e.closest(".tablist,.segmented,.toolbar .chip")).slice(0, 3).map(e => e.tagName + "." + e.className); return (d.scrollWidth > d.clientWidth ? "SCROLL " : "ok ") + bad.join(","); };
  const routes = ["rooms", "home", "vocab", "grammar", "n1/lists", "reading", "listening", "notes", "sprint", "mock", "backup", "n3", "n3/basics", "n3/vocab", "n3/grammar", "n3/more", "n3/exam", "n3/notes"];
  for (const h of routes) { location.hash = h; await wait(900); out.push(h + ": " + over()); }
  location.hash = "n3/basics"; await wait(900);
  app().querySelector('[data-unit="b07"]').click(); await wait(200);
  out.push("unit b07: " + over());
  app().querySelectorAll("#u-quiz .q").forEach(q => q.querySelectorAll(".opt")[0].click()); await wait(100);
  out.push("unit b07 answered: " + over());
  app().querySelector('[data-mode="kana"]').click(); await wait(100); out.push("kana: " + over());
  app().querySelector('[data-table="yoon"]').click(); await wait(100); out.push("yoon: " + over());
  app().querySelector('[data-mode="kanaquiz"]').click(); await wait(100); out.push("kanaquiz: " + over());
  location.hash = "n3/exam"; await wait(900);
  app().querySelector('[data-mode="test"]').click(); await wait(100);
  app().querySelector("#t-start").click(); await wait(200); out.push("test: " + over());
  app().querySelector("#t-submit").click(); await wait(200); out.push("result: " + over());
  app().querySelector('[data-mode="history"]').click(); await wait(100); out.push("history: " + over());
  location.hash = "n3/vocab"; await wait(900);
  app().querySelector('[data-mode="quiz"]').click(); await wait(100);
  app().querySelector('[data-qt="reading"]').click(); await wait(100);
  out.push("reading opts: " + [...app().querySelectorAll(".q")].slice(0, 3).map(q => [...q.querySelectorAll(".opt")].map(o => o.textContent.slice(1)).join("/")).join("  ||  "));
  app().querySelector('[data-mode="cards"]').click(); await wait(100); out.push("cards: " + over());
  location.hash = "n3/notes"; await wait(900); out.push("notes filled: " + over() + " count " + app().querySelectorAll(".note").length);
  return out.join("\n");
})()
