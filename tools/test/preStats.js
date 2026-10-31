localStorage.setItem("jlpt:room","n3");
var T=new Date(); var D=T.getFullYear()+"-"+String(T.getMonth()+1).padStart(2,"0")+"-"+String(T.getDate()).padStart(2,"0");
localStorage.setItem("n3lab:lists", JSON.stringify({
  "n3-v0001": { status: "known" },
  "n3-v0002": { status: "unknown" },
  "n3-v0003": { srs: { reps: 1, interval: 1, ease: 2.5, due: D, lapses: 0 } },
  "n3-v0004": { srs: { reps: 1, interval: 1, ease: 2.5, due: D, lapses: 0 }, cardOk: D }
}));
localStorage.setItem("n3lab:attempts", JSON.stringify([
  { id: "a1", qid: "n3-meaning-n3-v0005", area: "vocab", choice: 0, correct: true, at: Date.now(), mode: "practice", snap: { wordId: "n3-v0005" } },
  { id: "a2", qid: "n3-meaning-n3-v0006", area: "vocab", choice: 1, correct: false, at: Date.now(), mode: "practice", snap: { wordId: "n3-v0006" } }
]));
