(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const log = [];
  const draft = () => JSON.parse(localStorage.getItem("n1lab:mockDraft"));
  location.hash = "mock"; await wait(300);
  $("#mock-start").requestSubmit(); await wait(300);
  const d = draft(); d.part = 2; d.deadline = Date.now() + 2500; localStorage.setItem("n1lab:mockDraft", JSON.stringify(d));
  location.hash = "home"; await wait(150); location.hash = "mock"; await wait(300);
  log.push("before: " + $(".mock-part").textContent + " " + $("#mock-timer").textContent);
  await wait(3500);
  log.push("after: " + ($("h2") ? $("h2").textContent : "-") + " | toast: " + ($(".toast") ? $(".toast").textContent : "-"));
  return log.join("\n");
})()
