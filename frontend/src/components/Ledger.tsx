import { useMemo, useState } from "react";
import {
  availableYears,
  fmtINR,
  INCOME_COLOR,
  EXPENSE_COLOR,
  inMonth,
  inYear,
  MONTHS,
  MONTHS_FULL,
  sortedWithBalance,
  summarize,
  yearlyBars,
} from "../lib/ledger";
import type { Entry, User, ViewMode } from "../types";
import { BarCard, LineCard, OverviewCard, PieCard } from "./Cards";
import { ExportModal } from "./ExportModal";
import { ChatWidget } from "./ChatWidget";

type View = "month" | "year";

export function Ledger({
  user,
  entries,
  onDelete,
  onOpenForm,
  onLogout,
  onChanged,
  onEdit,
}: {
  user: User;
  entries: Entry[];
  onDelete: (id: string) => void;
  onOpenForm: () => void;
  onLogout: () => void;
  onChanged: () => void;
  onEdit: (entry: Entry) => void;
}) {
  const now = new Date();
  const [view, setView] = useState<View>("month");
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [exportOpen, setExportOpen] = useState(false);

  // per-card view modes
  const [monthCatMode, setMonthCatMode] = useState<ViewMode>("chart");
  const [monthOverviewMode, setMonthOverviewMode] = useState<ViewMode>("chart");
  const [yearBarMode, setYearBarMode] = useState<ViewMode>("chart");
  const [yearLineMode, setYearLineMode] = useState<ViewMode>("chart");
  const [yearCatMode, setYearCatMode] = useState<ViewMode>("chart");

  const all = useMemo(() => sortedWithBalance(entries), [entries]);
  const mEntries = useMemo(
    () => inMonth(all, selYear, selMonth),
    [all, selYear, selMonth]
  );
  const yEntries = useMemo(() => inYear(all, selYear), [all, selYear]);
  const mSum = useMemo(() => summarize(mEntries), [mEntries]);
  const ySum = useMemo(() => summarize(yEntries), [yEntries]);
  const bars = useMemo(() => yearlyBars(all, selYear), [all, selYear]);
  const years = useMemo(() => availableYears(entries), [entries]);

  const lifetimeSaved = all.length ? all[all.length - 1].balance : 0;
  const rate = mSum.income > 0 ? Math.round((mSum.saved / mSum.income) * 100) : null;
  const activeSum = view === "month" ? mSum : ySum;

  const goToMonth = (monthIdx: number) => {
    setSelMonth(monthIdx);
    setView("month");
  };
  const shiftMonth = (delta: number) => {
    let m = selMonth + delta;
    let y = selYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setSelMonth(m);
    setSelYear(y);
  };

  const mExpenses = mEntries.filter((e) => e.type === "expense");
  const yExpenses = yEntries.filter((e) => e.type === "expense");

  const ledgerList = [...(view === "month" ? mEntries : yEntries)].reverse();

  return (
    <div className="container">
      <header>
        <div>
          <div className="eyebrow">MONTHLY LEDGER · PERSONAL ACCOUNT</div>
          <h1>Khaata</h1>
          <div className="subtitle">
            Track what comes in, what goes out, what stays.
          </div>
        </div>
        <div className="header-actions">
          <div className="stamp">
            <div>
              <div className="lbl">SAVED</div>
              <div className="pct">{rate === null ? "—" : rate + "%"}</div>
              <div className="sub">THIS MONTH</div>
            </div>
          </div>
          <span className="user-chip">
            {user.name}
            {user.login_code ? ` · ID ${user.login_code}` : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="logout-btn" onClick={() => setExportOpen(true)}>
              ⬇ PDF
            </button>
            <button className="logout-btn" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="period-bar">
        <div className="tab-group">
          <button
            className={`tab-btn ${view === "month" ? "active" : ""}`}
            onClick={() => setView("month")}
          >
            Monthly
          </button>
          <button
            className={`tab-btn ${view === "year" ? "active" : ""}`}
            onClick={() => setView("year")}
          >
            Yearly
          </button>
        </div>
        {view === "month" ? (
          <div className="month-nav">
            <button className="nav-btn" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <div className="nav-label">
              {MONTHS_FULL[selMonth]} {selYear}
            </div>
            <button className="nav-btn" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>
        ) : (
          <select
            className="year-select"
            value={selYear}
            onChange={(e) => setSelYear(parseInt(e.target.value, 10))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="cards-grid">
        <div className="summary-card">
          <div className="top">↗ Income</div>
          <div className="value" style={{ color: "#1B4332" }}>
            {fmtINR(activeSum.income)}
          </div>
        </div>
        <div className="summary-card">
          <div className="top">↘ Spent</div>
          <div className="value" style={{ color: "#9B3B30" }}>
            {fmtINR(activeSum.expense)}
          </div>
        </div>
        <div className="summary-card">
          <div className="top">🐷 Saved</div>
          <div className="value" style={{ color: "#B8860B" }}>
            {fmtINR(activeSum.saved)}
          </div>
        </div>
        <div className="summary-card">
          <div className="top">💼 Balance to date</div>
          <div className="value" style={{ color: "#1F2A24" }}>
            {fmtINR(lifetimeSaved)}
          </div>
        </div>
      </div>

      <div className="charts-area">
        {view === "month" ? (
          <>
            <OverviewCard
              title={`Overview — ${MONTHS_FULL[selMonth]}`}
              income={mSum.income}
              expense={mSum.expense}
              saved={mSum.saved}
              mode={monthOverviewMode}
              onToggle={setMonthOverviewMode}
            />
            <PieCard
              title={`Spend analysis — ${MONTHS_FULL[selMonth]}`}
              byCat={mSum.byCat}
              total={mSum.expense}
              mode={monthCatMode}
              onToggle={setMonthCatMode}
              entriesList={mExpenses}
            />
          </>
        ) : (
          <>
            <BarCard
              title={`Income vs. spend — ${selYear}`}
              bars={bars}
              mode={yearBarMode}
              onToggle={setYearBarMode}
              onGoToMonth={goToMonth}
            />
            <LineCard
              title={`Savings trend — ${selYear}`}
              bars={bars}
              mode={yearLineMode}
              onToggle={setYearLineMode}
              onGoToMonth={goToMonth}
            />
            {Object.keys(ySum.byCat).length > 0 && (
              <PieCard
                title={`Category split — ${selYear}`}
                byCat={ySum.byCat}
                total={ySum.expense}
                mode={yearCatMode}
                onToggle={setYearCatMode}
                entriesList={yExpenses}
              />
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          {view === "month"
            ? `Entries — ${MONTHS_FULL[selMonth]} ${selYear}`
            : `Entries — ${selYear}`}
        </div>
        <div>
          {ledgerList.length === 0 ? (
            <div className="empty-text">
              Nothing recorded {view === "month" ? "this month" : "this year"} yet.
            </div>
          ) : (
            <div className="ledger-scroll">
              <div className="ledger-head-row">
                <span style={{ width: 74 }}>Date</span>
                <span style={{ flex: 1 }}>Particulars</span>
                <span style={{ width: 90, textAlign: "right" }}>Amount</span>
                <span
                  className="lg-hide-sm"
                  style={{ width: 100, textAlign: "right" }}
                >
                  Balance
                </span>
                <span style={{ width: 56 }}></span>
              </div>
              {ledgerList.map((e) => {
                const [, m, d] = e.date.split("-");
                return (
                  <div className="ledger-row" key={e.id}>
                    <span className="ledger-date">
                      {d} {MONTHS[parseInt(m, 10) - 1]}
                    </span>
                    <span className="ledger-mid">
                      <div className="name">
                        {e.type === "income" ? "Salary credited" : e.category}
                      </div>
                      {e.note && <div className="note">{e.note}</div>}
                    </span>
                    <span
                      className="ledger-amt"
                      style={{
                        color: e.type === "income" ? INCOME_COLOR : EXPENSE_COLOR,
                      }}
                    >
                      {e.type === "income" ? "+" : "−"}
                      {fmtINR(e.amount)}
                    </span>
                    <span className="ledger-bal lg-hide-sm">
                      {fmtINR(e.balance)}
                    </span>
                    <span className="ledger-actions">
                      <button
                        className="edit-btn"
                        onClick={() => onEdit(e)}
                        title="Edit entry"
                      >
                        ✎
                      </button>
                      <button
                        className="del-btn"
                        onClick={() => onDelete(e.id)}
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button className="fab" onClick={onOpenForm} title="Add entry">
        +
      </button>

      <ExportModal
        open={exportOpen}
        entries={entries}
        onClose={() => setExportOpen(false)}
      />

      <ChatWidget onChanged={onChanged} />
    </div>
  );
}
