import { Fragment, useState } from "react";
import {
  colorForCategory,
  fmtINR,
  INCOME_COLOR,
  EXPENSE_COLOR,
  SAVED_COLOR,
  MONTHS,
  type DayWiseData,
  type YearBar,
} from "../lib/ledger";
import type { Entry, ViewMode } from "../types";
import { Donut, GroupedBar, LineChart, StackedBar } from "./charts";

function ViewToggle({
  mode,
  onToggle,
}: {
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
}) {
  return (
    <div className="view-toggle">
      <button
        className={mode === "chart" ? "active" : ""}
        title="Graph view"
        onClick={() => onToggle("chart")}
      >
        ◔
      </button>
      <button
        className={mode === "table" ? "active" : ""}
        title="Table view"
        onClick={() => onToggle("table")}
      >
        ▤
      </button>
    </div>
  );
}

function CardShell({
  title,
  mode,
  onToggle,
  hint,
  children,
}: {
  title: string;
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">{title}</div>
        <ViewToggle mode={mode} onToggle={onToggle} />
      </div>
      {hint && <div className="card-hint">{hint}</div>}
      <div className="body">{children}</div>
    </div>
  );
}

/* ---------- Category pie / table ---------- */
function CategoryTable({
  sorted,
  total,
  entriesList,
}: {
  sorted: [string, number][];
  total: number;
  entriesList: Entry[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="right">Amount</th>
            <th className="right">Share</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([name, value], i) => {
            const catEntries = entriesList
              .filter((e) => e.category === name)
              .sort((a, b) => a.date.localeCompare(b.date));
            const isOpen = open[name];
            return (
              <Fragment key={name}>
                <tr
                  className="clickable-row"
                  title="Tap to see individual entries"
                  onClick={() =>
                    setOpen((o) => ({ ...o, [name]: !o[name] }))
                  }
                >
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <span
                        className="legend-dot"
                        style={{
                          display: "inline-block",
                          background: colorForCategory(name, i),
                        }}
                      />
                      {name}
                      <span style={{ color: "#8A8371", fontSize: 11 }}>
                        {catEntries.length ? ` (${catEntries.length})` : ""}
                      </span>
                    </span>
                  </td>
                  <td
                    className="right"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {fmtINR(value)}
                  </td>
                  <td
                    className="right"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: "#8A8371",
                    }}
                  >
                    {total > 0 ? Math.round((value / total) * 100) : 0}%
                  </td>
                </tr>
                {isOpen &&
                  catEntries.map((e) => {
                    const dd = e.date.split("-")[2];
                    const mm = MONTHS[parseInt(e.date.split("-")[1], 10) - 1];
                    return (
                      <tr key={e.id} className="cat-detail-row">
                        <td
                          style={{
                            paddingLeft: 26,
                            color: "#6B6456",
                            fontSize: 12,
                            fontStyle: "italic",
                          }}
                        >
                          ↳ {dd} {mm} — {e.note || "no note"}
                        </td>
                        <td
                          className="right"
                          style={{ color: "#6B6456", fontSize: 12 }}
                        >
                          {fmtINR(e.amount)}
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td
              className="right"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {fmtINR(total)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div className="card-hint" style={{ marginTop: 8 }}>
        Tap a category to see each entry that made it up — handy for a mixed
        bucket like "Others".
      </div>
    </>
  );
}

export function PieCard({
  title,
  byCat,
  total,
  mode,
  onToggle,
  entriesList,
}: {
  title: string;
  byCat: Record<string, number>;
  total: number;
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
  entriesList: Entry[];
}) {
  const entries = Object.entries(byCat);
  if (entries.length === 0) {
    return (
      <div
        className="card"
        style={{ textAlign: "center", padding: "36px 20px" }}
      >
        <div className="empty-text">No expenses logged yet.</div>
      </div>
    );
  }
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return (
    <CardShell title={title} mode={mode} onToggle={onToggle}>
      {mode === "chart" ? (
        <div className="chart-flex">
          <div className="chart-box">
            <Donut entries={sorted} total={total} />
          </div>
          <div className="legend-col">
            {sorted.map(([name, value], i) => (
              <div className="legend-row" key={name}>
                <span
                  className="legend-dot"
                  style={{ background: colorForCategory(name, i) }}
                />
                <span className="legend-name">{name}</span>
                <span className="legend-val">{fmtINR(value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <CategoryTable
          sorted={sorted}
          total={total}
          entriesList={entriesList}
        />
      )}
    </CardShell>
  );
}

/* ---------- Month summary table (shared by bar & line) ---------- */
function MonthTable({
  bars,
  onGoToMonth,
}: {
  bars: YearBar[];
  onGoToMonth: (i: number) => void;
}) {
  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            <th>Mo.</th>
            <th className="right">Income</th>
            <th className="right">Spent</th>
            <th className="right">Saved</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((r, idx) => (
            <tr
              key={r.month}
              className="clickable-row"
              title={`View ${r.month} in detail`}
              onClick={() => onGoToMonth(idx)}
            >
              <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {r.month}
              </td>
              <td
                className="right"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: INCOME_COLOR,
                }}
              >
                {fmtINR(r.Income)}
              </td>
              <td
                className="right"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: EXPENSE_COLOR,
                }}
              >
                {fmtINR(r.Spent)}
              </td>
              <td
                className="right"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: SAVED_COLOR,
                }}
              >
                {fmtINR(r.Saved)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="card-hint" style={{ marginTop: 8 }}>
        Tap a month to see its detailed breakdown.
      </div>
    </>
  );
}

export function BarCard({
  title,
  bars,
  mode,
  onToggle,
  onGoToMonth,
}: {
  title: string;
  bars: YearBar[];
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
  onGoToMonth: (i: number) => void;
}) {
  return (
    <CardShell title={title} mode={mode} onToggle={onToggle}>
      {mode === "chart" ? (
        <GroupedBar bars={bars} onClickIndex={onGoToMonth} />
      ) : (
        <MonthTable bars={bars} onGoToMonth={onGoToMonth} />
      )}
    </CardShell>
  );
}

export function LineCard({
  title,
  bars,
  mode,
  onToggle,
  onGoToMonth,
}: {
  title: string;
  bars: YearBar[];
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
  onGoToMonth: (i: number) => void;
}) {
  return (
    <CardShell title={title} mode={mode} onToggle={onToggle}>
      {mode === "chart" ? (
        <LineChart bars={bars} onClickIndex={onGoToMonth} />
      ) : (
        <MonthTable bars={bars} onGoToMonth={onGoToMonth} />
      )}
    </CardShell>
  );
}

/* ---------- Day-wise card ---------- */
function DayWiseTable({ list, month }: { list: Entry[]; month: number }) {
  if (!list.length) {
    return <div className="empty-text">No expenses logged yet.</div>;
  }
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const catOrder = Array.from(new Set(sorted.map((e) => e.category)));
  const total = sorted.reduce((s, e) => s + e.amount, 0);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Note</th>
          <th className="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((e) => {
          const d = e.date.split("-")[2];
          const ci = catOrder.indexOf(e.category);
          return (
            <tr key={e.id}>
              <td
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {d} {MONTHS[month]}
              </td>
              <td>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <span
                    className="legend-dot"
                    style={{
                      display: "inline-block",
                      background: colorForCategory(e.category, ci),
                    }}
                  />
                  {e.category}
                </span>
              </td>
              <td style={{ color: "#8A8371", fontStyle: "italic" }}>
                {e.note || "—"}
              </td>
              <td
                className="right"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {fmtINR(e.amount)}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3}>Total</td>
          <td className="right">{fmtINR(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function DayCard({
  title,
  monthExpenses,
  data,
  month,
  mode,
  onToggle,
}: {
  title: string;
  monthExpenses: Entry[];
  data: DayWiseData;
  month: number;
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
}) {
  if (monthExpenses.length === 0) {
    return (
      <div
        className="card"
        style={{ textAlign: "center", padding: "36px 20px" }}
      >
        <div className="empty-text">No expenses logged yet.</div>
      </div>
    );
  }
  return (
    <CardShell
      title={title}
      mode={mode}
      onToggle={onToggle}
      hint="See exactly which day and category the money went to."
    >
      {mode === "chart" ? (
        <>
          <StackedBar data={data} />
          <div className="svg-legend-inline">
            {data.cats.map((cat, i) => (
              <div
                className="legend-row"
                style={{ padding: "2px 0" }}
                key={cat}
              >
                <span
                  className="legend-dot"
                  style={{ background: colorForCategory(cat, i) }}
                />
                <span className="legend-name" style={{ fontSize: "12.5px" }}>
                  {cat}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <DayWiseTable list={monthExpenses} month={month} />
      )}
    </CardShell>
  );
}

/* ---------- Overview card: Income vs Spent vs Saved ---------- */
export function OverviewCard({
  title,
  income,
  expense,
  saved,
  mode,
  onToggle,
}: {
  title: string;
  income: number;
  expense: number;
  saved: number;
  mode: ViewMode;
  onToggle: (m: ViewMode) => void;
}) {
  const max = Math.max(1, income, expense, Math.abs(saved));
  const rate = income > 0 ? Math.round((saved / income) * 100) : null;
  const rows = [
    { label: "Income", value: income, color: INCOME_COLOR },
    { label: "Spent", value: expense, color: EXPENSE_COLOR },
    { label: "Saved", value: saved, color: SAVED_COLOR },
  ];
  return (
    <CardShell title={title} mode={mode} onToggle={onToggle}>
      {mode === "chart" ? (
        <div className="overview-bars">
          {rows.map((r) => (
            <div className="overview-row" key={r.label}>
              <span className="overview-label">{r.label}</span>
              <div className="overview-track">
                <div
                  className="overview-fill"
                  style={{
                    width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%`,
                    background: r.color,
                  }}
                />
              </div>
              <span className="overview-value" style={{ color: r.color }}>
                {fmtINR(r.value)}
              </span>
            </div>
          ))}
          {rate !== null && (
            <div className="overview-note">
              You saved {rate}% of your income this period.
            </div>
          )}
        </div>
      ) : (
        <table className="data-table">
          <tbody>
            <tr>
              <td>Income</td>
              <td
                className="right"
                style={{ color: INCOME_COLOR, fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {fmtINR(income)}
              </td>
            </tr>
            <tr>
              <td>Spent</td>
              <td
                className="right"
                style={{ color: EXPENSE_COLOR, fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {fmtINR(expense)}
              </td>
            </tr>
            <tr>
              <td>Saved</td>
              <td
                className="right"
                style={{ color: SAVED_COLOR, fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {fmtINR(saved)}
              </td>
            </tr>
            <tr>
              <td>Savings rate</td>
              <td className="right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {rate === null ? "—" : rate + "%"}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </CardShell>
  );
}
