/* =========================================================
   TOKYO 2027 - app.js (V1.2)
   ---------------------------------------------------------
   這支檔案是網站的「主控制器」。

   一般修改課表時，你幾乎不需要改這裡；
   課表內容請優先修改 data/training.json。

   V1.2 的訓練分類：
   - RUN      ：跑步主課
   - STRENGTH ：跑者專項肌力（臀腿 / 小腿 / 核心 / 單腳穩定）
   - GYM      ：一般健身房重訓（Upper / Lower / Full Body）
   - RECOVERY ：目前放在 GYM 課內作為收尾區塊

   主要功能：
   1) Today 首頁
   2) Phase / Week / 完成率
   3) Training Calendar
   4) 單日詳細課表
   5) MAIN / RAIN / FATIGUE 三種完成方式
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
      const response = await fetch("data/training.json", { cache: "no-store" });
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
          <p>請確認 data/training.json 存在，並使用 GitHub Pages / Live Server 開啟。</p>
        </div>`;
    }
  },

  indexData() {
    this.workoutMap.clear();
    this.phaseMap.clear();

    this.data.phases.forEach(phase => {
      this.phaseMap.set(phase.id, phase);
      phase.workouts.forEach(workout => {
        workout.phaseId = phase.id;

        // V1.2 目前採「一天一張正式課表卡」。
        // 若未來要同一天安排兩堂正式課，再把 Map 改成 Array 即可。
        if (this.workoutMap.has(workout.date)) {
          console.warn(`同一天有兩堂正式課：${workout.date}。目前只保留最後一堂。`);
        }
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
      if (event.target === dialog) {
        dialog.close();
        this.render();
      }
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
    const current = new Date(today);
    current.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((current - start) / 86400000);
    return Math.min(phase.weeks, Math.max(1, Math.floor(diffDays / 7) + 1));
  },

  // 計算某 Phase 的總完成率，以及 RUN / STRENGTH / GYM 各自完成率。
  getCompletionStats(phase) {
    const workouts = phase.workouts;

    const calc = category => {
      const list = workouts.filter(w => w.category === category);
      const completed = list.filter(w => TokyoStorage.get(w.date)).length;
      return {
        total: list.length,
        completed,
        percent: list.length ? Math.round((completed / list.length) * 100) : 0
      };
    };

    const completed = workouts.filter(w => TokyoStorage.get(w.date)).length;
    return {
      total: workouts.length,
      completed,
      percent: workouts.length ? Math.round((completed / workouts.length) * 100) : 0,
      run: calc("run"),
      strength: calc("strength"),
      gym: calc("gym")
    };
  },

  getAllProgramStats() {
    const workouts = this.data.phases.flatMap(p => p.workouts);
    const count = category => workouts.filter(w => w.category === category).length;
    return { run: count("run"), strength: count("strength"), gym: count("gym") };
  },

  getTodayWorkout(today = new Date()) {
    return this.workoutMap.get(TokyoCalendar.toISODate(today)) || null;
  },

  getNextWorkout(today = new Date()) {
    const todayISO = TokyoCalendar.toISODate(today);
    return [...this.workoutMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .find(w => w.date > todayISO) || null;
  },

  categoryLabel(category) {
    return ({
      run: "RUN",
      strength: "STRENGTH",
      gym: "GYM"
    })[category] || category.toUpperCase();
  },

  categoryDescription(category) {
    return ({
      run: "跑步主課",
      strength: "跑者專項肌力",
      gym: "一般健身房重訓"
    })[category] || "TRAINING";
  },

  renderToday() {
    const app = document.getElementById("app");
    const today = new Date();
    const currentPhase = this.getCurrentPhase(today);
    const todayWorkout = this.getTodayWorkout(today);
    const nextWorkout = this.getNextWorkout(today);

    let heroHTML = "";

    if (currentPhase) {
      const week = this.getPhaseWeek(currentPhase, today);
      const stats = this.getCompletionStats(currentPhase);

      heroHTML = `
        <section class="card hero-card" style="--accent:${currentPhase.color}">
          <span class="phase-pill">${currentPhase.label}</span>
          <h2 class="hero-title">${currentPhase.name}</h2>
          <p class="hero-subtitle">Week ${week} / ${currentPhase.weeks}</p>

          <div class="progress-row">
            <div class="progress-track"><div class="progress-fill" style="width:${stats.percent}%"></div></div>
            <div class="progress-number">${stats.percent}%</div>
          </div>

          <div class="metrics metrics-four">
            <div class="metric"><strong>${week}/${currentPhase.weeks}</strong><span>目前週次</span></div>
            <div class="metric"><strong>${stats.run.completed}/${stats.run.total}</strong><span>RUN</span></div>
            <div class="metric"><strong>${stats.strength.completed}/${stats.strength.total}</strong><span>STRENGTH</span></div>
            <div class="metric"><strong>${stats.gym.completed}/${stats.gym.total}</strong><span>GYM</span></div>
          </div>

          <div class="progress-breakdown">
            ${this.progressMini("RUNNING", stats.run)}
            ${this.progressMini("STRENGTH", stats.strength)}
            ${this.progressMini("GYM", stats.gym)}
          </div>
        </section>`;
    } else {
      const firstPhase = this.data.phases[0];
      const raceDate = TokyoCalendar.parseISODate(this.data.raceDate);
      const phaseStart = TokyoCalendar.parseISODate(firstPhase.startDate);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const daysToStart = Math.ceil((phaseStart - todayStart) / 86400000);
      const daysToRace = Math.ceil((raceDate - todayStart) / 86400000);
      const totals = this.getAllProgramStats();

      heroHTML = `
        <section class="card hero-card">
          <span class="phase-pill">PRE-SEASON</span>
          <h2 class="hero-title">Tokyo 2027</h2>
          <p class="hero-subtitle">正式課表開始前，先以自主訓練、生活行程與健康為主。</p>
          <div class="metrics">
            <div class="metric"><strong>${Math.max(daysToStart, 0)}</strong><span>距 Phase 1 天數</span></div>
            <div class="metric"><strong>${Math.max(daysToRace, 0)}</strong><span>距比賽天數</span></div>
            <div class="metric"><strong>3</strong><span>核心週跑次</span></div>
          </div>

          <div class="program-preview">
            <div class="preview-title">正式課表已排入</div>
            <div class="preview-grid">
              <div><strong>${totals.run}</strong><span>RUN</span></div>
              <div><strong>${totals.strength}</strong><span>STRENGTH</span></div>
              <div><strong>${totals.gym}</strong><span>GYM</span></div>
            </div>
          </div>
        </section>`;
    }

    const todaySection = todayWorkout
      ? this.renderWorkoutSummary(todayWorkout, "TODAY")
      : `
        <div class="section-title"><h2>TODAY</h2><small>${TokyoCalendar.longDateLabel(TokyoCalendar.toISODate(today))}</small></div>
        <section class="card">
          <span class="category-badge neutral">RECOVERY / FREE</span>
          <h3 style="margin-top:12px">自主安排</h3>
          <p class="notice">今天沒有正式課表。可依身體狀況安排輕鬆走路、伸展、Mobility、上肢或完全休息。</p>
        </section>`;

    const nextSection = nextWorkout ? `
      <div class="section-title"><h2>NEXT</h2><small>下一堂</small></div>
      <section class="card next-card workout-card" data-open-workout="${nextWorkout.date}" style="--accent:${this.phaseMap.get(nextWorkout.phaseId).color}">
        <div>
          <span class="category-badge">${this.categoryLabel(nextWorkout.category)}</span>
          <h3 style="margin-top:10px">${TokyoCalendar.longDateLabel(nextWorkout.date)} · ${nextWorkout.title}</h3>
          <div class="workout-meta">${nextWorkout.summary}</div>
        </div>
        <div class="arrow">→</div>
      </section>` : "";

    app.innerHTML = heroHTML + todaySection + nextSection;
    this.bindWorkoutOpeners();
  },

  progressMini(label, stats) {
    return `
      <div class="progress-mini">
        <div><span>${label}</span><strong>${stats.completed}/${stats.total} · ${stats.percent}%</strong></div>
        <div class="progress-track"><div class="progress-fill" style="width:${stats.percent}%"></div></div>
      </div>`;
  },

  renderWorkoutSummary(workout, sectionName) {
    const phase = this.phaseMap.get(workout.phaseId);
    const completion = TokyoStorage.get(workout.date);
    return `
      <div class="section-title"><h2>${sectionName}</h2><small>${TokyoCalendar.longDateLabel(workout.date)}</small></div>
      <section class="card workout-card" data-open-workout="${workout.date}" style="--accent:${phase.color}">
        <div class="workout-heading">
          <div>
            <span class="category-badge">${this.categoryLabel(workout.category)}</span>
            <div class="workout-type" style="margin-top:10px">${this.categoryDescription(workout.category)}</div>
            <h3>${workout.title}</h3>
          </div>
          ${completion ? `<span class="status-pill">✓ ${this.modeLabel(completion.mode)}</span>` : ""}
        </div>
        <div class="workout-distance">${workout.distanceKm ?? workout.duration ?? ""}${workout.distanceKm ? " <small>KM</small>" : ""}</div>
        <p class="workout-meta">${workout.summary}</p>
        ${workout.recovery ? `<div class="recovery-preview">+ RECOVERY · Mobility / 伸展收尾</div>` : ""}
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

        <div class="training-type-legend">
          <span>RUN 跑步</span><span>STR 跑者肌力</span><span>GYM 健身＋Recovery</span>
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

            const detail = workout?.distanceKm ? `${workout.distanceKm}K` : (workout?.duration || "").replace(" MIN", "m");
            return `
              <button class="${classes}" type="button"
                ${workout ? `data-open-workout="${cell.iso}"` : "disabled"}
                style="--day-color:${phase?.color || "#ffffff"}">
                <span class="day-number">${cell.date.getDate()}</span>
                ${workout ? `<span class="day-category">${this.categoryLabel(workout.category)}</span><span class="day-workout">${workout.shortLabel}<br>${detail}</span>` : ""}
                ${completion ? `<span class="day-check">✓</span>` : ""}
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

    const recoveryHTML = workout.recovery ? `
      <div class="recovery-box">
        <div class="recovery-label">RECOVERY</div>
        <h3>${workout.recovery.title.replace("RECOVERY｜", "")}</h3>
        <ul class="plan-list">
          ${workout.recovery.steps.map(step => `<li>${step}</li>`).join("")}
        </ul>
        ${workout.recovery.note ? `<p class="plan-note">${workout.recovery.note}</p>` : ""}
      </div>` : "";

    const content = document.getElementById("workoutDialogContent");
    content.innerHTML = `
      <div class="dialog-inner" style="--accent:${phase.color}">
        <div class="dialog-head">
          <div>
            <span class="phase-pill">${phase.label}</span>
            <div style="margin-top:12px"><span class="category-badge">${this.categoryLabel(workout.category)}</span></div>
            <h2 style="margin-top:12px">${workout.title}</h2>
            <p class="workout-meta">${TokyoCalendar.longDateLabel(workout.date)} · ${workout.summary}</p>
          </div>
          <button class="dialog-close" id="closeDialog" type="button">×</button>
        </div>

        <div class="mode-tabs">
          ${["main", "rain", "fatigue"].map(mode => `
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

        ${recoveryHTML}

        <div class="completion-panel">
          <h3>完成方式</h3>
          <p class="notice">主課表、雨備或疲勞版都可以記錄完成。若是疼痛、發燒或疑似受傷，休息優先，不用硬補。</p>
          <div class="completion-buttons">
            ${["main", "rain", "fatigue"].map(mode => `
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
