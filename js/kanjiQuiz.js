// 한자 퀴즈와 오답 복습 (N1·N3 공통, 기록은 방마다 따로)
// 문제는 data/kanji의 한자 자료와 이 방 단어 목록으로 자동으로 만든 자체 제작 연습 문제다.
// 풀이 기록: 방 저장소 "attempts"(area: "kanji") + "kanji"[한자].quiz { right, wrong, last }
import { store, n3store } from "./store.js";
import { esc, shuffle, today, pct } from "./util.js";
import { mountQuestion } from "./quiz.js";
import { kanjiInfo, roomKanjiList, wordsWith, splitReading, examplesWith } from "./kanji.js";
import { runQuiz } from "./quizRunner.js";
import { exampleHTML } from "./examples.js";
import { loadStrokes } from "./strokes.js";
import { award } from "./game.js";

const STORES = { n1: store, n3: n3store };
export const KQ_TYPES = [
  ["meaning", "한자 → 뜻"], ["reverse", "뜻 → 한자"], ["onkun", "음독·훈독"], ["inword", "단어 속 읽기"], ["radical", "부수"], ["order", "획순"],
];
const label = t => (KQ_TYPES.find(x => x[0] === t) || [t, t])[1];
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const kunText = k => { const [a, b] = k.split("-"); return b ? a + "(" + b + ")" : a; };
const koText = i => i.ko.hun + " " + i.ko.eum;
const hasKo = i => !!(i.ko && i.ko.hun);   // 뜻(훈)까지 있는 한자만 뜻 문제로 낸다

function infos(roomId) { return roomKanjiList(roomId).map(kanjiInfo).filter(Boolean); }
function pickOthers(list, n, key, exclude) {
  const out = [];
  shuffle(list).forEach(x => { const v = key(x); if (out.length < n && v && !exclude.includes(v) && !out.includes(v)) out.push(v); });
  return out;
}
function choice(correct, others, extra = {}) {
  const opts = shuffle([correct, ...others]);
  return Object.assign({ options: opts, answer: opts.indexOf(correct) }, extra);
}

// 문제 하나 만들기 (만들 수 없으면 null)
function build(roomId, type, info, all) {
  const base = { area: "kanji", generated: true, kind: "한자 · " + label(type), source: { type: "ai" }, review: "needs-review", wordId: info.char };
  if (type === "meaning") {
    if (!hasKo(info)) return null;
    const o = pickOthers(all.filter(hasKo), 3, koText, [koText(info)]);
    return o.length < 3 ? null : Object.assign(base, { id: "kq-meaning-" + info.char, prompt: "「" + info.char + "」의 한국 한자음과 뜻은?" },
      choice(koText(info), o, { explanation: "「" + info.char + "」는 '" + koText(info) + "'이에요." + (info.meaning ? " 일본어에서는 주로 '" + info.meaning + "'라는 뜻으로 써요." : "") }));
  }
  if (type === "reverse") {
    if (!hasKo(info)) return null;
    const o = pickOthers(all.filter(x => hasKo(x) && koText(x) !== koText(info)), 3, x => x.char, [info.char]);
    return o.length < 3 ? null : Object.assign(base, { id: "kq-reverse-" + info.char, prompt: "'" + koText(info) + "'에 맞는 한자는?" },
      choice(info.char, o, { explanation: "'" + koText(info) + "'은 「" + info.char + "」예요." }));
  }
  if (type === "onkun") {
    const both = [...info.on.map(r => ["on", r]), ...info.kun.map(r => ["kun", r])];
    if (!both.length) return null;
    const [kind, r] = both[Math.floor(Math.random() * both.length)];
    const shown = kind === "on" ? r : kunText(r);
    return Object.assign(base, { id: "kq-onkun-" + info.char + "-" + r, prompt: "「" + info.char + "」의 읽기 「" + shown + "」는 음독일까요, 훈독일까요?" },
      choice(kind === "on" ? "음독 (音読み)" : "훈독 (訓読み)", [kind === "on" ? "훈독 (訓読み)" : "음독 (音読み)"],
        { explanation: "「" + shown + "」는 " + (kind === "on" ? "음독(중국에서 온 읽기)이에요. 음독은 가타카나로 적었어요." : "훈독(일본 고유어 읽기)이에요. 괄호 안은 오쿠리가나예요.") + " 음독: " + (info.on.join("・") || "없음") + " / 훈독: " + (info.kun.map(kunText).join("・") || "없음") }));
  }
  if (type === "inword") {
    const words = shuffle(wordsWith(info.char, roomId)).map(v => ({ v, s: splitReading(v.word, v.reading) })).filter(x => x.s && x.v.word !== info.char);
    if (!words.length) return null;
    const { v, s } = words[0];
    const correct = s.find(p => p[0] === info.char)[1];
    const pool = all.flatMap(x => [...x.on.map(toHira), ...x.kun.map(k => k.split("-")[0])]).filter(r => r && r !== correct);
    const o = pickOthers(pool.map(r => ({ r })), 3, x => x.r, [correct]);
    return o.length < 3 ? null : Object.assign(base, { id: "kq-inword-" + info.char + "-" + v.word, prompt: "「" + v.word + "」(" + v.meaning + ")에서 「" + info.char + "」의 읽기는?" },
      choice(correct, o, { explanation: "「" + v.word + "」는 " + v.reading + "로 읽고, 「" + info.char + "」 부분은 「" + correct + "」예요." }));
  }
  if (type === "radical") {
    if (!info.radical) return null;   // 부수 자료가 있는 한자만
    const t = r => r.char + " (" + r.name + ")";
    const o = pickOthers(all.filter(x => x.radical && x.radical.char !== info.radical.char), 3, x => t(x.radical), [t(info.radical)]);
    return o.length < 3 ? null : Object.assign(base, { id: "kq-radical-" + info.char, prompt: "「" + info.char + "」의 부수는?" },
      choice(t(info.radical), o, { explanation: "「" + info.char + "」의 부수는 " + t(info.radical) + "이에요." + (info.radical.note ? " " + info.radical.note : "") }));
  }
  return null;
}

function recordKanji(roomId, ch, ok) {
  STORES[roomId].update("kanji", k => {
    const r = k[ch] || (k[ch] = {});
    const q = r.quiz || (r.quiz = { right: 0, wrong: 0 });
    ok ? q.right++ : q.wrong++;
    q.last = today();
  });
  if (roomId === "n3") award("n3", ok ? "correct" : "wrong", "kq:" + ch);   // N1은 문제 기록 때 자동으로 경험치를 준다
}

// 획순 문제: 앞의 획을 그려 두고, 다음 획을 그림 보기 4개 중에서 고른다
async function mountOrderQ(el, roomId, info, n) {
  const data = await loadStrokes(info.strokeRef);
  if (!data || data.strokes.length < 3) { el.innerHTML = '<p class="hint">이 한자는 획순 문제를 만들 수 없어서 넘어가요.</p>'; if (el._onAnswer) el._onAnswer(true); return; }
  const total = data.strokes.length;
  const k = 1 + Math.floor(Math.random() * (total - 1));           // 0부터 센 정답 획 번호 (1번째 획은 너무 쉬워서 뺀다)
  const later = data.strokes.map((_, i) => i).filter(i => i > k);
  const earlier = data.strokes.map((_, i) => i).filter(i => i < k);
  const cand = shuffle([k, ...shuffle(later).slice(0, 3)]);
  while (cand.length < 3 && earlier.length) cand.push(earlier.splice(Math.floor(Math.random() * earlier.length), 1)[0]);
  const opts = shuffle(cand);
  const letters = ["가", "나", "다", "라"];
  const svg = (hi, size) => '<svg class="kq-svg" viewBox="0 0 109 109" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<rect x="1" y="1" width="107" height="107" rx="6" class="kq-bg"/>' +
    data.strokes.map((d, i) => '<path d="' + esc(d) + '" class="' + (i === hi ? "kq-hi" : i < k ? "kq-done" : "kq-rest") + '"/>').join("") + "</svg>";
  const q = {
    id: "kq-order-" + info.char + "-" + (k + 1), area: "kanji", generated: true, kind: "한자 · 획순", wordId: info.char,
    prompt: "「" + info.char + "」에서 " + k + "번째 획 다음(" + (k + 1) + "번째)에 쓰는 획은?",
    options: opts.map((s, i) => "그림 " + letters[i] + " (" + (s + 1) + "번째 획)"), answer: opts.indexOf(k),
    explanation: "「" + info.char + "」의 " + (k + 1) + "번째 획은 그림 " + letters[opts.indexOf(k)] + "예요. 전체 " + total + "획 (획순: KanjiVG)", source: { type: "ai" }, review: "needs-review",
  };
  el.className = "q";
  el.innerHTML = '<div class="q-top"><span class="q-num">한자 ' + n + ' · 획순</span><span class="badges"><span class="badge">획순 KanjiVG</span></span></div>' +
    '<div class="q-text">「<span lang="ja">' + esc(info.char) + "</span>」에서 지금까지 쓴 " + k + "획 다음에 쓰는 획은? <small class=\"hint\">(빨간 획을 보세요)</small></div>" +
    '<div class="kq-now">' + svg(-1, 96) + "</div>" +
    '<div class="kq-opts">' + opts.map((s, i) => '<button type="button" class="opt kq-opt" data-ko="' + i + '"><span class="n">' + letters[i] + "</span>" + svg(s, 84) + "</button>").join("") + "</div><div class=\"kq-fb\"></div>";
  el.onclick = e => {
    const b = e.target.closest("[data-ko]");
    if (!b || el.dataset.done) return;
    el.dataset.done = "1";
    const pick = Number(b.dataset.ko), ok = pick === q.answer;
    STORES[roomId].recordAttempt(q, pick, "practice");
    recordKanji(roomId, info.char, ok);
    el.querySelectorAll("[data-ko]").forEach((x, i) => { x.disabled = true; if (i === q.answer) x.classList.add("correct"); else if (i === pick) x.classList.add("wrong"); });
    el.querySelector(".kq-fb").innerHTML = '<div class="fb"><div class="fb-verdict ' + (ok ? "good" : "bad") + '">' + (ok ? "정답이에요" : "오답이에요 · 오답 노트에 저장했어요") + "</div><p>" + esc(q.explanation) + "</p></div>" + kanjiExtra(info, roomId);
    if (el._onAnswer) el._onAnswer(ok);
  };
}

// 답한 뒤 보여 주는 한자 학습 정보: 한국 한자음·뜻, 음독·훈독, 이 방의 대표 단어(읽기·뜻), 예문, 연상 이야기
export function kanjiExtra(info, roomId) {
  const words = wordsWith(info.char, roomId);
  // 단어 속 이 한자의 읽기까지 맞출 수 있는 단어를 먼저 보여 준다
  const withSplit = words.map(v => ({ v, s: splitReading(v.word, v.reading) })).sort((a, b) => (b.s ? 1 : 0) - (a.s ? 1 : 0)).slice(0, 2);
  const ex = examplesWith(info.char, roomId)[0];
  return '<div class="learn-box"><div class="lb-title">학습 정보</div>' +
    '<div class="lb-word"><b class="lb-kanji" lang="ja">' + esc(info.char) + "</b> " +
      (info.ko && info.ko.eum ? '<span class="lb-mean">' + (info.ko.hun ? esc(info.ko.hun) + " " : "") + "<b>" + esc(info.ko.eum) + "</b></span>" : "") +
      (info.meaning ? ' <small class="hint">' + esc(info.meaning) + "</small>" : "") + "</div>" +
    '<div class="lb-row"><span class="lb-label">음독</span><span lang="ja">' + (info.on.join("・") || "—") + "</span></div>" +
    '<div class="lb-row"><span class="lb-label">훈독</span><span lang="ja">' + (info.kun.map(k => { const [a, b] = k.split("-"); return esc(a) + (b ? '<span class="okuri">' + esc(b) + "</span>" : ""); }).join("・") || "—") + "</span></div>" +
    withSplit.map(({ v, s }) => '<div class="lb-row"><span class="lb-label">대표 단어</span><span><b lang="ja">' + esc(v.word) + '</b> <span class="reading" lang="ja">' + esc(v.reading) + "</span> " + esc(v.meaning) +
      (s ? ' <small class="hint">(' + esc(info.char) + " = " + esc(s.find(p => p[0] === info.char)[1]) + ")</small>" : "") + "</span></div>").join("") +
    (ex ? '<div class="lb-ex">' + (ex.own ? exampleHTML(ex.own, true) : '<span class="jp" lang="ja">' + esc(ex.ja) + '</span><span class="ko">' + esc(ex.ko) + "</span>") + "</div>" : "") +
    (info.mnemonic ? '<div class="lb-row lb-story"><span class="lb-label">연상 이야기</span><span>' + esc(info.mnemonic) + "</span></div>" : "") +
    "</div>";
}

// 퀴즈 10문제를 한 문제씩 푼다. pool: 출제할 한자(없으면 이 방 한자 전체)
export function runKanjiQuiz(box, roomId, type, pool, onDone) {
  const all = infos(roomId);
  const src = (pool && pool.length ? pool : all);
  const items = [];
  shuffle(src).forEach(info => {
    if (items.length >= 10) return;
    const t = type === "mix" ? KQ_TYPES[Math.floor(Math.random() * KQ_TYPES.length)][0] : type;
    if (t === "order") {
      items.push({ custom: (holder, done) => { holder._onAnswer = ok => done(ok); mountOrderQ(holder, roomId, info, items.indexOf(it) + 1); }, info });
      const it = items[items.length - 1];
      return;
    }
    const q = build(roomId, t, info, all);
    if (q) items.push({ q, info, wide: q.options.some(o => o.length > 10), extra: () => kanjiExtra(info, roomId) });
  });
  runQuiz(box, items, {
    store: STORES[roomId], label: "한자", empty: "이 조건으로 만들 수 있는 문제가 없어요. 다른 유형을 골라 보세요.",
    onRestart: () => runKanjiQuiz(box, roomId, type, pool, onDone), restartLabel: "새 문제 10개",
    onAnswer: (it, ok) => { if (!it.custom) recordKanji(roomId, it.info.char, ok); },
  });
}

// 유형별 정답률과 약한 한자
export function kanjiStats(roomId) {
  const st = STORES[roomId];
  const byType = {};
  (st.get("attempts") || []).filter(a => a.area === "kanji").forEach(a => {
    const t = (a.qid.match(/^kq-([a-z]+)-/) || [])[1];
    if (!t) return;
    const b = byType[t] || (byType[t] = { total: 0, correct: 0 });
    b.total++; if (a.correct) b.correct++;
  });
  const rec = st.get("kanji") || {};
  const weak = Object.entries(rec).filter(([, r]) => r.quiz && r.quiz.wrong > 0 && r.quiz.wrong >= r.quiz.right).map(([c, r]) => ({ c, ...r.quiz }));
  return { types: KQ_TYPES.map(([t, l]) => ({ t, l, ...(byType[t] || { total: 0, correct: 0 }), rate: byType[t] ? pct(byType[t].correct, byType[t].total) : null })), weak };
}
