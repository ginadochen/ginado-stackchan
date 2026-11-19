# 方案架构

> 一句话：让 StackChan 桌面机器人用千问当大脑——既能语音指挥电脑干活，也能被千问办公主动指挥。

## 总体架构（双通道）

**通道 A：语音 → 千问 → 电脑工具（机器人主动问）**

```
你说话 → StackChan(xiaozhi固件) → 小智云(ASR + Qwen)
  → MCP tools/call(wss) → src/qwen-bridge/mcp_pipe.py → server.py(本地工具)
  → 结果原路返回 → Qwen 组织语言 → TTS → 机器人播报
```

**通道 B：千问办公 → 机器人（主动推送，参赛核心定制）**

```
千问办公(QwenWork) 查天气/派任务
  → HTTP POST /push/speak（自研补丁，见 src/qwen-bridge/xiaozhi-push/）
  → 本地 xiaozhi-server（PC 部署，EdgeTTS 免费合成）
  → WebSocket 音频流 → 机器人主动朗读 + 表情/舵机动作
```

通道 B 的设备通过配网"高级选项"自定义 OTA 地址指向 PC 服务器
（`http://<PC_IP>:8003/xiaozhi/ota/`），脱离小智官方云，全链路本地可控。

## 技术选型

| 模块 | 选型 | 理由 |
|------|------|------|
| 硬件 | M5Stack StackChan K151（CoreS3） | 官方整机，麦克风/扬声器/屏幕/双舵机齐全 |
| 固件 | 社区 stackchan-xiaozhi-firmware v1.0.0 | xiaozhi 系开源固件，预编译可刷，修了舵机 MCP/休眠唤醒 bug |
| 语音+大脑 | 小智云内置 Qwen 模型 | 免自建 ASR/TTS，免 API Key 即可跑通千问对话 |
| 工具扩展 | 小智 MCP 接入点 + 本地 FastMCP 桥接 | 标准 MCP 协议，Qwen 自主决定何时调用本地工具 |
| 桥接管道 | 改编自 stackchan-claude-bridge（MIT） | 社区已验证的 wss↔stdio 方案，含断线重连 |
| 推送服务端 | xiaozhi-esp32-server 单模块 + 自研 push 补丁 | 本地部署免数据库；EdgeTTS 免费无 Key；补丁复用上游来电播报序列，绕过 LLM 直接合成 |
| 主动控制 | 自研 /push/speak、/push/devices 接口 | 上游无此能力，为本项目核心创新点 |

## 数据流示例

"现在几点了" → ASR → Qwen 看到 `get_time` 工具 → tools/call →
桥接 → server.py 读 PC 时间 → 返回 → Qwen 组织口语 → TTS 播报。

## 定制部分与上游边界

- **上游（仅引用）**：xiaozhi 固件、小智云服务、stackchan-claude-bridge 管道思路、xiaozhi-esp32-server 服务端
- **本项目自有（src/）**：
  - `qwen-bridge/`：MCP 工具服务与管道适配（通道 A）
  - `qwen-bridge/xiaozhi-push/`：服务端主动播报补丁 push_handler.py + 接线说明（通道 B，核心创新）
- 固件 bin、上游源码均在 `.local/`（gitignore），不随仓库分发；补丁以源码+部署说明形式入库

## 路线图

- [x] Phase 1：换固件 + 配网 + 千问语音对话（小智云内置 Qwen）
- [x] Phase 2：MCP 桥接 MVP（get_time / get_project_summary），本地工具调用验证通过
- [x] Phase 3a：本地 xiaozhi-server 部署 + 自研主动播报补丁（/push/speak 已验证）
- [ ] Phase 3b：设备指向本地服务器 + 推送演示（天气播报等）
- [ ] Phase 3c：千问办公任务派发（qwenwork_task / check_results），入口待调研
- [ ] Phase 4：演示视频 + 仓库 README 门面

注：通道 A（小智云）与通道 B（本地服务器）设备同一时间只能连一个；
演示以通道 B 为主，通道 A 代码保留可切换。

## 许可与致谢

- 自有代码：MIT（见 LICENSE）
- 固件上游：78/xiaozhi-esp32 及 heavenchenggong fork（按其仓库许可）
- 桥接参考：heavenchenggong/stackchan-claude-bridge（MIT）
- 服务端上游：xinnan-tech/xiaozhi-esp32-server（MIT）
- 语音合成思路参考：rany2/edge-tts 与 linshenkx/edge-tts-openai-cf-worker（EdgeTTS 在 Cloudflare Workers 上的开源实现）
- 硬件：M5Stack StackChan