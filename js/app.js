/* =========================================================
   TOKYO 2027 - app.js (V1.3.5)
   ---------------------------------------------------------
   這支檔案是網站的「主控制器」。

   一般修改「課表內容」時，不需要改這裡；
   請優先修改 data/training.json。

   V1.3.5 新增：
   1) Today 身體狀態：READY / TIRED / SORE
   2) 依狀態推薦 MAIN / FATIGUE / RECOVERY
   3) 完成後紀錄 RPE 1~10
   4) 腿部狀態 GOOD / HEAVY / SORE
   5) 近一週 / 近一月訓練統計
   6) Tokyo Journey：完成正式訓練就往東京前進
   7) 9:16 社群分享卡（可分享 / 下載 PNG）

   目前仍使用 localStorage，沒有跨裝置同步。
   ========================================================= */

const App = {
  data: null,
  workoutMap: new Map(),
  phaseMap: new Map(),
  view: "today",
  calendarDate: new Date(),
  activeWorkout: null,
  activeMode: "main",
  feedbackDraft: { rpe: 5, legsStatus: null },
  statsRange: "week",
  shareBlob: null,
  shareFilename: "tokyo-2027-training.png",

  async init() {
    try {
      const response = await fetch("data/training.json", { cache: "no-store" });
      if (!response.ok) throw new Error("training.json 載入失敗");

      this.data = await response.json();
      this.indexData();
      this.bindNavigation();
      this.bindDialog();
      this.bindShareDialog();
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

  bindShareDialog() {
    const dialog = document.getElementById("shareDialog");
    const closeButton = document.getElementById("closeShareDialog");
    const nativeShareButton = document.getElementById("nativeShareBtn");
    const downloadButton = document.getElementById("downloadShareBtn");

    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });

    downloadButton.addEventListener("click", () => this.downloadShareCard());
    nativeShareButton.addEventListener("click", () => this.shareCard());
  },

  bindReset() {
    document.getElementById("resetBtn").addEventListener("click", () => {
      const ok = confirm("要清除這台裝置上的所有訓練紀錄嗎？\n包含完成、READY/TIRED/SORE、RPE 與腿部狀態；課表本身不會被刪除。");
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

  isCompleted(date) {
    return TokyoStorage.isCompleted(date);
  },

  getCompletionStats(phase) {
    const workouts = phase.workouts;

    const calc = category => {
      const list = workouts.filter(w => category === "run" ? ["run", "class"].includes(w.category) : w.category === category);
      const completed = list.filter(w => this.isCompleted(w.date)).length;
      return {
        total: list.length,
        completed,
        percent: list.length ? Math.round((completed / list.length) * 100) : 0
      };
    };

    const tracked = workouts.filter(w => w.category !== "recovery");
    const completed = tracked.filter(w => this.isCompleted(w.date)).length;

    return {
      total: tracked.length,
      completed,
      percent: tracked.length ? Math.round((completed / tracked.length) * 100) : 0,
      run: calc("run"),
      strength: calc("strength"),
      gym: calc("gym")
    };
  },

  getAllProgramStats() {
    const workouts = this.getAllWorkouts();
    const count = category => workouts.filter(w => w.category === category).length;
    return {
      run: count("run") + count("class"),
      class: count("class"),
      strength: count("strength"),
      gym: count("gym"),
      recovery: count("recovery")
    };
  },

  getAllWorkouts() {
    return this.data.phases.flatMap(phase => phase.workouts);
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
      class: "CLASS",
      strength: "STRENGTH",
      gym: "GYM",
      recovery: "RECOVERY"
    })[category] || category.toUpperCase();
  },

  categoryDescription(category) {
    return ({
      run: "跑步主課",
      class: "跑班 / 教練課",
      strength: "跑者專項肌力",
      gym: "一般健身房重訓",
      recovery: "恢復 / Mobility"
    })[category] || "TRAINING";
  },

  /* ---------------------------------------------------------
     TODAY
     --------------------------------------------------------- */
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

    const statusSection = this.renderStatusCheckIn(today, todayWorkout);

    const todaySection = todayWorkout
      ? this.renderWorkoutSummary(todayWorkout, "TODAY")
      : `
        <div class="section-title"><h2>TODAY</h2><small>${TokyoCalendar.longDateLabel(TokyoCalendar.toISODate(today))}</small></div>
        <section class="card">
          <span class="category-badge neutral">RECOVERY / FREE</span>
          <h3 style="margin-top:12px">自主安排</h3>
          <p class="notice">今天沒有正式課表。可依身體狀況安排輕鬆走路、伸展、Mobility、上肢或完全休息。</p>
        </section>`;

    const recordSection = this.renderTrainingRecord(today, currentPhase);

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

    app.innerHTML = heroHTML + statusSection + todaySection + recordSection + nextSection;
    this.bindTodayInteractions(today, todayWorkout);
    this.bindWorkoutOpeners();
  },

  renderStatusCheckIn(today, workout) {
    const iso = TokyoCalendar.toISODate(today);
    const record = TokyoStorage.get(iso) || {};
    const selected = record.preStatus || null;
    const recommendation = this.getStatusRecommendation(selected, workout);

    return `
      <div class="section-title"><h2>HOW ARE YOU TODAY?</h2><small>訓練前狀態</small></div>
      <section class="card checkin-card">
        <div class="status-options" role="group" aria-label="今日身體狀態">
          ${[
            ["ready", "READY", "狀態正常"],
            ["tired", "TIRED", "疲勞偏高"],
            ["sore", "SORE", "痠痛 / 不適"]
          ].map(([value, label, hint]) => `
            <button class="status-choice ${selected === value ? "selected" : ""}" data-pre-status="${value}" type="button">
              <strong>${label}</strong><span>${hint}</span>
            </button>`).join("")}
        </div>
        <div class="status-recommendation ${selected ? "visible" : ""}">
          ${selected ? `
            <span class="recommendation-kicker">TODAY'S RECOMMENDATION</span>
            <strong>${recommendation.title}</strong>
            <p>${recommendation.text}</p>` : `
            <p>先選今天的狀態，網站會替你推薦主課表、疲勞版或恢復方向。</p>`}
        </div>
      </section>`;
  },

  getStatusRecommendation(status, workout) {
    if (!status) return { mode: "main", title: "先選狀態", text: "" };
    if (status === "ready") {
      return {
        mode: "main",
        title: workout ? "MAIN SESSION" : "NORMAL DAY",
        text: workout ? "狀態正常，優先照原定主課表執行。" : "今天沒有正式課表，維持原本生活與恢復節奏即可。"
      };
    }
    if (status === "tired") {
      return {
        mode: "fatigue",
        title: workout ? "FATIGUE VERSION" : "RECOVERY FIRST",
        text: workout ? "今天疲勞偏高，建議使用疲勞版；保留刺激，但不要硬撐原強度。" : "以散步、Mobility、早點休息為主。"
      };
    }
    return {
      mode: "fatigue",
      title: "RECOVERY RECOMMENDED",
      text: "若只是一般肌肉痠可降低負荷；若是局部疼痛、越動越痛、發燒或明顯不適，今天停止訓練並優先恢復。"
    };
  },

  bindTodayInteractions(today, todayWorkout) {
    const iso = TokyoCalendar.toISODate(today);

    document.querySelectorAll("[data-pre-status]").forEach(button => {
      button.addEventListener("click", () => {
        TokyoStorage.setPreStatus(iso, button.dataset.preStatus);
        this.renderToday();
      });
    });

    document.querySelectorAll("[data-stats-range]").forEach(button => {
      button.addEventListener("click", () => {
        this.statsRange = button.dataset.statsRange;
        this.renderToday();
      });
    });

    document.getElementById("shareRecordBtn")?.addEventListener("click", () => {
      this.openShareCard(today);
    });

    // 若今天選了狀態，點課表時 openWorkout() 會自動套用推薦模式。
    if (!todayWorkout) return;
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
    const record = TokyoStorage.get(workout.date) || {};
    const completed = this.isCompleted(workout.date);
    return `
      <div class="section-title"><h2>${sectionName}</h2><small>${TokyoCalendar.longDateLabel(workout.date)}</small></div>
      <section class="card workout-card" data-open-workout="${workout.date}" style="--accent:${phase.color}">
        <div class="workout-heading">
          <div>
            <span class="category-badge">${this.categoryLabel(workout.category)}</span>
            <div class="workout-type" style="margin-top:10px">${this.categoryDescription(workout.category)}</div>
            <h3>${workout.title}</h3>
          </div>
          ${completed ? `<span class="status-pill">✓ ${this.modeLabel(record.mode)}</span>` : ""}
        </div>
        <div class="workout-distance">${workout.distanceKm ?? workout.duration ?? ""}${workout.distanceKm ? " <small>KM</small>" : ""}</div>
        <p class="workout-meta">${workout.summary}</p>
        ${completed && record.rpe ? `<div class="session-mini-feedback"><span>RPE ${record.rpe}</span><span>LEGS ${String(record.legsStatus || "-").toUpperCase()}</span></div>` : ""}
        ${workout.recovery ? `<div class="recovery-preview">+ RECOVERY · Mobility / 伸展收尾</div>` : ""}
        <button class="primary-button" type="button">查看單日課表</button>
      </section>`;
  },

  /* ---------------------------------------------------------
     週 / 月統計 + TOKYO JOURNEY
     --------------------------------------------------------- */
  getPeriodBounds(referenceDate, range = "week") {
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    if (range === "month") {
      return {
        start: new Date(ref.getFullYear(), ref.getMonth(), 1),
        end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0),
        label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(ref).toUpperCase()
      };
    }

    const mondayOffset = (ref.getDay() + 6) % 7;
    const start = new Date(ref);
    start.setDate(ref.getDate() - mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const short = date => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date).toUpperCase();
    return { start, end, label: `${short(start)} — ${short(end)}` };
  },

  getPeriodStats(referenceDate, range = "week") {
    const bounds = this.getPeriodBounds(referenceDate, range);
    const startISO = TokyoCalendar.toISODate(bounds.start);
    const endISO = TokyoCalendar.toISODate(bounds.end);
    const workouts = this.getAllWorkouts().filter(w => w.date >= startISO && w.date <= endISO);

    const categoryList = key => workouts.filter(w => {
      if (key === "run") return ["run", "class"].includes(w.category);
      return w.category === key;
    });

    const makeStat = key => {
      const list = categoryList(key);
      const completed = list.filter(w => this.isCompleted(w.date)).length;
      return {
        total: list.length,
        completed,
        percent: list.length ? Math.round((completed / list.length) * 100) : 0
      };
    };

    const tracked = workouts.filter(w => w.category !== "recovery");
    const completedTracked = tracked.filter(w => this.isCompleted(w.date));
    const records = completedTracked.map(w => TokyoStorage.get(w.date)).filter(Boolean);
    const rpes = records.map(record => Number(record.rpe)).filter(value => Number.isFinite(value) && value >= 1 && value <= 10);
    const avgRpe = rpes.length ? (rpes.reduce((sum, value) => sum + value, 0) / rpes.length).toFixed(1) : "—";

    const distanceKm = completedTracked.reduce((sum, workout) => sum + (Number(workout.distanceKm) || 0), 0);
    const legs = { good: 0, heavy: 0, sore: 0 };
    records.forEach(record => {
      const key = String(record.legsStatus || "").toLowerCase();
      if (key in legs) legs[key] += 1;
    });

    return {
      ...bounds,
      workouts,
      trackedTotal: tracked.length,
      trackedCompleted: completedTracked.length,
      overallPercent: tracked.length ? Math.round((completedTracked.length / tracked.length) * 100) : 0,
      run: makeStat("run"),
      strength: makeStat("strength"),
      gym: makeStat("gym"),
      recovery: makeStat("recovery"),
      avgRpe,
      distanceKm,
      legs
    };
  },

  getJourneyStats() {
    const formal = this.getAllWorkouts().filter(workout => workout.category !== "recovery");
    const completed = formal.filter(workout => this.isCompleted(workout.date)).length;
    return {
      total: formal.length,
      completed,
      percent: formal.length ? Math.round((completed / formal.length) * 100) : 0
    };
  },

  renderTrainingRecord(today, currentPhase) {
    const stats = this.getPeriodStats(today, this.statsRange);
    const journey = this.getJourneyStats();
    const phaseColor = currentPhase?.color || "#ff3f9f";

    const statRow = (icon, label, item) => `
      <div class="record-row">
        <div class="record-label"><span class="record-icon" aria-hidden="true">${icon}</span><span>${label}</span></div>
        <div class="record-bar"><div style="width:${item.percent}%"></div></div>
        <strong>${item.percent}%</strong>
      </div>`;

    return `
      <div class="section-title"><h2>TRAINING RECORD</h2><small>互動記錄</small></div>
      <section class="card record-card" style="--accent:${phaseColor}">
        <div class="range-tabs" role="group" aria-label="統計期間">
          <button class="range-tab ${this.statsRange === "week" ? "active" : ""}" data-stats-range="week" type="button">THIS WEEK</button>
          <button class="range-tab ${this.statsRange === "month" ? "active" : ""}" data-stats-range="month" type="button">THIS MONTH</button>
        </div>

        <div class="record-head">
          <div><span>${stats.label}</span><strong>${stats.overallPercent}%</strong></div>
          <div class="record-meta"><span>${stats.trackedCompleted}/${stats.trackedTotal} SESSIONS</span><span>${stats.distanceKm.toFixed(1)} KM</span><span>AVG RPE ${stats.avgRpe}</span></div>
        </div>

        <div class="record-list">
          ${statRow("↗", "RUN", stats.run)}
          ${statRow("◇", "STRENGTH", stats.strength)}
          ${statRow("▣", "GYM", stats.gym)}
          ${statRow("○", "RECOVERY", stats.recovery)}
        </div>

        <div class="journey-card">
          <div class="journey-head"><span>TOKYO JOURNEY</span><strong>${journey.percent}%</strong></div>
          <div class="journey-line" aria-label="Tokyo Journey ${journey.percent}%">
            <span class="journey-start">TAOYUAN</span>
            <div class="journey-track"><div class="journey-progress" style="width:${journey.percent}%"></div><span class="journey-plane" style="left:${Math.min(Math.max(journey.percent, 2), 96)}%">✈</span></div>
            <span class="journey-end">TOKYO</span>
          </div>
          <p>${journey.completed} / ${journey.total} formal sessions · RECOVERY 記錄但不灌高 Journey</p>
        </div>

        <button id="shareRecordBtn" class="secondary-button share-record-button" type="button">產生 ${this.statsRange === "week" ? "本週" : "本月"}分享卡</button>
      </section>`;
  },

  /* ---------------------------------------------------------
     CALENDAR
     --------------------------------------------------------- */
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
          <span>RUN 自主跑</span><span>CLASS 跑班</span><span>STR 跑者肌力</span><span>GYM 健身</span><span>REC 恢復</span>
        </div>

        <div class="weekdays">
          ${TokyoCalendar.WEEKDAY_LABELS.map(day => `<div>${day}</div>`).join("")}
        </div>

        <div class="calendar-grid">
          ${cells.map(cell => {
            const workout = this.workoutMap.get(cell.iso);
            const completed = this.isCompleted(cell.iso);
            const phase = workout ? this.phaseMap.get(workout.phaseId) : null;
            const classes = [
              "calendar-day",
              !cell.currentMonth ? "other-month" : "",
              cell.iso === todayISO ? "today" : "",
              workout ? "has-workout" : "",
              completed ? "done" : ""
            ].filter(Boolean).join(" ");

            const detail = workout?.distanceKm ? `${workout.distanceKm}K` : (workout?.duration || "").replace(" MIN", "m");
            return `
              <button class="${classes}" type="button"
                ${workout ? `data-open-workout="${cell.iso}"` : "disabled"}
                style="--day-color:${phase?.color || "#ffffff"}">
                <span class="day-number">${cell.date.getDate()}</span>
                ${workout ? `<span class="day-category">${this.categoryLabel(workout.category)}</span><span class="day-workout">${workout.shortLabel}<br>${detail}</span>` : ""}
                ${completed ? `<span class="day-check">✓</span>` : ""}
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

  /* ---------------------------------------------------------
     單日課表 Dialog + RPE / LEGS
     --------------------------------------------------------- */
  openWorkout(date) {
    const workout = this.workoutMap.get(date);
    if (!workout) return;

    this.activeWorkout = workout;
    const record = TokyoStorage.get(date) || {};
    const recommendation = this.getStatusRecommendation(record.preStatus, workout);
    this.activeMode = record.mode || recommendation.mode || "main";
    if (!workout.plans[this.activeMode]) this.activeMode = "main";

    this.feedbackDraft = {
      rpe: Number(record.rpe) || 5,
      legsStatus: record.legsStatus || null
    };

    this.applyAccent(this.phaseMap.get(workout.phaseId));
    this.renderWorkoutDialog();
    document.getElementById("workoutDialog").showModal();
  },

  renderWorkoutDialog() {
    const workout = this.activeWorkout;
    const phase = this.phaseMap.get(workout.phaseId);
    const record = TokyoStorage.get(workout.date) || {};
    const completed = this.isCompleted(workout.date);
    const plan = workout.plans[this.activeMode];
    const recommendation = this.getStatusRecommendation(record.preStatus, workout);

    const recoveryHTML = workout.recovery ? `
      <div class="recovery-box">
        <div class="recovery-label">RECOVERY</div>
        <h3>${workout.recovery.title.replace("RECOVERY｜", "")}</h3>
        <ul class="plan-list">
          ${workout.recovery.steps.map(step => `<li>${step}</li>`).join("")}
        </ul>
        ${workout.recovery.note ? `<p class="plan-note">${workout.recovery.note}</p>` : ""}
      </div>` : "";

    const preStatusHTML = record.preStatus ? `
      <div class="dialog-status-note">
        <span>${record.preStatus.toUpperCase()}</span>
        <div><strong>${recommendation.title}</strong><p>${recommendation.text}</p></div>
      </div>` : "";

    const feedbackHTML = completed ? `
      <div class="feedback-panel">
        <div class="feedback-head">
          <div><span class="recommendation-kicker">SESSION FEEDBACK</span><h3>完成後感受</h3></div>
          ${record.rpe && record.legsStatus ? `<span class="feedback-saved">SAVED</span>` : ""}
        </div>

        <label class="rpe-label" for="rpeSlider">
          <span>EASY</span><strong>RPE <output id="rpeValue">${this.feedbackDraft.rpe}</output></strong><span>MAX</span>
        </label>
        <input id="rpeSlider" class="rpe-slider" type="range" min="1" max="10" step="1" value="${this.feedbackDraft.rpe}" />
        <div class="rpe-scale" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<span>${i + 1}</span>`).join("")}</div>

        <div class="legs-question">今天腿的感覺？</div>
        <div class="legs-options">
          ${["good", "heavy", "sore"].map(value => `
            <button class="legs-choice ${String(this.feedbackDraft.legsStatus || "").toLowerCase() === value ? "selected" : ""}" data-legs-status="${value}" type="button">${value.toUpperCase()}</button>`).join("")}
        </div>
        <button id="saveFeedback" class="primary-button" type="button" ${this.feedbackDraft.legsStatus ? "" : "disabled"}>SAVE SESSION FEEDBACK</button>
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

        ${preStatusHTML}

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
          <p class="notice">主課表、雨備或疲勞版都可以記錄完成。若是局部疼痛、發燒或疑似受傷，休息優先，不需要硬補。</p>
          <div class="completion-buttons">
            ${["main", "rain", "fatigue"].map(mode => `
              <button class="complete-choice ${completed && record.mode === mode ? "selected" : ""}" data-complete-mode="${mode}" type="button">
                ${completed && record.mode === mode ? "✓ " : ""}${this.modeLabel(mode)}
              </button>`).join("")}
          </div>
          ${completed ? `<button class="secondary-button" id="clearCompletion" type="button" style="margin-top:10px;width:100%">取消這天的完成紀錄</button>` : ""}
        </div>

        ${feedbackHTML}
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
        this.activeMode = button.dataset.completeMode;
        this.feedbackDraft = { rpe: 5, legsStatus: null };
        this.renderWorkoutDialog();
      });
    });

    document.getElementById("clearCompletion")?.addEventListener("click", () => {
      TokyoStorage.removeCompletion(workout.date);
      this.feedbackDraft = { rpe: 5, legsStatus: null };
      this.renderWorkoutDialog();
    });

    const slider = document.getElementById("rpeSlider");
    const output = document.getElementById("rpeValue");
    slider?.addEventListener("input", () => {
      this.feedbackDraft.rpe = Number(slider.value);
      output.value = slider.value;
      output.textContent = slider.value;
    });

    document.querySelectorAll("[data-legs-status]").forEach(button => {
      button.addEventListener("click", () => {
        this.feedbackDraft.legsStatus = button.dataset.legsStatus;
        document.querySelectorAll("[data-legs-status]").forEach(item => item.classList.toggle("selected", item === button));
        const saveButton = document.getElementById("saveFeedback");
        if (saveButton) saveButton.disabled = false;
      });
    });

    document.getElementById("saveFeedback")?.addEventListener("click", () => {
      if (!this.feedbackDraft.legsStatus) return;
      TokyoStorage.setFeedback(workout.date, this.feedbackDraft.rpe, this.feedbackDraft.legsStatus);
      this.renderWorkoutDialog();
    });
  },

  modeLabel(mode) {
    return ({ main: "主課表", rain: "雨備", fatigue: "疲勞版" })[mode] || mode || "完成";
  },

  /* ---------------------------------------------------------
     SHARE CARD - 9:16 PNG
     --------------------------------------------------------- */
  async openShareCard(referenceDate) {
    const stats = this.getPeriodStats(referenceDate, this.statsRange);
    const journey = this.getJourneyStats();
    const currentPhase = this.getCurrentPhase(referenceDate) || this.data.phases.find(phase => {
      const iso = TokyoCalendar.toISODate(referenceDate);
      return iso <= phase.endDate;
    }) || this.data.phases[this.data.phases.length - 1];

    const canvas = this.buildShareCanvas(stats, journey, currentPhase);
    const preview = document.getElementById("sharePreview");
    preview.src = canvas.toDataURL("image/png");

    this.shareFilename = `tokyo-2027-${this.statsRange}-${TokyoCalendar.toISODate(referenceDate)}.png`;
    this.shareBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.95));

    const nativeShareButton = document.getElementById("nativeShareBtn");
    const canShareFile = Boolean(this.shareBlob && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([this.shareBlob], this.shareFilename, { type: "image/png" })] }));
    nativeShareButton.textContent = canShareFile ? "分享 / 儲存圖片" : "下載 PNG";

    document.getElementById("shareDialog").showModal();
  },

  buildShareCanvas(stats, journey, phase) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    const accent = phase?.color || "#ff3f9f";

    ctx.fillStyle = "#080a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 上方微弱的 Phase 色帶，不使用外部圖片，分享卡離線也能生成。
    const gradient = ctx.createLinearGradient(0, 0, 1080, 620);
    gradient.addColorStop(0, this.hexToRgba(accent, 0.26));
    gradient.addColorStop(1, "rgba(8,10,15,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 700);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 38px Arial, sans-serif";
    ctx.fillText("TOKYO 2027", 90, 120);
    ctx.fillStyle = "rgba(255,255,255,.58)";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText("ROAD TO TOKYO · TRAINING RECORD", 90, 160);

    ctx.fillStyle = accent;
    this.roundRect(ctx, 90, 220, 214, 54, 27, true);
    ctx.fillStyle = "#081015";
    ctx.font = "800 22px Arial, sans-serif";
    ctx.fillText(phase?.label || "TOKYO 2027", 116, 255);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 68px Arial, sans-serif";
    ctx.fillText(this.statsRange === "week" ? "THIS WEEK" : "THIS MONTH", 90, 370);
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.font = "600 28px Arial, sans-serif";
    ctx.fillText(stats.label, 90, 420);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 112px Arial, sans-serif";
    ctx.fillText(`${stats.overallPercent}%`, 90, 575);
    ctx.fillStyle = "rgba(255,255,255,.60)";
    ctx.font = "600 24px Arial, sans-serif";
    ctx.fillText("TRAINING COMPLETION", 94, 615);

    const categoryRows = [
      ["↗", "RUN", stats.run],
      ["◇", "STRENGTH", stats.strength],
      ["▣", "GYM", stats.gym],
      ["○", "RECOVERY", stats.recovery]
    ];

    let y = 740;
    categoryRows.forEach(([symbol, label, item]) => {
      this.drawShareRecordIcon(ctx, symbol, 108, y - 10);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 28px Arial, sans-serif";
      ctx.fillText(label, 160, y);
      ctx.textAlign = "right";
      ctx.fillText(`${item.percent}%`, 990, y);
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,255,255,.12)";
      this.roundRect(ctx, 160, y + 25, 830, 16, 8, true);
      ctx.fillStyle = accent;
      this.roundRect(ctx, 160, y + 25, Math.max(0, 830 * item.percent / 100), 16, 8, true);
      y += 145;
    });

    // Summary metrics
    ctx.fillStyle = "rgba(255,255,255,.055)";
    this.roundRect(ctx, 90, 1280, 900, 180, 28, true);
    const metrics = [
      [`${stats.distanceKm.toFixed(1)} KM`, "DISTANCE"],
      [`${stats.trackedCompleted}/${stats.trackedTotal}`, "SESSIONS"],
      [`${stats.avgRpe}`, "AVG RPE"]
    ];
    metrics.forEach((metric, index) => {
      const x = 150 + index * 300;
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 38px Arial, sans-serif";
      ctx.fillText(metric[0], x, 1355);
      ctx.fillStyle = "rgba(255,255,255,.50)";
      ctx.font = "600 18px Arial, sans-serif";
      ctx.fillText(metric[1], x, 1395);
    });

    // Journey
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 26px Arial, sans-serif";
    ctx.fillText("TOKYO JOURNEY", 90, 1550);
    ctx.textAlign = "right";
    ctx.fillText(`${journey.percent}%`, 990, 1550);
    ctx.textAlign = "left";

    const lineX = 170;
    const lineW = 720;
    const lineY = 1640;
    ctx.fillStyle = "rgba(255,255,255,.13)";
    this.roundRect(ctx, lineX, lineY, lineW, 12, 6, true);
    ctx.fillStyle = accent;
    this.roundRect(ctx, lineX, lineY, lineW * journey.percent / 100, 12, 6, true);

    const planeX = lineX + lineW * journey.percent / 100;
    this.drawPlaneIcon(ctx, Math.min(Math.max(planeX, lineX + 10), lineX + lineW - 10), lineY + 6, accent);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "600 18px Arial, sans-serif";
    ctx.fillText("TAOYUAN", 90, 1715);
    ctx.textAlign = "right";
    ctx.fillText("TOKYO", 990, 1715);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText(`${journey.completed} / ${journey.total} FORMAL SESSIONS`, 90, 1800);
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.font = "500 18px Arial, sans-serif";
    ctx.fillText("42.195K IS BUILT ONE SESSION AT A TIME.", 90, 1845);

    return canvas;
  },

  roundRect(ctx, x, y, width, height, radius, fill = false) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
  },

  hexToRgba(hex, alpha) {
    const safe = hex.replace("#", "");
    const value = safe.length === 3 ? safe.split("").map(char => char + char).join("") : safe;
    const num = parseInt(value, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  },

  drawShareRecordIcon(ctx, symbol, x, y) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 2;
    this.roundRect(ctx, x - 15, y - 15, 30, 30, 9);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, x, y + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  },

  drawCategoryIcon(ctx, type, x, y) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (type === "strength") {
      ctx.beginPath();
      ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y);
      ctx.moveTo(x - 26, y - 13); ctx.lineTo(x - 26, y + 13);
      ctx.moveTo(x - 18, y - 18); ctx.lineTo(x - 18, y + 18);
      ctx.moveTo(x + 18, y - 18); ctx.lineTo(x + 18, y + 18);
      ctx.moveTo(x + 26, y - 13); ctx.lineTo(x + 26, y + 13);
      ctx.stroke();
    } else if (type === "gym") {
      ctx.strokeRect(x - 24, y - 24, 48, 48);
      ctx.beginPath(); ctx.moveTo(x - 14, y + 10); ctx.lineTo(x + 14, y - 10); ctx.stroke();
    } else if (type === "recovery") {
      ctx.beginPath(); ctx.arc(x, y, 23, 0.3, Math.PI * 1.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 18, y - 18); ctx.lineTo(x + 28, y - 18); ctx.lineTo(x + 26, y - 8); ctx.stroke();
    } else {
      // 簡化跑者 icon
      ctx.beginPath(); ctx.arc(x - 2, y - 22, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 13); ctx.lineTo(x - 8, y + 4);
      ctx.lineTo(x + 10, y + 15);
      ctx.moveTo(x - 7, y); ctx.lineTo(x - 24, y + 13);
      ctx.moveTo(x - 6, y - 5); ctx.lineTo(x + 16, y - 2);
      ctx.moveTo(x + 10, y + 15); ctx.lineTo(x + 26, y + 27);
      ctx.moveTo(x + 4, y + 12); ctx.lineTo(x - 12, y + 28);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawPlaneIcon(ctx, x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.15);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.lineTo(7, -5); ctx.lineTo(27, 2); ctx.lineTo(27, 9);
    ctx.lineTo(7, 6); ctx.lineTo(3, 24); ctx.lineTo(-4, 24); ctx.lineTo(-6, 6);
    ctx.lineTo(-25, 12); ctx.lineTo(-27, 6); ctx.lineTo(-7, -5); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  drawTokyoTower(ctx, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y - 42); ctx.lineTo(x - 24, y + 32); ctx.moveTo(x, y - 42); ctx.lineTo(x + 24, y + 32);
    ctx.moveTo(x - 16, y - 5); ctx.lineTo(x + 16, y - 5);
    ctx.moveTo(x - 22, y + 19); ctx.lineTo(x + 22, y + 19);
    ctx.moveTo(x - 31, y + 33); ctx.lineTo(x + 31, y + 33);
    ctx.stroke();
    ctx.restore();
  },

  async shareCard() {
    if (!this.shareBlob) return;
    const file = new File([this.shareBlob], this.shareFilename, { type: "image/png" });

    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Tokyo 2027 Training Record" });
      } else {
        this.downloadShareCard();
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("分享失敗，改用下載。", error);
        this.downloadShareCard();
      }
    }
  },

  downloadShareCard() {
    if (!this.shareBlob) return;
    const url = URL.createObjectURL(this.shareBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = this.shareFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
