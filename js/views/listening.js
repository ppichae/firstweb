// 청해 화면: 유형별 문제, 음성 재생(음성 파일 또는 브라우저 음성 읽기), 스크립트·해석
import { DB } from "../data.js";
import { store } from "../store.js";
import { esc, badges } from "../util.js";
import { mountQuestion } from "../quiz.js";
import { getJaVoices, Player } from "../speech.js";

const ui = { type: "all", current: null, rate: 1 };
let player = null;

const levelDots = n => "●".repeat(n) + "○".repeat(3 - n);

function solvedCount(item) {
  const ids = new Set(item.questions.map(q => q.id));
  return new Set(store.get("attempts").filter(a => ids.has(a.qid)).map(a => a.qid)).size;
}

function render(app) {
  if (player) { player.stop(); player = null; }
  const types = DB.listening.meta.types;
  const items = DB.listening.items.filter(it => ui.type === "all" || it.type === ui.type);
  if (!items.find(it => it.id === ui.current)) ui.current = items.length ? items[0].id : null;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>청해</h2><p>음성을 듣고 답을 고르세요. 스크립트와 해석은 필요할 때만 펼쳐 보세요.</p></div></div>' +
      '<p class="notice">' + esc(DB.listening.meta.note) + "</p>" +
      '<div class="toolbar">' + [["all", "전체"], ...Object.entries(types)].map(([k, l]) =>
        '<button type="button" class="chip" data-ltype="' + k + '" aria-pressed="' + (ui.type === k) + '">' + esc(l) + "</button>").join("") + "</div>" +
      '<div class="picker">' + items.map(it =>
        '<button type="button" class="pick" data-item="' + it.id + '" aria-pressed="' + (it.id === ui.current) + '">' +
          '<span class="pick-type">' + esc(types[it.type]) + "</span>" +
          '<span class="pick-title" lang="ja">' + esc(it.title) + "</span>" +
          '<span class="pick-meta">난이도 ' + levelDots(it.difficulty) + " · " + solvedCount(it) + "/" + it.questions.length + " 풂</span>" +
        "</button>").join("") + "</div>" +
      '<div id="item"></div>' +
    "</section>";
  app.onclick = e => {
    const t = e.target.closest("[data-ltype]");
    const p = e.target.closest("[data-item]");
    if (t) { ui.type = t.dataset.ltype; render(app); }
    else if (p) { ui.current = p.dataset.item; render(app); app.querySelector("#item").scrollIntoView({ block: "start" }); }
  };
  const item = DB.listening.items.find(it => it.id === ui.current);
  if (item) renderItem(app.querySelector("#item"), item);
  else app.querySelector("#item").innerHTML = '<p class="empty">이 유형의 문제가 아직 없어요.</p>';
}

function renderItem(el, item) {
  const types = DB.listening.meta.types;
  const askAfter = !!item.askAfter;
  el.innerHTML =
    '<article class="listen">' +
      '<div class="q-top"><span class="q-num">' + esc(types[item.type]) + " · 난이도 " + levelDots(item.difficulty) + "</span>" + badges(item) + "</div>" +
      '<h3 lang="ja">' + esc(item.title) + "</h3>" +
      '<div class="player" id="player"><p class="hint">음성을 준비하고 있어요…</p></div>' +
      '<div class="listen-tools">' +
        '<button type="button" class="link-btn" id="show-script" aria-expanded="false">스크립트 보기</button>' +
        '<button type="button" class="link-btn" id="show-trans" aria-expanded="false">한국어 해석 보기</button>' +
      "</div>" +
      '<div class="script" id="script" hidden>' +
        (item.situation ? '<p class="situation" lang="ja">' + esc(item.situation) + "</p>" : "") +
        item.script.map(l => '<p lang="ja"><b>' + esc(l.sp.replace(/\d/, "")) + "</b>" + esc(l.ja) + "</p>").join("") +
      "</div>" +
      '<div class="script trans" id="trans" hidden>' + item.translation.map(t => "<p>" + esc(t) + "</p>").join("") + "</div>" +
      (askAfter ? '<p class="hint" id="ask-note">개요 이해는 실제 시험처럼 질문이 음성 뒤에 나와요. 끝까지 들으면 문제가 보여요.</p>' : "") +
      '<div class="quiz" id="lquiz"' + (askAfter ? " hidden" : "") + "></div>" +
      (askAfter ? '<button type="button" class="link-btn" id="reveal-q">듣지 않고 문제 보기</button>' : "") +
    "</article>";

  const quiz = el.querySelector("#lquiz");
  item.questions.forEach((q, i) => {
    const box = document.createElement("div");
    quiz.appendChild(box);
    mountQuestion(box, Object.assign({ area: "listening" }, q), { number: i + 1, wide: true });
  });
  const revealQ = () => {
    quiz.hidden = false;
    const n = el.querySelector("#ask-note"); if (n) n.hidden = true;
    const b = el.querySelector("#reveal-q"); if (b) b.hidden = true;
  };
  if (askAfter) el.querySelector("#reveal-q").onclick = revealQ;

  const toggle = (btnId, boxId, on, off) => {
    const b = el.querySelector(btnId), box = el.querySelector(boxId);
    b.onclick = () => { box.hidden = !box.hidden; b.setAttribute("aria-expanded", !box.hidden); b.textContent = box.hidden ? on : off; };
  };
  toggle("#show-script", "#script", "스크립트 보기", "스크립트 숨기기");
  toggle("#show-trans", "#trans", "한국어 해석 보기", "해석 숨기기");

  setupPlayer(el.querySelector("#player"), item, revealQ);
}

// 실제 시험처럼: 상황 설명 → 대화 → (질문)
function speechLines(item) {
  const lines = [];
  if (item.situation) lines.push({ sp: "ナ", ja: item.situation });
  lines.push(...item.script);
  if (item.askAfter || item.type !== "response") lines.push({ sp: "ナ", ja: item.questions[0].prompt.replace(/^（.*）$/, "") });
  // 긴 문장은 일부 음성에서 중간에 끊기기 때문에 「。」 단위로 나눠 읽는다
  return lines.flatMap(l => l.ja.split(/(?<=。)/).map(s => ({ sp: l.sp, ja: s.trim() }))).filter(l => l.ja);
}

async function setupPlayer(box, item, onEnded) {
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
      "<p class=\"hint\">Windows는 설정 › 시간 및 언어 › 음성에서 일본어 음성을 추가하면 재생할 수 있어요.</p></div>";
    return;
  }
  const p = player = new Player(speechLines(item), voices, (state, info) => {
    const play = box.querySelector("#p-play"), pause = box.querySelector("#p-pause"), st = box.querySelector("#p-state");
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
  p.rate = ui.rate;
  box.innerHTML =
    '<div class="player-row">' +
      '<button type="button" class="btn" id="p-play">재생</button>' +
      '<button type="button" class="btn ghost" id="p-pause" disabled>일시 정지</button>' +
      '<label class="rate">속도 <select id="p-rate">' + [0.8, 1, 1.2].map(r =>
        '<option value="' + r + '"' + (r === ui.rate ? " selected" : "") + ">" + r + "배</option>").join("") + "</select></label>" +
      '<span class="p-state" id="p-state" role="status"></span>' +
    "</div>" +
    '<p class="hint">브라우저 기계 음성 · 일본어 음성 ' + voices.length + "개 사용</p>";
  box.querySelector("#p-play").onclick = () => p.play();
  box.querySelector("#p-pause").onclick = () => (p.state === "paused" ? p.resume() : p.pause());
  box.querySelector("#p-rate").onchange = e => { ui.rate = Number(e.target.value); p.rate = ui.rate; };
}

// 다른 화면으로 갈 때 음성을 멈춘다 (main.js가 화면을 바꾸기 전에 부른다)
function leave() { if (player) { player.stop(); player = null; } }

export default { id: "listening", label: "청해", jp: "聴解", render, leave };
