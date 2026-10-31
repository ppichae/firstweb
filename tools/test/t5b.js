(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const log = [];
  location.hash = "listening"; await wait(300);
  document.querySelector('[data-ltype="response"]').click();
  await wait(2500);
  const voices = window.speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang)).map(v => v.name + (v.localService ? "(local)" : "(online)"));
  log.push("ja voices: " + voices.join(", "));
  if (!$("#p-play")) return log.concat("no player").join("\n");
  $("#p-play").click();
  const states = [];
  for (let i = 0; i < 40; i++) { await wait(250); const s = $("#p-state").textContent; if (states[states.length - 1] !== s) states.push(s); }
  log.push("states: " + states.join(" → "));
  log.push("speaking now: " + window.speechSynthesis.speaking);
  return log.join("\n");
})()
