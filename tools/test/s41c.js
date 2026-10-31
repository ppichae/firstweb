(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const out = [];
  location.hash = "vocab"; await wait(1500);
  document.querySelector('#app [data-mode="quiz"]').click(); await wait(200);
  const qs = [...document.querySelectorAll("#app .q")];
  for (const q of qs) { q.querySelector('[data-o="0"]').click(); await wait(20); }
  const att = JSON.parse(localStorage.getItem("n1lab:attempts"));
  const words = JSON.parse(localStorage.getItem("n1lab:words") || "{}");
  const lists = JSON.parse(localStorage.getItem("n1lab:lists") || "{}");
  const wrong = att.filter(a => !a.correct);
  const ok = wrong.every(a => { const id = a.snap.wordId; const rec = id.startsWith("n1-") ? lists[id] : words[id]; return rec && rec.wrong >= 1 && rec.srs; });
  out.push((ok ? "PASS" : "FAIL") + " 틀린 단어 " + wrong.length + "개 모두 오늘 복습으로 저장 (기본 단어→words, PDF 단어→lists)");
  return out.join("\n");
})()
