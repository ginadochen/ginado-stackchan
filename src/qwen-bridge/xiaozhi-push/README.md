# xiaozhi-push：主动播报推送接口（参赛定制代码）

给 [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server) 单模块部署新增"主动推送播报"能力：HTTP 调用即可让已连接的 StackChan 朗读任意文本，**绕过 LLM**，直接复用服务端 TTS（默认 EdgeTTS，免费无 Key）。

上游单模块部署只有 OTA/视觉接口，没有推送端点；本补丁复用了上游"来电播报"（`[device_call]`）的发送序列实现。

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/push/devices` | 列出在线设备 device_id（即 MAC） |
| POST | `/push/speak` | `{"device_id":"AA:BB:CC:DD:EE:FF","text":"今天晴，25度"}` → 设备朗读 |

端口为服务端 `http_port`（默认 8003）。局域网内免认证（演示用途，公网部署需自行加鉴权）。

## 部署（4 步）

以 xiaozhi-server 单模块部署为基础（Python 3.10，`pip install -r requirements.txt`，Windows 需 opus.dll 在 PATH）：

1. **复制本目录 `push_handler.py`** → `xiaozhi-server/core/api/push_handler.py`

2. **`core/websocket_server.py`** — 加在线设备注册表：
   - `__init__` 中 `self.config_lock = asyncio.Lock()` 之后加：
     ```python
     self.active_connections = {}
     ```
   - `_handle_connection` 中创建 `handler` 之后、`try: await handler.handle_connection(...)` 处改为：
     ```python
     device_id = websocket.request.headers.get("device-id")
     if device_id:
         self.active_connections[device_id] = handler
     try:
         await handler.handle_connection(websocket)
     except Exception as e:
         self.logger.bind(tag=TAG).error(f"处理连接时出错: {e}")
     finally:
         if device_id and self.active_connections.get(device_id) is handler:
             del self.active_connections[device_id]
     ```
     （finally 里原有的强制关闭连接代码保留，接在注册表清理之后）

3. **`app.py`** — 把 ws_server 传给 HTTP 服务：
   ```python
   ota_server = SimpleHttpServer(config, ws_server)
   ```

4. **`core/http_server.py`** — 接收 ws_server 并注册路由：
   - import：`from core.api.push_handler import PushHandler`
   - `__init__(self, config: dict, ws_server=None)`，加 `self.push_handler = PushHandler(config, ws_server)`
   - `app.add_routes` 列表里加：
     ```python
     web.get("/push/devices", self.push_handler.handle_devices),
     web.post("/push/speak", self.push_handler.handle_post),
     web.options("/push/speak", self.push_handler.handle_options),
     ```

## 设备接入

设备配网时"高级选项"填自定义 OTA：`http://<PC局域网IP>:8003/xiaozhi/ota/`，
设备即连到本地服务器（脱离小智官方云）。`data/.config.yaml` 最小配置：

```yaml
server:
  websocket: ws://<PC局域网IP>:8000/xiaozhi/v1/
selected_module:
  VAD: SileroVAD
  ASR: FunASR
  LLM: OllamaLLM   # 推送演示不需要 LLM；语音对话需配可用模型
  TTS: EdgeTTS
  Memory: nomem
  Intent: nointent
```

## 调用示例

```powershell
curl http://127.0.0.1:8003/push/devices
curl -X POST http://127.0.0.1:8003/push/speak -H "Content-Type: application/json" -d '{"device_id":"AA:BB:CC:DD:EE:FF","text":"你好，我是千问办公派来的天气预报员"}'
```

## 许可

本补丁为参赛项目自有代码（MIT）。上游 xiaozhi-esp32-server 按其仓库许可（MIT）使用。