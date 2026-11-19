# ginado-stackchan

> StackChan 桌面机器人 × 千问大脑 × 知乎语音早报 · 知乎黑客松参赛作品

基于 M5Stack StackChan（K151，CoreS3 主控）的定制开发：让桌面机器人用千问当大脑，
既能语音指挥电脑干活，也能被千问办公主动指挥开口播报；附带一套完全运行在
Cloudflare Worker 上的知乎语音早报 / 创作周报服务。

## 功能亮点

- **通道 A · 语音指挥电脑**：机器人语音 → 小智云（ASR + Qwen）→ MCP 工具调用 →
  本地桥接服务执行（查时间、读项目摘要等）→ 结果原路返回 → 机器人语音答复
- **通道 B · 机器人主动播报**（核心定制）：自建 xiaozhi-server + 自研 `/push/speak`
  补丁，千问办公可主动派任务让机器人朗读（天气、提醒、周报），EdgeTTS 免费合成
- **知乎语音早报 / 创作周报**：Cloudflare Worker 拉知乎开放平台热榜与创作数据 →
  直答总结 / 规则建议 → Worker 内 EdgeTTS 合成中文语音 → 播客播放器风格网页
  （滚动歌词高亮、波形进度条、退 15 / 进 30 秒），每天 07:30 / 每周一 08:00 自动更新，
  车机浏览器友好
- **凭证零入库**：真实配置一律 gitignore，仓库只含占位模板与源码

## 硬件清单

| 部件 | 型号 | 说明 |
|------|------|------|
| 整机 | M5Stack StackChan (K151) | CoreS3 主控，ESP32-S3，16MB Flash / 8MB PSRAM |
| 舵机 | 内置反馈舵机 ×2 | 水平 360° 连续旋转 / 垂直 90° |
| 扩展 | （按需补充） | M5Stack Unit 生态扩展 |

## 快速开始

### 机器人线

1. 装配与烧录：见 [docs/setup.md](docs/setup.md)
2. 舵机与传感器校准：见 [docs/calibration.md](docs/calibration.md)
3. 复制 `config.example.json` 为 `config.json`，填入自己的 WiFi / API Key
   （`config.json` 已被 gitignore，不会提交）
4. 启动 MCP 桥接：见 [src/qwen-bridge/README.md](src/qwen-bridge/README.md)
5. 主动播报补丁部署：见 [src/qwen-bridge/xiaozhi-push/README.md](src/qwen-bridge/xiaozhi-push/README.md)

### 语音早报线

部署自己的 Worker 实例：见 [src/cloud-worker/README.md](src/cloud-worker/README.md)。
维护者的在线实例：<https://zhihu.ginado.ai>（早报）与 <https://zhihu.ginado.ai/creator/>（周报）。

## 方案架构

见 [docs/architecture.md](docs/architecture.md)（双通道数据流、技术选型、定制与上游边界）。

## 目录结构

```
├── docs/                  # 文档：装配烧录、校准、架构说明
├── src/
│   ├── qwen-bridge/       # 通道 A：MCP 工具服务与 wss↔stdio 桥接
│   │   └── xiaozhi-push/  # 通道 B：服务端主动播报补丁（核心创新）
│   ├── cloud-worker/      # 知乎语音早报/周报 Cloudflare Worker
│   ├── morning-news/      # 早报本地脚本版（热榜→直答→播报/稿件）
│   └── creator-analytics/ # 创作数据取数脚本（知乎官方 CLI）
├── tools/                 # 烧录、串口调试脚本（待补）
├── assets/                # 自定义表情、语音素材（待补）
├── config.example.json    # 配置模板（占位符，无真实密钥）
└── .local/                # 本地参考资料（gitignore，不提交）
```

## 上游项目与致谢

- 官方固件/App/服务端源码：[m5stack/StackChan](https://github.com/m5stack/StackChan)
- 板级支持包：[m5stack/StackChan-BSP](https://github.com/m5stack/StackChan-BSP)
- 社区固件：[heavenchenggong/stackchan-xiaozhi-firmware](https://github.com/heavenchenggong/stackchan-xiaozhi-firmware)
- 社区项目：[meganetaaan/stack-chan](https://github.com/meganetaaan/stack-chan)
- 桥接管道参考：heavenchenggong/stackchan-claude-bridge（MIT）
- 服务端上游：[xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server)（MIT）
- 语音合成思路参考：[rany2/edge-tts](https://github.com/rany2/edge-tts) 与
  [linshenkx/edge-tts-openai-cf-worker](https://github.com/linshenkx/edge-tts-openai-cf-worker)
  （EdgeTTS 在 Cloudflare Workers 上的开源实现）
- 产品文档：M5Stack 官方 StackChan 文档页（英 / 日 / 中）

本仓库仅包含自行开发的定制代码与文档；官方固件源码与预编译二进制不随仓库分发，
许可条款以各上游仓库为准。

## 许可证

本项目自有代码采用 [MIT License](LICENSE)（Copyright (c) 2026 ginadochen）。
引用的上游项目遵循其各自许可证。