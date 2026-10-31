(() => {
  const d = new Date(), key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const t = Date.now() - 3600000;
  localStorage.setItem("n1lab:attempts", JSON.stringify([
    { qid: "gen-meaning-v001", area: "vocab", choice: 0, correct: true, at: t, mode: "practice", snap: { kind: "뜻 고르기", prompt: "x", options: ["a", "b", "c", "d"], answer: 0, explanation: "x", wordId: "v001" } },
    { qid: "gen-meaning-v002", area: "vocab", choice: 0, correct: true, at: t, mode: "practice", snap: { kind: "뜻 고르기", prompt: "y", options: ["a", "b", "c", "d"], answer: 0, explanation: "y", wordId: "v002" } },
    { qid: "gen-meaning-v003", area: "vocab", choice: 1, correct: false, at: t, mode: "practice", snap: { kind: "뜻 고르기", prompt: "z", options: ["a", "b", "c", "d"], answer: 0, explanation: "z", wordId: "v003" } },
  ]));
  localStorage.setItem("n1lab:activity", JSON.stringify({ [key]: { cards: 4 } }));
  localStorage.setItem("n3lab:game", JSON.stringify({ xp: 120 }));
  localStorage.setItem("jlpt:room", "n1");
})();
