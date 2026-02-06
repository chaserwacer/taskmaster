from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import close_db, get_db
from .routes_chat import router as chat_router
from .routes_tasks import router as tasks_router
from .seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_db()
    logger.info("Database connected")

    # Optional: seed demo data when SEED_DATA=true
    if os.getenv("SEED_DATA", "false").lower() == "true":
        count = await seed_demo_data()
        if count:
            logger.info("Seeded %d demo tasks", count)

    yield

    # Shutdown
    await close_db()
    logger.info("Database connection closed")


app = FastAPI(
    title="Task Copilot",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(chat_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
