// N3 방 · 오답 노트: N3 방에서 틀린 문제만 모은다 (N1 오답 노트와 따로 저장, 화면은 notesBoard.js를 함께 쓴다)
import { n3store } from "../../store.js";
import { createNotesView } from "../../notesBoard.js";
import { award } from "./game.js";

export default createNotesView({
  id: "n3/notes", st: n3store,
  areas: { basics: "기초", vocab: "단어", grammar: "문법", kanji: "한자", reading: "독해", listening: "청해" },
  emptyText: "아직 틀린 문제가 없어요. 기초 단원, 어휘·문형 퀴즈, 시험 대비에서 틀린 문제가 여기에 모여요.",
  award: (ok, qid) => award(ok ? "correct" : "wrong", qid),
});
