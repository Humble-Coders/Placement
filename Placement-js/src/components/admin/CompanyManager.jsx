import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus, Building2, Loader2, AlertCircle, Search, Trash2, Pencil,
  Check, X, ChevronDown, ChevronRight, RefreshCw, Briefcase,
} from "lucide-react";
import {
  collection, addDoc, doc, serverTimestamp, writeBatch,
  getDocs, query as firestoreQuery, where, setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "sonner";
import { cn } from "../ui/utils";

// ─── Inline edit input ────────────────────────────────────────────────────────

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

// ─── Single role bucket card ──────────────────────────────────────────────────

function BucketCard({ bucket, onDelete, onAddOfficialRole, onRemoveOfficialRole }) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setAdding(true);
    await onAddOfficialRole(trimmed);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
      {/* Bucket header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 shrink-0">
            <Briefcase className="h-3.5 w-3.5 text-blue-500" />
          </span>
          <span className="text-sm font-semibold text-slate-800">{bucket.role_name}</span>
          <span className="text-xs text-slate-400">
            {bucket.official_roles?.length
              ? `${bucket.official_roles.length} official role${bucket.official_roles.length !== 1 ? "s" : ""}`
              : "no official roles"}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="rounded p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
          title="Remove role bucket"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Official roles tags */}
      {bucket.official_roles?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bucket.official_roles.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
            >
              {r}
              <button
                type="button"
                onClick={() => onRemoveOfficialRole(r)}
                className="rounded-full text-violet-400 hover:text-violet-700 p-0.5 transition"
                title="Remove"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add official role input */}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Add official role (e.g. SDE-1)…"
          className="flex-1 rounded border border-slate-200 bg-slate-50 py-1 px-2 text-xs placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 focus:bg-white transition"
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim() || adding}
          className="flex items-center gap-1 rounded bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ─── Role buckets section (per company) ───────────────────────────────────────

function RoleBucketsSection({ company, roles }) {
  const [buckets, setBuckets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addingBucket, setAddingBucket] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [savingBucket, setSavingBucket] = useState(false);

  const loadBuckets = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "companies", company.id, "role_buckets"));
      setBuckets(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.role_name.localeCompare(b.role_name))
      );
    } catch (err) {
      toast.error("Failed to load role buckets: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => { loadBuckets(); }, [loadBuckets]);

  // Roles not yet added as a bucket for this company
  const availableRoles = roles.filter(
    (r) => !buckets?.some((b) => b.role_id === r.id)
  );

  const handleAddBucket = async () => {
    if (!selectedRoleId) return;
    const role = roles.find((r) => r.id === selectedRoleId);
    setSavingBucket(true);
    try {
      await setDoc(doc(db, "companies", company.id, "role_buckets", selectedRoleId), {
        role_id: selectedRoleId,
        role_name: role.name,
        official_roles: [],
      });
      toast.success(`Role bucket "${role.name}" added to ${company.name}.`);
      setSelectedRoleId("");
      setAddingBucket(false);
      loadBuckets();
    } catch (err) {
      toast.error("Failed to add role bucket: " + err.message);
    } finally {
      setSavingBucket(false);
    }
  };

  const handleDeleteBucket = async (bucket) => {
    if (!window.confirm(`Remove role bucket "${bucket.role_name}" from ${company.name}?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "companies", company.id, "role_buckets", bucket.id));
      await batch.commit();
      toast.success(`Role bucket "${bucket.role_name}" removed.`);
      loadBuckets();
    } catch (err) {
      toast.error("Failed to remove role bucket: " + err.message);
    }
  };

  const updateBucketOfficialRoles = async (bucket, newRoles) => {
    await setDoc(
      doc(db, "companies", company.id, "role_buckets", bucket.id),
      { official_roles: newRoles },
      { merge: true }
    );
    loadBuckets();
  };

  const handleAddOfficialRole = async (bucket, officialRole) => {
    if (bucket.official_roles?.includes(officialRole)) {
      toast.error("That official role already exists in this bucket.");
      return;
    }
    try {
      await updateBucketOfficialRoles(bucket, [...(bucket.official_roles || []), officialRole]);
    } catch (err) {
      toast.error("Failed to add official role: " + err.message);
    }
  };

  const handleRemoveOfficialRole = async (bucket, roleToRemove) => {
    try {
      await updateBucketOfficialRoles(
        bucket,
        (bucket.official_roles || []).filter((r) => r !== roleToRemove)
      );
    } catch (err) {
      toast.error("Failed to remove official role: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading role buckets…
      </div>
    );
  }

  return (
    <div className="mt-3 pl-1 space-y-2.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Role Buckets
      </p>

      {buckets?.length === 0 && !addingBucket && (
        <p className="text-xs text-slate-400">
          No role buckets yet. Add one below or use Sync.
        </p>
      )}

      {buckets?.map((bucket) => (
        <BucketCard
          key={bucket.id}
          bucket={bucket}
          onDelete={() => handleDeleteBucket(bucket)}
          onAddOfficialRole={(r) => handleAddOfficialRole(bucket, r)}
          onRemoveOfficialRole={(r) => handleRemoveOfficialRole(bucket, r)}
        />
      ))}

      {/* Add bucket row */}
      {addingBucket ? (
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">Select a role…</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={handleAddBucket}
            disabled={!selectedRoleId || savingBucket}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-700 transition"
          >
            {savingBucket ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </button>
          <button
            onClick={() => { setAddingBucket(false); setSelectedRoleId(""); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
        </div>
      ) : (
        availableRoles.length > 0 && (
          <button
            onClick={() => setAddingBucket(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition w-full justify-center"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Role Bucket
          </button>
        )
      )}

      {availableRoles.length === 0 && !addingBucket && buckets?.length > 0 && (
        <p className="text-xs text-slate-400">All admin roles have been added as buckets.</p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CompanyManager({ companies, roles, onRefresh }) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  // ── Add ──────────────────────────────────────────────────────────────────────

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (companies.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Company "${name}" already exists.`);
      return;
    }
    setAdding(true);
    try {
      await addDoc(collection(db, "companies"), { name, createdAt: serverTimestamp() });
      toast.success(`Company "${name}" added.`);
      setNewName("");
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error("Failed to add company: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  // ── Rename (cascade) ─────────────────────────────────────────────────────────

  const handleEdit = async (id, oldName, newNameRaw) => {
    const newName = newNameRaw.trim();
    if (!newName || newName === oldName) { setEditingId(null); return; }
    if (companies.some((c) => c.id !== id && c.name.toLowerCase() === newName.toLowerCase())) {
      toast.error(`Company "${newName}" already exists.`);
      return;
    }
    setSavingId(id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "companies", id), { name: newName });

      const [questionsSnap, rawSnap] = await Promise.all([
        getDocs(firestoreQuery(collection(db, "questions"), where("company_id", "==", id))),
        getDocs(firestoreQuery(collection(db, "raw_responses"), where("company_id", "==", id))),
      ]);
      questionsSnap.forEach((d) => batch.update(d.ref, { company_name: newName }));
      rawSnap.forEach((d) => batch.update(d.ref, { company_name: newName }));

      await batch.commit();
      toast.success(`Company renamed to "${newName}". Updated ${questionsSnap.size} question set(s) and ${rawSnap.size} response(s).`);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error("Failed to rename: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete company "${name}"? This action cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const [questionsSnap, rawSnap] = await Promise.all([
        getDocs(firestoreQuery(collection(db, "questions"), where("company_id", "==", id))),
        getDocs(firestoreQuery(collection(db, "raw_responses"), where("company_id", "==", id))),
      ]);
      if (questionsSnap.size > 0 || rawSnap.size > 0) {
        toast.error(
          `Cannot delete "${name}" — ${questionsSnap.size} question set(s) and ${rawSnap.size} student response(s) reference it.`
        );
        return;
      }
      const batch = writeBatch(db);
      batch.delete(doc(db, "companies", id));
      await batch.commit();
      toast.success(`Company "${name}" deleted.`);
      onRefresh();
    } catch (err) {
      toast.error("Failed to delete: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Sync from questions ───────────────────────────────────────────────────────

  const handleSync = async () => {
    if (!window.confirm(
      "Sync role buckets from the questions collection?\n\n" +
      "This will create or overwrite role buckets for each company based on existing question sets. " +
      "Only admin-created roles and official roles from questions will be used."
    )) return;

    setSyncing(true);
    try {
      const questionsSnap = await getDocs(collection(db, "questions"));
      const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Map role IDs to names (admin-created roles only)
      const validRoleIds = new Set(roles.map((r) => r.id));
      const roleNameMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));
      // Map company IDs for existence check
      const validCompanyIds = new Set(companies.map((c) => c.id));

      // Build: companyId → roleId → { role_name, official_roles: Set }
      const structure = {};
      for (const q of questions) {
        if (!q.company_id || !q.role_id) continue;
        if (!validRoleIds.has(q.role_id)) continue;
        if (!validCompanyIds.has(q.company_id)) continue;

        if (!structure[q.company_id]) structure[q.company_id] = {};
        if (!structure[q.company_id][q.role_id]) {
          structure[q.company_id][q.role_id] = {
            role_name: roleNameMap[q.role_id] || q.role_name || "",
            official_roles: new Set(),
          };
        }
        (q.official_roles || []).forEach((or) => {
          if (typeof or === "string" && or.trim()) {
            structure[q.company_id][q.role_id].official_roles.add(or.trim());
          }
        });
      }

      // Flatten to list of write ops
      const ops = [];
      for (const [companyId, buckets] of Object.entries(structure)) {
        for (const [roleId, data] of Object.entries(buckets)) {
          ops.push({ companyId, roleId, data });
        }
      }

      if (ops.length === 0) {
        toast.info("No matching data found in questions to sync.");
        return;
      }

      // Batch write in chunks of 500
      const CHUNK = 500;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db);
        ops.slice(i, i + CHUNK).forEach(({ companyId, roleId, data }) => {
          batch.set(doc(db, "companies", companyId, "role_buckets", roleId), {
            role_id: roleId,
            role_name: data.role_name,
            official_roles: [...data.official_roles],
          });
        });
        await batch.commit();
      }

      toast.success(
        `Sync complete — ${ops.length} role bucket(s) written across ${Object.keys(structure).length} company(s).`
      );
      setExpandedId(null); // collapse so buckets reload fresh on next expand
    } catch (err) {
      toast.error("Sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-60 transition"
          title="Sync role buckets from questions collection"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sync from Questions
        </button>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Add Company
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
        >
          <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Company name (e.g. Google)"
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

      {/* Company list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-slate-100 p-3">
            <AlertCircle className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            {query ? "No companies match your search." : "No companies yet. Add one above."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl border bg-white transition",
                  isExpanded
                    ? "border-blue-200 shadow-sm"
                    : "border-slate-200 hover:border-blue-100 hover:shadow-sm"
                )}
              >
                {/* Company row */}
                <div className="group flex items-center px-4 py-3 gap-3">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 shrink-0 hover:bg-blue-100 transition"
                    title={isExpanded ? "Collapse" : "Expand role buckets"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-blue-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-blue-400" />
                    )}
                  </button>

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                    {editingId === c.id ? (
                      <InlineEditInput
                        initialValue={c.name}
                        saving={savingId === c.id}
                        onSave={(val) => handleEdit(c.id, c.name, val)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <span className="text-sm font-medium text-slate-800 truncate">{c.name}</span>
                    )}
                  </div>

                  {editingId !== c.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                      <button
                        onClick={() => { setEditingId(c.id); setShowForm(false); }}
                        disabled={!!deletingId || !!savingId}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition disabled:opacity-40"
                        title="Edit company name"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deletingId === c.id || !!savingId}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40"
                        title="Delete company"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Role buckets (expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 pb-4">
                    <RoleBucketsSection company={c} roles={roles} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        {filtered.length} of {companies.length} {companies.length === 1 ? "company" : "companies"}
        {" · "}Click a company to manage its role buckets.
      </p>
    </div>
  );
}
