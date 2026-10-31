// 한자 화면: 이 방에서 고른 한자(상세 자료 있음)와, 단어 목록에 나오는 다른 한자(상세 준비 중)를 모아 본다
// 한자를 누르면 상세 창이 열린다. 본 한자·즐겨찾기 기록은 방마다 따로 저장한다.
import { EXTRA } from "../data.js";
import { store, n3store } from "../store.js";
import { esc } from "../util.js";
import { kanjiInfo, roomKanjiList, wordsWith, isKanji, handleKanjiClick } from "../kanji.js";
import { DB } from "../data.js";
import { runKanjiQuiz, kanjiStats, KQ_TYPES } from "../kanjiQuiz.js";

const STORES = { n1: store, n3: n3store };

export function createKanjiView(id, roomId) {
  const ui = { q: "", filter: "all", mode: "list", qtype: "mix" };
  const st = STORES[roomId];
  let appRef = null;
  window.addEventListener("kanji-changed", () => { if (appRef && location.hash === "#" + id) drawGrid(appRef); });

  function otherKanji() {
    const featured = new Set(roomKanjiList(roomId));
    const words = roomId === "n1" ? [...((DB.vocab && DB.vocab.items) || []), ...((EXTRA.n1vocab && EXTRA.n1vocab.items) || [])] : ((EXTRA.n3vocab && EXTRA.n3vocab.items) || []);
    const count = new Map();
    words.forEach(v => [...new Set([...(v.word || "")])].forEach(c => { if (isKanji(c) && c !== "々" && !featured.has(c)) count.set(c, (count.get(c) || 0) + 1); }));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  }

  function render(app) {
    appRef = app;
    const list = roomKanjiList(roomId);
    if (!list.length || !EXTRA.kanji) {
      app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>한자</h2></div></div><p class="notice">자료를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요. 한자 자료 파일을 불러오지 못했어요.</p></section>';
      return;
    }
    const seen = list.filter(c => (st.get("kanji")[c] || {}).seen).length;
    const seg = (k, l) => '<button type="button" role="tab" class="seg" data-kmode="' + k + '" aria-selected="' + (ui.mode === k) + '">' + l + "</button>";
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>한자</h2><p>한자를 누르면 한국 한자음과 뜻, 음독·훈독, 획순, 직접 쓰기, 이 방 단어 목록에서 쓰인 단어를 볼 수 있어요.</p></div>' +
          '<div class="toolbar"><div class="progress">살펴본 한자 <strong>' + seen + "</strong> / " + list.length + "</div>" +
          '<div class="bar" aria-hidden="true"><span style="width:' + (seen / list.length * 100) + '%"></span></div></div></div>' +
        '<div class="segmented" role="tablist" aria-label="한자 학습">' + seg("list", "한자 목록") + seg("quiz", "한자 퀴즈") + seg("review", "오답 복습 · 기록") + "</div>" +
        '<div id="k-mode" class="stack"></div>' +
      "</section>";
    app.onclick = e => {
      if (handleKanjiClick(e, roomId)) return;
      const m = e.target.closest("[data-kmode]");
      if (m) { ui.mode = m.dataset.kmode; render(app); return; }
      const f = e.target.closest("[data-kf]");
      if (f) { ui.filter = f.dataset.kf; app.querySelectorAll("[data-kf]").forEach(b => b.setAttribute("aria-pressed", b === f)); drawGrid(app); }
      const t = e.target.closest("[data-kqt]");
      if (t) { ui.qtype = t.dataset.kqt; renderQuiz(app.querySelector("#k-mode")); }
      if (e.target.closest("#kq-new")) renderQuiz(app.querySelector("#k-mode"));
      if (e.target.closest("#kr-start")) runKanjiQuiz(app.querySelector("#kr-quiz"), roomId, "mix", kanjiStats(roomId).weak.map(w => kanjiInfo(w.c)).filter(Boolean), () => {});
    };
    const box = app.querySelector("#k-mode");
    if (ui.mode === "quiz") { renderQuiz(box); return; }
    if (ui.mode === "review") { renderReview(box); return; }
    box.innerHTML =
      '<p class="notice">단어 화면에서도 단어 아래의 한자 버튼을 누르면 같은 창이 열려요. 자료 정보는 각 한자 창 맨 아래에 있어요.</p>' +
      '<div class="filters"><div class="field search"><label for="k-q">검색</label><input id="k-q" type="search" placeholder="한자, 한국 한자음·뜻, 읽기로 찾기" value="' + esc(ui.q) + '"></div></div>' +
      '<div class="toolbar">' + [["all", "전체"], ["unseen", "아직 안 본 한자"], ["seen", "살펴본 한자"], ["fav", "즐겨찾기"]].map(([k, l]) =>
        '<button type="button" class="chip" data-kf="' + k + '" aria-pressed="' + (ui.filter === k) + '">' + l + "</button>").join("") + "</div>" +
      '<div class="kanji-grid" id="k-grid"></div>' +
      '<article class="card-box"><h3>이 방 단어 목록에 나오는 다른 한자 <small class="hint" id="k-other-n"></small></h3>' +
        '<p class="hint">누르면 이 한자가 쓰인 단어를 볼 수 있어요.</p><div class="kanji-others" id="k-others"></div></article>';
    app.querySelector("#k-q").oninput = e => { ui.q = e.target.value.trim(); drawGrid(app); };
    drawGrid(app);
    const others = otherKanji();
    app.querySelector("#k-other-n").textContent = others.length + "자";
    app.querySelector("#k-others").innerHTML = others.map(c => '<button type="button" class="kj no-data" data-kanji="' + esc(c) + '" lang="ja">' + esc(c) + "</button>").join("");
  }

  function renderQuiz(box) {
    box.innerHTML =
      '<div class="toolbar">' + [["mix", "섞어서"], ...KQ_TYPES].map(([k, l]) =>
        '<button type="button" class="chip" data-kqt="' + k + '" aria-pressed="' + (ui.qtype === k) + '">' + l + "</button>").join("") +
        '<button type="button" class="link-btn" id="kq-new">새 문제</button></div>' +
      '<p class="hint">이 방에서 고른 한자 ' + roomKanjiList(roomId).length + "자로 만든 <b>자체 제작 연습 문제</b>예요. 틀린 문제는 오답 노트와 '오답 복습'에 모여요. 획순 문제는 KanjiVG 획순 데이터를 써요.</p>" +
      '<div id="kq-box"></div>';
    runKanjiQuiz(box.querySelector("#kq-box"), roomId, ui.qtype, null);
  }

  function renderReview(box) {
    const s = kanjiStats(roomId);
    box.innerHTML =
      '<article class="card-box"><h3>유형별 정답률</h3><div class="meters">' + s.types.map(t =>
        '<div class="meter wide-name"><span class="meter-name">' + t.l + '</span><span class="meter-track"><span style="width:' + (t.rate || 0) + '%"></span></span>' +
        '<span class="meter-val">' + (t.rate === null ? "기록 없음" : t.rate + "% <small>" + t.correct + "/" + t.total + "</small>") + "</span></div>").join("") + "</div>" +
        (() => { const judged = s.types.filter(t => t.total >= 5).sort((a, b) => a.rate - b.rate); return judged.length && judged[0].rate < 80 ? '<p><b>약한 유형</b> · ' + judged[0].l + " (" + judged[0].rate + "%)</p>" : '<p class="hint">유형마다 5문제 이상 풀면 약한 유형을 알려 드려요.</p>'; })() +
      "</article>" +
      '<article class="card-box"><h3>다시 볼 한자 <small class="hint">' + s.weak.length + "자</small></h3>" +
        (s.weak.length
          ? '<p class="hint">틀린 횟수가 맞힌 횟수보다 많거나 같은 한자예요. 다시 맞히면 목록에서 빠져요.</p><div class="kanji-others">' +
              s.weak.map(w => '<button type="button" class="kj" data-kanji="' + esc(w.c) + '" lang="ja" title="맞힘 ' + w.right + " · 틀림 " + w.wrong + '">' + esc(w.c) + "</button>").join("") + "</div>" +
            '<div class="toolbar"><button type="button" class="btn" id="kr-start">이 한자들로 다시 풀기</button></div><div id="kr-quiz"></div>'
          : '<p class="empty">아직 다시 볼 한자가 없어요. 한자 퀴즈를 풀면 틀린 한자가 여기에 모여요.</p>') +
      "</article>";
  }
  function drawGrid(app) {
    const grid = app.querySelector("#k-grid");
    if (!grid) return;
    const rec = st.get("kanji");
    const q = ui.q;
    const items = roomKanjiList(roomId).map(c => kanjiInfo(c)).filter(Boolean).filter(k => {
      const r = rec[k.char] || {};
      if (ui.filter === "seen" && !r.seen) return false;
      if (ui.filter === "unseen" && r.seen) return false;
      if (ui.filter === "fav" && !r.fav) return false;
      if (q) {
        const hay = [k.char, k.ko ? (k.ko.hun || "") + " " + k.ko.eum : "", k.meaning, ...k.on, ...k.kun.map(x => x.replace("-", ""))].join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    grid.innerHTML = items.length ? items.map(k => {
      const r = rec[k.char] || {};
      return '<button type="button" class="kanji-tile' + (r.seen ? " seen" : "") + '" data-kanji="' + esc(k.char) + '">' +
        '<span class="kt-char" lang="ja">' + esc(k.char) + "</span>" +
        '<span class="kt-ko">' + (k.ko ? (k.ko.hun ? esc(k.ko.hun) + " " : "") + esc(k.ko.eum) : "") + (r.fav ? " ★" : "") + "</span>" +
        '<span class="kt-n">' + wordsWith(k.char, roomId).length + "단어</span></button>";
    }).join("") : '<p class="empty">조건에 맞는 한자가 없어요.</p>';
  }

  return { id, label: "한자", jp: "漢字", needs: ["kanji", roomId === "n1" ? "kanjiN1" : "kanjiN3", roomId === "n1" ? "n1vocab" : "n3vocab", "sources", ...(roomId === "n1" ? ["exN1V", "exN1G"] : ["exN3V", "exN3G"])], render };
}
