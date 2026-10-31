(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const base = location.href.split("#")[0].replace(/index\.html.*$/, "");
  const out = [];
  try { const m = await window.eval('import("' + base + 'js/views/n3/study.js")'); out.push("study ok"); } catch (e) { out.push("study import 오류: " + e.message); }
  try { const m = await window.eval('import("' + base + 'js/views/n3/more.js")'); out.push("more ok"); } catch (e) { out.push("more 오류: " + e.message); }
  try { const m = await window.eval('import("' + base + 'js/data.js")'); await m.ensureExtra(["n3vocab", "sources", "kanji", "checks"]); out.push("extra ok " + !!m.EXTRA.checks); } catch (e) { out.push("extra 오류: " + e.message); }
  try { const m = await window.eval('import("' + base + 'js/views/n3/study.js")'); const d = document.createElement("div"); m.n3vocab.view.render(d); out.push("render ok " + d.textContent.slice(0, 40)); } catch (e) { out.push("render 오류: " + e.message + " " + (e.stack || "").split("\n")[1]); }
  return out.join(" | ");
})()
