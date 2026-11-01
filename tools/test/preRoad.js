localStorage.setItem("jlpt:room","n3");
(function(){
  var ch = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split("");
  var kp = { hira: {}, kata: {} }; ch.forEach(function(c){ kp.hira[c] = { right: 3, wrong: 0 }; kp.kata[c] = { right: 3, wrong: 0 }; });
  localStorage.setItem("n3lab:kanaProgress", JSON.stringify(kp));
  var b = {}; ["b09","b02","b03","b04","b05","b06","b07","b08","b01","k01"].forEach(function(id){ b[id] = { done: "2026-10-20", best: 4 }; });
  localStorage.setItem("n3lab:basics", JSON.stringify(b));
  var at = []; for (var i = 0; i < 6; i++) at.push({ id: "r" + i, qid: "n3-basic-b02-" + i, area: "basics", choice: 0, correct: i < 2, at: Date.now() - 86400000 * 3, mode: "practice" });
  localStorage.setItem("n3lab:attempts", JSON.stringify(at));
})();
