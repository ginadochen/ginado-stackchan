"""StackChan Qwen bridge - local MCP tools.

Exposes PC-side tools to the xiaozhi.me agent (Qwen LLM) via MCP.
The robot's voice -> xiaozhi cloud (ASR + Qwen) -> tools/call over wss
-> mcp_pipe.py -> this server -> result spoken back by the robot.

MVP tools (no API key needed; Qwen runs on xiaozhi cloud):
  - get_time: current PC time
  - get_project_summary: read the hackathon project README

Phase 3 (planned): qwenwork_task / qwenwork_check_results tools that
delegate office tasks to QwenWork. See docs/architecture.md.
"""

from datetime import datetime
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("stackchan-qwen-bridge")

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@mcp.tool()
def get_time() -> str:
    """Return the current date and time on the user's PC.
    Use when the user asks what time or date it is."""
    return datetime.now().strftime("%Y年%m月%d日 %H点%M分")


@mcp.tool()
def get_project_summary() -> str:
    """Read the StackChan hackathon project README and return its opening.
    Use when the user asks about their project, e.g. '我的项目是什么'."""
    readme = PROJECT_ROOT / "README.md"
    if not readme.exists():
        return "项目 README 还没写。"
    text = readme.read_text(encoding="utf-8")
    return text[:600]


if __name__ == "__main__":
    mcp.run(transport="stdio")