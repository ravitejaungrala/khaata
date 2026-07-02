import { useMemo, useState } from "react";
import { api, ApiError, downloadBlob } from "../api";
import type { Entry } from "../types";

type Preset =
  | "this_month"
  | "last_3"
  | "last_6"
  | "this_year"
  | "all"
  | "custom";

function iso(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_3", label: "Last 3 months" },
  { value: "last_6", label: "Last 6 months" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range…" },
];

export function ExportModal({
  open,
  entries,
  onClose,
}: {
  open: boolean;
  entries: Entry[];
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const earliest = useMemo(() => {
    if (!entries.length) return iso(new Date());
    return entries.reduce((m, e) => (e.date < m ? e.date : m), entries[0].date);
  }, [entries]);

  if (!open) return null;

  const resolveRange = (): { start: string; end: string } | null => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const endOfMonth = new Date(y, m + 1, 0);
    switch (preset) {
      case "this_month":
        return { start: iso(new Date(y, m, 1)), end: iso(endOfMonth) };
      case "last_3":
        return { start: iso(new Date(y, m - 2, 1)), end: iso(endOfMonth) };
      case "last_6":
        return { start: iso(new Date(y, m - 5, 1)), end: iso(endOfMonth) };
      case "this_year":
        return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y, 11, 31)) };
      case "all":
        return { start: earliest, end: iso(now) };
      case "custom":
        if (!customStart || !customEnd) return null;
        return { start: customStart, end: customEnd };
    }
  };

  const handleDownload = async () => {
    setError("");
    const range = resolveRange();
    if (!range) {
      setError("Please pick both a start and end date.");
      return;
    }
    if (range.end < range.start) {
      setError("End date must be on or after the start date.");
      return;
    }
    setBusy(true);
    try {
      const blob = await api.exportPdf(range.start, range.end);
      downloadBlob(blob, `khaata-statement_${range.start}_to_${range.end}.pdf`);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-title">Download PDF statement</div>
        <div className="card-hint" style={{ margin: "0 0 6px" }}>
          A detailed table — date, purpose, credit, debit and running balance.
        </div>

        <label className="field-label">Period</label>
        <select
          className="form-select"
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {preset === "custom" && (
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label" style={{ marginTop: 0 }}>
                From
              </label>
              <input
                className="form-input"
                style={{ marginTop: 0 }}
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label" style={{ marginTop: 0 }}>
                To
              </label>
              <input
                className="form-input"
                style={{ marginTop: 0 }}
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-submit" disabled={busy} onClick={handleDownload}>
            {busy ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
