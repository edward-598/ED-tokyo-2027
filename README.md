# Tokyo 2027 Training — V1.3

手機優先的個人東京馬拉松訓練儀表板。

## V1.3 更新重點

這次把正式訓練起點提前到 **2026/10/12**。

Phase 1 由原本 4 週擴成 **6 週（10/12–11/22）**，後面的 Phase 2～4 日期維持不動。

新增兩週銜接期：

- Week 1｜10/12–10/18：恢復、Easy、跑者肌力、節奏入門、Gym、14–16K LSD
- Week 2｜10/19–10/25：跑班前 Easy、10/21 Coach Session、跑班後恢復、Gym、16K LSD

## 新增 CLASS 類型

V1.3 新增：

- `RUN`：自主跑步主課
- `CLASS`：跑班 / 教練課
- `STRENGTH`：跑者專項肌力
- `GYM`：一般健身房重訓
- `RECOVERY`：恢復 / Mobility

`CLASS` 在畫面上會獨立標示，但完成率會併入 RUN 計算。

`RECOVERY` 可以打勾記錄，但不列入正式訓練完成率，避免休息恢復日把完成率灌高。

## 10/21 跑班原則

10/21 起，教練課優先於網站原本的品質課。

如果教練當天已安排 Tempo / Interval / Hill 等品質刺激，隔天不再自行補第二堂品質跑。

目前 V1.3 只先放 **10/21 第一堂 CLASS**。後續跑班確定每週內容後，再把實際 Coach Session 填進 `training.json`，避免先猜教練課內容。

## Phase 1 新週次

- Week 1：10/12–10/18
- Week 2：10/19–10/25
- Week 3：10/26–11/01（原 Week 1）
- Week 4：11/02–11/08（原 Week 2）
- Week 5：11/09–11/15（原 Week 3）
- Week 6：11/16–11/22（原 Week 4）

## 最常改的檔案

通常只需要改：

`data/training.json`

例如教練課內容確定後，可以找到：

```json
{
  "date": "2026-10-21",
  "category": "class",
  "type": "CLASS",
  "title": "H2O 跑班｜Coach Session"
}
```

再把當天實際內容填入 `plans.main.steps` 即可。

## GitHub Pages 更新

如果你目前 GitHub 已經是 V1.2：

1. 解壓縮 V1.3
2. Repository → `Add file` → `Upload files`
3. 將 V1.3 裡的檔案與資料夾全部上傳，覆蓋同名檔案
4. Commit message 可寫：`Update Tokyo 2027 to V1.3`
5. 等 GitHub Pages 重新部署

不要直接上傳 zip；要上傳解壓縮後的內容。

## 完成紀錄

完成紀錄仍使用原本 localStorage key，因此同一個 GitHub Pages 網址、同一支手機與瀏覽器，更新 V1.3 後原本勾選紀錄通常會保留。

## 檔案結構

```text
tokyo-2027-v1.3/
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
