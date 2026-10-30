// PDF 목록 단어·문형 도우미: 출처·검수 표시, 품사 이름, 4지선다 문제 만들기
// 단어·문법 화면(study.js)과 N3 시험 대비 화면(n3/practice.js)이 함께 쓴다.
import { sourceById } from "../data.js";
import { esc, shuffle } from "../util.js";

export const LIST_POS = {
  noun: "명사", "noun-suru": "명사 · する동사", verb: "동사", "i-adj": "い형용사", "na-adj": "な형용사",
  adverb: "부사", phrase: "표현", taru: "~と / ~とした", prefix: "접두어", suffix: "접미어", adnominal: "연체사",
};
const STATUS = { VERIFIED: "검수 완료", AI_GENERATED: "AI 작성", NEEDS_REVIEW: "검수 필요", SOURCE_PENDING: "출처 확인 필요" };
const hasKanji = s => /[一-鿿々]/.test(s);

// 단어는 word, 문형은 pattern에 표기가 들어 있다
const head = it => it.word || it.pattern;

// 출처·검수 표시: 어떤 PDF 목록에 있었는지, 뜻은 누가 썼는지, 검수했는지
export function listBadges(it) {
  const out = [];
  const ids = [...new Set((it.sources || []).map(s => s.id))];
  ids.forEach(id => {
    const s = sourceById(id);
    const secs = it.sources.filter(x => x.id === id).map(x => x.section).join(", ");
    const name = s ? s.publisher.split(" (")[0] + " " + s.level : id;
    out.push('<span class="badge" title="' + esc((s ? s.title : id) + " — " + secs) + '">목록: ' + esc(name) + "</span>");
  });
  if (it.meaningOrigin === "AI_GENERATED") out.push('<span class="badge ai">뜻: AI 작성</span>');
  if (it.status !== "VERIFIED") out.push('<span class="badge warn">' + esc(STATUS[it.status] || it.status) + "</span>");
  else out.push('<span class="badge ok">검수 완료</span>');
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
    options: opts.map(o => o[field]),
    answer: opts.indexOf(v),
    explanation: "「" + head(v) + "」" + (v.reading && v.reading !== head(v) ? "(" + v.reading + ")" : "") + "은 '" + v.meaning + "'라는 뜻이에요. (뜻은 AI가 작성했고 검수 전이에요)",
    wrongReasons: opts.map(o => o === v ? ""
      : type === "reverse" ? "「" + o[field] + "」는 '" + o.meaning + "'라는 뜻이에요."
      : "「" + o[field] + "」는 「" + head(o) + "」의 " + (field === "meaning" ? "뜻" : "읽기") + "예요."),
    source: { type: "ai" }, review: "needs-review",
  };
}
