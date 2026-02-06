from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from .db import get_db
from .models import (
    ChatCommitRequest,
    ChatCommitResponse,
    ChatParseRequest,
    ChatParseResponse,
    Source,
    TaskResponse,
    ScheduleType,
)
from .ollama_client import parse_tasks

router = APIRouter(prefix="/chat", tags=["chat"])

COLLECTION = "tasks"


def _doc_to_response(doc: dict) -> TaskResponse:
    schedule = ScheduleType.scheduled if doc.get("due_at") else ScheduleType.unscheduled
    return TaskResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc.get("description"),
        notes=doc.get("notes"),
        tags=doc.get("tags", []),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        due_at=doc.get("due_at"),
        priority=doc.get("priority", "medium"),
        is_complete=doc.get("is_complete", False),
        source=doc.get("source", "manual"),
        raw_input=doc.get("raw_input"),
        schedule_type=schedule,
    )


@router.post("/parse", response_model=ChatParseResponse)
async def chat_parse(body: ChatParseRequest):
    proposals, warnings = await parse_tasks(body.text)
    return ChatParseResponse(proposals=proposals, warnings=warnings)


@router.post("/commit", response_model=ChatCommitResponse)
async def chat_commit(body: ChatCommitRequest):
    db = await get_db()
    now = datetime.now(timezone.utc)

    docs = []
    for p in body.proposals:
        doc = {
            "name": p.name,
            "description": p.description,
            "notes": p.notes,
            "tags": p.tags,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": p.due_at,
            "priority": p.priority.value,
            "is_complete": p.is_complete,
            "source": Source.chat.value,
            "raw_input": body.raw_input,
        }
        docs.append(doc)

    if not docs:
        return ChatCommitResponse(created=[])

    ids = await db.insert_many(COLLECTION, docs)
    for doc, oid in zip(docs, ids):
        doc["_id"] = oid

    return ChatCommitResponse(created=[_doc_to_response(d) for d in docs])
