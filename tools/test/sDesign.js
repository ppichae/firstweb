(async () => {
  // 디자인 시스템: 메뉴 배경 없음, 둥근 메뉴, 더보기 창, 문법 칸 간격, 버튼 통일, 왼쪽 정렬
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1300); };
  const css = (el, p) => window.getComputedStyle(el)[p];
  const narrow = window.innerWidth <= 640;
  try {
    // 왼쪽 정렬: 어느 화면이든 제목과 첫 칸의 왼쪽 끝이 같다
    for (const h of ["n3", "n3/vocab", "n3/grammar", "n3/kanji", "n3/reading", "n3/roadmap", "n3/exam", "n3/notes", "n3/backup"]) {
      await go(h);
      const lefts = [...app().querySelectorAll("section.panel > *:not(.more-list)")].filter(e => e.getBoundingClientRect().width > 0).map(e => Math.round(e.getBoundingClientRect().left));
      check(h + " 왼쪽 끝이 모두 같음", lefts.length > 0 && new Set(lefts).size === 1, [...new Set(lefts)].join());
    }
    await go("n3/grammar");
    const items = $$(".g-item");
    const g1 = items[0].getBoundingClientRect(), g2 = items[1].getBoundingClientRect();
    check("문법 칸 사이 간격 12px 이상", g2.top - g1.bottom >= 12, Math.round(g2.top - g1.bottom));
    check("문법 칸 안쪽 여백 16px 이상", parseFloat(css(items[0], "paddingLeft")) >= 16, css(items[0], "paddingLeft"));
    const pat = $(".g-pattern"), mean = $(".g-mean");
    check("문형과 뜻의 왼쪽이 같음", Math.abs(pat.getBoundingClientRect().left - mean.getBoundingClientRect().left) < 1);

    // 버튼 통일: 모양이 같은 종류는 높이·둥글기가 같다
    await go("n3/vocab"); { const _c = document.querySelector('.topic-tile[data-cat="all"]'); if (_c) { _c.click(); await new Promise(r => setTimeout(r, 60)); } }
    const chips = $$(".chip"), marks = $$(".mark:not(.star)");
    const h40 = el => Math.round(el.getBoundingClientRect().height);
    check("칩·표시 버튼 높이 40px 통일", [...chips, ...marks].every(b => h40(b) === 40), [...new Set([...chips, ...marks].map(h40))].join());
    check("칩·표시 버튼이 모두 알약 모양", [...chips, ...marks].every(b => parseFloat(css(b, "borderTopLeftRadius")) >= 20));
    check("단어 카드 버튼이 한 줄", (() => { const f = $(".card-foot"), s = f.querySelector(".mark.star").getBoundingClientRect(), u = f.querySelector(".mark.unknown").getBoundingClientRect(); return Math.abs(s.top - u.top) < 2; })());
    const cardH = () => $$(".card").slice(0, 2).map(c => Math.round(c.getBoundingClientRect().height));
    const closedH = cardH()[1];
    $(".card-face").click(); await wait(200);
    check("단어 하나를 펼쳐도 다른 카드 높이는 그대로", cardH()[1] === closedH, cardH().join());
    const sel = $(".field select"), inp = $(".field input");
    check("입력 칸과 선택 칸 높이가 같음", h40(sel) === h40(inp), h40(sel) + "/" + h40(inp));

    await go("n3");
    check("홈 숫자 칸 4개와 원형 그래프", $$(".stat-tile").length === 4 && $$(".stat-ring").length === 2, $$(".stat-ring").length);
    check("7일 그래프가 접히지 않고 보임", !!$(".week") && !$(".week").closest("details"));
    const ink = css(document.documentElement, "getPropertyValue") === undefined ? "" : getComputedStyle(document.documentElement).getPropertyValue("--ink").trim().toLowerCase();
    check("예전 진한 남색(#4041af)을 쓰지 않음", ink !== "#4041af" && !$$("*").some(e => css(e, "backgroundColor") === "rgb(64, 65, 175)"), ink);

    if (!narrow) {
      const nav = document.querySelector("nav.tabs");
      check("위쪽 메뉴 뒤 배경 없음", css(nav, "backgroundColor") === "rgba(0, 0, 0, 0)", css(nav, "backgroundColor"));
      const tabs = [...nav.querySelectorAll(".tab")];
      check("위쪽 메뉴가 한 줄", new Set(tabs.map(t => Math.round(t.getBoundingClientRect().top))).size === 1);
      check("선택된 메뉴가 알약 모양", parseFloat(css(nav.querySelector('.tab[aria-current="page"]'), "borderTopLeftRadius")) >= 20);
      return log.join("\n");
    }
    // 휴대폰
    const bar = document.querySelector(".m-bar");
    const on = bar.querySelector('.m-tab[aria-current="page"]');
    check("하단 메뉴 선택 칸이 둥글다", parseFloat(css(on, "borderTopLeftRadius")) >= 20, css(on, "borderTopLeftRadius"));
    bar.querySelector("[data-m-more]").click(); await wait(200);
    const sheet = document.querySelector(".m-sheet");
    check("더보기를 열어도 닫기 버튼에 초점이 없음", document.activeElement === sheet && !document.activeElement.closest("[data-m-close]"), document.activeElement.tagName);
    check("창 자체에 테두리 없음", css(sheet, "outlineStyle") === "none");
    const link = sheet.querySelector(".m-link"), row = sheet.querySelector(".m-tool");
    check("메뉴 칸과 설정 버튼의 모양이 다름", parseFloat(css(link, "borderTopLeftRadius")) >= 16 && css(row, "minHeight") !== css(link, "minHeight"), css(link, "borderTopLeftRadius") + "/" + css(row, "borderTopLeftRadius"));
    check("더보기 창 가로 넘침 없음", sheet.scrollWidth <= sheet.clientWidth);
    sheet.close();
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
