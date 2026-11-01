var DARK=true;
localStorage.setItem("jlpt:room","n1");
(function(){
  var p = function(n){ return String(n).padStart(2,"0"); };
  var d = new Date(); d.setDate(d.getDate() + 40);
  var ex = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  localStorage.setItem("n1lab:examDate", JSON.stringify(ex));
  var at = []; for (var i = 0; i < 12; i++) at.push({ id: "e" + i, qid: "n3-meaning-x" + i, area: "vocab", choice: 0, correct: true, at: Date.now() - 1000, mode: "practice", snap: { wordId: "n3-v000" + (i % 9 + 1) } });
  localStorage.setItem("n3lab:attempts", JSON.stringify(at));
})();
