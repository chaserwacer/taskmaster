from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class ScheduleType(str, Enum):
    scheduled = "scheduled"
    unscheduled = "unscheduled"


class Source(str, Enum):
    manual = "manual"
    chat = "chat"


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    due_at: Optional[datetime] = None
    priority: Priority = Priority.medium
    is_complete: bool = False
    source: Source = Source.manual
    raw_input: Optional[str] = None

    @field_validator("tags", mode="before")
    @classmethod
    def normalise_tags(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for t in v:
            normed = t.strip().lower()
            if normed and normed not in seen:
                seen.add(normed)
                out.append(normed)
        return out


class TaskUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    due_at: Optional[datetime] = None
    priority: Optional[Priority] = None
    is_complete: Optional[bool] = None

    @field_validator("tags", mode="before")
    @classmethod
    def normalise_tags(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        seen: set[str] = set()
        out: list[str] = []
        for t in v:
            normed = t.strip().lower()
            if normed and normed not in seen:
                seen.add(normed)
                out.append(normed)
        return out


class TaskResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    due_at: Optional[datetime] = None
    priority: Priority = Priority.medium
    is_complete: bool = False
    source: Source = Source.manual
    raw_input: Optional[str] = None
    schedule_type: ScheduleType = ScheduleType.unscheduled


# ---------------------------------------------------------------------------
# Chat / Proposal
# ---------------------------------------------------------------------------

class TaskProposal(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = None
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list, max_length=8)
    due_at: Optional[str] = None  # ISO string or null
    priority: Priority = Priority.medium
    is_complete: bool = False
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    assumptions: list[str] = Field(default_factory=list)
    requires_user_confirmation: bool = True

    @field_validator("tags", mode="before")
    @classmethod
    def normalise_tags(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for t in v:
            normed = t.strip().lower()
            if normed and normed not in seen:
                seen.add(normed)
                out.append(normed)
        return out[:8]


class ChatParseRequest(BaseModel):
    text: str = Field(..., min_length=1)


class ChatParseResponse(BaseModel):
    proposals: list[TaskProposal] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ChatCommitRequest(BaseModel):
    proposals: list[TaskProposal]
    raw_input: Optional[str] = None


class ChatCommitResponse(BaseModel):
    created: list[TaskResponse] = Field(default_factory=list)
