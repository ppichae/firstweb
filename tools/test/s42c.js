(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  location.hash = "n3/backup"; await wait(1200);
  const out = []; await new window.File(["warm"], "w.txt").text();
  for (const body of ["not json", "not json", '{"app":"x"}']) {
    const input = app().querySelector("#b-file");
    const dt = new window.DataTransfer();
    dt.items.add(new window.File([body], "b.json", { type: "application/json" }));
    input.files = dt.files; input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await wait(800);
    const t = app().querySelector(".toast");
    out.push(body + " => " + (t ? t.textContent : "(없음)"));
  }
  return out.join(" || ");
})()
