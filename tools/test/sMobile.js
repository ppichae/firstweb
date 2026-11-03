(async () => {
  // 휴대폰 하단 메뉴·더보기, 넓은 화면에서는 위쪽 메뉴 유지, 기록 화면 홈 버튼, 터치 크기
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s);
  const go = async h => { location.hash = h; await wait(1300); };
  const css = (el, p) => window.getComputedStyle(el)[p];
  const shown = el => !!el && css(el, "display") !== "none" && el.getBoundingClientRect().width > 0;
  const noScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  const narrow = window.innerWidth <= 640;
  try {
    await go("n3");
    const bar = document.querySelector(".m-bar");
    if (!narrow) {
      check("넓은 화면: 위쪽 메뉴와 버튼 유지, 하단 메뉴 없음", shown(document.querySelector("nav.tabs")) && shown(document.getElementById("theme-toggle")) && !shown(bar));
      return log.join("\n");
    }
    check("휴대폰: 하단 메뉴 보임, 위쪽 메뉴와 버튼 숨김", shown(bar) && !shown(document.querySelector("nav.tabs")) && !shown(document.getElementById("theme-toggle")));
    const tabs = [...bar.querySelectorAll(".m-tab")];
    check("하단 메뉴 5칸", tabs.map(t => t.textContent).join("|") === "홈|단어|문법|한자|더보기", tabs.map(t => t.textContent).join("|"));
    check("하단 메뉴가 화면 안에 있음", bar.getBoundingClientRect().right <= window.innerWidth && bar.getBoundingClientRect().left >= 0 && bar.getBoundingClientRect().bottom <= window.innerHeight, JSON.stringify(bar.getBoundingClientRect()));
    check("터치 크기 44px 이상", tabs.every(t => t.getBoundingClientRect().height >= 44 && t.getBoundingClientRect().width >= 44), tabs.map(t => Math.round(t.getBoundingClientRect().height)).join());
    check("지금 화면 표시(홈)", tabs[0].getAttribute("aria-current") === "page");
    tabs[1].click(); await wait(1300);
    check("단어로 이동", location.hash === "#n3/vocab" && bar.querySelector(".m-tab").getAttribute("aria-current") !== "page" && bar.querySelectorAll(".m-tab")[1].getAttribute("aria-current") === "page");
    check("단어 화면 가로 스크롤 없음", noScroll());
    // 더보기
    bar.querySelector("[data-m-more]").click(); await wait(150);
    const sheet = document.querySelector(".m-sheet");
    check("더보기 창 열림", sheet.open);
    const links = [...sheet.querySelectorAll(".m-link")].map(a => a.textContent);
    check("더보기에 나머지 메뉴 모두", ["로드맵", "기초", "독해", "청해", "오답 노트", "시험 대비", "모의고사", "기록 관리"].every(x => links.includes(x)), links.join(","));
    check("더보기에 방 바꾸기·다크 모드", !!sheet.querySelector('a[href="#rooms"]') && !!sheet.querySelector('[data-m-proxy="theme-toggle"]'));
    const before = document.documentElement.getAttribute("data-theme");
    sheet.querySelector('[data-m-proxy="theme-toggle"]').click(); await wait(150);
    check("더보기의 다크 모드가 실제로 바뀜", document.documentElement.getAttribute("data-theme") !== before && !sheet.open, document.documentElement.getAttribute("data-theme"));
    document.getElementById("theme-toggle").click(); await wait(50);
    bar.querySelector("[data-m-more]").click(); await wait(100);
    [...sheet.querySelectorAll(".m-link")].find(a => a.textContent === "독해").click(); await wait(1300);
    check("더보기에서 독해로 이동, 창 닫힘", location.hash === "#n3/reading" && !sheet.open);
    check("더보기 칸이 지금 화면 표시", bar.querySelector("[data-m-more]").getAttribute("aria-current") === "page");
    // 내용이 하단 메뉴에 가려지지 않는다
    await go("n3/backup");
    const homeBtn = $(".back-home");
    check("기록 관리: 맨 위 근처에 홈으로", !!homeBtn && homeBtn.getBoundingClientRect().top < 200, homeBtn && Math.round(homeBtn.getBoundingClientRect().top));
    window.scrollTo(0, document.documentElement.scrollHeight); await wait(100);
    const foot = document.querySelector("footer p").getBoundingClientRect();
    check("맨 아래 글이 하단 메뉴에 가리지 않음", foot.bottom <= bar.getBoundingClientRect().top + 1, Math.round(foot.bottom) + " / " + Math.round(bar.getBoundingClientRect().top));
    window.scrollTo(0, 0);
    // 방 밖의 화면에서는 위쪽 버튼을 쓴다
    await go("rooms");
    check("급수 선택: 하단 메뉴 없음, 다크 모드 버튼 보임", !shown(bar) && shown(document.getElementById("theme-toggle")));
    await go("n3/roadmap");
    const m = $(".road-stage .meter");
    check("로드맵: 이름과 가기 버튼이 한 줄", Math.abs(m.querySelector(".meter-name").getBoundingClientRect().top - m.querySelector("[data-go]").getBoundingClientRect().top) < 16);
    await go("badges");
    check("배지: 경험치 설명과 단계는 접혀 있음", [...app().querySelectorAll("details.voice-box")].length >= 2 && [...app().querySelectorAll("details.voice-box")].every(d => !d.open));
    await go("mock");
    check("모의고사: 구성 접힘, 시작 버튼 유지", !!$("details.more-box") && !$("details.more-box").open && !!$("#mock-start button[type=submit]"));
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
