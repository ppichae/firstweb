// D-30 집중 학습 모드 (8단계에서 구현)
import { store } from "../store.js";

// 오늘 계획의 완료 현황. 모드를 시작하지 않았으면 null
export function sprintSummary() {
  const s = store.get("sprint");
  return s && s.today ? s.today : null;
}

function render(app) {
  app.innerHTML = '<section class="panel"><h2>D-30 집중 모드</h2><p class="empty">준비 중이에요.</p></section>';
}

export default { id: "sprint", label: "D-30", render };
