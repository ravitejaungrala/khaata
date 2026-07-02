from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..auth import get_current_user
from ..database import get_db
from ..pdf_export import build_statement_pdf

router = APIRouter(prefix="/api/export", tags=["export"])


def _valid_date(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start and end must be YYYY-MM-DD dates.",
        )
    return value


@router.get("/pdf")
async def export_pdf(
    start: str,
    end: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    start = _valid_date(start)
    end = _valid_date(end)
    if end < start:
        raise HTTPException(status_code=422, detail="end must be on or after start.")

    cursor = db.entries.find({"user_id": current_user["_id"]})
    entries = [e async for e in cursor]

    pdf_bytes = build_statement_pdf(current_user, entries, start, end)
    filename = f"khaata-statement_{start}_to_{end}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
