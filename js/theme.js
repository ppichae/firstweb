// 다크 모드 켜기·끄기 버튼
// 고른 값은 이 브라우저에 "jlpt:theme"("dark" | "light")로 기억한다. 고른 적이 없으면 기기 설정을 따른다.
// (학습 기록이 아니라 화면 설정이라 백업 파일에는 넣지 않는다)
const KEY = "jlpt:theme";
const root = document.documentElement;
const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

const isDark = () => (root.getAttribute("data-theme") || (media && media.matches ? "dark" : "light")) === "dark";

function paint(btn) {
  const dark = isDark();
  btn.setAttribute("aria-pressed", dark);
  btn.textContent = dark ? "☀ 밝은 화면" : "🌙 다크 모드";
  btn.title = dark ? "밝은 화면으로 바꾸기" : "어두운 화면으로 바꾸기";
}

export function initTheme() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.onclick = () => {
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* 저장소를 못 쓰면 이번 방문에만 적용 */ }
    paint(btn);
  };
  // 직접 고르지 않았다면 기기 설정이 바뀔 때 버튼 글자도 따라 바꾼다
  if (media && media.addEventListener) media.addEventListener("change", () => paint(btn));
  paint(btn);
}
