// N3 방 · 문자 학습: 히라가나 · 가타카나(따로 진도) · 문자 통합 학습
// 진도는 n3store의 "kanaProgress"(퀴즈)와 "kanaWritten"(쓰기)에 문자 종류별로 따로 남긴다.
import { n3store } from "../../store.js";
import { esc, shuffle, today } from "../../util.js";
import { mountQuestion } from "../../quiz.js";
import { getJaVoices, say, stopAll, VOICE_HELP } from "../../speech.js";
import { strokeRefOf } from "../../strokes.js";
import { mountWritePad } from "../../writing.js";
import { award } from "./game.js";

export const SCRIPTS = { hira: "히라가나", kata: "가타카나" };
const TABLES = [["basic", "50음도"], ["dakuon", "탁음·반탁음"], ["yoon", "요음"]];
export const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const show = (cell, script) => (script === "kata" ? toKata(cell[0]) : cell[0]);
export const sound = cell => cell[1] + " (" + cell[2] + ")";   // 예: bu (부)

let voiceMsg = "";

/* ---------- 듣기 (기기에 일본어 음성이 있을 때만) ---------- */
export async function speak(text, msgEl) {
  const voices = await getJaVoices();
  if (!voices.length) {
    voiceMsg = "이 기기에서 일본어 음성을 찾지 못했어요. " + VOICE_HELP;
    if (msgEl) msgEl.textContent = voiceMsg;
    return;
  }
  say(text);   // 고른 음성·속도로 읽는다 (speech.js)
}
export const voiceText = () => voiceMsg;

/* ---------- 진도 ---------- */
const cells = (data, table) => data.kana[table].flat().filter(Boolean);
const allCells = data => TABLES.flatMap(([t]) => cells(data, t));
const rec = (script, ch) => (n3store.get("kanaProgress")[script] || {})[ch] || { right: 0, wrong: 0 };
export const mastered = (script, ch) => { const r = rec(script, ch); return r.right >= 2 && r.right > r.wrong; };

// 기본 글자(50음도) 중 익힌 글자 수 — 문자 종류마다 따로 센다
export function scriptProgress(data, script) {
  const basic = cells(data, "basic");
  const done = basic.filter(c => mastered(script, c[0])).length;
  const written = Object.keys((n3store.get("kanaWritten")[script]) || {}).length;
  return { done, total: basic.length, written, complete: done === basic.length };
}

function record(script, ch, ok) {
  n3store.update("kanaProgress", p => {
    const s = p[script] || (p[script] = {});
    const r = s[ch] || (s[ch] = { right: 0, wrong: 0 });
    ok ? r.right++ : r.wrong++;
    r.last = today();
  });
}

/* ---------- 문자 종류 화면 (히라가나 / 가타카나) ---------- */
const SECTIONS = [["table", "50음도"], ["dakuon", "탁음·반탁음"], ["yoon", "요음"], ["rules", "촉음·장음"], ["quiz", "읽기 퀴즈"], ["write", "쓰기 연습"]];

export function renderScript(el, app, data, script, ui) {
  const p = scriptProgress(data, script);
  const sec = ui.sec[script] || "table";
  el.innerHTML =
    '<div class="kana-head"><div class="progress">' + SCRIPTS[script] + ' 기본 글자 <strong>' + p.done + "</strong> / " + p.total + " 익힘 · 쓰기 연습 " + p.written + "글자</div>" +
      '<div class="bar" aria-hidden="true"><span style="width:' + (p.done / p.total * 100) + '%"></span></div>' +
      (p.complete ? '<span class="badge ok">' + SCRIPTS[script] + " 기본 글자 완료</span>" : "") + "</div>" +
    '<p class="hint">퀴즈에서 두 번 이상 맞히고, 맞힌 횟수가 틀린 횟수보다 많으면 \'익힘\'으로 세요. ' + SCRIPTS[script] + " 진도는 " + (script === "hira" ? "가타카나" : "히라가나") + "와 따로 기록돼요.</p>" +
    '<div class="toolbar" role="tablist" aria-label="' + SCRIPTS[script] + ' 학습">' + SECTIONS.map(([k, l]) =>
      '<button type="button" class="chip" data-ksec="' + k + '" aria-pressed="' + (sec === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div id="ksec" class="stack"></div>';
  el.onclick = e => {
    const s = e.target.closest("[data-ksec]");
    if (s) { ui.sec[script] = s.dataset.ksec; stopAll(); renderScript(el, app, data, script, ui); }
  };
  const box = el.querySelector("#ksec");
  if (sec === "table" || sec === "dakuon" || sec === "yoon") renderTable(box, data, script, sec === "table" ? "basic" : sec);
  else if (sec === "rules") renderLesson(box, data, script === "hira" ? "b01" : "k01");
  else if (sec === "quiz") renderQuiz(box, data, ui, { script });
  else renderWrite(box, data, script, ui);
}

function renderTable(box, data, script, table) {
  const rows = data.kana[table];
  box.innerHTML =
    '<p class="hint">글자를 누르면 소리를 들을 수 있어요(기기에 일본어 음성이 있을 때). ' + esc(data.kanaNote || "") + "</p>" +
    '<p class="p-state" id="voice-msg" role="status"></p>' +
    '<div class="kana-grid cols-' + rows[0].length + '">' + rows.map(r => r.map(c => {
      if (!c) return '<span class="kana empty" aria-hidden="true"></span>';
      const k = show(c, script);
      return '<button type="button" class="kana' + (mastered(script, c[0]) ? " got" : "") + '" data-say="' + esc(k) + '"><span class="k" lang="ja">' + esc(k) + '</span><span class="r">' + esc(sound(c)) + "</span></button>";
    }).join("")).join("") + "</div>";
  box.onclick = e => { const k = e.target.closest("[data-say]"); if (k) speak(k.dataset.say, box.querySelector("#voice-msg")); };
}

/* ---------- 규칙 수업 (촉음·장음 등): 개념 → 예문 → 확인 퀴즈 ---------- */
function renderLesson(box, data, id) {
  const u = data.units.find(x => x.id === id);
  if (!u) { box.innerHTML = '<p class="notice">자료를 불러오지 못했어요. 새로고침해 주세요.</p>'; return; }
  const r = n3store.get("basics")[id] || {};
  box.innerHTML =
    '<article class="card-box"><div class="q-top"><h3>' + esc(u.title) + "</h3>" +
      '<span class="badges">' + (r.done ? '<span class="badge ok">완료 · ' + r.best + "/" + u.quiz.length + "</span>" : "") + '<span class="badge">학습 자료</span></span></div>' +
      '<p class="hint">목표: ' + esc(u.goal) + "</p>" +
      '<h4 class="step">① 개념</h4><ul class="points">' + u.points.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul>" +
      '<h4 class="step">② 예문</h4><ul class="examples">' + u.examples.map((x, i) =>
        '<li><button type="button" class="say" data-say="' + esc(x.ja) + '" aria-label="듣기">▶</button><span><span class="jp block" lang="ja">' + esc(x.ja) + '</span><span class="ko">' + esc(x.ko) + "</span></span></li>").join("") + "</ul>" +
      '<p class="p-state" id="voice-msg" role="status"></p></article>' +
    '<h4 class="step">③ 확인 퀴즈 <span class="score" id="l-score"></span></h4><div class="quiz" id="l-quiz"></div><div id="l-done"></div>';
  const results = new Map();
  u.quiz.forEach((q, i) => {
    const holder = document.createElement("div");
    box.querySelector("#l-quiz").appendChild(holder);
    mountQuestion(holder, Object.assign({ id: "n3-basic-" + id + "-" + i, area: "basics", generated: true, kind: u.track === "kata" ? "가타카나 규칙" : "히라가나 규칙", source: { type: "ai" }, review: "needs-review" }, q), {
      label: "확인 " + (i + 1), store: n3store, wide: true,
      onAnswer: ok => {
        results.set(i, ok); award(ok ? "correct" : "wrong");
        const right = [...results.values()].filter(Boolean).length;
        box.querySelector("#l-score").textContent = right + " / " + u.quiz.length;
        if (results.size === u.quiz.length) {
          const first = !(n3store.get("basics")[id] || {}).done;
          n3store.update("basics", b => { const o = b[id] || {}; b[id] = { done: o.done || today(), best: Math.max(o.best || 0, right) }; });
          if (first) award("unit");
          box.querySelector("#l-done").innerHTML = '<p class="toast" role="status">규칙 수업을 마쳤어요. ' + right + "/" + u.quiz.length + " 정답" + (first ? " · 경험치 +30" : "") + "</p>";
        }
      },
    });
  });
  box.onclick = e => { const k = e.target.closest("[data-say]"); if (k) speak(k.dataset.say, box.querySelector("#voice-msg")); };
}

/* ---------- 읽기 퀴즈: 글자 → 소리, 소리 → 글자 ----------
   opts.script: "hira" | "kata" | "mix"(섞어서), opts.pool: 정해진 글자 목록(오답 복습) */
function renderQuiz(box, data, ui, opts) {
  const key = opts.script;
  const q = ui.quiz[key] || (ui.quiz[key] = { range: "basic", dir: "read" });
  const ranges = opts.pool ? [] : [["basic", "50음도"], ["dakuon", "탁음·반탁음"], ["yoon", "요음"], ["all", "전체"]];
  box.innerHTML =
    (ranges.length ? '<div class="toolbar"><span class="hint">범위</span>' + ranges.map(([k, l]) => '<button type="button" class="chip" data-krange="' + k + '" aria-pressed="' + (q.range === k) + '">' + l + "</button>").join("") + "</div>" : "") +
    '<div class="toolbar"><span class="hint">방식</span>' + [["read", "글자 보고 소리 고르기"], ["write", "소리 듣고(보고) 글자 고르기"]].map(([k, l]) =>
      '<button type="button" class="chip" data-kdir="' + k + '" aria-pressed="' + (q.dir === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div class="toolbar"><span class="score" id="k-score"></span><button type="button" class="link-btn" id="k-new">새 문제</button></div>' +
    '<p class="hint">답은 \'로마자 (한국어 발음)\'으로 보여 줘요. 예: ぶ → bu (부). ' + esc(data.kanaNote || "") + "</p>" +
    '<div class="quiz" id="k-quiz"></div>';
  const pick = c => (key === "mix" ? (Math.random() < 0.5 ? "hira" : "kata") : key);
  const start = () => {
    const pool = opts.pool || (q.range === "all" ? allCells(data) : cells(data, q.range));
    const scripts = key === "mix" ? ["hira", "kata"] : [key];
    // 아직 못 익힌 글자를 먼저, 그다음 무작위
    const weak = pool.filter(c => scripts.some(s => !mastered(s, c[0])));
    const chosen = [];
    [...shuffle(weak).slice(0, 6), ...shuffle(pool)].forEach(c => { if (chosen.length < Math.min(10, pool.length) && !chosen.includes(c)) chosen.push(c); });
    const quiz = box.querySelector("#k-quiz"), score = box.querySelector("#k-score");
    const results = new Map();
    quiz.innerHTML = ""; score.textContent = "";
    shuffle(chosen).forEach((c, i) => {
      const s = opts.forceScript ? opts.forceScript(c) : pick(c);
      const others = [];
      shuffle(allCells(data)).forEach(o => { if (others.length < 3 && o[1] !== c[1] && !others.some(x => x[1] === o[1])) others.push(o); });
      const opt = shuffle([c, ...others]);
      const read = q.dir === "read";
      const item = {
        id: "n3-kana-" + s + "-" + c[0] + (read ? "" : "-w"), area: "basics", generated: true, kind: SCRIPTS[s] + (read ? " 읽기" : " 고르기"),
        prompt: read ? show(c, s) : sound(c),
        options: opt.map(o => (read ? sound(o) : show(o, s))), answer: opt.indexOf(c),
        explanation: show(c, s) + " → " + sound(c) + ". 한국어 발음은 참고용이에요.", source: { type: "ai" }, review: "needs-review",
      };
      const holder = document.createElement("div");
      holder.className = read ? "kana-q" : "";
      quiz.appendChild(holder);
      mountQuestion(holder, item, {
        label: SCRIPTS[s] + " " + (i + 1), store: n3store,
        onAnswer: ok => {
          record(s, c[0], ok); award(ok ? "kana" : "wrong");
          results.set(i, ok);
          score.textContent = [...results.values()].filter(Boolean).length + " / " + chosen.length + " 정답";
        },
      });
    });
  };
  box.onclick = e => {
    const r = e.target.closest("[data-krange]"), d = e.target.closest("[data-kdir]");
    if (r) { q.range = r.dataset.krange; renderQuiz(box, data, ui, opts); }
    else if (d) { q.dir = d.dataset.kdir; renderQuiz(box, data, ui, opts); }
    else if (e.target.closest("#k-new")) start();
  };
  start();
}

/* ---------- 쓰기 연습 ---------- */
function renderWrite(box, data, script, ui) {
  const list = [...cells(data, "basic"), ...cells(data, "dakuon")];
  const cur = ui.writeChar[script] || list[0][0];
  const written = n3store.get("kanaWritten")[script] || {};
  box.innerHTML =
    '<p class="hint">글자를 고르고 아래 칸에 직접 써 보세요. 연한 가이드와 획순(KanjiVG)을 참고할 수 있어요. 자동으로 채점하지 않는 자유 연습이에요.</p>' +
    '<div class="kana-pick">' + list.map(c => {
      const k = show(c, script);
      return '<button type="button" class="kj' + (c[0] === cur ? " on" : "") + (written[c[0]] ? " done" : "") + '" data-wchar="' + esc(c[0]) + '" lang="ja" aria-pressed="' + (c[0] === cur) + '">' + esc(k) + "</button>";
    }).join("") + "</div>" +
    '<div class="write-head"><span class="kt-char" lang="ja">' + esc(script === "kata" ? toKata(cur) : cur) + '</span><span class="hint">' + esc(sound(list.find(c => c[0] === cur))) + " · 연습 " + (written[cur] || 0) + "회</span></div>" +
    '<div id="wpad"></div>';
  box.onclick = e => {
    const w = e.target.closest("[data-wchar]");
    if (w) { ui.writeChar[script] = w.dataset.wchar; renderWrite(box, data, script, ui); }
  };
  const ch = script === "kata" ? toKata(cur) : cur;
  mountWritePad(box.querySelector("#wpad"), strokeRefOf(ch), {
    onPractice: () => {
      n3store.update("kanaWritten", w => { const s = w[script] || (w[script] = {}); s[cur] = (s[cur] || 0) + 1; });
      award("kana");
      const h = box.querySelector(".write-head .hint");
      if (h) h.textContent = sound(list.find(c => c[0] === cur)) + " · 연습 " + ((n3store.get("kanaWritten")[script] || {})[cur] || 0) + "회";
      const b = box.querySelector('[data-wchar="' + cur + '"]'); if (b) b.classList.add("done");
    },
  });
}

/* ---------- 문자 통합 학습 ---------- */
const MIX = [["compare", "구별하기"], ["which", "어느 문자일까?"], ["mixquiz", "혼합 읽기 퀴즈"], ["words", "단어 읽기"], ["confuse", "헷갈리는 문자"], ["review", "오답 복습"]];

export function renderMixed(el, app, data, ui) {
  const sec = ui.sec.mix || "compare";
  el.innerHTML =
    '<p class="hint">히라가나와 가타카나를 함께 익히는 곳이에요. 여기서 푼 문제도 각 문자 종류의 진도에 따로 기록돼요.</p>' +
    '<div class="toolbar" role="tablist" aria-label="문자 통합 학습">' + MIX.map(([k, l]) =>
      '<button type="button" class="chip" data-msec="' + k + '" aria-pressed="' + (sec === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div id="msec" class="stack"></div>';
  el.onclick = e => {
    const s = e.target.closest("[data-msec]");
    if (s) { ui.sec.mix = s.dataset.msec; stopAll(); renderMixed(el, app, data, ui); }
  };
  const box = el.querySelector("#msec");
  if (sec === "compare") {
    box.innerHTML = '<p class="p-state" id="voice-msg" role="status"></p><div class="kana-pairs">' + cells(data, "basic").map(c =>
      '<button type="button" class="kana-pair" data-say="' + esc(c[0]) + '"><span class="k" lang="ja">' + esc(c[0]) + '</span><span class="k" lang="ja">' + esc(toKata(c[0])) + '</span><span class="r">' + esc(sound(c)) + "</span></button>").join("") + "</div>" +
      '<p class="hint">왼쪽이 히라가나, 오른쪽이 가타카나예요. 소리는 같아요.</p>';
    box.onclick = e => { const k = e.target.closest("[data-say]"); if (k) speak(k.dataset.say, box.querySelector("#voice-msg")); };
  } else if (sec === "which") renderWhich(box, data);
  else if (sec === "mixquiz") renderQuiz(box, data, ui, { script: "mix" });
  else if (sec === "words") renderWords(box, data);
  else if (sec === "confuse") {
    box.innerHTML = '<div class="compare-list">' + (data.kanaConfusables || []).map(p =>
      '<article class="compare"><div class="compare-cols">' + p.chars.map(ch => {
        const base = ch.replace(/[ァ-ヶ]/g, x => String.fromCharCode(x.charCodeAt(0) - 0x60));
        const c = allCells(data).find(x => x[0] === base);
        return '<div class="compare-col"><div class="word sm" lang="ja">' + esc(ch) + '</div><div class="reading">' + esc(c ? sound(c) : "") + "</div></div>";
      }).join("") + '</div><p class="compare-point"><b>구별 포인트</b> ' + esc(p.tip) + "</p></article>").join("") + "</div>" +
      '';
  } else {
    const prog = n3store.get("kanaProgress");
    const weak = allCells(data).filter(c => ["hira", "kata"].some(s => { const r = (prog[s] || {})[c[0]]; return r && r.wrong > 0 && !mastered(s, c[0]); }));
    if (!weak.length) { box.innerHTML = '<p class="empty">아직 다시 볼 글자가 없어요. 읽기 퀴즈에서 틀린 글자가 여기에 모여요.</p>'; return; }
    box.innerHTML = '<p class="hint">틀린 적이 있고 아직 익히지 못한 글자 ' + weak.length + "개예요: " +
      weak.map(c => {
        const sc = ["hira", "kata"].filter(s => { const r = (prog[s] || {})[c[0]]; return r && r.wrong > 0 && !mastered(s, c[0]); });
        return sc.map(s => show(c, s)).join("·");
      }).join(" ") + '</p><div id="rq"></div>';
    const forceScript = c => (["hira", "kata"].find(s => { const r = (prog[s] || {})[c[0]]; return r && r.wrong > 0 && !mastered(s, c[0]); }) || "hira");
    renderQuiz(box.querySelector("#rq"), data, ui, { script: "review", pool: weak, forceScript });
  }
}

function renderWhich(box, data) {
  const pool = shuffle(cells(data, "basic")).slice(0, 10);
  box.innerHTML = '<div class="toolbar"><span class="score" id="w-score"></span><button type="button" class="link-btn" id="w-new">새 문제</button></div><div class="quiz" id="w-quiz"></div>';
  const results = new Map();
  pool.forEach((c, i) => {
    const s = Math.random() < 0.5 ? "hira" : "kata";
    const holder = document.createElement("div");
    holder.className = "kana-q";
    box.querySelector("#w-quiz").appendChild(holder);
    mountQuestion(holder, {
      id: "n3-kana-which-" + s + "-" + c[0], area: "basics", generated: true, kind: "문자 구별", prompt: show(c, s),
      options: ["히라가나", "가타카나"], answer: s === "hira" ? 0 : 1,
      explanation: show(c, s) + "는 " + SCRIPTS[s] + "예요. 같은 소리의 " + SCRIPTS[s === "hira" ? "kata" : "hira"] + "는 " + show(c, s === "hira" ? "kata" : "hira") + "예요. 소리: " + sound(c),
      source: { type: "ai" }, review: "needs-review",
    }, { label: "구별 " + (i + 1), store: n3store, onAnswer: ok => { award(ok ? "kana" : "wrong"); results.set(i, ok); box.querySelector("#w-score").textContent = [...results.values()].filter(Boolean).length + " / " + pool.length + " 정답"; } });
  });
  box.querySelector("#w-new").onclick = () => renderWhich(box, data);
}

function renderWords(box, data) {
  const words = data.kanaWords || [];
  const pool = shuffle(words).slice(0, 8);
  box.innerHTML =
    '<p class="hint">가나로 쓴 쉬운 단어를 읽어 보세요. 누르면 소리를 들을 수 있어요.</p>' +
    '<p class="p-state" id="voice-msg" role="status"></p>' +
    '<div class="kana-words">' + words.map(w => '<button type="button" class="kana-word" data-say="' + esc(w.w) + '"><span lang="ja">' + esc(w.w) + "</span><small>" + esc(w.r + " (" + w.ko + ") · " + w.m) + "</small></button>").join("") + "</div>" +
    '<h4 class="step">단어 읽기 퀴즈 <span class="score" id="kw-score"></span></h4><div class="quiz" id="kw-quiz"></div>';
  const results = new Map();
  pool.forEach((w, i) => {
    const others = shuffle(words.filter(o => o !== w)).slice(0, 3);
    const opt = shuffle([w, ...others]);
    const holder = document.createElement("div");
    box.querySelector("#kw-quiz").appendChild(holder);
    mountQuestion(holder, {
      id: "n3-kana-word-" + w.w, area: "basics", generated: true, kind: "단어 읽기", prompt: w.w,
      options: opt.map(o => o.r + " (" + o.ko + ")"), answer: opt.indexOf(w),
      explanation: w.w + "는 " + w.r + " (" + w.ko + "), 뜻은 '" + w.m + "'예요.", source: { type: "ai" }, review: "needs-review",
    }, { label: "단어 " + (i + 1), store: n3store, onAnswer: ok => { award(ok ? "kana" : "wrong"); results.set(i, ok); box.querySelector("#kw-score").textContent = [...results.values()].filter(Boolean).length + " / " + pool.length + " 정답"; } });
  });
  box.onclick = e => { const k = e.target.closest("[data-say]"); if (k && !e.target.closest(".q")) speak(k.dataset.say, box.querySelector("#voice-msg")); };
}
