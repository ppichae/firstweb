// 로그인 상태와 '로그인해야 학습 화면에 들어갈 수 있는' 문(게이트)을 관리한다
// 아직 Supabase가 연결되지 않았으면(auth-config.js가 비어 있으면) 로그인은 '준비 중'이고 문도 열어 둔다.
// 그래서 지금은 기존처럼 로그인 없이 공부할 수 있다. 연결된 뒤에는 로그인 전 학습 화면이 잠긴다.
import { AUTH_CONFIG } from "./auth-config.js";

// Supabase 자바스크립트 도구: 설정이 채워졌을 때만 불러온다 (지금은 불러오지 않는다)
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const NEXT_KEY = "jlpt:afterLogin";

export const authConfigured = () => !!(AUTH_CONFIG.supabaseUrl && AUTH_CONFIG.publishableKey);

// 주소에 ?auth=preview를 붙이면, 로그인이 연결된 뒤처럼 문을 잠가서 화면 흐름만 미리 볼 수 있다 (로그인은 되지 않는다)
export const authPreview = () => new URLSearchParams(location.search).get("auth") === "preview";

let client = null;
let session = null;
let loginError = "";   // Google에서 로그인을 취소하거나 실패하고 돌아왔을 때의 안내

export const peekLoginError = () => loginError;
export const clearLoginError = () => { loginError = ""; };

// 사이트를 열 때 한 번 부른다. 연결 전에는 아무 일도 하지 않는다
export async function initAuth(onChange) {
  if (!authConfigured()) return;
  const { createClient } = await import(SUPABASE_JS);
  client = createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  // 처음 연결할 때 Supabase 도구가 주소의 일회용 코드(?code=…)를 로그인 상태로 바꾼다. 실패하면 그 이유를 받아 둔다
  const init = await client.auth.initialize();
  const { data } = await client.auth.getSession();
  session = data.session;
  const q = new URLSearchParams(location.search);
  if (q.has("code") && !session) {
    console.error("로그인 코드 처리 실패", init && init.error);
    loginError = (init && init.error && init.error.message) || "로그인 정보를 확인하지 못했어요";
  }
  // Google에서 돌아올 때 주소에 붙은 일회용 코드를 처리한 뒤 주소창에서 지운다
  if (q.has("code") || q.has("error")) {
    if (q.has("error")) loginError = q.get("error_description") || q.get("error");
    ["code", "error", "error_code", "error_description", "state"].forEach(k => q.delete(k));
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
  }
  // 로그인·로그아웃처럼 상태가 실제로 바뀔 때만 화면을 다시 그린다 (연결 직후 보내는 '현재 상태' 알림에는 다시 그리지 않는다)
  client.auth.onAuthStateChange((_event, s) => {
    const before = session ? session.user.id : null, after = s ? s.user.id : null;
    session = s;
    if (before !== after && onChange) onChange();
  });
}

export const signedIn = () => !!session;
export const currentUser = () => (session ? session.user : null);
// 화면에 보일 이름: Google 이름 → 이메일 순
export function userLabel() {
  const u = currentUser();
  if (!u) return "";
  const m = u.user_metadata || {};
  return m.full_name || m.name || u.email || "로그인한 사용자";
}

// 자동 테스트용: 이 컴퓨터의 테스트 서버(localhost)에서 ?auth=off를 붙였을 때만 잠금을 끈다 (실제 사이트에서는 통하지 않는다)
const testBypass = () => (location.hostname === "localhost" || location.hostname === "127.0.0.1") &&
  new URLSearchParams(location.search).get("auth") === "off";

// 문이 잠겨 있는가: 연결됐거나 미리보기일 때만 잠근다
export const gateActive = () => !testBypass() && (authConfigured() || authPreview());

export async function signInWithGoogle() {
  if (!client) throw new Error("로그인 기능이 아직 연결되지 않았어요.");
  const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: AUTH_CONFIG.redirectTo } });
  if (error) throw error;
}

export async function signOut() { if (client) await client.auth.signOut(); session = null; }

// 로그인 화면으로 보내기 전에, 가려던 화면을 기억해 두었다가 로그인 뒤에 그 화면으로 보낸다
export function rememberNext(id) { try { sessionStorage.setItem(NEXT_KEY, id); } catch (e) { /* 기억하지 못하면 첫 화면으로 간다 */ } }
export function takeNext() {
  try { const id = sessionStorage.getItem(NEXT_KEY); sessionStorage.removeItem(NEXT_KEY); return id; } catch (e) { return null; }
}
export function peekNext() { try { return sessionStorage.getItem(NEXT_KEY); } catch (e) { return null; } }
