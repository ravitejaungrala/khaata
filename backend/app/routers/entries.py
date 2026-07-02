from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..auth import get_current_user
from ..database import get_db
from ..models import EntryCreate, EntryPublic

router = APIRouter(prefix="/api/entries", tags=["entries"])


def entry_to_public(doc: dict) -> EntryPublic:
    return EntryPublic(
        id=str(doc["_id"]),
        type=doc["type"],
        amount=doc["amount"],
        category=doc["category"],
        date=doc["date"],
        note=doc.get("note", ""),
    )


@router.get("", response_model=list[EntryPublic])
async def list_entries(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db.entries.find({"user_id": current_user["_id"]}).sort("date", 1)
    return [entry_to_public(doc) async for doc in cursor]


@router.post("", response_model=EntryPublic, status_code=status.HTTP_201_CREATED)
async def create_entry(
    payload: EntryCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    category = "Salary" if payload.type == "income" else payload.category

    if payload.type == "expense" and category not in current_user.get("categories", []):
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$addToSet": {"categories": category}},
        )

    doc = {
        "user_id": current_user["_id"],
        "type": payload.type,
        "amount": payload.amount,
        "category": category,
        "date": payload.date,
        "note": payload.note.strip(),
    }
    result = await db.entries.insert_one(doc)
    doc["_id"] = result.inserted_id
    return entry_to_public(doc)


@router.put("/{entry_id}", response_model=EntryPublic)
async def update_entry(
    entry_id: str,
    payload: EntryCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Entry not found")

    existing = await db.entries.find_one({"_id": oid, "user_id": current_user["_id"]})
    if existing is None:
        raise HTTPException(status_code=404, detail="Entry not found")

    category = "Salary" if payload.type == "income" else payload.category
    if payload.type == "expense" and category not in current_user.get("categories", []):
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$addToSet": {"categories": category}},
        )

    await db.entries.update_one(
        {"_id": oid, "user_id": current_user["_id"]},
        {"$set": {
            "type": payload.type,
            "amount": payload.amount,
            "category": category,
            "date": payload.date,
            "note": payload.note.strip(),
        }},
    )
    updated = await db.entries.find_one({"_id": oid})
    return entry_to_public(updated)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Entry not found")

    result = await db.entries.delete_one(
        {"_id": oid, "user_id": current_user["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return None
