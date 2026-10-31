(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const log = [];
  location.hash = "listening"; await wait(3000);
  const seen = [];
  new window.MutationObserver(() => seen.push($("#p-state").textContent + "/" + $("#p-play").textContent))
    .observe($("#player"), { subtree: true, childList: true, characterData: true });
  // 음성 오류 이유를 직접 확인
  const u = new window.SpeechSynthesisUtterance("テストです。");
  u.lang = "ja-JP";
  const result = await new Promise(res => { u.onstart = () => res("start"); u.onerror = e => res("error: " + e.error); setTimeout(() => res("timeout"), 3000); window.speechSynthesis.speak(u); });
  log.push("direct speak: " + result);
  window.speechSynthesis.cancel();
  $("#p-play").click();
  await wait(1500);
  log.push("state changes: " + seen.join(" | "));
  // 일시 정지 버튼 동작 (재생 중일 때만 의미 있음)
  return log.join("\n");
})()
