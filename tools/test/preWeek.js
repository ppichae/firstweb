localStorage.setItem("jlpt:room","n3");
(function(){
  var p = function(n){ return String(n).padStart(2,"0"); };
  var k = function(d){ return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
  var t = new Date(); var past = new Date(); past.setDate(past.getDate() - 15);
  var ex = new Date(); ex.setDate(ex.getDate() + 10);
  localStorage.setItem("n3lab:attempts", JSON.stringify([{ id: "w1", qid: "x", area: "vocab", choice: 0, correct: true, at: past.getTime(), mode: "practice" }]));
  var a = {}; var older = new Date(); older.setDate(older.getDate() - 40); a[k(older)] = { seconds: 300 }; a[k(t)] = { cards: 2 };
  localStorage.setItem("n3lab:activity", JSON.stringify(a));
  localStorage.setItem("n3lab:examDate", JSON.stringify(k(ex)));
  var n1 = {}; n1[k(t)] = { seconds: 600 };
  localStorage.setItem("n1lab:activity", JSON.stringify(n1));
  window.__exam = k(ex);
})();
