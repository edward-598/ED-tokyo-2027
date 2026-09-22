/* =========================================================
   storage.js
   ---------------------------------------------------------
   專門處理「完成紀錄」。
   V1 使用 localStorage：
   - 不需要登入
   - 不需要資料庫
   - GitHub Pages 可以直接使用

   注意：資料只存在目前瀏覽器 / 手機中。
   如果未來想跨裝置同步，再改成 Firebase / Supabase 即可。
   ========================================================= */

const TokyoStorage = (() => {
  const STORAGE_KEY = "tokyo2027-completions-v1";

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (error) {
      console.warn("完成紀錄讀取失敗，改用空資料。", error);
      return {};
    }
  }

  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function get(date) {
    return readAll()[date] || null;
  }

  function set(date, mode) {
    const data = readAll();
    data[date] = {
      mode,
      completedAt: new Date().toISOString()
    };
    saveAll(data);
  }

  function remove(date) {
    const data = readAll();
    delete data[date];
    saveAll(data);
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { readAll, get, set, remove, clear };
})();
