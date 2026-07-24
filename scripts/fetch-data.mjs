// 抓取臺北市垃圾車點位路線資訊（data.taipei），輸出各行政區 JSON
// 資料集：https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae
import { mkdir, writeFile, rm } from "node:fs/promises";

const RID = "a6e90031-7ec4-4089-afb5-361a4efe7202";
const BASE = `https://data.taipei/api/v1/dataset/${RID}?scope=resourceAquire`;
const LIMIT = 1000;

async function fetchAll() {
  let offset = 0, all = [], count = Infinity;
  while (offset < count) {
    const res = await fetch(`${BASE}&limit=${LIMIT}&offset=${offset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    count = j.result.count;
    all.push(...j.result.results);
    offset += LIMIT;
    console.log(`fetched ${all.length}/${count}`);
  }
  return all;
}

// 抵達時間 "1630" -> "16:30"
const t4 = t => { const s = String(t ?? "").replace(/\D/g, "").padStart(4, "0"); return s.slice(0, 2) + ":" + s.slice(2, 4); };

// 臺北市：週三、週日停收（一般垃圾、廚餘、資源回收皆同）
// 資源回收類別：週一、五收平面類；週二、四、六收立體類（前端顯示說明）
const DAYS = "0110111"; // 日一二三四五六

const rows = await fetchAll();
const byCity = {};
for (const r of rows) {
  const city = (r["行政區"] || "").trim();
  const spot = (r["地點"] || "").trim();
  if (!city || !spot) continue;
  (byCity[city] ??= []).push([
    spot,                                   // 0 名稱（地點）
    (r["里別"] || "").trim(),               // 1 里別
    t4(r["抵達時間"]),                      // 2 抵達時間 HH:MM
    +r["經度"] || 0,                        // 3 經度
    +r["緯度"] || 0,                        // 4 緯度
    DAYS,                                   // 5 垃圾（週別旗標，日~六）
    DAYS,                                   // 6 回收
    DAYS,                                   // 7 廚餘
    `${(r["路線"] || "").trim()} ${(r["車次"] || "").trim()}`.trim() // 8 路線車次
  ]);
}

await rm("data", { recursive: true, force: true });
await mkdir("data", { recursive: true });

let total = 0;
const cities = [];
for (const [city, stops] of Object.entries(byCity).sort((a, b) => a[0].localeCompare(b[0], "zh-Hant"))) {
  stops.sort((a, b) => a[0].localeCompare(b[0], "zh-Hant") || a[2].localeCompare(b[2]));
  await writeFile(`data/${city}.json`, JSON.stringify({ stops }));
  cities.push({ name: city, n: stops.length });
  total += stops.length;
}
await writeFile("data/index.json", JSON.stringify({
  updated: new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" }),
  total, cities
}));
console.log(`done: ${total} stops, ${cities.length} districts`);
