(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  location.hash = "n3/backup"; await wait(1200);
  const input = app().querySelector("#b-file");
  const dt = new window.DataTransfer();
  dt.items.add(new window.File(["not json"], "b.json", { type: "application/json" }));
  input.files = dt.files; input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await wait(500);
  const t = app().querySelector(".toast"); const snap = app().querySelector("section").textContent.slice(0, 200) + " / files=" + input.files.length + " / same input=" + (input === app().querySelector("#b-file"));
  const me = (() => { location.hash = "n3/together"; })();
  await wait(1200);
  const facts = app().querySelector(".person.is-me .person-facts");
  return snap + " || toast: " + (t ? t.textContent : "(없음)") + "\nfacts: " + [...facts.querySelectorAll("div")].map(d => d.querySelector("dt").textContent + "=" + d.querySelector("dd").textContent).join(", ");
})()
