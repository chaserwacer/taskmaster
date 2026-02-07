from __future__ import annotations

"""Task CRUD HTTP routes.

Provides endpoints for listing, creating, updating and deleting tasks. The
list endpoint supports simple filtering and sorting query parameters.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from .db import get_db
from .models import (
    Priority,
    ScheduleType,
    Source,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

COLLECTION = "tasks"


def _doc_to_response(doc: dict) -> TaskResponse:
    """Convert a raw DB document to a TaskResponse."""
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


def _make_id_filter(task_id: str) -> dict:
    """Create an _id filter. The DB backend handles type conversion."""
    return {"_id": task_id}


# ---------- LIST / SEARCH ----------

@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    q: Optional[str] = Query(None, description="Search name/description/notes"),
    tag: Optional[str] = Query(None),
    is_complete: Optional[bool] = Query(None),
    priority: Optional[Priority] = Query(None),
    due: Optional[str] = Query(None, pattern="^(overdue|today|upcoming|none)$"),
    sort: Optional[str] = Query(None, pattern="^(due_at|created_at|priority)$"),
):
    db = await get_db()
    filter: dict = {}

    if q:
        regex = {"$regex": q, "$options": "i"}
        filter["$or"] = [
            {"name": regex},
            {"description": regex},
            {"notes": regex},
        ]

    if tag:
        filter["tags"] = {"$in": [tag.lower().strip()]}

    if is_complete is not None:
        filter["is_complete"] = is_complete

    if priority:
        filter["priority"] = priority.value

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    if due == "overdue":
        filter["due_at"] = {"$lt": now.isoformat(), "$ne": None}
        filter["is_complete"] = False
    elif due == "today":
        filter["due_at"] = {"$gte": today_start.isoformat(), "$lte": today_end.isoformat()}
    elif due == "upcoming":
        filter["due_at"] = {"$gte": now.isoformat()}
    elif due == "none":
        filter["$or"] = filter.get("$or", [])
        # due_at is None for unscheduled
        filter["due_at"] = None

    sort_spec = None
    if sort == "due_at":
        sort_spec = [("due_at", 1)]
    elif sort == "created_at":
        sort_spec = [("created_at", -1)]
    elif sort == "priority":
        sort_spec = [("priority", 1)]
    else:
        sort_spec = [("created_at", -1)]

    docs = await db.find(COLLECTION, filter, sort=sort_spec)
    return [_doc_to_response(d) for d in docs]


# ---------- CREATE ----------

@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(body: TaskCreate):
    db = await get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "name": body.name,
        "description": body.description,
        "notes": body.notes,
        "tags": body.tags,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "due_at": body.due_at.isoformat() if body.due_at else None,
        "priority": body.priority.value,
        "is_complete": body.is_complete,
        "source": body.source.value,
        "raw_input": body.raw_input,
    }
    oid = await db.insert_one(COLLECTION, doc)
    doc["_id"] = oid
    return _doc_to_response(doc)


# ---------- GET ONE ----------

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    db = await get_db()
    doc = await db.find_one(COLLECTION, _make_id_filter(task_id))
    if not doc:
        raise HTTPException(404, "Task not found")
    return _doc_to_response(doc)


# ---------- UPDATE ----------

@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, body: TaskUpdate):
    db = await get_db()
    update_fields: dict = {}
    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        if key == "due_at" and val is not None:
            update_fields[key] = val.isoformat() if isinstance(val, datetime) else val
        elif key == "priority" and val is not None:
            update_fields[key] = val.value if hasattr(val, "value") else val
        else:
            update_fields[key] = val

    if not update_fields:
        raise HTTPException(400, "No fields to update")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    count = await db.update_one(COLLECTION, _make_id_filter(task_id), {"$set": update_fields})
    if count == 0:
        # Check if the doc exists at all
        existing = await db.find_one(COLLECTION, _make_id_filter(task_id))
        if not existing:
            raise HTTPException(404, "Task not found")

    doc = await db.find_one(COLLECTION, _make_id_filter(task_id))
    return _doc_to_response(doc)


# ---------- DELETE ----------

@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str):
    db = await get_db()
    count = await db.delete_one(COLLECTION, _make_id_filter(task_id))
    if count == 0:
        raise HTTPException(404, "Task not found")
    return None
