// N3 방 · 독해 · 청해: data/n3/reading.json · listening.json을 읽어서 보여 준다
// 자료가 없으면 '자료 준비 중'으로 보여 주고, 임시 내용으로 채우지 않는다. 형식은 각 파일의 meta.itemExample에 있다.
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc } from "../../util.js";
import { mountQuestion } from "../../quiz.js";
import { stopAll } from "../../speech.js";
import { speak } from "./kana.js";
import { award } from "./game.js";

function createN3Skill(id, label, dataKey, kind) {
  const ui = { open: null };
  function render(app) {
    const d = EXTRA[dataKey];
    const items = (d && d.items) || [];
    if (ui.open && !items.some(x => x.id === ui.open)) ui.open = null;
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>' + label + "</h2><p>" + (kind === "reading" ? "지문을 읽고 문제를 풀어요. 해석은 다 푼 뒤에 펼쳐 볼 수 있어요." : "음성을 듣고 문제를 풀어요. 스크립트와 해석은 다 푼 뒤에 펼쳐 볼 수 있어요.") + "</p></div></div>" +
        (items.length
          ? '<div class="picker">' + items.map(x =>
              '<button type="button" class="pick" data-open="' + esc(x.id) + '" aria-pressed="' + (ui.open === x.id) + '"><span class="pick-type">' + esc(x.type) + '</span><span class="pick-title">' + esc(x.title) + '</span><span class="pick-meta">' + esc(x.status || "검수 필요") + "</span></button>").join("") + "</div>" +
            '<div id="sk-item" class="stack"></div>'
          : '<article class="card-box pending"><h3>자료 준비 중</h3><p class="hint">N3 ' + label + " 자료가 아직 없어요. 임시 내용으로 채우지 않았어요. 자료는 data/n3/" + (kind === "reading" ? "reading" : "listening") + ".json에 정해진 형식으로 추가하면 이 화면에 바로 나타나요.</p></article>") +
      "</section>";
    app.onclick = e => {
      const o = e.target.closest("[data-open]");
      if (o) { ui.open = o.dataset.open; stopAll(); render(app); return; }
      const p = e.target.closest("[data-play]");
      if (p) { const it = items.find(x => x.id === ui.open); playScript(it, app.querySelector("#sk-msg")); }
    };
    const it = items.find(x => x.id === ui.open);
    if (it) drawItem(app.querySelector("#sk-item"), it);
  }

  function drawItem(box, it) {
    const src = it.source || {};
    box.innerHTML =
      '<article class="' + (kind === "reading" ? "passage" : "listen") + '">' +
        '<div class="q-top"><h3>' + esc(it.title) + '</h3><span class="badges"><span class="badge">' + esc(src.label || "출처 미기재") + "</span>" +
          '<span class="badge ' + (it.status === "검수 완료" ? "ok" : "warn") + '">' + esc(it.status || "검수 필요") + "</span></span></div>" +
        (kind === "reading"
          ? (it.text || []).map(p => '<p class="jp" lang="ja">' + esc(p) + "</p>").join("")
          : '<p class="hint">' + esc(it.situation || "") + "</p>" +
            (it.audio && it.audio.file
              ? '<audio controls preload="none" src="' + esc(it.audio.file) + '"></audio><p class="hint">음성 출처: ' + esc(it.audio.source || "미기재") + " · " + esc(it.audio.license || "") + "</p>"
              : '<div class="toolbar"><button type="button" class="btn" data-play>▶ 기기 음성으로 듣기</button></div><p class="p-state" id="sk-msg" role="status"></p><p class="hint">녹음 파일이 없어서 기기의 일본어 음성(TTS)으로 읽어요. 실제 시험 음성과 다를 수 있어요.</p>')) +
        '<details class="g-more"><summary>' + (kind === "reading" ? "한국어 해석" : "스크립트와 해석") + "</summary>" +
          (kind === "reading" ? (it.translation || []).map(p => "<p>" + esc(p) + "</p>").join("")
            : '<div class="script">' + (it.script || []).map(l => '<p><b lang="ja">' + esc(l.sp) + '</b> <span lang="ja">' + esc(l.ja) + '</span><br><small class="hint">' + esc(l.ko || "") + "</small></p>").join("") + "</div>") +
        "</details>" +
      "</article>" +
      '<div class="quiz" id="sk-q"></div>';
    (it.questions || []).forEach((q, i) => {
      const holder = document.createElement("div");
      box.querySelector("#sk-q").appendChild(holder);
      mountQuestion(holder, Object.assign({ area: kind, generated: true, kind: it.type, source: { type: src.type === "ai" ? "ai" : "pdf", label: src.label }, review: it.status === "검수 완료" ? "verified" : "needs-review" }, q), {
        label: "문제 " + (i + 1), store: n3store, wide: true, onAnswer: ok => award(ok ? "correct" : "wrong"),
      });
    });
  }

  async function playScript(it, msg) {
    for (const l of it.script || []) { await new Promise(res => { speak(l.ja, msg); const t = setInterval(() => { if (!window.speechSynthesis.speaking) { clearInterval(t); res(); } }, 300); }); }
  }

  return { id, label, needs: [dataKey], render, leave: stopAll };
}

export const n3reading = createN3Skill("n3/reading", "독해", "n3reading", "reading");
export const n3listening = createN3Skill("n3/listening", "청해", "n3listening", "listening");
