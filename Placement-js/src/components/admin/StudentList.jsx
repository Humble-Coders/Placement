import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";
import { Users, Search, GraduationCap, AlertCircle, Loader2, RefreshCw } from "lucide-react";

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function StudentList({ refreshKey }) {
  const [students, setStudents] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query_str, setQueryStr] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const usersQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        orderBy("lastLogin", "desc")
      );
      const [usersSnap, profilesSnap] = await Promise.all([
        getDocs(usersQ),
        getDocs(collection(db, "students")),
      ]);

      const profileMap = {};
      profilesSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.email) profileMap[data.email.toLowerCase()] = data;
      });

      setStudents(usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      setProfiles(profileMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const branches = [...new Set(
    Object.values(profiles).map((p) => p.branch).filter(Boolean)
  )].sort();

  const filtered = students.filter((s) => {
    const email = s.email?.toLowerCase() ?? "";
    const profile = profiles[email];
    const matchesQuery =
      !query_str ||
      email.includes(query_str.toLowerCase()) ||
      profile?.name?.toLowerCase().includes(query_str.toLowerCase()) ||
      profile?.roll?.toLowerCase().includes(query_str.toLowerCase());
    const matchesBranch = !branchFilter || profile?.branch === branchFilter;
    return matchesQuery && matchesBranch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading students…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => load(true)} className="text-xs text-blue-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query_str}
            onChange={(e) => setQueryStr(e.target.value)}
            placeholder="Search by email, name, roll…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {branches.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-slate-200 py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
          <Users className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-sm font-semibold text-blue-700">{students.length}</span>
          <span className="text-xs text-blue-400">Registered</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
          <GraduationCap className="h-3.5 w-3.5 text-green-500" />
          <span className="text-sm font-semibold text-green-700">{Object.keys(profiles).length}</span>
          <span className="text-xs text-green-400">With Profile</span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-slate-100 p-3">
            <AlertCircle className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            {query_str || branchFilter ? "No students match your filters." : "No students have signed up yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Roll No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const profile = profiles[s.email?.toLowerCase()] ?? {};
                return (
                  <tr key={s.uid} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {profile.name ?? <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {profile.roll ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.email}</td>
                    <td className="px-4 py-3">
                      {profile.branch ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {profile.branch}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDate(s.lastLogin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {students.length} students
      </p>
    </div>
  );
}
