import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global _client, _db
    settings = get_settings()
    kwargs: dict = {"serverSelectionTimeoutMS": 10000}
    # Atlas / any TLS connection: use certifi's CA bundle to avoid
    # "certificate verify failed" errors on machines with an outdated CA store.
    if "mongodb+srv" in settings.mongodb_uri or "tls=true" in settings.mongodb_uri:
        kwargs["tlsCAFile"] = certifi.where()
    _client = AsyncIOMotorClient(settings.mongodb_uri, **kwargs)
    _db = _client[settings.mongodb_db]
    # Helpful indexes
    await _db.users.create_index("email", unique=True)
    await _db.users.create_index("login_code", unique=True, sparse=True)
    await _db.entries.create_index([("user_id", 1), ("date", 1)])


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized. Did the app start up correctly?")
    return _db
