// 從新北市資料開放平臺抓「新北市垃圾車路線」資料，切成每區 JSON
import { mkdirSync, writeFileSync } from "node:fs";

const DATASET = "edc3ad26-8ae7-4916-a00b-bc6048d19bf8";
const API = `https://data.ntpc.gov.tw/api/datasets/${DATASET}/json`;
const W = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

const all = [];
for (let page = 0; page < 60; page++) {
  const res = await fetch(`${API}?page=${page}&size=1000`);
  if (!res.ok) throw new Error(`API ${res.status} at page ${page}`);
  const rows = await res.json();
  all.push(...rows);
  if (rows.length < 1000) break;
}
if (all.length < 20000) throw new Error(`資料量異常偏少：${all.length} 筆，中止以免覆蓋好資料`);

const flags = (row, prefix) => W.map(d => row[prefix + d] === "Y" ? "1" : "0").join("");
const byCity = {};
for (const s of all) {
  if (!/^\d{1,2}:\d{2}$/.test(s.time)) continue;
  (byCity[s.city] ??= []).push([
    s.name, s.village, s.time,
    +(+s.longitude).toFixed(6), +(+s.latitude).toFixed(6),
    flags(s, "garbage"), flags(s, "recycling"), flags(s, "foodscraps"),
    s.linename
    ]);
}

const updated = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
mkdirSync("data", { recursive: true });
const cities = [];
for (const [city, stops] of Object.entries(byCity)) {
  stops.sort((a, b) => a[1].localeCompare(b[1], "zh-Hant") || a[2].localeCompare(b[2]));
  writeFileSync(`data/${city}.json`, JSON.stringify({ updated, city, stops }));
  cities.push({ name: city, n: stops.length });
}
cities.sort((a, b) => b.n - a.n);
writeFileSync("data/index.json", JSON.stringify({ updated, total: all.length, cities }));
console.log(`OK: ${all.length} stops, ${cities.length} districts, updated ${updated}`);
