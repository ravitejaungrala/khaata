import { useCallback, useEffect, useRef, useState } from "react";
import { api, clearToken, getToken } from "./api";
import { AuthScreen } from "./components/AuthScreen";
import { EntryModal } from "./components/EntryModal";
import { Ledger } from "./components/Ledger";
import { UndoToast } from "./components/UndoToast";
import type { Entry, NewEntry, User } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [undoEntry, setUndoEntry] = useState<Entry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    const [ents, u] = await Promise.all([api.listEntries(), api.me()]);
    setEntries(ents);
    setUser(u);
  }, []);

  // Restore session on first load.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    loadData()
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [loadData]);

  const handleAuth = async (u: User) => {
    setUser(u);
    setLoading(true);
    try {
      const ents = await api.listEntries();
      setEntries(ents);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setEntries([]);
    setUndoEntry(null);
  };

  const handleSubmit = async (entry: NewEntry) => {
    const created = await api.createEntry(entry);
    setEntries((prev) => [...prev, created]);
    // Refresh user so newly-created categories show up in the picker.
    api.me().then(setUser).catch(() => {});
  };

  const handleUpdate = async (id: string, entry: NewEntry) => {
    const updated = await api.updateEntry(id, entry);
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    api.me().then(setUser).catch(() => {});
  };

  const openCreate = () => {
    setEditEntry(null);
    setModalOpen(true);
  };

  const handleEdit = (entry: Entry) => {
    setEditEntry(entry);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditEntry(null);
  };

  const showUndo = (entry: Entry) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEntry(entry);
    undoTimer.current = setTimeout(() => setUndoEntry(null), 6000);
  };

  const handleDelete = async (id: string) => {
    const removed = entries.find((e) => e.id === id) || null;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await api.deleteEntry(id);
      if (removed) showUndo(removed);
    } catch {
      // On failure, reload to resync.
      api.listEntries().then(setEntries).catch(() => {});
    }
  };

  const handleUndo = async () => {
    if (!undoEntry) return;
    const e = undoEntry;
    setUndoEntry(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    try {
      const restored = await api.createEntry({
        type: e.type,
        amount: e.amount,
        category: e.category,
        date: e.date,
        note: e.note,
      });
      setEntries((prev) => [...prev, restored]);
      api.me().then(setUser).catch(() => {});
    } catch {
      api.listEntries().then(setEntries).catch(() => {});
    }
  };

  if (loading) {
    return <div className="app-loading">Loading your ledger…</div>;
  }

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <>
      <Ledger
        user={user}
        entries={entries}
        onDelete={handleDelete}
        onOpenForm={openCreate}
        onLogout={handleLogout}
        onChanged={loadData}
        onEdit={handleEdit}
      />
      <EntryModal
        open={modalOpen}
        categories={user.categories}
        editEntry={editEntry}
        onClose={closeModal}
        onSubmit={handleSubmit}
        onUpdate={handleUpdate}
      />
      <UndoToast
        entry={undoEntry}
        onUndo={handleUndo}
        onDismiss={() => setUndoEntry(null)}
      />
    </>
  );
}
