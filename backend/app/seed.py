"""Seed the database with demo data."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .db import get_db

COLLECTION = "tasks"


async def seed_demo_data() -> int:
    db = await get_db()

    # Check if data already exists
    existing = await db.find(COLLECTION, {})
    if existing:
        return 0

    now = datetime.now(timezone.utc)

    tasks = [
        {
            "name": "Buy groceries",
            "description": "Weekly grocery run",
            "notes": "Check the fridge first",
            "tags": ["shopping", "errands"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": (now + timedelta(days=1)).isoformat(),
            "priority": "medium",
            "is_complete": False,
            "source": "manual",
            "raw_input": None,
        },
        {
            "name": "Finish project report",
            "description": "Q4 summary report for the team",
            "notes": None,
            "tags": ["work", "writing"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": (now + timedelta(days=3)).isoformat(),
            "priority": "high",
            "is_complete": False,
            "source": "manual",
            "raw_input": None,
        },
        {
            "name": "Schedule dentist appointment",
            "description": None,
            "notes": "Dr. Smith's office: 555-0123",
            "tags": ["health", "errands"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": (now + timedelta(days=7)).isoformat(),
            "priority": "low",
            "is_complete": False,
            "source": "manual",
            "raw_input": None,
        },
        {
            "name": "Fix login page bug",
            "description": "Users report a flash of unstyled content on the login page",
            "notes": "Check CSS loading order",
            "tags": ["work", "bug", "frontend"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": (now + timedelta(hours=6)).isoformat(),
            "priority": "urgent",
            "is_complete": False,
            "source": "manual",
            "raw_input": None,
        },
        {
            "name": "Read 'Designing Data-Intensive Applications'",
            "description": "Chapter 5-8",
            "notes": None,
            "tags": ["reading", "learning"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": None,
            "priority": "low",
            "is_complete": False,
            "source": "manual",
            "raw_input": None,
        },
        {
            "name": "Go for a 5k run",
            "description": None,
            "notes": "Trail by the river",
            "tags": ["fitness", "health"],
            "created_at": (now - timedelta(days=1)).isoformat(),
            "updated_at": (now - timedelta(days=1)).isoformat(),
            "due_at": (now - timedelta(hours=12)).isoformat(),
            "priority": "medium",
            "is_complete": True,
            "source": "manual",
            "raw_input": None,
        },
        {
            "name": "Prepare team standup notes",
            "description": "Monday standup highlights",
            "notes": None,
            "tags": ["work"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": (now + timedelta(days=2)).isoformat(),
            "priority": "medium",
            "is_complete": False,
            "source": "chat",
            "raw_input": "remind me to prepare standup notes for monday",
        },
        {
            "name": "Water the plants",
            "description": None,
            "notes": None,
            "tags": ["home"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "due_at": None,
            "priority": "low",
            "is_complete": False,
            "source": "manual",
            "raw_input": None,
        },
    ]

    ids = await db.insert_many(COLLECTION, tasks)
    return len(ids)
