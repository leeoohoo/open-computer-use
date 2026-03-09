"""
Shared Memory Service — Provides read/write shared memory tools for agents.

Shared memory is stored in the team hub chat's room_settings.team_hub.shared_memory JSONB.
Each agent can read/write key-value pairs that persist across executions and are
visible to all team members.

No new database tables required — everything uses the existing chats table.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.database import DatabaseService

logger = logging.getLogger(__name__)
db_service = DatabaseService()


async def _get_hub_id_for_chat(chat_id: str) -> Optional[str]:
    """Look up the team_hub_id from a chat's schedule config."""
    try:
        chat = await db_service.get_chat(chat_id)
        if not chat:
            return None
        rs = chat.get("room_settings", {})
        if isinstance(rs, str):
            rs = json.loads(rs)
        return rs.get("schedule", {}).get("team_hub_id")
    except Exception as e:
        logger.warning(f"Failed to get hub_id for chat {chat_id}: {e}")
        return None


async def _read_hub_shared_memory(hub_id: str) -> Dict[str, Any]:
    """Read the full shared_memory dict from a hub chat."""
    try:
        hub = await db_service.get_chat(hub_id)
        if not hub:
            return {}
        rs = hub.get("room_settings", {})
        if isinstance(rs, str):
            rs = json.loads(rs)
        return rs.get("team_hub", {}).get("shared_memory", {})
    except Exception:
        return {}


async def _write_hub_shared_memory(
    hub_id: str,
    key: str,
    value: str,
    writer_chat_id: str,
    writer_title: str,
) -> bool:
    """Atomically write a key-value pair to the hub's shared memory."""
    try:
        hub = await db_service.get_chat(hub_id)
        if not hub:
            return False

        rs = hub.get("room_settings", {})
        if isinstance(rs, str):
            rs = json.loads(rs)

        team_hub = rs.setdefault("team_hub", {})
        shared_memory = team_hub.setdefault("shared_memory", {})

        shared_memory[key] = {
            "value": value,
            "written_by": writer_chat_id,
            "written_by_title": writer_title,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        rs["team_hub"] = team_hub

        # Atomic write
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": rs})
                .eq("id", hub_id)
                .execute(),
            ),
            timeout=10,
        )
        return True

    except Exception as e:
        logger.error(f"Failed to write shared memory key '{key}' to hub {hub_id}: {e}")
        return False


async def _delete_hub_shared_memory(hub_id: str, key: str) -> bool:
    """Remove a key from the hub's shared memory."""
    try:
        hub = await db_service.get_chat(hub_id)
        if not hub:
            return False

        rs = hub.get("room_settings", {})
        if isinstance(rs, str):
            rs = json.loads(rs)

        team_hub = rs.get("team_hub", {})
        shared_memory = team_hub.get("shared_memory", {})
        if key not in shared_memory:
            return True  # nothing to delete

        del shared_memory[key]
        team_hub["shared_memory"] = shared_memory
        rs["team_hub"] = team_hub

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": rs})
                .eq("id", hub_id)
                .execute(),
            ),
            timeout=10,
        )
        return True

    except Exception as e:
        logger.error(f"Failed to delete shared memory key '{key}' from hub {hub_id}: {e}")
        return False


def create_shared_memory_tools(chat_id: str, chat_title: str) -> Dict[str, Dict]:
    """Create shared memory tools for an agent.

    Returns a dict of tool_name → tool_dict that can be added to the agent's tool set.
    Each tool has name, description, parameters, and execute keys.
    """

    async def execute_read(key: str) -> Dict:
        hub_id = await _get_hub_id_for_chat(chat_id)
        if not hub_id:
            return {"success": False, "result": "Not part of a team. No shared memory available."}
        memory = await _read_hub_shared_memory(hub_id)
        entry = memory.get(key)
        if not entry:
            return {"success": True, "result": f"No value found for key '{key}'", "value": None}
        return {
            "success": True,
            "value": entry.get("value", ""),
            "written_by": entry.get("written_by_title", "unknown"),
            "updated_at": entry.get("updated_at", ""),
        }

    async def execute_write(key: str, value: str) -> Dict:
        hub_id = await _get_hub_id_for_chat(chat_id)
        if not hub_id:
            return {"success": False, "result": "Not part of a team. Cannot write shared memory."}
        ok = await _write_hub_shared_memory(hub_id, key, value, chat_id, chat_title)
        if ok:
            return {"success": True, "result": f"Stored '{key}' in shared memory."}
        return {"success": False, "result": f"Failed to write '{key}' to shared memory."}

    async def execute_list() -> Dict:
        hub_id = await _get_hub_id_for_chat(chat_id)
        if not hub_id:
            return {"success": False, "result": "Not part of a team. No shared memory available."}
        memory = await _read_hub_shared_memory(hub_id)
        if not memory:
            return {"success": True, "keys": [], "result": "Shared memory is empty."}
        keys_info = []
        for k, v in memory.items():
            keys_info.append({
                "key": k,
                "written_by": v.get("written_by_title", "unknown"),
                "updated_at": v.get("updated_at", ""),
                "preview": str(v.get("value", ""))[:100],
            })
        return {"success": True, "keys": keys_info}

    async def execute_delete(key: str) -> Dict:
        hub_id = await _get_hub_id_for_chat(chat_id)
        if not hub_id:
            return {"success": False, "result": "Not part of a team. Cannot delete shared memory."}
        ok = await _delete_hub_shared_memory(hub_id, key)
        if ok:
            return {"success": True, "result": f"Deleted '{key}' from shared memory."}
        return {"success": False, "result": f"Failed to delete '{key}' from shared memory."}

    return {
        "read_shared_memory": {
            "name": "read_shared_memory",
            "description": (
                "Read a value from your team's shared memory. "
                "Other agents in your team can write here too. "
                "Use this to check for data left by teammates."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The key to read from shared memory",
                    },
                },
                "required": ["key"],
            },
            "execute": execute_read,
        },
        "write_shared_memory": {
            "name": "write_shared_memory",
            "description": (
                "Write a value to your team's shared memory. "
                "Other agents in your team can read this in their future runs. "
                "Use this to share findings, data, or status with teammates."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The key to write (e.g. 'daily_report', 'urgent_tickets')",
                    },
                    "value": {
                        "type": "string",
                        "description": "The value to store (will be available to other team agents)",
                    },
                },
                "required": ["key", "value"],
            },
            "execute": execute_write,
        },
        "list_shared_memory": {
            "name": "list_shared_memory",
            "description": (
                "List all keys currently stored in your team's shared memory, "
                "including who wrote each key and when."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
            "execute": execute_list,
        },
        "delete_shared_memory": {
            "name": "delete_shared_memory",
            "description": "Delete a key from your team's shared memory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The key to delete",
                    },
                },
                "required": ["key"],
            },
            "execute": execute_delete,
        },
    }
