// 학습 자료(data 폴더의 JSON 파일)를 불러온다
// 자료를 추가할 때는 화면 코드를 고치지 않고 JSON 파일만 고치면 된다.

const FILES = {
  vocab: "data/vocabulary.json",
  grammar: "data/grammar.json",
  reading: "data/reading.json",
  listening: "data/listening.json",
};

export const DB = { vocab: null, grammar: null, reading: null, listening: null };
// 모든 문제를 id로 바로 찾기 위한 목록 (오답 노트, 대시보드, 모의고사에서 사용)
export const QUESTIONS = new Map();

export async function loadData() {
  const results = await Promise.all(Object.entries(FILES).map(async ([key, url]) => {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(url + " 파일을 찾지 못했어요 (" + res.status + ")");
    return [key, await res.json()];
  }));
  results.forEach(([key, json]) => { DB[key] = json; });
  buildIndex();
}

function add(q, area, extra) {
  QUESTIONS.set(q.id, Object.assign({ area }, q, extra));
}

function buildIndex() {
  QUESTIONS.clear();
  (DB.vocab.questions || []).forEach(q => add(q, "vocab"));
  (DB.grammar.questions || []).forEach(q => add(q, "grammar"));
  (DB.reading.passages || []).forEach(p =>
    (p.questions || []).forEach(q => add(q, "reading", { passageId: p.id })));
  (DB.listening.items || []).forEach(it =>
    (it.questions || []).forEach(q => add(q, "listening", { itemId: it.id })));
}

export const grammarById = id => (DB.grammar.items || []).find(g => g.id === id);
export const vocabById = id => (DB.vocab.items || []).find(v => v.id === id);

// 3단계: 방마다 따로 쓰는 자료. 필요한 화면을 처음 열 때 불러온다 (N1 첫 화면이 느려지지 않게)
const EXTRA_FILES = {
  sources: "data/sources.json",
  n1vocab: "data/n1/vocab.json",
  n1grammar: "data/n1/grammar.json",
  n3vocab: "data/n3/vocab.json",
  n3grammar: "data/n3/grammar.json",
  n3basics: "data/n3/basics.json",
  kanji: "data/kanji/common.json",
  kanjiIndex: "data/kanji/index.json",
  kanjiParts: "data/kanji/parts.json",
  kanjiNotes: "data/kanji/notes.json",
  kanjiN1: "data/kanji/n1.json",
  kanjiN3: "data/kanji/n3.json",
  n3reading: "data/n3/reading.json",
  n3listening: "data/n3/listening.json",
  checks: "data/review/checks.json",
  exN3V: "data/examples/n3-vocab.json",
  exN3G: "data/examples/n3-grammar.json",
  exN1V: "data/examples/n1-vocab.json",
  exN1G: "data/examples/n1-grammar.json",
};
export const EXTRA = {};
const pending = {};

// 파일이 없거나 읽지 못해도 사이트 전체를 멈추지 않는다. 그 영역만 '준비 중'으로 보여 준다
export function ensureExtra(keys) {
  // 한자 자료(kanji)를 쓰는 화면은 987자 기본 자료(kanjiIndex)와 모양 부품(kanjiParts)도 함께 쓴다
  keys = keys.flatMap(k => (k === "kanji" ? ["kanji", "kanjiIndex", "kanjiParts", "kanjiNotes"] : [k]));
  return Promise.all(keys.map(key => {
    if (!pending[key]) {
      pending[key] = fetch(EXTRA_FILES[key], { cache: "no-cache" })
        .then(res => (res.ok ? res.json() : null))
        .catch(() => null)
        .then(json => { EXTRA[key] = json; });
    }
    return pending[key];
  }));
}

export const sourceById = id => ((EXTRA.sources && EXTRA.sources.sources) || []).find(s => s.id === id);
