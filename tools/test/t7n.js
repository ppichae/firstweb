(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  await wait(200);
  check("첫 화면 = 홈", $(".tab[aria-current]").textContent.trim() === "홈", $(".tab[aria-current]").textContent);
  const tiles = $$(".tiles .tile-value").map(t => t.textContent);
  check("기록 없을 때 0/기록 없음", JSON.stringify(tiles) === JSON.stringify(["0", "0", "0", "기록 없음"]), JSON.stringify(tiles));
  check("영역별 기록 없음", $$(".meter-val").every(m => m.textContent.startsWith("기록 없음")));
  check("약점: 기록 부족 안내", $(".home-grid").textContent.includes("기록이 부족"));
  check("7일 그래프 빈 상태", $$(".card-box .hint").some(h => h.textContent.includes("학습 기록이 없어요")));
  check("D-day 표시", /^D-\d+$/.test($(".dday").textContent), $(".dday").textContent);
  check("시험 구성 110/55", $(".facts").textContent.includes("110분") && $(".facts").textContent.includes("55분"));
  // 기록 만들기: 문법 6문제(정답 3, 오답 3)
  location.hash = "grammar"; await wait(1500); document.querySelector("[data-mode=quiz]").click(); await wait(200); document.querySelector("[data-gq=exam]").click(); await wait(200);
  const qs = $$(".q");
  const answers = [0, 1, 2, 0, 1, 0];
  // 한 문제씩: 답을 고르고 '다음 문제'로 넘어간다
  for (let i = 0; i < 6; i++) { $(".qr-q .q").querySelector('[data-o="' + (i < 3 ? answers[i] : (answers[i] + 1) % 4) + '"]').click(); await wait(20); $(".qr-next").click(); await wait(60); }
  document.querySelector("[data-mode=learn]").click(); await wait(100);
  $('[data-gact="studied"]').click(); await wait(30);
  location.hash = "vocab"; await wait(1500); { const s = document.querySelector("#v-src"); s.value = "core"; s.dispatchEvent(new window.Event("change", { bubbles: true })); await wait(100); }
  $('[data-act="known"]').click(); await wait(30);
  location.hash = "home"; await wait(300);
  const t2 = $$(".tiles .tile-value").map(t => t.textContent);
  check("실제 기록 반영", t2[0] === "1" && t2[1] === "1" && t2[2] === "6" && t2[3] === "50%", JSON.stringify(t2));
  check("문법 정답률 50%", $$(".meter-val")[1].textContent.startsWith("50%"), $$(".meter-val")[1].textContent);
  check("약점 표시(5문제 이상)", $(".weak") && $(".weak").textContent.includes("문법"));
  check("7일 그래프 오늘 막대", $$(".week-col").length === 7 && $$(".week-bar")[6].style.height === "100%", $$(".week-bar").map(b => b.style.height).join(","));
  check("다시 풀 오답 3개", $$(".todo strong")[1].textContent === "3개", $$(".todo strong")[1].textContent);
  $('[data-goto="cards"]').click(); await wait(300);
  check("복습 단어 → 플래시카드", location.hash === "#vocab" && $('[data-mode="cards"]').getAttribute("aria-selected") === "true");
  check("가로 스크롤 없음", document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + "/" + window.innerWidth);
  return log.join("\n");
})()
