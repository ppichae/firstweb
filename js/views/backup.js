// 기록 관리: 학습 기록 백업(파일로 내려받기) · 복원 · 초기화
// 기록은 이 브라우저에만 저장되므로, 다른 기기로 옮길 때는 백업 파일을 쓴다.
import { store } from "../store.js";
import { esc, today } from "../util.js";

const ui = { confirm: null, message: null, pending: null };

function render(app) {
  const at = store.get("attempts").length;
  const words = Object.keys(store.get("words")).length;
  const mocks = store.get("mocks").length;
  app.innerHTML =
    '<section class="panel">' +
      '<div class="panel-head"><div><h2>기록 관리</h2><p>학습 기록은 지금 쓰는 브라우저에만 저장돼요. 다른 브라우저나 기기와는 자동으로 공유되지 않아요.</p></div></div>' +
      (ui.message ? '<p class="toast" role="status">' + esc(ui.message) + "</p>" : "") +
      '<article class="card-box"><h3>지금 저장된 기록</h3>' +
        '<p class="hint">문제 풀이 ' + at + "건 · 단어 기록 " + words + "개 · 모의고사 " + mocks + "회" +
        (store.available ? "" : ' · <b class="confirm">이 브라우저는 저장소를 쓸 수 없어서, 새로고침하면 기록이 사라져요.</b>') + "</p></article>" +
      '<article class="card-box"><h3>백업하기</h3>' +
        "<p>모든 학습 기록을 파일 하나(.json)로 내려받아요. 기기를 바꾸거나 브라우저 기록을 지우기 전에 받아 두세요.</p>" +
        '<div class="toolbar"><button type="button" class="btn" id="b-export">백업 파일 내려받기</button></div></article>' +
      '<article class="card-box"><h3>복원하기</h3>' +
        "<p>백업 파일을 고르면 지금 기록을 그 파일의 기록으로 바꿔요.</p>" +
        '<div class="field"><label for="b-file">백업 파일 선택</label><input id="b-file" type="file" accept=".json,application/json"></div>' +
        (ui.confirm === "import"
          ? '<div class="toolbar"><span class="confirm">지금 기록이 백업 파일의 기록으로 바뀌어요. 계속할까요?</span><button type="button" class="btn" id="b-import-yes">복원하기</button><button type="button" class="link-btn" id="b-cancel">취소</button></div>'
          : "") +
      "</article>" +
      '<article class="card-box"><h3>모든 기록 지우기</h3>' +
        "<p>풀이 기록, 오답 노트, 단어 복습 일정, D-30 계획, 모의고사 결과를 모두 지워요. 학습 자료(단어·문법·지문)는 그대로 남아요.</p>" +
        '<div class="toolbar">' + (ui.confirm === "reset"
          ? '<span class="confirm">정말 모두 지울까요? 되돌릴 수 없어요.</span><button type="button" class="btn danger" id="b-reset-yes">모두 지우기</button><button type="button" class="link-btn" id="b-cancel">취소</button>'
          : '<button type="button" class="btn ghost" id="b-reset">모든 기록 지우기</button>') + "</div>" +
      "</article>" +
    "</section>";
  ui.message = null;

  app.querySelector("#b-file").onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== "jlpt-n1-goukaku") throw new Error("이 사이트에서 만든 백업 파일이 아니에요.");
      ui.pending = data;
      ui.confirm = "import";
    } catch (err) {
      ui.message = "복원할 수 없어요: " + (err instanceof SyntaxError ? "파일 내용이 올바른 백업 형식이 아니에요." : err.message);
      ui.confirm = null;
    }
    render(app);
  };
  app.onclick = e => {
    const id = e.target.id;
    if (id === "b-export") {
      const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "jlpt-n1-backup-" + today() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      ui.message = "백업 파일을 내려받았어요.";
      render(app);
    } else if (id === "b-import-yes") {
      try { store.importAll(ui.pending); ui.message = "백업 파일의 기록으로 복원했어요."; }
      catch (err) { ui.message = "복원할 수 없어요: " + err.message; }
      ui.pending = null; ui.confirm = null; render(app);
    } else if (id === "b-reset") { ui.confirm = "reset"; render(app); }
    else if (id === "b-reset-yes") {
      store.resetAll();
      try { localStorage.removeItem("n1lab:mockDraft"); } catch (err) { /* 무시 */ }
      ui.confirm = null; ui.message = "모든 기록을 지웠어요."; render(app);
    } else if (id === "b-cancel") { ui.confirm = null; ui.pending = null; render(app); }
  };
}

export default { id: "backup", label: "기록 관리", render, leave: () => { ui.confirm = null; ui.pending = null; } };
