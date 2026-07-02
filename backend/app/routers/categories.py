from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..auth import get_current_user
from ..database import get_db
from ..models import DEFAULT_CATEGORIES, CategoryCreate

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[str])
async def list_categories(current_user: dict = Depends(get_current_user)):
    return current_user.get("categories", list(DEFAULT_CATEGORIES))


@router.post("", response_model=list[str])
async def add_category(
    payload: CategoryCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"categories": payload.name}},
    )
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return updated.get("categories", list(DEFAULT_CATEGORIES))
