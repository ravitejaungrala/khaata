"""Turns a plain-language message OR a receipt image into ledger *actions*
(create / update / delete) via Google Gemini (multimodal)."""
import base64
import json
import re

import httpx

from .config import get_settings

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)


class ChatbotError(Exception):
    """Raised when the assistant cannot be used (missing key or upstream failure)."""


def _build_action_prompt(
    message: str, categories: list[str], today: str, recent: list[dict]
) -> str:
    cats = ", ".join(categories) if categories else "none yet"
    recent_json = json.dumps(recent, ensure_ascii=False)
    return f"""You are the entry assistant for a personal-finance ledger app. Currency is Indian Rupees (INR).
Today's date is {today} (format YYYY-MM-DD).
The user's existing expense categories are: {cats}.

Here are the user's recent entries, most recent first (JSON). Use these when the user refers to,
corrects, or wants to remove an existing entry:
{recent_json}

Read the user's message and decide the list of actions to take. Every action has an "op":
- "create": a brand-new transaction. Fields: type, amount, category, date, note.
- "update": CORRECT an existing entry. Fields: "id" (copied exactly from the recent list above) plus any of type/amount/category/date/note that should change. Use this whenever the user is fixing something they logged before — e.g. "that was wrong", "actually it's 2500", "the salary is 2500 not 2478", "change groceries to 700", "make yesterday's trip 1200". Choose the entry that best matches by amount / category / recency.
- "delete": remove an existing entry. Fields: "id" (from the recent list).
- "read": the user is ASKING about their data (no change is made). Do NOT compute the numbers yourself — just return the query. Fields: "metric" (one of "spent", "income", "saved", "balance", "count", "list", "top_category"), "period" (one of "this_month", "last_month", "this_year", "last_year", "all"; or "custom" with "start"/"end" as YYYY-MM-DD), and optional "category". Examples: "how much did I spend this month" -> {{"op":"read","metric":"spent","period":"this_month"}}; "how much on groceries this month" -> add "category":"Groceries"; "what is my balance" -> {{"op":"read","metric":"balance"}}; "show my trips" -> {{"op":"read","metric":"list","category":"Trips","period":"this_month"}}; "how much did I save this year" -> {{"op":"read","metric":"saved","period":"this_year"}}.

Field rules:
- "type": "income" for money received (salary, credited, got, received, refund, bonus); "expense" for money spent (spent, paid, bought, gave, cost).
- "amount": a positive number of rupees. Shorthand: "500"=500, "1.5k"=1500, "2 lakh"/"2L"=200000.
- "category": for an expense reuse an existing category if it fits, else a short Title Case name. For income use "Salary".
- "date": resolve relative dates to YYYY-MM-DD using today's date; default to today if unspecified.
- "note": a short natural description.

If the message is not actionable (a greeting or too vague), return an empty "actions" list, set "needs_clarification" to true, and write a short friendly "reply".

Return ONLY valid JSON, no markdown, exactly this shape:
{{"actions":[{{"op":"update","id":"abc123","amount":2500}}],"reply":"a short confirmation","needs_clarification":false}}

User message: {message}"""


def _build_image_prompt(categories: list[str], today: str) -> str:
    cats = ", ".join(categories) if categories else "none yet"
    return f"""You are given an image: a receipt, bill, invoice, or a payment / transaction screenshot.
Today's date is {today} (format YYYY-MM-DD). Currency is Indian Rupees (INR).
The user's existing expense categories are: {cats}.

Read the image carefully and extract the financial transaction(s) it shows as "create" actions.

Rules:
- "type": "expense" for a purchase / bill / payment made; "income" for money received.
- "amount": the TOTAL amount (grand total after tax), a positive number.
- "category": reuse an existing category if it fits, else a short Title Case category from the merchant/items (grocery store -> "Groceries", restaurant -> "Food", fuel -> "Fuel", medicine -> "Health"). For income use "Salary".
- "date": the date printed on the receipt as YYYY-MM-DD; if none, use today's date.
- "note": the merchant / shop name or a short summary.
- If the image has no readable transaction, return an empty "actions" list, set "needs_clarification" to true, and a short reply.

Return ONLY valid JSON, no markdown, exactly this shape:
{{"actions":[{{"op":"create","type":"expense","amount":540,"category":"Groceries","date":"{today}","note":"More Supermarket"}}],"reply":"a short confirmation","needs_clarification":false}}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


async def _call_gemini(parts: list[dict], timeout: float = 45.0) -> dict:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise ChatbotError(
            "The assistant isn't set up yet — add GEMINI_API_KEY to the backend .env file."
        )
    url = GEMINI_URL.format(model=settings.gemini_model)
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                url, params={"key": settings.gemini_api_key}, json=payload
            )
    except httpx.HTTPError as exc:
        raise ChatbotError(f"Couldn't reach Gemini: {exc}") from exc

    if resp.status_code != 200:
        detail = ""
        try:
            detail = resp.json().get("error", {}).get("message", "")
        except Exception:
            detail = resp.text[:200]
        raise ChatbotError(f"Gemini error ({resp.status_code}): {detail}")

    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise ChatbotError("Gemini returned an unexpected response.") from exc

    try:
        parsed = _extract_json(text)
    except json.JSONDecodeError as exc:
        raise ChatbotError("Couldn't understand the assistant's reply.") from exc

    # Normalise: prefer "actions"; accept legacy "entries" as creates.
    if "actions" not in parsed or not isinstance(parsed.get("actions"), list):
        legacy = parsed.get("entries")
        if isinstance(legacy, list):
            parsed["actions"] = [{"op": "create", **e} for e in legacy]
        else:
            parsed["actions"] = []
    parsed.setdefault("reply", "")
    parsed.setdefault("needs_clarification", False)
    return parsed


async def parse_message(
    message: str, categories: list[str], today: str, recent: list[dict]
) -> dict:
    parts = [{"text": _build_action_prompt(message, categories, today, recent)}]
    return await _call_gemini(parts, timeout=30.0)


async def parse_image(
    image_bytes: bytes, mime_type: str, categories: list[str], today: str
) -> dict:
    b64 = base64.b64encode(image_bytes).decode("ascii")
    parts = [
        {"text": _build_image_prompt(categories, today)},
        {"inline_data": {"mime_type": mime_type or "image/jpeg", "data": b64}},
    ]
    return await _call_gemini(parts, timeout=60.0)
