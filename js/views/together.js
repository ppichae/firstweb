// 함께 보기(공동 대시보드): 두 사람의 학습 현황과 응원 메시지
// 서버 없이 이 브라우저에 저장된 기록만 보여 준다. 다른 기기의 기록은 백업 파일을 불러와야 보인다.
import { esc, fmtDate, dateKey } from "../util.js";
import { PEOPLE, summaryOf, nameOf, otherOf, allCheers } from "../summary.js";

const PRESETS = ["오늘도 수고했어! 👏", "조금만 더 힘내자 💪", "같이 합격하자!", "오늘 목표 달성 축하해 🎉", "어려운 부분은 내일 다시 보자", "너라면 할 수 있어!"];
const ui = { editName: false, editGoal: false, msg: "" };

const timeText = m => (m >= 60 ? Math.floor(m / 60) + "시간 " + (m % 60) + "분" : m + "분");

export function createTogetherView(id, roomId) {
  function render(app) {
    const me = roomId, other = otherOf(roomId);
    const people = [summaryOf(me), summaryOf(other)];
    const cheers = allCheers().slice(0, 12);
    app.innerHTML =
      '<section class="panel">' +
        '<div class="panel-head"><div><h2>함께 보기</h2><p>두 사람의 학습 현황을 나란히 보고, 서로 응원 메시지를 남겨요.</p></div></div>' +
        '<p class="notice"><b>자동 동기화는 되지 않아요.</b> 이 사이트는 서버 없이 각 브라우저에 기록을 저장해요. ' +
          "같은 기기·같은 브라우저에서 둘 다 공부하면 바로 보이고, 서로 다른 기기라면 상대가 보낸 백업 파일을 '기록 관리'에서 불러와야 상대 기록이 보여요.</p>" +
        (ui.msg ? '<p class="toast" role="status">' + esc(ui.msg) + "</p>" : "") +
        '<div class="people">' + people.map(p => personCard(p, p.id === me)).join("") + "</div>" +
        '<article class="card-box"><h3>응원 메시지 보내기</h3>' +
          '<p class="hint">' + esc(nameOf(me)) + " → " + esc(nameOf(other)) + "</p>" +
          '<div class="toolbar">' + PRESETS.map((t, i) => '<button type="button" class="chip" data-preset="' + i + '">' + esc(t) + "</button>").join("") + "</div>" +
          '<form class="cheer-form" id="cheer-form"><div class="field search"><label for="cheer-text">직접 쓰기 (100자까지)</label>' +
            '<input id="cheer-text" maxlength="100" placeholder="응원 한마디를 써 주세요"></div>' +
            '<button type="submit" class="btn">보내기</button></form>' +
        "</article>" +
        '<article class="card-box"><h3>최근 응원 메시지</h3>' +
          (cheers.length
            ? '<ul class="cheers">' + cheers.map(c =>
                '<li><span class="cheer-who">' + esc(nameOf(c.from)) + " → " + esc(nameOf(c.to)) + '</span><span class="cheer-text">' + esc(c.text) + '</span><small>' + fmtDate(dateKey(new Date(c.at))) + "</small></li>").join("") + "</ul>"
            : '<p class="empty">아직 메시지가 없어요.</p>') +
        "</article>" +
      "</section>";
    ui.msg = "";

    app.onclick = e => {
      const pr = e.target.closest("[data-preset]");
      if (pr) { send(app, PRESETS[Number(pr.dataset.preset)]); return; }
      if (e.target.closest("#name-edit")) { ui.editName = true; render(app); return; }
      if (e.target.closest("#goal-edit")) { ui.editGoal = true; render(app); return; }
      if (e.target.closest("#edit-cancel")) { ui.editName = ui.editGoal = false; render(app); return; }
      if (e.target.closest("#name-save")) {
        const v = app.querySelector("#name-input").value.trim().slice(0, 20);
        PEOPLE[me].st.set("profile", v ? { name: v } : null);
        ui.editName = false; render(app); return;
      }
      if (e.target.closest("#goal-save")) {
        const v = Math.round(Number(app.querySelector("#goal-input").value));
        if (!(v >= 10 && v <= 6000)) { app.querySelector("#goal-msg").textContent = "10분에서 6000분 사이로 적어 주세요."; return; }
        PEOPLE[me].st.set("goal", { weeklyMinutes: v });
        ui.editGoal = false; render(app);
      }
    };
    app.querySelector("#cheer-form").onsubmit = e => {
      e.preventDefault();
      const t = app.querySelector("#cheer-text").value.trim();
      if (t) send(app, t.slice(0, 100));
    };
  }

  function send(app, text) {
    PEOPLE[roomId].st.update("cheers", list => { list.push({ text, at: Date.now() }); if (list.length > 100) list.splice(0, list.length - 100); });
    ui.msg = nameOf(otherOf(roomId)) + "에게 응원 메시지를 남겼어요.";
    render(app);
  }

  function personCard(p, mine) {
    const got = p.badges.filter(b => b.got);
    return '<article class="card-box person' + (mine ? " is-me" : "") + '">' +
      '<div class="q-top"><h3>' + esc(p.name) + ' <span class="badge">' + esc(PEOPLE[p.id].room) + "</span>" + (mine ? ' <span class="badge ok">지금 방</span>' : "") + "</h3>" +
        (mine && !ui.editName ? '<button type="button" class="link-btn" id="name-edit">이름 바꾸기</button>' : "") + "</div>" +
      (mine && ui.editName
        ? '<div class="toolbar"><input class="inline-input" id="name-input" maxlength="20" value="' + esc(p.name) + '" aria-label="이름">' +
          '<button type="button" class="btn sm" id="name-save">저장</button><button type="button" class="link-btn" id="edit-cancel">취소</button></div>'
        : "") +
      '<dl class="person-facts">' +
        fact("오늘 학습 시간", timeText(p.todayMin)) +
        fact("누적 학습 시간", timeText(p.totalMin)) +
        fact("오늘 학습한 단어", p.wordsToday + "회") +
        fact("오늘 푼 문제", p.questionsToday + "문제") +
        fact("연속 학습", p.streak + "일") +
      "</dl>" +
      meter("전체 진도", p.progressPct, p.progress.done + " / " + p.progress.total) +
      (p.goalMin
        ? meter("이번 주 목표", p.goalPct, timeText(p.weekMin) + " / " + timeText(p.goalMin))
        : '<p class="hint">이번 주 목표가 아직 없어요.' + (mine ? "" : " (" + esc(p.name) + "님 방에서 정할 수 있어요)") + "</p>") +
      (mine
        ? (ui.editGoal
            ? '<div class="toolbar"><label class="rate">주당 <input class="inline-input num" id="goal-input" type="number" min="10" max="6000" step="10" value="' + (p.goalMin || 300) + '"> 분</label>' +
              '<button type="button" class="btn sm" id="goal-save">저장</button><button type="button" class="link-btn" id="edit-cancel">취소</button><span class="confirm" id="goal-msg"></span></div>'
            : '<div class="toolbar"><button type="button" class="link-btn" id="goal-edit">' + (p.goalMin ? "목표 바꾸기" : "이번 주 목표 정하기") + "</button></div>")
        : "") +
      '<div class="badge-row" aria-label="학습 배지">' + (got.length
        ? got.map(b => '<span class="medal" title="' + esc(b.desc) + '">' + esc(b.name) + "</span>").join("")
        : '<span class="hint">아직 받은 배지가 없어요.</span>') + "</div>" +
    "</article>";
  }

  return { id, label: "함께 보기", needs: ["n1vocab", "n1grammar", "n3vocab", "n3grammar", "n3basics", "sources"], render };
}

function fact(t, v) { return "<div><dt>" + t + "</dt><dd>" + v + "</dd></div>"; }
function meter(label, pctV, sub) {
  return '<div class="person-meter"><div class="pm-head"><span>' + label + "</span><b>" + pctV + '%</b></div>' +
    '<div class="bar wide" aria-hidden="true"><span style="width:' + pctV + '%"></span></div><small>' + esc(sub) + "</small></div>";
}
