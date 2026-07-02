import { useEffect, useState } from "react";
import { todayISO } from "../lib/ledger";
import type { Entry, EntryType, NewEntry } from "../types";

const NEW_CATEGORY = "__new__";

export function EntryModal({
  open,
  categories,
  editEntry,
  onClose,
  onSubmit,
  onUpdate,
}: {
  open: boolean;
  categories: string[];
  editEntry?: Entry | null;
  onClose: () => void;
  onSubmit: (entry: NewEntry) => Promise<void>;
  onUpdate: (id: string, entry: NewEntry) => Promise<void>;
}) {
  const [formType, setFormType] = useState<EntryType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] || "Others");
  const [newCategory, setNewCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = !!editEntry;

  // Reset / prefill the form whenever it (re)opens.
  useEffect(() => {
    if (!open) return;
    if (editEntry) {
      setFormType(editEntry.type);
      setAmount(String(editEntry.amount));
      setCategory(editEntry.category);
      setNewCategory("");
      setDate(editEntry.date);
      setNote(editEntry.note || "");
    } else {
      setFormType("expense");
      setAmount("");
      setCategory(categories[0] || "Others");
      setNewCategory("");
      setDate(todayISO());
      setNote("");
    }
    setSaving(false);
  }, [open, editEntry, categories]);

  if (!open) return null;

  // Ensure the entry's own category is selectable even if it's not in the list.
  const catOptions =
    isEdit && editEntry && !categories.includes(editEntry.category) && editEntry.type === "expense"
      ? [editEntry.category, ...categories]
      : categories;

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !date) return;
    let cat = formType === "income" ? "Salary" : category;
    if (formType === "expense" && cat === NEW_CATEGORY) {
      const trimmed = newCategory.trim();
      if (!trimmed) return;
      cat = trimmed;
    }
    const payload: NewEntry = {
      type: formType,
      amount: amt,
      category: cat,
      date,
      note: note.trim(),
    };
    setSaving(true);
    try {
      if (isEdit && editEntry) {
        await onUpdate(editEntry.id, payload);
      } else {
        await onSubmit(payload);
      }
      onClose();
    } finally {
      setSaving(false);
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
        <div className="modal-title">{isEdit ? "Edit entry" : "New entry"}</div>
        <div className="tab-group" style={{ width: "100%" }}>
          <button
            className={`tab-btn ${formType === "income" ? "active" : ""}`}
            style={{
              flex: 1,
              background: formType === "income" ? "#1B4332" : undefined,
              color: formType === "income" ? "#F3EEE1" : undefined,
            }}
            onClick={() => setFormType("income")}
          >
            Salary / Income
          </button>
          <button
            className={`tab-btn ${formType === "expense" ? "active" : ""}`}
            style={{
              flex: 1,
              background: formType === "expense" ? "#9B3B30" : undefined,
              color: formType === "expense" ? "#F3EEE1" : undefined,
            }}
            onClick={() => setFormType("expense")}
          >
            Expense
          </button>
        </div>

        <label className="field-label">Amount</label>
        <div className="amount-wrap">
          <span>₹</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>

        {formType === "expense" && (
          <div>
            <label className="field-label">Category</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {catOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
            {category === NEW_CATEGORY && (
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Groceries"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            )}
          </div>
        )}

        <label className="field-label">Date</label>
        <input
          className="form-input"
          type="date"
          style={{ marginTop: 0 }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <label className="field-label">Note (optional)</label>
        <input
          className="form-input"
          type="text"
          style={{ marginTop: 0 }}
          placeholder="e.g. June EMI, trip to Goa…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-submit"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
