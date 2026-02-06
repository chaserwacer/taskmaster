from __future__ import annotations

import logging
from typing import Any, Protocol

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .settings import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Abstract interface so we can swap Mongo ↔ TinyDB
# ---------------------------------------------------------------------------

class DBBackend(Protocol):
    async def find(self, collection: str, filter: dict, sort: list | None = None) -> list[dict]: ...
    async def find_one(self, collection: str, filter: dict) -> dict | None: ...
    async def insert_one(self, collection: str, doc: dict) -> str: ...
    async def insert_many(self, collection: str, docs: list[dict]) -> list[str]: ...
    async def update_one(self, collection: str, filter: dict, update: dict) -> int: ...
    async def delete_one(self, collection: str, filter: dict) -> int: ...
    async def close(self) -> None: ...


# ---------------------------------------------------------------------------
# Motor (MongoDB) backend
# ---------------------------------------------------------------------------

class MongoBackend:
    def __init__(self, client: AsyncIOMotorClient, db: AsyncIOMotorDatabase):
        self._client = client
        self._db = db

    @staticmethod
    def _convert_ids(filter: dict) -> dict:
        """Convert string _id values to ObjectId for Mongo queries."""
        from bson import ObjectId as BsonObjectId
        if "_id" in filter and isinstance(filter["_id"], str):
            try:
                filter = {**filter, "_id": BsonObjectId(filter["_id"])}
            except Exception:
                pass
        return filter

    async def find(self, collection: str, filter: dict, sort: list | None = None) -> list[dict]:
        filter = self._convert_ids(filter)
        cursor = self._db[collection].find(filter)
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(length=1000)

    async def find_one(self, collection: str, filter: dict) -> dict | None:
        filter = self._convert_ids(filter)
        return await self._db[collection].find_one(filter)

    async def insert_one(self, collection: str, doc: dict) -> str:
        result = await self._db[collection].insert_one(doc)
        return str(result.inserted_id)

    async def insert_many(self, collection: str, docs: list[dict]) -> list[str]:
        result = await self._db[collection].insert_many(docs)
        return [str(oid) for oid in result.inserted_ids]

    async def update_one(self, collection: str, filter: dict, update: dict) -> int:
        filter = self._convert_ids(filter)
        result = await self._db[collection].update_one(filter, update)
        return result.modified_count

    async def delete_one(self, collection: str, filter: dict) -> int:
        filter = self._convert_ids(filter)
        result = await self._db[collection].delete_one(filter)
        return result.deleted_count

    async def close(self) -> None:
        self._client.close()


# ---------------------------------------------------------------------------
# TinyDB fallback backend
# ---------------------------------------------------------------------------

class TinyDBBackend:
    def __init__(self, path: str):
        from tinydb import TinyDB
        self._db = TinyDB(path)
        self._counter = 0

    def _table(self, collection: str):
        return self._db.table(collection)

    def _next_id(self) -> str:
        import uuid
        return uuid.uuid4().hex[:24]

    async def find(self, collection: str, filter: dict, sort: list | None = None) -> list[dict]:
        from tinydb import Query
        table = self._table(collection)
        if not filter:
            docs = table.all()
        else:
            docs = self._query(table, filter)
        if sort:
            for key, direction in reversed(sort):
                docs.sort(key=lambda d, k=key: d.get(k) or "", reverse=(direction == -1))
        return docs

    async def find_one(self, collection: str, filter: dict) -> dict | None:
        results = await self.find(collection, filter)
        return results[0] if results else None

    async def insert_one(self, collection: str, doc: dict) -> str:
        table = self._table(collection)
        if "_id" not in doc:
            doc["_id"] = self._next_id()
        table.insert(doc)
        return str(doc["_id"])

    async def insert_many(self, collection: str, docs: list[dict]) -> list[str]:
        ids = []
        for doc in docs:
            oid = await self.insert_one(collection, doc)
            ids.append(oid)
        return ids

    async def update_one(self, collection: str, filter: dict, update: dict) -> int:
        from tinydb import where
        table = self._table(collection)
        docs = self._query(table, filter)
        if not docs:
            return 0
        doc = docs[0]
        set_fields = update.get("$set", {})
        unset_fields = update.get("$unset", {})
        table.update(
            {**{k: v for k, v in set_fields.items()}, **{k: None for k in unset_fields}},
            where("_id") == doc["_id"],
        )
        return 1

    async def delete_one(self, collection: str, filter: dict) -> int:
        from tinydb import where
        table = self._table(collection)
        docs = self._query(table, filter)
        if not docs:
            return 0
        table.remove(where("_id") == docs[0]["_id"])
        return 1

    def _query(self, table: Any, filter: dict) -> list[dict]:
        """Simple filter matcher supporting _id, $regex, $or, $lte, $gte, $in, etc."""
        all_docs = table.all()
        results = []
        for doc in all_docs:
            if self._matches(doc, filter):
                results.append(doc)
        return results

    def _matches(self, doc: dict, filter: dict) -> bool:
        for key, condition in filter.items():
            if key == "$or":
                if not any(self._matches(doc, sub) for sub in condition):
                    return False
                continue
            if key == "$and":
                if not all(self._matches(doc, sub) for sub in condition):
                    return False
                continue

            val = doc.get(key)
            if isinstance(condition, dict):
                for op, operand in condition.items():
                    if op == "$regex":
                        import re
                        flags = re.IGNORECASE if condition.get("$options") == "i" else 0
                        if val is None or not re.search(operand, val, flags):
                            return False
                    elif op == "$options":
                        continue
                    elif op == "$lte":
                        if val is None or val > operand:
                            return False
                    elif op == "$gte":
                        if val is None or val < operand:
                            return False
                    elif op == "$lt":
                        if val is None or val < operand:
                            return False
                    elif op == "$ne":
                        if val == operand:
                            return False
                    elif op == "$exists":
                        if operand and val is None:
                            return False
                        if not operand and val is not None:
                            return False
                    elif op == "$in":
                        if isinstance(val, list):
                            if not any(v in operand for v in val):
                                return False
                        elif val not in operand:
                            return False
            else:
                if val != condition:
                    return False
        return True

    async def close(self) -> None:
        self._db.close()


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_backend: DBBackend | None = None


async def get_db() -> DBBackend:
    global _backend
    if _backend is not None:
        return _backend

    settings = get_settings()

    if settings.use_tinydb:
        logger.info("Using TinyDB fallback at %s", settings.tinydb_path)
        _backend = TinyDBBackend(settings.tinydb_path)
        return _backend

    # Try MongoDB first
    try:
        client: AsyncIOMotorClient = AsyncIOMotorClient(
            settings.mongo_uri, serverSelectionTimeoutMS=3000
        )
        # Verify connectivity
        await client.admin.command("ping")
        db = client[settings.db_name]
        _backend = MongoBackend(client, db)
        logger.info("Connected to MongoDB at %s", settings.mongo_uri)
        return _backend
    except Exception:
        logger.warning("MongoDB unavailable, falling back to TinyDB")
        _backend = TinyDBBackend(settings.tinydb_path)
        return _backend


async def close_db() -> None:
    global _backend
    if _backend:
        await _backend.close()
        _backend = None
