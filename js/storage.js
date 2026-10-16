/* =========================================================
   storage.js - Tokyo 2027 V1.3.5
   ---------------------------------------------------------
   專門處理「這台裝置上的個人訓練紀錄」。

   目前仍使用 localStorage：
   - 不需要登入
   - 不需要後台 / 資料庫
   - GitHub Pages 可直接使用
   - 同一裝置、同一瀏覽器會保留紀錄

   V1.3.5 除了完成紀錄，新增：
   - preStatus  : READY / TIRED / SORE
   - rpe        : 1 ~ 10
   - legsStatus : GOOD / HEAVY / SORE

   注意：不同裝置不會自動同步；這是目前刻意保留的設計。
   ========================================================= */

const TokyoStorage = (() => {
  const STORAGE_KEY = "tokyo2027-completions-v1";

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (error) {
      console.warn("訓練紀錄讀取失敗，改用空資料。", error);
      return {};
    }
  }

  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function get(date) {
    return readAll()[date] || null;
  }

  /*
    只更新某一天的一部分欄位，避免設定 RPE 時把 completedAt 等資料洗掉。
    也讓舊版只有 { mode, completedAt } 的資料可以直接沿用。
  */
  function patch(date, changes) {
    const data = readAll();
    data[date] = {
      ...(data[date] || {}),
      ...changes,
      updatedAt: new Date().toISOString()
    };
    saveAll(data);
    return data[date];
  }

  function set(date, mode) {
    const existing = get(date) || {};
    return patch(date, {
      mode,
      completedAt: existing.completedAt || new Date().toISOString()
    });
  }

  function setPreStatus(date, preStatus) {
    return patch(date, { preStatus });
  }

  function setFeedback(date, rpe, legsStatus) {
    return patch(date, {
      rpe: Number(rpe),
      legsStatus
    });
  }

  /*
    取消完成只移除「完成 / 回饋」欄位，保留當天開始前選過的身體狀態。
    這樣誤按完成再取消，不會連 READY / TIRED / SORE 一起消失。
  */
  function removeCompletion(date) {
    const data = readAll();
    if (!data[date]) return;

    delete data[date].mode;
    delete data[date].completedAt;
    delete data[date].rpe;
    delete data[date].legsStatus;
    data[date].updatedAt = new Date().toISOString();

    const onlyMetadata = Object.keys(data[date]).every(key => ["preStatus", "updatedAt"].includes(key));
    if (onlyMetadata && !data[date].preStatus) delete data[date];

    saveAll(data);
  }

  // 舊程式仍可能呼叫 remove；保留相容名稱。
  function remove(date) {
    removeCompletion(date);
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isCompleted(date) {
    return Boolean(get(date)?.completedAt || get(date)?.mode);
  }

  return {
    readAll,
    get,
    patch,
    set,
    setPreStatus,
    setFeedback,
    removeCompletion,
    remove,
    clear,
    isCompleted
  };
})();
