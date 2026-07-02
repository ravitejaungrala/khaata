import { fmtINR } from "../lib/ledger";
import type { Entry } from "../types";

export function UndoToast({
  entry,
  onUndo,
  onDismiss,
}: {
  entry: Entry | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  if (!entry) return null;
  const label = entry.type === "income" ? "Salary credited" : entry.category;
  const sign = entry.type === "income" ? "+" : "−";
  return (
    <div className="undo-toast" role="status">
      <span className="undo-text">
        Deleted {label} · {sign}
        {fmtINR(entry.amount)}
      </span>
      <button className="undo-btn" onClick={onUndo}>
        Undo
      </button>
      <button className="undo-x" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
