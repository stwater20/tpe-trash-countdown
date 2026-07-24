# 🚛 台北市垃圾車時間查詢｜垃圾車幾點到？即時倒數＋日曆提醒

選你家附近的清運點，即時倒數垃圾車抵達時間，一鍵把每週收運時間加進手機日曆。純靜態網站，跑在 GitHub Pages 上，資料由 GitHub Actions 每月自動更新。

姊妹站：[新北市垃圾車時間查詢](https://ntpc-trash-countdown.sectools.tw/)（[repo](https://github.com/stwater20/ntpc-trash-countdown)）

## ✨ 功能

- **下一班倒數**：以台北時間計算下一次收運（垃圾／回收／廚餘分開計），一小時內顯示分秒倒數
- **三種找清運點方式**：區→里瀏覽、關鍵字搜尋（路名／地標）、📍 GPS 定位找最近 20 個清運點（含距離）
- **每週時刻表**：台北市週三、週日停收；回收週一、五收平面類，週二、四、六收立體類
- **📅 加入日曆**：產生 .ics 檔（每週重複事件＋提前 10 分鐘提醒），iPhone／Android／Google 日曆都能匯入
- **⭐ 常用清運點**：收藏多個清運點（例如家裡＋公司），一鍵切換
- **🔗 可分享網址**：選好的清運點會寫進網址 hash，貼給家人直接開
- **記住上次選擇**：下次打開直接顯示你的清運點

## 🏗️ 架構

```
index.html              ← 網站本體（無外部套件、單檔）
data/index.json         ← 行政區索引（Actions 產生）
data/<行政區>.json       ← 各區清運點資料（Actions 產生）
scripts/fetch-data.mjs  ← 抓資料腳本（Node 20+，無外部套件）
.github/workflows/update-data.yml ← 每月 1 號自動抓最新資料
```

前端不直接呼叫 data.taipei API，改由 GitHub Actions 在伺服器端抓資料、切成每區 JSON commit 進 repo，網站讀同源檔案：快、穩、離線可快取，也不怕 API 掛掉。

## 🚀 部署

1. Fork 或推這個 repo 到 GitHub
2. Actions 頁籤 → 「Update garbage truck data」→ Run workflow（第一次手動跑，之後每月自動）
3. Settings → Pages → Deploy from a branch → main / root
4. 完成，網址在 `https://<帳號>.github.io/<repo名>/`

## 📅 資料來源與授權

- 資料：[臺北市資料大平臺「臺北市垃圾車點位路線資訊」](https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae)（臺北市政府環境保護局，公開授權）
- 共 4,000+ 個清運點、12 個行政區，含表定抵達時間與路線車次
- ⚠️ 表定時間僅供參考，實際以現場為準；颱風等天災停收請看環保局公告

## License

MIT（程式碼）。資料依臺北市資料大平臺授權條款。
