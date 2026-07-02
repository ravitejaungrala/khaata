import type { Entry, EntryWithBalance } from "../types";

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DEFAULT_CATEGORIES = ["EMI", "Hostel", "Trips", "Family", "Others"];

const CATEGORY_COLORS: Record<string, string> = {
  EMI: "#9B3B30",
  Hostel: "#2F6F6B",
  Trips: "#5B4B8A",
  Family: "#B8860B",
  Others: "#6B6456",
};
const EXTRA_PALETTE = ["#7A5C3E", "#3D6E8C", "#8C5E42", "#4F7942", "#A44A6E"];
export const INCOME_COLOR = "#1B4332";
export const EXPENSE_COLOR = "#9B3B30";
export const SAVED_COLOR = "#B8860B";

export function colorForCategory(cat: string, idx: number): string {
  return CATEGORY_COLORS[cat] || EXTRA_PALETTE[idx % EXTRA_PALETTE.length];
}

export function fmtINR(n: number): string {
  const v = Math.round(Math.abs(n));
  return (n < 0 ? "-" : "") + "₹" + v.toLocaleString("en-IN");
}

export function fmtCompact(n: number): string {
  n = Math.abs(n);
  if (n >= 1e7) return (n / 1e7).toFixed(1).replace(/\.0$/, "") + "Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(1).replace(/\.0$/, "") + "L";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(Math.round(n));
}

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function sortedWithBalance(entries: Entry[]): EntryWithBalance[] {
  const arr = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );
  let bal = 0;
  return arr.map((e) => {
    bal += e.type === "income" ? e.amount : -e.amount;
    return { ...e, balance: bal };
  });
}

export interface Summary {
  income: number;
  expense: number;
  saved: number;
  byCat: Record<string, number>;
}

export function summarize(list: Entry[]): Summary {
  let income = 0;
  let expense = 0;
  const byCat: Record<string, number> = {};
  list.forEach((e) => {
    if (e.type === "income") {
      income += e.amount;
    } else {
      expense += e.amount;
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    }
  });
  return { income, expense, saved: income - expense, byCat };
}

export function inMonth(
  entries: EntryWithBalance[],
  year: number,
  month: number
): EntryWithBalance[] {
  return entries.filter((e) => {
    const [y, m] = e.date.split("-");
    return parseInt(y, 10) === year && parseInt(m, 10) - 1 === month;
  });
}

export function inYear(
  entries: EntryWithBalance[],
  year: number
): EntryWithBalance[] {
  return entries.filter((e) => parseInt(e.date.slice(0, 4), 10) === year);
}

export interface YearBar {
  month: string;
  Income: number;
  Spent: number;
  Saved: number;
}

export function yearlyBars(
  all: EntryWithBalance[],
  year: number
): YearBar[] {
  return MONTHS.map((label, idx) => {
    const list = all.filter((e) => {
      const [y, m] = e.date.split("-");
      return parseInt(y, 10) === year && parseInt(m, 10) - 1 === idx;
    });
    const s = summarize(list);
    return { month: label, Income: s.income, Spent: s.expense, Saved: s.saved };
  });
}

export function availableYears(entries: Entry[]): number[] {
  const set = new Set<number>([new Date().getFullYear()]);
  entries.forEach((e) => set.add(parseInt(e.date.slice(0, 4), 10)));
  return Array.from(set).sort((a, b) => b - a);
}

export interface DayWiseData {
  days: number[];
  cats: string[];
  map: Record<number, Record<string, number>>;
}

export function dayWiseData(
  monthExpenses: Entry[],
  year: number,
  month: number
): DayWiseData {
  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const cats = Array.from(new Set(monthExpenses.map((e) => e.category)));
  const map: Record<number, Record<string, number>> = {};
  days.forEach((d) => (map[d] = {}));
  monthExpenses.forEach((e) => {
    const d = parseInt(e.date.split("-")[2], 10);
    map[d][e.category] = (map[d][e.category] || 0) + e.amount;
  });
  return { days, cats, map };
}
