// 학습 기록 동기화: 로그인한 계정의 학습 기록을 서버(Supabase)와 맞춘다
//
// 구조 (설계 승인안)
//   snap  : 서버가 확인한 기록 (서버 값 그대로)
//   outbox: 아직 서버가 확인하지 않은 변경 (고유 번호 포함). 학습 기록과 함께 이 기기에 먼저 저장한다
//   view  : 화면이 보는 기록 = snap + outbox를 차례로 적용한 결과
// 숫자(오답 횟수·공부 시간 등)는 '늘어난 만큼'만 고유 번호를 달아 보내므로, 다시 보내도 서버가 한 번만 받는다.
// 선택 상태는 서버 버전으로 비교해서, 다른 기기가 먼저 바꿨으면 덮어쓰지 않고 '확인 필요'로 남긴다.
import { SCHEMA, isRegistered, cellKey, diff, flatten, readCell, writeCell, pickMinMax, stable } from "./sync-schema.js";
import { initPersist, persistMode, getPrefix, putMany } from "./persist.js";
import { getClient } from "./auth.js";
import { dateKey } from "./util.js";

const ROOMS = ["n1", "n3"];
const LIST_KINDS = Object.fromEntries(Object.entries(SCHEMA).filter(([, s]) => s.kind === "list").map(([k, s]) => [s.event, k]));
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const fault = name => isLocal && window.__syncFault && window.__syncFault[name];   // 테스트 서버에서만: 강제 종료 상황 흉내

let S = null;
if (isLocal) window.__syncState = () => S;   // 테스트 서버에서만: 테스트가 속을 들여다본다
const listeners = new Set();
export const onSyncStatus = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function emit() { const st = syncStatus(); listeners.forEach(f => { try { f(st); } catch (e) { /* 무시 */ } }); }

export const syncActive = () => !!S;
export const syncRoom = prefix => (S ? (prefix === "n1lab:" ? "n1" : prefix === "n3lab:" ? "n3" : null) : null);
const db = () => getClient();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const K = (...p) => "u:" + S.uid + ":" + p.join(":");

export function deviceId() {
  try {
    let id = localStorage.getItem("jlpt:device");
    if (!id) { id = uuid(); localStorage.setItem("jlpt:device", id); }
    return id;
  } catch (e) { return "unknown"; }
}

export function syncStatus() {
  if (!S) return { active: false };
  return {
    active: true, pending: S.outbox.filter(e => !S.acked.has(e.id)).length, conflicts: S.conflicts.length,
    lastSync: S.meta.lastSync || null, error: S.error, storage: persistMode(), storageError: S.storageError, pulledAt: S.meta.lastPull || null,
  };
}

// 등록되지 않은 기록: 동기화하지 않고 개발자에게 알리며, 무엇이 빠졌는지 따로 남긴다
function logUnregistered(what) {
  console.error("[동기화] 등록되지 않은 기록이라 서버로 보내지 않았어요:", what);
  try {
    const log = JSON.parse(localStorage.getItem("sync:unregistered") || "[]");
    if (!log.some(x => x.what === what)) { log.push({ what, at: new Date().toISOString() }); localStorage.setItem("sync:unregistered", JSON.stringify(log.slice(-100))); }
  } catch (e) { /* 무시 */ }
}

/* ---------- 화면이 보는 기록 ---------- */
export function viewGet(room, key) { return S.view[room][key]; }

function applyEntry(target, e) {
  const room = target[e.room] || (target[e.room] = {});
  if (e.type === "item") {
    const list = Array.isArray(room[e.area]) ? room[e.area] : (room[e.area] = []);
    if (!list.some(x => x && x.id === e.id)) list.push(clone(e.data));
  } else if (e.type === "delta") {
    const cur = Number(readCell(e.area, room[e.area], e.item, e.field)) || 0;
    room[e.area] = writeCell(e.area, room[e.area], e.item, e.field, cur + e.delta);
  } else if (e.type === "op") {
    const cur = readCell(e.area, room[e.area], e.item, e.field);
    const v = e.kind === "set" ? e.value : pickMinMax(e.kind, cur, e.value);
    room[e.area] = writeCell(e.area, room[e.area], e.item, e.field, v);
  }
}
function rebuildView() {
  const v = {};
  ROOMS.forEach(r => { v[r] = clone(S.snap[r] || {}); });
  S.outbox.forEach(e => { if (!S.acked.has(e.id)) applyEntry(v, e); });
  S.view = v;
}

/* ---------- 저장 (이 기기) ---------- */
async function save(entries, deletes) {
  const me = S;   // 저장하는 사이에 로그아웃할 수 있다
  try { await putMany(entries, deletes); if (S === me) S.storageError = null; }
  catch (e) { if (S === me) S.storageError = e.message || "저장 실패"; console.error("[동기화] 이 기기에 저장하지 못했어요.", e); emit(); }
}
const outboxEntries = () => [[K("outbox"), S.outbox], [K("acked"), [...S.acked].slice(-3000)]];

// 화면에서 기록이 바뀌었을 때 store.js가 부른다. 바뀐 내용을 보낼 목록에 넣고, 이 기기에 먼저 저장한다
export function change(room, key, prev, next) {
  if (!S) return;
  S.view[room][key] = next;
  if (!isRegistered(key)) { logUnregistered(room + "." + key); return; }
  const spec = SCHEMA[key];
  if (spec.kind === "local") {
    S.snap[room][key] = clone(next);
    save([[K("snap", room, key), S.snap[room][key]]]);
    return;
  }
  const d = diff(key, prev, next, uuid);
  d.unknown.forEach(u => logUnregistered(room + "." + u));
  if (d.truncated) logUnregistered(room + "." + key + "(목록 줄이기는 '기록 지우기'로만 해요)");
  const now = new Date().toISOString();
  const add = [];
  d.ops.forEach(o => add.push({ id: uuid(), type: "op", room, area: key, item: o.item, field: o.field, kind: o.kind, value: o.value, at: now }));
  d.deltas.forEach(x => add.push({ id: uuid(), type: "delta", room, area: key, item: x.item, field: x.field, delta: x.delta, at: now, day: key === "activity" ? x.item : dateKey(new Date()) }));
  d.items.forEach(it => add.push({ id: it.id, type: "item", room, area: key, data: clone(it), at: new Date(it.at || Date.now()).toISOString() }));
  if (spec.kind === "obj" && spec.localFields) {   // 경험치 환산 기록처럼 이 기기에만 두는 칸
    const loc = {}; spec.localFields.forEach(f => { if (next && next[f] !== undefined) loc[f] = next[f]; });
    S.snap[room][key + ":local"] = loc;
    save([[K("snap", room, key + ":local"), loc]]);   // 하루 한 번 규칙(todayKeys)이 새로고침 뒤에도 이어지게 바로 저장한다
  }
  if (!add.length) return;
  S.outbox.push(...add);
  save(outboxEntries());
  scheduleFlush();
  emit();
}

/* ---------- 보내기 (서버로) ---------- */
let flushTimer = null, flushing = null;
function scheduleFlush(ms = 2000) { clearTimeout(flushTimer); flushTimer = setTimeout(() => flush(), ms); }

const eventRow = e => e.type === "item"
  ? { event_id: e.id, room: e.room, kind: SCHEMA[e.area].event, area: e.area, occurred_at: e.at, day: dateKey(new Date(e.at)), data: e.data, device_id: deviceId() }
  : { event_id: e.id, room: e.room, kind: "delta", area: e.area, item_id: e.item, field: e.field, delta: e.delta, occurred_at: e.at, day: e.day, device_id: deviceId() };

// 보내기와 받아 오기는 한 번에 하나씩 차례로 한다. 함께 하면, 받아 오는 사이에 보낸 기록이 화면에서 빠질 수 있다
let chain = Promise.resolve();
function serial(fn) { const run = chain.then(fn); chain = run.catch(() => {}); return run; }

export function flush() {
  if (!S || flushing) return flushing || Promise.resolve();
  if (fault("noFlush")) return Promise.resolve();
  const me = S;   // 보내는 사이에 로그아웃하면 멈춘다
  flushing = serial(async () => {
    try {
      for (let round = 0; round < 50; round++) {
        if (S !== me) break;
        const pend = S.outbox.filter(e => !S.acked.has(e.id));
        if (!pend.length) break;
        const evs = pend.filter(e => e.type !== "op").slice(0, 200);
        if (evs.length) {
          const { error } = await db().from("study_events").upsert(evs.map(eventRow), { onConflict: "event_id", ignoreDuplicates: true });
          if (error) throw error;
          if (fault("dropAck")) throw new Error("테스트: 응답을 받지 못한 것처럼");
          if (S !== me) break;
          await ack(evs, null);
          continue;
        }
        // 선택 상태: 같은 칸의 변경은 한 번에 하나씩 보내서, 앞의 결과(버전)를 다음 변경이 이어받게 한다
        const seen = new Set(), ops = [];
        for (const e of pend) {
          const c = cellKey(e.room, e.area, e.item, e.field);
          if (e.type === "op" && !seen.has(c)) { seen.add(c); ops.push(e); if (ops.length >= 100) break; }
        }
        const payload = ops.map(e => ({ op_id: e.id, room: e.room, area: e.area, item_id: e.item, field: e.field, kind: e.kind, value: e.value,
          base_version: S.ver[cellKey(e.room, e.area, e.item, e.field)] || 0, device_id: deviceId(), client_at: e.at }));
        const { data, error } = await db().rpc("apply_state_ops", { ops: payload });
        if (error) throw error;
        if (fault("dropAck")) throw new Error("테스트: 응답을 받지 못한 것처럼");
        if (S !== me) break;
        await ack(ops, data);
      }
      if (S !== me) return;
      S.error = null;
      S.meta.lastSync = new Date().toISOString();
      save([[K("meta"), S.meta]]);
    } catch (e) {
      if (S === me) { S.error = e.message || "보내지 못했어요"; scheduleFlush(15000); }   // 인터넷이 끊겼으면 잠시 뒤 다시
    }
    if (S === me && S.needPull) { S.needPull = false; await pullNow().catch(() => {}); }
    emit();
  }).finally(() => {
    flushing = null;
    if (S === me && !S.error && S.outbox.some(e => !S.acked.has(e.id))) scheduleFlush();   // 보내는 사이에 새로 생긴 기록
  });
  return flushing;
}

// 서버가 받은 변경을 서버 기록(snap)으로 옮기고, 보낼 목록에서 뺀다 (한 번에 저장)
async function ack(entries, results) {
  const writes = new Map(), byId = new Map((results || []).map(r => [r.op_id, r]));
  let rebuild = false;
  entries.forEach(e => {
    const room = S.snap[e.room];
    if (e.type === "item") {
      const list = Array.isArray(room[e.area]) ? room[e.area] : (room[e.area] = []);
      if (!list.some(x => x && x.id === e.id)) list.push(clone(e.data));
      writes.set(K("item", e.room, e.area, e.id), clone(e.data));
    } else if (e.type === "delta") {
      const cur = Number(readCell(e.area, room[e.area], e.item, e.field)) || 0;
      room[e.area] = writeCell(e.area, room[e.area], e.item, e.field, cur + e.delta);
      writes.set(K("snap", e.room, e.area), room[e.area]);
    } else {
      const r = byId.get(e.id) || {};
      const c = cellKey(e.room, e.area, e.item, e.field);
      if (r.duplicate) { S.needPull = true; rebuild = true; }
      else if (r.status === "applied") {
        room[e.area] = writeCell(e.area, room[e.area], e.item, e.field, r.value === undefined ? e.value : r.value);
        if (r.version) S.ver[c] = r.version;
        writes.set(K("snap", e.room, e.area), room[e.area]);
        if (stable(r.value) !== stable(e.kind === "set" ? e.value : r.value)) rebuild = true;
      } else { S.needPull = true; rebuild = true; }      // 확인 필요(다른 기기가 먼저 바꿈) → 서버 값 유지
    }
    S.acked.add(e.id);
  });
  const done = new Set(entries.map(e => e.id));
  S.outbox = S.outbox.filter(e => !done.has(e.id));
  const me = S;
  await save([...writes.entries(), [K("ver"), S.ver], ...outboxEntries()]);
  if (rebuild && S === me) rebuildView();
}

/* ---------- 받아 오기 (서버에서) ---------- */
async function fetchAll(make) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const pull = () => serial(pullNow);
async function pullNow() {
  if (!S) return;
  const me = S;   // 받아 오는 사이에 로그아웃하면 결과를 버린다
  const [states, totalsRes, items, conflicts] = await Promise.all([
    fetchAll(() => db().from("learning_state").select("room, area, item_id, field, value, version").order("room")),
    db().rpc("my_counter_totals"),
    fetchAll(() => db().from("study_events").select("event_id, room, area, data, occurred_at").in("kind", Object.keys(LIST_KINDS)).order("occurred_at")),
    fetchAll(() => db().from("state_ops").select("op_id, room, area, item_id, field, value, received_at, device_id").eq("status", "pending_review").order("received_at")),
  ]);
  if (totalsRes.error) throw totalsRes.error;
  if (S !== me) return;
  const snap = {}, ver = {};
  ROOMS.forEach(r => {
    snap[r] = {};
    Object.keys(SCHEMA).forEach(k => {
      if (SCHEMA[k].kind === "local") { if (S.snap[r] && S.snap[r][k] !== undefined) snap[r][k] = S.snap[r][k]; }
    });
    Object.keys(S.snap[r] || {}).forEach(k => { if (k.endsWith(":local")) snap[r][k] = S.snap[r][k]; });
  });
  const touch = (room, area) => { if (!snap[room]) snap[room] = {}; return snap[room]; };
  states.forEach(s => {
    if (!isRegistered(s.area)) { logUnregistered(s.room + "." + s.area + "(서버)"); return; }
    ver[cellKey(s.room, s.area, s.item_id, s.field)] = s.version;
    if (s.value === null) return;
    const room = touch(s.room);
    room[s.area] = writeCell(s.area, room[s.area], s.item_id, s.field, s.value);
  });
  (totalsRes.data || []).forEach(t => {
    if (!isRegistered(t.area)) return;
    const room = touch(t.room);
    room[t.area] = writeCell(t.area, room[t.area], t.item_id, t.field, Number(t.total));
  });
  const itemWrites = [];
  items.forEach(it => {
    if (!isRegistered(it.area)) return;
    const room = touch(it.room);
    const list = room[it.area] || (room[it.area] = []);
    const data = Object.assign({}, it.data, { id: it.event_id });
    list.push(data);
    itemWrites.push([K("item", it.room, it.area, it.event_id), data]);
  });
  // 게임 기록의 이 기기 전용 칸을 다시 붙인다
  ROOMS.forEach(r => { const loc = snap[r]["game:local"]; if (loc && snap[r].game) Object.assign(snap[r].game, loc); });
  // 이 기기에 남은 예전 서버 기록(취소·지우기로 사라진 것)은 지운다
  const old = await getPrefix("u:" + S.uid + ":item:");
  if (S !== me) return;
  const keep = new Set(itemWrites.map(([k]) => k));
  const deletes = Object.keys(old).filter(k => !keep.has(k));
  S.snap = snap; S.ver = ver; S.conflicts = conflicts;
  S.meta.lastPull = new Date().toISOString();
  const snapWrites = [];
  ROOMS.forEach(r => Object.keys(snap[r]).forEach(k => { if (SCHEMA[k] && SCHEMA[k].kind === "list") return; snapWrites.push([K("snap", r, k), snap[r][k]]); }));
  await save([...snapWrites, ...itemWrites.filter(([k]) => !(k in old)), [K("ver"), ver], [K("meta"), S.meta]], deletes);
  if (S !== me) return;
  rebuildView();
  emit();
}

/* ---------- 시작·끝 ---------- */
let startGen = 0;
export async function startSync(uid) {
  stopSync();
  const gen = startGen;   // 기다리는 사이에 다시 시작·끝내면 이번 시작은 그만둔다
  await initPersist();
  const s = { uid, snap: { n1: {}, n3: {} }, ver: {}, outbox: [], acked: new Set(), meta: {}, view: null, conflicts: [], error: null, storageError: null, needPull: false };
  if (persistMode() === "none") s.storageError = "이 브라우저에서는 기록을 저장할 수 없어요";
  const all = await getPrefix("u:" + uid + ":").catch(() => ({}));
  if (gen !== startGen) return;
  const lists = {};
  Object.keys(all).forEach(k => {
    const p = k.split(":");      // u, uid, kind, ...
    if (p[2] === "snap") { s.snap[p[3]] = s.snap[p[3]] || {}; s.snap[p[3]][p.slice(4).join(":")] = all[k]; }
    else if (p[2] === "item") { const key = p[3] + ":" + p[4]; (lists[key] = lists[key] || []).push(all[k]); }
    else if (p[2] === "outbox") s.outbox = all[k] || [];
    else if (p[2] === "acked") s.acked = new Set(all[k] || []);
    else if (p[2] === "ver") s.ver = all[k] || {};
    else if (p[2] === "meta") s.meta = all[k] || {};
  });
  Object.keys(lists).forEach(k => {
    const [room, area] = k.split(":");
    s.snap[room] = s.snap[room] || {};
    s.snap[room][area] = lists[k].sort((a, b) => (a.at || 0) - (b.at || 0));
  });
  // 전에 IndexedDB가 응답하지 않아 기본 저장소(localStorage)에 남긴 '보내지 않은 기록'이 있으면 합친다
  const lsOutbox = "jlpt:sync:u:" + uid + ":outbox";
  let merged = false;
  if (persistMode() === "idb") {
    try {
      const raw = localStorage.getItem(lsOutbox);
      if (raw) {
        const ids = new Set(s.outbox.map(e => e.id));
        JSON.parse(raw).forEach(e => { if (e && e.id && !ids.has(e.id)) s.outbox.push(e); });
        merged = true;
      }
    } catch (e) { /* 읽을 수 없으면 건너뛴다 */ }
  }
  // 이 기기에 저장된 계정 기록을 다 읽은 뒤에야 화면이 계정 기록을 보게 한다
  S = s;
  if (merged) putMany(outboxEntries()).then(() => { try { localStorage.removeItem(lsOutbox); } catch (e) { /* 무시 */ } }).catch(() => {});
  rebuildView();
  // 서버 기록을 받아 와서 합친다 (인터넷이 없으면 이 기기 기록으로 시작하고 나중에 다시)
  const first = pull();
  try { await withTimeout(first, 15000); }
  catch (e) {
    if (S === s) S.error = "서버와 아직 맞추지 못했어요: " + (e.message || "");
    // 늦게라도 받아 오면 오류를 지우고 화면을 다시 그리게 알린다
    first.then(() => { if (S === s) { S.error = null; emit(); window.dispatchEvent(new Event("sync-late")); } }).catch(() => {});
  }
  if (S !== s) return;
  flush();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("online", onOnline);
  emit();
}
export function stopSync() {
  startGen++;
  clearTimeout(flushTimer);
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("pagehide", onHide);
  window.removeEventListener("online", onOnline);
  S = null;
  emit();
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("시간 초과")), ms))]);
function onVisible() {
  if (!S) return;
  if (document.visibilityState === "hidden") { flush(); return; }
  const last = S.meta.lastPull ? Date.parse(S.meta.lastPull) : 0;
  if (Date.now() - last > 60000) flush().then(() => pull()).then(() => window.dispatchEvent(new Event("sync-pulled"))).catch(() => {});
}
function onHide() { if (S) flush(); }
function onOnline() { if (S) flush(); }

/* ---------- 확인 필요(충돌) ---------- */
export const conflicts = () => (S ? S.conflicts : []);
export async function resolveConflict(opId, accept) {
  const { error } = await db().rpc("resolve_state_conflict", { p_op: opId, p_accept: accept });
  if (error) throw error;
  await pull();
}

/* ---------- 기록 지우기 (계정) ---------- */
export async function resetRoom(room) {
  await flush();
  const { error } = await db().rpc("reset_my_room", { p_room: room });
  if (error) throw error;
  if (!S) return;
  S.outbox = S.outbox.filter(e => e.room !== room);
  await save(outboxEntries());
  await pull();
}

/* ---------- 예전 기록 가져오기·취소 ---------- */
const LEGACY_PREFIX = { n1: "n1lab:", n3: "n3lab:" };
// 이 기기 브라우저에 남아 있는 예전 기록(로그인 전 기록). 읽기만 하고 바꾸지 않는다
export function legacyData(room) {
  const out = {};
  try {
    Object.keys(SCHEMA).forEach(k => {
      const raw = localStorage.getItem(LEGACY_PREFIX[room] + k);
      if (raw) out[k] = JSON.parse(raw);
    });
  } catch (e) { /* 읽을 수 없으면 빈 기록 */ }
  return out;
}
export function countData(data) {
  const n = o => (o && typeof o === "object" ? Object.keys(o).length : 0);
  return {
    attempts: (data.attempts || []).length, words: n(data.words) + n(data.lists), grammar: n(data.grammar), kanji: n(data.kanji),
    studyDays: Object.keys(data.activity || {}).length, mocks: (data.mocks || []).length + (data.tests || []).length, cheers: (data.cheers || []).length,
    minutes: Math.floor(Object.values(data.activity || {}).reduce((s, d) => s + (d.seconds || 0), 0) / 60),
  };
}

// 가져오기: 예전 기록을 가져오기 번호를 붙여 서버에 올린다. 같은 기록은 내용 식별자(source_key)로 두 번 올라가지 않는다
export async function importData(byRoom, source, label) {
  await flush();
  const counts = {}; Object.keys(byRoom).forEach(r => { counts[r] = countData(byRoom[r]); });
  const { data: batch, error: be } = await db().from("import_batches").insert({ source, device_label: label, counts }).select("id").single();
  if (be) throw be;
  const events = [], ops = [], cheers = [];
  Object.keys(byRoom).forEach(room => {
    const data = byRoom[room];
    Object.keys(data).forEach(key => {
      const spec = SCHEMA[key], val = data[key];
      if (!spec || val == null) return;
      if (spec.kind === "list") {
        const seen = {};
        (Array.isArray(val) ? val : []).forEach(it => {
          if (!it || typeof it !== "object") return;
          const base = [room, key, it.at || "", it.qid || "", it.choice === undefined ? "" : it.choice].join(":");
          seen[base] = (seen[base] || 0) + 1;
          events.push({ event_id: uuid(), room, kind: spec.event, area: key, occurred_at: new Date(it.at || Date.now()).toISOString(),
            day: dateKey(new Date(it.at || Date.now())), data: Object.assign({}, it, { id: undefined }), import_batch_id: batch.id,
            source_key: base + ":" + seen[base], device_id: deviceId() });
        });
      } else if (key === "cheers") {
        const seen = {};
        (Array.isArray(val) ? val : []).forEach(c => {
          if (!c || !c.text) return;
          const base = [room, "cheer", c.at || ""].join(":");
          seen[base] = (seen[base] || 0) + 1;
          cheers.push({ room, body: String(c.text).slice(0, 500), written_at: new Date(c.at || Date.now()).toISOString(), import_batch_id: batch.id, source_key: base + ":" + seen[base] });
        });
      } else if (spec.kind !== "local") {
        flatten(key, val).cells.forEach(c => {
          if (c.type === "counter") {
            const d = Number(c.value) || 0;
            if (d) events.push({ event_id: uuid(), room, kind: "delta", area: key, item_id: c.item, field: c.field, delta: d,
              occurred_at: new Date().toISOString(), day: key === "activity" ? c.item : null, import_batch_id: batch.id,
              source_key: [room, "delta", key, c.item, c.field].join(":"), device_id: deviceId() });
          } else ops.push({ op_id: uuid(), room, area: key, item_id: c.item, field: c.field, kind: c.type, value: c.value, import_batch_id: batch.id, device_id: deviceId() });
        });
      }
    });
  });
  let inserted = 0;
  for (let i = 0; i < events.length; i += 300) {
    const { data, error } = await db().from("study_events").upsert(events.slice(i, i + 300), { onConflict: "user_id,source_key", ignoreDuplicates: true }).select("event_id");
    if (error) throw error;
    inserted += (data || []).length;
  }
  let opsApplied = 0, opsReview = 0;
  for (let i = 0; i < ops.length; i += 100) {
    const { data, error } = await db().rpc("apply_state_ops", { ops: ops.slice(i, i + 100) });
    if (error) throw error;
    (data || []).forEach(r => { if (r.status === "applied") opsApplied++; else if (r.status === "pending_review") opsReview++; });
  }
  let cheersIn = 0;
  if (cheers.length) {
    const { data, error } = await db().from("legacy_cheers").upsert(cheers, { onConflict: "user_id,source_key", ignoreDuplicates: true }).select("id");
    if (error) throw error;
    cheersIn = (data || []).length;
  }
  // 확인: 서버에 이 가져오기 번호로 실제 들어간 개수
  const { count } = await db().from("study_events").select("event_id", { count: "exact", head: true }).eq("import_batch_id", batch.id);
  await pull();
  return { batchId: batch.id, events: events.length, inserted, skipped: events.length - inserted, serverCount: count, ops: ops.length, opsApplied, opsReview, cheers: cheers.length, cheersIn };
}

export async function listImports() {
  const { data, error } = await db().from("import_batches").select("id, source, device_label, counts, status, created_at, cancelled_at, verify").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function cancelImport(batchId, deleteSentCopies) {
  const { data, error } = await db().rpc("cancel_import", { p_batch: batchId, p_delete_sent_copies: !!deleteSentCopies });
  if (error) throw error;
  await pull();
  return data;
}

/* ---------- 예전 응원 메시지 ---------- */
export async function listLegacyCheers() {
  const { data, error } = await db().from("legacy_cheers").select("id, room, body, written_at").order("written_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ---------- 내 데이터 내보내기 (백업 파일) ---------- */
export function exportMine(profile) {
  return { app: "jlpt-account-backup", version: 1, exportedAt: new Date().toISOString(), profile, rooms: clone(S.view) };
}

// 화면이 처음 읽는 기록이 아직 없으면 처음 값을 넣어 둔다 (변경으로 보지 않는다)
export function viewEnsure(room, key, def) {
  if (S.view[room][key] === undefined) S.view[room][key] = def;
  return S.view[room][key];
}
