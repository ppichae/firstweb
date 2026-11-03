// 학습 배지 (N1·N3 같은 구조, 조건과 기록은 방마다 따로)
// 배지는 실제 기록으로 조건을 확인했을 때만 준다. 처음 받은 날은 그 방 저장소의 "badges"에 남긴다.
// 아직 자료가 없어서 받을 수 없는 배지는 '자료 준비 중'으로 표시한다.
import { store, n3store } from "./store.js";
import { EXTRA, QUESTIONS } from "./data.js";
import { today, esc, fmtDate } from "./util.js";
import { levelOf, levelInfo, MAX_LV, STAGES, XP_TEXT } from "./game.js";
import { noteEntries } from "./stats.js";
import { streakOf, summaryOf } from "./summary.js";
import { vocabStudied } from "./views/vocab.js";
import { grammarStudied as n1GrammarStudied } from "./views/grammar.js";
import { n3vocab, n3grammar } from "./views/n3/study.js";
import { unitDone, coreUnits } from "./views/n3/basics.js";
import { scriptProgress } from "./views/n3/kana.js";

const ROOM = { n1: store, n3: n3store };
export const CATS = [["level", "레벨"], ["stage", "학습 단계"], ["study", "단어·문법·한자"], ["skill", "독해·청해"], ["habit", "오답 복습·꾸준함"], ["special", "특별 목표"]];

function facts(roomId) {
  const st = ROOM[roomId];
  const attempts = st.get("attempts") || [];
  const kanjiRec = st.get("kanji") || {};
  return {
    lv: levelOf(roomId).lv,
    attempts: attempts.length,
    right: attempts.filter(a => a.correct).length,
    words: roomId === "n1" ? vocabStudied() : n3vocab.studiedCount(),
    grammar: roomId === "n1" ? n1GrammarStudied() : n3grammar.studiedCount(),
    kanjiSeen: Object.values(kanjiRec).filter(k => k.seen).length,
    kanjiWritten: Object.values(kanjiRec).reduce((n, k) => n + (k.written || 0), 0),
    kanjiRight: attempts.filter(a => a.area === "kanji" && a.correct).length,
    resolved: noteEntries(st).filter(n => n.resolved).length,
    streak: streakOf(st),
    examSet: !!st.get("examDate"),
    goalDone: summaryOf(roomId).goalPct === 100,
    attemptsOf: area => attempts.filter(a => a.area === area),
  };
}

// [key, 분류, 이모지, 이름, 조건 설명, 받았는지(true/false/null=자료 준비 중)]
function defs(roomId) {
  const f = facts(roomId);
  const common = [
    ["lv3", "level", "⭐", "레벨 3", "레벨 3에 올랐어요", f.lv >= 3],
    ["lv5", "level", "🌟", "레벨 5", "레벨 5에 올랐어요", f.lv >= 5],
    ["lv10", "level", "👑", "레벨 10", "레벨 10에 올랐어요", f.lv >= 10],
    ["lv25", "level", "🎖️", "레벨 25", "레벨 25에 올랐어요", f.lv >= 25],
    ["lv50", "level", "🏆", "최고 레벨", "레벨 50에 올랐어요", f.lv >= 50],
    ["first", "study", "✏️", "첫 문제", "문제를 처음 풀었어요", f.attempts >= 1],
    ["w50", "study", "📗", "단어 50", "학습한 단어가 50개가 되었어요(외웠어요·퀴즈 정답·카드에서 알았어요)", f.words >= 50],
    ["w200", "study", "📚", "단어 200", "단어 200개를 공부했어요", f.words >= 200],
    ["g20", "study", "📝", "문법 20", "문법 20개에 '공부했어요'를 표시했어요", f.grammar >= 20],
    ["g100", "study", "🗒️", "문법 100", "문법 100개에 '공부했어요'를 표시했어요", f.grammar >= 100],
    ["k10", "study", "🀄", "한자 10", "한자 10자를 살펴봤어요", f.kanjiSeen >= 10],
    ["kq20", "study", "🎯", "한자 퀴즈 20", "한자 퀴즈를 20번 맞혔어요", f.kanjiRight >= 20],
    ["kw10", "study", "🖌️", "쓰기 10회", "한자를 직접 10번 써 봤어요", f.kanjiWritten >= 10],
    ["r100", "habit", "💯", "정답 100", "문제를 100번 맞혔어요", f.right >= 100],
    ["fix10", "habit", "🩹", "오답 극복 10", "틀렸던 문제 10개를 다시 맞혔어요", f.resolved >= 10],
    ["s3", "habit", "🔥", "3일 연속", "3일 연속 공부했어요", f.streak >= 3],
    ["s7", "habit", "🔥", "7일 연속", "7일 연속 공부했어요", f.streak >= 7],
    ["s14", "habit", "🏅", "14일 연속", "14일 연속 공부했어요", f.streak >= 14],
    ["exam", "special", "📅", "시험일 설정", "홈에서 내 시험일을 직접 정했어요", f.examSet],
    ["goal", "special", "🎉", "주간 목표 달성", "'함께 보기'에서 정한 이번 주 학습 시간 목표를 채웠어요", f.goalDone],
  ];
  if (roomId === "n1") {
    const passages = new Set(f.attemptsOf("reading").map(a => (QUESTIONS.get(a.qid) || {}).passageId).filter(Boolean));
    return [...common,
      ["d30", "stage", "🚀", "D-30 시작", "D-30 집중 모드를 시작했어요", !!store.get("sprint")],
      ["mock1", "stage", "🏁", "모의고사 완주", "실전 모의고사를 끝까지 풀었어요", (store.get("mocks") || []).length >= 1],
      ["read5", "skill", "📖", "독해 5지문", "독해 지문 5개의 문제를 풀었어요", passages.size >= 5],
      ["listen10", "skill", "🎧", "청해 정답 10", "청해 문제를 10번 맞혔어요", f.attemptsOf("listening").filter(a => a.correct).length >= 10],
    ];
  }
  const data = EXTRA.n3basics;
  const units = data ? coreUnits(data) : [];
  const tests = n3store.get("tests") || [];
  return [...common,
    ["hira", "stage", "あ", "히라가나 완료", "히라가나 기본 글자 46자를 모두 익혔어요", !!data && scriptProgress(data, "hira").complete],
    ["kata", "stage", "ア", "가타카나 완료", "가타카나 기본 글자 46자를 모두 익혔어요", !!data && scriptProgress(data, "kata").complete],
    ["units", "stage", "🎓", "기초 완주", "핵심 단원 8개를 모두 마쳤어요", units.length > 0 && units.every(u => unitDone(u.id))],
    ["test80", "stage", "🏁", "테스트 80점", "시간 제한 연습 테스트에서 80% 이상 맞혔어요", tests.some(t => t.correct / t.total >= 0.8)],
    ["read", "skill", "📖", "독해 첫걸음", "N3 독해 자료가 준비되면 받을 수 있어요", null],
    ["listen", "skill", "🎧", "청해 첫걸음", "N3 청해 자료가 준비되면 받을 수 있어요", null],
  ];
}

// 배지 목록을 계산하고, 새로 받은 배지는 받은 날을 저장한다
export function badgeList(roomId) {
  const st = ROOM[roomId];
  const saved = st.get("badges") || {};
  const list = defs(roomId).map(([key, cat, emoji, name, desc, got]) => ({ key, cat, emoji, name, desc, got: got === true, pending: got === null }));
  const fresh = list.filter(b => b.got && !saved[b.key]);
  if (fresh.length) st.update("badges", b => { fresh.forEach(x => { b[x.key] = today(); }); });
  // 한 번 받은 배지는 조건이 나중에 바뀌어도(예: 연속 학습이 끊겨도) 받은 것으로 남긴다
  list.forEach(b => { if (saved[b.key]) { b.got = true; b.at = saved[b.key]; } else if (b.got) b.at = today(); });
  return list;
}

// 오늘의 작은 목표 (초보자도 하루에 채울 수 있는 크기)
export function dailyGoals(roomId) {
  const st = ROOM[roomId];
  const t = today();
  const act = (st.get("activity") || {})[t] || {};
  const q = (st.get("attempts") || []).filter(a => new Date(a.at).toDateString() === new Date().toDateString()).length;
  const kanjiToday = Object.values(st.get("kanji") || {}).filter(k => k.last === t).length;
  const goals = [
    ["문제 10개 풀기", q, 10],
    ["카드 10장 복습하기", act.cards || 0, 10],
    ["한자 3자 살펴보기", kanjiToday, 3],
  ];
  if (roomId === "n3") {
    const kp = st.get("kanaProgress") || {};
    const kanaToday = ["hira", "kata"].reduce((n, s) => n + Object.values(kp[s] || {}).filter(r => r.last === t).length, 0);
    goals.unshift(["글자 퀴즈 5개 풀기", kanaToday, 5]);
  }
  return goals.map(([label, n, need]) => ({ label, n: Math.min(n, need), need, done: n >= need }));
}

// 홈에 넣는 간단한 성장 칸: 레벨·칭호, 다음 레벨, 오늘의 작은 목표, 대표 배지 3개, 전체 배지 보기
export function growthCardHTML(roomId, badgesHref) {
  const lv = levelOf(roomId);
  const list = badgeList(roomId);
  const got = list.filter(b => b.got).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const goals = dailyGoals(roomId);
  const next = goals.find(g => !g.done);
  return '<article class="card-box growth"><div class="q-top"><h3>성장</h3><a href="' + badgesHref + '">전체 배지 보기 →</a></div>' +
    '<div class="growth-row">' +
      '<div class="growth-lv"><span class="lv-emoji" aria-hidden="true">' + lv.emoji + '</span><div><div class="lv-title">Lv ' + lv.lv + " · " + esc(lv.title) + "</div>" +
        '<div class="bar wide" aria-hidden="true"><span style="width:' + (lv.max ? 100 : Math.round(lv.into / lv.need * 100)) + '%"></span></div>' +
        '<small class="hint">' + lv.xp + " XP · " + (lv.max ? "최고 레벨이에요" : "다음 레벨(" + esc(lv.nextTitle) + ")까지 " + lv.toNext + " XP") + "</small></div></div>" +
      '<div class="growth-goal"><span class="tile-label">오늘의 작은 목표</span>' +
        (next ? "<b>" + esc(next.label) + "</b> <small class=\"hint\">" + next.n + " / " + next.need + "</small>"
          : "<b>오늘 목표를 모두 채웠어요 🎉</b>") +
        '<small class="hint">' + goals.filter(g => g.done).length + " / " + goals.length + "개 달성</small></div>" +
      '<div class="growth-badges"><span class="tile-label">배지 ' + got.length + " / " + list.filter(b => !b.pending).length + "</span>" +
        '<div class="badge-row">' + (got.length ? got.slice(0, 3).map(b => '<span class="medal">' + b.emoji + " " + esc(b.name) + "</span>").join("") : '<span class="hint">아직 받은 배지가 없어요. 첫 문제를 풀어 보세요!</span>') + "</div></div>" +
    "</div></article>";
}

// 전체 배지 화면
export function createBadgesView(id, roomId, homeId) {
  return {
    id, label: "배지", hidden: true,
    needs: roomId === "n1" ? ["n1vocab", "n1grammar", "sources", "kanji"] : ["n3vocab", "n3grammar", "n3basics", "sources", "kanji"],
    render(app) {
      const lv = levelOf(roomId);
      const list = badgeList(roomId);
      const goals = dailyGoals(roomId);
      app.innerHTML =
        '<section class="panel">' +
          '<div class="panel-head"><div><h2>배지와 레벨</h2></div>' +
            '<a class="btn ghost sm" href="#' + homeId + '">홈으로</a></div>' +
          '<article class="card-box"><div class="growth-lv"><span class="lv-emoji" aria-hidden="true">' + lv.emoji + '</span><div><div class="lv-title">Lv ' + lv.lv + " · " + esc(lv.title) + "</div>" +
            '<div class="bar wide" aria-hidden="true"><span style="width:' + (lv.max ? 100 : Math.round(lv.into / lv.need * 100)) + '%"></span></div>' +
            '<small class="hint">' + lv.xp + " XP · " + (lv.max ? "최고 레벨이에요" : "다음 레벨(" + esc(lv.nextTitle) + ")까지 " + lv.toNext + " XP") + "</small></div></div>" +
            '<p class="hint">경험치는 실제 학습 활동으로만 올라요: ' + XP_TEXT + '. ' +
              (roomId === "n1" ? "N1 레벨은 고급 어휘·문법·독해·청해 심화 학습량 기준이에요." : "N3 레벨은 기초를 다지고 중급으로 들어가는 학습량 기준이에요.") + " 두 급수의 레벨 숫자는 서로 같은 실력을 뜻하지 않아요.</p>" +
            (roomId === "n1" && (store.get("game") || {}).convertedFrom ? '<p class="hint">N1 방은 예전 기록(푼 문제·카드 복습)을 처음 한 번 경험치로 바꿔 넣었어요.</p>' : "") +
          "</article>" +
          '<article class="card-box" id="lv-view">' + levelViewHTML(roomId, viewing[roomId] || lv.lv, lv) + "</article>" +
          '<article class="card-box"><h3>오늘의 작은 목표</h3><ul class="goals">' + goals.map(g =>
            '<li class="' + (g.done ? "done" : "") + '"><span>' + (g.done ? "✅ " : "⬜ ") + esc(g.label) + "</span><b>" + g.n + " / " + g.need + "</b></li>").join("") + "</ul></article>" +
          CATS.map(([c, label]) => {
            const items = list.filter(b => b.cat === c && !b.pending);   // 아직 받을 수 없는 배지(자료가 없는 영역)는 보여 주지 않는다
            if (!items.length) return "";
            return '<article class="card-box"><h3>' + label + '</h3><ul class="medals">' + items.map(b =>
              '<li class="medal-item' + (b.got ? " got" : "") + (b.pending ? " pending" : "") + '"><b>' + b.emoji + " " + esc(b.name) + "</b><small>" + esc(b.desc) + "</small>" +
              '<small class="m-state">' + (b.got ? "받은 날 " + fmtDate(b.at) : "아직 못 받음") + "</small></li>").join("") + "</ul></article>";
          }).join("") +
        "</section>";
      // 이전·다음 레벨 보기
      app.onclick = e => {
        const b = e.target.closest("[data-lvgo]");
        if (!b) return;
        viewing[roomId] = Number(b.dataset.lvgo);
        app.querySelector("#lv-view").innerHTML = levelViewHTML(roomId, viewing[roomId], levelOf(roomId));
        const f = app.querySelector('#lv-view [data-lvgo="' + b.dataset.lvgo + '"]') || app.querySelector("#lv-view [data-lvgo]");
        if (f) f.focus();
      };
    },
    leave() { viewing[roomId] = null; },
  };
}

// 레벨 전체 보기: 고른 레벨 하나의 칭호·필요 경험치와, 다섯 단계 한눈에 보기
const viewing = { n1: null, n3: null };
function levelViewHTML(roomId, n, cur) {
  const info = levelInfo(roomId, n);
  const state = n < cur.lv ? "지나온 레벨이에요" : n === cur.lv ? "지금 레벨이에요" : "앞으로 " + Math.max(0, info.from - cur.xp) + " XP 더 모으면 돼요";
  return '<div class="q-top"><h3>레벨 살펴보기</h3><span class="hint">Lv 1 ~ ' + MAX_LV + "</span></div>" +
    '<div class="lv-pick">' +
      '<button type="button" class="btn ghost sm" data-lvgo="' + (n - 1) + '"' + (n <= 1 ? " disabled" : "") + ">← 이전 레벨</button>" +
      '<div class="lv-card' + (n === cur.lv ? " now" : "") + '"><span class="lv-emoji" aria-hidden="true">' + info.emoji + "</span>" +
        '<div><div class="lv-title">Lv ' + n + " · " + esc(info.title) + '</div><small class="hint">' + info.stage + "단계 · 누적 " + info.from + " XP부터" + (info.to ? " (다음 레벨까지 " + (info.to - info.from) + " XP)" : " · 최고 레벨") + "</small>" +
        '<small class="hint lv-state">' + state + "</small></div></div>" +
      '<button type="button" class="btn ghost sm" data-lvgo="' + (n + 1) + '"' + (n >= MAX_LV ? " disabled" : "") + ">다음 레벨 →</button>" +
    "</div>" +
    '<ol class="lv-stages">' + STAGES[roomId].map(([emoji, title], i) => {
      const a = i * 10 + 1, b = i * 10 + 10;
      return '<li class="' + (cur.lv >= a && cur.lv <= b ? "now" : "") + '"><button type="button" class="link-btn" data-lvgo="' + a + '">' + emoji + " " + esc(title) + "</button><small>Lv " + a + "~" + b + " · " + levelInfo(roomId, a).from + " XP~</small></li>";
    }).join("") + "</ol>";
}
