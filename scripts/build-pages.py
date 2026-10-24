#!/usr/bin/env python3
"""由 data/*.json 產生各行政區、各里的靜態查詢頁與 sitemap.xml（只用標準函式庫）。

讓搜尋引擎直接索引「大安區民輝里垃圾車時間」這類長尾關鍵字；
每個清運點連回首頁的可分享網址（#行政區~里~stopKey），開啟即顯示倒數與日曆。
"""
import json
import re
import shutil
from html import escape
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://tpe-trash-countdown.sectools.tw/"
DISTRICT_DIR = re.compile(r"^[一-鿿]+區$")


def esc(value):
    return escape(str(value), quote=True)


def app_hash(city, stop):
    # 與 index.html 的 stopKey / history.replaceState 格式一致
    key = f"{stop[0]}|{stop[2]}|{stop[8]}"
    return "#" + quote(f"{city}~{stop[1]}~{key}", safe="")


def page(title, description, canonical, depth, body, ld):
    up = "../" * depth
    return f"""<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{esc(canonical)}">
<meta name="theme-color" content="#276747">
<meta property="og:type" content="website">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:image" content="{SITE}assets/og.png">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台北市垃圾車時間查詢">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{up}assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{up}assets/icon-180.png">
<link rel="manifest" href="{up}manifest.webmanifest">
<link rel="stylesheet" href="{up}assets/page.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<main class="wrap">
<nav class="top" aria-label="網站導覽"><a href="{up}"><img class="mark" src="{up}assets/icon.svg" alt="" width="30" height="30"> 台北倒垃圾</a></nav>
{body}
<footer>資料來源：<a href="https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae" rel="noopener">臺北市資料大平臺「臺北市垃圾車點位路線資訊」</a>，每月自動更新。表定時間僅供參考，實際以現場為準；颱風、節慶停收請看<a href="https://www.dep.gov.taipei/" rel="noopener">環保局公告</a>。<br>由 <a href="https://sectools.tw/">sectools.tw</a> 製作的生活小工具・姊妹站：<a href="https://ntpc-trash-countdown.sectools.tw/">新北市垃圾車時間查詢</a></footer>
</main>
</body>
</html>
"""


RULES = """<div class="rules">
<div><b>週三、週日停收</b>一般垃圾、資源回收、廚餘皆停收。</div>
<div><b>♻️ 資源回收分類</b>週一、五收平面類（紙類、衣物）；週二、四、六收立體類（瓶罐、容器）。</div>
<div><b>🥬 廚餘</b>與垃圾車同時段收運，生廚餘、熟廚餘分開投入。</div>
</div>"""


def breadcrumbs(items):
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": url}
            for i, (name, url) in enumerate(items)
        ],
    }


def stop_rows(city, stops, depth):
    up = "../" * depth
    rows = []
    for s in sorted(stops, key=lambda s: (s[2], s[0])):
        rows.append(
            f'<tr><td class="t">{esc(s[2])}</td><td>{esc(s[0])}</td>'
            f'<td class="r">{esc(s[8])}</td>'
            f'<td><a href="{up}{app_hash(city, s)}">倒數＋日曆 →</a></td></tr>'
        )
    return (
        '<table><thead><tr><th>抵達</th><th>清運點</th><th class="r">路線車次</th><th>提醒</th></tr></thead><tbody>'
        + "".join(rows)
        + "</tbody></table>"
    )


def time_range(stops):
    times = sorted(s[2] for s in stops)
    return times[0], times[-1]


def main():
    index = json.loads((ROOT / "data/index.json").read_text("utf-8"))
    updated = index["updated"]

    # 先清掉舊的產生頁（只刪「XX區」資料夾），避免里別異動後留下過期頁面
    for child in ROOT.iterdir():
        if child.is_dir() and DISTRICT_DIR.match(child.name):
            shutil.rmtree(child)

    urls = [SITE]
    for c in index["cities"]:
        city = c["name"]
        stops = json.loads((ROOT / f"data/{city}.json").read_text("utf-8"))["stops"]
        villages = {}
        for s in stops:
            villages.setdefault(s[1] or "其他", []).append(s)
        city_url = f"{SITE}{quote(city)}/"
        urls.append(city_url)

        # ---- 各里頁 ----
        names = sorted(villages, key=lambda v: v)
        for v in names:
            vstops = villages[v]
            first, last = time_range(vstops)
            v_url = f"{city_url}{quote(v)}/"
            urls.append(v_url)
            title = f"{city}{v}垃圾車時間表｜{len(vstops)} 個清運點幾點到？"
            desc = (
                f"台北市{city}{v}垃圾車時間：共 {len(vstops)} 個清運點，表定 {first}～{last} 抵達。"
                f"點選清運點即可看即時倒數、一鍵加入手機日曆提醒。週三、週日停收。"
            )
            others = [o for o in names if o != v]
            body = f"""<p class="crumb"><a href="../../">台北市</a> › <a href="../">{esc(city)}</a> › {esc(v)}</p>
<h1>{esc(city)}{esc(v)}垃圾車時間</h1>
<p class="lead">共 {len(vstops)} 個清運點，表定 {esc(first)}～{esc(last)} 抵達。點「倒數＋日曆」可看下一班倒數、加入每週提醒。資料更新：{esc(updated)}</p>
<a class="cta" href="../../#{quote(f'{city}~{v}', safe='')}">🚛 開啟即時倒數</a>
{RULES}
<h2>{esc(v)}清運點與抵達時間</h2>
{stop_rows(city, vstops, 2)}
<h2>{esc(city)}其他里</h2>
<div class="links">{"".join(f'<a href="../{quote(o)}/">{esc(o)}</a>' for o in others)}</div>"""
            ld = [
                breadcrumbs([("台北市垃圾車時間查詢", SITE), (city, city_url), (v, v_url)]),
            ]
            out = ROOT / city / v / "index.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(page(title, desc, v_url, 2, body, ld), "utf-8")

        # ---- 行政區頁 ----
        first, last = time_range(stops)
        title = f"{city}垃圾車時間查詢｜{len(names)} 個里、{len(stops)} 個清運點"
        desc = (
            f"台北市{city}垃圾車幾點到？{len(names)} 個里、{len(stops)} 個清運點的表定抵達時間（{first}～{last}），"
            f"即時倒數、GPS 找最近清運點、加入手機日曆提醒。週三、週日停收。"
        )
        body = f"""<p class="crumb"><a href="../">台北市</a> › {esc(city)}</p>
<h1>{esc(city)}垃圾車時間查詢</h1>
<p class="lead">{len(names)} 個里、{len(stops)} 個清運點，表定 {esc(first)}～{esc(last)} 收運。選你家的里，看每個清運點幾點到。資料更新：{esc(updated)}</p>
<a class="cta" href="../#{quote(city, safe='')}">🚛 開啟即時倒數與定位</a>
{RULES}
<h2>選擇里別</h2>
<div class="links">{"".join(f'<a href="{quote(v)}/">{esc(v)}<span>{len(villages[v])} 點</span></a>' for v in names)}</div>
<h2>其他行政區</h2>
<div class="links">{"".join(f'<a href="../{quote(o["name"])}/">{esc(o["name"])}</a>' for o in index["cities"] if o["name"] != city)}</div>"""
        faq = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": f"{city}垃圾車幾點來？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": f"{city}共 {len(stops)} 個清運點，表定抵達時間介於 {first} 到 {last}，各清運點時間不同，可在本頁選里查詢。",
                    },
                },
                {
                    "@type": "Question",
                    "name": f"{city}垃圾車哪幾天停收？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "台北市每週三、週日停收垃圾、資源回收與廚餘；週一、五回收平面類，週二、四、六回收立體類。",
                    },
                },
            ],
        }
        ld = [breadcrumbs([("台北市垃圾車時間查詢", SITE), (city, city_url)]), faq]
        (ROOT / city / "index.html").write_text(page(title, desc, city_url, 1, body, ld), "utf-8")

    lastmod = "-".join(f"{int(p):02d}" for p in updated.split("/"))
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        sitemap.append(f"  <url><loc>{esc(u)}</loc><lastmod>{lastmod}</lastmod></url>")
    sitemap.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sitemap) + "\n", "utf-8")
    print(f"built {len(urls) - 1} pages")


if __name__ == "__main__":
    main()
