// N1 방 · 오답 노트 (화면은 notesBoard.js를 N3 방과 함께 쓴다)
import { DB } from "../data.js";
import { AREAS } from "../util.js";
import { store } from "../store.js";
import { createNotesView } from "../notesBoard.js";
import { openPassage } from "./reading.js";
import { openListening } from "./listening.js";

const parentItem = n => (n.area === "reading" ? DB.reading.passages.find(p => p.id === n.q.passageId)
  : n.area === "listening" ? DB.listening.items.find(it => it.id === n.q.itemId) : null);

export default createNotesView({
  id: "notes", st: store, areas: AREAS,
  emptyText: "아직 틀린 문제가 없어요. 단어·문법·독해·청해에서 문제를 풀면 틀린 문제가 여기에 모여요.",
  parentOf: n => { const p = parentItem(n); return p ? { title: p.title, link: n.area === "reading" ? "지문 열기" : "음성 다시 듣기" } : null; },
  openParent: n => { const p = parentItem(n); if (p) (n.area === "reading" ? openPassage : openListening)(p.id); },
});
