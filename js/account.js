// 내 계정 정보(프로필)와 공부 파트너 연결 상태를 서버(Supabase)에서 읽고 쓴다
// 프로필: 닉네임·급수. 급수는 개인 설정이고, 파트너 연결과는 관계없다.
import { getClient, currentUser, signedIn } from "./auth.js";

let profile;        // undefined = 아직 모름(못 불러옴), null = 아직 만들지 않음
let couple;         // undefined = 모름, null = 연결 없음, { coupleId, partnerId }

const db = () => getClient();
const me = () => (currentUser() || {}).id;

export const myProfile = () => profile;
export const myCouple = () => couple;
export function resetAccount() { profile = undefined; couple = undefined; }

// 로그인했으면 프로필을 불러온다. 못 불러오면(인터넷 문제 등) undefined로 둔다
export async function loadProfile() {
  if (!signedIn() || !db()) { profile = null; return null; }
  const { data, error } = await db().from("profiles").select("id, nickname, jlpt_level, avatar_path, time_zone").eq("id", me()).maybeSingle();
  if (error) { console.error("프로필을 불러오지 못했어요.", error); profile = undefined; return undefined; }
  profile = data || null;
  return profile;
}

export async function saveProfile(nickname, level) {
  const row = { id: me(), nickname: nickname.trim(), jlpt_level: level, updated_at: new Date().toISOString() };
  const { data, error } = await db().from("profiles").upsert(row).select("id, nickname, jlpt_level, avatar_path, time_zone").single();
  if (error) throw error;
  profile = data;
  return data;
}

/* ---------- 공부 파트너 연결 ---------- */
export async function loadCouple() {
  const { data, error } = await db().from("couple_members").select("user_id, couple_id");
  if (error) throw error;
  if (!data || !data.length) { couple = null; return null; }
  const partner = data.find(r => r.user_id !== me());
  couple = { coupleId: data[0].couple_id, partnerId: partner ? partner.user_id : null };
  return couple;
}

export async function partnerProfile() {
  const { data, error } = await db().rpc("get_partner_profile");
  if (error) throw error;
  return (data && data[0]) || null;
}

export async function partnerSummary(partnerId) {
  const { data, error } = await db().from("shared_summaries").select("data, updated_at").eq("user_id", partnerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function pushSummary(data) {
  const { error } = await db().from("shared_summaries").upsert({ user_id: me(), data, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function createCode() {
  const { data, error } = await db().rpc("create_connection_code");
  if (error) throw error;
  return data;
}

export async function myCodeState() {
  const { data, error } = await db().from("connection_codes").select("owner, expires_at, used_at").eq("owner", me()).maybeSingle();
  if (error) throw error;
  return data;
}

export async function requestWithCode(code) {
  const { data, error } = await db().rpc("request_connection", { p_code: code });
  if (error) throw error;
  return data;   // { status, request_id }
}

export async function pendingRequests() {
  const { data, error } = await db().from("connection_requests").select("id, owner, requester, status, created_at")
    .eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw error;
  const mine = me();
  return { incoming: (data || []).filter(r => r.owner === mine), outgoing: (data || []).filter(r => r.requester === mine) };
}

export async function respond(requestId, accept) {
  const { data, error } = await db().rpc("respond_connection", { p_request: requestId, p_accept: accept });
  if (error) throw error;
  return data;
}

export async function cancelRequest(requestId) {
  const { error } = await db().rpc("cancel_connection_request", { p_request: requestId });
  if (error) throw error;
}

export async function unlink() {
  const { error } = await db().rpc("unlink_couple");
  if (error) throw error;
  couple = null;
}

/* ---------- 응원 메시지 ---------- */
export async function listMessages() {
  const { data, error } = await db().from("encouragement_messages")
    .select("id, sender, receiver, body, created_at, read_at, hidden_by_receiver, original_at")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}

export async function sendMessage(body) {
  if (!couple || !couple.partnerId) throw new Error("NOT_CONNECTED");
  const { error } = await db().from("encouragement_messages").insert({ couple_id: couple.coupleId, receiver: couple.partnerId, body: body.trim() });
  if (error) throw error;
}

export async function markRead() {
  const { error } = await db().from("encouragement_messages").update({ read_at: new Date().toISOString() })
    .eq("receiver", me()).is("read_at", null);
  if (error) throw error;
}

export async function deleteMessage(id) {
  const { error } = await db().from("encouragement_messages").delete().eq("id", id).eq("sender", me());
  if (error) throw error;
}

export const myId = me;
