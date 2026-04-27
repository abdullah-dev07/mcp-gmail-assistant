"""MCP client wrapper.

Spawns the Node MCP server as a short-lived subprocess per call, with the
*caller's* Gmail refresh token injected into its env. The MCP server
(`mcp-server/index.js`) is unchanged — it still reads GOOGLE_REFRESH_TOKEN
from process.env, we just make sure the value we hand it belongs to the
user making the HTTP request.

Starting a Node process per call costs ~200-500 ms. Fine for this project;
if it ever matters, switch to a per-user long-lived ClientSession cached
in a dict keyed by user_id.
"""

from __future__ import annotations

import os

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from config import settings


def _server_params(refresh_token: str) -> StdioServerParameters:
    return StdioServerParameters(
        command="node",
        args=["../mcp-server/index.js"],
        env={
            "GOOGLE_CLIENT_ID": settings.google_client_id,
            "GOOGLE_CLIENT_SECRET": settings.google_client_secret,
            "GOOGLE_REFRESH_TOKEN": refresh_token,
            # Node needs PATH to resolve itself + its deps when spawned.
            "PATH": os.environ.get("PATH", ""),
        },
    )


async def get_mcp_tools(refresh_token: str):
    async with stdio_client(_server_params(refresh_token)) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            return await session.list_tools()


async def call_mcp_tool(
    tool_name: str,
    arguments: dict,
    refresh_token: str,
) -> str:
    async with stdio_client(_server_params(refresh_token)) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return result.content[0].text
