"""知乎早间新闻播报（StackChan 黑客松定制代码）。

流水线：官方知乎 CLI 拉当天热榜 -> 逐条调用知乎直答总结高赞观点
-> 拼成口语化早报 -> POST /push/speak 让 StackChan 朗读（EdgeTTS）。

仅用 Python 标准库，无第三方依赖。

用法：
  python morning_news.py                # 抓 5 条热榜并推送到在线设备播报
  python morning_news.py --limit 3      # 只播前 3 条
  python morning_news.py --dry-run      # 只生成播报稿，不推送（先看看内容）
  python morning_news.py --device AA:BB:CC:DD:EE:FF   # 指定设备

前置条件：
  1. 官方知乎 CLI 已安装并配置 Access Secret（zhihu-cli auth status 可查）
  2. 自建 xiaozhi-esp32-server 已启动且部署了 xiaozhi-push 补丁
     （见 ../qwen-bridge/xiaozhi-push/README.md），设备已连上
"""

import argparse
import datetime
import html as html_mod
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

DEFAULT_CLI = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), "ZhihuCLI", "current", "zhihu-cli.exe"
)
DEFAULT_PUSH_URL = "http://127.0.0.1:8003"
REPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")

SUMMARY_PROMPT = (
    "知乎热榜问题：「{title}」。请总结这个问题下高赞回答的主要观点，"
    "用100字以内的口语化中文，适合语音播报，不要分点、不要链接、不要书面语。"
    "如果检索不到回答内容，就根据问题本身用一句话介绍这件事的背景，"
    "不要说『找不到』『建议去查看』之类的话。"
)


def run_cli(cli_path: str, args: list[str], timeout: int = 180) -> dict:
    """调用知乎 CLI 并解析 JSON 输出。"""
    proc = subprocess.run(
        [cli_path, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"CLI 命令失败: {' '.join(args)}\n{proc.stderr.strip()}\n{proc.stdout.strip()}"
        )
    return json.loads(proc.stdout)


def fetch_hot(cli_path: str, limit: int) -> list[dict]:
    data = run_cli(cli_path, ["hot", "--limit", str(limit)])
    if data.get("Code") != 0:
        raise RuntimeError(f"热榜接口报错: {data.get('Message')}")
    return data["Data"]["Items"]


def summarize(cli_path: str, item: dict) -> str:
    try:
        data = run_cli(
            cli_path,
            [
                "answer",
                "--query",
                SUMMARY_PROMPT.format(title=item["Title"]),
                "--timeout",
                "120s",
            ],
        )
        return data["choices"][0]["message"]["content"].strip()
    except RuntimeError as e:
        # 直答限流/失败时降级：用热榜自带的摘要截取，保证早报完整
        fallback = re.sub(r"\[图片\]|\s+", " ", item.get("Summary", "")).strip()
        print(f"    （直答不可用，改用降级文案：{e.args[0].splitlines()[-1][:60]}）")
        if fallback:
            return fallback[:150] + ("…" if len(fallback) > 150 else "")
        return "这个问题正在知乎热议中，回答摘要暂缺，感兴趣可以看看原文。"


def build_broadcast(items: list[dict], summaries: list[str]) -> str:
    today = datetime.date.today()
    parts = [f"早上好！今天是{today.month}月{today.day}日，来听今天的知乎早报。"]
    for i, (item, summary) in enumerate(zip(items, summaries), 1):
        parts.append(f"第{i}条，{item['Title']} {summary}")
    parts.append("以上就是今天的知乎早报，祝你今天顺利！")
    return "\n".join(parts)


def build_html(items: list[dict], summaries: list[str]) -> str:
    """生成车机浏览器友好的单文件网页版早报（横屏、大字号、无外部依赖）。"""
    today = datetime.date.today()
    now = datetime.datetime.now().strftime("%H:%M")
    cards = []
    for i, (item, summary) in enumerate(zip(items, summaries), 1):
        title = html_mod.escape(item["Title"])
        summary = html_mod.escape(summary)
        url = html_mod.escape(item.get("Url", ""), quote=True)
        link = (
            f'<a class="src" href="{url}" target="_blank" rel="noopener">查看知乎原文 ↗</a>'
            if url
            else ""
        )
        cards.append(
            f'<article class="card"><div class="num">{i}</div>'
            f'<div class="body"><h2>{title}</h2><p>{summary}</p>{link}</div></article>'
        )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>知乎早报 · {today.month}月{today.day}日</title>
<style>
  :root {{
    --bg: #101418; --card: #1a2129; --line: #2a3441;
    --text: #e8edf2; --muted: #93a1b0; --accent: #4da3ff; --num: #2b6cb0;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    background: var(--bg); color: var(--text);
    font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
    font-size: 20px; line-height: 1.6; padding: 28px 36px;
  }}
  header {{
    display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap;
    border-bottom: 1px solid var(--line); padding-bottom: 18px; margin-bottom: 24px;
  }}
  h1 {{ font-size: 34px; font-weight: 700; }}
  h1 .dot {{ color: var(--accent); }}
  .date {{ font-size: 22px; color: var(--muted); }}
  .grid {{ display: grid; grid-template-columns: 1fr; gap: 18px; }}
  @media (min-width: 1100px) {{ .grid {{ grid-template-columns: 1fr 1fr; }} }}
  .card {{
    display: flex; gap: 18px; background: var(--card);
    border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px;
  }}
  .num {{
    flex: 0 0 auto; width: 46px; height: 46px; border-radius: 12px;
    background: var(--num); color: #fff; font-size: 24px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }}
  .body h2 {{ font-size: 23px; font-weight: 600; margin-bottom: 10px; }}
  .body p {{ color: var(--text); }}
  .src {{
    display: inline-block; margin-top: 12px; color: var(--accent);
    font-size: 17px; text-decoration: none;
  }}
  footer {{ margin-top: 26px; color: var(--muted); font-size: 16px; }}
</style>
</head>
<body>
<header>
  <h1>知乎早报<span class="dot">.</span></h1>
  <span class="date">{today.year}年{today.month}月{today.day}日 · 生成于 {now}</span>
</header>
<main class="grid">
{''.join(cards)}
</main>
<footer>内容来自知乎热榜，由高赞回答 AI 总结生成，仅供快速浏览；详情以知乎原文为准。</footer>
</body>
</html>
"""


def http_json(url: str, payload: dict | None = None) -> dict:
    if payload is None:
        req = urllib.request.Request(url)
    else:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def pick_device(push_url: str, device: str | None) -> str:
    if device:
        return device
    data = http_json(f"{push_url}/push/devices")
    devices = data.get("devices") or []
    if not devices:
        raise RuntimeError("没有在线设备：请确认 StackChan 已开机并连上自建服务端")
    return devices[0]


def main() -> int:
    # Windows 控制台默认 GBK，统一按 UTF-8 输出避免乱码
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="知乎早间新闻播报")
    parser.add_argument("--limit", type=int, default=5, help="热榜条数（默认 5）")
    parser.add_argument("--dry-run", action="store_true", help="只生成播报稿，不推送")
    parser.add_argument("--device", help="指定设备 device_id（MAC），默认取第一台在线设备")
    parser.add_argument("--push-url", default=DEFAULT_PUSH_URL, help="播报服务地址")
    parser.add_argument("--cli", default=DEFAULT_CLI, help="知乎 CLI 可执行文件路径")
    args = parser.parse_args()

    if not os.path.isfile(args.cli):
        print(f"找不到知乎 CLI：{args.cli}", file=sys.stderr)
        return 1

    print(f"[1/3] 拉取知乎热榜（前 {args.limit} 条）...")
    items = fetch_hot(args.cli, args.limit)
    for i, item in enumerate(items, 1):
        print(f"  {i}. {item['Title']}")

    print("[2/3] 逐条调用知乎直答总结高赞观点（每条可能要等十几秒）...")
    cache_path = os.path.join(REPORT_DIR, ".cache.json")
    cache_key = datetime.date.today().isoformat()
    try:
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f)
    except (OSError, ValueError):
        cache = {}
    day_cache = cache.get(cache_key, {})

    summaries = []
    for i, item in enumerate(items, 1):
        if item["Title"] in day_cache:
            print(f"  第 {i}/{len(items)} 条：命中当日缓存")
            summaries.append(day_cache[item["Title"]])
            continue
        print(f"  总结第 {i}/{len(items)} 条 ...")
        summary = summarize(args.cli, item)
        summaries.append(summary)
        day_cache[item["Title"]] = summary
        if i < len(items):
            time.sleep(5)  # 直答有频率限制，调用间留间隔

    cache = {cache_key: day_cache}  # 只保留当天，避免无限增长
    os.makedirs(REPORT_DIR, exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    text = build_broadcast(items, summaries)

    os.makedirs(REPORT_DIR, exist_ok=True)
    stem = os.path.join(REPORT_DIR, datetime.date.today().isoformat())
    with open(stem + ".txt", "w", encoding="utf-8") as f:
        f.write(text)
    with open(stem + ".html", "w", encoding="utf-8") as f:
        f.write(build_html(items, summaries))
    with open(stem + ".json", "w", encoding="utf-8") as f:
        json.dump(
            {"items": items, "summaries": summaries}, f, ensure_ascii=False, indent=2
        )
    print(f"播报稿已保存：{stem}.txt（网页版 .html / 数据 .json 同目录）")
    print("-" * 40)
    print(text)
    print("-" * 40)

    if args.dry_run:
        print("--dry-run：不推送。")
        return 0

    print("[3/3] 推送到 StackChan 播报 ...")
    device_id = pick_device(args.push_url, args.device)
    result = http_json(
        f"{args.push_url}/push/speak", {"device_id": device_id, "text": text}
    )
    if result.get("ok"):
        print(f"已推送，设备 {device_id} 正在播报。")
        return 0
    print(f"推送失败：{result}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"出错：{e}", file=sys.stderr)
        sys.exit(1)