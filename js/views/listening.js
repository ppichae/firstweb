// 청해 화면: 유형별 문제, 음성 재생(음성 파일 또는 브라우저 음성 읽기), 스크립트·해석
import { DB, EXTRA } from "../data.js";
import { store, n3store } from "../store.js";
import { award } from "../game.js";
import { esc, badges } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { getJaVoices, Player, stopAll, sayBtn, voiceSettingsHTML, bindVoiceSettings, orderedVoices, VOICE_HELP } from "../speech.js";
import { rubyHTML, furiToggleHTML } from "../examples.js";

let player = null;   // 지금 화면의 플레이어 (한 번에 하나)

const levelDots = n => "●".repeat(n) + "○".repeat(3 - n);

function solvedCount(item, st) {
  const ids = new Set(item.questions.map(q => q.id));
  return new Set(st.get("attempts").filter(a => ids.has(a.qid)).map(a => a.qid)).size;
}

// cfg: { id, roomId, st(저장소), data()(자료), needs } — N1 방과 N3 방이 같은 화면을 쓴다
export function createListeningView(cfg) {
  const ui = { type: "all", current: null };
  const data = () => cfg.data() || { meta: { types: {} }, items: [] };

  function render(app) {
    if (player) { player.stop(); player = null; }
    const d = data(), types = d.meta.types || {}, all = d.items || [];
    const items = all.filter(it => ui.type === "all" || it.type === ui.type);
    if (!items.find(it => it.id === ui.current)) ui.current = items.length ? items[0].id : null;
    const used = Object.entries(types).filter(([k]) => all.some(it => it.type === k));
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>청해</h2></div>' +
          '<div class="toolbar">' + furiToggleHTML() + "</div></div>" +
        '<div class="toolbar">' + [["all", "전체"], ...used].map(([k, l]) =>
          '<button type="button" class="chip" data-ltype="' + k + '" aria-pressed="' + (ui.type === k) + '">' + esc(l) + "</button>").join("") + "</div>" +
        '<div class="picker">' + items.map(it =>
          '<button type="button" class="pick" data-item="' + it.id + '" aria-pressed="' + (it.id === ui.current) + '">' +
            '<span class="pick-type">' + esc(types[it.type] || it.type) + "</span>" +
            '<span class="pick-title" lang="ja">' + esc(String(it.title).replace(/\{([^|}]+)\|[^}]+\}/g, "$1")) + "</span>" +
            '<span class="pick-meta">난이도 ' + levelDots(it.difficulty) + " · " + solvedCount(it, cfg.st) + "/" + it.questions.length + " 풂</span>" +
          "</button>").join("") + "</div>" +
        '<div id="item"></div>' +
      "</section>";
    app.onclick = e => {
      const t = e.target.closest("[data-ltype]");
      const p = e.target.closest("[data-item]");
      if (t) { ui.type = t.dataset.ltype; render(app); }
      else if (p) { ui.current = p.dataset.item; render(app); app.querySelector("#item").scrollIntoView({ block: "start" }); }
    };
    const item = all.find(it => it.id === ui.current);
    if (item) renderItem(app.querySelector("#item"), item, { types, st: cfg.st, roomId: cfg.roomId });
    else app.querySelector("#item").innerHTML = '<p class="empty">' + (all.length ? "이 유형의 문제가 아직 없어요." : "청해 문제가 아직 없어요.") + "</p>";
  }

  return {
    id: cfg.id, label: "청해", jp: "聴解", needs: cfg.needs, render,
    leave() { stopAll(); player = null; },   // 다른 화면으로 갈 때 음성을 멈춘다
    open(id) { ui.type = "all"; ui.current = id; location.hash = cfg.id; },
  };
}

// 청해 문제 하나를 그린다. 진단 테스트·모의고사에서도 쓴다
// opts: { mode: 기록 종류, onAnswer(correct), hideTools: 스크립트·해석 버튼 숨김, number }
export function renderItem(el, item, opts = {}) {
  const types = opts.types || DB.listening.meta.types;
  const askAfter = !!item.askAfter;
  const n3 = opts.roomId === "n3";
  el.innerHTML =
    '<article class="listen">' +
      '<div class="q-top"><span class="q-num">' + esc(types[item.type]) + " · 난이도 " + levelDots(item.difficulty) + "</span>" + badges(item) + "</div>" +
      '<h3 lang="ja">' + rubyHTML(item.title) + "</h3>" +
      '<div class="player"><p class="hint">음성을 준비하고 있어요…</p></div>' +
      '<div class="listen-tools"' + (opts.hideTools ? " hidden" : "") + ">" +
        '<button type="button" class="link-btn l-show-script" aria-expanded="false">스크립트 보기</button>' +
        '<button type="button" class="link-btn l-show-trans" aria-expanded="false">한국어 해석 보기</button>' +
      "</div>" +
      '<div class="script l-script" hidden>' +
        (item.situation ? '<p class="situation" lang="ja">' + rubyHTML(item.situation) + " " + sayBtn(item.situation, "상황 설명 듣기") + "</p>" : "") +
        item.script.map(l => '<p lang="ja"><b>' + esc(l.sp.replace(/\d/, "")) + "</b>" + rubyHTML(l.ja) + " " + sayBtn(l.ja, "이 문장 다시 듣기") + "</p>").join("") +
      "</div>" +
      '<div class="script trans l-trans" hidden>' + (item.situationKo ? "<p>" + esc(item.situationKo) + "</p>" : "") + item.translation.map(t => "<p>" + esc(t) + "</p>").join("") + "</div>" +
      ((item.vocab || []).length ? '<details class="g-more aid l-aid" hidden><summary>핵심 표현 ' + item.vocab.length + "개</summary><ul class=\"aid-list\">" +
        item.vocab.map(x => '<li><span class="jp" lang="ja">' + rubyHTML(x.w) + "</span>" + sayBtn(x.w, "표현 듣기") + " <span>" + esc(x.m) + "</span></li>").join("") + "</ul></details>" : "") +
      (askAfter ? '<p class="hint l-ask-note">개요 이해는 실제 시험처럼 질문이 음성 뒤에 나와요. 끝까지 들으면 문제가 보여요.</p>' : "") +
      '<div class="quiz l-quiz"' + (askAfter ? " hidden" : "") + "></div>" +
      (askAfter ? '<button type="button" class="link-btn l-reveal-q">듣지 않고 문제 보기</button>' : "") +
    "</article>";

  const quiz = el.querySelector(".l-quiz");
  item.questions.forEach((q, i) => {
    const box = document.createElement("div");
    quiz.appendChild(box);
    // N3 방의 문제는 문제 목록(QUESTIONS)에 없으므로 문제 내용을 기록에 함께 남긴다(오답 노트용)
    mountQuestion(box, Object.assign({ area: "listening" }, q, n3 ? { generated: true, kind: "listening" } : {}), {
      number: opts.number || i + 1, wide: true, mode: opts.mode, record: opts.record, store: opts.st,
      onAnswer: (ok, choice) => {
        if (n3 && opts.record !== false) award("n3", ok ? "correct" : "wrong", q.id);
        // 답을 고른 뒤에는 스크립트·해석·핵심 표현을 볼 수 있게 한다
        const tools = el.querySelector(".listen-tools"); if (tools) tools.hidden = false;
        const aid = el.querySelector(".l-aid"); if (aid) aid.hidden = false;
        if (opts.onAnswer) opts.onAnswer(ok, choice, q);
      },
    });
  });
  const revealQ = () => {
    quiz.hidden = false;
    const n = el.querySelector(".l-ask-note"); if (n) n.hidden = true;
    const b = el.querySelector(".l-reveal-q"); if (b) b.hidden = true;
  };
  if (askAfter) el.querySelector(".l-reveal-q").onclick = revealQ;

  const toggle = (btnId, boxId, on, off) => {
    const b = el.querySelector(btnId), box = el.querySelector(boxId);
    b.onclick = () => { box.hidden = !box.hidden; b.setAttribute("aria-expanded", !box.hidden); b.textContent = box.hidden ? on : off; };
  };
  toggle(".l-show-script", ".l-script", "스크립트 보기", "스크립트 숨기기");
  toggle(".l-show-trans", ".l-trans", "한국어 해석 보기", "해석 숨기기");

  setupPlayer(el.querySelector(".player"), item, revealQ);
}

// 실제 시험처럼: 상황 설명 → 대화 → (질문)
function speechLines(item) {
  const lines = [];
  if (item.situation) lines.push({ sp: "ナ", ja: item.situation });
  lines.push(...item.script);
  if (item.askAfter || item.type !== "response") lines.push({ sp: "ナ", ja: item.questions[0].prompt.replace(/^（.*）$/, "") });
  // 즉시 응답·발화 표현은 실제 시험처럼 선택지도 소리로 읽는다
  if (item.type === "response" || item.type === "utterance") item.questions[0].options.forEach((o, i) => lines.push({ sp: "ナ", ja: ["いち", "に", "さん", "よん"][i] + "。" + o }));
  // 긴 문장은 일부 음성에서 중간에 끊기기 때문에 「。」 단위로 나눠 읽는다
  return lines.flatMap(l => l.ja.split(/(?<=。)/).map(s => ({ sp: l.sp, ja: s.trim() }))).filter(l => l.ja);
}

export async function setupPlayer(box, item, onEnded = () => {}) {
  // 1) 음성 파일이 있으면 그 파일을 재생한다
  if (item.audio) {
    box.innerHTML = '<audio controls preload="none" src="' + esc(item.audio) + '"></audio><p class="hint">음성 파일: ' + esc(item.audio) + "</p>";
    box.querySelector("audio").addEventListener("ended", onEnded);
    return;
  }
  // 2) 없으면 브라우저의 일본어 음성으로 읽는다
  const voices = await getJaVoices();
  if (!box.isConnected) return;
  if (!voices.length) {
    box.innerHTML = '<div class="audio-missing"><strong>음성 준비 필요</strong>' +
      "<p>이 기기에서 일본어 음성을 찾지 못했고, 이 문제에는 음성 파일도 없어요. '스크립트 보기'를 눌러 글로 읽으며 풀 수 있어요.</p>" +
      '<p class="hint">' + esc(VOICE_HELP) + "</p></div>";
    return;
  }
  const p = player = new Player(speechLines(item), voices, (state, info) => {
    if (state === "line") return;   // 몇 번째 문장을 읽는지 알림 (여기서는 쓰지 않는다)
    const play = box.querySelector("[data-p=play]"), pause = box.querySelector("[data-p=pause]"), st = box.querySelector("[data-p=state]");
    if (!play) return;
    play.textContent = { playing: "처음부터", paused: "처음부터", ended: "다시 듣기" }[state] || "재생";
    pause.disabled = !(state === "playing" || state === "paused");
    pause.textContent = state === "paused" ? "계속 듣기" : "일시 정지";
    st.textContent = state === "error"
      ? (info === "not-allowed"
          ? "브라우저가 음성 재생을 막았어요. 재생 버튼을 직접 다시 눌러 보세요."
          : "재생하지 못했어요 (" + info + "). 인터넷 연결을 확인하고 다시 눌러 보세요.")
      : { playing: "재생 중", paused: "일시 정지됨", ended: "끝까지 들었어요", idle: "" }[state];
    st.classList.toggle("err", state === "error");
    if (state === "ended") onEnded();
  });
  const settings = await voiceSettingsHTML();
  if (!box.isConnected) return;
  box.innerHTML =
    '<div class="player-row">' +
      '<button type="button" class="btn" data-p="play">재생</button>' +
      '<button type="button" class="btn ghost" data-p="pause" disabled>일시 정지</button>' +
      '<button type="button" class="btn ghost" data-p="stop">정지</button>' +
      '<span class="p-state" data-p="state" role="status"></span>' +
    "</div>" +
    '<details class="voice-box"><summary>음성 설정</summary>' + settings + "</details>";
  box.querySelector("[data-p=play]").onclick = () => p.play();
  box.querySelector("[data-p=pause]").onclick = () => (p.state === "paused" ? p.resume() : p.pause());
  box.querySelector("[data-p=stop]").onclick = () => p.stop();
  // 음성·속도를 바꾸면 처음부터 새 설정으로 읽는다
  bindVoiceSettings(box, pref => { p.rate = pref.rate; getJaVoices().then(v => { p.voices = orderedVoices(v); }); if (p.state === "playing") p.play(); });
}

const n1Listening = createListeningView({ id: "listening", roomId: "n1", st: store, data: () => DB.listening });
export const n3Listening = createListeningView({ id: "n3/listening", roomId: "n3", st: n3store, data: () => EXTRA.n3listening, needs: ["n3listening"] });

// 다른 화면(오답 노트 등)에서 특정 청해 문제를 바로 열 때
export const openListening = id => n1Listening.open(id);

export default n1Listening;
