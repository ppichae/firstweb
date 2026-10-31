(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const st = window.localStorage, now = Date.now(), day = 86400000;
  const at = [];
  [3, 5, 0, 8, 2, 6, 4].forEach((n, i) => { for (let k = 0; k < n; k++) at.push({ qid: "gq00" + (1 + k % 4), area: ["grammar", "vocab", "reading", "listening"][k % 4], choice: 0, correct: k % 3 !== 0, at: now - (6 - i) * day }); });
  st.setItem("n1lab:attempts", JSON.stringify(at));
  location.hash = "notes"; await wait(100); location.hash = "home"; await wait(500);
  return "ok";
})()
