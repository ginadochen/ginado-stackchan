"""主动播报推送接口（StackChan 黑客松定制代码）。

给 xiaozhi-esp32-server 单模块部署新增 HTTP 接口，让已连接设备
主动朗读任意文本：绕过 LLM，直接复用服务端 TTS（默认 EdgeTTS，免费）。

复用了上游"来电播报"（[device_call]）的发送序列：
send_stt_message -> tts_text_queue(FIRST/TEXT/LAST) -> 后台线程合成 Opus 音频 -> 设备播放。

接口：
  POST /push/speak   {"device_id": "<MAC>", "text": "要播报的话"}
  GET  /push/devices 列出当前在线设备 device_id

部署方法见同目录 README.md。本文件正本在参赛仓库 src/qwen-bridge/xiaozhi-push/，
部署时复制到 xiaozhi-server/core/api/push_handler.py。
"""

import asyncio
import time
import uuid

from aiohttp import web
from config.logger import setup_logging
from core.handle.abortHandle import handleAbortMessage
from core.handle.sendAudioHandle import send_stt_message
from core.providers.tts.dto.dto import ContentType, SentenceType, TTSMessageDTO

TAG = __name__


class PushHandler:
    def __init__(self, config: dict, ws_server):
        self.config = config
        self.ws_server = ws_server
        self.logger = setup_logging()

    async def handle_devices(self, request):
        devices = list(self.ws_server.active_connections.keys()) if self.ws_server else []
        return web.json_response({"ok": True, "devices": devices})

    async def handle_post(self, request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"ok": False, "error": "invalid json"}, status=400)

        device_id = data.get("device_id")
        text = (data.get("text") or "").strip()
        if not device_id or not text:
            return web.json_response(
                {"ok": False, "error": "device_id and text required"}, status=400
            )

        conn = (
            self.ws_server.active_connections.get(device_id)
            if self.ws_server
            else None
        )
        if conn is None:
            return web.json_response(
                {"ok": False, "error": "device offline"}, status=404
            )

        # 等待 TTS 初始化（连接刚建立时可能还没就绪）
        start = time.time()
        while time.time() - start < 3:
            if conn.tts:
                break
            await asyncio.sleep(0.1)
        if not conn.tts:
            return web.json_response(
                {"ok": False, "error": "tts not ready"}, status=503
            )

        # 设备正在说话时先打断
        if conn.client_is_speaking:
            await handleAbortMessage(conn)
        conn.client_abort = False

        # 来电播报同款序列：stt + tts start -> 合成 -> sentence_start -> 音频帧 -> stop
        conn.sentence_id = uuid.uuid4().hex
        await send_stt_message(conn, text)
        conn.tts.store_tts_text(conn.sentence_id, text)
        conn.tts.tts_text_queue.put(
            TTSMessageDTO(
                sentence_id=conn.sentence_id,
                sentence_type=SentenceType.FIRST,
                content_type=ContentType.ACTION,
            )
        )
        conn.tts.tts_one_sentence(conn, ContentType.TEXT, content_detail=text)
        conn.tts.tts_text_queue.put(
            TTSMessageDTO(
                sentence_id=conn.sentence_id,
                sentence_type=SentenceType.LAST,
                content_type=ContentType.ACTION,
            )
        )

        self.logger.bind(tag=TAG).info(f"推送播报 -> {device_id}: {text[:50]}")
        return web.json_response({"ok": True})

    async def handle_options(self, request):
        return web.Response(
            status=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )