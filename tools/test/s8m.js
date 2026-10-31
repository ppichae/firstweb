(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const out = [];
  const over = () => (document.documentElement.scrollWidth > document.documentElement.clientWidth ? "SCROLL" : "ok");
  for (const h of ["home", "badges", "n3", "n3/badges"]) { location.hash = h; await wait(1300); out.push(h + ": " + over()); }
  location.hash = "n3/kanji"; await wait(1300);
  app().querySelector('[data-kmode="quiz"]').click(); await wait(300);
  app().querySelector('[data-kqt="order"]').click(); await wait(1500);
  out.push("order: " + over() + " 보기폭 " + Math.round(app().querySelector(".kq-opts").getBoundingClientRect().right) + "/" + document.documentElement.clientWidth);
  app().querySelector('[data-kmode="review"]').click(); await wait(300); out.push("review: " + over());
  return out.join(" | ");
})()
