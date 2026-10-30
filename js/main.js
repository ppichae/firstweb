// 사이트의 시작점: 자료를 불러오고, 주소 끝(#vocab 등)에 맞는 화면을 보여 준다
import { loadData, DB } from "./data.js";
import { store } from "./store.js";
import { esc } from "./util.js";
import vocab from "./views/vocab.js";
import grammar from "./views/grammar.js";
import reading from "./views/reading.js";
import listening from "./views/listening.js";
import notes from "./views/notes.js";
import home from "./views/home.js";
import sprint from "./views/sprint.js";
import mock from "./views/mock.js";

// 메뉴 순서. 맨 앞 화면이 첫 화면이다. 화면을 추가할 때는 views 폴더에 파일을 만들고 여기에 한 줄 넣는다
const VIEWS = [home, vocab, grammar, reading, listening, notes, sprint, mock];

const app = document.getElementById("app");
const tablist = document.getElementById("tablist");

tablist.innerHTML = VIEWS.map(v =>
  '<a class="tab" href="#' + v.id + '" data-view="' + v.id + '">' + esc(v.label) +
  (v.jp ? ' <span class="jp" lang="ja">' + esc(v.jp) + "</span>" : "") + "</a>").join("");

let currentView = null;

function route() {
  const id = location.hash.slice(1);
  const view = VIEWS.find(v => v.id === id) || VIEWS[0];
  // 이전 화면의 정리 작업(음성·타이머 멈추기)을 하고, 걸어 둔 클릭·입력 처리를 지운다
  if (currentView && currentView.leave) currentView.leave();
  currentView = view;
  app.onclick = app.oninput = app.onchange = app.onsubmit = null;
  view.render(app);
  tablist.querySelectorAll(".tab").forEach(t => {
    if (t.dataset.view === view.id) {
      t.setAttribute("aria-current", "page");
      t.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else t.removeAttribute("aria-current");
  });
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
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
}

start();
