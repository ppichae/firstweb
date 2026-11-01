// 직접 따라 쓰기: 마우스·손가락·펜으로 쓰는 연습 판 (한자·히라가나·가타카나 공통)
// 자유 쓰기 연습이다. 획순이나 모양을 자동으로 채점하지 않는다. 내가 쓴 획 수와 KanjiVG의 획 수만 나란히 보여 준다.
import { loadStrokes, strokeSVG } from "./strokes.js";

const SIZE = 109;   // KanjiVG 좌표계

// opts: { onPractice(): '다 썼어요'를 눌렀을 때 }
export async function mountWritePad(el, ref, opts = {}) {
  el.innerHTML = '<p class="hint">쓰기 판을 준비하는 중이에요…</p>';
  const data = await loadStrokes(ref);
  if (!el.isConnected) return null;
  // 획순 자료가 없으면 한자 창에서는 그 칸을 숨기고, 다른 곳에서는 짧게 알린다
  if (!data) { const sec = el.closest(".kd-sec"); if (sec) sec.hidden = true; else el.innerHTML = '<p class="hint">이 글자는 쓰기 가이드 그림이 없어요.</p>'; return null; }
  const total = data.strokes.length;
  const st = { lines: [], cur: null, guide: true, compare: false, hint: false };

  el.innerHTML =
    '<div class="write-pad">' +
      '<div class="wp-stage">' + strokeSVG(data, "wp-model") +
        '<canvas class="wp-canvas" aria-label="쓰기 칸. 마우스나 손가락으로 써 보세요." role="img"></canvas></div>' +
      '<div class="wp-side">' +
        '<p class="wp-count" aria-live="polite">내가 쓴 획 <b class="wp-n">0</b> · 이 글자는 ' + total + "획</p>" +
        '<div class="sp-controls">' +
          '<button type="button" class="btn ghost sm" data-wp="undo">한 획 지우기</button>' +
          '<button type="button" class="btn ghost sm" data-wp="clear">모두 지우기</button>' +
          '<button type="button" class="btn ghost sm" data-wp="hint" aria-pressed="false">다음 획 보기</button>' +
          '<button type="button" class="btn ghost sm" data-wp="compare" aria-pressed="false">완성 모양과 비교</button>' +
        "</div>" +
        '<p class="hint wp-hint" aria-live="polite" hidden></p>' +
        '<label class="sp-check"><input type="checkbox" data-wp-guide checked> 연한 가이드 글자 보기</label>' +
        '<div class="sp-controls"><button type="button" class="btn sm" data-wp="done">다 썼어요</button></div>' +
        '<p class="hint wp-msg" role="status"></p>' +
        '<p class="hint">자유 쓰기 연습이에요. 획순이나 모양을 <b>자동으로 채점하지 않아요</b>. \'완성 모양과 비교\'로 직접 확인해 보세요.</p>' +
      "</div>" +
    "</div>";

  const stage = el.querySelector(".wp-stage");
  const model = el.querySelector(".wp-model");
  const canvas = el.querySelector(".wp-canvas");
  const ctx = canvas.getContext("2d");
  const inkColor = () => getComputedStyle(el).getPropertyValue("--fg").trim() || "#1A1D29";

  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    redraw();
  }
  function redraw() {
    const k = canvas.width / SIZE;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 4.2 * k; ctx.strokeStyle = inkColor();
    [...st.lines, ...(st.cur ? [st.cur] : [])].forEach(line => {
      ctx.beginPath();
      line.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
      if (line.length === 1) ctx.lineTo(line[0][0] * k + 0.1, line[0][1] * k);
      ctx.stroke();
    });
  }
  function paintModel() {
    model.classList.toggle("no-guide", !st.guide);
    model.classList.toggle("compare", st.compare);
    const paths = [...model.querySelectorAll(".ink path")];
    paths.forEach((p, i) => p.classList.toggle("hint-now", st.hint && i === st.lines.length));
    el.querySelector(".wp-n").textContent = st.lines.length;
    const hb = el.querySelector('[data-wp="hint"]');
    hb.setAttribute("aria-pressed", st.hint);
    hb.textContent = st.hint ? "다음 획 보기 ✓" : "다음 획 보기";
    // 다음 획 보기가 켜져 있으면 몇 번째 획을 보여 주는지, 다 썼으면 끝났다고 알려 준다
    const hl = el.querySelector(".wp-hint");
    hl.hidden = !st.hint;
    hl.textContent = !st.hint ? "" : st.lines.length < total ? "지금 " + (st.lines.length + 1) + "번째 획을 파란색으로 보여 주고 있어요 (전체 " + total + "획)" : "마지막 획까지 다 썼어요 ✓";
    el.querySelector('[data-wp="compare"]').setAttribute("aria-pressed", st.compare);
  }
  const point = e => {
    const r = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(SIZE, (e.clientX - r.left) / r.width * SIZE)), Math.max(0, Math.min(SIZE, (e.clientY - r.top) / r.height * SIZE))];
  };

  canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ }
    st.cur = [point(e)]; redraw();
  });
  canvas.addEventListener("pointermove", e => {
    if (!st.cur) return;
    e.preventDefault();
    const p = point(e), last = st.cur[st.cur.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.6) { st.cur.push(p); redraw(); }
  });
  const end = () => {
    if (!st.cur) return;
    st.lines.push(st.cur); st.cur = null;
    redraw(); paintModel();
    if (st.lines.length === total) say("획 수는 " + total + "획으로 같아요. 모양은 '완성 모양과 비교'로 확인해 보세요.");
    else if (st.lines.length > total) say("이 글자는 " + total + "획이에요. 쓴 획이 더 많아요.");
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("lostpointercapture", end);

  const say = t => { el.querySelector(".wp-msg").textContent = t; };
  el.querySelector(".write-pad").addEventListener("click", e => {
    const b = e.target.closest("[data-wp]");
    if (!b) return;
    e.stopPropagation();
    const a = b.dataset.wp;
    if (a === "undo") { st.lines.pop(); say(""); }
    else if (a === "clear") { st.lines = []; say(""); }
    else if (a === "hint") st.hint = !st.hint;
    else if (a === "compare") st.compare = !st.compare;
    else if (a === "done") {
      if (!st.lines.length) { say("먼저 칸 안에 글자를 써 보세요."); return; }
      if (opts.onPractice) opts.onPractice(st.lines.length, total);
      say("연습 1회를 기록했어요. 모두 지우고 한 번 더 써 볼까요?");
    }
    redraw(); paintModel();
  });
  el.querySelector("[data-wp-guide]").onchange = e => { st.guide = e.target.checked; paintModel(); };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener("resize", resize);
  resize(); paintModel();
  return { get strokes() { return st.lines.length; }, total, clear() { st.lines = []; redraw(); paintModel(); } };
}
