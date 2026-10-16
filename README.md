# Tokyo 2027 Training — V1.3.5.1

個人東京馬拉松訓練追蹤網站，適合直接部署到 GitHub Pages。

## V1.3.5.1 新功能

### 1. Today 身體狀態
每天打開 Today 可先選：

- `READY`：建議主課表 MAIN
- `TIRED`：建議 FATIGUE 疲勞版
- `SORE`：優先 RECOVERY；若是局部疼痛、越動越痛、發燒或明顯不適，停止訓練並優先恢復

選擇會儲存在目前裝置的 localStorage。

### 2. RPE + Legs Feedback
完成一堂訓練後可記錄：

- RPE：1～10
- Legs：GOOD / HEAVY / SORE

舊版已經打勾的紀錄仍可沿用；有需要時再補 RPE / Legs 即可。

### 3. 近一週 / 近一月 Training Record
Today 頁新增：

- 整體正式訓練完成率
- RUN 完成率
- STRENGTH 完成率
- GYM 完成率
- RECOVERY 完成率
- 完成公里數
- 完成 Sessions
- 平均 RPE

`CLASS` 仍併入 RUN；`RECOVERY` 有記錄完成率，但不灌高正式 Journey 進度。

### 4. Tokyo Journey
Tokyo Journey = 已完成正式 Session / 全部正式 Session。

- RUN / CLASS / STRENGTH / GYM：計入
- RECOVERY：保留紀錄，但不計入 Journey

完成一堂正式訓練，飛機就會往 TOKYO 前進。

### 5. 社群分享卡
Training Record 可切換：

- THIS WEEK
- THIS MONTH

並產生 9:16 PNG 分享卡。手機瀏覽器支援 Web Share 時可直接開啟系統分享選單；否則可下載 PNG。

## 資料保存方式

目前沒有加入跨裝置後台。

所有個人紀錄仍存在目前瀏覽器的 `localStorage`：

- 完成狀態
- MAIN / RAIN / FATIGUE
- READY / TIRED / SORE
- RPE
- GOOD / HEAVY / SORE

所以：

- 同一支手機 + 同一瀏覽器：下次打開仍會保留
- 手機與電腦：不會同步
- 清除瀏覽器網站資料：可能清除紀錄

## 課表資料

課表本身仍放在：

`data/training.json`

如果只是調整某天課表、公里數、配速或內容，優先修改這個檔案，不需要改 `app.js`。

## GitHub Pages 更新方式

如果已經有 V1.3.1：

1. 解壓縮 V1.3.5.1
2. 把解壓後的所有檔案與資料夾上傳到原本 Repository 根目錄
3. 覆蓋同名檔案
4. Commit changes
5. 等待 GitHub Pages 重新部署

建議 Commit message：

`Update Tokyo 2027 to V1.3.5.1 - Add status RPE journey share card`

## 主要檔案

- `index.html`：頁面骨架、Dialog
- `css/styles.css`：全部 UI 樣式
- `js/app.js`：Today / Calendar / RPE / Journey / Share Card 主邏輯
- `js/storage.js`：localStorage 個人紀錄
- `js/calendar.js`：日曆日期工具
- `data/training.json`：Phase 與每天課表
- `sw.js`：PWA Cache
