// 일본어 음성 읽기: 브라우저에 들어 있는 음성 합성(Web Speech API)을 쓴다 (무료, 기기마다 음성이 다르다)
// 1) 기기에 있는 일본어 음성 중 자연스러운 음성(신경망·고음질)을 먼저 고른다. 사용자가 고른 음성과 속도는 이 기기에 기억한다
// 2) 자료에 후리가나({漢字|よみ})가 있으면 그 읽기대로 읽게 해서 한자를 잘못 읽지 않게 한다
// 3) 기기에 일본어 음성이 없으면 빈 목록을 돌려주고, 화면은 '일본어 음성 없음'과 추가 방법을 알려 준다.

let voicesPromise = null;

// 음성 품질 점수: 이름으로 알 수 있는 고음질 음성을 앞에 둔다 (확인된 이름만 넣었다)
//   Edge: "Microsoft Nanami Online (Natural)" 등 · Chrome: "Google 日本語" · Apple: Kyoko/O-ren/Otoya (고음질·프리미엄 버전 포함)
function voiceScore(v) {
  const n = v.name || "";
  let s = 0;
  if (/Natural|Neural|Premium|Enhanced|高品質|拡張/i.test(n)) s += 50;
  if (/Online/i.test(n)) s += 20;
  if (/^Google/i.test(n)) s += 50;   // Chrome의 Google 음성은 인터넷으로 만드는 고음질 음성
  if (/Nanami|Keita|Aoi|Daichi|Mayu|Naoki|Shiori|Kyoko|O-?ren|Otoya|Hattori/i.test(n)) s += 10;
  if (/Compact|eloquence/i.test(n)) s -= 30;
  if (v.localService === false) s += 5;
  return s;
}

export function getJaVoices() {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  if (!voicesPromise) {
    voicesPromise = new Promise(resolve => {
      const pick = () => window.speechSynthesis.getVoices().filter(v => /^ja([-_]|$)/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a));
      const first = pick();
      if (first.length) { resolve(first); return; }
      // 음성 목록은 늦게 도착하기도 해서 잠시 기다린다
      const timer = setTimeout(() => resolve(pick()), 2000);
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        const v = pick();
        if (v.length) { clearTimeout(timer); resolve(v); }
      });
    });
  }
  return voicesPromise;
}

/* ---------- 이 기기의 음성 설정 (기기마다 음성이 달라서 계정이 아니라 이 기기에 둔다) ---------- */
const PREF_KEY = "jlpt:voicePref";
export const RATES = [0.7, 0.85, 1, 1.2];
export function voicePref() {
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); return { name: p.name || "", rate: RATES.includes(p.rate) ? p.rate : 1 }; }
  catch (e) { return { name: "", rate: 1 }; }
}
export function setVoicePref(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(Object.assign(voicePref(), p))); } catch (e) { /* 기억하지 못해도 이번에는 쓴다 */ }
}
// 고른 음성을 맨 앞으로
export function orderedVoices(voices) {
  const name = voicePref().name;
  const i = voices.findIndex(v => v.name === name);
  return i > 0 ? [voices[i], ...voices.slice(0, i), ...voices.slice(i + 1)] : voices;
}

// 읽을 글: {漢字|よみ} → よみ (후리가나대로 읽게 한다), 띄어쓰기는 지운다
export const speechText = ja => String(ja || "").replace(/\{([^|}]+)\|([^}]+)\}/g, "$2").replace(/\s+/g, "");

// 말하는 사람: 음성이 2개 이상이면 다른 음성으로, 하나뿐이면 높낮이만 아주 조금 바꾼다 (많이 바꾸면 기계처럼 들린다)
const SPEAKER = { "男": { v: 0, pitch: 0.95 }, "女": { v: 1, pitch: 1.05 }, "女2": { v: 2, pitch: 1.08 }, "男2": { v: 3, pitch: 0.92 }, "ナ": { v: 0, pitch: 1 } };

let active = null;   // 지금 소리를 내는 플레이어 (한 번에 하나만)

// 화면을 떠날 때 모든 음성을 멈춘다
export function stopAll() {
  if (active) active.stop();
  active = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export class Player {
  // lines: [{ sp, ja }], onState: 상태가 바뀔 때 부르는 함수("playing" | "paused" | "ended" | "idle" | "error")
  constructor(lines, voices, onState) {
    this.lines = lines; this.voices = orderedVoices(voices); this.onState = onState;
    this.rate = voicePref().rate; this.index = 0; this.token = 0; this.state = "idle"; this.only = false;
  }
  set(state, info) { this.state = state; if (this.onState) this.onState(state, info); }
  // from: 이 줄부터 읽는다. only: 그 줄만 읽고 멈춘다 (문장별 다시 듣기)
  play(from = 0, only = false) {
    if (active && active !== this) active.stop();
    active = this;
    window.speechSynthesis.cancel();
    this.index = from; this.only = only;
    this.token++;
    this.set("playing", { index: from });
    this.next(this.token);
  }
  next(token) {
    if (token !== this.token) return;
    if (this.index >= this.lines.length) { this.set("ended"); return; }
    const line = this.lines[this.index];
    const s = SPEAKER[line.sp] || SPEAKER["ナ"];
    const u = new SpeechSynthesisUtterance(speechText(line.ja));
    u.lang = "ja-JP";
    const many = this.voices.length > 1;
    u.voice = this.voices[many ? s.v % this.voices.length : 0] || null;
    u.pitch = many && s.v ? 1 : s.pitch;
    u.rate = this.rate;
    if (this.onState) this.onState("line", { index: this.index });
    u.onend = () => {
      if (token !== this.token) return;
      if (this.only) { this.set("ended", { index: this.index }); return; }
      this.index++; setTimeout(() => this.next(token), 350);
    };
    // 멈춤 버튼으로 끊긴 경우(interrupted, canceled)는 오류로 보지 않는다
    u.onerror = e => {
      if (token !== this.token || e.error === "interrupted" || e.error === "canceled") return;
      this.token++;
      this.set("error", e.error);
    };
    window.speechSynthesis.speak(u);
  }
  pause() { window.speechSynthesis.pause(); this.set("paused"); }
  resume() { window.speechSynthesis.resume(); this.set("playing"); }
  stop() { this.token++; window.speechSynthesis.cancel(); this.set("idle"); }
}

/* ---------- 발음 버튼 (단어·예문·문법·한자·독해 어디서나) ---------- */
// ja: 읽을 일본어(후리가나 표기 가능), label: 화면 읽기 프로그램용 설명
export function sayBtn(ja, label = "발음 듣기") {
  if (!ja) return "";
  // 카드 버튼 안에도 넣을 수 있게 button 대신 role="button"인 span을 쓴다 (키보드 Enter·Space도 처리)
  return '<span class="say-btn" role="button" tabindex="0" data-say-ja="' + String(ja).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") +
    '" aria-label="' + label + '" title="' + label + '"><svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4z"/><path d="M15.500 9a4.200 4.200 0 0 1 0 6"/><path d="M18.200 6.300a8 8 0 0 1 0 11.400"/></svg></span>';
}

let sayingBtn = null;
// 한 문장(단어)만 읽는다. 다시 누르면 멈춘다
export async function say(ja, btn) {
  if (!("speechSynthesis" in window)) { alertNoVoice(); return; }
  if (btn && sayingBtn === btn) { stopAll(); return; }
  const voices = orderedVoices(await getJaVoices());
  if (!voices.length) { alertNoVoice(); return; }
  stopAll();
  const u = new SpeechSynthesisUtterance(speechText(ja));
  u.lang = "ja-JP"; u.voice = voices[0]; u.rate = voicePref().rate;
  const done = () => { if (sayingBtn) sayingBtn.classList.remove("on"); sayingBtn = null; };
  if (btn) { done(); sayingBtn = btn; btn.classList.add("on"); }
  u.onend = done; u.onerror = done;
  window.speechSynthesis.speak(u);
}
function alertNoVoice() {
  window.alert("이 기기에서 일본어 음성을 찾지 못했어요.\n" + VOICE_HELP);
}
export const VOICE_HELP = "아이폰: 설정 › 손쉬운 사용 › 콘텐츠 말하기 › 음성 › 일본어에서 음성을 내려받을 수 있어요. " +
  "Windows: 설정 › 시간 및 언어 › 음성에서 일본어 음성을 추가하거나, Microsoft Edge로 열면 자연스러운 음성(Nanami 등)을 쓸 수 있어요.";

// 페이지 전체에서 발음 버튼을 처리한다 (main.js에서 한 번 부른다). 화면을 바꿔도 따로 연결할 필요가 없다
export function installSayButtons() {
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-say-ja]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    say(b.dataset.sayJa, b);
  }, true);
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const b = e.target.closest && e.target.closest("[data-say-ja]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    say(b.dataset.sayJa, b);
  }, true);
}

/* ---------- 음성 설정 (음성 고르기·속도) ---------- */
export async function voiceSettingsHTML() {
  const voices = await getJaVoices();
  if (!voices.length) return '<div class="voice-set"><p class="hint">이 기기에는 일본어 음성이 없어요. ' + VOICE_HELP + "</p></div>";
  const cur = orderedVoices(voices)[0], p = voicePref();
  return '<div class="voice-set"><label>음성 <select data-voice="name">' + voices.map(v =>
      '<option value="' + v.name.replace(/"/g, "&quot;") + '"' + (v === cur ? " selected" : "") + ">" + v.name.replace(/</g, "&lt;") + (voiceScore(v) >= 50 ? " (자연스러운 음성)" : "") + "</option>").join("") + "</select></label>" +
    '<label>속도 <select data-voice="rate">' + RATES.map(r => '<option value="' + r + '"' + (r === p.rate ? " selected" : "") + ">" + r + "배</option>").join("") + "</select></label>" +
    '<button type="button" class="btn ghost" data-voice="test">들어 보기</button></div>' +
    (voiceScore(cur) < 50 ? '<p class="hint">더 자연스러운 음성을 쓰려면: ' + VOICE_HELP + "</p>" : "");
}
// box 안의 음성 설정을 연결한다. onChange: 설정이 바뀌면 부른다
export function bindVoiceSettings(box, onChange) {
  box.querySelectorAll("[data-voice]").forEach(el => {
    if (el.dataset.voice === "test") el.onclick = () => say("{今日|きょう}も{一緒|いっしょ}に{日本語|にほんご}を{勉強|べんきょう}しましょう。", el);
    else el.onchange = () => {
      setVoicePref(el.dataset.voice === "rate" ? { rate: Number(el.value) } : { name: el.value });
      if (onChange) onChange(voicePref());
    };
  });
}
