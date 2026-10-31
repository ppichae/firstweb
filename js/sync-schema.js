// 학습 기록 동기화 규칙: 기록 종류(store.js의 키)마다 서버와 어떻게 합치는지 정해 둔다
// 여기에 등록되지 않은 기록은 동기화하지 않는다(개발자 오류로 알리고 따로 기록). 새 기능의 기록은 먼저 여기에 등록해야 한다.
//
// 칸 종류
//   set     : 선택 상태(외움/모름·즐겨찾기·공부함·복습 일정·목표 등). 서버 버전으로 충돌을 확인한다. 해제(null)도 하나의 변경
//   min/max : 가장 이른/늦은 날짜, 가장 높은 점수. 순서와 상관없이 같은 결과
//   counter : 늘어난 횟수(오답 횟수·공부 시간·경험치 등). 늘어난 만큼을 고유 번호가 붙은 기록으로 보내고, 합계로 보여 준다
//   list    : 쌓이는 기록(문제 풀이·모의고사·연습 테스트). 하나하나 고유 번호로 합친다
//   local   : 이 기기에만 두는 기록(동기화하지 않음)

const STUDY = { status: "set", fav: "set", studied: "set", srs: "set", wrong: "counter" };

export const SCHEMA = {
  words:        { kind: "map", fields: STUDY },
  grammar:      { kind: "map", fields: STUDY },
  lists:        { kind: "map", fields: STUDY },
  kanji:        { kind: "map", fields: { fav: "set", seen: "min", last: "max", written: "counter", "quiz.right": "counter", "quiz.wrong": "counter" } },
  basics:       { kind: "map", fields: { done: "min", best: "max" } },
  activity:     { kind: "map", fields: { seconds: "counter", cards: "counter", words: "counter", questions: "counter" } },
  kanaProgress: { kind: "map2", fields: { right: "counter", wrong: "counter" } },   // 히라가나/가타카나 → 글자 → {right, wrong}
  kanaWritten:  { kind: "map2num", field: "n", type: "counter" },                   // 히라가나/가타카나 → 글자 → 쓴 횟수
  badges:       { kind: "mapval", field: "date", type: "min" },                       // 배지 → 처음 받은 날
  attempts:     { kind: "list", event: "attempt" },
  mocks:        { kind: "list", event: "mock" },
  tests:        { kind: "list", event: "test" },
  game:         { kind: "obj", fields: { xp: "counter" }, localFields: ["convertedFrom", "convertedAt"] },
  examDate:     { kind: "value" },
  goal:         { kind: "value" },
  sprint:       { kind: "value" },
  profile:      { kind: "local" },   // 닉네임은 계정 프로필(서버)로 옮겼다
  cheers:       { kind: "local" },   // 예전 응원 메시지: 가져오기로만 서버에 원본을 보관한다
  kana:         { kind: "local" },   // 처음 값만 있고 쓰는 곳이 없다
};

export const isRegistered = key => Object.prototype.hasOwnProperty.call(SCHEMA, key);
export const cellKey = (room, area, item, field) => room + "|" + area + "|" + item + "|" + field;

// 순서와 상관없이 같은 값이면 같은 글자가 되도록 정렬해서 JSON으로 만든다
export function stable(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
}
const same = (a, b) => stable(a) === stable(b);
const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function setPath(o, p, v) {
  const ks = p.split("."), last = ks.pop();
  let x = o;
  ks.forEach(k => { if (x[k] == null || typeof x[k] !== "object") x[k] = {}; x = x[k]; });
  if (v === null || v === undefined) delete x[last]; else x[last] = v;
}

// 기록 하나(키)를 칸 목록으로 펼친다: Map(칸 id → {item, field, type, value}), 모르는 칸은 unknown에 모은다
export function flatten(key, value) {
  const spec = SCHEMA[key], cells = new Map(), unknown = [];
  const put = (item, field, type, v) => { if (v !== undefined && v !== null) cells.set(item + "|" + field, { item, field, type, value: v }); };
  if (!spec || value == null) return { cells, unknown };
  if (spec.kind === "map") {
    Object.keys(value).forEach(item => {
      const obj = value[item] || {};
      const known = Object.keys(spec.fields);
      known.forEach(f => put(item, f, spec.fields[f], getPath(obj, f)));
      Object.keys(obj).forEach(f => {
        if (spec.fields[f]) return;
        if (obj[f] && typeof obj[f] === "object" && known.some(k => k.startsWith(f + "."))) {
          Object.keys(obj[f]).forEach(sub => { if (!spec.fields[f + "." + sub]) unknown.push(key + "." + f + "." + sub); });
        } else if (obj[f] !== undefined) unknown.push(key + "." + f);
      });
    });
  } else if (spec.kind === "map2") {
    Object.keys(value).forEach(script => Object.keys(value[script] || {}).forEach(ch => {
      const obj = value[script][ch] || {};
      Object.keys(obj).forEach(f => { if (spec.fields[f]) put(script + "/" + ch, f, spec.fields[f], obj[f]); else unknown.push(key + "." + f); });
    }));
  } else if (spec.kind === "map2num") {
    Object.keys(value).forEach(script => Object.keys(value[script] || {}).forEach(ch => put(script + "/" + ch, spec.field, spec.type, value[script][ch])));
  } else if (spec.kind === "mapval") {
    Object.keys(value).forEach(item => put(item, spec.field, spec.type, value[item]));
  } else if (spec.kind === "obj") {
    Object.keys(value).forEach(f => {
      if (spec.fields[f]) put("_", f, spec.fields[f], value[f]);
      else if (!(spec.localFields || []).includes(f)) unknown.push(key + "." + f);
    });
  } else if (spec.kind === "value") {
    put("_", "value", "set", value);
  }
  return { cells, unknown };
}

// 칸 목록을 다시 기록 모양으로 되돌린다 (flatten의 반대)
export function unflatten(key, cells, base) {
  const spec = SCHEMA[key];
  if (spec.kind === "value") { const c = cells.get("_|value"); return c ? c.value : null; }
  const out = base && typeof base === "object" ? base : {};
  cells.forEach(c => {
    if (spec.kind === "map") { out[c.item] = out[c.item] || {}; setPath(out[c.item], c.field, c.value); }
    else if (spec.kind === "map2" || spec.kind === "map2num") {
      const i = c.item.indexOf("/"), script = c.item.slice(0, i), ch = c.item.slice(i + 1);
      out[script] = out[script] || {};
      if (spec.kind === "map2") { out[script][ch] = out[script][ch] || {}; out[script][ch][c.field] = c.value; }
      else out[script][ch] = c.value;
    } else if (spec.kind === "mapval") out[c.item] = c.value;
    else if (spec.kind === "obj") out[c.field] = c.value;
  });
  return out;
}

// 바뀌기 전(prev)과 후(next)를 비교해서 서버로 보낼 변경 목록을 만든다
//   ops: 선택·이른/늦은 값 변경, deltas: 늘어난 횟수, items: 새로 쌓인 기록, unknown: 등록되지 않은 칸
export function diff(key, prev, next, newId) {
  const spec = SCHEMA[key], out = { ops: [], deltas: [], items: [], unknown: [], truncated: false };
  if (!spec) { out.unknown.push(key); return out; }
  if (spec.kind === "local") return out;
  if (spec.kind === "list") {
    const a = Array.isArray(prev) ? prev : [], b = Array.isArray(next) ? next : [];
    if (b.length < a.length) { out.truncated = true; return out; }   // 지우는 변경은 '기록 지우기'로만 한다
    b.slice(a.length).forEach(it => {
      if (it && typeof it === "object" && !it.id) it.id = newId();   // 쌓이는 기록마다 고유 번호
      out.items.push(it);
    });
    return out;
  }
  const P = flatten(key, prev), N = flatten(key, next);
  out.unknown = N.unknown.filter(u => !P.unknown.includes(u));
  const ids = new Set([...P.cells.keys(), ...N.cells.keys()]);
  ids.forEach(id => {
    const p = P.cells.get(id), n = N.cells.get(id), c = n || p;
    const pv = p ? p.value : null, nv = n ? n.value : null;
    if (same(pv, nv)) return;
    if (c.type === "counter") {
      const d = (Number(nv) || 0) - (Number(pv) || 0);
      if (d) out.deltas.push({ item: c.item, field: c.field, delta: d });
    } else if (c.type === "set") out.ops.push({ item: c.item, field: c.field, kind: "set", value: nv });
    else if (nv !== null) out.ops.push({ item: c.item, field: c.field, kind: c.type, value: nv });
  });
  return out;
}

// 이른/늦은 값 비교 (숫자는 숫자로, 날짜·글자는 글자로)
export function pickMinMax(kind, a, b) {
  if (a == null) return b;
  if (b == null) return a;
  const less = typeof a === "number" && typeof b === "number" ? a <= b : String(a) <= String(b);
  return kind === "min" ? (less ? a : b) : (less ? b : a);
}

// 기록 하나에서 칸 하나를 읽는다 / 바꾼다 (바꾼 기록을 돌려준다. value 종류는 값 자체가 바뀐다)
export function readCell(key, value, item, field) {
  const spec = SCHEMA[key];
  if (!spec || value == null) return null;
  if (spec.kind === "value") return value;
  if (spec.kind === "map") return getPath(value[item] || {}, field) ?? null;
  if (spec.kind === "map2" || spec.kind === "map2num") {
    const i = item.indexOf("/"), s = value[item.slice(0, i)] || {}, v = s[item.slice(i + 1)];
    return spec.kind === "map2" ? ((v || {})[field] ?? null) : (v ?? null);
  }
  if (spec.kind === "mapval") return value[item] ?? null;
  if (spec.kind === "obj") return value[field] ?? null;
  return null;
}
export function writeCell(key, value, item, field, v) {
  const spec = SCHEMA[key];
  if (spec.kind === "value") return v;
  const out = value && typeof value === "object" ? value : {};
  if (spec.kind === "map") {
    out[item] = out[item] || {};
    setPath(out[item], field, v);
    if (!Object.keys(out[item]).length) delete out[item];
  } else if (spec.kind === "map2" || spec.kind === "map2num") {
    const i = item.indexOf("/"), script = item.slice(0, i), ch = item.slice(i + 1);
    out[script] = out[script] || {};
    if (spec.kind === "map2") {
      out[script][ch] = out[script][ch] || {};
      if (v === null || v === undefined) delete out[script][ch][field]; else out[script][ch][field] = v;
    } else if (v === null || v === undefined) delete out[script][ch]; else out[script][ch] = v;
  } else if (spec.kind === "mapval") { if (v === null || v === undefined) delete out[item]; else out[item] = v; }
  else if (spec.kind === "obj") { if (v === null || v === undefined) delete out[field]; else out[field] = v; }
  return out;
}
