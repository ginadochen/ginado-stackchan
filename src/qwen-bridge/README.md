# StackChan Qwen Bridge

把 StackChan 桌面机器人接到千问/千问办公的桥接服务（黑客松参赛核心代码）。

## 链路

```
语音 → StackChan(xiaozhi固件) → 小智云(ASR + Qwen)
  → MCP tools/call (wss) → mcp_pipe.py → server.py(本地工具)
  → 结果原路返回 → 机器人语音播报
```

## 运行

```powershell
pip install -r requirements.txt
copy .env.example .env   # 填入 xiaozhi.me 控制台获取的 MCP 接入点
python mcp_pipe.py
```

看到 `Successfully connected to WebSocket server` 即桥接上线；
对机器人说话触发工具调用（如"现在几点了"）。

## 文件

- `mcp_pipe.py` — wss ↔ stdio 管道，断线自动重连（改编自 stackchan-claude-bridge，MIT）
- `server.py` — FastMCP 工具服务（MVP：get_time / get_project_summary）
- `.env` — MCP 接入点（含 token，已 gitignore，勿提交）

## 致谢

管道实现参考 [heavenchenggong/stackchan-claude-bridge](https://github.com/heavenchenggong/stackchan-claude-bridge)（MIT License）。