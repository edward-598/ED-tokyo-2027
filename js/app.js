/* =========================================================
   app.js
   ---------------------------------------------------------
   整個 V1 的主程式。

   你之後最常改的地方通常不會在這裡，
   而是在 data/training.json。

   本檔案主要負責：
   1) 讀取課表資料
   2) 判斷現在在哪個 Phase / Week
   3) 顯示 Today
   4) 顯示 Calendar
   5) 開啟單日課表
   6) 寫入完成紀錄
   ========================================================= */

const App = {
  data: null,
  workoutMap: new Map(),
  phaseMap: new Map(),
  view: "today",
  calendarDate: new Date(),
  activeWorkout: null,
  activeMode: "main",

  async init() {
    try {
      const response = await fetch("data/training.json");
      if (!response.ok) throw new Error("training.json 載入失敗");

      this.data = await response.json();
      this.indexData();
      this.bindNavigation();
      this.bindDialog();
      this.bindReset();
      this.render();
      this.registerServiceWorker();
    } catch (error) {
      console.error(error);
      document.getElementById("app").innerHTML = `
        <div class="card empty-state">
          <h2>課表載入失敗</h2>
          <p>請確認 data/training.json 是否存在，並用 GitHub Pages / 本機伺服器開啟。</p>
        </div>`;
    }
  },

  indexData() {
    this.data.phases.forEach(phase => {
      this.phaseMap.set(phase.id, phase);
      phase.workouts.forEach(workout => {
        workout.phaseId = phase.id;
        this.workoutMap.set(workout.date, workout);
      });
    });
  },

  bindNavigation() {
    document.querySelectorAll(".nav-item[data-view]").forEach(button => {
      button.addEventListener("click", () => {
        this.view = button.dataset.view;
        document.querySelectorAll(".nav-item[data-view]").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        this.render();
      });
    });
  },

  bindDialog() {
    const dialog = document.getElementById("workoutDialog");
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  },

  bindReset() {
    document.getElementById("resetBtn").addEventListener("click", () => {
      const ok = confirm("要清除這台裝置上的所有訓練完成紀錄嗎？\n課表本身不會被刪除。");
      if (!ok) return;
      TokyoStorage.clear();
      this.render();
    });
  },

  render() {
    this.applyAccent();
    if (this.view === "calendar") this.renderCalendar();
    else this.renderToday();
  },

  applyAccent(phase = this.getCurrentPhase()) {
    const color = phase?.color || "#ff3f9f";
    document.documentElement.style.setProperty("--accent", color);
  },

  getCurrentPhase(today = new Date()) {
    const iso = TokyoCalendar.toISODate(today);
    return this.data.phases.find(phase => iso >= phase.startDate && iso <= phase.endDate) || null;
  },

  getPhaseWeek(phase, today = new Date()) {
    if (!phase) return null;
    const start = TokyoCalendar.parseISODate(phase.startDate);
    const diffMs = today.setHours(0,0,0,0) - start.setHours(0,0,0,0);
    const diffDays = Math.floor(diffMs / 86400000);
    return Math.min(phase.weeks, Math.max(1, Math.floor(diffDays / 7) + 1));
  },

  getCompletionStats(phase) {
    const total = phase.workouts.length;
    const completed = phase.workouts.filter(w => TokyoStorage.get(w.date)).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percent };
  },

  getTodayWorkout(today = new Date()) {
    return this.workoutMap.get(TokyoCalendar.toISODate(today)) || null;
  },

  getNextWorkout(today = new Date()) {
    const todayISO = TokyoCalendar.toISODate(today);
    const all = [...this.workoutMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    return all.find(w => w.date > todayISO) || null;
  },

  renderToday() {
    const app = document.getElementById("app");
    const today = new Date();
    const currentPhase = this.getCurrentPhase(today);
    const todayWorkout = this.getTodayWorkout(today);
    const nextWorkout = this.getNextWorkout(today);

    let heroHTML = "";

    if (currentPhase) {
      const week = this.getPhaseWeek(currentPhase, new Date());
      const stats = this.getCompletionStats(currentPhase);
      heroHTML = `
        <section class="card hero-card">
          <span class="phase-pill">${currentPhase.label}</span>
          <h2 class="hero-title">${currentPhase.name}</h2>
          <p class="hero-subtitle">Week ${week} / ${currentPhase.weeks}</p>

          <div class="progress-row">
            <div class="progress-track"><div class="progress-fill" style="width:${stats.percent}%"></div></div>
            <div class="progress-number">${stats.percent}%</div>
          </div>

          <div class="metrics">
            <div class="metric"><strong>${week}/${currentPhase.weeks}</strong><span>目前週次</span></div>
            <div class="metric"><strong>${stats.completed}/${stats.total}</strong><span>完成課次</span></div>
            <div class="metric"><strong>${currentPhase.weeklyRuns}</strong><span>每週跑步</span></div>
          </div>
        </section>`;
    } else {
      const firstPhase = this.data.phases[0];
      const raceDate = TokyoCalendar.parseISODate(this.data.raceDate);
      const phaseStart = TokyoCalendar.parseISODate(firstPhase.startDate);
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const daysToStart = Math.ceil((phaseStart - todayStart) / 86400000);
      const daysToRace = Math.ceil((raceDate - todayStart) / 86400000);

      heroHTML = `
        <section class="card hero-card">
          <span class="phase-pill">PRE-SEASON</span>
          <h2 class="hero-title">Tokyo 2027</h2>
          <p class="hero-subtitle">正式課表開始前，先維持規律與健康。</p>
          <div class="metrics">
            <div class="metric"><strong>${Math.max(daysToStart, 0)}</strong><span>距 Phase 1 天數</span></div>
            <div class="metric"><strong>${Math.max(daysToRace, 0)}</strong><span>距比賽天數</span></div>
            <div class="metric"><strong>3</strong><span>核心週跑次</span></div>
          </div>
        </section>`;
    }

    const todaySection = todayWorkout
      ? this.renderWorkoutSummary(todayWorkout, "TODAY")
      : `
        <div class="section-title"><h2>TODAY</h2><small>${TokyoCalendar.longDateLabel(TokyoCalendar.toISODate(today))}</small></div>
        <section class="card">
          <h3>Recovery / 自主安排</h3>
          <p class="notice">今天沒有正式跑課。可做輕鬆走路、伸展、核心、上肢或依身體狀況安排恢復。</p>
        </section>`;

    const nextSection = nextWorkout
      ? `
        <div class="section-title"><h2>NEXT</h2><small>下一堂</small></div>
        <section class="card next-card workout-card" data-open-workout="${nextWorkout.date}">
          <div>
            <div class="workout-type">${nextWorkout.type}</div>
            <h3>${TokyoCalendar.longDateLabel(nextWorkout.date)}</h3>
            <div class="workout-meta">${nextWorkout.title} · ${nextWorkout.distanceKm ? `${nextWorkout.distanceKm} KM` : nextWorkout.duration}</div>
          </div>
          <div class="arrow">→</div>
        </section>`
      : "";

    app.innerHTML = heroHTML + todaySection + nextSection;
    this.bindWorkoutOpeners();
  },

  renderWorkoutSummary(workout, sectionName) {
    const phase = this.phaseMap.get(workout.phaseId);
    const completion = TokyoStorage.get(workout.date);
    return `
      <div class="section-title"><h2>${sectionName}</h2><small>${TokyoCalendar.longDateLabel(workout.date)}</small></div>
      <section class="card workout-card" data-open-workout="${workout.date}" style="--accent:${phase.color}">
        <div class="workout-heading">
          <div>
            <div class="workout-type">${workout.type}</div>
            <h3>${workout.title}</h3>
          </div>
          ${completion ? `<span class="status-pill">✓ ${this.modeLabel(completion.mode)}</span>` : ""}
        </div>
        <div class="workout-distance">${workout.distanceKm ?? workout.duration ?? ""}${workout.distanceKm ? " <small>KM</small>" : ""}</div>
        <p class="workout-meta">${workout.summary}</p>
        <button class="primary-button" type="button">查看單日課表</button>
      </section>`;
  },

  renderCalendar() {
    const app = document.getElementById("app");
    const cells = TokyoCalendar.buildMonthGrid(this.calendarDate);
    const todayISO = TokyoCalendar.toISODate(new Date());

    app.innerHTML = `
      <section class="card">
        <div class="calendar-toolbar">
          <button class="icon-button" id="prevMonth" type="button">←</button>
          <h2>${TokyoCalendar.monthLabel(this.calendarDate)}</h2>
          <button class="icon-button" id="nextMonth" type="button">→</button>
        </div>

        <div class="weekdays">
          ${TokyoCalendar.WEEKDAY_LABELS.map(d => `<div>${d}</div>`).join("")}
        </div>

        <div class="calendar-grid">
          ${cells.map(cell => {
            const workout = this.workoutMap.get(cell.iso);
            const completion = TokyoStorage.get(cell.iso);
            const phase = workout ? this.phaseMap.get(workout.phaseId) : null;
            const classes = [
              "calendar-day",
              !cell.currentMonth ? "other-month" : "",
              cell.iso === todayISO ? "today" : "",
              workout ? "has-workout" : "",
              completion ? "done" : ""
            ].filter(Boolean).join(" ");

            return `
              <button class="${classes}" type="button"
                ${workout ? `data-open-workout="${cell.iso}"` : "disabled"}
                style="--day-color:${phase?.color || "#ffffff"}">
                <span class="day-number">${cell.date.getDate()}</span>
                ${workout ? `<span class="day-workout">${workout.shortLabel}<br>${workout.distanceKm ? `${workout.distanceKm}K` : ""}</span>` : ""}
                ${completion ? `<span class="day-check">✓ ${this.modeLabel(completion.mode)}</span>` : ""}
              </button>`;
          }).join("")}
        </div>

        <div class="phase-legend">
          ${this.data.phases.map(phase => `
            <div class="legend-item">
              <span class="legend-dot" style="background:${phase.color}"></span>
              <span>${phase.label} ${phase.name}</span>
            </div>`).join("")}
        </div>
      </section>`;

    document.getElementById("prevMonth").addEventListener("click", () => {
      this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() - 1, 1);
      this.renderCalendar();
    });
    document.getElementById("nextMonth").addEventListener("click", () => {
      this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + 1, 1);
      this.renderCalendar();
    });

    this.bindWorkoutOpeners();
  },

  bindWorkoutOpeners() {
    document.querySelectorAll("[data-open-workout]").forEach(element => {
      element.addEventListener("click", () => this.openWorkout(element.dataset.openWorkout));
    });
  },

  openWorkout(date) {
    const workout = this.workoutMap.get(date);
    if (!workout) return;

    this.activeWorkout = workout;
    this.activeMode = TokyoStorage.get(date)?.mode || "main";
    this.applyAccent(this.phaseMap.get(workout.phaseId));
    this.renderWorkoutDialog();
    document.getElementById("workoutDialog").showModal();
  },

  renderWorkoutDialog() {
    const workout = this.activeWorkout;
    const phase = this.phaseMap.get(workout.phaseId);
    const completion = TokyoStorage.get(workout.date);
    const plan = workout.plans[this.activeMode];

    const content = document.getElementById("workoutDialogContent");
    content.innerHTML = `
      <div class="dialog-inner" style="--accent:${phase.color}">
        <div class="dialog-head">
          <div>
            <span class="phase-pill">${phase.label}</span>
            <h2 style="margin-top:12px">${workout.title}</h2>
            <p class="workout-meta">${TokyoCalendar.longDateLabel(workout.date)} · ${workout.summary}</p>
          </div>
          <button class="dialog-close" id="closeDialog" type="button">×</button>
        </div>

        <div class="mode-tabs">
          ${["main","rain","fatigue"].map(mode => `
            <button class="mode-tab ${this.activeMode === mode ? "active" : ""}" data-mode="${mode}" type="button">
              ${this.modeLabel(mode)}
            </button>`).join("")}
        </div>

        <div class="plan-box">
          <h3>${plan.title}</h3>
          <ol class="plan-list">
            ${plan.steps.map(step => `<li>${step}</li>`).join("")}
          </ol>
          ${plan.note ? `<p class="plan-note">${plan.note}</p>` : ""}
        </div>

        <div class="completion-panel">
          <h3>完成方式</h3>
          <p class="notice">完成主課表或備用課表都可以記錄。若是疼痛、發燒或疑似受傷，不要硬做疲勞版，改以休息 / 就醫為優先。</p>
          <div class="completion-buttons">
            ${["main","rain","fatigue"].map(mode => `
              <button class="complete-choice ${completion?.mode === mode ? "selected" : ""}" data-complete-mode="${mode}" type="button">
                ${completion?.mode === mode ? "✓ " : ""}${this.modeLabel(mode)}
              </button>`).join("")}
          </div>
          ${completion ? `<button class="secondary-button" id="clearCompletion" type="button" style="margin-top:10px;width:100%">取消這天的完成紀錄</button>` : ""}
        </div>
      </div>`;

    document.getElementById("closeDialog").addEventListener("click", () => {
      document.getElementById("workoutDialog").close();
      this.render();
    });

    document.querySelectorAll("[data-mode]").forEach(button => {
      button.addEventListener("click", () => {
        this.activeMode = button.dataset.mode;
        this.renderWorkoutDialog();
      });
    });

    document.querySelectorAll("[data-complete-mode]").forEach(button => {
      button.addEventListener("click", () => {
        TokyoStorage.set(workout.date, button.dataset.completeMode);
        this.renderWorkoutDialog();
      });
    });

    document.getElementById("clearCompletion")?.addEventListener("click", () => {
      TokyoStorage.remove(workout.date);
      this.renderWorkoutDialog();
    });
  },

  modeLabel(mode) {
    return ({ main: "主課表", rain: "雨備", fatigue: "疲勞版" })[mode] || mode;
  },

  registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(error => {
        console.warn("Service Worker 註冊失敗，不影響一般使用。", error);
      });
    }
  }
};

window.addEventListener("DOMContentLoaded", () => App.init());
