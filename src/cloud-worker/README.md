# 知乎语音早报 / 创作周报 · Cloudflare Worker

完全运行在 Cloudflare Worker 上的知乎语音内容服务：拉数据 → AI 总结 → 云端合成中文语音 →
播客播放器风格网页。无服务器、无数据库费用（KV 免费额度内），TTS 走 EdgeTTS 免费通道。

维护者在线实例：<https://zhihu.ginado.ai>（早报）、<https://zhihu.ginado.ai/creator/>（周报）。

## 工作流

- **早报**（每天北京 07:30，cron `30 23 * * *` UTC）：知乎热榜 Top5 → 直答逐条总结
  （限流时降级为热榜摘要）→ 播报稿 → EdgeTTS（云扬新闻音色）合成 mp3 → 存 KV
- **周报**（每周一北京 08:00，cron `0 0 * * 1` UTC）：近 7 天回答/想法 → 单篇浏览/赞同/收藏/转发
  + 流量来源 + 读者画像 → 规则版建议 → 播报稿 + mp3 → 存 KV
- **页面**：播客播放器布局——滚动歌词当前行高亮、真实波形进度条（可拖动）、退 15 / 进 30 秒、
  倍速、播放列表切早报/周报、ⓘ 信息面板（周报数据看板收纳于此）

## 接口一览

| 路径 | 说明 |
|------|------|
| `/` | 早报播放器页 |
| `/creator/` | 周报播放器页 |
| `/api/morning` `/api/creator` | 最新一期数据 JSON |
| `/audio/morning.mp3` `/audio/weekly.mp3` | 最新一期音频 |
| `POST /api/refresh` | 手动触发流水线，头 `X-Refresh-Key`，body `{"which":"all"\|"morning"\|"creator"}` |
| `/api/debug?step=hot\|envinfo\|zhida\|tts\|kv` | 分步诊断（凭证掩码、热榜、直答、TTS、KV） |

## 部署自己的实例

前置：Cloudflare 账号、知乎开放平台 Access Secret、Node.js（npx 即可）。

```powershell
cd src\cloud-worker
npm install
# 1) 建 KV 命名空间，把返回的 id 填进 wrangler.toml 的 YOUR_KV_NAMESPACE_ID
npx wrangler kv namespace create REPORTS
# 2) 存两个 secret（交互输入，不进仓库）
npx wrangler secret put ZHIHU_ACCESS_SECRET   # 知乎开放平台 Access Secret
npx wrangler secret put REFRESH_KEY           # 自定一个手动刷新口令
# 3) 部署
npx wrangler deploy
```

绑自定义域名（可选）：控制台 Workers → 该 Worker → 设置 → 域和路由 → 添加自定义域；
或取消 `wrangler.toml` 末尾 `routes` 注释后重新部署。注意先清掉该主机名旧的 DNS 记录。

手动刷新一次：

```powershell
curl -X POST "https://<你的worker域名>/api/refresh" -H "X-Refresh-Key: <你的口令>" -H "Content-Type: application/json" -d "{\"which\":\"all\"}"
```

## 注意

- 知乎开放平台接口按创作额度计费；直答有限流，代码已做每日缓存 + 降级摘要
- EdgeTTS 免费无 Key，但属非官方通道，音色/可用性可能变动；失败会自动重试并降级 style
- 凭证只存 Worker secrets，仓库与本地配置模板均不含真实钥匙
- 维护者本机另有一份 `wrangler.local.toml`（已 gitignore，含真实 KV id），
  本机部署用 `npx wrangler deploy -c wrangler.local.toml`；clone 用户按上文自建 KV 即可