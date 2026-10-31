// 로그인 화면: Google 계정으로 로그인한다
// Supabase가 아직 연결되지 않았으면 버튼을 누를 수 없게 두고 '준비 중'이라고 솔직하게 알린다 (로그인된 것처럼 꾸미지 않는다)
import { authConfigured, authPreview, signedIn, signInWithGoogle, peekNext } from "../auth.js";

// Google 로고 (Google 로그인 버튼 안내에 맞춘 G 모양)
const G_LOGO = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
  '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
  '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
  '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
  '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

function render(app) {
  const ready = authConfigured();
  const preview = authPreview();
  const wanted = peekNext();
  app.innerHTML =
    '<section class="panel login-panel">' +
      '<div class="login-card">' +
        '<div class="login-mark" lang="ja" aria-hidden="true">合</div>' +
        "<h2>로그인</h2>" +
        '<p class="login-lede">Google 계정으로 로그인하면 학습 기록이 내 계정에 저장되고, 다른 기기에서도 이어서 공부할 수 있어요.</p>' +
        (wanted && !signedIn() ? '<p class="notice" role="status">학습 화면은 로그인한 뒤에 볼 수 있어요. 로그인하면 보려던 화면으로 바로 이동해요.</p>' : "") +
        '<button type="button" class="google-btn" id="google-login"' + (ready ? "" : ' disabled aria-describedby="login-state"') + ">" +
          G_LOGO + "<span>Google 계정으로 로그인</span></button>" +
        (ready
          ? '<p class="login-error" id="login-error" role="alert" hidden></p>'
          : '<p class="login-state" id="login-state"><span class="badge warn">준비 중</span> 로그인 기능을 아직 연결하지 않았어요. 지금은 버튼을 눌러도 로그인되지 않아요.</p>') +
        (!ready && !preview ? '<a class="btn ghost login-skip" href="#rooms">지금은 로그인 없이 공부하기</a>' : "") +
        (preview ? '<p class="hint">미리보기 모드예요. 로그인이 연결된 뒤처럼 학습 화면을 잠가서 흐름만 보여 줘요.</p>' : "") +
        '<p class="hint login-note">로그인에는 이름·이메일·프로필 사진만 쓰여요. 기존에 이 브라우저에 저장된 학습 기록은 지워지지 않아요.</p>' +
      "</div>" +
    "</section>";
  const btn = app.querySelector("#google-login");
  if (ready) btn.onclick = async () => {
    btn.disabled = true;
    try { await signInWithGoogle(); }   // 성공하면 Google 화면으로 넘어갔다가 돌아온다
    catch (e) {
      btn.disabled = false;
      const box = app.querySelector("#login-error");
      box.textContent = "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요. (" + (e.message || "알 수 없는 오류") + ")";
      box.hidden = false;
    }
  };
}

export const loginView = {
  id: "login", label: "로그인", render,
  docTitle: "로그인 · JLPT 공부방",
  eyebrow: "日本語能力試験 · JLPT",
  title: 'JLPT <span lang="ja">合格!</span>',
  lede: "N1·N3 단어, 문법, 한자, 독해, 청해를 내 계정에서 이어서 공부해요.",
};
