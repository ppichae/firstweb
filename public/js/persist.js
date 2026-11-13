// 동기화용 저장소: 브라우저 안의 데이터베이스(IndexedDB)에 여러 값을 한 번에(모두 저장되거나 하나도 안 되게) 저장한다
// IndexedDB를 쓸 수 없으면 localStorage로 대신한다(이때는 한 번에 저장이 보장되지 않아, 동기화 쪽에서 고유 번호로 중복을 막는다)
const DB_NAME = "jlpt-sync", STORE = "kv";
// 저장소가 응답하지 않을 때 기다리는 시간. 테스트 서버(내 컴퓨터)에서만 주소의 idbwait로 바꿀 수 있다 (시간을 빨리 감는 테스트용)
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const WAIT = (isLocal && Number(new URLSearchParams(location.search).get("idbwait"))) || 5000;

let mode = null;          // "idb" | "ls" | "none"
let db = null;

function openIdb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("IndexedDB 없음")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB를 열지 못함"));
    req.onblocked = () => reject(new Error("IndexedDB가 막혀 있음"));
    setTimeout(() => reject(new Error("IndexedDB 응답 없음")), WAIT);   // 응답이 없으면 기다리지 않고 다른 저장소를 쓴다
  });
}

// 저장소를 쓸 수 있는지 실제로 써 보고 확인한다 (비공개 모드인지 추측하지 않는다)
let initing = null;
export function initPersist() {
  if (mode) return Promise.resolve(mode);
  return initing || (initing = doInit().finally(() => { initing = null; }));   // 여러 곳에서 동시에 불러도 한 번만 연다
}
async function doInit() {
  try {
    const late = ms => new Promise((_, rej) => setTimeout(() => rej(new Error("IndexedDB 응답 없음")), ms));
    db = await openIdb();
    await Promise.race([putMany([["__check", Date.now()]], []), late(WAIT)]);
    const v = await Promise.race([getOne("__check"), late(WAIT)]);
    if (!v) throw new Error("저장 확인 실패");
    mode = "idb";
  } catch (e) {
    console.error("[저장소] IndexedDB를 쓸 수 없어서 기본 저장소를 써요.", e);
    db = null;
    try { localStorage.setItem("jlpt:sync:__check", "1"); if (localStorage.getItem("jlpt:sync:__check") !== "1") throw new Error("x"); mode = "ls"; }
    catch (e2) { mode = "none"; }
  }
  return mode;
}
export const persistMode = () => mode;

export function getOne(key) {
  if (mode === "ls") { try { const r = localStorage.getItem("jlpt:sync:" + key); return Promise.resolve(r ? JSON.parse(r) : undefined); } catch (e) { return Promise.resolve(undefined); } }
  if (!db) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 이 앞이름(prefix)으로 시작하는 값을 모두 읽는다
export function getPrefix(prefix) {
  if (mode === "ls") {
    const out = {};
    try { Object.keys(localStorage).forEach(k => { if (k.startsWith("jlpt:sync:" + prefix)) out[k.slice(10)] = JSON.parse(localStorage.getItem(k)); }); } catch (e) { /* 무시 */ }
    return Promise.resolve(out);
  }
  if (!db) return Promise.resolve({});
  return new Promise((resolve, reject) => {
    const out = {};
    const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, prefix + "￿"));
    req.onsuccess = () => { const c = req.result; if (c) { out[c.key] = c.value; c.continue(); } else resolve(out); };
    req.onerror = () => reject(req.error);
  });
}

// 여러 값을 한 번에 저장·삭제한다. IndexedDB에서는 하나의 트랜잭션이라 모두 저장되거나 하나도 저장되지 않는다
export function putMany(entries, deletes = []) {
  if (mode === "ls") {
    try {
      entries.forEach(([k, v]) => localStorage.setItem("jlpt:sync:" + k, JSON.stringify(v)));
      deletes.forEach(k => localStorage.removeItem("jlpt:sync:" + k));
      return Promise.resolve();
    } catch (e) { return Promise.reject(e); }
  }
  if (!db) return Promise.reject(new Error("저장소를 쓸 수 없어요"));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    entries.forEach(([k, v]) => st.put(v, k));
    deletes.forEach(k => st.delete(k));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("저장 실패"));
    tx.onabort = () => reject(tx.error || new Error("저장 취소됨"));
  });
}
