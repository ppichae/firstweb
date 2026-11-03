// 사이트의 시작점: 자료를 불러오고, 주소 끝(#vocab, #n3/basics 등)에 맞는 방과 화면을 보여 준다
import { loadData, DB, ensureExtra } from "./data.js";
import { store } from "./store.js";
import { esc } from "./util.js";
import { drawMobileNav, markMore } from "./mobileNav.js";
import { ROOMS, roomsView, lastRoom, rememberRoom, hasN1Records } from "./rooms.js";
import { trackRoom } from "./tracker.js";
import { initTheme } from "./theme.js";
import { initAuth, gateActive, signedIn, rememberNext, takeNext, peekNext, userLabel, signOut } from "./auth.js";
import { loginView } from "./views/login.js";
import { profileView } from "./views/profile.js";
import { createPartnerView } from "./views/partner.js";
import { createRecordsView, backupDue } from "./views/records.js";
import { startSync, stopSync, onSyncStatus, syncStatus } from "./sync.js";
import { currentUser } from "./auth.js";
import { installSayButtons } from "./speech.js";
import { installFuriToggle } from "./examples.js";
import { loadProfile, myProfile, resetAccount } from "./account.js";

const partnerView = createPartnerView();
const recordsView = createRecordsView();

initTheme();

// 메뉴 순서는 rooms.js의 각 방 views에 있다. 맨 앞 화면이 그 방의 첫 화면이다

const app = document.getElementById("app");
const tablist = document.getElementById("tablist");
const roomSwitch = document.getElementById("room-switch");
const header = {
  title: document.getElementById("site-title"),
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
  if (id === "profile") return { room: null, view: profileView };
  if (id === "partner") return { room: null, view: partnerView };
  if (id === "records") return { room: null, view: recordsView };
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
  header.title.innerHTML = info.title;
  tablist.innerHTML = (room ? room.views.filter(v => !v.hidden).map(v =>
    '<a class="tab" href="#' + v.id + '" data-view="' + v.id + '">' + esc(v.label) +
    "</a>").join("") : "");   // 메뉴는 한글만 표시한다
  // 급수 선택 화면에서는 같은 화면으로 가는 버튼이 필요 없어서 숨긴다. 방 안에서만 '방 바꾸기'로 보인다
  roomSwitch.textContent = "방 바꾸기";
  roomSwitch.hidden = !room;
  document.querySelector("nav.tabs").hidden = !room;
}

// 계정 기록 준비(동기화 시작). 준비하는 동안에는 학습 화면을 그리지 않는다 (이 기기의 예전 기록이 계정 기록처럼 보이거나 바뀌지 않게)
let syncStarting = null;
function beginSync() {
  const p = startSync(currentUser().id).catch(e => console.error("동기화를 시작하지 못했어요.", e));
  syncStarting = p;
  p.then(() => { if (syncStarting === p) syncStarting = null; });
  return p;
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
  // 처음 로그인해서 아직 프로필(닉네임·급수)이 없으면 프로필 설정부터 한다
  if (gateActive() && signedIn() && myProfile() === null && view !== profileView && view !== loginView) {
    if (wantedId) rememberNext(wantedId);
    location.replace("#profile");
    return;
  }
  // 로그인을 마치고 돌아오면 가려던 화면(없으면 마지막 방)으로 보낸다
  if (view === loginView && signedIn()) { location.replace("#" + (takeNext() || "")); return; }
  // 이전 화면의 정리 작업(음성·타이머 멈추기)을 하고, 걸어 둔 클릭·입력 처리를 지운다
  if (currentView && currentView.leave) currentView.leave();
  currentView = view;
  app.onclick = app.oninput = app.onchange = app.onsubmit = null;
  if (syncStarting && view !== loginView && view !== profileView) {
    app.innerHTML = '<p class="loading">내 학습 기록을 불러오는 중이에요…</p>';
    await syncStarting;
    if (token !== routeToken) return;   // 기다리는 사이에 다른 화면으로 옮겨 갔다
  }
  const roomKey = room ? room.id : view.id;
  if (roomKey !== currentRoom) { drawRoom(room, view); currentRoom = roomKey; }
  drawMobileNav(room, view);
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
  const p = myProfile();
  accountBox.innerHTML = (p ? '<a class="sync-chip" id="sync-chip" href="#records"></a><a class="theme-toggle" href="#partner">🤝 공부 파트너</a>' : "") +
    "<b>" + esc(p ? p.nickname : userLabel()) + '</b><button type="button" class="theme-toggle" id="sign-out">로그아웃</button>';
  drawSyncChip();
  accountBox.querySelector("#sign-out").onclick = async () => {
    try { await flushBeforeLeave(); } catch (e) { return; }   // 로그아웃을 취소했다
    await signOut();
    stopSync();
    resetAccount();
    drawAccount();
    location.replace("#login");
  };
}

// 오른쪽 위 동기화 표시: 보낼 기록·확인 필요·저장 문제·백업 권장을 알려 주고, 누르면 '내 기록'로 간다
function drawSyncChip() {
  const chip = document.getElementById("sync-chip");
  if (!chip) return;
  const s = syncStatus();
  let text = "내 기록 ✓", warn = false;
  if (!s.active) text = "내 기록";
  else if (s.storageError) { text = "⚠ 저장 문제"; warn = true; }
  else if (s.conflicts) { text = "확인 필요 " + s.conflicts; warn = true; }
  else if (s.pending) text = "보내는 중 " + s.pending;
  else if (backupDue()) text = "백업 권장";
  chip.textContent = text;
  chip.classList.toggle("warn", warn);
  chip.toggleAttribute("data-alert", warn || text === "백업 권장");
  markMore(warn || text === "백업 권장");
  chip.title = s.lastSync ? "마지막으로 보낸 때: " + new Date(s.lastSync).toLocaleString() : "";
}
// 로그아웃 전에 보내지 않은 기록이 있으면 먼저 보내 본다(실패하면 알린다)
async function flushBeforeLeave() {
  const s = syncStatus();
  if (!s.active || !s.pending) return;
  await (await import("./sync.js")).flush();
  const left = syncStatus().pending;
  if (left && !confirm("아직 서버로 보내지 못한 기록이 " + left + "개 있어요. 이 기기에는 남아 있어서 다음에 로그인하면 보내져요. 그래도 로그아웃할까요?")) throw new Error("cancel");
}

// 다른 화면에서 메뉴를 다시 그리라고 요청할 때 쓴다
export const rerender = route;

async function start() {
  installSayButtons();   // 🔊 발음 버튼은 어느 화면에서나 이 한 곳에서 처리한다
  // 초점 테두리는 키보드로 움직일 때만 보여 준다 (마우스·터치 중에 화면이 초점을 옮겨도 테두리가 생기지 않게)
  addEventListener("pointerdown", () => document.documentElement.setAttribute("data-pointer", ""), true);
  addEventListener("keydown", e => { if (e.key === "Tab") document.documentElement.removeAttribute("data-pointer"); }, true);
  installFuriToggle();   // 후리가나 보이기·숨기기 (이 기기에 기억)
  try {
    await loadData();
  } catch (e) {
    app.innerHTML = '<div class="error-box"><strong>학습 자료를 불러오지 못했어요.</strong><br>' + esc(e.message) +
      "<br>index.html 파일을 더블클릭해서 열면 이 오류가 나요. GitHub Pages 주소나 VS Code의 Live Server로 열어 주세요.</div>";
    return;
  }
  store.migrateLegacy(DB.vocab.items);
  // 로그인 연결(설정이 비어 있으면 아무 일도 하지 않는다). 연결에 실패해도 사이트는 멈추지 않고 로그인 화면에서 알린다
  // 로그인·로그아웃하면 프로필을 다시 불러온 뒤 화면을 다시 그린다
  const authReady = initAuth(async () => {
    resetAccount(); stopSync(); syncStarting = null;
    await loadProfile();
    if (signedIn() && myProfile()) beginSync();
    drawAccount(); route();
  })
    .catch(e => console.error("로그인 기능을 불러오지 못했어요.", e))
    .then(drawAccount);
  // 잠금이 켜져 있으면 로그인 여부를 알아야 하므로 기다린다. 꺼져 있으면 기다리지 않고 바로 화면을 그린다
  if (gateActive()) await authReady;
  // 로그인했고 프로필이 있으면, 학습 기록을 계정과 맞춘 뒤(서버 기록 받아 오기) 화면을 그린다
  if (signedIn()) {
    await loadProfile();
    if (myProfile()) beginSync();
    drawAccount();
  }
  onSyncStatus(drawSyncChip);
  window.addEventListener("account-changed", async () => {
    if (signedIn() && myProfile() && !syncStatus().active && !syncStarting) beginSync();
    drawAccount();
  });
  // Google 로그인을 마치고 돌아왔으면, 로그인 전에 보려던 화면으로 보낸다
  if (signedIn() && peekNext() && !location.hash.slice(1)) location.replace("#" + takeNext());
  window.addEventListener("sync-late", () => route());   // 서버 기록이 늦게 도착했을 때
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
}

start();
