// 사이트의 시작점: 자료를 불러오고, 주소 끝(#vocab, #n3/basics 등)에 맞는 방과 화면을 보여 준다
import { loadData, DB, ensureExtra } from "./data.js";
import { store } from "./store.js";
import { esc } from "./util.js";
import { ROOMS, roomsView, lastRoom, rememberRoom, hasN1Records } from "./rooms.js";
import { trackRoom } from "./tracker.js";
import { initTheme } from "./theme.js";
import { initAuth, gateActive, signedIn, rememberNext, takeNext, peekNext, userLabel, signOut } from "./auth.js";
import { loginView } from "./views/login.js";

initTheme();

// 메뉴 순서는 rooms.js의 각 방 views에 있다. 맨 앞 화면이 그 방의 첫 화면이다

const app = document.getElementById("app");
const tablist = document.getElementById("tablist");
const roomSwitch = document.getElementById("room-switch");
const header = {
  eyebrow: document.getElementById("site-eyebrow"),
  title: document.getElementById("site-title"),
  lede: document.getElementById("site-lede"),
};

let currentView = null;
let currentRoom;     // 처음에는 undefined → 첫 route에서 메뉴를 그린다
let routeToken = 0;

// 예전 주소(3단계)를 지금 메뉴로 이어 준다
const ALIASES = { "n1/lists": "vocab", "n3/more": "n3/reading" };

// 주소에 맞는 방과 화면을 찾는다. 모르는 주소면 마지막으로 연 방(없으면 방 선택 화면)으로 간다
function resolve(id) {
  id = ALIASES[id] || id;
  if (id === "rooms") return { room: null, view: roomsView };
  if (id === "login") return { room: null, view: loginView };
  for (const room of Object.values(ROOMS)) {
    const view = room.views.find(v => v.id === id);
    if (view) return { room, view };
  }
  const last = lastRoom() || (hasN1Records() ? "n1" : null);
  if (last) return { room: ROOMS[last], view: ROOMS[last].views[0] };
  return { room: null, view: roomsView };
}

function drawRoom(room, view) {
  const info = room || (view && view.docTitle ? view : roomsView);   // 방 밖의 화면(급수 선택·로그인)은 그 화면의 제목을 쓴다
  document.title = info.docTitle;
  header.eyebrow.textContent = info.eyebrow;
  header.title.innerHTML = info.title;
  header.lede.textContent = info.lede;
  tablist.innerHTML = (room ? room.views.filter(v => !v.hidden).map(v =>
    '<a class="tab" href="#' + v.id + '" data-view="' + v.id + '">' + esc(v.label) +
    "</a>").join("") : "");   // 메뉴는 한글만 표시한다
  // 급수 선택 화면에서는 같은 화면으로 가는 버튼이 필요 없어서 숨긴다. 방 안에서만 '방 바꾸기'로 보인다
  roomSwitch.textContent = "방 바꾸기";
  roomSwitch.hidden = !room;
  document.querySelector("nav.tabs").hidden = !room;
}

async function route() {
  const token = ++routeToken;
  const wantedId = location.hash.slice(1);
  const { room, view } = resolve(wantedId);
  // 로그인이 연결된 뒤에는 로그인 전 학습 화면을 잠근다. 가려던 화면은 기억해 두고 로그인 화면으로 보낸다
  if (gateActive() && !signedIn() && view !== loginView) {
    if (wantedId) rememberNext(wantedId);
    location.replace("#login");
    return;
  }
  // 로그인을 마치고 돌아오면 가려던 화면(없으면 마지막 방)으로 보낸다
  if (view === loginView && signedIn()) { location.replace("#" + (takeNext() || "")); return; }
  // 이전 화면의 정리 작업(음성·타이머 멈추기)을 하고, 걸어 둔 클릭·입력 처리를 지운다
  if (currentView && currentView.leave) currentView.leave();
  currentView = view;
  app.onclick = app.oninput = app.onchange = app.onsubmit = null;
  const roomKey = room ? room.id : view.id;
  if (roomKey !== currentRoom) { drawRoom(room, view); currentRoom = roomKey; }
  if (room) rememberRoom(room.id);
  trackRoom(room ? room.st : null);
  tablist.querySelectorAll(".tab").forEach(t => {
    if (t.dataset.view === view.id) {
      t.setAttribute("aria-current", "page");
      t.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else t.removeAttribute("aria-current");
  });
  if (view.needs) {
    app.innerHTML = '<p class="loading">학습 자료를 불러오는 중이에요…</p>';
    await ensureExtra(view.needs);
    if (token !== routeToken) return;   // 기다리는 사이에 다른 화면으로 옮겨 갔다
  }
  view.render(app);
}

// 오른쪽 위: 로그인한 계정 이름과 로그아웃 버튼 (로그인하지 않았으면 숨긴다)
const accountBox = document.getElementById("auth-user");
function drawAccount() {
  if (!accountBox) return;
  accountBox.hidden = !signedIn();
  if (!signedIn()) { accountBox.innerHTML = ""; return; }
  accountBox.innerHTML = "<b>" + esc(userLabel()) + '</b><button type="button" class="theme-toggle" id="sign-out">로그아웃</button>';
  accountBox.querySelector("#sign-out").onclick = async () => {
    await signOut();
    drawAccount();
    location.replace("#login");
  };
}

// 다른 화면에서 메뉴를 다시 그리라고 요청할 때 쓴다
export const rerender = route;

async function start() {
  try {
    await loadData();
  } catch (e) {
    app.innerHTML = '<div class="error-box"><strong>학습 자료를 불러오지 못했어요.</strong><br>' + esc(e.message) +
      "<br>index.html 파일을 더블클릭해서 열면 이 오류가 나요. GitHub Pages 주소나 VS Code의 Live Server로 열어 주세요.</div>";
    return;
  }
  store.migrateLegacy(DB.vocab.items);
  // 로그인 연결(설정이 비어 있으면 아무 일도 하지 않는다). 연결에 실패해도 사이트는 멈추지 않고 로그인 화면에서 알린다
  const authReady = initAuth(() => { drawAccount(); route(); })
    .catch(e => console.error("로그인 기능을 불러오지 못했어요.", e))
    .then(drawAccount);
  // 잠금이 켜져 있으면 로그인 여부를 알아야 하므로 기다린다. 꺼져 있으면 기다리지 않고 바로 화면을 그린다
  if (gateActive()) await authReady;
  // Google 로그인을 마치고 돌아왔으면, 로그인 전에 보려던 화면으로 보낸다
  if (signedIn() && peekNext() && !location.hash.slice(1)) location.replace("#" + takeNext());
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
}

start();
