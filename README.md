# Tokyo 2027 Training — V1.0

一個為手機優先設計的個人東京馬拉松訓練網頁。

## V1 已完成

- Today 首頁
- 自動判斷目前 Phase / Week
- Phase 完成率
- Today 今日課表
- Next 下一堂課
- Training Calendar 月曆
- 四階段顏色
- 單日詳細課表
- Main / Rain / Fatigue 三種模式
- 每日完成紀錄
- localStorage 保存完成狀態
- PWA 基礎支援，可加入手機主畫面
- Race / Course 保留入口，V2 再做

---

## 最重要：你以後最常改哪裡？

大部分情況只需要改：

`data/training.json`

課表和 UI 程式是分開的，所以你不用每次都進 app.js 改內容。

例如某天課表：

```json
{
  "date": "2026-10-29",
  "week": 1,
  "type": "Tempo",
  "title": "節奏跑（短）",
  "distanceKm": 7,
  "summary": "2K Easy + 3K @ 5:20–5:35 + 2K Easy"
}
```

如果只是要改配速、公里數、雨備或疲勞版，直接改這個 JSON 即可。

---

## GitHub Pages 使用方法

### 方法 A：直接上傳整包

1. 建立 GitHub Repository，例如 `tokyo-2027`
2. 把這個資料夾裡的檔案全部上傳到 repo 根目錄
3. 到 GitHub：
   - Settings
   - Pages
   - Build and deployment
   - Source 選 `Deploy from a branch`
   - Branch 選 `main`
   - Folder 選 `/ (root)`
4. Save
5. 等幾十秒到幾分鐘後，就會得到 GitHub Pages 網址

---

## 為什麼不能直接雙擊 index.html？

因為瀏覽器通常會擋本機 `fetch("data/training.json")`。

所以請用：

- GitHub Pages
- VS Code Live Server
- 或任何本機 HTTP server

來測試。

---

## 檔案結構

```text
tokyo-2027-v1/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/
│   └── styles.css
├── js/
│   ├── storage.js
│   ├── calendar.js
│   └── app.js
└── data/
    └── training.json
```

### index.html
頁面骨架與底部導覽。

### css/styles.css
全部外觀、Phase 顏色、手機版 RWD。

### js/storage.js
只管理完成紀錄。

### js/calendar.js
只管理日曆。

### js/app.js
主程式：Today、Calendar、單日課表、完成狀態。

### data/training.json
你最常編輯的課表資料。

### sw.js
離線快取的基礎版本。

---

## 完成紀錄存在哪裡？

現在存在瀏覽器的 `localStorage`。

優點：
- 不需要登入
- 不需要資料庫
- GitHub Pages 可直接用

限制：
- iPhone 與電腦不會自動同步
- 清除瀏覽器資料後紀錄可能消失

未來若要跨裝置同步，可再升級 Firebase / Supabase。

---

## V2 建議

等 V1 用順之後，再加：

1. Race 行前資訊
2. Course 路線與景點
3. 坡度圖
4. 補給計畫
5. 裝備 Checklist
6. 訓練筆記與疲勞評分
7. 雲端同步

