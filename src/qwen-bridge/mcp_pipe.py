"""MCP stdio <-> WebSocket pipe for StackChan xiaozhi bridge.

Connects to the xiaozhi.me MCP endpoint (MCP_ENDPOINT in .env) and pipes
JSON-RPC messages to/from a local FastMCP server process (server.py).
Auto-reconnects with exponential backoff.

Adapted from heavenchenggong/stackchan-claude-bridge (MIT License).
"""

import asyncio
import logging
import os
import subprocess
import sys

import websockets
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("MCP_PIPE")

INITIAL_BACKOFF = 1
MAX_BACKOFF = 60


async def pipe_ws_to_proc(ws, proc):
    while True:
        message = await ws.recv()
        if isinstance(message, bytes):
            message = message.decode("utf-8")
        proc.stdin.write(message + "\n")
        proc.stdin.flush()


async def pipe_proc_to_ws(proc, ws):
    while True:
        data = await asyncio.to_thread(proc.stdout.readline)
        if not data:
            break
        await ws.send(data)


async def pipe_stderr(proc):
    while True:
        data = await asyncio.to_thread(proc.stderr.readline)
        if not data:
            break
        sys.stderr.write(data)
        sys.stderr.flush()


async def run_once(uri, server_script):
    logger.info("Connecting to WebSocket server...")
    async with websockets.connect(uri) as ws:
        logger.info("Successfully connected to WebSocket server")
        proc = subprocess.Popen(
            [sys.executable, server_script],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            text=True,
        )
        logger.info("Started server process: %s", server_script)
        try:
            await asyncio.gather(
                pipe_ws_to_proc(ws, proc),
                pipe_proc_to_ws(proc, ws),
                pipe_stderr(proc),
            )
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


async def main():
    uri = os.environ.get("MCP_ENDPOINT")
    if not uri:
        logger.error("Please set MCP_ENDPOINT in .env")
        sys.exit(1)
    server_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")

    backoff = INITIAL_BACKOFF
    attempt = 0
    while True:
        try:
            await run_once(uri, server_script)
        except Exception as e:
            attempt += 1
            logger.warning("Connection closed (attempt %d): %s", attempt, e)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted, shutting down")