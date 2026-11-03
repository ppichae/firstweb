// 휴대폰 하단 메뉴: 자주 쓰는 화면 4개 + 더보기. 나머지 메뉴와 오른쪽 위 버튼은 더보기 창에 모은다
// 위쪽 메뉴·버튼은 그대로 두고 좁은 화면에서만 숨긴다(style.css). 더보기의 버튼은 원래 버튼을 대신 눌러 주므로 동작이 한 곳에만 있다
import { esc } from "./util.js";
import { iconSVG } from "./stats.js";

const MAIN = ["홈", "단어", "문법", "한자"];
const MENU_ICON = { "로드맵": "map", "기초": "seed", "독해": "book", "청해": "ear", "오답 노트": "retry", "시험 대비": "target", "모의고사": "paper", "기록 관리": "save" };
const MENU_TONE = ["mint", "sky", "lav", "peach"];
let bar = null, sheet = null, current = { room: null, view: null };

function ensure() {
  if (bar) return;
  bar = document.createElement("nav");
  bar.className = "m-bar";
  bar.setAttribute("aria-label", "주요 메뉴");
  document.body.appendChild(bar);
  bar.addEventListener("click", e => { if (e.target.closest("[data-m-more]")) openSheet(); });
  sheet = document.createElement("dialog");
  sheet.className = "m-sheet";
  sheet.setAttribute("aria-label", "더보기");
  sheet.tabIndex = -1;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e => {
    if (e.target === sheet || e.target.closest("[data-m-close]") || e.target.closest("a")) { sheet.close(); return; }
    const p = e.target.closest("[data-m-proxy]");
    if (!p) return;
    const target = document.getElementById(p.dataset.mProxy);
    if (target) target.click();
    sheet.close();
  });
}

function openSheet() {
  const { room, view } = current;
  if (!room) return;
  const others = room.views.filter(v => !v.hidden && !MAIN.includes(v.label));
  const chip = document.getElementById("sync-chip");
  const partner = document.querySelector('.site-actions a[href="#partner"]');
  const theme = document.getElementById("theme-toggle");
  const signOut = document.getElementById("sign-out");
  const name = document.querySelector(".auth-user b");
  sheet.innerHTML =
    '<div class="q-top"><h3>더보기</h3><button type="button" class="btn ghost sm" data-m-close>닫기</button></div>' +
    // 공부 메뉴는 아이콘이 있는 칸, 계정·설정은 작은 버튼으로 나눈다
    '<div class="m-grid">' + others.map((v, i) =>
      '<a class="m-link tone-' + MENU_TONE[i % 4] + '" href="#' + v.id + '"' + (v === view ? ' aria-current="page"' : "") + '><span class="stat-icon">' + iconSVG(MENU_ICON[v.label]) + "</span>" + esc(v.label) + "</a>").join("") + "</div>" +
    '<div class="m-tools">' +
      '<a class="m-tool" href="#rooms">' + iconSVG("swap") + "방 바꾸기</a>" +
      (partner ? '<a class="m-tool" href="#partner">' + iconSVG("link") + "공부 파트너</a>" : "") +
      (chip ? '<a class="m-tool' + (chip.classList.contains("warn") ? " warn" : "") + '" href="#records">' + iconSVG("cloud") + "<span>" + esc(chip.textContent) + "</span></a>" : "") +
      (theme ? '<button type="button" class="m-tool" data-m-proxy="theme-toggle">' + iconSVG("moon") + esc(theme.textContent.replace(/^[^가-힣]+/, "")) + "</button>" : "") +
    "</div>" +
    (signOut ? '<button type="button" class="m-out" data-m-proxy="sign-out">' + (name ? esc(name.textContent) + " · " : "") + "로그아웃</button>" : "");
  if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", "");
  // 창을 열면 브라우저가 첫 버튼(닫기)에 초점을 줘서 테두리가 생긴다. 창 자체에 초점을 둔다
  sheet.focus();
}

// 화면을 옮길 때마다 부른다. 방 밖의 화면(로그인·급수 선택·공부 파트너·내 기록)에서는 하단 메뉴를 쓰지 않는다
export function drawMobileNav(room, view) {
  ensure();
  current = { room, view };
  document.body.classList.toggle("in-room", !!room);
  if (sheet.open) sheet.close();
  if (!room) { bar.innerHTML = ""; return; }
  const main = MAIN.map(l => room.views.find(v => v.label === l)).filter(Boolean);
  const inMain = main.includes(view);
  bar.innerHTML = main.map(v =>
    '<a class="m-tab" href="#' + v.id + '"' + (v === view ? ' aria-current="page"' : "") + ">" + esc(v.label) + "</a>").join("") +
    '<button type="button" class="m-tab" data-m-more' + (inMain ? "" : ' aria-current="page"') + ">더보기</button>";
  markMore(!!document.querySelector("#sync-chip.warn, #sync-chip[data-alert]"));
}

// 내 기록에 알릴 것(저장 문제·확인 필요·백업 권장)이 있으면 더보기에 점을 찍는다
export function markMore(on) {
  if (!bar) return;
  const b = bar.querySelector("[data-m-more]");
  if (b) b.classList.toggle("has-alert", on);
}
