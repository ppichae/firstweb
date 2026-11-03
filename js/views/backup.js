// 기록 관리: 학습 기록 백업(파일로 내려받기) · 복원 · 지우기 (N1 방과 N3 방이 같은 화면을 쓴다)
// 기록은 이 브라우저에만 저장되므로, 다른 기기로 옮기거나 상대에게 보여 줄 때는 백업 파일을 쓴다.
// 파일 종류: N1만("jlpt-n1-goukaku") · N3만("jlpt-n3-room") · 전체("jlpt-goukaku-all")
import { store, n3store } from "../store.js";
import { esc, today } from "../util.js";
import { nameOf } from "../summary.js";
import { syncActive } from "../sync.js";

const ROOMS = {
  n1: { st: store, app: "jlpt-n1-goukaku", label: "N1", extraKeys: ["n1lab:mockDraft"] },
  n3: { st: n3store, app: "jlpt-n3-room", label: "N3", extraKeys: [] },
};
const ALL_APP = "jlpt-goukaku-all";
const ARRAYS = ["attempts", "mocks", "tests", "cheers"];
const ui = { confirm: null, message: null, pending: null };

function counts(data) {
  const n = k => (Array.isArray(data[k]) ? data[k].length : data[k] && typeof data[k] === "object" ? Object.keys(data[k]).length : 0);
  return "문제 풀이 " + n("attempts") + "건 · 단어 기록 " + (n("words") + n("lists")) + "개";
}

// 백업 파일을 확인해서 { n1?: 기록, n3?: 기록 } 으로 바꾼다. 형식이 맞지 않으면 오류를 낸다
function parseBackup(obj) {
  const fail = () => { throw new Error("이 사이트에서 만든 백업 파일이 아니에요."); };
  if (!obj || typeof obj !== "object") fail();
  const out = {};
  const check = (roomId, part) => {
    if (!part || part.app !== ROOMS[roomId].app || !part.data || typeof part.data !== "object") fail();
    ARRAYS.forEach(k => { if (k in part.data && !Array.isArray(part.data[k])) throw new Error("백업 파일의 '" + k + "' 기록 형식이 올바르지 않아요."); });
    out[roomId] = part;
  };
  if (obj.app === ALL_APP) {
    if (!obj.rooms || typeof obj.rooms !== "object") fail();
    Object.keys(ROOMS).forEach(r => { if (obj.rooms[r]) check(r, obj.rooms[r]); });
    if (!Object.keys(out).length) fail();
  } else {
    const r = Object.keys(ROOMS).find(k => ROOMS[k].app === obj.app);
    if (!r) fail();
    check(r, obj);
  }
  return out;
}

function download(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportRooms(which) {
  if (which === "all") {
    download({ app: ALL_APP, version: 1, exportedAt: new Date().toISOString(), rooms: { n1: store.exportAll(), n3: n3store.exportAll() } }, "jlpt-all-backup-" + today() + ".json");
    return "N1·N3 전체";
  }
  download(ROOMS[which].st.exportAll(), "jlpt-" + which + "-backup-" + today() + ".json");
  return ROOMS[which].label;
}

export function createBackupView(id, roomId) {
  const room = ROOMS[roomId];
  const st = room.st;

  function render(app) {
    const mocks = st.get("mocks") ? st.get("mocks").length : 0;
    const pend = ui.pending ? Object.keys(ui.pending) : [];
    const synced = syncActive();
    app.innerHTML =
      '<section class="panel">' +
        (synced
          ? '<div class="panel-head"><div><h2>기록 관리</h2></div></div>'
          : '<div class="panel-head"><div><h2>기록 관리</h2></div></div>') +
        (ui.message ? '<p class="toast" role="status">' + esc(ui.message) + "</p>" : "") +
        (synced
          ? '<p class="notice">동기화와 계정 백업은 <a href="#records">내 기록</a>에서 관리해요.</p>'
          : "") +
        '<article class="card-box"><h3>지금 저장된 기록 · ' + esc(nameOf(roomId)) + " (" + room.label + " 방)</h3>" +
          '<p class="hint">' + counts({ attempts: st.get("attempts"), words: st.get("words"), lists: st.get("lists") }) +
          (roomId === "n1" ? " · 모의고사 " + mocks + "회" : " · 연습 테스트 " + st.get("tests").length + "회") +
          (st.available ? "" : ' · <b class="confirm">이 브라우저는 저장소를 쓸 수 없어서, 새로고침하면 기록이 사라져요.</b>') + "</p></article>" +
        '<article class="card-box"><h3>백업하기</h3>' +
          "<p>기록을 파일 하나(.json)로 내려받아요. 기기를 바꾸거나 브라우저 기록을 지우기 전에 받아 두세요.</p>" +
          '<div class="toolbar">' +
            '<button type="button" class="btn" id="b-export" data-export="' + roomId + '">' + room.label + " 기록만 내려받기</button>" +
            '<button type="button" class="btn ghost" data-export="' + (roomId === "n1" ? "n3" : "n1") + '">' + (roomId === "n1" ? "N3" : "N1") + " 기록만</button>" +
            '<button type="button" class="btn ghost" data-export="all">전체(N1+N3)</button>' +
          "</div></article>" +
        '<article class="card-box"><h3>복원하기</h3>' +
          (synced ? "<p>백업 파일을 고르면, 파일에 들어 있는 기록을 내 계정에 더해요. 지금 기록은 지우지 않아요.</p>" : "<p>백업 파일을 고르면, 파일에 들어 있는 방의 기록을 그 파일의 기록으로 바꿔요. 파일에 없는 방의 기록은 그대로 둬요.</p>") +
          '<div class="field"><label for="b-file">백업 파일 선택</label><input id="b-file" type="file" accept=".json,application/json"></div>' +
          (ui.confirm === "import"
            ? '<div class="confirm-box"><p><b>이 파일에 들어 있는 기록</b></p><ul>' +
                pend.map(r => "<li>" + ROOMS[r].label + " 방: " + esc(counts(ui.pending[r].data)) + "</li>").join("") + "</ul>" +
                (synced ? '<p class="confirm">복원하면 이 파일의 기록이 내 계정에 더해져요. 나중에 내 기록 화면에서 이 가져오기만 취소할 수 있어요.</p>' : '<p class="confirm">복원하면 이 기기의 ' + pend.map(r => ROOMS[r].label).join("·") + " 기록이 파일 내용으로 바뀌어요. 되돌릴 수 없으니 먼저 지금 기록을 백업해 두세요.</p>") +
                '<div class="toolbar"><button type="button" class="btn ghost" id="b-pre-backup">지금 기록 먼저 백업</button>' +
                '<button type="button" class="btn" id="b-import-yes">복원하기</button><button type="button" class="link-btn" id="b-cancel">취소</button></div></div>'
            : "") +
        "</article>" +
        '<article class="card-box"><h3>이 방 기록 지우기</h3>' +
          "<p>" + (synced ? "내 계정에 저장된 " : "") + room.label + " 방의 풀이 기록, 오답 노트, 복습 일정" + (roomId === "n1" ? ", D-30 계획, 모의고사 결과" : ", 단원 진도, 경험치") + "를 지워요. 다른 방의 기록과 학습 자료는 그대로 남아요.</p>" +
          '<div class="toolbar">' + (ui.confirm === "reset"
            ? '<span class="confirm">정말 모두 지울까요? 되돌릴 수 없어요.</span><button type="button" class="btn danger" id="b-reset-yes">모두 지우기</button><button type="button" class="link-btn" id="b-cancel">취소</button>'
            : '<button type="button" class="btn ghost" id="b-reset">' + room.label + " 기록 지우기</button>") + "</div>" +
        "</article>" +
      "</section>";
    ui.message = null;

    app.querySelector("#b-file").onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        ui.pending = parseBackup(JSON.parse(await file.text()));
        ui.confirm = "import";
      } catch (err) {
        ui.message = "복원할 수 없어요: " + (err instanceof SyntaxError ? "파일 내용이 올바른 백업 형식이 아니에요." : err.message);
        ui.confirm = null; ui.pending = null;
      }
      render(app);
    };
    app.onclick = e => {
      const ex = e.target.closest("[data-export]");
      const id = e.target.id;
      if (ex) { ui.message = exportRooms(ex.dataset.export) + " 백업 파일을 내려받았어요."; render(app); }
      else if (id === "b-pre-backup") {
        const rooms = Object.keys(ui.pending);
        exportRooms(rooms.length > 1 ? "all" : rooms[0]);
        app.querySelector("#b-pre-backup").textContent = "백업했어요 ✓";
      } else if (id === "b-import-yes") {
        // 로그인한 계정에서는 서버에 '가져오기'로 올리므로 끝날 때까지 기다린다
        (async () => {
          try {
            const done = [];
            for (const r of Object.keys(ui.pending)) { await ROOMS[r].st.importAll(ui.pending[r]); done.push(ROOMS[r].label + "(" + counts(ui.pending[r].data) + ")"); }
            ui.message = "백업 파일의 기록으로 복원했어요: " + done.join(", ");
          } catch (err) { ui.message = "복원할 수 없어요: " + err.message; }
          ui.pending = null; ui.confirm = null; render(app);
        })();
      } else if (id === "b-reset") { ui.confirm = "reset"; render(app); }
      else if (id === "b-reset-yes") {
        (async () => {
          try {
            await st.resetAll();
            room.extraKeys.forEach(k => { try { localStorage.removeItem(k); } catch (err) { /* 무시 */ } });
            ui.message = room.label + " 방의 모든 기록을 지웠어요.";
          } catch (err) { ui.message = "지우지 못했어요: " + err.message; }
          ui.confirm = null; render(app);
        })();
      } else if (id === "b-cancel") { ui.confirm = null; ui.pending = null; render(app); }
    };
  }

  return { id, label: "기록 관리", render, leave: () => { ui.confirm = null; ui.pending = null; } };
}

export default createBackupView("backup", "n1");
