# Tokyo 2027 Training — V1.2

手機優先的個人東京馬拉松訓練儀表板。

## V1.2 這次新增什麼？

V1.2 把課表正式分成三條訓練線：

- `RUN`：跑步主課（Easy / Tempo / Interval / MP / LSD）
- `STRENGTH`：跑者專項肌力（臀腿 / 小腿 / 核心 / 單腳穩定）
- `GYM`：一般健身房重訓（Upper / Full Body 等）
- `RECOVERY`：目前整合在 GYM 課程底部，作為伸展 / Mobility / 恢復收尾

Calendar 點開某一天後，會直接看到該日完整課表。

四個 Phase 的所有訓練類型都沿用該 Phase 主色：

- Phase 1：亮粉紅
- Phase 2：天空藍
- Phase 3：橘色
- Phase 4：Tiffany Green

## 週節奏

目前核心週節奏大致為：

- 週二：RUN
- 週三：STRENGTH
- 週四：RUN 品質課
- 週五：GYM + RECOVERY
- 週日：RUN LSD

這不是要求每天都高強度。週三肌力刻意控制在 RPE 6–7 左右；週五 Gym 以上肢 / Core 為主，避免影響週日 LSD。

> 2026/12/30–2027/01/02 原本設定無法訓練，V1.2 不會硬塞正式 Strength / Gym 課進這段期間。

## 首頁完成度

正式 Phase 開始後，首頁會分開顯示：

- Overall
- RUN
- STRENGTH
- GYM

現在仍在 Pre-season 時，也會先顯示整套正式課表已排入多少 RUN / STRENGTH / GYM。

## 最常改的檔案

大部分情況只要修改：

`data/training.json`

程式與課表資料分離，調整某天公里數、重量、組數、雨備、疲勞版，都不用改 HTML。

### 一堂 STRENGTH 的結構範例

```json
{
  "date": "2026-10-28",
  "category": "strength",
  "type": "STRENGTH",
  "shortLabel": "STR",
  "title": "跑者專項肌力｜基礎穩定",
  "duration": "35–45 MIN"
}
```

### 一堂 GYM + RECOVERY 的結構

GYM 的 `plans` 是正式重訓內容；`recovery` 是同一天的伸展 / Mobility 收尾。

## GitHub Pages 更新方式

如果你已經有 V1.0 / V1.1 repository：

1. 解壓縮 V1.2
2. GitHub repository → `Add file` → `Upload files`
3. 把 V1.2 裡的檔案全部拖進去覆蓋同名檔案
4. Commit message 可寫：`Update Tokyo 2027 to V1.2`
5. 等 GitHub Pages 重新部署

V1.2 的 Service Worker cache 名稱也已更新，降低手機一直看到舊版快取的機率。

## 完成紀錄

完成紀錄仍存在瀏覽器 `localStorage`，而且沿用舊 Storage Key，所以同一個 GitHub Pages 網址、同一個瀏覽器更新 V1.2 時，原本 V1/V1.1 的打勾紀錄通常會保留。

## 檔案結構

```text
tokyo-2027-v1.2/
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

## 安全原則

- 疲勞可以降級訓練，但疼痛、發燒、疑似受傷不硬補。
- STRENGTH / GYM 不以做到力竭為目標。
- 長跑與關鍵跑優先度高於額外重量訓練。
