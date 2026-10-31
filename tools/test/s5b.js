(async () => {
  const log = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const dlg = () => document.querySelector(".kanji-dialog");
  const W = () => document.documentElement.clientWidth;
  const { splitReading } = await window.eval('import("' + location.href.split("#")[0].replace(/index\.html.*$/, "").replace(/\?.*$/, "") + 'js/kanji.js")');
  location.hash = "n3/vocab"; await wait(1500);
  // N3 단어 중 한자 자료로 읽기를 나눌 수 있는 단어 비율과 예시
  const { EXTRA } = await window.eval('import("' + location.href.split("#")[0].replace(/index\.html.*$/, "") + 'js/data.js")');
  const items = EXTRA.n3vocab.items;
  const ok = items.map(v => [v, splitReading(v.word, v.reading)]).filter(x => x[1]);
  log.push("N3 단어 " + items.length + "개 중 한자별 읽기를 맞춘 단어 " + ok.length + "개. 예: " + ok.slice(0, 8).map(([v, s]) => v.word + "=" + s.map(p => p[0] + "(" + p[1] + ")").join("")).join(" / "));
  const i = $("#v-q"); i.value = "自"; i.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100);
  const card = $$(".card").find(c => c.querySelector('.kj[data-kanji="自"]'));
  card.querySelector('[data-kanji="自"]').click(); await wait(150);
  const r = dlg().getBoundingClientRect();
  log.push((r.left >= 0 && r.right <= W() + 1 ? "PASS" : "FAIL") + " 360px 창 폭 " + Math.round(r.left) + "~" + Math.round(r.right) + " / " + W() + " · 단어 " + dlg().querySelector(".kd-word").textContent.slice(0, 60));
  log.push((dlg().scrollWidth <= dlg().clientWidth + 1 ? "PASS" : "FAIL") + " 창 안 가로 넘침 없음");
  dlg().close();
  location.hash = "n3/kanji"; await wait(1200);
  log.push((document.documentElement.scrollWidth <= W() ? "PASS" : "FAIL") + " 360px 한자 화면 가로 스크롤 없음");
  return log.join("\n");
})()
