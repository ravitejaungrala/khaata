"""Builds a tabular PDF statement (bank-statement style) from ledger entries."""
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

GREEN = colors.HexColor("#1B4332")
RED = colors.HexColor("#9B3B30")
CREAM = colors.HexColor("#F3EEE1")
MUTED = colors.HexColor("#8A8371")
LINE = colors.HexColor("#D9D1B8")


def _inr_group(value: float) -> str:
    """Indian-style digit grouping, e.g. 100000 -> 1,00,000."""
    n = int(round(abs(value)))
    s = str(n)
    if len(s) <= 3:
        grouped = s
    else:
        last3 = s[-3:]
        rest = s[:-3]
        parts = []
        while len(rest) > 2:
            parts.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.insert(0, rest)
        grouped = ",".join(parts) + "," + last3
    return grouped


def fmt_money(value: float) -> str:
    if value is None:
        return ""
    sign = "-" if value < 0 else ""
    return f"{sign}Rs. {_inr_group(value)}"


def _pretty_date(iso: str) -> str:
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d %b %Y")
    except ValueError:
        return iso


def build_statement_pdf(
    user: dict,
    all_entries: list[dict],
    start: str,
    end: str,
) -> bytes:
    """
    all_entries: every entry for the user (any date), each a dict with
    type/amount/category/date/note. Running balance is computed across the
    full history; only rows within [start, end] are printed.
    """
    ordered = sorted(all_entries, key=lambda e: (e["date"], str(e.get("_id", ""))))

    running = 0.0
    opening = 0.0
    rows = []
    total_credit = 0.0
    total_debit = 0.0

    for e in ordered:
        is_income = e["type"] == "income"
        amt = float(e["amount"])
        # Everything strictly before the window contributes to the opening balance.
        if e["date"] < start:
            running += amt if is_income else -amt
            opening = running
            continue
        if e["date"] > end:
            continue
        running += amt if is_income else -amt
        if is_income:
            purpose = e.get("note") or "Salary / Income"
            credit = fmt_money(amt)
            debit = ""
            total_credit += amt
        else:
            base = e.get("category", "")
            note = e.get("note")
            purpose = f"{base} — {note}" if note else base
            credit = ""
            debit = fmt_money(amt)
            total_debit += amt
        rows.append(
            [
                _pretty_date(e["date"]),
                purpose,
                credit,
                debit,
                fmt_money(running),
            ]
        )

    closing = running

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Khaata Statement",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Title"], textColor=GREEN, fontSize=22, spaceAfter=2
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"], textColor=MUTED, fontSize=9
    )
    cell_style = ParagraphStyle(
        "Cell", parent=styles["Normal"], fontSize=8.5, leading=11
    )

    story = []
    story.append(Paragraph("Khaata — Account Statement", title_style))
    who = user.get("name", "")
    code = user.get("login_code")
    who_line = who + (f"  ·  Login ID {code}" if code else "")
    story.append(Paragraph(who_line, sub_style))
    story.append(
        Paragraph(
            f"Period: {_pretty_date(start)} to {_pretty_date(end)}  ·  "
            f"Generated {datetime.now().strftime('%d %b %Y, %H:%M')}",
            sub_style,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        Paragraph(
            f"<b>Opening balance:</b> {fmt_money(opening)}  &nbsp;&nbsp; "
            f"<b>Closing balance:</b> {fmt_money(closing)}",
            ParagraphStyle("Bal", parent=styles["Normal"], fontSize=10),
        )
    )
    story.append(Spacer(1, 4 * mm))

    header = ["Date", "Purpose", "Credit", "Debit", "Balance"]
    data = [header]
    # Wrap the (potentially long) purpose column in a Paragraph so it flows.
    for r in rows:
        data.append(
            [r[0], Paragraph(r[1], cell_style), r[2], r[3], r[4]]
        )
    if not rows:
        data.append(["—", Paragraph("No transactions in this period.", cell_style), "", "", ""])

    data.append(
        ["", "Totals", fmt_money(total_credit), fmt_money(total_debit), fmt_money(closing)]
    )

    col_widths = [24 * mm, 68 * mm, 27 * mm, 27 * mm, 30 * mm]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, 0), CREAM),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTSIZE", (0, 1), (-1, -1), 8.5),
                ("ALIGN", (2, 0), (4, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TEXTCOLOR", (2, 1), (2, -2), GREEN),
                ("TEXTCOLOR", (3, 1), (3, -2), RED),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#FBF8F0")]),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, GREEN),
                ("LINEBELOW", (0, 1), (-1, -2), 0.3, LINE),
                ("LINEABOVE", (0, -1), (-1, -1), 0.8, GREEN),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 6 * mm))
    story.append(
        Paragraph(
            "Credit = money in (income) · Debit = money out (expense) · "
            "Balance = running balance after each transaction.",
            sub_style,
        )
    )

    doc.build(story)
    return buf.getvalue()
