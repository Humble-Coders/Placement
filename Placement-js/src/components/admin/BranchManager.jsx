import { useState, useRef, useEffect } from "react";
import { Plus, GraduationCap, Loader2, AlertCircle, Search, Trash2, Pencil, Check, X } from "lucide-react";
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

export default function BranchManager({ branches, onRefresh }) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase())
  );

  // Guard against duplicate names (client-side check against already-loaded list).
  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    if (branches.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Branch "${name}" already exists.`);
      return;
    }

    setAdding(true);
    try {
      await addDoc(collection(db, "branches"), {
        name,
        createdAt: serverTimestamp(),
      });
      toast.success(`Branch "${name}" added.`);
      setNewName("");
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error("Failed to add branch: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  // Atomic rename: updates the branch doc + ALL name-based references across
  // the database via a single writeBatch commit (all writes succeed or none do).
  //
  // Branch names are stored as plain strings in four places:
  //   1. branches/{id}.name               — the master record
  //   2. questions.branches[]             — student-reported branch array
  //   3. questions.official_branches[]    — admin-set branch array
  //   4. raw_responses.branch             — string field on each response
  //   5. students.branch                  — string field on student profile
  const handleEdit = async (id, oldName, newNameRaw) => {
    const newName = newNameRaw.trim();
    if (!newName || newName === oldName) {
      setEditingId(null);
      return;
    }
    if (branches.some((b) => b.id !== id && b.name.toLowerCase() === newName.toLowerCase())) {
      toast.error(`Branch "${newName}" already exists.`);
      return;
    }
    setSavingId(id);
    try {
      const batch = writeBatch(db);

      // 1. Update the branch master document
      batch.update(doc(db, "branches", id), { name: newName });

      // 2 & 3. Update questions.branches[] and questions.official_branches[].
      // Branch names live inside arrays so we must fetch all questions and
      // filter client-side (Firestore array-contains doesn't support in-place
      // updates). Only documents that actually contain the old name are written.
      let questionsUpdated = 0;
      const questionsSnap = await getDocs(collection(db, "questions"));
      questionsSnap.forEach((d) => {
        const data = d.data();
        const branches = data.branches || [];
        const officialBranches = data.official_branches || [];

        const hasBranch = branches.includes(oldName);
        const hasOfficial = officialBranches.includes(oldName);

        if (hasBranch || hasOfficial) {
          batch.update(d.ref, {
            branches: hasBranch
              ? branches.map((b) => (b === oldName ? newName : b))
              : branches,
            official_branches: hasOfficial
              ? officialBranches.map((b) => (b === oldName ? newName : b))
              : officialBranches,
          });
          questionsUpdated++;
        }
      });

      // 4. Update raw_responses.branch (exact string field — queryable)
      const rawSnap = await getDocs(
        firestoreQuery(collection(db, "raw_responses"), where("branch", "==", oldName))
      );
      rawSnap.forEach((d) => batch.update(d.ref, { branch: newName }));

      // 5. Update students.branch (exact string field — queryable)
      const studentsSnap = await getDocs(
        firestoreQuery(collection(db, "students"), where("branch", "==", oldName))
      );
      studentsSnap.forEach((d) => batch.update(d.ref, { branch: newName }));

      await batch.commit();
      toast.success(
        `Branch renamed to "${newName}". Updated ${questionsUpdated} question set(s), ${rawSnap.size} response(s), and ${studentsSnap.size} student profile(s).`
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
  // Because branch names are stored in arrays (questions) and string fields
  // (raw_responses, students), we check both before allowing deletion.
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete branch "${name}"? This action cannot be undone.`)) return;
    setDeletingId(id);
    try {
      // Check raw_responses and students via Firestore queries
      const [rawSnap, studentsSnap] = await Promise.all([
        getDocs(firestoreQuery(collection(db, "raw_responses"), where("branch", "==", name))),
        getDocs(firestoreQuery(collection(db, "students"), where("branch", "==", name))),
      ]);

      // Check questions array fields client-side (array-contains can't be
      // combined with the delete check efficiently).
      const questionsSnap = await getDocs(collection(db, "questions"));
      const referencingQuestions = questionsSnap.docs.filter((d) => {
        const data = d.data();
        return (data.branches || []).includes(name) || (data.official_branches || []).includes(name);
      });

      const totalRefs = referencingQuestions.length + rawSnap.size + studentsSnap.size;
      if (totalRefs > 0) {
        toast.error(
          `Cannot delete "${name}" — ${referencingQuestions.length} question set(s), ${rawSnap.size} response(s), and ${studentsSnap.size} student profile(s) reference it. Rename it instead, or remove those records first.`
        );
        return;
      }

      // No references — safe to delete atomically
      const batch = writeBatch(db);
      batch.delete(doc(db, "branches", id));
      await batch.commit();
      toast.success(`Branch "${name}" deleted.`);
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
            placeholder="Search branches…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Add Branch
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
        >
          <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Branch name (e.g. CSE, ECE, ME)"
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
            {query ? "No branches match your search." : "No branches yet. Add one above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-200 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 border border-green-100 shrink-0">
                  <GraduationCap className="h-4 w-4 text-green-600" />
                </div>
                {editingId === b.id ? (
                  <InlineEditInput
                    initialValue={b.name}
                    saving={savingId === b.id}
                    onSave={(val) => handleEdit(b.id, b.name, val)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-800 truncate">{b.name}</span>
                )}
              </div>
              {editingId !== b.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                  <button
                    onClick={() => { setEditingId(b.id); setShowForm(false); }}
                    disabled={!!deletingId || !!savingId}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition disabled:opacity-40"
                    title="Edit branch name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id, b.name)}
                    disabled={deletingId === b.id || !!savingId}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40"
                    title="Delete branch"
                  >
                    {deletingId === b.id ? (
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
        {filtered.length} of {branches.length} {branches.length === 1 ? "branch" : "branches"}
      </p>
    </div>
  );
}
