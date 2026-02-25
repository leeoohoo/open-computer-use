"""
Chat CRUD API endpoints.

Provides create/list/get/delete operations for chats and messages.
Used by the Electron desktop app (which talks directly to the Python backend)
to persist chats in Supabase, keeping them in sync with the web app.
"""

import json
import logging
import re
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.services.database import DatabaseService
from app.services.auth import validate_user, get_verified_user_id

logger = logging.getLogger(__name__)
router = APIRouter()
db_service = DatabaseService()


class CreateChatRequest(BaseModel):
    user_id: str
    title: str = "New Task"
    model: str = "default"
    # Source metadata — identifies where the chat was created
    source: Optional[str] = None          # "electron" | "web" | None
    machine_id: Optional[str] = None      # Electron machine UUID
    machine_name: Optional[str] = None    # e.g. "My Computer (Electron)"
    platform: Optional[str] = None        # "win32" | "darwin" | "linux"


class UpdateChatRequest(BaseModel):
    title: Optional[str] = None


def _clean_preview(content: str) -> Optional[str]:
    """Strip CUA/task markers from message content for a clean preview."""
    preview = content
    preview = re.sub(r"<cua-section[^>]*>", "", preview)
    preview = re.sub(r"</cua-section>", "", preview)
    preview = re.sub(r"\[TASK_PLAN_START\][\s\S]*?\[TASK_PLAN_END\]", "", preview)
    preview = re.sub(r"\[REASONING_START\][\s\S]*?\[REASONING_END\]", "", preview)
    preview = re.sub(r"\[THINKING_START\][\s\S]*?\[THINKING_END\]", "", preview)
    preview = re.sub(r"\[TASK_STATUS:[^\]]+\]", "", preview)
    preview = re.sub(r"```[\s\S]*?```", "", preview)
    preview = re.sub(r"[#*_~\[\]()]", "", preview)
    preview = re.sub(r"\s+", " ", preview).strip()
    if len(preview) > 100:
        preview = preview[:100].strip() + "..."
    if preview and preview != "...":
        return preview
    return None


@router.post("/create")
async def create_chat(req: CreateChatRequest, user_id: str = Depends(get_verified_user_id)):
    """Create a new chat in the database. Returns the chat with its Supabase UUID."""
    # Build room_settings with source metadata
    room_settings = {}
    if req.source:
        room_settings["source"] = req.source
    if req.machine_id:
        room_settings["machine_id"] = req.machine_id
    if req.machine_name:
        room_settings["machine_name"] = req.machine_name
    if req.platform:
        room_settings["platform"] = req.platform

    chat_data = {
        "user_id": user_id,
        "title": req.title,
        "model": req.model,
        "collaborative": False,
        "room_settings": room_settings if room_settings else None,
    }

    result = await db_service.create_chat(chat_data)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create chat")

    return {"chat": result}


@router.get("/list")
async def list_chats(
    user_id: str = Depends(get_verified_user_id),
    machine_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    """List chats for a user. Optionally filter by machine_id or source."""

    if not db_service.client:
        return {"chats": []}

    try:
        response = (
            db_service.client.table("chats")
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(50)
            .execute()
        )
        chats = response.data or []

        # Filter by machine_id or source if requested
        # (room_settings is a JSON column, we filter client-side)
        if machine_id or source:
            filtered = []
            for chat in chats:
                rs = chat.get("room_settings")
                if isinstance(rs, str):
                    try:
                        rs = json.loads(rs)
                    except Exception:
                        rs = {}
                rs = rs or {}
                if machine_id and rs.get("machine_id") != machine_id:
                    continue
                if source and rs.get("source") != source:
                    continue
                filtered.append(chat)
            chats = filtered

        # Fetch last assistant message preview for each chat
        for chat in chats:
            try:
                msg_resp = (
                    db_service.client.table("messages")
                    .select("content")
                    .eq("chat_id", chat["id"])
                    .eq("role", "assistant")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if msg_resp.data and msg_resp.data[0].get("content"):
                    preview = _clean_preview(msg_resp.data[0]["content"])
                    if preview:
                        chat["last_message_preview"] = preview
            except Exception:
                pass

        return {"chats": chats}

    except Exception as e:
        logger.error(f"Failed to list chats: {e}")
        return {"chats": []}


async def _get_chat_for_user(chat_id: str, user_id: str) -> dict:
    """Fetch a chat and verify it belongs to the authenticated user."""
    result = await db_service.get_chat(chat_id)
    if not result:
        raise HTTPException(status_code=404, detail="Chat not found")
    if result.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Chat not found")
    return result


@router.get("/{chat_id}")
async def get_chat(chat_id: str, user_id: str = Depends(get_verified_user_id)):
    """Get a single chat by ID."""
    result = await _get_chat_for_user(chat_id, user_id)
    return {"chat": result}


@router.get("/{chat_id}/messages")
async def get_chat_messages(chat_id: str, limit: int = Query(100), user_id: str = Depends(get_verified_user_id)):
    """Get messages for a chat."""
    await _get_chat_for_user(chat_id, user_id)
    messages = await db_service.get_chat_messages(chat_id, limit=limit)
    return {"messages": messages}


@router.patch("/{chat_id}")
async def update_chat(chat_id: str, req: UpdateChatRequest, user_id: str = Depends(get_verified_user_id)):
    """Update chat title."""
    await _get_chat_for_user(chat_id, user_id)

    if not db_service.client:
        raise HTTPException(status_code=500, detail="Database not available")

    try:
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if req.title is not None:
            update_data["title"] = req.title

        db_service.client.table("chats").update(update_data).eq("id", chat_id).eq("user_id", user_id).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to update chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to update chat")


@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, user_id: str = Depends(get_verified_user_id)):
    """Delete a chat and its messages."""
    await _get_chat_for_user(chat_id, user_id)

    if not db_service.client:
        raise HTTPException(status_code=500, detail="Database not available")

    try:
        # Delete messages first (FK constraint)
        db_service.client.table("messages").delete().eq("chat_id", chat_id).execute()
        # Delete the chat — scope to user_id for defense-in-depth
        db_service.client.table("chats").delete().eq("id", chat_id).eq("user_id", user_id).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to delete chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete chat")
