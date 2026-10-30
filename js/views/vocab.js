// 단어 화면
import { DB } from "../data.js";
import { store } from "../store.js";
import { esc, badges } from "../util.js";

export const POS = {
  "noun-suru": "명사 · する동사", noun: "명사", "na-adj": "な형용사", "i-adj": "い형용사",
  verb: "동사", taru: "~と / ~とした", adverb: "부사", expression: "표현",
};

let filter = "all";
let showAll = false;
const revealed = new Set();

function wordState(id) { return store.get("words")[id] || {}; }

function render(app) {
  const items = DB.vocab.items;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>단어</h2><p>카드를 누르면 읽는 법과 뜻이 보여요.</p></div>' +
        '<div class="toolbar"><div class="progress"><strong id="known-count">0</strong> / ' + items.length + ' 외움</div>' +
        '<div class="bar" aria-hidden="true"><span id="known-bar" style="width:0%"></span></div></div></div>' +
      '<div class="toolbar">' +
        chip("all", "전체") + chip("todo", "아직 못 외움") + chip("done", "외운 단어") +
        '<button type="button" class="chip" id="toggle-all" aria-pressed="' + showAll + '">' + (showAll ? "뜻 모두 가리기" : "뜻 모두 보기") + "</button>" +
      "</div>" +
      '<div class="cards" id="cards"></div>' +
    "</section>";
  draw(app);

  app.onclick = e => {
    const f = e.target.closest("[data-filter]");
    const face = e.target.closest("[data-word]");
    const mark = e.target.closest("[data-mark]");
    if (f) {
      filter = f.dataset.filter;
      app.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", b === f));
    } else if (e.target.closest("#toggle-all")) {
      showAll = !showAll;
      revealed.clear();
      const t = app.querySelector("#toggle-all");
      t.setAttribute("aria-pressed", showAll);
      t.textContent = showAll ? "뜻 모두 가리기" : "뜻 모두 보기";
    } else if (face) {
      const id = face.dataset.word;
      revealed.has(id) ? revealed.delete(id) : revealed.add(id);
    } else if (mark) {
      const id = mark.dataset.mark;
      store.update("words", w => {
        const s = w[id] || (w[id] = {});
        s.status = s.status === "known" ? "unknown" : "known";
      });
    } else return;
    draw(app);
  };
}

function chip(key, label) {
  return '<button type="button" class="chip" data-filter="' + key + '" aria-pressed="' + (filter === key) + '">' + label + "</button>";
}

function draw(app) {
  const items = DB.vocab.items;
  const isKnown = v => wordState(v.id).status === "known";
  const list = items.filter(v => filter === "all" ? true : filter === "done" ? isKnown(v) : !isKnown(v));
  const cards = app.querySelector("#cards");
  if (!list.length) {
    cards.innerHTML = '<p class="empty">' + (filter === "done" ? "아직 도장을 찍은 단어가 없어요. 카드 아래 '외웠어요'를 눌러 보세요." : "모든 단어를 외웠어요!") + "</p>";
  } else {
    cards.innerHTML = list.map(v => {
      const open = showAll || revealed.has(v.id);
      const known = isKnown(v);
      const ex = v.examples && v.examples[0];
      return '<article class="card">' +
        (known ? '<span class="seal" aria-hidden="true" lang="ja">済</span>' : "") +
        '<button type="button" class="card-face" data-word="' + v.id + '" aria-expanded="' + open + '">' +
          '<span class="word" lang="ja">' + esc(v.word) + "</span>" +
          (open
            ? '<span class="reading" lang="ja">' + esc(v.reading) + '</span><span class="meaning">' + esc(v.meaning) + "</span>" +
              (ex ? '<span class="ex"><span class="jp" lang="ja">' + esc(ex.ja) + "</span>" + esc(ex.ko) + "</span>" : "") +
              badges(v)
            : '<span class="hint">눌러서 뜻 보기</span>') +
        "</button>" +
        '<div class="card-foot"><span class="pos">' + esc(POS[v.pos] || v.pos) + "</span>" +
          '<button type="button" class="mark" data-mark="' + v.id + '" aria-pressed="' + known + '">' + (known ? "외웠어요 ✓" : "외웠어요") + "</button></div>" +
      "</article>";
    }).join("");
  }
  const knownCount = items.filter(isKnown).length;
  app.querySelector("#known-count").textContent = knownCount;
  app.querySelector("#known-bar").style.width = (knownCount / items.length * 100) + "%";
}

export default { id: "vocab", label: "단어", jp: "語彙", render };
