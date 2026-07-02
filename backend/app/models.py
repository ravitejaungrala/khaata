from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

DEFAULT_CATEGORIES = ["EMI", "Hostel", "Trips", "Family", "Others"]

EntryType = Literal["income", "expense"]


# ---------- Auth ----------
class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    login_code: str = ""  # short unique sign-in ID, e.g. "001"
    categories: list[str] = Field(default_factory=lambda: list(DEFAULT_CATEGORIES))


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------- Entries ----------
class EntryCreate(BaseModel):
    type: EntryType
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=60)
    date: str  # ISO YYYY-MM-DD
    note: str = ""

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("date must be in YYYY-MM-DD format") from exc
        return v

    @field_validator("category")
    @classmethod
    def strip_category(cls, v: str) -> str:
        return v.strip()


class EntryPublic(BaseModel):
    id: str
    type: EntryType
    amount: float
    category: str
    date: str
    note: str = ""


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


# ---------- Chatbot ----------
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class ChatReply(BaseModel):
    reply: str
    created: list[EntryPublic] = Field(default_factory=list)
    needs_clarification: bool = False
