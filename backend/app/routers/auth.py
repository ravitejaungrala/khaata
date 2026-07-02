from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from ..auth import (
    create_access_token,
    get_current_user,
    hash_password,
    user_to_public,
    verify_password,
)
from ..database import get_db
from ..models import DEFAULT_CATEGORIES, Token, UserCreate, UserPublic

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _next_login_code(db: AsyncIOMotorDatabase) -> str:
    """Atomically grab the next sequential sign-in code, zero-padded to 3 digits."""
    counter = await db.counters.find_one_and_update(
        {"_id": "user_seq"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{counter['seq']:03d}"


def _normalize_code(value: str) -> str:
    """Digits-only input is padded to at least 3 chars so "16" matches "016"."""
    return value.zfill(3) if value.isdigit() else value


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    login_code = await _next_login_code(db)
    doc = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "login_code": login_code,
        "password_hash": hash_password(payload.password),
        "categories": list(DEFAULT_CATEGORIES),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token = create_access_token(str(result.inserted_id))
    return Token(access_token=token, user=user_to_public(doc))


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # OAuth2PasswordRequestForm uses "username" — here it can be an email OR a login code.
    ident = form_data.username.strip()
    if "@" in ident:
        query = {"email": ident.lower()}
    else:
        query = {"login_code": _normalize_code(ident)}
    user = await db.users.find_one(query)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/login ID or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(str(user["_id"]))
    return Token(access_token=token, user=user_to_public(user))


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return user_to_public(current_user)
