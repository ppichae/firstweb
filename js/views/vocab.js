// N1 단어 화면: 기본 단어장(data/vocabulary.json) + PDF 목록 단어(data/n1/vocab.json)를 한 화면에서 공부한다
// 화면 구조는 study.js에 있고, N3 방도 같은 구조를 쓴다.
import { DB } from "../data.js";
import { store } from "../store.js";
import { createVocabView } from "./study.js";

export { LIST_POS as POS } from "./listStudy.js";

const v = createVocabView({ id: "vocab", st: store, core: () => DB.vocab, extraKey: "n1vocab", idPrefix: "gen" });

export const needsReview = v.needsReview;
export const reviewWordIds = v.reviewWordIds;
export const markWordWrong = v.markWordWrong;
export const openVocabMode = v.openMode;
export const vocabStudied = v.studiedCount;
export const vocabTotal = v.total;
export default v.view;
