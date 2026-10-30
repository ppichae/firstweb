// 일본어 음성 읽기: 브라우저에 들어 있는 음성 합성(Web Speech API)을 쓴다
// 기기에 일본어 음성이 없으면 빈 목록을 돌려주고, 화면은 '음성 준비 필요'로 표시한다.

let voicesPromise = null;

export function getJaVoices() {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  if (!voicesPromise) {
    voicesPromise = new Promise(resolve => {
      const pick = () => window.speechSynthesis.getVoices().filter(v => /^ja([-_]|$)/i.test(v.lang));
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

// 말하는 사람마다 목소리 높낮이를 조금씩 다르게 해서 구별하기 쉽게 한다
const SPEAKER = { "男": { v: 0, pitch: 0.85 }, "女": { v: 1, pitch: 1.15 }, "女2": { v: 2, pitch: 1.3 }, "男2": { v: 3, pitch: 0.75 }, "ナ": { v: 0, pitch: 1 } };

export class Player {
  // lines: [{ sp, ja }], onState: 상태가 바뀔 때 부르는 함수("playing" | "paused" | "ended" | "idle")
  constructor(lines, voices, onState) {
    this.lines = lines; this.voices = voices; this.onState = onState;
    this.rate = 1; this.index = 0; this.token = 0; this.state = "idle";
  }
  set(state, info) { this.state = state; if (this.onState) this.onState(state, info); }
  play() {
    window.speechSynthesis.cancel();
    this.index = 0;
    this.token++;
    this.set("playing");
    this.next(this.token);
  }
  next(token) {
    if (token !== this.token) return;
    if (this.index >= this.lines.length) { this.set("ended"); return; }
    const line = this.lines[this.index];
    const s = SPEAKER[line.sp] || SPEAKER["ナ"];
    const u = new SpeechSynthesisUtterance(line.ja);
    u.lang = "ja-JP";
    u.voice = this.voices[s.v % this.voices.length] || null;
    u.pitch = s.pitch;
    u.rate = this.rate;
    u.onend = () => { this.index++; setTimeout(() => this.next(token), 350); };
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
