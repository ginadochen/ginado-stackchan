# morning-news：知乎早间新闻播报

StackChan 黑客松功能演示：每天早上让 StackChan 播报知乎当天热榜的高赞观点总结。

## 流水线

```
官方知乎 CLI hot（当天热榜）
  → 逐条 answer（知乎直答总结高赞观点，口语化 100 字内）
  → 拼成早报播报稿
  → POST /push/speak（xiaozhi-push 补丁，EdgeTTS 朗读）
```

## 前置条件

1. 官方知乎 CLI 已安装并配置 Access Secret（知乎开放平台 <https://developer.zhihu.com/profile> 生成）。
   默认路径 `%LOCALAPPDATA%\ZhihuCLI\current\zhihu-cli.exe`，可用 `--cli` 覆盖。
2. 自建 xiaozhi-esp32-server 已启动，且部署了 [xiaozhi-push](../qwen-bridge/xiaozhi-push/README.md) 补丁；
   StackChan 已配网连上自建服务端（OTA 指向本机 8003）。

## 用法

```powershell
python morning_news.py              # 抓 5 条热榜，总结后推送到在线设备播报
python morning_news.py --limit 3    # 只播前 3 条
python morning_news.py --dry-run    # 只生成播报稿不推送（先审内容）
python morning_news.py --device AA:BB:CC:DD:EE:FF
```

仅用 Python 标准库，无第三方依赖。每次运行的播报稿存档在 `reports/YYYY-MM-DD.txt`。

## 额度说明

热榜消耗 `hot_list` 额度，每条总结消耗一次 `zhida_openai`（直答）额度。
默认 5 条 = 1 次热榜 + 5 次直答。额度查询：`zhihu-cli quota`。

## 后续可扩展

- 定时：Windows 任务计划程序每天早上触发 `python morning_news.py`
- 车载场景：播报稿同步生成网页版，理想车机浏览器可打开阅读