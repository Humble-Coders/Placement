import { useState } from "react";
import { Plus, Briefcase, Loader2, AlertCircle, Search, Trash2 } from "lucide-react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "sonner";

export default function RoleManager({ roles, onRefresh }) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete role "${name}"? This won't remove associated questions.`)) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "roles", id));
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
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                  <Briefcase className="h-4 w-4 text-slate-500" />
                </div>
                <span className="text-sm font-medium text-slate-800">{r.name}</span>
              </div>
              <button
                onClick={() => handleDelete(r.id, r.name)}
                disabled={deletingId === r.id}
                className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                title="Delete role"
              >
                {deletingId === r.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
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
