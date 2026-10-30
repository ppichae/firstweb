// 획순 애니메이션: KanjiVG 파일(data/kanjivg/유니코드.svg)에서 획 모양과 순서를 읽어 한 획씩 그린다
// KanjiVG는 CC BY-SA 3.0 (Ulrich Apel). 파일에서 획 경로(d)와 번호 위치만 읽고, 원본 SVG를 그대로 화면에 넣지 않는다.
import { esc } from "./util.js";

const cache = new Map();

export const strokeRefOf = ch => ch.codePointAt(0).toString(16).padStart(5, "0");

// { strokes: [d, ...], numbers: [[x, y], ...] } 또는 null(파일 없음)
export function loadStrokes(ref) {
  if (!cache.has(ref)) {
    cache.set(ref, fetch("data/kanjivg/" + ref + ".svg").then(r => (r.ok ? r.text() : null)).then(text => {
      if (!text) return null;
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const re = new RegExp("^kvg:" + ref + "-s(\\d+)$");
      const strokes = [...doc.querySelectorAll("path")]
        .map(p => { const m = (p.getAttribute("id") || "").match(re); return m ? [Number(m[1]), p.getAttribute("d")] : null; })
        .filter(x => x && /^[MmCcSsLlZzHhVvQqTtAa0-9.,\s-]+$/.test(x[1]))
        .sort((a, b) => a[0] - b[0]).map(x => x[1]);
      const numbers = [...doc.querySelectorAll("text")].map(t => {
        const m = (t.getAttribute("transform") || "").match(/matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)/);
        return m ? [Number(m[1]), Number(m[2])] : null;
      });
      return strokes.length ? { strokes, numbers } : null;
    }).catch(() => null));
  }
  return cache.get(ref);
}

// 가이드(옅은 전체 모양)와 칸 십자선이 있는 빈 SVG
export function strokeSVG(data, cls = "") {
  return '<svg class="stroke-svg ' + cls + '" viewBox="0 0 109 109" aria-hidden="true">' +
    '<g class="grid"><rect x="1" y="1" width="107" height="107" rx="6"/><line x1="54.5" y1="1" x2="54.5" y2="108"/><line x1="1" y1="54.5" x2="108" y2="54.5"/></g>' +
    '<g class="guide">' + data.strokes.map(d => '<path d="' + esc(d) + '"/>').join("") + "</g>" +
    '<g class="ink">' + data.strokes.map((d, i) => '<path data-i="' + i + '" d="' + esc(d) + '"/>').join("") + "</g>" +
    '<g class="nums">' + data.numbers.map((p, i) => p ? '<text x="' + p[0] + '" y="' + p[1] + '">' + (i + 1) + "</text>" : "").join("") + "</g>" +
  "</svg>";
}

const SPEEDS = [["0.5", "느리게"], ["1", "보통"], ["1.5", "빠르게"], ["2", "아주 빠르게"]];
let active = null;   // 한 번에 하나의 애니메이션만 움직인다

export function stopStrokes() { if (active) active.pause(); }

// el 안에 획순 플레이어를 만든다. 파일이 없으면 '획순 데이터 준비 중'
export async function mountStrokePlayer(el, ref, opts = {}) {
  el.innerHTML = '<p class="hint">획순 데이터를 불러오는 중이에요…</p>';
  const data = await loadStrokes(ref);
  if (!el.isConnected) return null;
  if (!data) { el.innerHTML = '<p class="hint">획순 데이터 준비 중이에요.</p>'; return null; }

  const n = data.strokes.length;
  const st = { done: 0, partial: 0, playing: false, speed: 1, nums: !!opts.showNumbers, raf: 0, last: 0 };
  el.innerHTML =
    '<div class="stroke-player">' +
      '<div class="sp-stage">' + strokeSVG(data, "sp-svg" + (st.nums ? " show-nums" : "")) + "</div>" +
      '<div class="sp-side">' +
        '<div class="sp-count" aria-live="polite"><b class="sp-cur">0</b> / ' + n + '획</div>' +
        '<div class="bar wide" aria-hidden="true"><span class="sp-bar" style="width:0%"></span></div>' +
        '<div class="sp-controls">' +
          '<button type="button" class="btn sm" data-sp="play">▶ 재생</button>' +
          '<button type="button" class="btn ghost sm" data-sp="restart" aria-label="처음부터">⏮ 처음부터</button>' +
          '<button type="button" class="btn ghost sm" data-sp="prev" aria-label="이전 획">◀ 이전 획</button>' +
          '<button type="button" class="btn ghost sm" data-sp="next" aria-label="다음 획">다음 획 ▶</button>' +
          '<button type="button" class="btn ghost sm" data-sp="all">완성 모양</button>' +
        "</div>" +
        '<div class="sp-options"><label class="rate">속도 <select data-sp-speed>' + SPEEDS.map(([v, l]) => '<option value="' + v + '"' + (v === "1" ? " selected" : "") + ">" + l + "</option>").join("") + "</select></label>" +
          '<label class="sp-check"><input type="checkbox" data-sp-nums' + (st.nums ? " checked" : "") + "> 획 번호 보기</label></div>" +
        '<p class="hint sp-src">획순: KanjiVG (CC BY-SA 3.0)</p>' +
      "</div>" +
    "</div>";

  const svg = el.querySelector(".sp-svg");
  const paths = [...svg.querySelectorAll(".ink path")];
  const lens = paths.map(p => { try { return p.getTotalLength(); } catch (e) { return 100; } });
  const playBtn = el.querySelector('[data-sp="play"]');

  function paint() {
    paths.forEach((p, i) => {
      const L = lens[i] || 100;
      p.style.strokeDasharray = L + " " + L;
      if (i < st.done) { p.style.strokeDashoffset = 0; p.classList.remove("now"); }
      else if (i === st.done && st.partial > 0) { p.style.strokeDashoffset = L * (1 - st.partial); p.classList.add("now"); }
      else { p.style.strokeDashoffset = L; p.classList.remove("now"); }
    });
    const shown = Math.min(n, st.done + (st.partial > 0 ? 1 : 0));
    el.querySelector(".sp-cur").textContent = shown;
    el.querySelector(".sp-bar").style.width = (shown / n * 100) + "%";
    playBtn.textContent = st.playing ? "⏸ 일시정지" : st.done >= n ? "▶ 다시 재생" : "▶ 재생";
    svg.classList.toggle("show-nums", st.nums);
  }

  function frame() {
    const t = performance.now();
    if (!st.playing) return;
    const dt = Math.min(64, t - (st.last || t));
    st.last = t;
    const L = lens[st.done] || 100;
    st.partial += dt * st.speed / (300 + L * 9);   // 긴 획은 조금 더 오래
    if (st.partial >= 1) {
      st.done++; st.partial = 0;
      if (st.done >= n) { st.playing = false; paint(); return; }
      st.last = t + 250 / st.speed;                  // 획과 획 사이에 잠깐 쉰다
    }
    paint();
    st.raf = setTimeout(frame, 16);
  }

  const api = {
    play() {
      if (active && active !== api) active.pause();
      active = api;
      if (st.done >= n) { st.done = 0; st.partial = 0; }
      st.playing = true; st.last = 0; paint();
      st.raf = setTimeout(frame, 16);
    },
    pause() { st.playing = false; clearTimeout(st.raf); paint(); },
    restart() { api.pause(); st.done = 0; st.partial = 0; api.play(); },
    step(d) { api.pause(); st.partial = 0; st.done = Math.max(0, Math.min(n, st.done + d)); paint(); },
    showAll() { api.pause(); st.done = n; st.partial = 0; paint(); },
    get state() { return { done: st.done, total: n, playing: st.playing }; },
  };

  el.querySelector(".stroke-player").addEventListener("click", e => {
    const b = e.target.closest("[data-sp]");
    if (!b) return;
    e.stopPropagation();
    const a = b.dataset.sp;
    if (a === "play") st.playing ? api.pause() : api.play();
    else if (a === "restart") api.restart();
    else if (a === "prev") api.step(-1);
    else if (a === "next") api.step(1);
    else if (a === "all") api.showAll();
  });
  el.querySelector("[data-sp-speed]").onchange = e => { st.speed = Number(e.target.value); };
  el.querySelector("[data-sp-nums]").onchange = e => { st.nums = e.target.checked; paint(); };
  paint();
  if (opts.autoplay && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) api.play();
  return api;
}
