/* =========================================================
   calendar.js
   ---------------------------------------------------------
   只負責日曆相關邏輯：
   - 月份切換
   - 產生 6 x 7 日曆格
   - 日期格式工具
   ========================================================= */

const TokyoCalendar = (() => {
  const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

  function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseISODate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function monthLabel(date) {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "long"
    }).format(date);
  }

  function longDateLabel(iso) {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "short",
      day: "numeric",
      weekday: "short"
    }).format(parseISODate(iso));
  }

  function buildMonthGrid(referenceDate) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        date,
        iso: toISODate(date),
        currentMonth: date.getMonth() === month
      };
    });
  }

  return {
    WEEKDAY_LABELS,
    toISODate,
    parseISODate,
    monthLabel,
    longDateLabel,
    buildMonthGrid
  };
})();
