import { useState, useRef, useEffect } from "react";
import { Plus, Briefcase, Loader2, AlertCircle, Search, Trash2, Pencil, Check, X } from "lucide-react";
import {
  collection,
  addDoc,
  doc,
  serverTimestamp,
  writeBatch,
  getDocs,
  query as firestoreQuery,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "sonner";

function InlineEditInput({ initialValue, onSave, onCancel, saving }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSave(value);
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="flex-1 min-w-0 rounded-md border border-blue-300 bg-white py-1 px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
      />
      <button
        onClick={() => onSave(value)}
        disabled={saving || !value.trim()}
        className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-40 transition"
        title="Save"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function RoleManager({ roles, onRefresh }) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  // Guard against duplicate names (client-side check against already-loaded list).
  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    if (roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Role "${name}" already exists.`);
      return;
    }

    setAdding(true);
    try {
      await addDoc(collection(db, "roles"), {
        name,
        createdAt: serverTimestamp(),
      });
      toast.success(`Role "${name}" added.`);
      setNewName("");
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error("Failed to add role: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  // Atomic rename: updates the role doc + all denormalized role_name fields
  // in questions and raw_responses via a single writeBatch commit.
  // writeBatch is atomic — all writes succeed or none do.
  const handleEdit = async (id, oldName, newNameRaw) => {
    const newName = newNameRaw.trim();
    if (!newName || newName === oldName) {
      setEditingId(null);
      return;
    }
    if (roles.some((r) => r.id !== id && r.name.toLowerCase() === newName.toLowerCase())) {
      toast.error(`Role "${newName}" already exists.`);
      return;
    }
    setSavingId(id);
    try {
      const batch = writeBatch(db);

      // 1. Update the role document itself
      batch.update(doc(db, "roles", id), { name: newName });

      // 2. Cascade: update denormalized role_name in questions
      const questionsSnap = await getDocs(
        firestoreQuery(collection(db, "questions"), where("role_id", "==", id))
      );
      questionsSnap.forEach((d) => batch.update(d.ref, { role_name: newName }));

      // 3. Cascade: update denormalized role_name in raw_responses
      const rawSnap = await getDocs(
        firestoreQuery(collection(db, "raw_responses"), where("role_id", "==", id))
      );
      rawSnap.forEach((d) => batch.update(d.ref, { role_name: newName }));

      await batch.commit();
      toast.success(
        `Role renamed to "${newName}". Updated ${questionsSnap.size} question set(s) and ${rawSnap.size} response(s).`
      );
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error("Failed to rename: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  // Safe delete: checks for references first and blocks deletion if any exist.
  // Deletion is wrapped in a writeBatch so it is atomic even if extended later.
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete role "${name}"? This action cannot be undone.`)) return;
    setDeletingId(id);
    try {
      // Fetch reference counts before touching anything
      const [questionsSnap, rawSnap] = await Promise.all([
        getDocs(firestoreQuery(collection(db, "questions"), where("role_id", "==", id))),
        getDocs(firestoreQuery(collection(db, "raw_responses"), where("role_id", "==", id))),
      ]);

      if (questionsSnap.size > 0 || rawSnap.size > 0) {
        toast.error(
          `Cannot delete "${name}" — ${questionsSnap.size} question set(s) and ${rawSnap.size} student response(s) reference it. Rename it instead, or remove those records first.`
        );
        return;
      }

      // No references — safe to delete atomically
      const batch = writeBatch(db);
      batch.delete(doc(db, "roles", id));
      await batch.commit();
      toast.success(`Role "${name}" deleted.`);
      onRefresh();
    } catch (err) {
      toast.error("Failed to delete: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Add Role
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
        >
          <Briefcase className="h-4 w-4 text-blue-500 shrink-0" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Role name (e.g. Software Engineer)"
            required
            autoFocus
            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700 transition"
          >
            {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setNewName(""); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
        </form>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-slate-100 p-3">
            <AlertCircle className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            {query ? "No roles match your search." : "No roles yet. Add one above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-200 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                  <Briefcase className="h-4 w-4 text-slate-500" />
                </div>
                {editingId === r.id ? (
                  <InlineEditInput
                    initialValue={r.name}
                    saving={savingId === r.id}
                    onSave={(val) => handleEdit(r.id, r.name, val)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-800 truncate">{r.name}</span>
                )}
              </div>
              {editingId !== r.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                  <button
                    onClick={() => { setEditingId(r.id); setShowForm(false); }}
                    disabled={!!deletingId || !!savingId}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition disabled:opacity-40"
                    title="Edit role name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id, r.name)}
                    disabled={deletingId === r.id || !!savingId}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40"
                    title="Delete role"
                  >
                    {deletingId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        {filtered.length} of {roles.length} {roles.length === 1 ? "role" : "roles"}
      </p>
    </div>
  );
}
