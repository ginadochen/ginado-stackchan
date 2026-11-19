"""知乎创作分析周报（StackChan 黑客松定制代码）。

拉取本人最近 N 天（默认 7）发布的回答/想法，逐篇取浏览/赞同/收藏/转发等指标，
汇总成看板数据 + 规则版建议 + 语音周报稿，并用 EdgeTTS 生成音频。

产出：
  reports/creator-YYYY-MM-DD.json / .txt   数据与播报稿
  ../morning-news/site/creator/index.html  看板页面（含音频播放器）
  ../morning-news/site/creator/weekly.mp3  周报音频

仅用 Python 标准库；音频依赖已安装的 edge-tts（python -m edge_tts）。
部署：生成后 wrangler pages deploy ../morning-news/site（网址 zhihu.ginado.ai/creator/）。
"""

import argparse
import datetime
import json
import os
import subprocess
import sys
import time

DEFAULT_CLI = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), "ZhihuCLI", "current", "zhihu-cli.exe"
)
HERE = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.join(HERE, "reports")
SITE_DIR = os.path.join(HERE, "..", "morning-news", "site", "creator")
TYPES = {"answer": "回答", "pin": "想法"}


def run_cli(cli_path: str, args: list[str], timeout: int = 60) -> dict:
    proc = subprocess.run(
        [cli_path, *args], capture_output=True, text=True,
        encoding="utf-8", timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"CLI 失败: {' '.join(args)}\n{proc.stderr.strip()}\n{proc.stdout.strip()}"
        )
    return json.loads(proc.stdout)


def fetch_recent(cli_path: str, days: int, max_items: int) -> list[dict]:
    cutoff = time.time() - days * 86400
    found, offset = [], "0"
    for _ in range(10):  # 翻页安全上限
        data = run_cli(cli_path, [
            "me", "contents", "--type", "all", "--sort", "ts",
            "--order", "desc", "--offset", offset, "--limit", "20",
        ])
        if data.get("Code") != 0:
            raise RuntimeError(f"创作列表报错: {data.get('Message')}")
        items = data["Data"]["Items"]
        if not items:
            break
        for it in items:
            if it.get("CreatedAt", 0) < cutoff:
                return found[:max_items]  # 按时间倒序，后面更旧
            if it.get("ContentType") in TYPES:
                found.append(it)
        paging = data["Data"].get("Paging", {})
        if paging.get("IsEnd") or not paging.get("NextOffset"):
            break
        offset = str(paging["NextOffset"])
    return found[:max_items]


def fetch_stats(cli_path: str, url: str) -> dict | None:
    try:
        data = run_cli(cli_path, ["me", "content-stats", "--content-url", url])
        items = data.get("Data", {}).get("Items") or []
        return items[0] if items else None
    except RuntimeError as e:
        print(f"    单篇统计不可用（跳过）: {e.args[0].splitlines()[-1][:60]}")
        return None


def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def analyze(contents: list[dict], stats_map: dict) -> dict:
    items, sources, ages, locs = [], {}, {}, {}
    totals = dict(view=0, up=0, collect=0, share=0, comment=0, followers=0)
    for c in contents:
        s = stats_map.get(c["Url"]) or {}
        m = s.get("Metrics") or {}
        view = m.get("ViewCount", 0)
        row = {
            "title": c.get("Title") or "(无标题)",
            "type": TYPES.get(c.get("ContentType"), c.get("ContentType")),
            "url": c["Url"],
            "created": datetime.datetime.fromtimestamp(c["CreatedAt"]).strftime("%m-%d"),
            "view": view,
            "up": m.get("UpvoteCount", 0),
            "collect": m.get("CollectCount", 0),
            "share": m.get("ShareCount", 0),
            "comment": m.get("CommentCount", 0),
            "followers": m.get("NewFollowerCount", 0),
            "has_stats": bool(m),
        }
        row["rate"] = (
            (row["up"] + row["collect"] + row["share"] + row["comment"]) / view
            if view else 0.0
        )
        items.append(row)
        for k in totals:
            totals[k] += row[k]
        for src in (s.get("Audience") or {}).get("Source", []):
            sources[src["Name"]] = sources.get(src["Name"], 0) + src.get("Count", 0)
        for a in (s.get("Audience") or {}).get("Age", []):
            ages[a["Name"]] = ages.get(a["Name"], 0) + a.get("Count", 0)
        for l in (s.get("Audience") or {}).get("Location", []):
            locs[l["Name"]] = locs.get(l["Name"], 0) + l.get("Count", 0)

    src_total = sum(sources.values()) or 1
    source_list = sorted(
        [{"name": k, "count": v, "ratio": v / src_total} for k, v in sources.items()],
        key=lambda x: -x["count"],
    )
    top = lambda d, n: sorted(d.items(), key=lambda kv: -kv[1])[:n]
    return {
        "items": sorted(items, key=lambda r: -r["view"]),
        "totals": totals,
        "counts": {
            "answer": sum(1 for c in contents if c["ContentType"] == "answer"),
            "pin": sum(1 for c in contents if c["ContentType"] == "pin"),
        },
        "sources": source_list,
        "age": [{"name": k, "count": v} for k, v in top(ages, 3)],
        "location": [{"name": k, "count": v} for k, v in top(locs, 5)],
    }


def suggest(agg: dict, days: int) -> list[str]:
    out = []
    items = [r for r in agg["items"] if r["has_stats"]]
    t = agg["totals"]
    n = len(agg["items"])
    if n == 0:
        return [f"最近{days}天没有发布回答或想法。保持更新是获得推荐流量的前提，先从一条想法开始。"]
    best = items[0] if items else None
    if best:
        out.append(
            f"浏览最高的是《{best['title'][:30]}》（{best['view']}浏览、{best['up']}赞同），"
            "这类选题和开头写法值得复用。"
        )
    by_type = {}
    for r in items:
        by_type.setdefault(r["type"], []).append(r)
    if len(by_type) == 2:
        avg = {k: sum(r["view"] for r in v) / len(v) for k, v in by_type.items()}
        better = max(avg, key=avg.get)
        out.append(
            f"{better}的平均浏览（{avg[better]:.0f}）明显高于另一类，"
            f"精力有限时优先写{better}。"
        )
    rec = next((s["ratio"] for s in agg["sources"] if s["name"] == "App-推荐"), 0)
    search = next((s["ratio"] for s in agg["sources"] if s["name"] == "App-搜索"), 0)
    if rec and rec < 0.35:
        out.append(
            f"推荐流量只占{pct(rec)}，系统分发偏少：标题可以更直接抛出冲突或结论，"
            "并尽量蹭热榜问题作答。"
        )
    if search >= 0.15:
        out.append(
            f"搜索流量占{pct(search)}，说明内容有长尾价值，适合持续写解读/方法类题材。"
        )
    if t["view"]:
        up_rate = t["up"] / t["view"]
        if up_rate < 0.01:
            out.append(
                f"整体赞同率{pct(up_rate)}（低于1%），看的人多但认同少："
                "开头三段内给出明确观点，别先铺背景。"
            )
        elif up_rate > 0.03:
            out.append(f"赞同率{pct(up_rate)}，高于常见水平，观点共鸣强，保持这个风格。")
        if t["collect"] / t["view"] > 0.01:
            out.append("收藏率不错，内容实用性强，可以多做清单式、可复用的干货。")
    if n < 3:
        out.append(f"本周只发了{n}篇，更新频率偏低，稳定更新有利于推荐权重。")
    if t["followers"]:
        out.append(f"本周涨粉{t['followers']}个，内容开始带来关注，可在文末引导关注。")
    return out[:5]


def build_broadcast(agg: dict, suggestions: list[str], days: int) -> str:
    t, c = agg["totals"], agg["counts"]
    parts = [
        f"这是你的知乎创作周报。最近{days}天，你发布了{c['answer']}篇回答、{c['pin']}条想法。"
        f"总浏览{t['view']}，赞同{t['up']}，收藏{t['collect']}，转发{t['share']}，涨粉{t['followers']}个。"
    ]
    if agg["items"]:
        b = agg["items"][0]
        parts.append(f"表现最好的是《{b['title'][:30]}》，{b['view']}次浏览，{b['up']}个赞同。")
    tips = [s for s in suggestions if not s.startswith("浏览最高")][:2]
    if tips:
        parts.append("给你的建议：" + "；".join(tips))
    parts.append("周报完毕，继续加油！")
    return "\n".join(parts)


def build_dashboard(data: dict, has_audio: bool) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    audio_block = """
<section class="player">
  <button id="playBtn" aria-label="播放"><svg id="iPlay" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><svg id="iPause" viewBox="0 0 24 24" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg></button>
  <div class="ctl">
    <div class="status" id="status">点按钮听本周创作周报</div>
    <div class="row"><input id="seek" type="range" min="0" max="100" value="0" step="0.1"><span class="time" id="time">00:00 / 00:00</span></div>
  </div>
</section>
<audio id="audio" preload="auto" src="weekly.mp3"></audio>
""" if has_audio else ""
    return """<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>创作周报 · 知乎看板</title>
<style>
:root{--bg:#0e1216;--panel:#171e26;--line:#263140;--text:#eef3f8;--muted:#8fa0b3;--accent:#3d9bff;--deep:#1f6fd0;--good:#3fb97f}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--text);font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif;font-size:18px;line-height:1.6;padding:24px 32px}
a{color:var(--accent);text-decoration:none}
header{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:18px}
h1{font-size:30px}h1 em{font-style:normal;color:var(--accent)}
.date{color:var(--muted);font-size:18px}
.player{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 24px;display:flex;align-items:center;gap:20px;margin-bottom:18px}
#playBtn{flex:0 0 auto;width:72px;height:72px;border-radius:50%;border:none;background:var(--deep);cursor:pointer;display:flex;align-items:center;justify-content:center}
#playBtn svg{width:34px;height:34px;fill:#fff}
.ctl{flex:1;min-width:0}.status{color:var(--muted);font-size:17px;margin-bottom:8px}
.row{display:flex;align-items:center;gap:12px}
#seek{flex:1;height:28px;appearance:none;-webkit-appearance:none;background:transparent}
#seek::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:var(--line)}
#seek::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--accent);margin-top:-8px}
.time{color:var(--muted);font-size:16px;min-width:96px;text-align:right}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px}
.card .v{font-size:28px;font-weight:700}.card .k{color:var(--muted);font-size:15px}
h2{font-size:21px;margin:20px 0 10px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 20px}
.tip{padding:8px 0;border-bottom:1px solid var(--line);font-size:17px}
.tip:last-child{border-bottom:none}
.tip b{color:var(--good)}
table{width:100%;border-collapse:collapse;font-size:16px}
th{color:var(--muted);font-weight:500;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:none}
.tt{max-width:420px}.tt a{color:var(--text)}
.tag{display:inline-block;font-size:13px;color:var(--accent);border:1px solid var(--deep);border-radius:6px;padding:0 8px;margin-right:8px}
.bar{height:6px;border-radius:3px;background:var(--deep);margin-top:6px}
.num{font-variant-numeric:tabular-nums}
.src{display:flex;align-items:center;gap:12px;padding:6px 0;font-size:16px}
.src .n{flex:0 0 110px;color:var(--muted)}
.src .track{flex:1;height:10px;background:var(--line);border-radius:5px}
.src .fill{height:10px;border-radius:5px;background:var(--accent)}
.src .p{flex:0 0 64px;text-align:right;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{border:1px solid var(--line);border-radius:999px;padding:6px 16px;font-size:15px;color:var(--muted)}
footer{margin-top:22px;color:var(--muted);font-size:14px}
</style></head><body>
<header><h1>创作周报<em>.</em></h1><span class="date" id="sub"></span><a href="/">← 知乎早报</a></header>
__AUDIO__
<div class="cards" id="cards"></div>
<h2>建议</h2><div class="panel" id="tips"></div>
<h2>单篇表现（按浏览排序）</h2><div class="panel"><table id="tbl"></table></div>
<h2>流量来源</h2><div class="panel" id="srcs"></div>
<h2>读者画像</h2><div class="panel"><div class="chips" id="aud"></div></div>
<footer>数据来自知乎开放平台本人创作统计，规则建议仅供参考。</footer>
<script>
const D=__DATA__;
document.getElementById('sub').textContent=D.days+'天 · '+D.counts.answer+'篇回答 / '+D.counts.pin+'条想法 · 生成于 '+D.generated;
const T=D.totals;
const cards=[['总浏览',T.view],['赞同',T.up],['收藏',T.collect],['转发',T.share],['评论',T.comment],['涨粉',T.followers]];
document.getElementById('cards').innerHTML=cards.map(c=>'<div class="card"><div class="v num">'+c[1].toLocaleString()+'</div><div class="k">'+c[0]+'</div></div>').join('');
document.getElementById('tips').innerHTML=D.suggestions.map(s=>'<div class="tip">'+s+'</div>').join('')||'<div class="tip">暂无建议</div>';
const max=Math.max(1,...D.items.map(i=>i.view));
document.getElementById('tbl').innerHTML='<tr><th>内容</th><th>浏览</th><th>赞同</th><th>收藏</th><th>转发</th><th>互动率</th></tr>'+D.items.map(i=>'<tr><td class="tt"><span class="tag">'+i.type+'</span><a href="'+i.url+'" target="_blank" rel="noopener">'+i.title+'</a><div class="bar" style="width:'+Math.round(i.view/max*100)+'%"></div><div style="color:var(--muted);font-size:13px">'+i.created+(i.has_stats?'':' · 统计缺失')+'</div></td><td class="num">'+i.view.toLocaleString()+'</td><td class="num">'+i.up+'</td><td class="num">'+i.collect+'</td><td class="num">'+i.share+'</td><td class="num">'+(i.rate*100).toFixed(2)+'%</td></tr>').join('');
document.getElementById('srcs').innerHTML=D.sources.map(s=>'<div class="src"><span class="n">'+s.name+'</span><div class="track"><div class="fill" style="width:'+Math.round(s.ratio*100)+'%"></div></div><span class="p">'+(s.ratio*100).toFixed(1)+'%</span></div>').join('')||'暂无来源数据';
document.getElementById('aud').innerHTML=D.age.map(a=>'<span class="chip">'+a.name+' '+a.count+'人</span>').join('')+D.location.map(l=>'<span class="chip">'+l.name+' '+l.count+'人</span>').join('');
const audio=document.getElementById('audio');
if(audio){
  const pb=document.getElementById('playBtn'),ip=document.getElementById('iPlay'),ia=document.getElementById('iPause'),sk=document.getElementById('seek'),tm=document.getElementById('time'),st=document.getElementById('status');
  const fmt=s=>{if(!isFinite(s))s=0;return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0')};
  const rt=()=>{tm.textContent=fmt(audio.currentTime)+' / '+fmt(audio.duration);if(audio.duration)sk.value=audio.currentTime/audio.duration*100};
  audio.addEventListener('loadedmetadata',rt);audio.addEventListener('timeupdate',rt);
  audio.addEventListener('play',()=>{ip.style.display='none';ia.style.display='block';st.textContent='正在播报创作周报'});
  audio.addEventListener('pause',()=>{ip.style.display='block';ia.style.display='none';st.textContent='已暂停'});
  audio.addEventListener('ended',()=>{ip.style.display='block';ia.style.display='none';st.textContent='播报完毕'});
  pb.addEventListener('click',()=>{audio.paused?audio.play().catch(()=>st.textContent='播放被拦截，请再点一次'):audio.pause()});
  sk.addEventListener('input',()=>{if(audio.duration)audio.currentTime=sk.value/100*audio.duration});
}
</script></body></html>
""".replace("__AUDIO__", audio_block).replace("__DATA__", payload)


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="知乎创作分析周报")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--limit", type=int, default=30, help="最多统计篇数（保护额度）")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--rebuild", metavar="JSON", help="从已保存的数据 JSON 重建产出，不重新取数")
    ap.add_argument("--cli", default=DEFAULT_CLI)
    args = ap.parse_args()

    if args.rebuild:
        with open(args.rebuild, encoding="utf-8") as f:
            data = json.load(f)
        text = build_broadcast(data, data["suggestions"], data["days"])
    else:
        print(f"[1/4] 拉取最近 {args.days} 天的回答/想法 ...")
        contents = fetch_recent(args.cli, args.days, args.limit)
        print(f"  共 {len(contents)} 篇")
        if not contents:
            print("窗口内没有内容，仍会生成空周报。")

        print("[2/4] 逐篇取统计 ...")
        stats_map = {}
        for i, c in enumerate(contents, 1):
            print(f"  {i}/{len(contents)} {c.get('Title', '')[:24]}")
            stats_map[c["Url"]] = fetch_stats(args.cli, c["Url"])
            if i < len(contents):
                time.sleep(2)

        agg = analyze(contents, stats_map)
        suggestions = suggest(agg, args.days)
        text = build_broadcast(agg, suggestions, args.days)
        data = {
            "generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "days": args.days, **agg, "suggestions": suggestions,
        }

    os.makedirs(REPORT_DIR, exist_ok=True)
    os.makedirs(SITE_DIR, exist_ok=True)
    stem = os.path.join(REPORT_DIR, f"creator-{datetime.date.today().isoformat()}")
    with open(stem + ".json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(stem + ".txt", "w", encoding="utf-8") as f:
        f.write(text)

    print("[3/4] 生成周报音频 ...")
    has_audio = False
    mp3 = os.path.join(SITE_DIR, "weekly.mp3")
    if not args.no_audio:
        proc = subprocess.run(
            [sys.executable, "-m", "edge_tts", "--voice", "zh-CN-YunyangNeural",
             "--file", stem + ".txt", "--write-media", mp3],
            capture_output=True, text=True,
        )
        has_audio = proc.returncode == 0 and os.path.isfile(mp3)
        if not has_audio:
            print(f"  音频生成失败（看板仍可用）: {proc.stderr.strip()[:120]}")

    with open(os.path.join(SITE_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(build_dashboard(data, has_audio))
    print(f"[4/4] 完成：看板 {SITE_DIR}\\index.html，音频={'有' if has_audio else '无'}")
    print("-" * 40)
    print(text)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"出错：{e}", file=sys.stderr)
        sys.exit(1)