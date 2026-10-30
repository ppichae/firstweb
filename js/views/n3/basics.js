// N3 방 · 기초 과정(N5·N4): 가나 표 · 가나 퀴즈 · 핵심 단원(개념 → 예문 → 짧은 퀴즈)
import { EXTRA } from "../../data.js";
import { n3store } from "../../store.js";
import { esc, shuffle, today } from "../../util.js";
import { mountQuestion } from "../../quiz.js";
import { getJaVoices, stopAll } from "../../speech.js";
import { award } from "./game.js";

const ui = { mode: "units", unit: null, table: "basic", script: "hira", quizScript: "hira", quizSize: 10 };
let voiceMsg = "";

// 히라가나를 가타카나로 바꾼다 (유니코드에서 두 글자표는 0x60만큼 떨어져 있다)
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const kanaOf = cell => (ui.script === "kata" ? toKata(cell[0]) : cell[0]);

export const unitDone = id => !!(n3store.get("basics")[id] || {}).done;

function render(app) {
  const data = EXTRA.n3basics;
  if (!data) {
    app.innerHTML = '<section class="panel"><h2>기초 과정</h2><p class="notice">콘텐츠 준비 중이에요. 기초 과정 자료 파일을 불러오지 못했어요.</p></section>';
    return;
  }
  if (ui.unit && !data.units.some(u => u.id === ui.unit)) ui.unit = null;
  const done = data.units.filter(u => unitDone(u.id)).length;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>기초 과정 <span class="jp" lang="ja">N5·N4</span></h2>' +
        "<p>가나부터 기본 문장, 동사·형용사 활용까지 N3 공부에 꼭 필요한 바탕을 빠르게 훑어요.</p></div>" +
        '<div class="toolbar"><div class="progress">단원 <strong>' + done + "</strong> / " + data.units.length + " 완료</div>" +
        '<div class="bar" aria-hidden="true"><span style="width:' + (done / data.units.length * 100) + '%"></span></div></div></div>' +
      '<p class="notice"><b>자체 제작 학습 자료</b> · AI가 새로 쓴 설명과 연습 문제예요. 공식 JLPT 자료가 아니고, 아직 <b>검수 필요</b> 상태예요.</p>' +
      '<div class="segmented" role="tablist" aria-label="기초 과정">' +
        seg("units", "핵심 단원") + seg("kana", "가나 표") + seg("kanaquiz", "가나 퀴즈") + seg("pending", "단어·한자") +
      "</div>" +
      '<div id="mode" class="stack"></div>' +
    "</section>";
  app.onclick = e => {
    const s = e.target.closest("[data-mode]");
    if (s) { ui.mode = s.dataset.mode; ui.unit = null; stopAll(); render(app); }
  };
  const el = app.querySelector("#mode");
  ({ units: ui.unit ? renderUnit : renderUnits, kana: renderKana, kanaquiz: renderKanaQuiz, pending: renderPending })[ui.mode](el, app, data);
}

function seg(key, label) {
  return '<button type="button" role="tab" class="seg" data-mode="' + key + '" aria-selected="' + (ui.mode === key) + '">' + label + "</button>";
}

/* ---------- 단원 목록 ---------- */
function renderUnits(el, app, data) {
  el.innerHTML = '<ol class="units">' + data.units.map((u, i) => {
    const rec = n3store.get("basics")[u.id] || {};
    return '<li><button type="button" class="unit' + (rec.done ? " is-done" : "") + '" data-unit="' + u.id + '">' +
      '<span class="unit-no">' + (i + 1) + "</span>" +
      '<span class="unit-body"><span class="unit-title">' + esc(u.title) + ' <span class="jp" lang="ja">' + esc(u.jp) + "</span></span>" +
        '<span class="unit-goal">' + esc(u.goal) + "</span></span>" +
      '<span class="unit-state">' + (rec.done ? "완료 · " + rec.best + "/" + u.quiz.length : "추천 " + u.week + "주차") + "</span>" +
    "</button></li>";
  }).join("") + "</ol>";
  el.onclick = e => {
    const b = e.target.closest("[data-unit]");
    if (b) { ui.unit = b.dataset.unit; render(app); window.scrollTo(0, 0); }
  };
}

/* ---------- 단원 하나: 개념 → 예문 → 퀴즈 ---------- */
function renderUnit(el, app, data) {
  const idx = data.units.findIndex(u => u.id === ui.unit);
  const u = data.units[idx];
  const next = data.units[idx + 1];
  el.innerHTML =
    '<div class="toolbar unit-nav"><button type="button" class="link-btn" id="back">← 단원 목록</button><span class="progress">단원 <strong>' + (idx + 1) + '</strong> / ' + data.units.length + '</span></div>' +
    '<article class="card-box">' +
      '<div class="q-top"><h3>' + (idx + 1) + ". " + esc(u.title) + "</h3>" +
        '<span class="badges"><span class="badge ai">자체 제작 · AI 작성</span><span class="badge warn">검수 필요</span></span></div>' +
      '<p class="hint">목표: ' + esc(u.goal) + "</p>" +
      '<h4 class="step">① 개념</h4><ul class="points">' + u.points.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul>" +
      '<h4 class="step">② 예문</h4><ul class="examples">' + u.examples.map((x, i) =>
        '<li><button type="button" class="say" data-say="' + i + '" aria-label="듣기">▶</button>' +
        '<span><span class="jp block" lang="ja">' + esc(x.ja) + '</span><span class="ko">' + esc(x.ko) + "</span></span></li>").join("") + "</ul>" +
      '<p class="p-state" id="voice-msg" role="status">' + esc(voiceMsg) + "</p>" +
    "</article>" +
    '<h4 class="step">③ 확인 퀴즈 <span class="score" id="u-score"></span></h4>' +
    '<div class="quiz" id="u-quiz"></div>' +
    '<div id="u-next"></div>';

  const results = new Map();
  const quiz = el.querySelector("#u-quiz");
  u.quiz.forEach((q, i) => {
    const box = document.createElement("div");
    quiz.appendChild(box);
    const full = Object.assign({ id: "n3-basic-" + u.id + "-" + i, area: "basics", generated: true, kind: u.title, source: { type: "ai" }, review: "needs-review" }, q);
    mountQuestion(box, full, {
      label: "확인 " + (i + 1), store: n3store, wide: true,
      onAnswer: ok => {
        results.set(i, ok);
        award(ok ? "correct" : "wrong");
        const right = [...results.values()].filter(Boolean).length;
        el.querySelector("#u-score").textContent = right + " / " + u.quiz.length;
        if (results.size === u.quiz.length) finish(right);
      },
    });
  });

  function finish(right) {
    const first = !unitDone(u.id);
    n3store.update("basics", b => {
      const r = b[u.id] || {};
      b[u.id] = { done: r.done || today(), best: Math.max(r.best || 0, right) };
    });
    if (first) award("unit");
    const wrong = [...results.entries()].filter(([, ok]) => !ok).map(([i]) => i);
    const allDone = data.units.every(x => unitDone(x.id));
    el.querySelector("#u-next").innerHTML =
      '<article class="card-box unit-result" role="status">' +
        "<h3>결과 · " + right + " / " + u.quiz.length + " 정답" + (first ? " <small class=\"xp\">경험치 +30</small>" : "") + "</h3>" +
        '<p class="hint">' + (wrong.length ? "틀린 문제 " + wrong.length + "개의 정답과 해설은 위 문제 아래에 펼쳐져 있어요." : "모두 맞혔어요. 해설은 각 문제 아래에서 다시 볼 수 있어요.") + "</p>" +
        (next
          ? '<p>다음 단원: <b>' + (idx + 2) + ". " + esc(next.title) + "</b></p>"
          : "<p><b>" + (allDone ? "기초 과정의 모든 단원을 마쳤어요! " : "마지막 단원이에요. ") + "</b>" +
            (allDone ? "이제 N3 단어와 문법으로 넘어가 보세요." : "아직 끝내지 않은 단원은 단원 목록에서 확인할 수 있어요.") + "</p>") +
        '<div class="toolbar">' +
          (next ? '<button type="button" class="btn" data-unit="' + next.id + '">다음 단원으로 이동 →</button>'
            : allDone ? '<a class="btn" href="#n3/vocab">N3 단어로 가기 →</a>' : "") +
          (wrong.length ? '<button type="button" class="btn ghost" id="see-wrong">틀린 문제 다시 보기</button>' : "") +
          '<button type="button" class="btn ghost" id="again">이 단원 다시 풀기</button>' +
          '<button type="button" class="link-btn" id="back2">단원 목록</button>' +
        "</div></article>";
    el.dataset.firstWrong = wrong.length ? wrong[0] : "";
  }

  el.onclick = async e => {
    if (e.target.closest("#back") || e.target.closest("#back2")) { ui.unit = null; stopAll(); render(app); window.scrollTo(0, 0); return; }
    if (e.target.closest("#see-wrong")) { const q = quiz.children[Number(el.dataset.firstWrong)]; if (q) q.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    if (e.target.closest("#again")) { render(app); const qz = app.querySelector("#u-quiz"); if (qz) qz.scrollIntoView({ block: "start" }); return; }
    const n = e.target.closest("[data-unit]");
    if (n) { ui.unit = n.dataset.unit; stopAll(); render(app); window.scrollTo(0, 0); return; }
    const s = e.target.closest("[data-say]");
    if (s) speak(u.examples[Number(s.dataset.say)].ja, el.querySelector("#voice-msg"));
  };
}

/* ---------- 듣기 (기기에 일본어 음성이 있을 때만) ---------- */
async function speak(text, msgEl) {
  const voices = await getJaVoices();
  if (!voices.length) {
    voiceMsg = "음성 준비 필요: 이 기기에서 일본어 음성을 찾지 못했어요.";
    if (msgEl) msgEl.textContent = voiceMsg;
    return;
  }
  stopAll();
  const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ""));
  u.lang = "ja-JP"; u.voice = voices[0]; u.rate = 0.9;
  u.onerror = ev => { if (msgEl && ev.error !== "interrupted" && ev.error !== "canceled") msgEl.textContent = "음성을 재생하지 못했어요 (" + ev.error + ")"; };
  window.speechSynthesis.speak(u);
}

/* ---------- 가나 표 ---------- */
function renderKana(el, app, data) {
  const tables = [["basic", "기본 글자"], ["dakuon", "탁음 · 반탁음"], ["yoon", "요음"]];
  const rows = data.kana[ui.table];
  el.innerHTML =
    '<div class="toolbar">' +
      [["hira", "히라가나"], ["kata", "가타카나"]].map(([k, l]) =>
        '<button type="button" class="chip" data-script="' + k + '" aria-pressed="' + (ui.script === k) + '">' + l + "</button>").join("") +
      '<span class="sep" aria-hidden="true"></span>' +
      tables.map(([k, l]) => '<button type="button" class="chip" data-table="' + k + '" aria-pressed="' + (ui.table === k) + '">' + l + "</button>").join("") +
    "</div>" +
    '<p class="hint">글자를 누르면 소리를 들을 수 있어요(기기에 일본어 음성이 있을 때). 한글 표기는 대략적인 소리예요.</p>' +
    '<p class="p-state" id="voice-msg" role="status"></p>' +
    '<div class="kana-grid cols-' + rows[0].length + '">' + rows.map(r => r.map(c => c
      ? '<button type="button" class="kana" data-kana="' + esc(kanaOf(c)) + '"><span class="k" lang="ja">' + esc(kanaOf(c)) + '</span><span class="r">' + esc(c[1]) + " · " + esc(c[2]) + "</span></button>"
      : '<span class="kana empty" aria-hidden="true"></span>').join("")).join("") +
    "</div>";
  el.onclick = e => {
    const sc = e.target.closest("[data-script]"), tb = e.target.closest("[data-table]"), k = e.target.closest("[data-kana]");
    if (sc) { ui.script = sc.dataset.script; renderKana(el, app, data); }
    else if (tb) { ui.table = tb.dataset.table; renderKana(el, app, data); }
    else if (k) speak(k.dataset.kana, el.querySelector("#voice-msg"));
  };
}

/* ---------- 가나 퀴즈: 글자를 보고 소리(로마자) 고르기 ---------- */
function allKana(data) {
  const cells = [];
  ["basic", "dakuon", "yoon"].forEach(t => data.kana[t].forEach(r => r.forEach(c => { if (c) cells.push(c); })));
  return cells;
}

function renderKanaQuiz(el, app, data) {
  const stats = n3store.get("kana");
  const cells = allKana(data);
  const weak = cells.filter(c => { const s = stats[c[0]]; return !!s && s.wrong > s.right; });
  el.innerHTML =
    '<div class="toolbar">' +
      [["hira", "히라가나"], ["kata", "가타카나"], ["mix", "섞어서"]].map(([k, l]) =>
        '<button type="button" class="chip" data-qs="' + k + '" aria-pressed="' + (ui.quizScript === k) + '">' + l + "</button>").join("") +
      '<span class="score" id="k-score"></span><button type="button" class="link-btn" id="k-new">새 문제</button>' +
    "</div>" +
    '<p class="hint">무작위 10글자를 보고 소리를 골라요. 틀린 글자는 다음 문제에 더 자주 나와요.' + (weak.length ? " (자주 틀린 글자 " + weak.length + "개)" : "") + "</p>" +
    '<div class="quiz" id="k-quiz"></div>';

  const start = () => {
    const pickScript = () => ui.quizScript === "mix" ? (Math.random() < 0.5 ? "hira" : "kata") : ui.quizScript;
    const pool = [...shuffle(weak).slice(0, 4), ...shuffle(cells)];
    const chosen = [];
    pool.forEach(c => { if (chosen.length < ui.quizSize && !chosen.includes(c)) chosen.push(c); });
    const quiz = el.querySelector("#k-quiz");
    const score = el.querySelector("#k-score");
    const results = new Map();
    quiz.innerHTML = ""; score.textContent = "";
    shuffle(chosen).forEach((c, i) => {
      const script = pickScript();
      const shown = script === "kata" ? toKata(c[0]) : c[0];
      const others = [];
      shuffle(cells).forEach(o => { if (others.length < 3 && o[1] !== c[1] && !others.some(x => x[1] === o[1])) others.push(o); });
      const opts = shuffle([c, ...others]);
      const q = {
        id: "n3-kana-" + script + "-" + c[0], area: "basics", generated: true, kind: "가나 읽기",
        prompt: shown, options: opts.map(o => o[1]), answer: opts.indexOf(c),
        explanation: "「" + shown + "」는 " + c[1] + "(" + c[2] + ")로 읽어요.", source: { type: "ai" }, review: "needs-review",
      };
      const box = document.createElement("div");
      box.className = "kana-q";
      quiz.appendChild(box);
      mountQuestion(box, q, {
        label: "가나 " + (i + 1), store: n3store,
        onAnswer: ok => {
          n3store.update("kana", k => { const r = k[c[0]] || (k[c[0]] = { right: 0, wrong: 0 }); ok ? r.right++ : r.wrong++; });
          award(ok ? "kana" : "wrong");
          results.set(i, ok);
          score.textContent = [...results.values()].filter(Boolean).length + " / " + chosen.length + " 정답";
        },
      });
    });
  };
  el.onclick = e => {
    const t = e.target.closest("[data-qs]");
    if (t) { ui.quizScript = t.dataset.qs; renderKanaQuiz(el, app, data); }
    else if (e.target.closest("#k-new")) start();
  };
  start();
}

/* ---------- 아직 자료가 없는 영역 ---------- */
function renderPending(el, app, data) {
  el.innerHTML = '<div class="pending-list">' + (data.pending || []).map(p =>
    '<article class="card-box pending"><h3>' + esc(p.title) + '</h3><p class="hint">' + esc(p.note) + "</p></article>").join("") + "</div>";
}

export default { id: "n3/basics", label: "기초", jp: "基礎", needs: ["n3basics"], render, leave: stopAll };
