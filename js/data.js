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
