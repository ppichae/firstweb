(async () => {
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s), $$ = s => [...app().querySelectorAll(s)];
  const go = async h => { location.hash = h; await wait(1300); };
  const W = () => document.documentElement.clientWidth;
  try {
    await go("n3/vocab");
    check("N3 단어 화면에 'PDF' 문구 없음", !app().textContent.includes("PDF"), (app().textContent.match(/.{10}PDF.{10}/) || [""])[0]);
    $("#toggle-all").click(); await wait(100);
    const t = app().textContent;
    check("단어 카드에 출처 배지 없음", !$(".card .badges"));
    check("부정 문구 없음(검수 필요·자료 준비 중)", !t.includes("검수 필요") && !t.includes("자료 준비 중"));
    $('[data-mode="cards"]').click(); await wait(100); $("#flip").click(); await wait(50);
    check("복습 버튼 이름", $$(".grade span").map(s => s.textContent).join("|") === "모르겠어요|헷갈려요|알았어요|쉬워요", $$(".grade span").map(s => s.textContent).join("|"));
    check("복습 시점 표시", $$(".grade small").map(s => s.textContent).join("|") === "오늘 다시|내일 다시|내일 다시|3일 뒤 다시", $$(".grade small").map(s => s.textContent).join("|"));
    check("복습 간격 안내", !!$(".srs-help") && $(".srs-help").textContent.includes("180일"));
    await go("n3/grammar");
    check("N3 문법 화면 'PDF' 없음", !app().textContent.includes("PDF"));
    await go("vocab");
    check("N1 자료 필터 이름", [...$("#v-src").options].map(o => o.textContent).join("|") === "전체|기본 단어장|참고 목록 단어");
    check("N1 화면 'PDF' 없음", !app().textContent.includes("PDF"));
    await go("home");
    check("N1 7일 그래프 0 포함 7칸", $$(".week-val").length === 7 && $$(".week-val").every(v => /^\d+$/.test(v.textContent)), $$(".week-val").map(v => v.textContent).join(","));
    check("N1 시험 구성 + 공식 예시 링크", app().textContent.includes("N1 시험 구성") && !!$('a[href*="sampleindex"]'));
    await go("n3");
    check("N3 7일 그래프", $$(".week-val").length === 7);
    check("N3 시험 구성(공식)", app().textContent.includes("N3 시험 구성") && app().textContent.includes("95점") && app().textContent.includes("30분") && app().textContent.includes("70분") && app().textContent.includes("40분"));
    await go("n3/reading");
    check("N3 독해 지문 표시", app().querySelectorAll(".pick").length >= 10 && !app().textContent.includes("자료 준비 중"));
    await go("n3/listening");
    check("N3 청해 문항 표시", app().querySelectorAll(".pick").length >= 10 && !app().textContent.includes("자료 준비 중"));
    await go("kanji");
    $('[data-klv="all"]').click(); await wait(300); const ib = $('.k-row[data-kanji="込"]');
    check("込 타일 한국음 입", ib && ib.textContent.includes("입"), ib && ib.textContent);
    ib.click(); await wait(500);
    const d = document.querySelector(".kanji-dialog");
    check("込 창: 한국 한자음 입", d.querySelector(".kd-ko b").textContent === "입" && !d.textContent.includes("뜻 미확인"));
    check("자료 정보 표시", d.textContent.includes("KANJIDIC2") && d.textContent.includes("KanjiVG"));
    d.close();
    await go("home");
    check("가로 스크롤 없음 (" + W() + ")", document.documentElement.scrollWidth <= W());
    const ws = $(".week-scroll");
    check("그래프 칸 너비 확보", ws && $$(".week-col")[0].getBoundingClientRect().width >= 40, Math.round($$(".week-col")[0].getBoundingClientRect().width));
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
