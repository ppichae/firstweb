// N3 방 · 학습 로드맵: N5 → N4 → N3 순서로 단계별 목표와 진행률, 지금 기록에 맞는 추천을 보여 준다
// 진행률은 모두 이 방의 실제 기록으로 계산한다. 자료가 아직 없는 영역은 목록에 넣지 않는다.
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc, pct } from "../../util.js";
import { readyTracks } from "../../tracks.js";
import { studyWeekOf } from "../../summary.js";
import { noteEntries } from "../../stats.js";
import { roomKanjiList } from "../../kanji.js";
import { unitDone, openBasics } from "./basics.js";
import { scriptProgress } from "./kana.js";
import { n3vocab, n3grammar } from "./study.js";

const DONE_AT = 0.8;   // 한 단계의 80%를 하면 다음 단계를 추천한다

// 한 항목: [이름, 한 일, 전체, 이동(함수 이름), 설명]
function stages() {
  const b = EXTRA.n3basics;
  const units = ids => [ids.filter(unitDone).length, ids.length];
  const kana = s => { const p = b ? scriptProgress(b, s) : { done: 0, total: 0 }; return [p.done, p.total]; };
  const kanji = roomKanjiList("n3");
  const seen = kanji.filter(c => (n3store.get("kanji")[c] || {}).seen).length;
  const answered = area => new Set(n3store.get("attempts").filter(a => a.area === area && a.mode !== "test").map(a => a.qid)).size;
  const qCount = list => list.reduce((n, x) => n + ((x.questions || []).length), 0);
  const rTotal = EXTRA.n3reading ? qCount(EXTRA.n3reading.passages || []) : 0;
  const lTotal = EXTRA.n3listening ? qCount(EXTRA.n3listening.items || []) : 0;
  const tests = (n3store.get("tests") || []).length;
  const S = {
    "jlpt-n5": {
      title: "N5 입문", goal: "문자를 읽고 쓰고, 기본 문장(です·ます)을 만들 수 있어요.",
      items: [
        ["히라가나 46자", ...kana("hira"), "basics:hira", "퀴즈로 익힌 글자 수"],
        ["가타카나 46자", ...kana("kata"), "basics:kata", "퀴즈로 익힌 글자 수"],
        ["핵심 단원 1~6", ...units(["b09", "b02", "b03", "b04", "b05", "b06"]), "basics:units", "인사 · です · 조사 · こそあど · 형용사 · ます형"],
      ],
    },
    "jlpt-n4": {
      title: "N4 기초", goal: "동사 활용과 자주 쓰는 문형으로 일상 문장을 이어 말할 수 있어요.",
      items: [
        ["발음 규칙 (히라가나·가타카나)", ...units(["b01", "k01"]), "basics:hira", "탁음·요음·촉음·장음"],
        ["핵심 단원 7~8", ...units(["b07", "b08"]), "basics:units", "て형·た형·ない형 · N4 핵심 문형"],
      ],
    },
    "jlpt-n3": {
      title: "N3 실전", goal: "N3 단어·문법·한자를 익히고, 독해·청해와 모의고사로 시험에 대비해요.",
      items: [
        ["단어", n3vocab.studiedCount(), n3vocab.total(), "n3/vocab:cards", "학습한 단어 (외웠어요·퀴즈 정답·카드 알았어요)"],
        ["문법", n3grammar.studiedCount(), n3grammar.total(), "#n3/grammar", "'공부했어요'를 누른 문형"],
        ["한자", seen, kanji.length, "#n3/kanji", "살펴본 한자"],
        ["독해", Math.min(answered("reading"), rTotal), rTotal, "#n3/reading", "한 번 이상 푼 문제"],
        ["청해", Math.min(answered("listening"), lTotal), lTotal, "#n3/listening", "한 번 이상 푼 문제"],
        ["모의고사", Math.min(tests, 1), 1, "#n3/mock", "시간 제한 모의고사 1회 이상"],
      ],
    },
  };
  return readyTracks("n3").filter(t => S[t.id]).map(t => {
    const s = S[t.id];
    const items = s.items.filter(i => i[2] > 0).map(([name, done, total, go, desc]) => ({ name, done, total, go, desc, ratio: Math.min(1, done / total) }));
    const ratio = items.length ? items.reduce((n, i) => n + i.ratio, 0) / items.length : 0;
    return { id: t.id, label: t.label, title: s.title, goal: s.goal, items, ratio };
  });
}

// 기록에 맞는 추천: 이전 단계 보완 → 지금 단계에서 가장 덜 한 항목 → 오답 복습
function recommend(list) {
  const out = [];
  const basicsTries = n3store.get("attempts").filter(a => a.area === "basics");
  const basicsRate = basicsTries.length >= 5 ? pct(basicsTries.filter(a => a.correct).length, basicsTries.length) : null;
  const cur = list.find(s => s.ratio < DONE_AT) || list[list.length - 1];
  const curIdx = list.indexOf(cur);
  if (curIdx > 0 && basicsRate !== null && basicsRate < 70) out.push({ text: "기초 확인 문제 정답률이 " + basicsRate + "%예요. N5·N4 핵심 단원을 한 번 더 복습해 보세요.", go: "basics:units" });
  const weakest = cur.items.filter(i => i.ratio < 1).sort((a, b) => a.ratio - b.ratio)[0];
  if (weakest) out.push({ text: cur.title + " 단계의 '" + weakest.name + "'부터 해 보세요 (" + weakest.done + " / " + weakest.total + ").", go: weakest.go });
  const notes = noteEntries(n3store).filter(n => !n.resolved).length;
  if (notes) out.push({ text: "다시 풀 오답이 " + notes + "개 있어요. 틀린 문제를 다시 풀면 이전 내용이 단단해져요.", go: "#n3/notes" });
  return { cur, out };
}

function render(app) {
  const list = stages();
  const { cur, out } = recommend(list);
  const w = studyWeekOf(n3store);
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>학습 로드맵</h2></div></div>' +
      '<article class="card-box roadmap-now"><h3>지금 추천</h3>' +
        '<p class="hint">' + (w ? "N3 학습 " + w.week + "주차 · " : "") + "지금 단계: <b>" + esc(cur.title) + "</b> (" + Math.round(cur.ratio * 100) + "%)</p>" +
        (out.length ? '<ul class="rec-list">' + out.map(r => '<li><span>' + esc(r.text) + '</span> <button type="button" class="btn ghost sm" data-go="' + esc(r.go) + '">하러 가기</button></li>').join("") + "</ul>"
          : '<p class="hint">이 단계의 항목을 모두 마쳤어요. 모의고사로 실력을 점검해 보세요.</p>') +
      "</article>" +
      '<ol class="roadmap">' + list.map(s =>
        '<li class="road-stage' + (s === cur ? " now" : s.ratio >= DONE_AT ? " done" : "") + '">' +
          '<div class="q-top"><h3><span class="badge">' + esc(s.label) + "</span> " + esc(s.title) + "</h3><b>" + Math.round(s.ratio * 100) + "%</b></div>" +
          '<p class="hint">목표: ' + esc(s.goal) + "</p>" +
          '<div class="meters">' + s.items.map(i =>
            '<div class="meter"><span class="meter-name">' + esc(i.name) + '</span><span class="meter-track" aria-hidden="true"><span style="width:' + Math.round(i.ratio * 100) + '%"></span></span>' +
            '<span class="meter-val">' + i.done + " / " + i.total + "</span>" +
            '<button type="button" class="link-btn" data-go="' + esc(i.go) + '" aria-label="' + esc(i.name + " 하러 가기") + '">하러 가기</button></div>').join("") + "</div>" +
        "</li>").join("") + "</ol>" +
      '<p class="hint">급수(N5·N4·N3)는 JLPT 시험 단계이고, 레벨(Lv)은 이 공부방에서 쌓은 공부량이에요. 레벨이 높다고 급수가 오르는 것은 아니에요.</p>' +
    "</section>";
  app.onclick = e => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    const to = b.dataset.go;
    if (to.startsWith("basics:")) openBasics(to.split(":")[1]);
    else if (to.startsWith("n3/vocab:")) n3vocab.openMode(to.split(":")[1]);
    else location.hash = to.replace(/^#/, "");
  };
}

export default { id: "n3/roadmap", label: "로드맵", jp: "道筋", needs: ["n3basics", "n3vocab", "n3grammar", "n3reading", "n3listening", "kanji", "kanjiN3"], render };
