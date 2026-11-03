// 공부 파트너: 연결 코드로 서로를 연결하고, 연결되면 서로의 학습 요약을 보고 응원 메시지를 주고받는다
// 상대에게는 닉네임·급수·학습 요약(진도·공부 시간·연속 학습일·목표)만 보인다. 오답·즐겨찾기·문제별 기록은 보이지 않는다.
import { esc, fmtDate, today, dateKey } from "../util.js";
import { store, n3store } from "../store.js";
import { summaryOf } from "../summary.js";
import {
  myProfile, myCouple, loadCouple, partnerProfile, partnerSummary, pushSummary, createCode, myCodeState,
  requestWithCode, pendingRequests, respond, cancelRequest, unlink, listMessages, sendMessage, markRead,
  deleteMessage, hideMessage, myId,
} from "../account.js";

const REQUEST_TEXT = {
  requested: "요청을 보냈어요. 코드를 만든 사람이 승인하면 연결돼요.",
  invalid_code: "코드가 맞지 않거나 10분이 지났어요. 상대에게 새 코드를 받아 주세요.",
  self_connection: "내가 만든 코드는 입력할 수 없어요.",
  too_many_attempts: "코드를 여러 번 틀려서 1시간 동안 입력할 수 없어요.",
  already_connected: "이미 공부 파트너가 연결돼 있어요.",
  owner_already_connected: "코드를 만든 사람은 이미 다른 사람과 연결돼 있어요.",
  owner_has_pending_request: "코드를 만든 사람에게 이미 확인 중인 요청이 있어요. 잠시 뒤 다시 시도해 주세요.",
  not_signed_in: "로그인이 필요해요.",
};
const timeText = m => (m >= 60 ? Math.floor(m / 60) + "시간 " + (m % 60) + "분" : (m || 0) + "분");
const avatar = name => '<span class="avatar" aria-hidden="true">' + esc((name || "?").trim().slice(0, 1)) + "</span>";
const hhmm = iso => { const d = new Date(iso); return fmtDate(dateKey(d)) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

// 이 기기에 저장된 기록으로 만든 내 학습 요약 (상대에게는 이 요약만 보인다)
function lastStudyDay() {
  let last = "";
  [store, n3store].forEach(st => {
    const act = st.get("activity") || {};
    Object.keys(act).forEach(k => { if (Object.values(act[k]).some(v => v > 0) && k > last) last = k; });
    (st.get("attempts") || []).forEach(a => { const k = dateKey(new Date(a.at)); if (k > last) last = k; });
  });
  return last || null;
}
function mySummary() {
  const level = (myProfile() || {}).jlpt_level || "N1";
  const n1 = summaryOf("n1"), n3 = summaryOf("n3");
  const room = s => ({ progressPct: s.progressPct, done: s.progress.done, total: s.progress.total, todayMin: s.todayMin, weekMin: s.weekMin, totalMin: s.totalMin, streak: s.streak });
  const main = level === "N3" ? n3 : n1;
  return {
    v: 1, rooms: { n1: room(n1), n3: room(n3) },
    totalMinutes: n1.totalMin + n3.totalMin, lastStudyDay: lastStudyDay(), streak: Math.max(n1.streak, n3.streak),
    goal: main.goalMin ? { weekMin: main.weekMin, goalMin: main.goalMin, goalPct: main.goalPct } : null,
    updatedAt: new Date().toISOString(),
  };
}

function summaryHTML(name, level, d, mine) {
  if (!d) return '<article class="card-box pt-card">' + '<div class="pt-head">' + avatar(name) + "<div><b>" + esc(name) + '</b> <span class="badge">' + esc(level) + "</span></div></div>" +
    '<p class="hint">아직 학습 요약이 없어요. 상대가 이 화면을 한 번 열면 요약이 올라와요.</p></article>';
  const mainKey = level === "N3" ? "n3" : "n1", otherKey = mainKey === "n1" ? "n3" : "n1";
  const r = (d.rooms || {})[mainKey] || {}, o = (d.rooms || {})[otherKey] || {};
  return '<article class="card-box pt-card">' +
    '<div class="pt-head">' + avatar(name) + "<div><b>" + esc(name) + '</b> <span class="badge">' + esc(level) + "</span>" + (mine ? ' <small class="hint">(나)</small>' : "") + "</div></div>" +
    '<dl class="pt-stats">' +
      "<div><dt>" + esc(level) + " 진도</dt><dd>" + (r.progressPct ?? 0) + "% <small>" + (r.done ?? 0) + "/" + (r.total ?? 0) + "</small></dd></div>" +
      "<div><dt>총 공부 시간</dt><dd>" + timeText(d.totalMinutes) + "</dd></div>" +
      "<div><dt>연속 학습</dt><dd>" + (d.streak || 0) + "일</dd></div>" +
      "<div><dt>최근 학습</dt><dd>" + (d.lastStudyDay ? (d.lastStudyDay === today() ? "오늘" : fmtDate(d.lastStudyDay)) : "없음") + "</dd></div>" +
      "<div><dt>이번 주 목표</dt><dd>" + (d.goal ? timeText(d.goal.weekMin) + " / " + timeText(d.goal.goalMin) + " <small>(" + d.goal.goalPct + "%)</small>" : "정하지 않음") + "</dd></div>" +
      (o.done ? "<div><dt>" + otherKey.toUpperCase() + " 진도</dt><dd>" + (o.progressPct ?? 0) + "%</dd></div>" : "") +
    "</dl>" +
    (d.updatedAt ? '<p class="hint">요약 업데이트: ' + hhmm(d.updatedAt) + "</p>" : "") +
  "</article>";
}

export function createPartnerView() {
  let timer = null;
  const ui = { code: null, codeExpires: null, msg: "", msgKind: "", busy: false };

  async function render(app) {
    app.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>공부 파트너</h2></div></div><p class="loading">불러오는 중이에요…</p></section>';
    const me = myProfile();
    if (!me) { app.innerHTML = '<section class="panel"><p class="notice">프로필을 불러오지 못했어요. 새로고침해 주세요.</p></section>'; return; }
    let couple, pp = null, ps = null, msgs = [], reqs = { incoming: [], outgoing: [] }, codeState = null, error = "";
    try {
      // 내 요약을 먼저 올린다 (연결된 상대가 볼 수 있도록. 연결 전에도 올려 두면 연결하자마자 보인다)
      await pushSummary(mySummary()).catch(e => console.error("요약을 올리지 못했어요.", e));
      couple = await loadCouple();
      if (couple && couple.partnerId) {
        [pp, ps, msgs] = await Promise.all([partnerProfile(), partnerSummary(couple.partnerId), listMessages()]);
        if (msgs.some(m => m.receiver === myId() && !m.read_at)) markRead().catch(() => {});
      } else {
        [reqs, codeState] = await Promise.all([pendingRequests(), myCodeState()]);
      }
    } catch (e) { error = e.message || "알 수 없는 오류"; }

    const flash = ui.msg ? '<p class="notice ' + (ui.msgKind === "bad" ? "pt-bad" : "pt-good") + '" role="status">' + esc(ui.msg) + "</p>" : "";
    const myCard = summaryHTML(me.nickname, me.jlpt_level, mySummary(), true);
    let body;
    if (error) {
      body = '<p class="notice pt-bad">서버에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요. (' + esc(error) + ")</p>";
    } else if (couple && couple.partnerId) {
      body =
        '<div class="pt-grid">' + myCard + summaryHTML(pp ? pp.nickname : "파트너", pp ? pp.jlpt_level : "", ps ? ps.data : null, false) + "</div>" +
        '<article class="card-box"><h3>응원 메시지</h3>' +
          '<form class="pt-send" id="pt-send"><input id="pt-text" maxlength="300" placeholder="응원 한마디를 남겨 보세요" aria-label="응원 메시지"><button class="btn" type="submit">보내기</button></form>' +
          (msgs.length ? '<ul class="pt-msgs">' + msgs.map(m => {
            const mine = m.sender === myId();
            return '<li class="' + (mine ? "mine" : "theirs") + '"><div class="pt-bubble">' + esc(m.body) + "</div>" +
              '<small class="hint">' + (mine ? "내가 보냄" : esc(pp ? pp.nickname : "파트너")) + " · " + hhmm(m.created_at) +
              (mine ? (m.read_at ? " · 읽음" : " · 안 읽음") : "") + "</small>" +
              (mine ? '<button type="button" class="link-btn" data-del="' + m.id + '">지우기</button>' : '<button type="button" class="link-btn" data-hide="' + m.id + '">숨기기</button>') +
              "</li>";
          }).join("") + "</ul>" : '<p class="empty">아직 주고받은 메시지가 없어요.</p>') +
        "</article>" +
        '<article class="card-box"><h3>연결 관리</h3><p class="hint">연결을 해제하면 서로의 학습 요약과 메시지를 바로 볼 수 없게 돼요. 내 학습 기록은 지워지지 않아요.</p>' +
          '<button type="button" class="btn ghost" id="pt-unlink">연결 해제</button></article>';
    } else {
      const codeAlive = ui.code && codeState && !codeState.used_at && new Date(codeState.expires_at) > new Date();
      body =
        '<div class="pt-grid">' + myCard +
        '<article class="card-box"><h3>파트너와 연결하기</h3>' +
          '<p class="hint">한 사람이 코드를 만들고, 다른 사람이 그 코드를 입력해요. 코드를 만든 사람이 승인하면 연결돼요. 급수가 달라도 연결할 수 있어요.</p>' +
          '<div class="pt-step"><b>① 코드 만들기</b>' +
            (codeAlive ? '<div class="pt-code" lang="en">' + esc(ui.code) + '</div><p class="hint">이 코드를 파트너에게 알려 주세요. ' + hhmm(codeState.expires_at) + "까지 쓸 수 있어요.</p>"
              : (codeState && codeState.used_at && ui.code ? '<p class="hint">코드가 사용됐어요. 아래에서 요청을 확인해 주세요.</p>' : "")) +
            '<button type="button" class="btn ghost" id="pt-make">' + (codeAlive ? "새 코드 만들기" : "연결 코드 만들기") + "</button></div>" +
          '<form class="pt-step" id="pt-enter"><b>② 받은 코드 입력하기</b>' +
            '<div class="pt-send"><input id="pt-code-in" maxlength="8" placeholder="8자리 코드" autocomplete="off" autocapitalize="characters" aria-label="연결 코드"><button class="btn" type="submit">연결 요청</button></div></form>' +
        "</article></div>" +
        (reqs.incoming.length ? '<article class="card-box"><h3>받은 연결 요청</h3><ul class="pt-reqs">' + reqs.incoming.map(r =>
          '<li>내 코드를 입력한 요청 · ' + hhmm(r.created_at) + ' <span class="pt-actions"><button type="button" class="btn" data-acc="' + r.id + '">승인</button><button type="button" class="btn ghost" data-rej="' + r.id + '">거절</button></span></li>').join("") +
          '</ul><p class="hint">내가 코드를 알려 준 사람이 맞는지 확인하고 승인해 주세요.</p></article>' : "") +
        (reqs.outgoing.length ? '<article class="card-box"><h3>보낸 연결 요청</h3><ul class="pt-reqs">' + reqs.outgoing.map(r =>
          '<li>승인을 기다리는 중 · ' + hhmm(r.created_at) + ' <button type="button" class="link-btn" data-cancel="' + r.id + '">요청 취소</button></li>').join("") + "</ul></article>" : "");
    }

    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>공부 파트너</h2><p>상대에게는 닉네임·급수·학습 요약만 보여요.</p></div>' +
          '<div class="toolbar"><a class="btn ghost" href="#profile">프로필 바꾸기</a><button type="button" class="btn ghost" id="pt-refresh">새로고침</button></div></div>' +
        flash + body +
        '<p class="hint">학습 요약은 계정에 저장된 기록(이 기기에서 아직 보내지 않은 기록 포함)으로 계산해요.</p>' +
        '<p><a href="#records">내 기록(동기화·예전 기록 가져오기·백업) →</a></p>' +
        '<p><a href="#' + (me.jlpt_level === "N3" ? "n3" : "home") + '">← ' + esc(me.jlpt_level) + " 공부방으로 돌아가기</a></p>" +
      "</section>";
    ui.msg = "";

    const act = async (fn, okMsg) => {
      if (ui.busy) return;
      ui.busy = true;
      try { const r = await fn(); if (okMsg) { ui.msg = typeof okMsg === "function" ? okMsg(r) : okMsg; ui.msgKind = "good"; } }
      catch (e) { ui.msg = "처리하지 못했어요. 다시 시도해 주세요. (" + (e.message || "오류") + ")"; ui.msgKind = "bad"; }
      ui.busy = false;
      render(app);
    };
    app.onclick = e => {
      const t = e.target;
      if (t.closest("#pt-refresh")) render(app);
      else if (t.closest("#pt-make")) act(async () => { ui.code = await createCode(); }, "새 코드를 만들었어요. 10분 안에 파트너가 입력해야 해요.");
      else if (t.dataset.acc) act(() => respond(t.dataset.acc, true), r => (r === "approved" ? "연결됐어요! 이제 서로의 학습 현황을 볼 수 있어요." : r === "expired" ? "요청 시간이 지났어요. 새 코드로 다시 연결해 주세요." : "처리했어요."));
      else if (t.dataset.rej) act(() => respond(t.dataset.rej, false), "요청을 거절했어요.");
      else if (t.dataset.cancel) act(() => cancelRequest(t.dataset.cancel), "요청을 취소했어요.");
      else if (t.dataset.del) act(() => deleteMessage(t.dataset.del), "메시지를 지웠어요.");
      else if (t.dataset.hide) act(() => hideMessage(t.dataset.hide), "메시지를 내 화면에서 숨겼어요.");
      else if (t.closest("#pt-unlink")) {
        if (confirm("공부 파트너 연결을 해제할까요? 서로의 학습 요약과 메시지를 바로 볼 수 없게 돼요. 학습 기록은 지워지지 않아요.")) act(unlink, "연결을 해제했어요.");
      }
    };
    app.onsubmit = e => {
      e.preventDefault();
      if (e.target.id === "pt-enter") {
        const code = app.querySelector("#pt-code-in").value.trim().toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(code)) { ui.msg = "코드는 영문·숫자 8자리예요."; ui.msgKind = "bad"; render(app); return; }
        act(() => requestWithCode(code), r => { ui.msgKind = r.status === "requested" ? "good" : "bad"; return REQUEST_TEXT[r.status] || "처리하지 못했어요."; });
      } else if (e.target.id === "pt-send") {
        const text = app.querySelector("#pt-text").value.trim();
        if (!text) return;
        act(() => sendMessage(text), "응원 메시지를 보냈어요.");
      }
    };
    // 연결 전에는 상대의 요청·승인을 볼 수 있게 15초마다 새로 확인한다 (입력 중이면 건너뛴다)
    clearInterval(timer);
    if (!(myCouple() && myCouple().partnerId)) timer = setInterval(() => {
      const typing = document.activeElement && document.activeElement.id === "pt-code-in" && document.activeElement.value;
      if (document.visibilityState === "visible" && !ui.busy && !typing) render(app);
    }, 15000);
  }

  return {
    id: "partner", label: "공부 파트너", render,
    needs: ["n1vocab", "n1grammar", "n3vocab", "n3grammar", "n3basics", "sources"],
    leave() { clearInterval(timer); timer = null; },
    docTitle: "공부 파트너 · JLPT 공부방",
    eyebrow: "日本語能力試験 · JLPT",
    title: 'JLPT <span lang="ja">合格!</span>',
    lede: "공부 파트너와 서로의 학습 현황을 보고 응원해요.",
  };
}
