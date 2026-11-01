(async () => {
  // 한자 창: 오쿠리가나 안내는 있을 때만, 닫기 버튼 평소 회색, 글자 굵기, 연상 이야기 구분, 쓰기 판 '다음 획 보기' 상태
  const log = [];
  const check = (name, ok, extra) => log.push((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? " → " + extra : ""));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById("app");
  const $ = s => app().querySelector(s);
  const go = async h => { location.hash = h; await wait(1500); };
  const open = async ch => { $('.k-row[data-kanji="' + ch + '"]').click(); await wait(700); return document.querySelector(".kanji-dialog"); };
  const css = (el, p) => window.getComputedStyle(el)[p];
  try {
    await go("n3/kanji");
    let d = await open("合");
    check("오쿠리가나 있는 한자(合)는 안내 보임", d.textContent.includes("오쿠리가나(한자 뒤에 붙는 가나)"));
    const close = d.querySelector(".kd-close");
    const line = css(d.querySelector(".kd-char"), "borderTopColor");
    check("닫기 버튼 평소 회색 테두리", !!close && css(close, "borderTopColor") === line, css(close, "borderTopColor") + " / " + line);
    check("닫기 버튼 글자 회색", css(close, "color") === css(d.querySelector(".kd-dl dt"), "color"));
    check("검정 본문 세미볼드(600)", css(d.querySelector(".kd-dl dd"), "fontWeight") === "600", css(d.querySelector(".kd-dl dd"), "fontWeight"));
    check("회색 보조 설명 미디움(500)", css(d.querySelector(".kd-dl dt"), "fontWeight") === "500", css(d.querySelector(".kd-dl dt"), "fontWeight"));
    const story = d.querySelector(".kd-box.story");
    check("연상 이야기는 '외우기 쉽게 만든 이야기' 표시, 어원과 구분", !story || story.textContent.includes("외우기 쉽게 만든 이야기예요"));
    check("'준비 중' 문구 없음", !d.textContent.includes("준비 중"));
    const partsRow = [...d.querySelectorAll(".kd-dl > div")].find(r => r.querySelector("dt").textContent === "모양 부품");
    check("모양 부품(合: 口 𠆢)", !!partsRow && partsRow.textContent.includes("口") && partsRow.textContent.includes("𠆢"), partsRow && partsRow.textContent);
    check("자료에 있는 부품만 누를 수 있음", !!partsRow && !!partsRow.querySelector('[data-goto-kanji="口"]') === !!document.querySelector('.k-row[data-kanji="口"]') || !!partsRow.querySelector("span.part"));
    const foot = d.querySelector(".kd-foot");
    check("자료 정보에 KRADFILE·CC BY-SA 4.0 링크", foot.textContent.includes("KRADFILE") && !!foot.querySelector('a[href="https://www.edrdg.org/edrdg/licence.html"]'));
    // 쓰기 판
    d.querySelector("[data-open-write]").click(); await wait(1500);
    const hb = d.querySelector('[data-wp="hint"]');
    hb.click(); await wait(150);
    const hl = d.querySelector(".wp-hint");
    check("다음 획 보기 켜짐 표시", hb.getAttribute("aria-pressed") === "true" && hb.textContent.includes("✓") && css(hb, "backgroundColor") !== "rgba(0, 0, 0, 0)", hb.textContent + " / " + css(hb, "backgroundColor"));
    check("몇 번째 획인지 표시", !hl.hidden && hl.textContent.includes("1번째 획") && hl.textContent.includes("전체 6획"), hl.textContent);
    const cv = d.querySelector(".wp-canvas"), r = cv.getBoundingClientRect();
    const stroke = (k) => {
      const o = { bubbles: true, pointerId: 1, clientX: r.left + 20 + k * 5, clientY: r.top + 20 };
      cv.dispatchEvent(new window.PointerEvent("pointerdown", o));
      cv.dispatchEvent(new window.PointerEvent("pointermove", Object.assign({}, o, { clientX: o.clientX + 30, clientY: o.clientY + 30 })));
      cv.dispatchEvent(new window.PointerEvent("pointerup", o));
    };
    stroke(0); await wait(100);
    check("한 획 쓰면 2번째 획", hl.textContent.includes("2번째 획"), hl.textContent);
    for (let k = 1; k < 6; k++) stroke(k);
    await wait(150);
    check("마지막 획까지 쓰면 완료 표시", hl.textContent.includes("마지막 획까지 다 썼어요"), hl.textContent);
    hb.click(); await wait(100);
    check("다시 누르면 꺼짐", hb.getAttribute("aria-pressed") === "false" && !hb.textContent.includes("✓") && hl.hidden);
    d.close(); await wait(300);
    // 오쿠리가나 없는 훈독만 있는 한자(的: まと)
    d = await open("的");
    check("오쿠리가나 없는 한자(的)는 안내 없음", !d.textContent.includes("오쿠리가나(한자 뒤에 붙는 가나)"));
    d.close(); await wait(300);
    // 새로 만든 뜻 설명·연상 이야기 (기존 자료가 있는 合은 그대로)
    d = await open("計");
    check("새 뜻 설명(計: 세다, 재다)", (d.querySelector(".kd-mean") || {}).textContent === "세다, 재다, 계획하다", (d.querySelector(".kd-mean") || {}).textContent);
    const st2 = d.querySelector(".kd-box.story");
    check("새 연상 이야기(計)와 '외우기 쉽게 만든 이야기' 표시, 어원 칸 없음", !!st2 && st2.textContent.includes("열(十)까지") && st2.textContent.includes("외우기 쉽게 만든 이야기예요") && !d.querySelector(".kd-box.origin"));
    check("자료 정보에 자체 제작 학습 자료 표시", d.querySelector(".kd-foot").textContent.includes("뜻 설명·연상 이야기: 자체 제작 학습 자료"));
    d.close(); await wait(300);
    d = await open("合");
    check("기존 연상 이야기는 그대로(合)", (d.querySelector(".kd-box.story p") || {}).textContent === "뚜껑(人 모양)을 그릇(口)에 딱 맞게 덮는다 → '맞다, 합치다'.", (d.querySelector(".kd-box.story p") || {}).textContent);
    d.close(); await wait(300);
    d = await open("手");
    check("부품으로 나눌 수 없는 한자(手)는 모양 부품 칸 없음", ![...d.querySelectorAll(".kd-dl dt")].some(t => t.textContent === "모양 부품") && !d.querySelector(".kd-foot").textContent.includes("KRADFILE"));
    d.querySelector(".kd-close").click(); await wait(300);
    check("닫기 버튼으로 닫힘", !d.open);
  } catch (e) { log.push("ERROR " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  return log.join("\n");
})()
