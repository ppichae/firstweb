// PDF 목록 단어·문형 도우미: 출처·검수 표시, 품사 이름, 4지선다 문제 만들기
// 단어·문법 화면(study.js)과 N3 시험 대비 화면(n3/practice.js)이 함께 쓴다.
import { sourceById, EXTRA } from "../data.js";
import { esc, shuffle } from "../util.js";

export const LIST_POS = {
  noun: "명사", "noun-suru": "명사 · する동사", verb: "동사", "i-adj": "い형용사", "na-adj": "な형용사",
  adverb: "부사", phrase: "표현", taru: "~と / ~とした", prefix: "접두어", suffix: "접미어", adnominal: "연체사",
};
// 화면에 보이는 검수 상태는 세 가지뿐이다: 검수 완료 / 검수 필요 / 자료 준비 중
const STATUS = { VERIFIED: "검수 완료", AI_GENERATED: "검수 필요", NEEDS_REVIEW: "검수 필요", SOURCE_PENDING: "검수 필요" };
const hasKanji = s => /[一-鿿々]/.test(s);

// 단어는 word, 문형은 pattern에 표기가 들어 있다
const head = it => it.word || it.pattern;

// 단어 위에 읽기(후리가나)를 단다. 앞뒤의 같은 가나(送り仮名 등)는 빼고 한자 부분에만 단다. 예: 食べる/たべる → 食(た)べる
export function wordRubyHTML(word, reading) {
  if (!reading || !hasKanji(word) || word === reading) return esc(word);
  let a = 0, b = 0;
  while (a < word.length && a < reading.length && word[a] === reading[a] && !hasKanji(word[a])) a++;
  while (b < word.length - a && b < reading.length - a && word[word.length - 1 - b] === reading[reading.length - 1 - b] && !hasKanji(word[word.length - 1 - b])) b++;
  const base = word.slice(a, word.length - b), rt = reading.slice(a, reading.length - b);
  if (!base || !rt) return esc(word);
  return esc(word.slice(0, a)) + "<ruby>" + esc(base) + "<rt>" + esc(rt) + "</rt></ruby>" + esc(word.slice(word.length - b));
}

// 읽기를 사전(JMdict)과 대조해 일치한 단어인지 (data/review/checks.json)
export function readingChecked(id) {
  const c = EXTRA.checks && EXTRA.checks.vocab;
  return !!c && Object.values(c).some(g => (g.readingMatched || []).includes(id));
}
export const checkedBadge = id => (readingChecked(id) ? '<span class="badge ok" title="표기와 읽기가 JMdict 사전 항목과 일치해요">읽기 확인됨</span>' : "");

// 출처·검수 표시: 어떤 참고 목록에 있었는지, 뜻은 누가 썼는지, 검수했는지
export function listBadges(it) {
  const out = [];
  const ids = [...new Set((it.sources || []).map(s => s.id))];
  ids.forEach(id => {
    const s = sourceById(id);
    const secs = it.sources.filter(x => x.id === id).map(x => x.section).join(", ");
    const name = s ? s.publisher.split(" (")[0] + " " + s.level : id;
    out.push('<span class="badge" title="' + esc((s ? s.title : id) + " — " + secs) + '">목록: ' + esc(name) + "</span>");
  });
  // 뜻을 누가 썼는지(meaningOrigin)와 검수 상태(status)는 자료에 남기고, 화면에는 출처와 사전 대조 결과만 작게 보여 준다
  if (readingChecked(it.id)) out.push(checkedBadge(it.id));
  if (it.status === "VERIFIED") out.push('<span class="badge ok">검수 완료</span>');
  return '<span class="badges">' + out.join("") + "</span>";
}

// 목록 항목 하나로 4지선다 문제를 만든다 (시험 대비 화면에서도 쓴다)
// type: meaning(표기→뜻) · reading(표기→읽기) · reverse(뜻→표기)
export function buildQuestion(v, type, set, pool, idPrefix = "gen") {
  const field = type === "meaning" ? "meaning" : type === "reading" ? "reading" : (v.word ? "word" : "pattern");
  // 오답 보기는 같은 품사 · 비슷한 길이를 먼저 고른다 (길이만 보고 정답을 알 수 없게)
  const any = pool.filter(o => o.id !== v.id && o[field] && o[field] !== v[field] && (type !== "reading" || hasKanji(o.word)));
  const samePos = any.filter(o => !v.pos || o.pos === v.pos);
  const close = list => list.filter(o => Math.abs(o[field].length - v[field].length) <= 1);
  const picked = [];
  for (const o of [...shuffle(close(samePos)), ...shuffle(close(any)), ...shuffle(samePos), ...shuffle(any)]) {
    if (picked.length === 3) break;
    if (!picked.some(p => p[field] === o[field])) picked.push(o);
  }
  const opts = shuffle([v, ...picked]);
  const kinds = { meaning: "뜻 고르기", reading: "읽기 고르기", reverse: (set.area === "grammar" ? "문형" : "단어") + " 고르기" };
  const prompt = type === "meaning" ? "「" + head(v) + "」の意味は？"
    : type === "reading" ? "「" + v.word + "」の読み方は？"
    : "‘" + v.meaning + "’에 맞는 " + (set.area === "grammar" ? "문형" : "단어") + "는？";
  return {
    id: idPrefix + "-" + type + "-" + v.id, area: set.area, generated: true, wordId: v.id,
    kind: kinds[type], prompt,
    // 뜻 고르기: 단어에 후리가나와 발음 버튼 (읽기 고르기는 읽기가 정답이라 붙이지 않는다)
    promptHTML: type === "meaning" && v.word ? "「" + wordRubyHTML(v.word, v.reading) + "」の意味は？" : null,   // 답을 고르기 전에는 발음 버튼을 두지 않는다(답한 뒤 학습 정보에서 들을 수 있다)
    options: opts.map(o => o[field]),
    answer: opts.indexOf(v),
    explanation: "「" + head(v) + "」" + (v.reading && v.reading !== head(v) ? "(" + v.reading + ")" : "") + "은 '" + v.meaning + "'라는 뜻이에요.",
    wrongReasons: opts.map(o => o === v ? ""
      : type === "reverse" ? "「" + o[field] + "」는 '" + o.meaning + "'라는 뜻이에요."
      : "「" + o[field] + "」는 「" + head(o) + "」의 " + (field === "meaning" ? "뜻이에요." : "읽기예요.")),
    source: { type: "ai" }, review: "needs-review",
  };
}
