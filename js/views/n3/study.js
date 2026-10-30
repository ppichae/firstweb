// N3 방의 단어 · 문법 화면 (N1과 같은 화면 구조, 자료와 기록만 N3 것)
import { n3store } from "../../store.js";
import { createVocabView, createGrammarView } from "../study.js";
import { award } from "./game.js";

export const n3vocab = createVocabView({ id: "n3/vocab", roomId: "n3", st: n3store, core: null, extraKey: "n3vocab", idPrefix: "n3", onEvent: award });
export const n3grammar = createGrammarView({ id: "n3/grammar", roomId: "n3", st: n3store, core: null, extraKey: "n3grammar", idPrefix: "n3", onEvent: award });
