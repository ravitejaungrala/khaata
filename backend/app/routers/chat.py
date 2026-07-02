import calendar
from datetime import date

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..auth import get_current_user
from ..chatbot import ChatbotError, parse_image, parse_message
from ..database import get_db
from ..models import DEFAULT_CATEGORIES, ChatMessage, ChatReply, EntryCreate
from .entries import entry_to_public

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB
RECENT_LIMIT = 40


def _fmt_amount(n: float) -> str:
    return f"Rs.{int(round(n)):,}"


def _validate(fields: dict) -> EntryCreate | None:
    try:
        return EntryCreate(
            type=fields["type"],
            amount=fields["amount"],
            category=fields.get("category", "Others"),
            date=fields["date"],
            note=fields.get("note", "") or "",
        )
    except Exception:
        return None


# ---------- READ / query support ----------
def _period_bounds(period: str, action: dict, today: date):
    """Return (start_iso | None, end_iso | None, human_label)."""
    y, m = today.year, today.month

    def eom(yy: int, mm: int) -> date:
        return date(yy, mm, calendar.monthrange(yy, mm)[1])

    period = (period or "this_month").lower()
    if period == "last_month":
        mm, yy = (m - 1, y) if m > 1 else (12, y - 1)
        return date(yy, mm, 1).isoformat(), eom(yy, mm).isoformat(), "last month"
    if period == "this_year":
        return date(y, 1, 1).isoformat(), date(y, 12, 31).isoformat(), f"in {y}"
    if period == "last_year":
        return date(y - 1, 1, 1).isoformat(), date(y - 1, 12, 31).isoformat(), f"in {y - 1}"
    if period == "all":
        return None, None, "in total"
    if period == "custom":
        return action.get("start") or None, action.get("end") or None, "in that period"
    return date(y, m, 1).isoformat(), eom(y, m).isoformat(), "this month"


async def _answer_read(action: dict, uid, db: AsyncIOMotorDatabase, today: date) -> str:
    metric = (action.get("metric") or "spent").lower()
    category = action.get("category")
    start, end, label = _period_bounds(action.get("period", "this_month"), action, today)

    all_entries = [e async for e in db.entries.find({"user_id": uid})]

    def in_range(e: dict) -> bool:
        if start and e["date"] < start:
            return False
        if end and e["date"] > end:
            return False
        return True

    scoped = [e for e in all_entries if in_range(e)]

    def total_expense(items, cat=None):
        return sum(
            e["amount"]
            for e in items
            if e["type"] == "expense" and (cat is None or e["category"].lower() == cat.lower())
        )

    def total_income(items):
        return sum(e["amount"] for e in items if e["type"] == "income")

    if metric == "balance":
        bal = total_income(all_entries) - total_expense(all_entries)
        return f"Your balance to date is {_fmt_amount(bal)}."

    if metric == "income":
        return f"Your income {label} is {_fmt_amount(total_income(scoped))}."

    if metric == "saved":
        inc = total_income(scoped)
        saved = inc - total_expense(scoped)
        rate = f" ({round(saved / inc * 100)}% of income)" if inc > 0 else ""
        return f"You saved {_fmt_amount(saved)} {label}{rate}."

    if metric == "count":
        items = scoped if not category else [
            e for e in scoped if e["category"].lower() == category.lower()
        ]
        noun = "entry" if len(items) == 1 else "entries"
        return f"You have {len(items)} {noun} {label}."

    if metric == "top_category":
        by: dict = {}
        for e in scoped:
            if e["type"] == "expense":
                by[e["category"]] = by.get(e["category"], 0) + e["amount"]
        if not by:
            return f"No expenses {label}."
        name, amt = max(by.items(), key=lambda kv: kv[1])
        return f"Your biggest spending category {label} is {name} at {_fmt_amount(amt)}."

    if metric == "list":
        items = [
            e
            for e in scoped
            if e["type"] == "expense" and (category is None or e["category"].lower() == category.lower())
        ]
        items.sort(key=lambda e: e["date"])
        if not items:
            what = category if category else "expenses"
            return f"No {what} {label}."
        total = sum(e["amount"] for e in items)
        head = f"{category} " if category else ""
        lines = []
        for e in items[:15]:
            note = e.get("note") or e["category"]
            lines.append(f"• {e['date']} — {note}: {_fmt_amount(e['amount'])}")
        more = f"\n…and {len(items) - 15} more" if len(items) > 15 else ""
        return (
            f"Your {head}expenses {label} ({_fmt_amount(total)} total):\n"
            + "\n".join(lines)
            + more
        )

    # default: spent
    spent = total_expense(scoped, category)
    if category:
        return f"You spent {_fmt_amount(spent)} on {category} {label}."
    n = len([e for e in scoped if e["type"] == "expense"])
    noun = "expense" if n == 1 else "expenses"
    return f"You've spent {_fmt_amount(spent)} {label} across {n} {noun}."


async def _apply(
    parsed: dict,
    current_user: dict,
    db: AsyncIOMotorDatabase,
    categories: list[str],
    today: date,
) -> ChatReply:
    """Apply the create / read / update / delete actions the model returned."""
    created = []
    updated = []
    deleted = 0
    read_replies: list[str] = []
    new_cats: list[str] = []
    uid = current_user["_id"]

    for action in parsed.get("actions", []):
        op = (action.get("op") or "create").lower()

        if op == "read":
            read_replies.append(await _answer_read(action, uid, db, today))

        elif op == "delete":
            try:
                oid = ObjectId(action.get("id", ""))
            except Exception:
                continue
            res = await db.entries.delete_one({"_id": oid, "user_id": uid})
            deleted += res.deleted_count

        elif op == "update":
            try:
                oid = ObjectId(action.get("id", ""))
            except Exception:
                continue
            existing = await db.entries.find_one({"_id": oid, "user_id": uid})
            if not existing:
                continue
            merged = {
                "type": existing["type"],
                "amount": existing["amount"],
                "category": existing["category"],
                "date": existing["date"],
                "note": existing.get("note", ""),
            }
            for k in ("type", "amount", "category", "date", "note"):
                if k in action and action[k] is not None:
                    merged[k] = action[k]
            entry = _validate(merged)
            if not entry:
                continue
            cat = "Salary" if entry.type == "income" else entry.category
            if entry.type == "expense" and cat not in categories and cat not in new_cats:
                new_cats.append(cat)
            await db.entries.update_one(
                {"_id": oid, "user_id": uid},
                {"$set": {
                    "type": entry.type,
                    "amount": entry.amount,
                    "category": cat,
                    "date": entry.date,
                    "note": entry.note.strip(),
                }},
            )
            updated.append({"amount": entry.amount, "type": entry.type, "category": cat, "date": entry.date})

        else:  # create
            entry = _validate(action)
            if not entry:
                continue
            cat = "Salary" if entry.type == "income" else entry.category
            if entry.type == "expense" and cat not in categories and cat not in new_cats:
                new_cats.append(cat)
            doc = {
                "user_id": uid,
                "type": entry.type,
                "amount": entry.amount,
                "category": cat,
                "date": entry.date,
                "note": entry.note.strip(),
            }
            result = await db.entries.insert_one(doc)
            doc["_id"] = result.inserted_id
            created.append(entry_to_public(doc))

    if new_cats:
        await db.users.update_one(
            {"_id": uid}, {"$addToSet": {"categories": {"$each": new_cats}}}
        )

    lines = []
    for c in created:
        lines.append(f"added {_fmt_amount(c.amount)} {c.type} · {c.category} · {c.date}")
    for u in updated:
        lines.append(f"corrected to {_fmt_amount(u['amount'])} {u['type']} · {u['category']} · {u['date']}")
    if deleted:
        lines.append(f"removed {deleted} " + ("entry" if deleted == 1 else "entries"))

    if lines:
        reply = "Done:\n" + "\n".join("• " + line for line in lines)
    elif read_replies:
        reply = "\n\n".join(read_replies)
    else:
        reply = parsed.get("reply") or (
            "I couldn't work out what you meant. Try telling me an amount, a correction, or ask a question like \"how much did I spend this month?\"."
        )

    return ChatReply(
        reply=reply,
        created=created,
        needs_clarification=bool(parsed.get("needs_clarification", not (lines or read_replies))),
    )


@router.post("", response_model=ChatReply)
async def chat(
    payload: ChatMessage,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    categories = current_user.get("categories", list(DEFAULT_CATEGORIES))
    today = date.today()

    recent = []
    cursor = db.entries.find({"user_id": current_user["_id"]}).sort("date", -1).limit(RECENT_LIMIT)
    async for e in cursor:
        recent.append({
            "id": str(e["_id"]),
            "type": e["type"],
            "amount": e["amount"],
            "category": e["category"],
            "date": e["date"],
            "note": e.get("note", ""),
        })

    try:
        parsed = await parse_message(payload.message.strip(), categories, today.isoformat(), recent)
    except ChatbotError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return await _apply(parsed, current_user, db, categories, today)


@router.post("/image", response_model=ChatReply)
async def chat_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Please upload an image file (JPG, PNG, etc.).",
        )
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image is too large (max 8 MB). Try a smaller photo.",
        )
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty image file.")

    categories = current_user.get("categories", list(DEFAULT_CATEGORIES))
    today = date.today()
    try:
        parsed = await parse_image(data, file.content_type, categories, today.isoformat())
    except ChatbotError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return await _apply(parsed, current_user, db, categories, today)
