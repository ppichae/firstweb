// 자체 제작 예문: data/examples/*.json (단어·문형 id로 연결)
// ja는 한자마다 {한자|읽기}로 읽기를 붙인 원문이다. 화면에서는 한자 위에 작은 읽기(루비)로 보여 준다.
import { EXTRA } from "./data.js";
import { esc } from "./util.js";
import { sayBtn } from "./speech.js";

// 방·종류별 예문 파일 키 (data.js의 EXTRA_FILES와 같은 이름)
export const EXAMPLE_KEYS = { n3vocab: "exN3V", n3grammar: "exN3G", n1vocab: "exN1V", n1grammar: "exN1G" };

let index = null, indexed = "";
function build() {
  const keys = Object.values(EXAMPLE_KEYS).filter(k => EXTRA[k]);
  const sig = keys.map(k => k + (EXTRA[k].items || []).length).join("|");
  if (index && sig === indexed) return index;
  index = new Map();
  keys.forEach(k => (EXTRA[k].items || []).forEach(e => {
    if (!index.has(e.target)) index.set(e.target, []);
    index.get(e.target).push(e);
  }));
  indexed = sig;
  return index;
}

export const examplesFor = id => build().get(id) || [];
export const plainOf = ja => ja.replace(/\{([^|}]+)\|([^}]+)\}/g, "$1");

// {漢字|かんじ} → <ruby>漢字<rt>かんじ</rt></ruby> (그 밖의 글자는 안전하게 바꿔 넣는다)
export function rubyHTML(ja) {
  let out = "", last = 0;
  const re = /\{([^|}]+)\|([^}]+)\}/g;
  let m;
  while ((m = re.exec(ja))) {
    out += esc(ja.slice(last, m.index)) + "<ruby>" + esc(m[1]) + "<rt>" + esc(m[2]) + "</rt></ruby>";
    last = m.index + m[0].length;
  }
  return out + esc(ja.slice(last));
}

// 지문 한 문단: 후리가나({漢字|よみ}), 밑줄([[…]]: 문제에서 가리키는 부분), 줄바꿈
export function jpText(s) {
  return String(s || "").split(/(\[\[[^\]]*\]\])/).map(part =>
    /^\[\[.*\]\]$/.test(part) ? '<u class="ul-mark">' + rubyHTML(part.slice(2, -2)) + "</u>" : rubyHTML(part)).join("").replace(/\n/g, "<br>");
}

/* ---------- 후리가나 보이기·숨기기 (이 기기에 기억, 모든 화면에 함께 적용) ---------- */
const FURI_KEY = "jlpt:hideFuri";
const furiHidden = () => { try { return localStorage.getItem(FURI_KEY) === "1"; } catch (e) { return false; } };
export function furiToggleHTML() {
  const off = furiHidden();
  return '<button type="button" class="chip furi-toggle" data-furi-toggle aria-pressed="' + !off + '">' + (off ? "후리가나 보이기" : "후리가나 숨기기") + "</button>";
}
export function installFuriToggle() {
  document.documentElement.classList.toggle("hide-furi", furiHidden());
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-furi-toggle]");
    if (!b) return;
    const off = !furiHidden();
    try { localStorage.setItem(FURI_KEY, off ? "1" : "0"); } catch (err) { /* 이번 화면에만 적용 */ }
    document.documentElement.classList.toggle("hide-furi", off);
    document.querySelectorAll("[data-furi-toggle]").forEach(x => { x.setAttribute("aria-pressed", String(!off)); x.textContent = off ? "후리가나 보이기" : "후리가나 숨기기"; });
  });
}

// 예문 한 개를 보여 주는 HTML. full이면 쓰임 설명까지
// 후리가나가 문장 위에 있으므로 히라가나만 적은 같은 문장(reading)은 따로 보여 주지 않는다
export function exampleHTML(e, full) {
  return '<div class="ex-own"><span class="jp ex-ja" lang="ja">' + rubyHTML(e.ja) + "</span>" + sayBtn(e.ja, "예문 듣기") +
    '<span class="ko">' + esc(e.ko) + "</span>" +
    (full && e.note ? '<span class="ex-note">' + esc(e.note) + "</span>" : "") + "</div>";
}

// 이 글자(한자)가 들어 있는 자체 제작 예문 (한자 창에서 쓴다)
export function examplesWithChar(ch, keys) {
  const out = [];
  keys.forEach(k => ((EXTRA[k] && EXTRA[k].items) || []).forEach(e => { if (out.length < 3 && plainOf(e.ja).includes(ch)) out.push(e); }));
  return out;
}
