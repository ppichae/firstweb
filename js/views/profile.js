// 프로필 설정: 처음 로그인하면 닉네임과 공부할 급수(N1·N3)를 정한다. 나중에 '공부 파트너' 화면에서 바꿀 수 있다
// 급수는 개인 설정일 뿐이라, 바꿔도 파트너 연결이나 학습 기록에 영향이 없다.
import { esc } from "../util.js";
import { userLabel, takeNext } from "../auth.js";
import { myProfile, saveProfile } from "../account.js";
import { lastRoom } from "../rooms.js";

function render(app) {
  const p = myProfile();
  const first = !p;
  const nick = p ? p.nickname : userLabel().slice(0, 20);
  const level = p ? p.jlpt_level : (lastRoom() === "n3" ? "N3" : "N1");
  app.innerHTML =
    '<section class="panel login-panel">' +
      '<form class="login-card profile-card" id="profile-form">' +
        "<h2>" + (first ? "처음 오셨네요" : "프로필 바꾸기") + "</h2>" +
        '<p class="login-lede">' + (first ? "공부를 시작하기 전에 닉네임과 공부할 급수를 정해 주세요. 나중에 언제든 바꿀 수 있어요." : "닉네임과 급수를 바꿀 수 있어요. 급수를 바꿔도 학습 기록과 공부 파트너 연결은 그대로예요.") + "</p>" +
        '<label class="field full"><span>닉네임 <small class="hint">(1~20자, 공부 파트너에게 보여요)</small></span>' +
          '<input id="pf-nick" maxlength="20" required value="' + esc(nick) + '" autocomplete="nickname"></label>' +
        '<fieldset class="level-pick"><legend>공부할 급수</legend>' +
          ["N1", "N3"].map(l => '<label class="level-opt"><input type="radio" name="pf-level" value="' + l + '"' + (l === level ? " checked" : "") + '><span lang="ja">' + l + "</span></label>").join("") +
        "</fieldset>" +
        '<p class="hint">프로필 사진은 지금은 닉네임 첫 글자로 보여 줘요.</p>' +
        '<p class="login-error" id="pf-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn" id="pf-save">' + (first ? "설정 완료하고 공부 시작" : "저장") + "</button>" +
        (first ? "" : '<a class="btn ghost" href="#partner">돌아가기</a>') +
      "</form>" +
    "</section>";
  app.querySelector("#profile-form").onsubmit = async e => {
    e.preventDefault();
    const nickname = app.querySelector("#pf-nick").value.trim();
    const lv = (app.querySelector('input[name="pf-level"]:checked') || {}).value;
    const box = app.querySelector("#pf-error");
    if (!nickname || nickname.length > 20 || !lv) { box.textContent = "닉네임(1~20자)과 급수를 정해 주세요."; box.hidden = false; return; }
    const btn = app.querySelector("#pf-save");
    btn.disabled = true;
    try {
      await saveProfile(nickname, lv);
      window.dispatchEvent(new Event("account-changed"));
      location.replace("#" + (first ? (takeNext() || (lv === "N3" ? "n3" : "home")) : "partner"));
    } catch (err) {
      btn.disabled = false;
      box.textContent = "저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요. (" + (err.message || "알 수 없는 오류") + ")";
      box.hidden = false;
    }
  };
}

export const profileView = {
  id: "profile", label: "프로필", render,
  docTitle: "프로필 · JLPT 공부방",
  eyebrow: "日本語能力試験 · JLPT",
  title: 'JLPT <span lang="ja">合格!</span>',
  lede: "닉네임과 공부할 급수를 정해요.",
};
