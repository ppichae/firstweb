// 한자 화면: N1·N3 단어장에 나오는 한자 전체를 한국어 훈음 가나다순으로 보고, 초성 바로가기·검색·급수 필터로 찾는다.
// 한자를 누르면 상세 창이 열린다. 본 한자·즐겨찾기 기록은 방마다 따로 저장한다.
import { EXTRA } from "../data.js";
import { store, n3store } from "../store.js";
import { esc } from "../util.js";
import { kanjiInfo, roomKanjiList, allKanji, handleKanjiClick } from "../kanji.js";
import { runKanjiQuiz, kanjiStats, KQ_TYPES } from "../kanjiQuiz.js";

const STORES = { n1: store, n3: n3store };
const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const BASE = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" };
const INDEX = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ", "기타"];
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 한국 음의 첫 글자 초성 (쌍자음은 기본 자음으로 묶는다). 음이 없으면 '기타'
function choOf(k) {
  const c = k.ko && k.ko.eum ? k.ko.eum.charCodeAt(0) : 0;
  if (c < 0xAC00 || c > 0xD7A3) return "기타";
  const ch = CHO[Math.floor((c - 0xAC00) / 588)];
  return BASE[ch] || ch;
}
const sortKey = k => (k.ko && k.ko.eum ? k.ko.eum : "힣힣") + " " + (k.ko && k.ko.hun ? k.ko.hun : "");

export function createKanjiView(id, roomId) {
  const roomLv = roomId === "n1" ? "N1" : "N3";
  const ui = { q: "", filter: "all", level: roomLv, mode: "list", qtype: "mix" };
  const st = STORES[roomId];
  let appRef = null;
  window.addEventListener("kanji-changed", () => { if (appRef && location.hash === "#" + id) drawList(appRef); });

  function render(app) {
    appRef = app;
    const list = roomKanjiList(roomId);
    if (!list.length || !EXTRA.kanjiIndex) {
      app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>한자</h2></div></div><p class="notice">자료를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p></section>';
      return;
    }
    const seen = list.filter(c => (st.get("kanji")[c] || {}).seen).length;
    const seg = (k, l) => '<button type="button" role="tab" class="seg" data-kmode="' + k + '" aria-selected="' + (ui.mode === k) + '">' + l + "</button>";
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>한자</h2></div>' +
          '<div class="toolbar"><div class="progress">' + roomLv + " 한자 살펴봄 <strong>" + seen + "</strong> / " + list.length + "</div>" +
          '<div class="bar" aria-hidden="true"><span style="width:' + (seen / list.length * 100) + '%"></span></div></div></div>' +
        '<div class="segmented" role="tablist" aria-label="한자 학습">' + seg("list", "한자 목록") + seg("quiz", "한자 퀴즈") + seg("review", "오답 복습 · 기록") + "</div>" +
        '<div id="k-mode" class="stack"></div>' +
      "</section>";
    app.onclick = e => {
      const ix = e.target.closest("[data-kix]");
      if (ix) { jumpTo(app, ix.dataset.kix); return; }
      if (handleKanjiClick(e, roomId)) return;
      const m = e.target.closest("[data-kmode]");
      if (m) { ui.mode = m.dataset.kmode; render(app); return; }
      const f = e.target.closest("[data-kf]");
      if (f) { ui.filter = f.dataset.kf; app.querySelectorAll("[data-kf]").forEach(b => b.setAttribute("aria-pressed", b === f)); drawList(app); }
      const lv = e.target.closest("[data-klv]");
      if (lv) { ui.level = lv.dataset.klv; app.querySelectorAll("[data-klv]").forEach(b => b.setAttribute("aria-pressed", b === lv)); drawList(app); }
      const t = e.target.closest("[data-kqt]");
      if (t) { ui.qtype = t.dataset.kqt; renderQuiz(app.querySelector("#k-mode")); }
      if (e.target.closest("#kq-new")) renderQuiz(app.querySelector("#k-mode"));
      if (e.target.closest("#kr-start")) runKanjiQuiz(app.querySelector("#kr-quiz"), roomId, "mix", kanjiStats(roomId).weak.map(w => kanjiInfo(w.c)).filter(Boolean), () => {});
    };
    const box = app.querySelector("#k-mode");
    if (ui.mode === "quiz") { renderQuiz(box); return; }
    if (ui.mode === "review") { renderReview(box); return; }
    const chip = (attr, k, l, on) => '<button type="button" class="chip" data-' + attr + '="' + k + '" aria-pressed="' + on + '">' + l + "</button>";
    box.innerHTML =
      '<div class="filters"><div class="field search"><label for="k-q">검색</label><input id="k-q" type="search" placeholder="한자, 훈음(예: 막힐 조), 읽기(예: はばむ)로 찾기" value="' + esc(ui.q) + '"></div></div>' +
      '<div class="k-filter-rows">' +
        '<div class="toolbar" role="group" aria-label="급수"><span class="k-flabel">급수</span>' + [["N3", "N3"], ["N1", "N1"], ["all", "전체"]].map(([k, l]) => chip("klv", k, l, ui.level === k)).join("") + "</div>" +
        '<div class="toolbar" role="group" aria-label="보기"><span class="k-flabel">보기</span>' + [["all", "모두"], ["unseen", "아직 안 본 한자"], ["seen", "살펴본 한자"], ["fav", "즐겨찾기"]].map(([k, l]) => chip("kf", k, l, ui.filter === k)).join("") + "</div>" +
      "</div>" +
      '<nav class="k-index" aria-label="초성으로 바로 가기" id="k-index"></nav>' +
      '<p class="hint k-count" id="k-count" aria-live="polite"></p>' +
      '<div class="k-list" id="k-list"></div>' +
      '<p class="hint">N1·N3 구분은 이 사이트 단어장에 나오는 한자를 기준으로 했어요. JLPT는 급수별 공식 한자 목록을 공개하지 않아요.</p>';
    app.querySelector("#k-q").oninput = e => { ui.q = e.target.value.trim(); drawList(app); };
    drawList(app);
  }

  // 초성 머리글로 이동 (위에 고정된 메뉴·초성 줄에 가리지 않게)
  function jumpTo(app, key) {
    const h = app.querySelector('[data-kgroup="' + key + '"]');
    if (!h) return;
    const nav = document.querySelector("nav.tabs"), ix = app.querySelector("#k-index");
    const offset = (nav ? nav.getBoundingClientRect().height : 0) + (ix ? ix.getBoundingClientRect().height : 0) + 8;
    window.scrollTo(0, window.scrollY + h.getBoundingClientRect().top - offset);
  }

  function matches(k, q) {
    if (!q) return true;
    const hq = toHira(q);
    const ko = [k.ko && k.ko.hun, k.ko && k.ko.eum].filter(Boolean).join(" ");
    const hay = [k.char, ko, (k.ko && k.ko.hun || "") + (k.ko && k.ko.eum || ""), ...(k.alt || []), k.meaning || "", ...k.on.map(toHira), ...k.kun.map(x => x.replace("-", "")), ...k.kun.map(x => x.split("-")[0])].join(" ");
    return hay.includes(q) || hay.includes(hq);
  }

  function drawList(app) {
    const listEl = app.querySelector("#k-list");
    if (!listEl) return;
    const rec = st.get("kanji");
    const q = ui.q;
    const items = allKanji().filter(k => {
      if (ui.level !== "all" && k.lv !== ui.level) return false;
      const r = rec[k.char] || {};
      if (ui.filter === "seen" && !r.seen) return false;
      if (ui.filter === "unseen" && r.seen) return false;
      if (ui.filter === "fav" && !r.fav) return false;
      return matches(k, q);
    }).sort((a, b) => sortKey(a).localeCompare(sortKey(b), "ko") || a.char.localeCompare(b.char));
    const groups = new Map(INDEX.map(c => [c, []]));
    items.forEach(k => groups.get(choOf(k)).push(k));
    app.querySelector("#k-count").textContent = items.length + "자";
    app.querySelector("#k-index").innerHTML = INDEX.map(c => {
      const n = groups.get(c).length;
      return '<button type="button" class="k-ix" data-kix="' + c + '"' + (n ? "" : " disabled") + ' aria-label="' + c + " (" + n + '자)">' + c + "</button>";
    }).join("");
    const row = k => {
      const r = rec[k.char] || {};
      const reading = [...k.on, ...k.kun.map(x => x.replace("-", ""))].slice(0, 4).join("・");
      return '<li><button type="button" class="k-row' + (r.seen ? " seen" : "") + '" data-kanji="' + esc(k.char) + '">' +
        '<span class="kr-char" lang="ja">' + esc(k.char) + "</span>" +
        '<span class="kr-ko">' + (k.ko && k.ko.eum ? (k.ko.hun ? esc(k.ko.hun) + " " : "") + "<b>" + esc(k.ko.eum) + "</b>" : '<span class="hint">일본에서 만든 한자</span>') + "</span>" +
        '<span class="kr-read" lang="ja">' + esc(reading) + "</span>" +
        '<span class="kr-meta">' + (ui.level === "all" ? '<span class="kr-lv">' + k.lv + "</span>" : "") + (r.fav ? '<span class="kr-fav" aria-label="즐겨찾기">★</span>' : "") + (r.seen ? '<span class="kr-seen" aria-label="살펴봄">✓</span>' : "") + "</span>" +
        "</button></li>";
    };
    listEl.innerHTML = items.length
      ? INDEX.filter(c => groups.get(c).length).map(c =>
          '<section class="k-group"><h3 class="k-ghead" data-kgroup="' + c + '">' + c + ' <small class="hint">' + groups.get(c).length + "자</small></h3>" +
          '<ul class="k-rows">' + groups.get(c).map(row).join("") + "</ul></section>").join("")
      : '<p class="empty">조건에 맞는 한자가 없어요.</p>';
  }

  function renderQuiz(box) {
    box.innerHTML =
      '<div class="toolbar">' + [["mix", "섞어서"], ...KQ_TYPES].map(([k, l]) =>
        '<button type="button" class="chip" data-kqt="' + k + '" aria-pressed="' + (ui.qtype === k) + '">' + l + "</button>").join("") +
        '<button type="button" class="link-btn" id="kq-new">새 문제</button></div>' +
      '<p class="hint">' + roomLv + " 한자 " + roomKanjiList(roomId).length + "자로 만든 <b>자체 제작 연습 문제</b>예요. 틀린 문제는 오답 노트와 '오답 복습'에 모여요. 획순 문제는 KanjiVG 획순 데이터를 써요.</p>" +
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

  return { id, label: "한자", jp: "漢字", needs: ["kanji", roomId === "n1" ? "kanjiN1" : "kanjiN3", roomId === "n1" ? "n1vocab" : "n3vocab", "sources", ...(roomId === "n1" ? ["exN1V", "exN1G"] : ["exN3V", "exN3G"])], render };
}
