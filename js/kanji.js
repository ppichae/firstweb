// 한자 상세 학습: 단어 속 한자 버튼, 한자 상세 창(패널), 단어 읽기를 한자별로 나누기
// 자료: data/kanji/common.json (한자별 상세), n1.json · n3.json (방마다 고른 한자 목록)
// 기록: 방마다 저장소의 "kanji" (한자 → { seen: 처음 본 날, fav })
import { DB, EXTRA } from "./data.js";
import { store, n3store } from "./store.js";
import { esc, today } from "./util.js";
import { mountStrokePlayer, stopStrokes } from "./strokes.js";

const STORES = { n1: store, n3: n3store };
export const isKanji = c => /[一-鿿㐀-䶿々]/.test(c);
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

export function kanjiInfo(ch) {
  const d = EXTRA.kanji;
  return d && d.items ? d.items.find(k => k.char === ch) || null : null;
}

/* ---------- 단어 읽기를 한자별로 나누기 ----------
   한자 자료에 있는 음독·훈독(탁음·촉음으로 바뀐 형태 포함)으로 단어 읽기를 처음부터 끝까지 맞춰 본다.
   자료가 없는 한자가 있거나, 맞추는 방법이 둘 이상이면 나누지 않는다(추측하지 않음). */
const VOICED = { か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご", さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ", た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど", は: "ばぱ", ひ: "びぴ", ふ: "ぶぷ", へ: "べぺ", ほ: "ぼぽ" };
function candidates(info) {
  const base = [...info.on.map(toHira), ...info.kun.map(k => k.split("-")[0]), ...info.kun.map(k => k.replace("-", ""))];
  const out = new Set();
  base.filter(Boolean).forEach(r => {
    out.add(r);
    [...(VOICED[r[0]] || "")].forEach(v => out.add(v + r.slice(1)));
    if (r.length > 1 && /[くつちき]$/.test(r)) out.add(r.slice(0, -1) + "っ");
  });
  return [...out];
}

export function splitReading(word, reading) {
  if (!word || !reading) return null;
  const chars = [...word], target = toHira(reading);
  const results = [];
  const rec = (i, pos, acc) => {
    if (results.length > 3) return;
    if (i === chars.length) { if (pos === target.length) results.push(acc); return; }
    const c = chars[i];
    if (!isKanji(c)) { const h = toHira(c); if (target.startsWith(h, pos)) rec(i + 1, pos + h.length, [...acc, [c, h]]); return; }
    const info = kanjiInfo(c);
    if (!info) return;
    candidates(info).forEach(r => { if (target.startsWith(r, pos)) rec(i + 1, pos + r.length, [...acc, [c, r]]); });
  };
  rec(0, 0, []);
  if (!results.length) return null;
  const key = JSON.stringify(results[0]);
  return results.every(r => JSON.stringify(r) === key) ? results[0] : null;
}

/* ---------- 단어 속 한자 버튼 ---------- */
export function kanjiRowHTML(word, reading) {
  const ks = [...new Set([...(word || "")].filter(c => isKanji(c) && c !== "々"))];
  if (!ks.length) return "";
  return '<div class="kanji-row"><span class="kr-label">한자</span>' + ks.map(c =>
    '<button type="button" class="kj' + (kanjiInfo(c) ? "" : " no-data") + '" data-kanji="' + esc(c) + '" data-w="' + esc(word) + '" data-r="' + esc(reading || "") + '" lang="ja" aria-label="' + esc(c) + ' 한자 자세히 보기">' + esc(c) + "</button>").join("") + "</div>";
}

// 클릭이 한자 버튼이면 상세 창을 열고 true를 돌려준다 (각 화면의 클릭 처리 맨 앞에서 부른다)
export function handleKanjiClick(e, roomId) {
  const b = e.target.closest("[data-kanji]");
  if (!b) return false;
  openKanji(b.dataset.kanji, { roomId, word: b.dataset.w || "", reading: b.dataset.r || "" });
  return true;
}

/* ---------- 이 방 자료에서 찾기 ---------- */
function roomWords(roomId) {
  if (roomId === "n1") {
    const core = (DB.vocab && DB.vocab.items) || [];
    const extra = (EXTRA.n1vocab && EXTRA.n1vocab.items) || [];
    const seen = new Set(core.map(v => v.word));
    return [...core, ...extra.filter(v => !seen.has(v.word))];
  }
  return (EXTRA.n3vocab && EXTRA.n3vocab.items) || [];
}
export const wordsWith = (ch, roomId) => roomWords(roomId).filter(v => (v.word || "").includes(ch));

function examplesWith(ch, roomId) {
  if (roomId !== "n1") return [];
  const out = [];
  [...((DB.vocab && DB.vocab.items) || []), ...((DB.grammar && DB.grammar.items) || [])].forEach(it =>
    (it.examples || []).forEach(x => { if (x.ja.includes(ch) && out.length < 3) out.push(x); }));
  return out;
}

export function roomKanjiList(roomId) {
  const d = EXTRA[roomId === "n1" ? "kanjiN1" : "kanjiN3"];
  return (d && d.kanji) || [];
}

/* ---------- 상세 창 ---------- */
let dialog = null;
let current = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "kanji-dialog";
  dialog.setAttribute("aria-label", "한자 상세");
  document.body.appendChild(dialog);
  dialog.addEventListener("click", e => {
    if (e.target === dialog || e.target.closest("[data-close]")) { dialog.close(); return; }
    const go = e.target.closest("[data-goto-kanji]");
    if (go) { openKanji(go.dataset.gotoKanji, { roomId: current.roomId }); return; }
    const fav = e.target.closest("[data-kfav]");
    if (fav) {
      STORES[current.roomId].update("kanji", k => { const r = k[current.ch] || (k[current.ch] = {}); r.fav = !r.fav; });
      draw();
      window.dispatchEvent(new CustomEvent("kanji-changed"));
    }
  });
  dialog.addEventListener("close", () => { stopStrokes(); window.dispatchEvent(new CustomEvent("kanji-changed")); });
  return dialog;
}

export function openKanji(ch, ctx) {
  current = Object.assign({ ch }, ctx);
  STORES[ctx.roomId].update("kanji", k => { const r = k[ch] || (k[ch] = {}); if (!r.seen) r.seen = today(); r.last = today(); });
  ensureDialog();
  draw();
  if (!dialog.open) { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", ""); }
  dialog.scrollTop = 0;
}

const kunHTML = k => { const [stem, okuri] = k.split("-"); return esc(stem) + (okuri ? '<span class="okuri">' + esc(okuri) + "</span>" : ""); };
const chips = (list, cls) => list.length ? list.map(x => '<span class="rd ' + cls + '" lang="ja">' + x + "</span>").join("") : '<span class="hint">없음</span>';
const linkChips = list => list.map(c => '<button type="button" class="kj' + (kanjiInfo(c) ? "" : " no-data") + '" data-goto-kanji="' + esc(c) + '" lang="ja">' + esc(c) + "</button>").join("");

function draw() {
  const { ch, roomId, word, reading } = current;
  const info = kanjiInfo(ch);
  const rec = STORES[roomId].get("kanji")[ch] || {};
  const words = wordsWith(ch, roomId);
  const split = word ? splitReading(word, reading) : null;
  const inWord = split ? split.find(p => p[0] === ch) : null;
  const sameRad = info ? ((EXTRA.kanji && EXTRA.kanji.items) || []).filter(k => k.char !== ch && k.radical && info.radical && k.radical.char === info.radical.char).map(k => k.char) : [];
  const exs = examplesWith(ch, roomId);
  const roomLabel = roomId === "n1" ? "N1" : "N3";

  const head =
    '<div class="kd-head"><div class="kd-char" lang="ja">' + esc(ch) + "</div>" +
      '<div class="kd-title">' +
        (info
          ? '<div class="kd-ko">' + (info.ko ? esc(info.ko.hun) + " <b>" + esc(info.ko.eum) + "</b>" : "한국 한자음 없음") + "</div>" +
            '<div class="kd-mean">' + esc(info.meaning) + "</div>" +
            '<span class="badges"><span class="badge ai">AI 작성</span><span class="badge warn">검수 필요</span></span>'
          : '<div class="kd-ko">상세 정보 준비 중</div><p class="hint">아직 상세 자료가 없는 한자예요. 이 방 단어 목록에서 쓰인 단어만 보여 드려요.</p>') +
      "</div>" +
      '<div class="kd-actions"><button type="button" class="mark star" data-kfav aria-pressed="' + !!rec.fav + '" aria-label="즐겨찾기">' + (rec.fav ? "★" : "☆") + "</button>" +
      '<button type="button" class="btn ghost sm" data-close>닫기</button></div>' +
    "</div>";

  const wordBox = word
    ? '<div class="kd-word"><span class="hint">누른 단어</span> <b lang="ja">' + esc(word) + "</b>" + (reading ? ' <span lang="ja">(' + esc(reading) + ")</span>" : "") +
      (inWord ? '<div>이 단어에서 <b lang="ja">' + esc(ch) + "</b>의 읽기: <b class=\"rd-in\" lang=\"ja\">" + esc(inWord[1]) + "</b> <small class=\"hint\">(음독·훈독 자료로 자동으로 맞춘 결과)</small></div>"
        : '<div class="hint">한자별 읽기는 단어 속 모든 한자의 자료가 있고 한 가지로만 맞춰질 때 보여 드려요.</div>') + "</div>"
    : "";

  const body = info
    ? '<section class="kd-sec"><h4>읽기</h4><dl class="kd-dl">' +
        "<div><dt>음독 (音読み)</dt><dd>" + chips(info.on.map(esc), "on") + "</dd></div>" +
        "<div><dt>훈독 (訓読み)</dt><dd>" + chips(info.kun.map(kunHTML), "kun") + "</dd></div></dl>" +
        '<p class="hint">일본 상용한자표에 있는 읽기만 적었어요. 회색 글자는 오쿠리가나(한자 뒤에 붙는 가나)예요.</p>' +
        (info.note ? '<p class="kd-note">' + esc(info.note) + "</p>" : "") + "</section>" +
      '<section class="kd-sec"><h4>모양</h4><dl class="kd-dl">' +
        '<div><dt>부수</dt><dd><span lang="ja">' + esc(info.radical.char) + "</span> " + esc(info.radical.name) + (info.radical.note ? '<br><small class="hint">' + esc(info.radical.note) + "</small>" : "") + "</dd></div>" +
        "<div><dt>총 획수</dt><dd>" + info.strokes + "획 <small class=\"hint\">(일본식" + (info.strokesCheck ? " · KanjiVG 획순 데이터와 일치" : "") + ")</small></dd></div>" +
        "<div><dt>구성 요소</dt><dd>" + (info.components.length ? info.components.map(c => '<span class="comp"><b lang="ja">' + esc(c.part) + "</b> " + esc(c.meaning) + "</span>").join("") : '<span class="hint">확인 필요</span>') + "</dd></div>" +
        "<div><dt>형성 원리</dt><dd>" + (info.formation ? esc(info.formation) : '<span class="hint">확인 필요</span>') + "</dd></div></dl></section>" +
      '<section class="kd-sec"><h4>어원과 연상</h4>' +
        '<div class="kd-box origin"><div class="kd-box-label">어원 설명 <span class="badge warn">검수 필요</span></div>' +
          (info.origin ? "<p>" + esc(info.origin) + "</p>" : '<p class="hint">확실한 자료를 확인하지 못해서 비워 두었어요.</p>') + "</div>" +
        (info.mnemonic
          ? '<div class="kd-box story"><div class="kd-box-label">학습용 창작 이야기 <span class="badge ai">실제 어원 아님</span></div><p>' + esc(info.mnemonic) + "</p></div>"
          : "") +
      "</section>"
    : "";

  const related =
    '<section class="kd-sec"><h4>' + roomLabel + " 단어 목록에서 이 한자가 쓰인 단어 <small class=\"hint\">" + words.length + "개</small></h4>" +
      (words.length
        ? '<ul class="kd-words">' + words.slice(0, 12).map(v => '<li><b lang="ja">' + esc(v.word) + '</b> <span lang="ja">' + esc(v.reading || "") + "</span> <span class=\"hint\">" + esc(v.meaning) + "</span></li>").join("") + "</ul>" +
          (words.length > 12 ? '<p class="hint">나머지 ' + (words.length - 12) + "개는 단어 화면에서 이 한자로 검색해 보세요.</p>" : "")
        : '<p class="hint">이 방 단어 목록에는 이 한자가 쓰인 단어가 없어요.</p>') +
    "</section>" +
    '<section class="kd-sec"><h4>예문</h4>' +
      (exs.length ? '<ul class="kd-ex">' + exs.map(x => '<li><span class="jp block" lang="ja">' + esc(x.ja) + '</span><span class="ko">' + esc(x.ko) + "</span></li>").join("") + "</ul>"
        : '<p class="hint">예문 준비 중이에요.</p>') +
    "</section>";

  const links = info
    ? '<section class="kd-sec"><h4>함께 보면 좋은 한자</h4><dl class="kd-dl">' +
        "<div><dt>비슷한 모양</dt><dd>" + (info.similar.length ? linkChips(info.similar) : '<span class="hint">없음</span>') + "</dd></div>" +
        "<div><dt>같은 부수 (자료에 있는 한자)</dt><dd>" + (sameRad.length ? linkChips(sameRad) : '<span class="hint">없음</span>') + "</dd></div></dl></section>"
    : "";

  const foot =

    '<p class="kd-foot">학습 수준: ' + roomLabel + " 단어 목록 " + words.length + "개 단어에 나와요. JLPT는 공식 한자 급수 목록을 공개하지 않아요." +
      (info ? "<br>자료: AI 작성 · 검수 필요 · 획순 참조값 KanjiVG " + esc(info.strokeRef) : "") + "</p>";

  const strokes = '<section class="kd-sec"><h4>획순</h4><div id="kd-strokes">' + (info ? "" : '<p class="hint">획순 데이터 준비 중이에요.</p>') + "</div></section>";
  stopStrokes();
  dialog.innerHTML = '<div class="kd">' + head + wordBox + strokes + body + related + links + foot + "</div>";
  if (info) mountStrokePlayer(dialog.querySelector("#kd-strokes"), info.strokeRef);
}
