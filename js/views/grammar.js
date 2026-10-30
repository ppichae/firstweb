// N1 문법 화면: 기본 문법(data/grammar.json) + PDF 목록 문형(data/n1/grammar.json)
// '문법 학습' · '플래시카드' · '문법 퀴즈' 탭으로 나뉜다. 화면 구조는 study.js에 있다.
import { DB } from "../data.js";
import { store } from "../store.js";
import { createGrammarView } from "./study.js";

const g = createGrammarView({ id: "grammar", roomId: "n1", st: store, core: () => DB.grammar, extraKey: "n1grammar", idPrefix: "gen" });

export const grammarStudied = g.studiedCount;
export const grammarTotal = g.total;
export default g.view;
