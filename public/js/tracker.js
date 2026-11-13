// 학습 시간 기록: 지금 열린 방의 기록에 15초씩 더한다 (activity[날짜].seconds)
// 화면이 보이고, 최근 2분 안에 누르거나 스크롤한 적이 있을 때만 센다. 창을 켜 두고 자리를 비운 시간은 세지 않는다.
const TICK = 15;
const IDLE_LIMIT = 2 * 60 * 1000;

let current = null;   // 지금 방의 저장소 (방 선택 화면에서는 null)
let lastInput = Date.now();

export function trackRoom(st) { current = st; lastInput = Date.now(); }

["pointerdown", "keydown", "scroll", "touchstart", "wheel"].forEach(ev =>
  window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));

setInterval(() => {
  if (!current || document.visibilityState !== "visible" || Date.now() - lastInput > IDLE_LIMIT) return;
  current.logActivity("seconds", TICK);
}, TICK * 1000);
