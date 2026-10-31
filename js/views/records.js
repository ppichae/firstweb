// 내 기록: 동기화 상태, 다른 기기와 다르게 바뀐 항목(직접 고르기), 이 기기의 예전 기록 가져오기·취소, 예전 응원 메시지, 백업
import { esc, fmtDate, dateKey, today } from "../util.js";
import { currentUser } from "../auth.js";
import { myProfile, myCouple, loadCouple } from "../account.js";
import {
  syncStatus, flush, pull, conflicts, resolveConflict, legacyData, countData, importData, listImports, cancelImport,
  listLegacyCheers, exportMine, viewGet, deviceId,
} from "../sync.js";
import { getClient } from "../auth.js";
import { readCell } from "../sync-schema.js";

const AREA = { words: "N1 핵심 단어", lists: "단어", grammar: "문법", kanji: "한자", basics: "기초 단원", badges: "배지", examDate: "시험일", goal: "주간 목표", sprint: "D-30", game: "경험치" };
const FIELD = { status: "외움 여부", fav: "즐겨찾기", studied: "공부했어요", srs: "복습 일정", seen: "처음 본 날", last: "마지막으로 본 날", done: "완료한 날", best: "최고 점수", date: "받은 날", value: "설정" };
const valText = v => (v === true ? "켜짐" : v === false || v === null ? "꺼짐(비움)" : v === "known" ? "외웠어요" : v === "unknown" ? "모르겠어요" : typeof v === "object" ? "변경된 값" : String(v));
const hhmm = iso => { const d = new Date(iso); return fmtDate(dateKey(d)) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const lastExportKey = () => "jlpt:lastExport:" + ((currentUser() || {}).id || "");
export function backupDue() {
  try { const t = localStorage.getItem(lastExportKey()); return !t || Date.now() - Number(t) > 7 * 86400000; } catch (e) { return false; }
}

export function createRecordsView() {
  const ui = { msg: "", kind: "", busy: false, confirm: null };

  async function render(app) {
    const st = syncStatus();
    if (!st.active) { app.innerHTML = '<section class="panel"><h2>내 기록</h2><p class="notice">로그인하면 학습 기록을 계정에 저장하고 여러 기기에서 이어서 공부할 수 있어요.</p></section>'; return; }
    let imports = [], cheers = [], sentIds = new Set(), err = "";
    try {
      [imports, cheers] = await Promise.all([listImports(), listLegacyCheers()]);
      await loadCouple().catch(() => null);
      const { data } = await getClient().from("encouragement_messages").select("legacy_cheer_id").not("legacy_cheer_id", "is", null);
      sentIds = new Set((data || []).map(m => m.legacy_cheer_id));
    } catch (e) { err = e.message || "오류"; }
    const legacy = { n1: legacyData("n1"), n3: legacyData("n3") };
    const lc = { n1: countData(legacy.n1), n3: countData(legacy.n3) };
    const hasLegacy = ["n1", "n3"].some(r => Object.values(lc[r]).some(n => n > 0));
    const conf = conflicts();
    const flash = ui.msg ? '<p class="notice ' + (ui.kind === "bad" ? "pt-bad" : "pt-good") + '" role="status">' + esc(ui.msg) + "</p>" : "";
    const roomLine = (r, c) => '<li><b>' + r.toUpperCase() + "</b> 문제 풀이 " + c.attempts + "개 · 단어 " + c.words + "개 · 문법 " + c.grammar + "개 · 한자 " + c.kanji + "자 · 공부한 날 " + c.studyDays + "일(" + c.minutes + "분) · 모의고사·테스트 " + c.mocks + "회 · 응원 메시지 " + c.cheers + "개</li>";

    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>내 기록</h2><p>학습 기록은 이 기기에 먼저 저장된 뒤 계정(서버)으로 보내져요. 다른 기기에서 로그인해도 이어서 공부할 수 있어요.</p></div>' +
          '<div class="toolbar"><button type="button" class="btn ghost" id="rc-sync">지금 맞추기</button></div></div>' +
        flash + (err ? '<p class="notice pt-bad">서버에 연결하지 못했어요. (' + esc(err) + ")</p>" : "") +

        // 1. 동기화 상태
        '<article class="card-box"><h3>동기화 상태</h3><dl class="pt-stats">' +
          "<div><dt>보내지 않은 기록</dt><dd>" + st.pending + "개</dd></div>" +
          "<div><dt>마지막으로 보낸 때</dt><dd>" + (st.lastSync ? hhmm(st.lastSync) : "아직 없음") + "</dd></div>" +
          "<div><dt>이 기기 저장소</dt><dd>" + (st.storage === "idb" ? "안전 저장(IndexedDB)" : st.storage === "ls" ? "기본 저장" : "저장할 수 없음") + "</dd></div>" +
          "<div><dt>확인이 필요한 항목</dt><dd>" + st.conflicts + "개</dd></div></dl>" +
          (st.storageError ? '<p class="notice pt-bad">' + esc(st.storageError) + ". 이 브라우저에서는 기록을 안전하게 저장할 수 없어요. 서버로 보내기 전에 창을 닫으면 기록이 사라질 수 있어요.</p>" : "") +
          (st.error ? '<p class="hint">' + esc(st.error) + " — 인터넷이 연결되면 자동으로 다시 보내요.</p>" : "") +
        "</article>" +

        // 2. 확인이 필요한 항목
        (conf.length ? '<article class="card-box"><h3>다른 기기와 다르게 바뀐 항목 <small class="hint">' + conf.length + "개</small></h3>" +
          '<p class="hint">같은 항목을 다른 기기에서 먼저 바꿔서 자동으로 덮어쓰지 않았어요. 남길 값을 골라 주세요.</p><ul class="pt-reqs">' +
          conf.map(c => {
            const cur = readCell(c.area, viewGet(c.room, c.area), c.item_id, c.field);
            return "<li><span><b>" + esc(AREA[c.area] || c.area) + "</b> " + esc(c.item_id === "_" ? "" : c.item_id) + " · " + esc(FIELD[c.field] || c.field) +
              '<br><small class="hint">저장된 값: ' + esc(valText(cur)) + " / " + (c.device_id === deviceId() ? "이 기기" : "다른 기기") + "에서 바꾼 값: " + esc(valText(c.value)) + " (" + hhmm(c.received_at) + ")</small></span>" +
              '<span class="pt-actions"><button type="button" class="btn ghost" data-keep="' + c.op_id + '">저장된 값 유지</button><button type="button" class="btn" data-take="' + c.op_id + '">바꾼 값으로</button></span></li>';
          }).join("") + "</ul></article>" : "") +

        // 3. 예전 기록 가져오기
        '<article class="card-box"><h3>이 기기의 예전 기록 가져오기</h3>' +
          (hasLegacy
            ? '<p class="hint">로그인하기 전에 이 기기(브라우저)에 저장된 기록이에요. 가져오면 내 계정에 합쳐지고, 원래 기록은 이 기기에 그대로 남아요. 같은 기록은 두 번 들어가지 않아요.</p><ul class="rc-list">' +
                (Object.values(lc.n1).some(n => n) ? roomLine("n1", lc.n1) : "") + (Object.values(lc.n3).some(n => n) ? roomLine("n3", lc.n3) : "") + "</ul>" +
                (ui.confirm === "import"
                  ? '<p class="notice">가져오기 전에 이 기기의 예전 기록을 백업 파일로 받아 두는 것을 권해요(각 학습실 → 기록 관리). 정말 가져올까요?</p><div class="toolbar"><button type="button" class="btn" id="rc-import-yes">가져오기</button><button type="button" class="btn ghost" id="rc-no">취소</button></div>'
                  : '<button type="button" class="btn" id="rc-import">내 계정으로 가져오기</button>')
            : '<p class="hint">이 기기에는 가져올 예전 기록이 없어요.</p>') +
          (imports.length ? "<h4>가져오기 기록</h4><ul class=\"pt-reqs\">" + imports.map(b => {
            const c = b.counts || {}, total = Object.values(c).reduce((s, x) => s + ((x && x.attempts) || 0), 0);
            return "<li><span>" + hhmm(b.created_at) + " · " + esc(b.source === "legacy-browser" ? "이 기기 예전 기록" : b.source === "backup-file" ? "백업 파일" : b.source) +
              " · 문제 풀이 " + total + "개" + (b.status === "cancelled" ? ' · <b>취소됨</b>' + (b.verify ? ' <small class="hint">(되돌린 칸 ' + (b.verify.reverted_fields || 0) + "개, 그 뒤 바꾼 칸은 유지 " + (b.verify.kept_changed_after_import || 0) + "개)</small>" : "") : "") + "</span>" +
              (b.status === "active" ? (ui.confirm === "cancel:" + b.id
                ? '<span class="pt-actions"><button type="button" class="btn" data-cancel-yes="' + b.id + '">정말 취소</button><button type="button" class="btn ghost" id="rc-no">아니요</button></span>'
                : '<button type="button" class="link-btn" data-cancel="' + b.id + '">이 가져오기 취소</button>') : "") + "</li>";
          }).join("") + '</ul><p class="hint">가져오기를 취소하면 그때 가져온 기록만 빠지고, 가져온 뒤에 새로 공부한 기록은 그대로 남아요.</p>' : "") +
        "</article>" +

        // 4. 예전 응원 메시지
        (cheers.length ? '<article class="card-box"><h3>예전 응원 메시지 <small class="hint">' + cheers.length + "개</small></h3>" +
          '<p class="hint">로그인 전에 남긴 메시지예요. 나만 볼 수 있고, 원본은 바뀌지 않아요. 보내고 싶은 메시지만 골라 공부 파트너에게 복사본을 보낼 수 있어요. 보낸 복사본은 공부 파트너 화면에서 지울 수 있어요.</p><ul class="pt-reqs">' +
          cheers.map(c => "<li><span>" + esc(c.body) + ' <small class="hint">' + fmtDate(dateKey(new Date(c.written_at))) + " · " + c.room.toUpperCase() + "</small></span>" +
            (sentIds.has(c.id) ? '<span class="hint">보냄</span>' : (myCouple() && myCouple().partnerId ? '<button type="button" class="link-btn" data-send="' + c.id + '">파트너에게 보내기</button>' : '<span class="hint">파트너 연결 후 보낼 수 있어요</span>')) + "</li>").join("") +
          "</ul></article>" : "") +

        // 5. 백업
        '<article class="card-box"><h3>내 데이터 내보내기 (백업)</h3>' +
          '<p class="hint">무료 서버는 자동 백업이 없고, 오래 쓰지 않으면 일시 정지될 수 있어요(매일 써도 정지되지 않는다고 보장할 수 없어요). 일주일에 한 번 백업 파일을 받아서 파일 앱이나 클라우드에 보관해 주세요.</p>' +
          '<p class="hint"><b>휴대폰 브라우저에 남은 기록은 백업이 아니에요.</b> 사파리 설정에서 웹사이트 데이터를 지우거나 휴대폰을 초기화하면 함께 사라질 수 있어요.</p>' +
          (backupDue() ? '<p class="notice">마지막 백업 후 7일이 지났어요. 백업 파일을 받아 두세요.</p>' : "") +
          '<button type="button" class="btn" id="rc-export">백업 파일 받기</button></article>' +
        '<p><a href="#partner">← 공부 파트너</a></p>' +
      "</section>";
    ui.msg = "";

    const act = async (fn, ok) => {
      if (ui.busy) return;
      ui.busy = true;
      try { const r = await fn(); ui.msg = typeof ok === "function" ? ok(r) : ok; ui.kind = "good"; }
      catch (e) { ui.msg = "처리하지 못했어요. (" + (e.message || "오류") + ")"; ui.kind = "bad"; }
      ui.busy = false; ui.confirm = null; render(app);
    };
    app.onclick = e => {
      const t = e.target;
      if (t.id === "rc-sync") act(async () => { await flush(); await pull(); }, "서버와 기록을 맞췄어요.");
      else if (t.id === "rc-import") { ui.confirm = "import"; render(app); }
      else if (t.id === "rc-no") { ui.confirm = null; render(app); }
      else if (t.id === "rc-import-yes") act(() => importData(legacy, "legacy-browser", navigator.userAgent.slice(0, 80)), r =>
        "가져왔어요: 새 기록 " + r.inserted + "개(이미 있던 " + r.skipped + "개는 건너뜀) · 서버 확인 " + r.serverCount + "개 · 상태 " + r.opsApplied + "칸 반영" +
        (r.opsReview ? ", 확인 필요 " + r.opsReview + "칸" : "") + (r.cheers ? " · 응원 메시지 " + r.cheersIn + "개" : "") + ". 원래 기록은 이 기기에 그대로 있어요.");
      else if (t.dataset.cancel) { ui.confirm = "cancel:" + t.dataset.cancel; render(app); }
      else if (t.dataset.cancelYes) act(async () => {
        try { return await cancelImport(t.dataset.cancelYes, false); }
        catch (e) {
          if (/SENT_COPIES_EXIST/.test(e.message) && confirm("이 가져오기의 예전 응원 메시지 중 파트너에게 보낸 복사본이 있어요. 복사본도 함께 지우고 취소할까요?")) return cancelImport(t.dataset.cancelYes, true);
          throw e;
        }
      }, r => "가져오기를 취소했어요. 가져온 기록만 빠졌고, 그 뒤에 공부한 기록은 그대로예요." + (r && r.before ? " (빠진 기록 " + r.before.events + "개)" : ""));
      else if (t.dataset.take) act(() => resolveConflict(t.dataset.take, true), "바꾼 값으로 정했어요.");
      else if (t.dataset.keep) act(() => resolveConflict(t.dataset.keep, false), "저장된 값을 유지했어요.");
      else if (t.dataset.send) act(async () => {
        const c = cheers.find(x => x.id === t.dataset.send), cp = myCouple();
        const { error } = await getClient().from("encouragement_messages").insert({ couple_id: cp.coupleId, receiver: cp.partnerId, body: c.body, legacy_cheer_id: c.id, original_at: c.written_at });
        if (error) throw error;
      }, "예전 메시지의 복사본을 보냈어요. 원본은 그대로예요.");
      else if (t.id === "rc-export") {
        const blob = new Blob([JSON.stringify(exportMine(myProfile()), null, 1)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "jlpt-my-account-" + today() + ".json"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        try { localStorage.setItem(lastExportKey(), String(Date.now())); } catch (e2) { /* 무시 */ }
        ui.msg = "백업 파일을 받았어요. 파일 앱이나 클라우드에 보관해 주세요."; ui.kind = "good"; render(app);
      }
    };
  }

  return {
    id: "records", label: "내 기록", render,
    docTitle: "내 기록 · JLPT 공부방", eyebrow: "日本語能力試験 · JLPT", title: 'JLPT <span lang="ja">合格!</span>',
    lede: "학습 기록 동기화와 백업을 관리해요.",
  };
}
