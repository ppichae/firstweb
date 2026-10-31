(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  location.hash = "n3"; await wait(1300);
  document.querySelector('[data-mode]'); 
  location.hash = "n3/vocab"; await wait(1300);
  const before = Object.keys(localStorage).filter(k => k.startsWith("n1lab:")).join(",");
  location.hash = ""; await wait(800);
  return "N3만 쓴 사람의 n1lab 키: [" + before + "] / jlpt:room=" + localStorage.getItem("jlpt:room") + " / 첫 화면 h2=" + document.querySelector("#app h2").textContent;
})()
