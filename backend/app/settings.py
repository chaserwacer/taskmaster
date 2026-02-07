from __future__ import annotations

"""Application configuration using pydantic-settings.

Expose typed settings with reasonable defaults sourced from environment
variables. Use `get_settings()` to obtain a cached Settings instance.
"""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name: str = os.getenv("DB_NAME", "taskcopilot")
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "phi4-mini:3.8b")

    # TinyDB fallback when MongoDB is unavailable
    use_tinydb: bool = os.getenv("USE_TINYDB", "false").lower() == "true"
    tinydb_path: str = os.getenv("TINYDB_PATH", "taskcopilot_db.json")

    model_config = {"env_prefix": "", "case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    return Settings()
